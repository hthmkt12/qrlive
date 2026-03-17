import { discoverPlanWorkspace } from "./plan-discovery.js";
import { createPlanSyncResult, writePlanSyncResult } from "./plan-file-sync.js";
import { applyScopedRolloutBackfills } from "./plan-rollout-rules.js";
import { writeRoadmapSnapshot } from "./roadmap-sync.js";
import {
  buildSyncReport,
  collectDocsWarnings,
  readChangelog,
  writeSyncReport,
} from "./report-builder.js";

function assertKnownTarget(targetPlanName, plans, malformedDirs) {
  if (!targetPlanName) return;
  const knownPlan = plans.some((plan) => plan.dirName === targetPlanName);
  const knownMalformed = malformedDirs.some((malformedDir) => malformedDir.dirName === targetPlanName);
  if (!knownPlan && !knownMalformed) {
    throw new Error(`Unknown plan directory: ${targetPlanName}`);
  }
}

function preparePlanResult(plan, malformedDirs, syncedAt, targetPlanName) {
  const rolledOutPlan = applyScopedRolloutBackfills(plan, targetPlanName);
  const withinScope = !targetPlanName || targetPlanName === plan.dirName;

  return createPlanSyncResult(
    {
      ...rolledOutPlan,
      phaseFiles: rolledOutPlan.phaseFiles,
      planWritePlanned: withinScope,
    },
    malformedDirs,
    syncedAt
  );
}

export async function runPlanStatusSync({
  rootDir,
  targetPlanName = "",
  write = false,
}) {
  const syncedAt = new Date();
  const { malformedDirs, plans } = await discoverPlanWorkspace(rootDir);
  assertKnownTarget(targetPlanName, plans, malformedDirs);

  const planResults = plans.map((plan) =>
    preparePlanResult(plan, malformedDirs, syncedAt, targetPlanName)
  );
  const changelogContent = await readChangelog(rootDir);
  const docsWarnings = collectDocsWarnings(planResults, changelogContent);

  if (write) {
    for (const planResult of planResults) {
      const withinScope = !targetPlanName || planResult.dirName === targetPlanName;
      if (!withinScope) continue;
      await writePlanSyncResult(planResult);
    }
    await writeRoadmapSnapshot(rootDir, planResults, malformedDirs, syncedAt);
  }

  const reportContent = buildSyncReport({
    docsWarnings,
    malformedDirs,
    mode: write ? "write" : "check",
    planResults,
    syncedAt,
    targetPlanName,
  });
  const reportPath = await writeSyncReport(rootDir, reportContent, syncedAt);

  return {
    docsWarnings,
    malformedDirs,
    planResults,
    reportPath,
    syncedAt,
    write,
  };
}
