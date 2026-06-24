import { useEffect, useState } from "react";
import {
  Modal,
  BlockStack,
  InlineStack,
  InlineGrid,
  Text,
  TextField,
  Badge,
  Banner,
  Box,
  Divider,
  ProgressBar,
} from "@shopify/polaris";
import { api } from "../lib/api.js";
import { showToast } from "../lib/toast.js";
import { flagLabel, qualityMeta, statusBadge } from "../lib/status.js";

// One translatable field rendered as English (source) beside Polish (translation).
function FieldRow({ title, field, value, onChange, editable, multiline }) {
  if (!field) return null;
  return (
    <BlockStack gap="200">
      <InlineStack align="space-between" blockAlign="center">
        <Text as="h3" variant="headingSm">
          {title}
        </Text>
        {field.manuallyEdited && <Badge tone="attention">Manually edited</Badge>}
      </InlineStack>

      <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
        {/* English — source */}
        <BlockStack gap="100">
          <Text as="p" variant="bodySm" tone="subdued">
            🇬🇧 English
          </Text>
          <Box background="bg-surface-secondary" padding="300" borderRadius="200">
            <Text as="p" variant="bodyMd">
              {field.original || "—"}
            </Text>
          </Box>
        </BlockStack>

        {/* Polish — translation */}
        <BlockStack gap="100">
          <Text as="p" variant="bodySm" tone="subdued">
            🇵🇱 Polish
          </Text>
          {editable ? (
            <TextField
              label="Polish translation"
              labelHidden
              value={value}
              onChange={onChange}
              multiline={multiline ? 6 : false}
              autoComplete="off"
              helpText={`${value.length} characters`}
            />
          ) : (
            <Box
              background="bg-surface"
              padding="300"
              borderRadius="200"
              borderWidth="025"
              borderColor="border"
            >
              <Text as="p" variant="bodyMd">
                {value || "—"}
              </Text>
            </Box>
          )}
          {field.qualityFlags?.length > 0 && (
            <InlineStack gap="100">
              {field.qualityFlags.map((f) => (
                <Badge key={f} tone="warning">
                  {flagLabel(f)}
                </Badge>
              ))}
            </InlineStack>
          )}
        </BlockStack>
      </InlineGrid>
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

  const status = product.overallStatus;
  const isPublished = status === "published";
  const isApproved = status === "approved";
  // Editing is only allowed before sign-off. Approve/Publish lock the fields;
  // "Request changes" re-opens them.
  const editable = !isApproved && !isPublished;

  const hasTranslation = Boolean((showTitle && titleText) || (showDesc && descText));

  const totalFlags =
    (showTitle ? product.title?.qualityFlags?.length ?? 0 : 0) +
    (showDesc ? product.description?.qualityFlags?.length ?? 0 : 0);
  const quality = qualityMeta(totalFlags);
  const badge = statusBadge(status);

  async function saveEditsSilently() {
    if (product.title && titleText !== (product.title.translated ?? "")) {
      await api.editTranslation(product.title.id, titleText);
    }
    if (product.description && descText !== (product.description.translated ?? "")) {
      await api.editTranslation(product.description.id, descText);
    }
  }

  function run(action, successMessage, { close = false } = {}) {
    return async () => {
      setBusy(true);
      try {
        await action();
        if (successMessage) showToast(successMessage);
        onSaved();
        if (close) onClose();
      } catch (error) {
        showToast(error.message, { error: true });
      } finally {
        setBusy(false);
      }
    };
  }

  const saveEdits = run(saveEditsSilently, "Saved your edits");
  const retranslate = run(
    () => api.translate([product.productId], true),
    "Re-translated with AI"
  );
  const approve = run(async () => {
    await saveEditsSilently();
    await api.approve(product.productId);
  }, "Translation approved — ready to publish");
  const requestChanges = run(
    () => api.requestChanges(product.productId),
    "Re-opened for changes"
  );
  const publish = run(() => api.publish(product.productId), "Published to Shopify (Polish)", {
    close: true,
  });

  // The footer actions adapt to where the product is in the review pipeline.
  let primaryAction;
  let secondaryActions;
  if (!hasTranslation) {
    primaryAction = { content: "Translate with AI", onAction: retranslate, loading: busy };
    secondaryActions = [{ content: "Close", onAction: onClose }];
  } else if (isPublished) {
    primaryAction = { content: "Request changes", onAction: requestChanges, loading: busy };
    secondaryActions = [{ content: "Close", onAction: onClose }];
  } else if (isApproved) {
    primaryAction = { content: "Publish changes", onAction: publish, loading: busy };
    secondaryActions = [
      { content: "Request changes", onAction: requestChanges, loading: busy },
      { content: "Close", onAction: onClose },
    ];
  } else {
    primaryAction = {
      content: "Approve translation",
      onAction: approve,
      loading: busy,
      disabled: !hasTranslation,
    };
    secondaryActions = [
      { content: "Save edits", onAction: saveEdits, loading: busy },
      { content: "Re-translate with AI", onAction: retranslate, loading: busy },
      { content: "Close", onAction: onClose },
    ];
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="large"
      title="Review English and Polish side by side"
      primaryAction={primaryAction}
      secondaryActions={secondaryActions}
    >
      <Modal.Section>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <Badge tone={badge.tone}>{badge.label}</Badge>
            {!isPublished && (
              <Text as="span" variant="bodySm" tone="subdued">
                {editable
                  ? "Edit any field, then approve to unlock publishing."
                  : "Approved — publish to push it live, or request changes to edit."}
              </Text>
            )}
          </InlineStack>

          {!hasTranslation && (
            <Banner tone="info">
              This product hasn’t been translated yet. Use “Translate with AI” to generate a
              Polish version, then review it here.
            </Banner>
          )}

          {hasTranslation && (
            <Box background="bg-surface-secondary" padding="300" borderRadius="200">
              <BlockStack gap="150">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="span" variant="headingSm">
                    Translation quality
                  </Text>
                  <Badge tone={quality.tone}>{quality.label}</Badge>
                </InlineStack>
                <ProgressBar progress={quality.progress} size="small" tone={quality.progressTone} />
              </BlockStack>
            </Box>
          )}

          {showTitle && (
            <FieldRow
              title="Product title"
              field={product.title}
              value={titleText}
              onChange={setTitleText}
              editable={editable}
            />
          )}
          {showTitle && showDesc && <Divider />}
          {showDesc && (
            <FieldRow
              title="Description"
              field={product.description}
              value={descText}
              onChange={setDescText}
              editable={editable}
              multiline
            />
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
