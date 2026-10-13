import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
const label = process.env.PHY_RUN_LABEL ?? "npm-" + Date.now() + "-" + randomUUID().slice(0, 8);
const result = spawnSync(process.execPath, ["scripts/run-suite.mjs", process.env.PHY_VARIANT ?? "c", label, ...process.argv.slice(2)],
  { stdio: "inherit", windowsHide: true, env: { ...process.env, PHY_SUITE: process.env.PHY_SUITE ?? "candidate" } });
process.exitCode = result.status ?? 1;
