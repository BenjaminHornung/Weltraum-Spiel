import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  HVP_EVIDENCE_RUN_ID_ENV,
  HVP_EVIDENCE_RUN_TOKEN,
  HVP_R8_CANDIDATE_NAMES,
  assertFreshHvpEmitTarget
} from "../e2e/hvp-evidence-guard";

const previousRunId = process.env[HVP_EVIDENCE_RUN_ID_ENV];
let owned: string[] = [];

afterEach(async () => {
  if (previousRunId === undefined) {
    delete process.env[HVP_EVIDENCE_RUN_ID_ENV];
  } else {
    process.env[HVP_EVIDENCE_RUN_ID_ENV] = previousRunId;
  }
  await Promise.all(owned.map((directory) => rm(directory, { recursive: true, force: true })));
  owned = [];
});

const freshTemp = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), "hvp-guard-negative-"));
  owned.push(directory);
  return directory;
};

describe("HVP evidence freshness guard", () => {
  it("stamps a run token on a fresh target and accepts it again for the same run", async () => {
    process.env[HVP_EVIDENCE_RUN_ID_ENV] = "run-fresh-001";
    const directory = await freshTemp();
    await expect(assertFreshHvpEmitTarget(directory, ["hvp-c01-eye.png"], HVP_R8_CANDIDATE_NAMES)).resolves.toBe("run-fresh-001");
    expect(await readFile(join(directory, HVP_EVIDENCE_RUN_TOKEN), "utf8")).toBe("run-fresh-001");
    await expect(assertFreshHvpEmitTarget(directory, ["hvp-c04-wide.png"], HVP_R8_CANDIDATE_NAMES)).resolves.toBe("run-fresh-001");
  });

  it("fails the first claim on a stale other-emitter companion without stamping a token", async () => {
    process.env[HVP_EVIDENCE_RUN_ID_ENV] = "run-reuse-002";
    const directory = await freshTemp();
    await writeFile(join(directory, "hvp-c02-with-water.png"), Buffer.from("stale"));
    await expect(assertFreshHvpEmitTarget(directory, ["hvp-c01-eye.png"], HVP_R8_CANDIDATE_NAMES))
      .rejects.toThrow(/not fresh.*hvp-c02-with-water\.png/);
    expect(await readdir(directory)).toEqual(["hvp-c02-with-water.png"]);
  });

  it("accepts earlier same-run emitter files but rejects its own existing output", async () => {
    process.env[HVP_EVIDENCE_RUN_ID_ENV] = "run-first-003";
    const directory = await freshTemp();
    await assertFreshHvpEmitTarget(directory, ["hvp-c02-with-water.png", "hvp-c02-without-water.png"], HVP_R8_CANDIDATE_NAMES);
    await writeFile(join(directory, "hvp-c02-with-water.png"), Buffer.from("earlier"));
    await expect(assertFreshHvpEmitTarget(directory, ["hvp-c02-ao-off.png"], HVP_R8_CANDIDATE_NAMES)).resolves.toBe("run-first-003");
    await writeFile(join(directory, "hvp-c02-ao-off.png"), Buffer.from("current"));
    await expect(assertFreshHvpEmitTarget(directory, ["hvp-c02-ao-off.png"], HVP_R8_CANDIDATE_NAMES))
      .rejects.toThrow(/not fresh.*hvp-c02-ao-off\.png/);
  });

  it("fails when another run already claimed the target", async () => {
    process.env[HVP_EVIDENCE_RUN_ID_ENV] = "run-first-004";
    const directory = await freshTemp();
    await assertFreshHvpEmitTarget(directory, ["hvp-c01-eye.png"], HVP_R8_CANDIDATE_NAMES);
    process.env[HVP_EVIDENCE_RUN_ID_ENV] = "run-second-005";
    await expect(assertFreshHvpEmitTarget(directory, ["hvp-c04-wide.png"], HVP_R8_CANDIDATE_NAMES))
      .rejects.toThrow(/claimed by run run-first-004/);
  });

  it("fails closed without a run id and writes nothing", async () => {
    delete process.env[HVP_EVIDENCE_RUN_ID_ENV];
    const directory = await freshTemp();
    await expect(assertFreshHvpEmitTarget(directory, ["hvp-c01-eye.png"], HVP_R8_CANDIDATE_NAMES))
      .rejects.toThrow(/WELTRAUM_HVP_RUN_ID/);
    expect(await readdir(directory)).toEqual([]);
    process.env[HVP_EVIDENCE_RUN_ID_ENV] = "   ";
    await expect(assertFreshHvpEmitTarget(directory, ["hvp-c01-eye.png"], HVP_R8_CANDIDATE_NAMES))
      .rejects.toThrow(/WELTRAUM_HVP_RUN_ID/);
    expect(await readdir(directory)).toEqual([]);
  });
});
