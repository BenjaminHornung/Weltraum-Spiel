import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const HVP_EVIDENCE_RUN_ID_ENV = "WELTRAUM_HVP_RUN_ID";
export const HVP_EVIDENCE_RUN_TOKEN = ".hvp-run-id";
export const HVP_R8_CANDIDATE_NAMES = [
  "hvp-c01-eye.png",
  "hvp-c02-with-water.png",
  "hvp-c02-without-water.png",
  "hvp-c02-ao-off.png",
  "hvp-c04-wide.png",
  "hvp-c04-wide-1280x720.png",
  "manifest.json"
] as const;

/**
 * Fail-closed freshness gate for the env-gated HVP evidence emitter.
 *
 * Fails when a first claim finds any known R8 candidate, when a continuation
 * finds any of this emitter's own output names, when no unique run id is
 * exported, or when another run already claimed the target via the token file.
 * Creates the missing target and stamps the token for this run id. Never
 * removes files.
 */
export const assertFreshHvpEmitTarget = async (
  directory: string,
  ownNames: readonly string[],
  allCandidateNames: readonly string[]
): Promise<string> => {
  const runId = process.env[HVP_EVIDENCE_RUN_ID_ENV] ?? "";
  if (runId.trim() === "") {
    throw new Error(
      `HVP evidence emission requires ${HVP_EVIDENCE_RUN_ID_ENV} to be set to a unique run id; refusing ${directory}.`
    );
  }
  await mkdir(directory, { recursive: true });
  const entries = new Set(await readdir(directory));
  const tokenPath = join(directory, HVP_EVIDENCE_RUN_TOKEN);
  let stamped: string | undefined;
  try {
    stamped = await readFile(tokenPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
  if (stamped !== undefined && stamped !== runId) {
    throw new Error(
      `HVP evidence target was claimed by run ${stamped}, not this run ${runId}; use a fresh empty directory.`
    );
  }
  const namesToReject = stamped === undefined ? allCandidateNames : ownNames;
  for (const name of namesToReject) {
    if (entries.has(name)) {
      throw new Error(
        `HVP evidence target is not fresh: ${name} already exists in ${directory}; use a fresh empty directory, never reuse it.`
      );
    }
  }
  if (stamped === undefined) {
    await writeFile(tokenPath, runId, "utf8");
  }
  return runId;
};
