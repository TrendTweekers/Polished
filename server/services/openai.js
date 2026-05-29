import OpenAI from "openai";
import { config } from "../config.js";

const client = new OpenAI({ apiKey: config.openai.apiKey });

const TONE_GUIDANCE = {
  formal:
    "Formal tone (Pan/Pani, forma grzecznościowa). Safe, professional e-commerce language suitable for any audience.",
  neutral:
    "Neutral, natural brand tone. Modern Polish e-commerce phrasing, neither stiff nor overly casual.",
  casual:
    "Casual, friendly tone (forma 'Ty'). Warm and conversational, like a trendy direct-to-consumer brand.",
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
4. Do NOT translate word-for-word. Rewrite so it reads like it was originally written by a Polish native speaker.
5. Use standard Polish e-commerce phrasing and conventions that Polish shoppers expect.
6. Preserve any HTML markup in descriptions (tags, attributes) — translate only the human-readable text between tags.
7. Respect the glossary below EXACTLY. Whenever a source term appears, use the given Polish term:
${glossaryText}

QUALITY FLAGS — after translating, self-review and add any of these flags that apply to "qualityFlags":
- "robotic_tone": the result reads stiff, machine-like, or unnatural.
- "wrong_formality": the formality level does not match the requested tone.
- "literal_translation": parts are too literal / word-for-word.
- "untranslated_segments": some source text was left untranslated by mistake.
Only include flags that genuinely apply. If the translation is clean, return an empty array.

Return ONLY the structured JSON object requested.`;
}

const RESPONSE_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "polish_translation",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        translatedTitle: { type: "string" },
        translatedDescription: { type: "string" },
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
  },
};

/**
 * Translate a single product's title and description into Polish.
 *
 * @param {object} input
 * @param {string} input.title        Original product title
 * @param {string} input.description  Original product description (may be HTML)
 * @param {string} input.tone         formal | neutral | casual
 * @param {Array}  input.glossary     [{ originalTerm, polishTerm, caseSensitive }]
 * @returns {Promise<{translatedTitle:string, translatedDescription:string, qualityFlags:string[]}>}
 */
export async function translateProduct({ title, description, tone, glossary = [] }) {
  const userPayload = {
    title: title ?? "",
    description: description ?? "",
  };

  try {
    const completion = await client.chat.completions.create({
      model: config.openai.model,
      temperature: 0.3,
      messages: [
        { role: "system", content: buildSystemPrompt(tone, glossary) },
        {
          role: "user",
          content: `Translate this product into Polish. Source JSON:\n${JSON.stringify(
            userPayload
          )}`,
        },
      ],
      response_format: RESPONSE_SCHEMA,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      throw new Error("OpenAI returned an empty response");
    }

    const parsed = JSON.parse(raw);
    return {
      translatedTitle: parsed.translatedTitle ?? "",
      translatedDescription: parsed.translatedDescription ?? "",
      qualityFlags: Array.isArray(parsed.qualityFlags) ? parsed.qualityFlags : [],
    };
  } catch (error) {
    console.error("[openai] translation failed:", error.message);
    throw new Error(`Translation failed: ${error.message}`);
  }
}
