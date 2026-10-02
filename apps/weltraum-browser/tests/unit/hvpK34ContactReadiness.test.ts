import { describe, expect, it } from "vitest";
import { waitForK34Contact, type K34ContactSample } from "../performance/hvpK34ContactReadiness";

const fact = (tick: number, grounded = true, extra: Partial<K34ContactSample> = {}): K34ContactSample => ({
  atUtc: `tick-${tick}`, tick, physicsStatus: "Running", playerStatus: "Walking", grounded,
  position: { x: -9, y: 2.4067, z: -11 }, velocityY: 0, locked: true,
  inputOwner: "Player", pressedKeys: [], generation: 1, digest: "b1560699",
  toolMessage: "1 Zellen · sicherer Steinbruch", cameraPreset: "C07-QUARRY", playerView: "FirstPerson",
  health: { errors: 0, dropped: 0, timingSinkFailures: 0, cutDrops: 0 }, ...extra
});

const scripted = (steps: readonly K34ContactSample[]) => {
  const samples: K34ContactSample[] = [];
  const reports: { status: string; samples: readonly K34ContactSample[];
    selectedIndices: readonly number[]; selected: readonly [K34ContactSample, K34ContactSample, K34ContactSample] | null;
    errorMessage: string | null }[] = [];
  const secondary: unknown[] = [];
  let index = 0, time = 0;
  const options = {
    beforePlayTick: 257, generation: 1, digest: "b1560699", deadlineMs: 30_000, samples,
    now: () => time,
    read: async () => {
      const sample = steps[index++];
      if (!sample) { throw new Error("Scripted read exhausted"); }
      return { state: sample, sample };
    },
    checkSafe: (s: K34ContactSample) => {
      if (s.physicsStatus === "SimulationHold" || s.health.errors !== 0) { throw new Error("Unsafe contact sample"); }
    },
    delay: async () => { time += 1; },
    persist: async (report: { status: string; samples: readonly K34ContactSample[];
      selectedIndices: readonly number[]; selected: readonly [K34ContactSample, K34ContactSample, K34ContactSample] | null;
      errorMessage: string | null }) => { reports.push(report); },
    onPersistenceError: (error: unknown) => { secondary.push(error); }
  };
  return { options, samples, reports, secondary, setTime: (value: number) => { time = value; } };
};

