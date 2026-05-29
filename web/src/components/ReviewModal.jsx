import { useEffect, useState } from "react";
import {
  Modal,
  BlockStack,
  InlineStack,
  Text,
  TextField,
  Badge,
  Banner,
  Box,
  Divider,
} from "@shopify/polaris";
import { api } from "../lib/api.js";
import { showToast } from "../lib/toast.js";
import { flagLabel } from "../lib/status.js";

function FieldEditor({ label, field, value, onChange, multiline }) {
  if (!field) return null;
  return (
    <BlockStack gap="200">
      <InlineStack align="space-between" blockAlign="center">
        <Text as="h3" variant="headingSm">
          {label}
        </Text>
        {field.manuallyEdited && <Badge tone="attention">Manually edited</Badge>}
      </InlineStack>

      <Box background="bg-surface-secondary" padding="300" borderRadius="200">
        <Text as="p" tone="subdued" variant="bodySm">
          Original
        </Text>
        <Text as="p" variant="bodyMd">
          {field.original || "—"}
        </Text>
      </Box>

      <TextField
        label="Polish translation"
        value={value}
        onChange={onChange}
        multiline={multiline ? 6 : false}
        autoComplete="off"
      />

      {field.qualityFlags?.length > 0 && (
        <InlineStack gap="200">
          {field.qualityFlags.map((f) => (
            <Badge key={f} tone="warning">
              {flagLabel(f)}
            </Badge>
          ))}
        </InlineStack>
      )}
    </BlockStack>
  );
}

export default function ReviewModal({ product, open, onClose, onSaved, settings }) {
  const showTitle = settings?.translateTitles !== false;
  const showDesc = settings?.translateDescriptions !== false;

  const [titleText, setTitleText] = useState("");
  const [descText, setDescText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTitleText(product?.title?.translated ?? "");
    setDescText(product?.description?.translated ?? "");
  }, [product]);

  if (!product) return null;

  async function saveEdits() {
    setBusy(true);
    try {
      if (product.title && titleText !== (product.title.translated ?? "")) {
        await api.editTranslation(product.title.id, titleText);
      }
      if (product.description && descText !== (product.description.translated ?? "")) {
        await api.editTranslation(product.description.id, descText);
      }
      showToast("Saved your edits");
      onSaved();
    } catch (error) {
      showToast(error.message, { error: true });
    } finally {
      setBusy(false);
    }
  }

  async function retranslate() {
    setBusy(true);
    try {
      // force=true overwrites manual edits — explicit user action.
      await api.translate([product.productId], true);
      showToast("Re-translated with AI");
      onSaved();
    } catch (error) {
      showToast(error.message, { error: true });
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    try {
      await saveEditsSilently();
      await api.publish(product.productId);
      showToast("Published to Shopify (Polish)");
      onSaved();
      onClose();
    } catch (error) {
      showToast(error.message, { error: true });
    } finally {
      setBusy(false);
    }
  }

  async function saveEditsSilently() {
    if (product.title && titleText !== (product.title.translated ?? "")) {
      await api.editTranslation(product.title.id, titleText);
    }
    if (product.description && descText !== (product.description.translated ?? "")) {
      await api.editTranslation(product.description.id, descText);
    }
  }

  const hasTranslation = Boolean((showTitle && titleText) || (showDesc && descText));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Review & edit Polish translation"
      primaryAction={{
        content: "Publish to Shopify",
        onAction: publish,
        loading: busy,
        disabled: !hasTranslation,
      }}
      secondaryActions={[
        { content: "Save edits", onAction: saveEdits, loading: busy },
        { content: "Re-translate with AI", onAction: retranslate, loading: busy },
        { content: "Close", onAction: onClose },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          {!hasTranslation && (
            <Banner tone="info">
              This product hasn’t been translated yet. Use “Re-translate with AI” to
              generate a Polish version, then review it here.
            </Banner>
          )}

          {showTitle && (
            <FieldEditor
              label="Title"
              field={product.title}
              value={titleText}
              onChange={setTitleText}
            />
          )}
          {showTitle && showDesc && <Divider />}
          {showDesc && (
            <FieldEditor
              label="Description"
              field={product.description}
              value={descText}
              onChange={setDescText}
              multiline
            />
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
