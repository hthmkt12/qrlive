import fs from "node:fs/promises";
import path from "node:path";

import {
  ROADMAP_PATH,
  ROADMAP_SNAPSHOT_END,
  ROADMAP_SNAPSHOT_START,
} from "./constants.js";
import { formatDisplayTimestamp } from "./date-utils.js";
import { upsertManagedBlock } from "./frontmatter-utils.js";

function buildRoadmapSnapshotBlock(planResults, malformedDirs, syncedAt) {
  const lines = [
    ROADMAP_SNAPSHOT_START,
    "## Active Plan Sync Snapshot",
    "",
    `- Last synced: ${formatDisplayTimestamp(syncedAt)}`,
    "",
    "| Plan | Status | Progress | Notes |",
    "| --- | --- | --- | --- |",
  ];

  for (const planResult of planResults) {
    const notes = [];
    if (planResult.rolloutBackfilled) notes.push("rollout backfill");
    if (planResult.planChanged && planResult.planWritePlanned) notes.push("plan.md updated");
    lines.push(
      `| ${planResult.metadata.title} | ${planResult.afterStatus} | ${planResult.afterProgress}% | ${notes.join(", ") || "-"} |`
    );
  }

  if (malformedDirs.length > 0) {
    lines.push("", "Malformed active plan dirs:");
    for (const malformedDir of malformedDirs) {
      lines.push(`- \`${malformedDir.dirName}\` - ${malformedDir.issue}`);
    }
  }

  lines.push(ROADMAP_SNAPSHOT_END);
  return lines.join("\n");
}

export function updateRoadmapContent(content, planResults, malformedDirs, syncedAt) {
  const block = buildRoadmapSnapshotBlock(planResults, malformedDirs, syncedAt);
  if (content.includes(ROADMAP_SNAPSHOT_START) && content.includes(ROADMAP_SNAPSHOT_END)) {
    return upsertManagedBlock(content, block, ROADMAP_SNAPSHOT_START, ROADMAP_SNAPSHOT_END);
  }

  const insertionPoint = content.indexOf("## Project Timeline");
  if (insertionPoint >= 0) {
    return `${content.slice(0, insertionPoint).trimEnd()}\n\n${block}\n\n${content
      .slice(insertionPoint)
      .trimStart()}`;
  }

  return `${content.trimEnd()}\n\n${block}\n`;
}

export async function writeRoadmapSnapshot(rootDir, planResults, malformedDirs, syncedAt) {
  const roadmapPath = path.join(rootDir, ROADMAP_PATH);
  const currentContent = await fs.readFile(roadmapPath, "utf8");
  const updatedContent = updateRoadmapContent(currentContent, planResults, malformedDirs, syncedAt);
  const changed = updatedContent !== currentContent;
  if (changed) {
    await fs.writeFile(roadmapPath, updatedContent, "utf8");
  }
  return { changed, roadmapPath, updatedContent };
}
