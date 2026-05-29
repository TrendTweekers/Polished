import { useState } from "react";
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  TextField,
  Checkbox,
  Button,
  IndexTable,
  EmptyState,
} from "@shopify/polaris";
import { api } from "../lib/api.js";
import { showToast } from "../lib/toast.js";

export default function GlossaryManager({ terms, onReload }) {
  const [original, setOriginal] = useState("");
  const [polish, setPolish] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [busy, setBusy] = useState(false);

  async function addTerm() {
    if (!original.trim() || !polish.trim()) {
      showToast("Both the source term and Polish term are required.", { error: true });
      return;
    }
    setBusy(true);
    try {
      await api.addGlossary({
        originalTerm: original,
        polishTerm: polish,
        caseSensitive,
      });
      setOriginal("");
      setPolish("");
      setCaseSensitive(false);
      showToast("Glossary term added");
      onReload();
    } catch (error) {
      showToast(
        error.status === 409 ? "That source term already exists." : error.message,
        { error: true }
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeTerm(id) {
    try {
      await api.deleteGlossary(id);
      showToast("Term removed");
      onReload();
    } catch (error) {
      showToast(error.message, { error: true });
    }
  }

  const rows = (terms ?? []).map((term, index) => (
    <IndexTable.Row id={term.id} key={term.id} position={index}>
      <IndexTable.Cell>{term.originalTerm}</IndexTable.Cell>
      <IndexTable.Cell>{term.polishTerm}</IndexTable.Cell>
      <IndexTable.Cell>{term.caseSensitive ? "Yes" : "No"}</IndexTable.Cell>
      <IndexTable.Cell>
        <Button variant="plain" tone="critical" onClick={() => removeTerm(term.id)}>
          Delete
        </Button>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingMd">
          Glossary
        </Text>
        <Text as="p" tone="subdued" variant="bodyMd">
          Force specific terms to always translate a certain way (brand-specific
          wording, product categories, etc.). These are respected on every translation.
        </Text>

        <InlineStack gap="300" align="start" blockAlign="end" wrap>
          <div style={{ minWidth: 180 }}>
            <TextField
              label="Source term"
              value={original}
              onChange={setOriginal}
              autoComplete="off"
            />
          </div>
          <div style={{ minWidth: 180 }}>
            <TextField
              label="Polish term"
              value={polish}
              onChange={setPolish}
              autoComplete="off"
            />
          </div>
          <Checkbox
            label="Case sensitive"
            checked={caseSensitive}
            onChange={setCaseSensitive}
          />
          <Button variant="primary" onClick={addTerm} loading={busy}>
            Add term
          </Button>
        </InlineStack>

        {rows.length === 0 ? (
          <EmptyState heading="No glossary terms yet" image="">
            <p>Add a term above to lock in its Polish translation.</p>
          </EmptyState>
        ) : (
          <IndexTable
            itemCount={rows.length}
            selectable={false}
            headings={[
              { title: "Source term" },
              { title: "Polish term" },
              { title: "Case sensitive" },
              { title: "" },
            ]}
          >
            {rows}
          </IndexTable>
        )}
      </BlockStack>
    </Card>
  );
}
