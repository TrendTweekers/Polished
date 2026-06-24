import { Card, BlockStack, InlineStack, Text, ProgressBar, Badge } from "@shopify/polaris";

export default function ProgressCard({ counts }) {
  const { total = 0, translated = 0, approved = 0, published = 0 } = counts ?? {};
  const pct = total > 0 ? Math.round((translated / total) * 100) : 0;

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingMd">
            Translation progress
          </Text>
          <InlineStack gap="200">
            <Badge tone="info">{`${translated} translated`}</Badge>
            <Badge tone="attention">{`${approved} approved`}</Badge>
            <Badge tone="success">{`${published} published`}</Badge>
          </InlineStack>
        </InlineStack>

        <Text as="p" variant="bodyMd" tone="subdued">
          {total === 0
            ? "No products scanned yet. Run “Scan all products” to get started."
            : `${translated} of ${total} products translated into Polish.`}
        </Text>

        <ProgressBar progress={pct} size="small" tone="primary" />
      </BlockStack>
    </Card>
  );
}
