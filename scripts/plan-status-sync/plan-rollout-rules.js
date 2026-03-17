import { ROLLOUT_BACKFILL_PLAN_DIRS } from "./constants.js";
import {
  derivePhaseStatus,
  markAllCheckboxesCompleted,
  summarizeCheckboxes,
} from "./phase-checkbox-utils.js";

export function applyScopedRolloutBackfills(plan, targetPlanName) {
  const withinScope = !targetPlanName || targetPlanName === plan.dirName;
  if (!withinScope || !ROLLOUT_BACKFILL_PLAN_DIRS.has(plan.dirName)) {
    return { ...plan, rolloutBackfilled: false };
  }

  let rolloutBackfilled = false;
  const phaseFiles = plan.phaseFiles.map((phase) => {
    const nextContent = markAllCheckboxesCompleted(phase.content);
    if (nextContent !== phase.content) rolloutBackfilled = true;

    const summary = summarizeCheckboxes(nextContent);
    return {
      ...phase,
      content: nextContent,
      originalContent: phase.originalContent || phase.content,
      status: derivePhaseStatus(summary),
      summary,
    };
  });

  return {
    ...plan,
    phaseFiles,
    rolloutBackfilled,
  };
}
