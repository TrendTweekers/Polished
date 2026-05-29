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

export const config = {
  nodeEnv: optional("NODE_ENV", "development"),
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

  openai: {
    apiKey: required("OPENAI_API_KEY"),
    model: optional("OPENAI_MODEL", "gpt-4o-mini"),
  },

  billing: {
    enabled: optional("BILLING_ENABLED", "false").toLowerCase() === "true",
  },
};

export const isProd = config.nodeEnv === "production";
