# Polished

**Make your Shopify store sound native in Polish before entering the market — not robotic, not generic.**

Polished is an embedded Shopify app that translates product titles and descriptions into natural, native-quality Polish using OpenAI, with a human review-and-approve step before anything is published via the Shopify Translations API.

Built for cross-border sellers (German, Swedish, UK, US, Dutch) entering Poland, and for Polish agencies localizing foreign clients' stores.

---

## Features

- **Shopify OAuth** (offline tokens) with embedded admin app + App Bridge session-token auth.
- **Scan products** from the Admin GraphQL API into a local catalog.
- **AI translation** (OpenAI, structured JSON) tuned for Polish e-commerce: correct grammar cases, configurable tone, glossary enforcement, and brand/SKU/URL protection.
- **Quality-check flags** surface robotic tone, wrong formality, and literal translations.
- **Manual review & versioning** — every translation starts as *pending*; you review, edit, and approve before publishing. Re-translating never silently overwrites manual edits.
- **Publish to Shopify** using the Translations API (locale `pl`).
- **Glossary manager** and **tone selector** (formal / neutral / casual).
- **Webhooks** — `app/uninstalled` (data cleanup), `products/create` & `products/update` (catalog sync + optional auto-translate), plus mandatory GDPR compliance webhooks.
- **Billing** — Shopify Billing API, 14-day free trial, $19/month Starter plan, toggleable via `BILLING_ENABLED`.

---

## Tech stack

Node.js 20 · Express · React + Vite · Shopify Polaris · App Bridge · Admin GraphQL API · Shopify Translations API · PostgreSQL · Prisma · OpenAI (`gpt-4o-mini`). Railway-ready.

---

## Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `SHOPIFY_API_KEY` | App API key (Partner Dashboard) |
| `SHOPIFY_API_SECRET` | App API secret |
| `SHOPIFY_SCOPES` | `read_products,write_products,read_translations,write_translations` |
| `SHOPIFY_APP_URL` | Public HTTPS URL of the app (no trailing slash) |
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_MODEL` | Optional, defaults to `gpt-4o-mini` |
| `BILLING_ENABLED` | `true` to enforce the subscription, `false` to disable |
| `NODE_ENV` | `development` or `production` |
| `PORT` | Optional locally (defaults 3000); injected by Railway |

---

## Local development

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up the database** (any local or hosted PostgreSQL):
   ```bash
   cp .env.example .env   # then edit values
   npm run prisma:migrate:dev   # creates tables
   ```

3. **Tunnel a public HTTPS URL** to port 3000 so Shopify can reach the embedded app. Use the Shopify CLI (`shopify app dev`) or a tunnel like `cloudflared` / `ngrok`. Set `SHOPIFY_APP_URL` to that URL.

4. **Run the app** (Express API + Vite frontend together):
   ```bash
   npm run dev
   ```
   - Express API: `http://localhost:3000`
   - Vite dev server: `http://localhost:5173` (proxies `/api` to Express)

   When running embedded, open the app from your Shopify admin so App Bridge can issue session tokens.

---

## Shopify Partner app configuration

In the [Partner Dashboard](https://partners.shopify.com):

1. **Create an app** (or use `shopify app config push` with `shopify.app.toml`).
2. **App URL**: `https://<your-app-url>`
3. **Allowed redirection URL**: `https://<your-app-url>/api/auth/callback`
4. **Embedded**: enabled.
5. **API scopes**: `read_products, write_products, read_translations, write_translations`.
6. **Webhooks** are registered automatically on install; the mandatory GDPR compliance webhooks point to `/api/webhooks`.
7. In the **target store**, add **Polish (pl)** as a language under *Settings → Languages → Add language* and publish it, so translations are visible to shoppers.

`shopify.app.toml` in the repo contains a ready-to-edit version of this config.

---

## Railway deployment

1. **Create a Railway project** and add a **PostgreSQL** plugin (provides `DATABASE_URL`).
2. **Add a service** from this GitHub repo.
3. **Set environment variables** (see table above). Set `SHOPIFY_APP_URL` to the Railway public domain and `NODE_ENV=production`.
4. Railway build/run uses the `package.json` scripts:
   - Install: `npm install`
   - Build: `npm run build` (runs `prisma generate` + `vite build`)
   - Start: `npm run start`
5. **Run migrations** against the production database (one-off):
   ```bash
   npm run prisma:migrate
   ```
   You can run this as a Railway deploy/release command.
6. Update the Partner Dashboard **App URL** and **redirect URL** to the Railway domain.

Health check: `GET /health` → `{ "ok": true }`.

---

## Project layout

```
server/                Express backend
  index.js             App bootstrap, CSP, routing, static serving
  config.js            Validated env config
  shopify.js           Shopify API client, sessions, billing plan
  auth.js              OAuth begin/callback
  webhooks.js          Webhook handlers (incl. GDPR) + registration
  billing.js           Billing check / request middleware
  middleware/          Session-token verification
  routes/api.js        Authenticated app API
  services/            openai (translation), products (scan), translations (publish)
prisma/schema.prisma   Database models
web/                   React + Vite + Polaris frontend
```

---

## Notes

- Translations are **never auto-published**. New products can be auto-*translated* (opt-in), but a human always approves before publishing.
- Brand names, SKUs, URLs, and product codes are preserved by the translation prompt.
- Set `BILLING_ENABLED=false` to run the full app without a subscription (useful for development and review).
