import { useCallback, useEffect } from "react";
import {
  Card,
  IndexTable,
  useIndexResourceState,
  Badge,
  Button,
  Text,
  EmptyState,
  InlineStack,
} from "@shopify/polaris";
import { statusBadge } from "../lib/status.js";

function truncate(text, n = 70) {
  if (!text) return "—";
  return text.length > n ? `${text.slice(0, n)}…` : text;
}

export default function ProductTable({ products, onSelectionChange, onReview }) {
  const resourceName = { singular: "product", plural: "products" };

  // IndexTable expects resources with an `id` key.
  const resources = products.map((p) => ({ ...p, id: p.productId }));

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(resources);

  const onChange = useCallback(
    (selectionType, toggleType, selection, position) => {
      handleSelectionChange(selectionType, toggleType, selection, position);
    },
    [handleSelectionChange]
  );

  // Bubble selection up whenever it changes.
  useEffect(() => {
    onSelectionChange?.(selectedResources);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedResources.join(",")]);

  if (resources.length === 0) {
    return (
      <Card>
        <EmptyState
          heading="No products to show"
          action={undefined}
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>Run “Scan all products” to import your catalog, then translate it.</p>
        </EmptyState>
      </Card>
    );
  }

  const rows = resources.map((product, index) => {
    const badge = statusBadge(product.overallStatus);
    return (
      <IndexTable.Row
        id={product.id}
        key={product.id}
        position={index}
        selected={selectedResources.includes(product.id)}
      >
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd">
            {truncate(product.title?.original)}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodyMd" tone={product.title?.translated ? undefined : "subdued"}>
            {truncate(product.title?.translated)}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Button variant="plain" onClick={() => onReview(product)}>
            Review / edit
          </Button>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Card padding="0">
      <IndexTable
        resourceName={resourceName}
        itemCount={resources.length}
        selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
        onSelectionChange={onChange}
        headings={[
          { title: "Original title" },
          { title: "Polish title" },
          { title: "Status" },
          { title: "Actions" },
        ]}
      >
        {rows}
      </IndexTable>
    </Card>
  );
}
