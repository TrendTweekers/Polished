import express from "express";
import { prisma } from "../db.js";
import { verifyRequest } from "../middleware/verifyRequest.js";
import { requireBilling } from "../billing.js";
import { getBillingStatus } from "../billing.js";
import { scanAllProducts } from "../services/products.js";
import {
  translateSelectedProducts,
  publishProductTranslations,
} from "../services/translations.js";
import { config } from "../config.js";

export const apiRouter = express.Router();

// Every /api route below requires a valid App Bridge session token.
apiRouter.use(verifyRequest);

const VALID_TONES = ["formal", "neutral", "casual"];

/** Group flat ProductTranslation rows into per-product objects. */
function groupByProduct(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.shopifyProductId)) {
      map.set(row.shopifyProductId, {
        productId: row.shopifyProductId,
        title: null,
        description: null,
      });
    }
    const entry = map.get(row.shopifyProductId);
    const field = {
      id: row.id,
      original: row.originalText,
      translated: row.translatedText,
      status: row.status,
      qualityFlags: row.qualityFlags,
      manuallyEdited: row.manuallyEdited,
    };
    if (row.field === "title") entry.title = field;
    if (row.field === "description") entry.description = field;
  }
  return [...map.values()];
}

function productStatus(product) {
  const statuses = [product.title?.status, product.description?.status].filter(Boolean);
  if (statuses.length === 0) return "pending";
  if (statuses.every((s) => s === "published")) return "published";
  if (statuses.some((s) => s === "stale")) return "stale";
  if (statuses.every((s) => s === "done" || s === "published")) return "done";
  return "pending";
}

// --- Account / dashboard summary -------------------------------------------
apiRouter.get("/me", async (req, res) => {
  const store = req.store;
  const settings = await prisma.settings.findUnique({ where: { storeId: store.id } });

  const rows = await prisma.productTranslation.findMany({
    where: { storeId: store.id },
  });
  const products = groupByProduct(rows);

  const total = products.length;
  const translated = products.filter((p) =>
    ["done", "published"].includes(productStatus(p))
  ).length;
  const published = products.filter((p) => productStatus(p) === "published").length;

  let billing = { active: true, confirmationUrl: null };
  try {
    billing = await getBillingStatus(store.shopDomain);
  } catch (error) {
    console.error("[api] billing status failed:", error.message);
  }

  res.json({
    shop: store.shopDomain,
    settings: settings ?? { tone: "neutral", autoTranslateNewProducts: false },
    counts: { total, translated, published },
    billing: { enabled: config.billing.enabled, ...billing },
  });
});

// --- Products ---------------------------------------------------------------
apiRouter.get("/products", async (req, res) => {
  const store = req.store;
  const { status, search } = req.query;

  const rows = await prisma.productTranslation.findMany({
    where: { storeId: store.id },
    orderBy: { updatedAt: "desc" },
  });
  let products = groupByProduct(rows).map((p) => ({
    ...p,
    overallStatus: productStatus(p),
  }));

  if (status && status !== "all") {
    products = products.filter((p) => p.overallStatus === status);
  }
  if (search) {
    const q = String(search).toLowerCase();
    products = products.filter(
      (p) =>
        p.title?.original?.toLowerCase().includes(q) ||
        p.title?.translated?.toLowerCase().includes(q)
    );
  }

  res.json({ products });
});

apiRouter.post("/products/scan", requireBilling, async (req, res) => {
  try {
    const result = await scanAllProducts(req.store);
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(502).json({ error: "scan_failed", message: error.message });
  }
});

apiRouter.post("/products/:id/publish", requireBilling, async (req, res) => {
  try {
    const result = await publishProductTranslations(req.store, req.params.id);
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(502).json({ error: "publish_failed", message: error.message });
  }
});

// --- Translation ------------------------------------------------------------
apiRouter.post("/translate", requireBilling, async (req, res) => {
  const { productIds, force } = req.body ?? {};
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return res.status(400).json({ error: "no_products_selected" });
  }
  try {
    const job = await translateSelectedProducts(req.store, productIds, {
      force: Boolean(force),
    });
    res.json({ ok: true, job });
  } catch (error) {
    res.status(502).json({ error: "translate_failed", message: error.message });
  }
});

