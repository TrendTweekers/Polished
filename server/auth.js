import express from "express";
import { RequestedTokenType } from "@shopify/shopify-api";
import { shopify, storeSession } from "./shopify.js";
import { registerWebhooks } from "./webhooks.js";
import { config } from "./config.js";

export const authRouter = express.Router();

/**
 * Modern embedded-app auth: exchange an App Bridge session token for an offline
 * access token (no cookies, no redirect). This is what powers install/auth from
 * inside the Shopify admin iframe, where the legacy cookie OAuth flow fails.
 */
export async function performTokenExchange(shop, sessionToken) {
  const { session } = await shopify.auth.tokenExchange({
    shop,
    sessionToken,
    requestedTokenType: RequestedTokenType.OfflineAccessToken,
  });

  const store = await storeSession(session);
  // Webhooks (app/uninstalled, products/*, GDPR compliance) are declared in
  // shopify.app.toml and auto-subscribed by Shopify on install — no runtime
  // registration needed under managed installation.
  return store;
}

/**
 * Step 1 of OAuth: redirect the merchant to Shopify's consent screen.
 * Offline tokens only — we make API calls on a schedule, not just in-session.
 */
authRouter.get("/auth", async (req, res) => {
  const shop = shopify.utils.sanitizeShop(req.query.shop, true);
  if (!shop) {
    return res
      .status(400)
      .send("Missing or invalid 'shop' parameter. Open the app from your Shopify admin.");
  }

  await shopify.auth.begin({
    shop,
    callbackPath: "/api/auth/callback",
    isOnline: false,
    rawRequest: req,
    rawResponse: res,
  });
});

/**
 * Step 2 of OAuth: Shopify redirects back here with a code. We exchange it for
 * an offline token, persist it, register webhooks, then bounce into the app.
 */
authRouter.get("/auth/callback", async (req, res) => {
  try {
    const { session } = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    await storeSession(session);
    await registerWebhooks(session);

    const host = req.query.host;
    const params = new URLSearchParams({ shop: session.shop });
    if (host) params.set("host", host);

    return res.redirect(`/?${params.toString()}`);
  } catch (error) {
    console.error("[auth] OAuth callback failed:", error);
    return res
      .status(500)
      .send("Authentication failed. Please reinstall the app from your Shopify admin.");
  }
});

/**
 * Entry point for the embedded app. If the shop has no token yet, kick off
 * OAuth; otherwise serve the React frontend (handled downstream).
 */
export function buildEmbeddedRedirectUrl(shop, host) {
  const params = new URLSearchParams({ shop });
  if (host) params.set("host", host);
  return `${config.shopify.appUrl}/api/auth?${params.toString()}`;
}
