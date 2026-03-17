#!/usr/bin/env node

import path from "node:path";

import { runPlanStatusSync } from "./plan-status-sync-runner.js";

function parseArgs(argv) {
  const args = { targetPlanName: "", write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--write") {
      args.write = true;
      continue;
    }
    if (token === "--plan") {
      args.targetPlanName = argv[index + 1] || "";
      index += 1;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runPlanStatusSync({
    rootDir: path.resolve(process.cwd()),
    targetPlanName: args.targetPlanName,
    write: args.write,
  });

  console.log(
    [
      `mode=${result.write ? "write" : "check"}`,
      `plans=${result.planResults.length}`,
      `malformed=${result.malformedDirs.length}`,
      `report=${result.reportPath}`,
    ].join(" ")
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
