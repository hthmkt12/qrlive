const CHECKBOX_PATTERN = /^\s*(?:[-*]|\d+\.)\s+\[(x|X| )\]/gm;
const UNCHECKED_BOX_PATTERN = /^(\s*(?:[-*]|\d+\.)\s+)\[ \]/gm;

export function summarizeCheckboxes(content) {
  const summary = { checked: 0, unchecked: 0 };
  for (const match of content.matchAll(CHECKBOX_PATTERN)) {
    if (match[1].trim().toLowerCase() === "x") {
      summary.checked += 1;
      continue;
    }
    summary.unchecked += 1;
  }
  return summary;
}

export function derivePhaseStatus(summary) {
  if (summary.checked === 0 && summary.unchecked === 0) return "pending";
  if (summary.unchecked === 0) return "completed";
  if (summary.checked === 0) return "pending";
  return "in-progress";
}

export function derivePlanProgress(phases) {
  const totals = phases.reduce(
    (accumulator, phase) => ({
      checked: accumulator.checked + phase.summary.checked,
      unchecked: accumulator.unchecked + phase.summary.unchecked,
    }),
    { checked: 0, unchecked: 0 }
  );

  const totalItems = totals.checked + totals.unchecked;
  if (totalItems === 0) return 0;
  return Math.round((totals.checked / totalItems) * 100);
}

export function derivePlanStatus(phases) {
  if (phases.length === 0) return "pending";
  if (phases.every((phase) => phase.status === "pending")) return "pending";
  if (phases.every((phase) => phase.status === "completed")) return "completed";
  return "in-progress";
}

export function markAllCheckboxesCompleted(content) {
  return content.replace(UNCHECKED_BOX_PATTERN, "$1[x]");
}
