// Thin API client. Every request carries a fresh App Bridge session token so
// the Express backend can verify the shop on each call.

async function getToken() {
  // `shopify` is the global injected by app-bridge.js (CDN) using the
  // <meta name="shopify-api-key"> tag.
  if (typeof window !== "undefined" && window.shopify?.idToken) {
    return window.shopify.idToken();
  }
  return null;
}

async function request(method, path, body) {
  const token = await getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!res.ok) {
    const error = new Error(data?.message || data?.error || `Request failed (${res.status})`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const api = {
  me: () => request("GET", "/me"),
  getProducts: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request("GET", `/products${qs ? `?${qs}` : ""}`);
  },
  scan: () => request("POST", "/products/scan"),
  translate: (productIds, force = false) =>
    request("POST", "/translate", { productIds, force }),
  publish: (productId) => request("POST", `/products/${productId}/publish`),
  editTranslation: (id, translatedText) =>
    request("PUT", `/translations/${id}`, { translatedText }),
  getSettings: () => request("GET", "/settings"),
  saveSettings: (settings) => request("PUT", "/settings", settings),
  getGlossary: () => request("GET", "/glossary"),
  addGlossary: (term) => request("POST", "/glossary", term),
  updateGlossary: (id, term) => request("PUT", `/glossary/${id}`, term),
  deleteGlossary: (id) => request("DELETE", `/glossary/${id}`),
  latestJob: () => request("GET", "/jobs/latest"),
  billing: () => request("GET", "/billing"),
};
