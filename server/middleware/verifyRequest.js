import { shopify, exchangeOfflineToken, isAccessTokenExpired } from "../shopify.js";
import { prisma } from "../db.js";
import { config } from "../config.js";

/** True if the stored grant covers every scope the app currently requires. */
function hasRequiredScopes(store) {
  if (!store?.scope) return false;
  const granted = new Set(store.scope.split(",").map((s) => s.trim()));
  return config.shopify.scopes.every((s) => granted.has(s));
}

/**
 * Verify the App Bridge session token (JWT) sent as a Bearer token on every
 * embedded API request, then attach { shopDomain, store } to the request.
 *
 * If we don't yet have an offline access token for the shop, we transparently
 * obtain one via token exchange — this is how install/auth completes for an
 * embedded app without cookies. App Bridge refreshes and retries on a 401.
 */
export async function verifyRequest(req, res, next) {
  try {
    const authHeader = req.get("authorization") || "";
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) {
      return res.status(401).json({ error: "missing_session_token" });
    }

    const sessionToken = match[1];
    const payload = await shopify.session.decodeSessionToken(sessionToken);
    // `dest` is the shop's URL, e.g. https://example.myshopify.com
    const shopDomain = new URL(payload.dest).host;

    let store = await prisma.store.findUnique({ where: { shopDomain } });
    const legacyNonExpiringToken = store && !store.accessTokenExpiresAt;
    if (
      !store ||
      !hasRequiredScopes(store) ||
      legacyNonExpiringToken ||
      isAccessTokenExpired(store)
    ) {
      // No token, stale scopes, a deprecated non-expiring token (migrate it), or
      // an expired token — exchange the live session token for a fresh expiring
      // offline token. We always have the session token here, so this is the most
      // reliable refresh path for user flows.
      try {
        store = await exchangeOfflineToken(shopDomain, sessionToken);
      } catch (exchangeError) {
        console.error(
          `[auth] token exchange failed for ${shopDomain}:`,
          exchangeError.message
        );
        return res.status(401).json({ error: "install_required" });
      }
    }

    req.shopDomain = shopDomain;
    req.store = store;
    next();
  } catch (error) {
    console.error("[auth] session token verification failed:", error.message);
    return res.status(401).json({ error: "invalid_session_token" });
  }
}
