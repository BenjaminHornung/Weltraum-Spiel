import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PersistenceValidationError, createUniverseClock } from "../../src/persistence/index";
import {
  SIMULATION_SCHEDULER_FIXTURES,
  createSimulationSchedulerFixtureSnapshot,
  validateSchedulerCommand,
  validateSchedulerSnapshot,
  validateSimulationJobDefinition,
  validateSimulationJobInstance
} from "../../src/simulation-scheduler/index";

type MutableRecord = Record<string, any>;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe("simulation scheduler validation and boundaries", () => {
  it("exports exactly eight neutral, deeply frozen fixtures and a validated explicit-time snapshot", () => {
    expect(SIMULATION_SCHEDULER_FIXTURES.map((fixture) => fixture.name)).toEqual([
      "mining-background",
      "cargo-transfer",
      "drone-survey",
      "repair",
      "mission-deadline-check",
      "needs-player-attention",
      "destroyed",
      "dormant-outpost"
    ]);
    const snapshot = createSimulationSchedulerFixtureSnapshot(100);
    expect(snapshot.universeTime).toEqual(createUniverseClock(100));
    expect(snapshot.definitions).toHaveLength(8);
    expect(snapshot.jobs).toHaveLength(8);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.jobs)).toBe(true);
    expect(Object.isFrozen(snapshot.jobs[0]!.facts)).toBe(true);
    expect(Object.isFrozen(SIMULATION_SCHEDULER_FIXTURES)).toBe(true);
  });

  it("defensively clones, canonicalizes set order, and leaves caller data unchanged", () => {
    const source = clone(createSimulationSchedulerFixtureSnapshot(100)) as MutableRecord;
    source.definitions.reverse();
    source.jobs.reverse();
    const before = JSON.stringify(source);
    const validated = validateSchedulerSnapshot(source);

    expect(JSON.stringify(source)).toBe(before);
    expect(validated.definitions.map((entry) => entry.definitionId)).toEqual(
      [...validated.definitions.map((entry) => entry.definitionId)].sort()
    );
    expect(validated.jobs.map((entry) => entry.jobId)).toEqual([...validated.jobs.map((entry) => entry.jobId)].sort());
    source.jobs[0].facts.changed = true;
    expect(validated.jobs[0]!.facts).not.toHaveProperty("changed");
  });

  it("rejects unknown fields at every public ingress", () => {
    const fixture = SIMULATION_SCHEDULER_FIXTURES[0]!;
    expect(() => validateSimulationJobDefinition({ ...fixture.definition, extra: true })).toThrow(PersistenceValidationError);
    expect(() => validateSimulationJobInstance({ ...fixture.job, extra: true })).toThrow(PersistenceValidationError);
    expect(() => validateSchedulerSnapshot({ ...createSimulationSchedulerFixtureSnapshot(), extra: true }))
      .toThrow(PersistenceValidationError);
    expect(() => validateSchedulerCommand({
      kind: "Pause",
      jobId: fixture.job.jobId,
      expectedRevision: 0,
      extra: true
    })).toThrow(PersistenceValidationError);
  });

  it("rejects accessors, symbols, sparse arrays, non-JSON values, and cycles without invoking getters", () => {
    const fixture = clone(SIMULATION_SCHEDULER_FIXTURES[0]!.definition) as MutableRecord;
    let invoked = false;
    Object.defineProperty(fixture, "kind", {
      enumerable: true,
      get: () => {
        invoked = true;
        return "forbidden";
      }
    });
    expect(() => validateSimulationJobDefinition(fixture)).toThrow(PersistenceValidationError);
    expect(invoked).toBe(false);

    const symbolDefinition = clone(SIMULATION_SCHEDULER_FIXTURES[0]!.definition) as unknown as Record<PropertyKey, unknown>;
    symbolDefinition[Symbol("hidden")] = true;
    expect(() => validateSimulationJobDefinition(symbolDefinition)).toThrow(PersistenceValidationError);

    const sparse = clone(SIMULATION_SCHEDULER_FIXTURES[0]!.definition) as MutableRecord;
    delete sparse.allowedModes[0];
    expect(() => validateSimulationJobDefinition(sparse)).toThrow(PersistenceValidationError);

    const undefinedFact = clone(SIMULATION_SCHEDULER_FIXTURES[0]!.job) as MutableRecord;
    undefinedFact.facts.invalid = undefined;
    expect(() => validateSimulationJobInstance(undefinedFact)).toThrow(PersistenceValidationError);

    const cyclic = clone(SIMULATION_SCHEDULER_FIXTURES[0]!.job) as MutableRecord;
    cyclic.facts.self = cyclic.facts;
    expect(() => validateSimulationJobInstance(cyclic)).toThrow(PersistenceValidationError);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, -0, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid numeric identity %s for revisions, ticks, costs, and policy fields",
    (invalid) => {
      const snapshot = clone(createSimulationSchedulerFixtureSnapshot()) as MutableRecord;
      snapshot.revision = invalid;
      expect(() => validateSchedulerSnapshot(snapshot)).toThrow();

      const definition = clone(SIMULATION_SCHEDULER_FIXTURES[0]!.definition) as MutableRecord;
      definition.costUnits = invalid;
      expect(() => validateSimulationJobDefinition(definition)).toThrow();

      const job = clone(SIMULATION_SCHEDULER_FIXTURES[0]!.job) as MutableRecord;
      job.nextDueTick = invalid;
      expect(() => validateSimulationJobInstance(job)).toThrow();
    }
  );

  it("enforces ID namespaces, unique IDs, known definitions, valid modes, and consistent history", () => {
    const definition = clone(SIMULATION_SCHEDULER_FIXTURES[0]!.definition) as MutableRecord;
    definition.definitionId = "other:mining";
    expect(() => validateSimulationJobDefinition(definition)).toThrowError(
      expect.objectContaining({ code: "INVALID_ID" })
    );

    const duplicate = clone(createSimulationSchedulerFixtureSnapshot()) as MutableRecord;
    duplicate.jobs.push(clone(duplicate.jobs[0]));
    expect(() => validateSchedulerSnapshot(duplicate)).toThrowError(expect.objectContaining({ code: "DUPLICATE_ID" }));

    const unknownDefinition = clone(createSimulationSchedulerFixtureSnapshot()) as MutableRecord;
    unknownDefinition.jobs[0].definitionId = "simulation-job-definition:missing.v1";
    expect(() => validateSchedulerSnapshot(unknownDefinition)).toThrowError(
      expect.objectContaining({ code: "UNKNOWN_REFERENCE" })
    );

    const invalidMode = clone(createSimulationSchedulerFixtureSnapshot()) as MutableRecord;
    invalidMode.jobs[0].mode = "Warped";
    expect(() => validateSchedulerSnapshot(invalidMode)).toThrow(PersistenceValidationError);

    const futureHistory = clone(createSimulationSchedulerFixtureSnapshot(100)) as MutableRecord;
    futureHistory.jobs[0].lastPlannedTick = 101;
    expect(() => validateSchedulerSnapshot(futureHistory)).toThrow(PersistenceValidationError);
  });

  it("keeps the module pure and imports external authority only from persistence/index", () => {
    const directory = resolve(process.cwd(), "src", "simulation-scheduler");
    const sources = readdirSync(directory)
      .filter((file) => file.endsWith(".ts"))
      .map((file) => readFileSync(resolve(directory, file), "utf8"));
    const combined = sources.join("\n");
    expect(combined).not.toMatch(/\bDate\b|performance\.now|setTimeout|setInterval|Math\.random|crypto\.getRandomValues/);
    expect(combined).not.toMatch(/\bwindow\b|\bdocument\b|from ["']three["']|from ["'][^"']*(runtime|flight|world|renderer)[^"']*["']/i);

    for (const source of sources) {
      for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
        const specifier = match[1]!;
        expect(specifier.startsWith("./") || specifier === "../persistence/index").toBe(true);
      }
    }
  });
});