describe("K34 test-only grounded readiness", () => {
  it("excludes the saved tick, retains valid duplicates, resets on false duplicates, and selects only the first trio", async () => {
    const test = scripted([fact(257), fact(258), fact(258), fact(258, false), fact(258),
      fact(259), fact(260), fact(261), fact(262)]);
    let mouse = 0;
    const selected = await waitForK34Contact(test.options); mouse += 1;
    expect(selected.map(s => s.tick)).toEqual([259, 260, 261]);
    expect(test.reports).toHaveLength(1); expect(test.reports[0]).toMatchObject({ status: "READY",
      beforePlayTick: 257, selectedIndices: [5, 6, 7] });
    expect(test.reports[0]?.selected?.map(s => s.tick)).toEqual([259, 260, 261]);
    expect(test.samples.map(s => s.grounded)).toEqual([true, true, true, false, true, true, true, true]);
    expect(mouse).toBe(1); // No second selection or mouse call for the ninth scripted snapshot.
  });

  it("keeps a valid duplicate inside the successful streak without advancing it", async () => {
    const test = scripted([fact(258), fact(258), fact(259), fact(260)]);
    expect((await waitForK34Contact(test.options)).map(s => s.tick)).toEqual([258, 259, 260]);
    expect(test.reports[0]?.selectedIndices).toEqual([0, 2, 3]);
    expect(test.samples).toHaveLength(4);
  });

  it("resets on a backwards tick without needing a later invalid preview", async () => {
    const test = scripted([fact(258), fact(260), fact(259), fact(261), fact(262), fact(263)]);
    expect((await waitForK34Contact(test.options)).map(s => s.tick)).toEqual([261, 262, 263]);
    expect(test.reports[0]?.selectedIndices).toEqual([3, 4, 5]);
    expect(test.samples).toHaveLength(6);
  });

  const invalidCases: readonly (readonly [string, Partial<K34ContactSample>])[] = [
    ["source digest", { digest: "bad" }], ["generation", { generation: 2 }],
    ["camera preset", { cameraPreset: "C05-ROCKARM" }], ["player view", { playerView: "ThirdPerson" }],
    ["pointer lock", { locked: false }], ["input owner", { inputOwner: "Inspection" }],
    ["pressed key", { pressedKeys: ["KeyW"] }], ["player status", { playerStatus: "Inspection" }],
    ["ground contact", { grounded: false }], ["one-cell preview", { toolMessage: "2 Zellen · sicherer Steinbruch" }],
    ["physics status", { physicsStatus: "Paused" }]
  ];
  it.each(invalidCases)("retains and resets on invalid %s before selecting a trio", async (_name, invalid) => {
    const test = scripted([fact(258), fact(259, true, invalid), fact(260), fact(261), fact(262)]);
    expect((await waitForK34Contact(test.options)).map(s => s.tick)).toEqual([260, 261, 262]);
    expect(test.reports[0]?.selectedIndices).toEqual([2, 3, 4]);
    expect(test.samples).toHaveLength(5);
  });

  it.each([fact(259, true, { physicsStatus: "SimulationHold" }),
    fact(259, true, { health: { errors: 1, dropped: 0, timingSinkFailures: 0, cutDrops: 0 } })])
  ("persists an unsafe observation and never sends input", async unsafe => {
    const test = scripted([fact(258), unsafe, fact(260)]);
    let mouse = 0;
    try { await waitForK34Contact(test.options); mouse += 1; } catch (error) {
      expect(error).toEqual(new Error("Unsafe contact sample"));
    }
    expect(mouse).toBe(0); expect(test.reports[0]).toMatchObject({ status: "FAIL", selectedIndices: [] });
    expect(test.samples).toHaveLength(2);
  });

  it("keeps the original read error and prior samples even when persistence fails", async () => {
    const test = scripted([fact(258)]), primary = new Error("Read failed"), sink = new Error("Sink failed");
    test.options.read = async () => { if (test.samples.length > 0) { throw primary; } return { state: fact(258), sample: fact(258) }; };
    test.options.persist = async () => { throw sink; };
    let mouse = 0;
    try { await waitForK34Contact(test.options); mouse += 1; } catch (error) { expect(error).toBe(primary); }
    expect(test.samples).toHaveLength(1); expect(test.secondary).toEqual([sink]); expect(mouse).toBe(0);
  });

  it("rejects a successful observation returned after the absolute deadline", async () => {
    const test = scripted([fact(258), fact(259), fact(260)]);
    const read = test.options.read;
    let calls = 0, mouse = 0;
    test.options.read = async () => {
      const value = await read();
      if (++calls === 3) { test.setTime(30_001); }
      return value;
    };
    await expect(waitForK34Contact(test.options).then(() => { mouse += 1; })).rejects.toThrow("deadline exceeded");
    expect(test.samples).toHaveLength(3);
    expect(test.reports[0]).toMatchObject({ status: "FAIL", selectedIndices: [] });
    expect(mouse).toBe(0);
  });

  it("stops at the original deadline and the 640-sample cap without a Cut", async () => {
    const timeout = scripted([fact(258)]);
    timeout.options.delay = async () => { timeout.setTime(30_000); };
    await expect(waitForK34Contact(timeout.options)).rejects.toThrow("deadline exceeded");
    expect(timeout.samples).toHaveLength(1); expect(timeout.reports[0]?.status).toBe("FAIL");
    const cap = scripted(Array.from({ length: 641 }, () => fact(258)));
    cap.options.delay = async () => {};
    await expect(waitForK34Contact(cap.options)).rejects.toThrow("cap exceeded");
    expect(cap.samples).toHaveLength(640); expect(cap.reports[0]?.samples).toHaveLength(640);
  });

  it("blocks the real Cut when raw persistence fails after a valid trio", async () => {
    const test = scripted([fact(258), fact(259), fact(260)]), sink = new Error("Sink failed");
    test.options.persist = async () => { throw sink; };
    let mouse = 0;
    try { await waitForK34Contact(test.options); mouse += 1; } catch (error) { expect(error).toBe(sink); }
    expect(mouse).toBe(0); expect(test.samples).toHaveLength(3);
  });
});
