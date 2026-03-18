import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

const ACTIVE_PLAN_DIRS = [
  "260316-0155-japan-proxy-server",
  "260316-1632-app-fixes",
  "260316-1701-q2-features",
];

export async function createPlanStatusSyncFixtureWorkspace() {
  const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "plan-status-sync-"));
  await fs.mkdir(path.join(workspaceDir, "docs"), { recursive: true });
  await fs.mkdir(path.join(workspaceDir, "plans", "reports"), { recursive: true });
  await fs.mkdir(path.join(workspaceDir, "plans", "260317-prod-readiness"), { recursive: true });

  for (const dirName of ACTIVE_PLAN_DIRS) {
    await fs.cp(path.join(process.cwd(), "plans", dirName), path.join(workspaceDir, "plans", dirName), {
      recursive: true,
    });
  }

  // Seed Japan proxy plan: uncheck one checkbox in phase-03 so runner derives "in-progress"
  // (tests verify the runner correctly downgrades plan.md status from completed → in-progress)
  const japanPhase03 = path.join(workspaceDir, "plans", "260316-0155-japan-proxy-server", "phase-03-integration-guide.md");
  const phase03Content = await fs.readFile(japanPhase03, "utf8");
  // Replace only the first checked box [x] → [ ] to make phase "in-progress"
  await fs.writeFile(japanPhase03, phase03Content.replace("[x]", "[ ]"), "utf8");

  await fs.copyFile(
    path.join(process.cwd(), "docs", "project-roadmap.md"),
    path.join(workspaceDir, "docs", "project-roadmap.md")
  );
  await fs.copyFile(
    path.join(process.cwd(), "docs", "project-changelog.md"),
    path.join(workspaceDir, "docs", "project-changelog.md")
  );

  return workspaceDir;
}
