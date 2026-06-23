import "dotenv/config";

function required(name) {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    // Fail fast at boot so misconfiguration never reaches a merchant mid-flow.
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function optional(name, fallback = "") {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : fallback;
}

const NODE_ENV = optional("NODE_ENV", "development");

export const config = {
  nodeEnv: NODE_ENV,
  port: Number(optional("PORT", "3000")),

  shopify: {
    apiKey: required("SHOPIFY_API_KEY"),
    apiSecret: required("SHOPIFY_API_SECRET"),
    scopes: required("SHOPIFY_SCOPES")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    appUrl: required("SHOPIFY_APP_URL").replace(/\/$/, ""),
  },

  anthropic: {
    apiKey: required("ANTHROPIC_API_KEY"),
    // Sonnet 4.6 is the default for native-quality Polish. Override to
    // claude-haiku-4-5 to cut cost on very large catalogs.
    model: optional("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
  },

  billing: {
    // Paid app: enforce subscription in production by default. Set
    // BILLING_ENABLED=false to bypass while developing locally.
    enabled:
      optional("BILLING_ENABLED", NODE_ENV === "production" ? "true" : "false").toLowerCase() ===
      "true",
    // App handle from the Partner Dashboard, used to build the Shopify App
    // Pricing plan selection page URL. Required when billing is enabled.
    appHandle: optional("SHOPIFY_APP_HANDLE", ""),
  },
};

export const isProd = config.nodeEnv === "production";
