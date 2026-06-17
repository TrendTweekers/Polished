// Quality validation: runs the app's REAL translation service (same prompt the
// product uses) on realistic sample products, across tones, with a glossary and
// brand/SKU/URL protection. Run with the live env injected:
//   railway run --service Polished node scripts/validate-translation.mjs
import { translateProduct } from "../server/services/translator.js";

function hr(label) {
  console.log("\n" + "=".repeat(78));
  if (label) console.log(label);
  console.log("=".repeat(78));
}

function show({ heading, original, result }) {
  hr(heading);
  console.log("\n— ORIGINAL TITLE —\n" + original.title);
  console.log("\n— POLISH TITLE —\n" + result.translatedTitle);
  console.log("\n— ORIGINAL DESCRIPTION —\n" + original.description);
  console.log("\n— POLISH DESCRIPTION —\n" + result.translatedDescription);
  console.log(
    "\n— QUALITY FLAGS —\n" +
      (result.qualityFlags.length ? result.qualityFlags.join(", ") : "(none)")
  );
}

// A: branded product. Should preserve brand name, model, SKU, URL, HTML, and
// apply the glossary; only the human-readable description becomes natural Polish.
const branded = {
  title: "DR. MARTENS | 1460Z DMC 8-EYE BOOT | CHERRY SMOOTH",
  description:
    "<p>The original since 1960. The 1460 boot is built on the iconic air-cushioned sole, with durable Smooth leather and signature yellow welt stitching. SKU: DM1460-CH. Goodyear-welted construction means the sole can be resoled, not replaced. Shop more at <a href=\"https://example.com/boots\">our store</a>.</p>",
};
const brandedGlossary = [
  { originalTerm: "air-cushioned sole", polishTerm: "podeszwa z poduszką powietrzną", caseSensitive: false },
];

// B: DTC marketing copy. Same text translated formal vs casual to expose the
// register difference (Pan/Pani vs Ty) that generic MT gets wrong.
const serum = {
  title: "Everyday Hydrating Face Serum",
  description:
    "<p>Wake up your skin with our lightweight hydrating serum. Packed with hyaluronic acid and vitamin B5, it absorbs in seconds and leaves your face feeling fresh, plump, and ready for the day. Cruelty-free and made for all skin types.</p>",
};

async function main() {
  console.log("Validating Polished translation quality (model: " + (process.env.ANTHROPIC_MODEL || "claude-haiku-4-5") + ")");

  const a = await translateProduct({
    ...branded,
    tone: "neutral",
    glossary: brandedGlossary,
  });
  show({ heading: "A) BRANDED PRODUCT — neutral tone (brand/SKU/URL protection + glossary)", original: branded, result: a });

  const bFormal = await translateProduct({ ...serum, tone: "formal", glossary: [] });
  show({ heading: "B) DTC SERUM — FORMAL tone (Pan/Pani)", original: serum, result: bFormal });

  const bCasual = await translateProduct({ ...serum, tone: "casual", glossary: [] });
  show({ heading: "C) DTC SERUM — CASUAL tone (informal / forma Ty)", original: serum, result: bCasual });

  hr("DONE");
}

main().catch((e) => {
  console.error("Validation failed:", e.message);
  process.exit(1);
});
