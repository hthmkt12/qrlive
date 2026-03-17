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
