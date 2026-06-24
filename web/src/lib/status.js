// Shared mappers for translation status -> Polaris Badge tone + label, for
// quality flag codes -> human-readable warnings, and for an aggregate quality
// meter shown in the review panel.

export const STATUS_META = {
  pending: { label: "Pending", tone: undefined },
  done: { label: "Translated", tone: "info" },
  needs_approval: { label: "Needs approval", tone: "attention" },
  approved: { label: "Approved", tone: "info" },
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

// Map the number of detected quality issues to a meter the reviewer can scan.
// Fewer flags = higher confidence. `progressTone` is restricted to the tones
// Polaris ProgressBar supports.
export function qualityMeta(totalFlags) {
  if (!totalFlags) {
    return { label: "Excellent", progress: 100, tone: "success", progressTone: "success" };
  }
  if (totalFlags === 1) {
    return { label: "Good", progress: 72, tone: "success", progressTone: "primary" };
  }
  if (totalFlags === 2) {
    return { label: "Fair", progress: 48, tone: "warning", progressTone: "primary" };
  }
  return { label: "Needs review", progress: 26, tone: "critical", progressTone: "critical" };
}
