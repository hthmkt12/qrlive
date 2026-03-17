import fs from "node:fs/promises";
import path from "node:path";

import {
  CHANGELOG_PATH,
  PLAN_REPORTS_DIR,
} from "./constants.js";
import {
  formatDisplayTimestamp,
  formatReportStamp,
} from "./date-utils.js";

export async function readChangelog(rootDir) {
  return fs.readFile(path.join(rootDir, CHANGELOG_PATH), "utf8");
}

export function collectDocsWarnings(planResults, changelogContent) {
  return planResults
    .filter(
      (planResult) =>
        planResult.beforeStatus !== "completed" && planResult.afterStatus === "completed"
    )
    .filter(
      (planResult) =>
        !changelogContent.includes(planResult.metadata.title) &&
        !changelogContent.includes(planResult.dirName)
    )
    .map(
      (planResult) =>
        `Review docs/project-changelog.md manually for completed plan \`${planResult.metadata.title}\`.`
    );
}

function buildPlanRows(planResults) {
  return planResults.map(
    (planResult) =>
      `| ${planResult.dirName} | ${planResult.beforeStatus} | ${planResult.afterStatus} | ${planResult.beforeProgress}% | ${planResult.afterProgress}% |`
  );
}

export function buildSyncReport({
  docsWarnings,
  malformedDirs,
  mode,
  planResults,
  syncedAt,
  targetPlanName,
}) {
  const lines = [
    "# Plan Status Sync Report",
    "",
    `- Mode: ${mode}`,
    `- Scope: ${targetPlanName || "all active plans"}`,
    `- Generated at: ${formatDisplayTimestamp(syncedAt)}`,
    "",
    "## Plan Status Changes",
    "",
    "| Plan Dir | Before Status | After Status | Before Progress | After Progress |",
    "| --- | --- | --- | --- | --- |",
    ...buildPlanRows(planResults),
    "",
    "## Malformed Active Plan Dirs",
    "",
  ];

  if (malformedDirs.length === 0) {
    lines.push("- None");
  } else {
    for (const malformedDir of malformedDirs) {
      lines.push(`- \`${malformedDir.dirName}\` - ${malformedDir.issue}`);
    }
  }

  lines.push("", "## Docs Warnings", "");
  if (docsWarnings.length === 0) {
    lines.push("- None");
  } else {
    for (const warning of docsWarnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push("", "## Unresolved Mappings", "", "- None");
  return `${lines.join("\n")}\n`;
}

export async function writeSyncReport(rootDir, reportContent, syncedAt) {
  const reportFileName = `pm-${formatReportStamp(syncedAt)}-plan-status-sync.md`;
  const reportPath = path.join(rootDir, PLAN_REPORTS_DIR, reportFileName);
  await fs.writeFile(reportPath, reportContent, "utf8");
  return reportPath;
}
