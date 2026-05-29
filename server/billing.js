import { shopify, STARTER_PLAN, loadOfflineSession } from "./shopify.js";
import { config, isProd } from "./config.js";

// On non-production (and development stores) we always use Shopify's test
// billing so no real money moves while building or reviewing.
const isTestBilling = !isProd;

/**
 * Returns the active subscription status for a shop.
 * @returns {Promise<{active:boolean, confirmationUrl:string|null}>}
 */
export async function getBillingStatus(shopDomain) {
  if (!config.billing.enabled) {
    return { active: true, confirmationUrl: null };
  }

  const session = await loadOfflineSession(shopDomain);
  if (!session) {
    return { active: false, confirmationUrl: null };
  }

  const hasPayment = await shopify.billing.check({
    session,
    plans: [STARTER_PLAN],
    isTest: isTestBilling,
  });

  if (hasPayment) {
    return { active: true, confirmationUrl: null };
  }

  const confirmationUrl = await shopify.billing.request({
    session,
    plan: STARTER_PLAN,
    isTest: isTestBilling,
    returnUrl: `${config.shopify.appUrl}/?shop=${shopDomain}`,
  });

  return { active: false, confirmationUrl };
}

/**
 * Express middleware: blocks API access until the shop has an active
 * subscription. Responds 402 with a confirmationUrl the frontend opens.
 * No-op when BILLING_ENABLED=false.
 */
export async function requireBilling(req, res, next) {
  if (!config.billing.enabled) return next();

  try {
    const { active, confirmationUrl } = await getBillingStatus(req.shopDomain);
    if (active) return next();

    return res.status(402).json({
      error: "subscription_required",
      message: "An active Polished subscription is required.",
      confirmationUrl,
    });
  } catch (error) {
    console.error("[billing] check failed:", error.message);
    return res.status(500).json({ error: "billing_check_failed" });
  }
}
