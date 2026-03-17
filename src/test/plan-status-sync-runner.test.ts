import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { runPlanStatusSync } from "../../scripts/plan-status-sync/plan-status-sync-runner.js";
import { createPlanStatusSyncFixtureWorkspace } from "./plan-status-sync-fixture-utils";

async function read(workspaceDir: string, ...segments: string[]) {
  return fs.readFile(path.join(workspaceDir, ...segments), "utf8");
}

describe("plan-status-sync runner", () => {
  it("keeps plan and docs files unchanged in check mode while still writing a report", async () => {
    const workspaceDir = await createPlanStatusSyncFixtureWorkspace();
    const beforePlan = await read(workspaceDir, "plans", "260316-1632-app-fixes", "plan.md");
    const beforeRoadmap = await read(workspaceDir, "docs", "project-roadmap.md");
    const beforeQ2Phase = await read(
      workspaceDir,
      "plans",
      "260316-1701-q2-features",
      "phase-01-link-expiration.md"
    );

    const result = await runPlanStatusSync({ rootDir: workspaceDir, write: false });

    expect(await read(workspaceDir, "plans", "260316-1632-app-fixes", "plan.md")).toBe(beforePlan);
    expect(await read(workspaceDir, "docs", "project-roadmap.md")).toBe(beforeRoadmap);
    expect(
      await read(workspaceDir, "plans", "260316-1701-q2-features", "phase-01-link-expiration.md")
    ).toBe(beforeQ2Phase);
    expect(await fs.stat(result.reportPath)).toBeTruthy();
  });

  it("backfills rollout plans, downgrades japan plan status, and updates roadmap snapshot", async () => {
    const workspaceDir = await createPlanStatusSyncFixtureWorkspace();
    const q2PhasePath = path.join(
      workspaceDir,
      "plans",
      "260316-1701-q2-features",
      "phase-01-link-expiration.md"
    );
    const seededUncheckedPhase = (await read(
      workspaceDir,
      "plans",
      "260316-1701-q2-features",
      "phase-01-link-expiration.md"
    )).replace("- [x] 1.1 Create DB migration", "- [ ] 1.1 Create DB migration");
    await fs.writeFile(q2PhasePath, seededUncheckedPhase, "utf8");

    await runPlanStatusSync({ rootDir: workspaceDir, write: true });

    const appFixesPlan = await read(workspaceDir, "plans", "260316-1632-app-fixes", "plan.md");
    const q2Phase = await read(
      workspaceDir,
      "plans",
      "260316-1701-q2-features",
      "phase-01-link-expiration.md"
    );
    const japanPlan = await read(
      workspaceDir,
      "plans",
      "260316-0155-japan-proxy-server",
      "plan.md"
    );
    const roadmap = await read(workspaceDir, "docs", "project-roadmap.md");

    expect(appFixesPlan.startsWith("---\n")).toBe(true);
    expect(appFixesPlan).toContain("status: completed");
    expect(appFixesPlan).toContain("<!-- plan-status-sync:start -->");
    expect(appFixesPlan).toContain("# QRLive App Fixes Plan");
    expect(q2Phase).not.toContain("- [ ]");
    expect(japanPlan).toContain("status: in-progress");
    expect(roadmap).toContain("<!-- active-plan-sync:start -->");
    expect(roadmap).toContain("260317-prod-readiness");
    expect(roadmap).toContain("## Project Timeline");
  });

  it("limits rollout writes to the targeted plan when --plan is used", async () => {
    const workspaceDir = await createPlanStatusSyncFixtureWorkspace();
    const beforeQ2Phase = await read(
      workspaceDir,
      "plans",
      "260316-1701-q2-features",
      "phase-01-link-expiration.md"
    );

    await runPlanStatusSync({
      rootDir: workspaceDir,
      targetPlanName: "260316-0155-japan-proxy-server",
      write: true,
    });

    const japanPlan = await read(
      workspaceDir,
      "plans",
      "260316-0155-japan-proxy-server",
      "plan.md"
    );
    const q2Phase = await read(
      workspaceDir,
      "plans",
      "260316-1701-q2-features",
      "phase-01-link-expiration.md"
    );

    expect(japanPlan).toContain("status: in-progress");
    expect(q2Phase).toBe(beforeQ2Phase);
  });
});
