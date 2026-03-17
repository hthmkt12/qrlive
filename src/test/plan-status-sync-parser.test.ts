import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  extractLegacyPlanMetadata,
  parseFrontmatterDocument,
} from "../../scripts/plan-status-sync/frontmatter-utils.js";
import { discoverPlanWorkspace } from "../../scripts/plan-status-sync/plan-discovery.js";
import { summarizeCheckboxes } from "../../scripts/plan-status-sync/phase-checkbox-utils.js";
import { createPlanStatusSyncFixtureWorkspace } from "./plan-status-sync-fixture-utils";

describe("plan-status-sync parsers", () => {
  it("parses frontmatter-backed plans and legacy plan metadata", async () => {
    const q2PlanContent = await fs.readFile(
      path.join(process.cwd(), "plans", "260316-1701-q2-features", "plan.md"),
      "utf8"
    );
    const legacyPlanContent = `# QRLive App Fixes Plan
**Date:** 2026-03-16 | **Branch:** master | **Status:** ✅ Completed (2026-03-16)
`;

    const q2Plan = parseFrontmatterDocument(q2PlanContent);
    const appFixesPlan = parseFrontmatterDocument(legacyPlanContent);
    const legacyMetadata = extractLegacyPlanMetadata(appFixesPlan.body);

    expect(q2Plan.hasFrontmatter).toBe(true);
    expect(q2Plan.frontmatter.status).toBe("completed");
    expect(appFixesPlan.hasFrontmatter).toBe(false);
    expect(legacyMetadata.title).toBe("QRLive App Fixes Plan");
    expect(legacyMetadata.branch).toBe("master");
    expect(legacyMetadata.status).toBe("completed");
  });

  it("summarizes checkboxes across multiple sections", () => {
    const summary = summarizeCheckboxes(`
- [x] first
- [ ] second
1. [x] third
2. [ ] fourth
    `);

    expect(summary).toEqual({ checked: 2, unchecked: 2 });
  });

  it("flags malformed active plan directories without plan.md", async () => {
    const workspaceDir = await createPlanStatusSyncFixtureWorkspace();
    const workspace = await discoverPlanWorkspace(workspaceDir);

    expect(workspace.plans).toHaveLength(3);
    expect(workspace.malformedDirs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dirName: "260317-prod-readiness", issue: "missing plan.md" }),
      ])
    );
  });
});
