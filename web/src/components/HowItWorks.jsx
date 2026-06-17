import { Card, BlockStack, InlineStack, Text, Box } from "@shopify/polaris";

const STEPS = [
  {
    n: 1,
    title: "Scan your products",
    body: 'Click "Scan all products" to import your titles and descriptions from Shopify into Polished.',
  },
  {
    n: 2,
    title: "Translate & review",
    body: 'Select products and click "Translate selected". AI writes native Polish — open "Review / edit" to check or adjust it.',
  },
  {
    n: 3,
    title: "Publish to your store",
    body: "Approve a translation to publish it to Shopify. It shows to shoppers once Polish is enabled in your store languages.",
  },
];

function StepNumber({ n }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: "var(--p-color-bg-fill-brand, #303030)",
        color: "var(--p-color-text-brand-on-bg-fill, #fff)",
        fontWeight: 600,
        fontSize: 14,
        flexShrink: 0,
      }}
    >
      {n}
    </span>
  );
}

export default function HowItWorks() {
  return (
    <Card>
      <BlockStack gap="400">
        <BlockStack gap="100">
          <Text as="h2" variant="headingMd">
            How Polished works
          </Text>
          <Text as="p" tone="subdued" variant="bodyMd">
            Polished translates your product titles and descriptions into natural,
            native-quality Polish using AI. Nothing goes live until you review and
            approve it.
          </Text>
        </BlockStack>

        <InlineStack gap="500" align="start" wrap>
          {STEPS.map((step) => (
            <div key={step.n} style={{ flex: "1 1 220px", minWidth: 220, maxWidth: 360 }}>
              <BlockStack gap="200">
                <InlineStack gap="200" blockAlign="center">
                  <StepNumber n={step.n} />
                  <Text as="h3" variant="headingSm">
                    {step.title}
                  </Text>
                </InlineStack>
                <Box paddingInlineStart="800">
                  <Text as="p" tone="subdued" variant="bodySm">
                    {step.body}
                  </Text>
                </Box>
              </BlockStack>
            </div>
          ))}
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
