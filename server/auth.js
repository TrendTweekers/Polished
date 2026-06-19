import { RequestedTokenType } from "@shopify/shopify-api";
import { shopify, storeSession } from "./shopify.js";

/**
 * Modern embedded-app auth: exchange an App Bridge session token for an offline
 * access token (no cookies, no redirect). Under managed installation Shopify
 * grants the configured scopes on install, so this is the only auth path — there
 * is no legacy cookie OAuth flow (which fails inside the admin iframe).
 */
export async function performTokenExchange(shop, sessionToken) {
  const { session } = await shopify.auth.tokenExchange({
    shop,
    sessionToken,
    requestedTokenType: RequestedTokenType.OfflineAccessToken,
  });

  // Webhooks (app/uninstalled, products/*, GDPR) are declared in shopify.app.toml
  // and auto-subscribed by Shopify on install — no runtime registration needed.
  return storeSession(session);
}
