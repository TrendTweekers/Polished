import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import compression from "compression";
import serveStatic from "serve-static";

import { config, isProd } from "./config.js";
import { shopify } from "./shopify.js";
import { prisma } from "./db.js";
import { authRouter } from "./auth.js";
import { apiRouter } from "./routes/api.js";
import { handleWebhook } from "./webhooks.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIST = path.resolve(__dirname, "../web/dist");

const app = express();
app.disable("x-powered-by");
app.use(compression());

// --- Health check (no auth) -------------------------------------------------
app.get("/health", (_req, res) => res.json({ ok: true }));

// --- Webhooks: raw text body so HMAC verification stays valid ---------------
app.post("/api/webhooks", express.text({ type: "*/*" }), handleWebhook);

// --- Content Security Policy for the embedded admin iframe -------------------
app.use((req, res, next) => {
  const shop = shopify.utils.sanitizeShop(req.query.shop, false);
  const frameAncestors = shop
    ? `https://${shop} https://admin.shopify.com`
    : "https://admin.shopify.com";
  res.setHeader("Content-Security-Policy", `frame-ancestors ${frameAncestors};`);
  next();
});

// --- OAuth routes -----------------------------------------------------------
app.use("/api", authRouter);

// --- Authenticated app API --------------------------------------------------
app.use("/api", express.json({ limit: "2mb" }), apiRouter);

// --- Frontend (production build) --------------------------------------------
let indexHtmlCache = null;
function readIndexHtml() {
  if (indexHtmlCache && isProd) return indexHtmlCache;
  const file = path.join(WEB_DIST, "index.html");
  const html = fs
    .readFileSync(file, "utf8")
    .replace(/__SHOPIFY_API_KEY__/g, config.shopify.apiKey);
  indexHtmlCache = html;
  return html;
}

if (isProd) {
  app.use(serveStatic(WEB_DIST, { index: false }));

  // App entry: if the shop has no stored token yet, start OAuth; otherwise
  // serve the embedded React app.
  app.get("/*", (req, res) => {
    if (req.path.startsWith("/api")) {
      return res.status(404).json({ error: "not_found" });
    }

    // Always serve the embedded React app. App Bridge issues a session token,
    // and the backend completes install/auth via token exchange on first call.
    try {
      res.set("Content-Type", "text/html").send(readIndexHtml());
    } catch (error) {
      console.error("[server] failed to serve app entry:", error.message);
      res
        .status(500)
        .send("The app could not start. Please try again or reinstall from your Shopify admin.");
    }
  });
}

// --- Error handler ----------------------------------------------------------
app.use((err, _req, res, _next) => {
  console.error("[server] unhandled error:", err);
  if (res.headersSent) return;
  res.status(500).json({ error: "internal_error" });
});

const server = app.listen(config.port, () => {
  console.log(`Polished running on port ${config.port} (${config.nodeEnv})`);
});

async function shutdown() {
  console.log("Shutting down…");
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
