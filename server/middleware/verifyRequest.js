import { shopify } from "../shopify.js";
import { prisma } from "../db.js";

/**
 * Verify the App Bridge session token (JWT) sent as a Bearer token on every
 * embedded API request, then attach { shopDomain, store } to the request.
 *
 * App Bridge automatically refreshes and retries on a 401, so an expired or
 * missing token simply returns 401 here.
 */
export async function verifyRequest(req, res, next) {
  try {
    const authHeader = req.get("authorization") || "";
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) {
      return res.status(401).json({ error: "missing_session_token" });
    }

    const payload = await shopify.session.decodeSessionToken(match[1]);
    // `dest` is the shop's URL, e.g. https://example.myshopify.com
    const shopDomain = new URL(payload.dest).host;

    const store = await prisma.store.findUnique({ where: { shopDomain } });
    if (!store) {
      // Token is valid but we have no offline token — needs (re)install.
      return res.status(401).json({ error: "app_not_installed" });
    }

    req.shopDomain = shopDomain;
    req.store = store;
    next();
  } catch (error) {
    console.error("[auth] session token verification failed:", error.message);
    return res.status(401).json({ error: "invalid_session_token" });
  }
}
