// Shared mappers for translation status -> Polaris Badge tone + label, and for
// quality flag codes -> human-readable warnings.

export const STATUS_META = {
  pending: { label: "Pending", tone: undefined },
  done: { label: "Translated", tone: "info" },
  published: { label: "Published", tone: "success" },
  stale: { label: "Out of date", tone: "warning" },
};

export function statusBadge(status) {
  return STATUS_META[status] ?? { label: status, tone: undefined };
}

export const QUALITY_FLAG_LABELS = {
  robotic_tone: "Robotic tone",
  wrong_formality: "Wrong formality",
  literal_translation: "Literal translation",
  untranslated_segments: "Untranslated segments",
};

export function flagLabel(flag) {
  return QUALITY_FLAG_LABELS[flag] ?? flag;
}