// Manual edit / override of a single translation field.
apiRouter.put("/translations/:id", async (req, res) => {
  const { translatedText } = req.body ?? {};
  if (typeof translatedText !== "string") {
    return res.status(400).json({ error: "invalid_text" });
  }

  const row = await prisma.productTranslation.findFirst({
    where: { id: req.params.id, storeId: req.store.id },
  });
  if (!row) return res.status(404).json({ error: "not_found" });

  const updated = await prisma.productTranslation.update({
    where: { id: row.id },
    data: {
      translatedText,
      manuallyEdited: true,
      status: "done",
    },
  });
  res.json({ ok: true, translation: updated });
});

// --- Settings ---------------------------------------------------------------
apiRouter.get("/settings", async (req, res) => {
  const settings = await prisma.settings.findUnique({
    where: { storeId: req.store.id },
  });
  res.json({ settings });
});

apiRouter.put("/settings", async (req, res) => {
  const { tone, autoTranslateNewProducts } = req.body ?? {};
  const data = {};
  if (tone !== undefined) {
    if (!VALID_TONES.includes(tone)) {
      return res.status(400).json({ error: "invalid_tone" });
    }
    data.tone = tone;
  }
  if (autoTranslateNewProducts !== undefined) {
    data.autoTranslateNewProducts = Boolean(autoTranslateNewProducts);
  }

  const settings = await prisma.settings.upsert({
    where: { storeId: req.store.id },
    update: data,
    create: { storeId: req.store.id, ...data },
  });
  res.json({ ok: true, settings });
});

// --- Glossary ---------------------------------------------------------------
apiRouter.get("/glossary", async (req, res) => {
  const terms = await prisma.glossaryTerm.findMany({
    where: { storeId: req.store.id },
    orderBy: { originalTerm: "asc" },
  });
  res.json({ terms });
});

apiRouter.post("/glossary", async (req, res) => {
  const { originalTerm, polishTerm, caseSensitive } = req.body ?? {};
  if (!originalTerm?.trim() || !polishTerm?.trim()) {
    return res.status(400).json({ error: "missing_terms" });
  }
  try {
    const term = await prisma.glossaryTerm.create({
      data: {
        storeId: req.store.id,
        originalTerm: originalTerm.trim(),
        polishTerm: polishTerm.trim(),
        caseSensitive: Boolean(caseSensitive),
      },
    });
    res.json({ ok: true, term });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "duplicate_term" });
    }
    throw error;
  }
});

apiRouter.put("/glossary/:id", async (req, res) => {
  const { originalTerm, polishTerm, caseSensitive } = req.body ?? {};
  const existing = await prisma.glossaryTerm.findFirst({
    where: { id: req.params.id, storeId: req.store.id },
  });
  if (!existing) return res.status(404).json({ error: "not_found" });

  const term = await prisma.glossaryTerm.update({
    where: { id: existing.id },
    data: {
      originalTerm: originalTerm?.trim() ?? existing.originalTerm,
      polishTerm: polishTerm?.trim() ?? existing.polishTerm,
      caseSensitive:
        caseSensitive === undefined ? existing.caseSensitive : Boolean(caseSensitive),
    },
  });
  res.json({ ok: true, term });
});

apiRouter.delete("/glossary/:id", async (req, res) => {
  const existing = await prisma.glossaryTerm.findFirst({
    where: { id: req.params.id, storeId: req.store.id },
  });
  if (!existing) return res.status(404).json({ error: "not_found" });

  await prisma.glossaryTerm.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

// --- Jobs (translation progress) -------------------------------------------
apiRouter.get("/jobs/latest", async (req, res) => {
  const job = await prisma.translationJob.findFirst({
    where: { storeId: req.store.id },
    orderBy: { createdAt: "desc" },
  });
  res.json({ job });
});

// --- Billing ----------------------------------------------------------------
apiRouter.get("/billing", async (req, res) => {
  try {
    const status = await getBillingStatus(req.store.shopDomain);
    res.json({ enabled: config.billing.enabled, ...status });
  } catch (error) {
    res.status(500).json({ error: "billing_check_failed", message: error.message });
  }
});
