# Polished — Competitive Analysis (June 2026)

## 1. App status

**Live and working end-to-end** at https://polished-production-5325.up.railway.app (Railway, Postgres wired, migrations applied). Embedded auth via **token exchange** (no cookies), product scopes deployed (`polished-3`), config-managed webhooks. A real scan pulled **91 products** from the test store. MVP is feature-complete: scan → AI translate (tone + glossary + quality flags) → human review/edit → publish via Shopify Translations API → per-field toggles (titles vs descriptions).

Remaining before App Store submission: publish **pl** locale in the store, run real translations to validate quality, enable billing (`BILLING_ENABLED=false` today), and build the store listing (screenshots/pricing).

---

## 2. The market (2025–2026)

Mature category, ~10 serious apps, ratings cluster **4.4–4.9★**. Engines have **converged on LLMs** (GPT-4 / Claude / Gemini / DeepL) — "machine translation" is now table stakes.

| App | Rating | Reviews | Entry price | Engine | Notable |
|---|---|---|---|---|---|
| **Translate & Adapt** (Shopify 1st-party) | 4.5 | ~1,423 | Free | Google MT | The free floor: 2 langs, raw MT, no glossary/automation |
| **Transcy** | 4.4 | ~2,463 | Free→$14.90+ | OpenAI/DeepL/Gemini | Biggest installs; recent **surprise-billing** backlash |
| **Weglot** | 4.5 | ~813 | €15→€699 | AI + trainable model | Strong SEO; **per-word + per-language** cost cliff |
| **Langify** | 4.6 | ~747 | $17.50 flat | Manual + word packs | Manual control; weak auto-translate |
| **LangShop** | 4.6 | ~700 | Free→$75 | GPT-4/DeepL/Google | 247 langs, glossary, checkout |
| **T Lab** | 4.9 | ~879 | Free→$59.99 | DeepL/Google/ChatGPT | Top-rated; BYO-key unlimited; built in Poland |
| **GTranslate** | 4.7 | ~661 | Free→$9.99 | Google neural (proxy) | Proxy reaches 3rd-party content others can't |
| **Hextom Translate** | 4.7 | ~1,173 | Free→$49.99 | GPT/Claude/Gemini | Multi-LLM + currency |
| **ETranslate/Langwill** | 4.7 | ~1,161 | Free→$49.99 | GPT-4/DeepL | Word-capped tiers |
| **ConveyThis** | ~3.7 | ~90 | Free→metered | MT + post-edit | Lowest rated; word-volume pricing |

**Two pricing camps:** flat/tiered monthly vs **metered per-word/token** — the metered group (Weglot, Transcy, ConveyThis) draws nearly all the "unexpected cost / upgrade cliff" complaints. The #1 reputational risk in the category is **billing transparency, not translation quality**.

---

## 3. The Polish-specific gap (our wedge)

- **Generic MT is structurally wrong for Polish.** 7 grammatical cases × 3 genders = 14+ forms per noun, plus free word order and formality (Pan/Pani vs Ty). Localization experts call human post-editing "not optional — essential." MT output reads "robotic or contextually off," drops diacritics, and (in one eval) got female gender right only **1.5%** of the time.
- **Register is a brand-risk landmine.** Wrong formal/informal "you" reads as disrespectful; no generic engine keeps a store-wide consistent tone, but Polish buyers notice instantly.
- **The market is big and language-gated.** Poland = CEE's largest e-commerce market (38M shoppers, ~25% CAGR), and **~75% of Poles buy from Polish-language stores**. Robotic copy directly suppresses cross-border conversion.
- **No Polish-specialized Shopify app exists.** The quality gap is filled by slow, expensive human agencies (PolishLocalisation, Expandeco). Open niche between raw MT and agencies. (Notably, T Lab is Polish-built but still a generic multi-language tool.)

---

## 4. Feature gaps across ALL competitors

| Capability | Market reality | Polished |
|---|---|---|
| **Tone/formality as a first-class setting** | Only Weglot approximates it — gated to expensive tiers. Everyone else relies on glossary "never-translate" rules. | ✅ formal/neutral/casual, core feature |
| **Mandatory review-before-publish** | **Nobody.** All auto-publish; human QA is an outsourced paid add-on. No staging/approve gate. | ✅ pending → review → publish, built in |
| **Quality flags (robotic/literal/formality/untranslated)** | **Nobody** surfaces confidence/quality scoring. | ✅ unique |
| **Per-field control (titles vs descriptions)** | Broadly missing. | ✅ just shipped |
| **Brand/SKU/URL protection** | Glossary "never-translate" only. | ✅ prompt-enforced |
| **Predictable flat price** | Metered token/word gouging is the top complaint. | ✅ flat $19/mo |
| **Polish-native quality focus** | None — all generic breadth. | ✅ the whole point |

---

## 5. How Polished competes — what we do well

**Positioning that no incumbent occupies:** *the only Polish-native-quality, review-first Shopify translation app.* We trade breadth for depth and trust:

1. **Depth over breadth.** Every competitor sells 100+ languages of generic MT. We sell *one language done natively* — case-correct grammar, consistent register, e-commerce phrasing. That's exactly where MT fails Polish and where conversion is lost.
2. **Trust by design.** Mandatory human review + quality flags + "re-translate never silently overwrites manual edits." The category's biggest reputational wound (auto-published junk, surprise bills) is our default-safe behavior.
3. **Tone as a core control, not a $300 tier.** Formal/neutral/casual at $19 flat vs Weglot gating brand-voice behind premium plans.
4. **Per-field economics.** Translate descriptions, skip brand-name titles — saves cost and avoids mistranslating "Nike." No competitor offers this cleanly.
5. **Predictable pricing.** Flat monthly directly attacks the #1 complaint about Transcy/Weglot.

---

## 6. Honest weaknesses & risks

- **Small TAM.** One language = a fraction of a multi-language app's market. It's a sharp wedge, not a broad platform. Mitigation: same engine extends to other hard-for-MT Slavic langs (Czech, Ukrainian) later.
- **Narrower feature surface.** No currency conversion, image/ALT translation, third-party-app or checkout-extension coverage, or proxy fallback (GTranslate's edge). All intentionally out of MVP scope.
- **Margin risk on flat pricing.** We pay the OpenAI bill; a huge catalog on $19 flat could erode margin. Consider soft per-product caps or a higher tier before scaling marketing.
- **Translations API only** — can't translate content outside Shopify's locale system (third-party app strings).
- **Brand protection is prompt-based**, not deterministic — needs validation on real catalogs.
- **No reviews/track record yet** — new app vs incumbents with 700–2,400 reviews.

---

## 7. Recommendations

1. **Lead the listing with "native Polish, not robotic"** + the review-first + quality-flags story. Show a side-by-side: generic MT vs Polished on a real product (wrong case/formality vs correct).
2. **Make quality flags and tone the demo hero** — they're literally unique in the category.
3. **Keep flat pricing**, but model OpenAI cost per 1k products and add a guardrail tier before paid marketing.
4. **Plan the Slavic expansion** narrative for investors/roadmap without diluting the Polish-first MVP.
5. **Target the documented buyer:** cross-border DE/UK/US/SE/NL sellers entering Poland + PL agencies — i.e. merchants with *original product copy*, not branded resellers.

### Sources
Shopify App Store listings (Translate & Adapt, Transcy, Weglot, Hextom, ConveyThis, T Lab, LangShop); Aploq (Polish MT challenges); Circle Translations; Localazy; Technavio / ecommercebridge / Statista (Poland market); Weglot pricing; HeyCarson, Hextom, Digismoothie aggregators.
