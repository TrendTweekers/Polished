// Verifies character counts for every listing field. node count.mjs
const F = [
  ["App name", 30, "Polished - Polish Translation"],
  ["App introduction", 100, "Translate products into natural, native Polish with AI, then review before anything goes live."],
  ["App details", 500, "Polished helps cross-border merchants enter the Polish market with product copy that reads like a native wrote it, not machine-translated. AI translates titles and descriptions into natural Polish with correct grammar, gender and tone. You review and approve every translation before it publishes to Shopify. Choose a formal, neutral or casual voice, lock brand terms with a glossary, and translate descriptions only if you resell branded products. Nothing goes live until you approve it."],
  ["Feature 1", 80, "Native-quality Polish that reads like a local wrote it"],
  ["Feature 2", 80, "You review and approve every translation before it goes live"],
  ["Feature 3", 80, "Control tone, lock brand terms, and translate only what you choose"],
  ["Subtitle", 62, "Make your store sound native in Polish, not robotic"],
  ["Search: polish translation", 20, "polish translation"],
  ["Search: translate to polish", 20, "translate to polish"],
  ["Search: polish localization", 20, "polish localization"],
  ["Search: localization", 20, "localization"],
  ["Search: product translation", 20, "product translation"],
  ["Title tag", 60, "Polished - Polish Product Translation for Shopify"],
  ["Meta description", 160, "Translate your Shopify product titles and descriptions into natural Polish with AI. Review before publishing. Tone control, glossary, 14-day free trial."],
  ["Plan display name", 18, "Unlimited"],
  ["Alt feature-media", 125, "Polished dashboard showing products translated from English to Polish with status badges."],
  ["Alt screenshot-1", 125, "Reviewing a product's English description beside its Polish translation before publishing."],
  ["Alt screenshot-2", 125, "Robotic machine translation compared with Polished's correct, native-quality Polish."],
  ["Alt screenshot-3", 125, "Tone of voice setting with formal and casual Polish examples side by side."],
  ["Alt screenshot-4", 125, "Glossary of locked brand terms and toggles to translate titles or descriptions."],
  ["Alt screenshot-5", 125, "Translation progress near complete with products published to Shopify in Polish."],
];
let bad = 0;
for (const [name, limit, text] of F) {
  const n = [...text].length;
  const ok = n <= limit;
  if (!ok) bad++;
  console.log(`${ok ? "OK " : "OVER"}  ${String(n).padStart(3)}/${limit}  ${name}`);
}
console.log(bad ? `\n${bad} field(s) OVER limit` : "\nAll fields within limits.");
