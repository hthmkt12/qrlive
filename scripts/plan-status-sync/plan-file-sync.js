import fs from "node:fs/promises";

import {
  PLAN_BLOCK_END,
  PLAN_BLOCK_START,
} from "./constants.js";
import { formatDisplayTimestamp } from "./date-utils.js";
import {
  serializeFrontmatter,
  upsertManagedBlock,
} from "./frontmatter-utils.js";
import {
  derivePlanProgress,
  derivePlanStatus,
} from "./phase-checkbox-utils.js";

function formatPhaseProgress(phase) {
  const totalItems = phase.summary.checked + phase.summary.unchecked;
  if (totalItems === 0) return "0%";
  return `${Math.round((phase.summary.checked / totalItems) * 100)}%`;
}

function buildManagedPlanBlock(planResult, malformedDirs, syncedAt) {
  const lines = [
    PLAN_BLOCK_START,
    "## Plan Status Sync",
    "",
    `- Last synced: ${formatDisplayTimestamp(syncedAt)}`,
    `- Progress: ${planResult.afterProgress}%`,
    `- Derived status: ${planResult.afterStatus}`,
    "",
    "| Phase | Status | Progress | File |",
    "| --- | --- | --- | --- |",
  ];

  for (const phase of planResult.phaseFiles) {
    lines.push(
      `| ${phase.title} | ${phase.status} | ${formatPhaseProgress(phase)} | \`${phase.fileName}\` |`
    );
  }

  if (malformedDirs.length > 0) {
    lines.push("", "Malformed active plan dirs:");
    for (const malformedDir of malformedDirs) {
      lines.push(`- \`${malformedDir.dirName}\` - ${malformedDir.issue}`);
    }
  }

  lines.push(PLAN_BLOCK_END);
  return lines.join("\n");
}

function buildNormalizedFrontmatter(planResult) {
  const normalized = { ...planResult.frontmatter };
  normalized.title = planResult.metadata.title;
  normalized.status = planResult.afterStatus;
  normalized.priority = planResult.metadata.priority;
  normalized.effort = planResult.metadata.effort;
  normalized.branch = planResult.metadata.branch;
  normalized.created = planResult.metadata.created;
  return normalized;
}

export function createPlanSyncResult(plan, malformedDirs, syncedAt) {
  const afterStatus = derivePlanStatus(plan.phaseFiles);
  const afterProgress = derivePlanProgress(plan.phaseFiles);
  const managedBlock = buildManagedPlanBlock(
    { ...plan, afterProgress, afterStatus },
    malformedDirs,
    syncedAt
  );
  const updatedBody = upsertManagedBlock(
    plan.body,
    managedBlock,
    PLAN_BLOCK_START,
    PLAN_BLOCK_END
  );
  const updatedPlanContent = [
    serializeFrontmatter(buildNormalizedFrontmatter({ ...plan, afterStatus })),
    updatedBody.trimStart(),
  ].join("\n\n");

  return {
    ...plan,
    afterProgress,
    afterStatus,
    phaseFiles: plan.phaseFiles,
    planChanged: updatedPlanContent !== plan.planContent,
    updatedPlanContent,
  };
}

export async function writePlanSyncResult(planResult) {
  for (const phase of planResult.phaseFiles) {
    if (phase.content === phase.originalContent) continue;
    await fs.writeFile(phase.filePath, phase.content, "utf8");
  }

  if (planResult.planChanged) {
    await fs.writeFile(planResult.planPath, planResult.updatedPlanContent, "utf8");
  }
}
