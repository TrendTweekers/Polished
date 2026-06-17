import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

const TONE_GUIDANCE = {
  formal:
    "Formal, professional tone. Address the customer politely with Pan/Pani or impersonal/plural forms — AVOID the bare singular imperative (e.g. prefer \"Obudź swoją skórę\" → \"Pozwól swojej skórze się obudzić\" style or impersonal phrasing). Safe e-commerce language suitable for any audience.",
  neutral:
    "Neutral, natural brand tone. Modern Polish e-commerce phrasing, neither stiff nor overly casual.",
  casual:
    "Casual, friendly tone using the informal singular 'Ty' (direct imperatives like \"Obudź\", \"Odkryj\" are good here). Warm and conversational, like a trendy direct-to-consumer brand.",
};

function buildSystemPrompt(tone, glossary) {
  const toneText = TONE_GUIDANCE[tone] ?? TONE_GUIDANCE.neutral;

  const glossaryText =
    glossary.length > 0
      ? glossary
          .map(
            (g) =>
              `- "${g.originalTerm}" => "${g.polishTerm}"${
                g.caseSensitive ? " (match case exactly)" : ""
              }`
          )
          .join("\n")
      : "(none provided)";

  return `You are an expert Polish e-commerce copywriter and translator. You translate Shopify product content from any source language into natural, native-sounding Polish for a Polish-speaking audience.

RULES:
1. Translate into natural, fluent Polish with correct grammar and correct usage of all 7 Polish grammatical cases (mianownik, dopełniacz, celownik, biernik, narzędnik, miejscownik, wołacz).
2. ${toneText}
3. NEVER translate brand names, SKUs, URLs, product codes, model numbers, or sizing codes. Leave them exactly as-is.
4. Do NOT translate word-for-word, and NEVER calque English compounds. Render idioms idiomatically (e.g. "cruelty-free" → "nietestowane na zwierzętach", never "okrucieństwo-wolne").
5. Ensure adjectives, participles, and numerals agree in GENDER, number, and case with their noun. Watch neuter nouns like "serum" (→ "nawilżające serum", not "nawilżający serum").
6. For titles, use normal Polish capitalization — capitalize only the first word and proper nouns. Do NOT use English-style Title Case.
7. Use standard Polish e-commerce phrasing and conventions that Polish shoppers expect.
8. Preserve any HTML markup in descriptions (tags, attributes) — translate only the human-readable text between tags.
9. Respect the glossary below EXACTLY. Whenever a source term appears, use the given Polish term:
${glossaryText}

QUALITY FLAGS — after translating, self-review and add any of these flags that genuinely apply:
- "robotic_tone": the result reads stiff, machine-like, or unnatural.
- "wrong_formality": the formality level does not match the requested tone.
- "literal_translation": parts are too literal / word-for-word.
- "untranslated_segments": some source text was left untranslated by mistake.
Only include flags that genuinely apply. If the translation is clean, return an empty array.

Always call the save_polish_translation tool with your result.`;
}

// Forced tool call guarantees structured JSON output (Claude has no native
// response_format; a forced tool_choice is the reliable equivalent).
const TRANSLATION_TOOL = {
  name: "save_polish_translation",
  description: "Save the Polish translation of the product's title and description.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      translatedTitle: { type: "string", description: "Polish translation of the title" },
      translatedDescription: {
        type: "string",
        description: "Polish translation of the description (preserve any HTML)",
      },
      qualityFlags: {
        type: "array",
        items: {
          type: "string",
          enum: [
            "robotic_tone",
            "wrong_formality",
            "literal_translation",
            "untranslated_segments",
          ],
        },
      },
    },
    required: ["translatedTitle", "translatedDescription", "qualityFlags"],
  },
};

/**
 * Translate a single product's title and description into Polish via Claude.
 *
 * @param {object} input
 * @param {string} input.title        Original product title
 * @param {string} input.description  Original product description (may be HTML)
 * @param {string} input.tone         formal | neutral | casual
 * @param {Array}  input.glossary     [{ originalTerm, polishTerm, caseSensitive }]
 * @returns {Promise<{translatedTitle:string, translatedDescription:string, qualityFlags:string[]}>}
 */
export async function translateProduct({ title, description, tone, glossary = [] }) {
  const userPayload = { title: title ?? "", description: description ?? "" };

  try {
    const response = await client.messages.create({
      model: config.anthropic.model,
      max_tokens: 8000,
      // Cache the system prompt: identical across a batch of products (same tone
      // + glossary), so repeated calls within the 5-min window read it at ~0.1x.
      // Engages once the prefix passes the model's cache minimum (large glossary).
      system: [
        {
          type: "text",
          text: buildSystemPrompt(tone, glossary),
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [TRANSLATION_TOOL],
      tool_choice: { type: "tool", name: "save_polish_translation" },
      messages: [
        {
          role: "user",
          content: `Translate this product into Polish. Source JSON:\n${JSON.stringify(
            userPayload
          )}`,
        },
      ],
    });

    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse) {
      throw new Error("Claude did not return a structured translation");
    }

    const parsed = toolUse.input ?? {};
    return {
      translatedTitle: parsed.translatedTitle ?? "",
      translatedDescription: parsed.translatedDescription ?? "",
      qualityFlags: Array.isArray(parsed.qualityFlags) ? parsed.qualityFlags : [],
    };
  } catch (error) {
    console.error("[translator] translation failed:", error.message);
    throw new Error(`Translation failed: ${error.message}`);
  }
}
