import { prisma } from "../db.js";
import { graphqlClient } from "../shopify.js";
import { translateProduct } from "./openai.js";
import { idToProductGid } from "./products.js";

const POLISH_LOCALE = "pl";

// Map our internal field names to Shopify translatable content keys.
const FIELD_TO_SHOPIFY_KEY = {
  title: "title",
  description: "body_html",
};

async function getSettings(storeId) {
  const settings = await prisma.settings.findUnique({ where: { storeId } });
  return settings ?? { tone: "neutral", autoTranslateNewProducts: false };
}

async function getGlossary(storeId) {
  return prisma.glossaryTerm.findMany({ where: { storeId } });
}

/**
 * Translate one product's title + description and persist results.
 * Respects manual edits unless `force` is true.
 *
 * @returns {Promise<{translated:number, skipped:number}>}
 */
export async function runTranslationForProduct(store, productId, { force = false } = {}) {
  const rows = await prisma.productTranslation.findMany({
    where: { storeId: store.id, shopifyProductId: productId },
  });
  if (rows.length === 0) return { translated: 0, skipped: 0 };

  const titleRow = rows.find((r) => r.field === "title");
  const descRow = rows.find((r) => r.field === "description");

  // Skip fields that were manually edited unless the caller forces a redo.
  const editedTitle = titleRow?.manuallyEdited && !force;
  const editedDesc = descRow?.manuallyEdited && !force;

  if (editedTitle && editedDesc) {
    return { translated: 0, skipped: rows.length };
  }

  const [settings, glossary] = await Promise.all([
    getSettings(store.id),
    getGlossary(store.id),
  ]);

  const result = await translateProduct({
    title: titleRow?.originalText ?? "",
    description: descRow?.originalText ?? "",
    tone: settings.tone,
    glossary,
  });

  let translated = 0;
  let skipped = 0;

  if (titleRow) {
    if (editedTitle) {
      skipped += 1;
    } else {
      await prisma.productTranslation.update({
        where: { id: titleRow.id },
        data: {
          translatedText: result.translatedTitle,
          qualityFlags: result.qualityFlags,
          status: "done",
          manuallyEdited: false,
        },
      });
      translated += 1;
    }
  }

  if (descRow) {
    if (editedDesc) {
      skipped += 1;
    } else {
      await prisma.productTranslation.update({
        where: { id: descRow.id },
        data: {
          translatedText: result.translatedDescription,
          qualityFlags: result.qualityFlags,
          status: "done",
          manuallyEdited: false,
        },
      });
      translated += 1;
    }
  }

  return { translated, skipped };
}

/**
 * Translate a batch of products under a tracked TranslationJob.
 */
export async function translateSelectedProducts(store, productIds, { force = false } = {}) {
  const ids = [...new Set(productIds.map(String))];

  const job = await prisma.translationJob.create({
    data: {
      storeId: store.id,
      status: "running",
      totalItems: ids.length,
    },
  });

  let processed = 0;
  let failed = 0;

  for (const productId of ids) {
    try {
      await runTranslationForProduct(store, productId, { force });
      processed += 1;
    } catch (error) {
      failed += 1;
      console.error(`[translate] product ${productId} failed:`, error.message);
    }
    await prisma.translationJob.update({
      where: { id: job.id },
      data: { processedItems: processed, failedItems: failed },
    });
  }

  return prisma.translationJob.update({
    where: { id: job.id },
    data: {
      status: failed === ids.length && ids.length > 0 ? "failed" : "done",
      completedAt: new Date(),
    },
  });
}

/**
 * Webhook helper: auto-translate a newly created product when the setting is on.
 */
export async function maybeAutoTranslateProduct(store, productId) {
  try {
    await runTranslationForProduct(store, productId);
  } catch (error) {
    console.error(`[translate] auto-translate failed for ${productId}:`, error.message);
  }
}

const TRANSLATABLE_CONTENT_QUERY = `
  query GetDigests($resourceId: ID!) {
    translatableResource(resourceId: $resourceId) {
      translatableContent {
        key
        digest
        locale
      }
    }
  }
`;

const REGISTER_MUTATION = `
  mutation RegisterTranslations($resourceId: ID!, $translations: [TranslationInput!]!) {
    translationsRegister(resourceId: $resourceId, translations: $translations) {
      userErrors {
        field
        message
      }
      translations {
        key
        locale
        value
      }
    }
  }
`;

/**
 * Publish a product's Polish translations to Shopify via the Translations API.
 * Only "done" rows with translated text are published.
 *
 * @returns {Promise<{published:number}>}
 */
export async function publishProductTranslations(store, productId) {
  const rows = await prisma.productTranslation.findMany({
    where: {
      storeId: store.id,
      shopifyProductId: String(productId),
      status: { in: ["done", "published"] },
    },
  });

  const publishable = rows.filter((r) => r.translatedText && r.translatedText.trim() !== "");
  if (publishable.length === 0) {
    throw new Error("Nothing to publish — translate this product first.");
  }

  const client = await graphqlClient(store.shopDomain);
  const resourceId = idToProductGid(productId);

  // Fetch digests for the current source content. Shopify requires the digest
  // of the original string to attach a translation to it.
  let digestResponse;
  try {
    digestResponse = await client.request(TRANSLATABLE_CONTENT_QUERY, {
      variables: { resourceId },
    });
  } catch (error) {
    throw new Error(`Could not read translatable content from Shopify: ${error.message}`);
  }

  const content = digestResponse?.data?.translatableResource?.translatableContent ?? [];
  const digestByKey = {};
  for (const c of content) {
    digestByKey[c.key] = c.digest;
  }

  const translations = [];
  for (const row of publishable) {
    const key = FIELD_TO_SHOPIFY_KEY[row.field];
    const digest = digestByKey[key];
    if (!digest) {
      // Source content with no digest (e.g. empty description) can't be translated.
      continue;
    }
    translations.push({
      locale: POLISH_LOCALE,
      key,
      value: row.translatedText,
      translatableContentDigest: digest,
    });
  }

  if (translations.length === 0) {
    throw new Error(
      "No matching source content found on Shopify. Re-scan products and try again."
    );
  }

  let registerResponse;
  try {
    registerResponse = await client.request(REGISTER_MUTATION, {
      variables: { resourceId, translations },
    });
  } catch (error) {
    throw new Error(`Shopify rejected the translation: ${error.message}`);
  }

  const userErrors = registerResponse?.data?.translationsRegister?.userErrors ?? [];
  if (userErrors.length > 0) {
    const message = userErrors.map((e) => e.message).join("; ");
    throw new Error(`Shopify could not save the translation: ${message}`);
  }

  await prisma.productTranslation.updateMany({
    where: {
      storeId: store.id,
      shopifyProductId: String(productId),
      status: "done",
    },
    data: { status: "published" },
  });

  return { published: translations.length };
}
