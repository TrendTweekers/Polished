import { useState } from "react";
import { Card, BlockStack, Text, Select, Checkbox, Divider } from "@shopify/polaris";
import { api } from "../lib/api.js";
import { showToast } from "../lib/toast.js";

const TONE_OPTIONS = [
  { label: "Formal — safe e-commerce (Pan/Pani)", value: "formal" },
  { label: "Neutral — natural brand voice", value: "neutral" },
  { label: "Casual — friendly (forma „Ty”)", value: "casual" },
];

export default function SettingsCard({ settings, onChange }) {
  const [saving, setSaving] = useState(false);

  async function save(patch) {
    setSaving(true);
    try {
      const res = await api.saveSettings(patch);
      onChange(res.settings);
      showToast("Settings saved");
    } catch (error) {
      showToast(error.message, { error: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingMd">
          Translation settings
        </Text>

        <Select
          label="Tone of voice"
          options={TONE_OPTIONS}
          value={settings?.tone ?? "neutral"}
          disabled={saving}
          onChange={(value) => save({ tone: value })}
          helpText="Controls formality and phrasing of the Polish output."
        />

        <Checkbox
          label="Auto-translate newly created products"
          checked={Boolean(settings?.autoTranslateNewProducts)}
          disabled={saving}
          onChange={(checked) => save({ autoTranslateNewProducts: checked })}
          helpText="When a new product is added in Shopify, translate it automatically (still requires review before publishing)."
        />

        <Divider />

        <BlockStack gap="200">
          <Text as="h3" variant="headingSm">
            Fields to translate
          </Text>
          <Text as="p" tone="subdued" variant="bodySm">
            Reselling branded products (Nike, Adidas…)? Titles are mostly brand and
            model names — translate descriptions only and leave titles untouched.
          </Text>

          <Checkbox
            label="Translate product titles"
            checked={settings?.translateTitles !== false}
            disabled={saving}
            onChange={(checked) => save({ translateTitles: checked })}
          />
          <Checkbox
            label="Translate product descriptions"
            checked={settings?.translateDescriptions !== false}
            disabled={saving}
            onChange={(checked) => save({ translateDescriptions: checked })}
          />
        </BlockStack>
      </BlockStack>
    </Card>
  );
}
