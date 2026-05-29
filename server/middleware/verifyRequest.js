import { shopify } from "../shopify.js";
import { prisma } from "../db.js";
import { performTokenExchange } from "../auth.js";

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
    if (!store) {
      // No offline token yet — exchange the session token for one (auto-install).
      try {
        store = await performTokenExchange(shopDomain, sessionToken);
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
