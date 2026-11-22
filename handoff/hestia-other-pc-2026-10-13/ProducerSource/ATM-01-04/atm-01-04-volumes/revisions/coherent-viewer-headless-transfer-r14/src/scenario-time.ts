// The RD frame contract requires integer scenario ticks and seconds === tick / 60.
const SCENARIO_TICKS_PER_SECOND = 60;

function requireTick(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Invalid scenario time');
}

export function scenarioTime(tick: number) {
  requireTick(tick);
  return {tick, seconds: tick / SCENARIO_TICKS_PER_SECOND};
}

export function scenarioTickFromSource(tick: number, originTick: number, sourceTicksPerSecond: number): number {
  requireTick(tick);
  requireTick(originTick);
  if (tick < originTick || !Number.isSafeInteger(sourceTicksPerSecond) || sourceTicksPerSecond <= 0) {
    throw new RangeError('Invalid source time or rate');
  }
  // Subtract the epoch before scaling. Integer division selects the last complete RD tick.
  const scaled = BigInt(tick - originTick) * BigInt(SCENARIO_TICKS_PER_SECOND) / BigInt(sourceTicksPerSecond);
  const result = Number(scaled);
  requireTick(result);
  return result;
}

/** Wall time drives only standalone viewer playback. The weather snapshot remains frozen. */
export function createPlaybackTickReader() {
  let previousMs: number | undefined;
  let wasPaused = false;
  let activeMs = 0;
  return (timestampMs: number, paused = false): number => {
    if (!Number.isFinite(timestampMs) || timestampMs < 0 || (previousMs !== undefined && timestampMs < previousMs)) {
      throw new RangeError('Invalid animation timestamp');
    }
    if (previousMs !== undefined && !paused && !wasPaused) activeMs += timestampMs - previousMs;
    previousMs = timestampMs;
    wasPaused = paused;
    return Math.floor(activeMs * SCENARIO_TICKS_PER_SECOND / 1000);
  };
}
