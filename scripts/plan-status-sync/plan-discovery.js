import fs from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_BRANCH,
  DEFAULT_EFFORT,
  DEFAULT_PRIORITY,
  IGNORED_PLAN_DIRS,
  PLAN_ROOT_DIR,
} from "./constants.js";
import {
  extractLegacyPlanMetadata,
  normalizePlanStatus,
  parseFrontmatterDocument,
} from "./frontmatter-utils.js";
import {
  derivePhaseStatus,
  derivePlanProgress,
  derivePlanStatus,
  summarizeCheckboxes,
} from "./phase-checkbox-utils.js";

function titleFromDirName(dirName) {
  return dirName
    .split("-")
    .slice(1)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function inferCreatedDate(dirName) {
  const match = dirName.match(/^(\d{2})(\d{2})(\d{2})/);
  if (!match) return "";
  return `20${match[1]}-${match[2]}-${match[3]}`;
}

function extractPhaseTitle(content, fileName) {
  const parsed = parseFrontmatterDocument(content);
  if (parsed.frontmatter.title) return String(parsed.frontmatter.title);
  const heading = parsed.body.match(/^#\s+(.+)$/m);
  return heading?.[1]?.trim() || fileName.replace(/^phase-\d+-/, "").replace(/\.md$/, "");
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function discoverPlanWorkspace(rootDir) {
  const plansRoot = path.join(rootDir, PLAN_ROOT_DIR);
  const planDirs = await fs.readdir(plansRoot, { withFileTypes: true });

  const malformedDirs = [];
  const plans = [];

  for (const entry of planDirs) {
    if (!entry.isDirectory() || IGNORED_PLAN_DIRS.has(entry.name)) continue;

    const planDir = path.join(plansRoot, entry.name);
    const planPath = path.join(planDir, "plan.md");
    if (!(await pathExists(planPath))) {
      malformedDirs.push({
        dirName: entry.name,
        issue: "missing plan.md",
        planDir,
      });
      continue;
    }

    const planContent = await fs.readFile(planPath, "utf8");
    const parsedPlan = parseFrontmatterDocument(planContent);
    const legacyMetadata = extractLegacyPlanMetadata(parsedPlan.body);
    const phaseEntries = (await fs.readdir(planDir, { withFileTypes: true }))
      .filter((child) => child.isFile() && /^phase-.*\.md$/i.test(child.name))
      .sort((left, right) => left.name.localeCompare(right.name));

    const phases = [];
    for (const phaseEntry of phaseEntries) {
      const phasePath = path.join(planDir, phaseEntry.name);
      const content = await fs.readFile(phasePath, "utf8");
      const summary = summarizeCheckboxes(content);
      phases.push({
        content,
        fileName: phaseEntry.name,
        filePath: phasePath,
        originalContent: content,
        status: derivePhaseStatus(summary),
        summary,
        title: extractPhaseTitle(content, phaseEntry.name),
      });
    }

    const metadata = {
      branch: parsedPlan.frontmatter.branch || legacyMetadata.branch || DEFAULT_BRANCH,
      created:
        parsedPlan.frontmatter.created ||
        legacyMetadata.created ||
        inferCreatedDate(entry.name),
      effort: parsedPlan.frontmatter.effort || DEFAULT_EFFORT,
      priority: parsedPlan.frontmatter.priority || DEFAULT_PRIORITY,
      title: parsedPlan.frontmatter.title || legacyMetadata.title || titleFromDirName(entry.name),
    };

    plans.push({
      beforeProgress: derivePlanProgress(phases),
      beforeStatus: parsedPlan.frontmatter.status
        ? normalizePlanStatus(parsedPlan.frontmatter.status)
        : legacyMetadata.status || derivePlanStatus(phases),
      body: parsedPlan.body,
      dirName: entry.name,
      frontmatter: parsedPlan.frontmatter,
      hasFrontmatter: parsedPlan.hasFrontmatter,
      metadata,
      phaseFiles: phases,
      planContent,
      planDir,
      planPath,
    });
  }

  return { malformedDirs, plans };
}
