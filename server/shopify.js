import "@shopify/shopify-api/adapters/node";
import { shopifyApi, LATEST_API_VERSION, Session } from "@shopify/shopify-api";
import { config } from "./config.js";
import { prisma } from "./db.js";

const hostName = config.shopify.appUrl.replace(/^https?:\/\//, "");

// Billing is handled by Shopify App Pricing (managed pricing) — plans live in
// the Partner Dashboard and Shopify hosts the charge screen, so no Billing API
// plan config is declared here. See server/billing.js.
export const shopify = shopifyApi({
  apiKey: config.shopify.apiKey,
  apiSecretKey: config.shopify.apiSecret,
  scopes: config.shopify.scopes,
  hostName,
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
});

export const API_VERSION = LATEST_API_VERSION;

// Public apps must use EXPIRING offline tokens. The installed @shopify/shopify-api
// only mints non-expiring (deprecated) tokens, so we call the token endpoint
// directly with expiring=1 and refresh via the refresh token. Access tokens live
// ~60 min; refresh tokens ~90 days.
const ACCESS_TOKEN_BUFFER_MS = 90_000; // treat as expired 90s early

function tokenUrl(shopDomain) {
  return `https://${shopDomain}/admin/oauth/access_token`;
}

async function postToken(shopDomain, params) {
  const res = await fetch(tokenUrl(shopDomain), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      client_id: config.shopify.apiKey,
      client_secret: config.shopify.apiSecret,
      ...params,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Token endpoint ${res.status}: ${text.slice(0, 200)}`);
  }
  return JSON.parse(text);
}

/** Persist token fields (handles both expiring and non-expiring responses). */
async function persistTokens(shopDomain, data) {
  const now = Date.now();
  const store = await prisma.store.upsert({
    where: { shopDomain },
    update: {
      accessToken: data.access_token,
      scope: data.scope ?? config.shopify.scopes.join(","),
      accessTokenExpiresAt: data.expires_in ? new Date(now + data.expires_in * 1000) : null,
      refreshToken: data.refresh_token ?? null,
      refreshTokenExpiresAt: data.refresh_token_expires_in
        ? new Date(now + data.refresh_token_expires_in * 1000)
        : null,
    },
    create: {
      shopDomain,
      accessToken: data.access_token,
      scope: data.scope ?? config.shopify.scopes.join(","),
      accessTokenExpiresAt: data.expires_in ? new Date(now + data.expires_in * 1000) : null,
      refreshToken: data.refresh_token ?? null,
      refreshTokenExpiresAt: data.refresh_token_expires_in
        ? new Date(now + data.refresh_token_expires_in * 1000)
        : null,
    },
  });
  await prisma.settings.upsert({
    where: { storeId: store.id },
    update: {},
    create: { storeId: store.id },
  });
  return store;
}

/** Exchange an App Bridge session token for an EXPIRING offline access token. */
export async function exchangeOfflineToken(shopDomain, sessionToken) {
  const data = await postToken(shopDomain, {
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
    subject_token: sessionToken,
    subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
    requested_token_type: "urn:shopify:params:oauth:token-type:offline-access-token",
    expiring: "1",
  });
  return persistTokens(shopDomain, data);
}

/** Refresh an expiring offline token without merchant interaction. */
export async function refreshOfflineToken(store) {
  const data = await postToken(store.shopDomain, {
    grant_type: "refresh_token",
    refresh_token: store.refreshToken,
  });
  return persistTokens(store.shopDomain, data);
}

export function isAccessTokenExpired(store, bufferMs = ACCESS_TOKEN_BUFFER_MS) {
  if (!store?.accessTokenExpiresAt) return false; // legacy non-expiring token
  return store.accessTokenExpiresAt.getTime() - bufferMs <= Date.now();
}

function refreshTokenUsable(store) {
  return (
    store?.refreshToken &&
    (!store.refreshTokenExpiresAt || store.refreshTokenExpiresAt.getTime() > Date.now())
  );
}

/**
 * Build an offline Session for Admin API calls, refreshing an expired token via
 * the refresh token first. Used by user-facing and background (webhook) calls.
 */
export async function loadOfflineSession(shopDomain) {
  let store = await prisma.store.findUnique({ where: { shopDomain } });
  if (!store) return null;

  if (isAccessTokenExpired(store) && refreshTokenUsable(store)) {
    try {
      store = await refreshOfflineToken(store);
    } catch (error) {
      console.error(`[token] refresh failed for ${shopDomain}:`, error.message);
    }
  }

  return new Session({
    id: `offline_${shopDomain}`,
    shop: shopDomain,
    state: "",
    isOnline: false,
    accessToken: store.accessToken,
    scope: store.scope,
  });
}

/** Create an Admin GraphQL client for a shop using its (fresh) offline token. */
export async function graphqlClient(shopDomain) {
  const session = await loadOfflineSession(shopDomain);
  if (!session) {
    throw new Error(`No stored session for shop ${shopDomain}`);
  }
  return new shopify.clients.Graphql({ session });
}
