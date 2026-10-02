/** Test-only contact evidence. It does not own or alter the native player. */
export interface K34ContactSample {
  atUtc: string;
  tick: number;
  physicsStatus: string;
  playerStatus: string | null;
  grounded: boolean | null;
  position: { x: number; y: number; z: number } | null;
  velocityY: number | null;
  locked: boolean;
  inputOwner: string;
  pressedKeys: readonly string[];
  generation: number;
  digest: string;
  toolMessage: string;
  cameraPreset: string | undefined;
  playerView: string | undefined;
  health: { errors: number | null; dropped: number | null; timingSinkFailures: number | null; cutDrops: number | null };
}

export const waitForK34Contact = async <T>(options: {
  beforePlayTick: number;
  generation: number;
  digest: string;
  deadlineMs: number;
  samples: K34ContactSample[];
  now(): number;
  read(): Promise<{ state: T; sample: K34ContactSample }>;
  checkSafe(state: T): void;
  delay(): Promise<void>;
  persist(report: { status: "READY" | "FAIL"; beforePlayTick: number;
    samples: readonly K34ContactSample[]; selectedIndices: readonly number[];
    selected: readonly [T, T, T] | null; errorType: string | null; errorMessage: string | null }): Promise<void>;
  onPersistenceError?(error: unknown): void;
}): Promise<readonly [T, T, T]> => {
  const { samples, beforePlayTick } = options;
  const streak: { index: number; tick: number; state: T }[] = [];
  let selected: readonly [T, T, T] | null = null;
  let selectedIndices: number[] = [];
  let failed = false, primaryError: unknown;
  try {
    if (!Number.isSafeInteger(beforePlayTick) || beforePlayTick < 0) { throw new Error("Invalid before-Play tick"); }
    while (options.now() < options.deadlineMs) {
      if (samples.length >= 640) { throw new Error("Contact observation cap exceeded"); }
      const { state, sample } = await options.read();
      const previousTick = samples.at(-1)?.tick ?? beforePlayTick;
      samples.push(sample); // Persist the offending observation before checking safety or time.
      options.checkSafe(state);
      if (options.now() >= options.deadlineMs) { throw new Error("Contact readiness deadline exceeded"); }
      const valid = Number.isSafeInteger(sample.tick) && sample.tick > beforePlayTick
        && sample.physicsStatus === "Running" && sample.playerStatus === "Walking" && sample.grounded === true
        && sample.locked && sample.inputOwner === "Player" && sample.pressedKeys.length === 0
        && sample.generation === options.generation && sample.digest === options.digest
        && sample.cameraPreset === "C07-QUARRY" && sample.playerView === "FirstPerson"
        && sample.toolMessage.startsWith("1 Zellen") && sample.toolMessage.includes("sicherer Steinbruch");
      if (!valid || sample.tick < previousTick) {
        streak.length = 0;
      } else if (sample.tick > previousTick) {
        streak.push({ index: samples.length - 1, tick: sample.tick, state });
        if (streak.length === 3) {
          selected = [streak[0]!.state, streak[1]!.state, streak[2]!.state];
          selectedIndices = streak.map(value => value.index);
          break; // First qualifying trio only; a later assertion may not reselect.
        }
      } // A valid repeat of the immediately preceding tick is retained but neutral.
      await options.delay();
    }
    if (selected === null) { throw new Error("Contact readiness deadline exceeded"); }
  } catch (error) { failed = true; primaryError = error; }

  let persistenceError: unknown;
  try {
    await options.persist({ status: failed ? "FAIL" : "READY", beforePlayTick, samples,
      selectedIndices, selected, errorType: failed && primaryError instanceof Error ? primaryError.name : null,
      errorMessage: failed && primaryError instanceof Error ? primaryError.message.split(/\r?\n/, 1)[0]?.slice(0, 500) ?? null : null });
  } catch (error) { persistenceError = error; }
  if (failed) {
    if (persistenceError !== undefined) {
      try { options.onPersistenceError?.(persistenceError); } catch { /* Preserve the original readiness failure. */ }
    }
    throw primaryError;
  }
  if (persistenceError !== undefined) { throw persistenceError; }
  return selected!;
};
