import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Inject the Shopify API key into index.html (replacing __SHOPIFY_API_KEY__)
// so App Bridge can read it from the meta tag in both dev and prod.
function injectApiKey(apiKey) {
  return {
    name: "inject-shopify-api-key",
    transformIndexHtml(html) {
      return html.replace(/__SHOPIFY_API_KEY__/g, apiKey ?? "");
    },
  };
}

export default defineConfig(({ mode }) => {
  // Load all env vars (no prefix filter) from the project root.
  const env = loadEnv(mode, path.resolve(__dirname), "");
  const apiKey = env.SHOPIFY_API_KEY || "";

  return {
    root: "web",
    plugins: [react(), injectApiKey(apiKey)],
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
    server: {
      port: 5173,
      proxy: {
        // Proxy API + auth + webhooks to the Express server during dev.
        "/api": "http://localhost:3000",
        "/health": "http://localhost:3000",
      },
    },
  };
});
