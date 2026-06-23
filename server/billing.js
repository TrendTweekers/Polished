import { graphqlClient } from "./shopify.js";
import { config } from "./config.js";

// Polished uses Shopify App Pricing (managed pricing): plans are defined in the
// Partner Dashboard and Shopify hosts the plan selection + charge screen
// (including trials and test charges on dev stores). The app only has to:
//   1. check whether the shop has an active subscription, and
//   2. send merchants without one to Shopify's hosted plan selection page.

const ACTIVE_SUBSCRIPTIONS_QUERY = `
  query {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
      }
    }
  }
`;

/** Shopify's hosted plan selection page for this app, or null if unconfigured. */
function planSelectionUrl(shopDomain) {
  if (!config.billing.appHandle) return null;
  const storeHandle = shopDomain.replace(/\.myshopify\.com$/, "");
  return `https://admin.shopify.com/store/${storeHandle}/charges/${config.billing.appHandle}/pricing_plans`;
}

/** True if the shop has at least one ACTIVE app subscription. */
async function hasActiveSubscription(shopDomain) {
  const client = await graphqlClient(shopDomain);
  const res = await client.request(ACTIVE_SUBSCRIPTIONS_QUERY);
  const subs = res?.data?.currentAppInstallation?.activeSubscriptions ?? [];
  return subs.some((s) => s.status === "ACTIVE");
}

/**
 * Returns the subscription status for a shop.
 * @returns {Promise<{active:boolean, planSelectionUrl:string|null}>}
 */
export async function getBillingStatus(shopDomain) {
  if (!config.billing.enabled) {
    return { active: true, planSelectionUrl: null };
  }

  const url = planSelectionUrl(shopDomain);
  // Fail open if the plan selection page isn't configured, so the app never
  // traps a merchant behind a broken upgrade link.
  if (!url) {
    console.error("[billing] SHOPIFY_APP_HANDLE is not set; skipping billing gate.");
    return { active: true, planSelectionUrl: null };
  }

  const active = await hasActiveSubscription(shopDomain);
  return { active, planSelectionUrl: active ? null : url };
}

/**
 * Express middleware: blocks an action until the shop has an active
 * subscription, responding 402 with the plan selection page the frontend opens.
 * No-op when BILLING_ENABLED=false or the app handle isn't configured.
 */
export async function requireBilling(req, res, next) {
  if (!config.billing.enabled) return next();

  const url = planSelectionUrl(req.shopDomain);
  if (!url) {
    console.error("[billing] SHOPIFY_APP_HANDLE is not set; allowing request.");
    return next();
  }

  try {
    if (await hasActiveSubscription(req.shopDomain)) return next();
  } catch (error) {
    // On a transient API error, fall through to prompting plan selection rather
    // than silently granting paid access.
    console.error("[billing] check failed:", error.message);
  }

  return res.status(402).json({
    error: "subscription_required",
    message: "Choose a Polished plan to continue.",
    planSelectionUrl: url,
  });
}
