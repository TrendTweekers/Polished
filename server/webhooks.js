import { DeliveryMethod } from "@shopify/shopify-api";
import { shopify } from "./shopify.js";
import { prisma } from "./db.js";
import { maybeAutoTranslateProduct } from "./services/translations.js";

const CALLBACK_PATH = "/api/webhooks";

async function getStore(shopDomain) {
  return prisma.store.findUnique({ where: { shopDomain } });
}

/**
 * Upsert the title + description rows for a product. If the original text
 * changed on an existing row, mark it "stale" unless it's already pending.
 */
async function upsertProductFields(storeId, product) {
  const productId = String(product.id);
  const fields = [
    { field: "title", text: product.title ?? "" },
    { field: "description", text: product.body_html ?? "" },
  ];

  for (const { field, text } of fields) {
    const existing = await prisma.productTranslation.findUnique({
      where: {
        storeId_shopifyProductId_field: {
          storeId,
          shopifyProductId: productId,
          field,
        },
      },
    });

    if (!existing) {
      await prisma.productTranslation.create({
        data: {
          storeId,
          shopifyProductId: productId,
          field,
          originalText: text,
          status: "pending",
        },
      });
      continue;
    }

    const changed = existing.originalText !== text;
    await prisma.productTranslation.update({
      where: { id: existing.id },
      data: {
        originalText: text,
        // If the source text changed and we had already translated it, the
        // translation is now out of date.
        status:
          changed && ["done", "published"].includes(existing.status)
            ? "stale"
            : existing.status,
      },
    });
  }
}

const handlers = {
  APP_UNINSTALLED: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: CALLBACK_PATH,
    callback: async (_topic, shop) => {
      // Cascade deletes remove all translations, glossary, jobs and settings.
      await prisma.store.deleteMany({ where: { shopDomain: shop } });
      console.log(`[webhook] app/uninstalled — purged data for ${shop}`);
    },
  },

  PRODUCTS_CREATE: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: CALLBACK_PATH,
    callback: async (_topic, shop, bodyString) => {
      const store = await getStore(shop);
      if (!store) return;
      const product = JSON.parse(bodyString);
      await upsertProductFields(store.id, product);

      const settings = await prisma.settings.findUnique({
        where: { storeId: store.id },
      });
      if (settings?.autoTranslateNewProducts) {
        await maybeAutoTranslateProduct(store, String(product.id));
      }
    },
  },

  PRODUCTS_UPDATE: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: CALLBACK_PATH,
    callback: async (_topic, shop, bodyString) => {
      const store = await getStore(shop);
      if (!store) return;
      const product = JSON.parse(bodyString);
      await upsertProductFields(store.id, product);
    },
  },

  // --- Mandatory GDPR compliance webhooks (required for App Store review) ---
  // Polished stores no customer personal data, so these acknowledge and no-op.
  CUSTOMERS_DATA_REQUEST: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: CALLBACK_PATH,
    callback: async (_topic, shop) => {
      console.log(`[webhook] customers/data_request for ${shop} — no customer data stored`);
    },
  },
  CUSTOMERS_REDACT: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: CALLBACK_PATH,
    callback: async (_topic, shop) => {
      console.log(`[webhook] customers/redact for ${shop} — no customer data stored`);
    },
  },
  SHOP_REDACT: {
    deliveryMethod: DeliveryMethod.Http,
    callbackUrl: CALLBACK_PATH,
    callback: async (_topic, shop) => {
      await prisma.store.deleteMany({ where: { shopDomain: shop } });
      console.log(`[webhook] shop/redact — purged data for ${shop}`);
    },
  },
};

shopify.webhooks.addHandlers(handlers);

/**
 * Register all webhook subscriptions for a freshly authenticated shop.
 */
export async function registerWebhooks(session) {
  try {
    const response = await shopify.webhooks.register({ session });
    for (const [topic, results] of Object.entries(response)) {
      for (const result of results) {
        if (!result.success) {
          console.warn(`[webhook] failed to register ${topic}:`, result.result);
        }
      }
    }
  } catch (error) {
    console.error("[webhook] registration error:", error);
  }
}

/**
 * Express handler that validates HMAC and dispatches to the right callback.
 * Must be mounted with a raw-body parser so the signature stays intact.
 */
export async function handleWebhook(req, res) {
  try {
    await shopify.webhooks.process({
      rawBody: req.body, // Buffer/string from express.raw()
      rawRequest: req,
      rawResponse: res,
    });
  } catch (error) {
    console.error("[webhook] processing error:", error.message);
    if (!res.headersSent) {
      res.status(401).send("Webhook verification failed");
    }
  }
}
