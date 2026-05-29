import "@shopify/shopify-api/adapters/node";
import {
  shopifyApi,
  LATEST_API_VERSION,
  BillingInterval,
  Session,
} from "@shopify/shopify-api";
import { config } from "./config.js";
import { prisma } from "./db.js";

const hostName = config.shopify.appUrl.replace(/^https?:\/\//, "");

export const STARTER_PLAN = "Starter";

export const shopify = shopifyApi({
  apiKey: config.shopify.apiKey,
  apiSecretKey: config.shopify.apiSecret,
  scopes: config.shopify.scopes,
  hostName,
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
  billing: {
    [STARTER_PLAN]: {
      amount: 19,
      currencyCode: "USD",
      interval: BillingInterval.Every30Days,
      trialDays: 14,
    },
  },
});

export const API_VERSION = LATEST_API_VERSION;

/**
 * Persist an offline access token for a shop. Called after OAuth completes.
 */
export async function storeSession(session) {
  const scope = session.scope ?? config.shopify.scopes.join(",");
  const store = await prisma.store.upsert({
    where: { shopDomain: session.shop },
    update: { accessToken: session.accessToken, scope },
    create: {
      shopDomain: session.shop,
      accessToken: session.accessToken,
      scope,
    },
  });

  // Ensure a Settings row always exists for the store.
  await prisma.settings.upsert({
    where: { storeId: store.id },
    update: {},
    create: { storeId: store.id },
  });

  return store;
}

/**
 * Build an offline Session object from the stored access token so we can make
 * authenticated Admin API calls on behalf of a shop.
 */
export async function loadOfflineSession(shopDomain) {
  const store = await prisma.store.findUnique({
    where: { shopDomain },
  });
  if (!store) return null;

  return new Session({
    id: `offline_${shopDomain}`,
    shop: shopDomain,
    state: "",
    isOnline: false,
    accessToken: store.accessToken,
    scope: store.scope,
  });
}

/**
 * Create an Admin GraphQL client for a shop using its stored offline token.
 */
export async function graphqlClient(shopDomain) {
  const session = await loadOfflineSession(shopDomain);
  if (!session) {
    throw new Error(`No stored session for shop ${shopDomain}`);
  }
  return new shopify.clients.Graphql({ session });
}
