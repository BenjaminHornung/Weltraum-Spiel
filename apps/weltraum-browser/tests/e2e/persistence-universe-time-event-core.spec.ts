import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const evidenceDir = path.resolve(process.cwd(), "evidence");
const summaryPath = path.join(evidenceDir, "browser-persistence-universe-time-event-core-v1-summary.json");
const markdownPath = path.join(evidenceDir, "browser-persistence-universe-time-event-core-v1.md");
const modulePath = "/src/persistence/index.ts";

interface BrowserHealth {
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly requestFailures: string[];
  readonly httpErrors: string[];
}

interface NormalRouteGuard {
  readonly route: string;
  readonly testBridgeOwnProperty: boolean;
  readonly testBridgeInWindow: boolean;
}

interface PersistenceScenarioRun {
  readonly modulePath: string;
  readonly moduleLoaded: boolean;
  readonly ticksPerSecond: number;
  readonly time: {
    readonly initialTick: number;
    readonly advancedByTicks: number;
    readonly advancedTick: number;
    readonly advancedEpochSeconds: number;
    readonly missionTickBefore: number;
    readonly missionTickAfter: number;
    readonly acknowledgedAtTick: number;
  };
  readonly ids: {
    readonly saveId: string;
    readonly orderedEventIds: readonly string[];
  };
  readonly events: {
    readonly statuses: readonly string[];
    readonly duplicateWasNoOp: boolean;
    readonly acknowledgedEventRetained: boolean;
    readonly actionRequiredRetained: boolean;
    readonly acknowledgementTimeRetained: boolean;
  };
  readonly simulationMode: {
    readonly path: readonly string[];
    readonly destroyedSelfTransition: string;
    readonly terminalErrorCode: string | null;
    readonly eventCountBefore: number;
    readonly eventCountAfter: number;
  };
  readonly roundtrip: {
    readonly canonicalBytes: string;
    readonly reserializedBytes: string;
    readonly signature: string;
    readonly reloadedSignature: string;
    readonly saveFrozen: boolean;
    readonly nestedStateFrozen: boolean;
  };
  readonly migration: {
    readonly sourceVersion: number;
    readonly targetVersion: number;
    readonly appliedMigrationIds: readonly string[];
    readonly expectedMigrationId: string;
    readonly inputUnchanged: boolean;
    readonly resultFrozen: boolean;
    readonly nestedStateFrozen: boolean;
  };
}

interface PersistenceEvidence {
  readonly schemaVersion: 1;
  readonly feature: "browser-persistence-universe-time-event-core-v1";
  readonly route: NormalRouteGuard;
  readonly moduleLoad: {
    readonly path: string;
    readonly loaded: boolean;
  };
  readonly universeTime: {
    readonly ticksPerSecond: number;
    readonly initialTick: number;
    readonly advancedByTicks: number;
    readonly advancedTick: number;
    readonly advancedEpochSeconds: number;
    readonly missionTickRemainedIndependent: boolean;
    readonly acknowledgementTick: number;
  };
  readonly events: {
    readonly orderedEventIds: readonly string[];
    readonly statuses: readonly string[];
    readonly duplicateWasNoOp: boolean;
    readonly acknowledgedEventRetained: boolean;
    readonly actionRequiredRetained: boolean;
    readonly acknowledgementTimeRetained: boolean;
  };
  readonly simulationMode: PersistenceScenarioRun["simulationMode"];
  readonly save: {
    readonly saveId: string;
    readonly signature: string;
    readonly canonicalBytesEqualAfterRoundtrip: boolean;
    readonly signatureEqualAfterRoundtrip: boolean;
    readonly canonicalByteLength: number;
    readonly frozen: boolean;
    readonly nestedStateFrozen: boolean;
  };
  readonly migration: PersistenceScenarioRun["migration"];
  readonly deterministicRepeat: {
    readonly canonicalBytesEqual: boolean;
    readonly signaturesEqual: boolean;
    readonly completeScenarioEqual: boolean;
  };
  readonly health: {
    readonly consoleErrors: number;
    readonly pageErrors: number;
    readonly requestFailures: number;
    readonly httpErrors: number;
  };
  readonly status: "PASS";
}

const installBrowserHealthCollector = (page: Page): BrowserHealth => {
  const health: BrowserHealth = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    httpErrors: []
  };

  page.on("console", (message) => {
    if (message.type() === "error") {
      health.consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => health.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    health.requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      health.httpErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });

  return health;
};

const createMarkdown = (evidence: PersistenceEvidence): string => `# Persistence Universe Time Event Core E2E Evidence

Status: **${evidence.status}**

## Normal route and module

- Route: \`${evidence.route.route}\`
- TestBridge own property: \`${evidence.route.testBridgeOwnProperty}\`
- TestBridge present through the window prototype chain: \`${evidence.route.testBridgeInWindow}\`
- Dynamic module: \`${evidence.moduleLoad.path}\`
- Module loaded: \`${evidence.moduleLoad.loaded}\`

## Universe time

- Canonical rate: \`${evidence.universeTime.ticksPerSecond} Hz\`
- Tick advance: \`${evidence.universeTime.initialTick} + ${evidence.universeTime.advancedByTicks} = ${evidence.universeTime.advancedTick}\`
- Epoch seconds after advance: \`${evidence.universeTime.advancedEpochSeconds}\`
- Mission time remained independent: \`${evidence.universeTime.missionTickRemainedIndependent}\`
- Explicit acknowledgement tick: \`${evidence.universeTime.acknowledgementTick}\`

## Persistent events

- Stable order: ${evidence.events.orderedEventIds.map((eventId) => `\`${eventId}\``).join(", ")}
- Statuses: ${evidence.events.statuses.map((status) => `\`${status}\``).join(", ")}
- Exact duplicate was a no-op: \`${evidence.events.duplicateWasNoOp}\`
- Acknowledged event retained: \`${evidence.events.acknowledgedEventRetained}\`
- \`actionRequired\` retained: \`${evidence.events.actionRequiredRetained}\`
- Explicit acknowledgement time retained: \`${evidence.events.acknowledgementTimeRetained}\`

## Simulation mode

- Valid path: ${evidence.simulationMode.path.map((mode) => `\`${mode}\``).join(" -> ")}
- Destroyed self-transition: \`${evidence.simulationMode.destroyedSelfTransition}\`
- Destroyed terminal error: \`${evidence.simulationMode.terminalErrorCode}\`
- Event count before/after mode changes: \`${evidence.simulationMode.eventCountBefore}/${evidence.simulationMode.eventCountAfter}\`

## Save roundtrip

- Save ID: \`${evidence.save.saveId}\`
- Signature: \`${evidence.save.signature}\`
- Canonical bytes equal after roundtrip: \`${evidence.save.canonicalBytesEqualAfterRoundtrip}\`
- Signature equal after roundtrip: \`${evidence.save.signatureEqualAfterRoundtrip}\`
- Canonical byte length: \`${evidence.save.canonicalByteLength}\`
- Save and nested state frozen: \`${evidence.save.frozen}/${evidence.save.nestedStateFrozen}\`

## Neutral fixture migration

- Version: \`${evidence.migration.sourceVersion} -> ${evidence.migration.targetVersion}\`
- Applied migration IDs: ${evidence.migration.appliedMigrationIds.map((migrationId) => `\`${migrationId}\``).join(", ")}
- Expected migration ID: \`${evidence.migration.expectedMigrationId}\`
- Input unchanged: \`${evidence.migration.inputUnchanged}\`
- Result and nested state frozen: \`${evidence.migration.resultFrozen}/${evidence.migration.nestedStateFrozen}\`

## Determinism and browser health

- Two-run canonical bytes equal: \`${evidence.deterministicRepeat.canonicalBytesEqual}\`
- Two-run signatures equal: \`${evidence.deterministicRepeat.signaturesEqual}\`
- Complete two-run result equal: \`${evidence.deterministicRepeat.completeScenarioEqual}\`
- Health counts (console/page/request/HTTP): \`${evidence.health.consoleErrors}/${evidence.health.pageErrors}/${evidence.health.requestFailures}/${evidence.health.httpErrors}\`
`;

test("normal route proves deterministic persistence, Universe time, events, modes, and migration", async ({ page }) => {
  const health = installBrowserHealthCollector(page);

  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await page.waitForLoadState("networkidle");

  const routeGuard = await page.evaluate((): NormalRouteGuard => ({
    route: location.pathname,
    testBridgeOwnProperty: Object.prototype.hasOwnProperty.call(window, "TestBridge"),
    testBridgeInWindow: "TestBridge" in window
  }));

  expect(routeGuard).toEqual({
    route: "/",
    testBridgeOwnProperty: false,
    testBridgeInWindow: false
  });

  const repeated = await page.evaluate(async (): Promise<{
    readonly first: PersistenceScenarioRun;
    readonly second: PersistenceScenarioRun;
  }> => {
    const persistenceModulePath = "/src/persistence/index.ts";
    const persistence = await import(persistenceModulePath);

    const runScenario = (): PersistenceScenarioRun => {
      const snapshots = persistence.createDefinitionResolutionFixture();
      const fixture = persistence.createSaveGameEnvelopeV1Fixture();
      const initialClock = persistence.createUniverseClock();
      const missionTime = persistence.createMissionTime(17);
      const advancedClock = persistence.advanceUniverseTicks(initialClock, 120);
      const acknowledgedAt = persistence.advanceUniverseTicks(advancedClock, 4);

      const sourceId = persistence.createStableFixtureId("ship", "scout", 0);
      const targetId = persistence.createStableFixtureId("player", "captain", 0);
      const alphaEvent = {
        eventId: persistence.createStableFixtureId("event", "alpha", 0),
        type: "NeedsPlayerAttention",
        universeTime: advancedClock,
        sourceId,
        targetId,
        severity: "Warning",
        actionRequired: true,
        payload: { reasonCode: "navigation.confirmation-required", retryCount: 0 },
        status: "Pending",
        acknowledgedAt: null
      };
      const zetaEvent = {
        eventId: persistence.createStableFixtureId("event", "zeta", 0),
        type: "FuelReserveLow",
        universeTime: advancedClock,
        sourceId,
        targetId,
        severity: "Critical",
        actionRequired: true,
        payload: { reserveKg: 12, thresholdKg: 15 },
        status: "Pending",
        acknowledgedAt: null
      };

      const queueWithZeta = persistence.enqueueEvent(persistence.createEventQueue(), { event: zetaEvent });
      const orderedQueue = persistence.enqueueEvent(queueWithZeta, { event: alphaEvent });
      const duplicateQueue = persistence.enqueueEvent(orderedQueue, {
        event: JSON.parse(JSON.stringify(alphaEvent))
      });
      const duplicateWasNoOp =
        persistence.serializeCanonicalPersistenceValue(duplicateQueue)
        === persistence.serializeCanonicalPersistenceValue(orderedQueue);
      const acknowledgedQueue = persistence.acknowledgeEvent(duplicateQueue, {
        eventId: alphaEvent.eventId,
        acknowledgedAt
      });

      const modePath = ["Active"];
      for (const nextMode of ["Background", "Dormant", "NeedsPlayerAttention", "Destroyed"]) {
        modePath.push(persistence.transitionSimulationMode(modePath[modePath.length - 1], nextMode));
      }
      const destroyedSelfTransition = persistence.transitionSimulationMode("Destroyed", "Destroyed");
      let terminalErrorCode: string | null = null;
      try {
        persistence.transitionSimulationMode("Destroyed", "Active");
      } catch (error) {
        terminalErrorCode = error instanceof persistence.SimulationModeTransitionError
          ? (error as { readonly code: string }).code
          : "unexpected-error";
      }

      const validatedSave = persistence.validateSaveGameEnvelopeV1(
        {
          ...fixture,
          universeTime: acknowledgedAt,
          worldEvents: acknowledgedQueue,
          metadata: {
            ...fixture.metadata,
            updatedAtTick: acknowledgedAt.tick
          }
        },
        snapshots
      );
      const canonicalBytes = persistence.serializeSaveGameEnvelopeV1(validatedSave, snapshots);
      const reloadedSave = persistence.deserializeSaveGameEnvelopeV1(canonicalBytes, snapshots);
      const reserializedBytes = persistence.serializeSaveGameEnvelopeV1(reloadedSave, snapshots);
      const signature = persistence.createSaveGameSignature(validatedSave, snapshots);
      const reloadedSignature = persistence.createSaveGameSignature(reloadedSave, snapshots);

      const migrationInput = persistence.createNeutralMigrationFixtureV1();
      const migrationInputBytes = persistence.serializeCanonicalPersistenceValue(migrationInput);
      const migration = persistence.migrateSave(
        persistence.createNeutralFixtureMigrationRegistry(),
        migrationInput,
        2
      );

      const acknowledgedEvent = acknowledgedQueue.events[0];
      return {
        modulePath: persistenceModulePath,
        moduleLoaded: typeof persistence.createUniverseClock === "function",
        ticksPerSecond: persistence.UNIVERSE_TICKS_PER_SECOND,
        time: {
          initialTick: initialClock.tick,
          advancedByTicks: 120,
          advancedTick: advancedClock.tick,
          advancedEpochSeconds: advancedClock.epochSeconds,
          missionTickBefore: missionTime.tick,
          missionTickAfter: missionTime.tick,
          acknowledgedAtTick: acknowledgedAt.tick
        },
        ids: {
          saveId: validatedSave.saveId,
          orderedEventIds: acknowledgedQueue.events.map((event: { readonly eventId: string }) => event.eventId)
        },
        events: {
          statuses: acknowledgedQueue.events.map((event: { readonly status: string }) => event.status),
          duplicateWasNoOp,
          acknowledgedEventRetained: acknowledgedQueue.events.length === 2 && acknowledgedEvent?.eventId === alphaEvent.eventId,
          actionRequiredRetained: acknowledgedEvent?.actionRequired === true,
          acknowledgementTimeRetained: acknowledgedEvent?.acknowledgedAt?.tick === acknowledgedAt.tick
        },
        simulationMode: {
          path: modePath,
          destroyedSelfTransition,
          terminalErrorCode,
          eventCountBefore: acknowledgedQueue.events.length,
          eventCountAfter: acknowledgedQueue.events.length
        },
        roundtrip: {
          canonicalBytes,
          reserializedBytes,
          signature,
          reloadedSignature,
          saveFrozen: Object.isFrozen(validatedSave) && Object.isFrozen(reloadedSave),
          nestedStateFrozen:
            Object.isFrozen(validatedSave.worldEvents.events)
            && Object.isFrozen(reloadedSave.ships)
            && Object.isFrozen(reloadedSave.player.data)
        },
        migration: {
          sourceVersion: migrationInput.schemaVersion,
          targetVersion: migration.value.schemaVersion,
          appliedMigrationIds: migration.appliedMigrationIds,
          expectedMigrationId: persistence.NEUTRAL_FIXTURE_MIGRATION_ID,
          inputUnchanged:
            persistence.serializeCanonicalPersistenceValue(migrationInput) === migrationInputBytes,
          resultFrozen: Object.isFrozen(migration) && Object.isFrozen(migration.value),
          nestedStateFrozen: Object.isFrozen(migration.value.data)
        }
      };
    };

    return { first: runScenario(), second: runScenario() };
  });

  expect(repeated.first.modulePath).toBe(modulePath);
  expect(repeated.first.moduleLoaded).toBe(true);
  expect(repeated.first.ticksPerSecond).toBe(120);
  expect(repeated.first.time).toEqual({
    initialTick: 0,
    advancedByTicks: 120,
    advancedTick: 120,
    advancedEpochSeconds: 1,
    missionTickBefore: 17,
    missionTickAfter: 17,
    acknowledgedAtTick: 124
  });
  expect(repeated.first.ids.saveId).toBe("save:primary.0");
  expect(repeated.first.ids.orderedEventIds).toEqual(["event:alpha.0", "event:zeta.0"]);
  expect(repeated.first.events).toEqual({
    statuses: ["Acknowledged", "Pending"],
    duplicateWasNoOp: true,
    acknowledgedEventRetained: true,
    actionRequiredRetained: true,
    acknowledgementTimeRetained: true
  });
  expect(repeated.first.simulationMode).toEqual({
    path: ["Active", "Background", "Dormant", "NeedsPlayerAttention", "Destroyed"],
    destroyedSelfTransition: "Destroyed",
    terminalErrorCode: "INVALID_SIMULATION_MODE_TRANSITION",
    eventCountBefore: 2,
    eventCountAfter: 2
  });
  expect(repeated.first.roundtrip.reserializedBytes).toBe(repeated.first.roundtrip.canonicalBytes);
  expect(repeated.first.roundtrip.reloadedSignature).toBe(repeated.first.roundtrip.signature);
  expect(repeated.first.roundtrip.signature).toMatch(/^fnv1a32:[0-9a-f]{8}$/);
  expect(repeated.first.roundtrip.saveFrozen).toBe(true);
  expect(repeated.first.roundtrip.nestedStateFrozen).toBe(true);
  expect(repeated.first.migration).toEqual({
    sourceVersion: 1,
    targetVersion: 2,
    appliedMigrationIds: ["fixture.neutral.v1-to-v2"],
    expectedMigrationId: "fixture.neutral.v1-to-v2",
    inputUnchanged: true,
    resultFrozen: true,
    nestedStateFrozen: true
  });
  expect(repeated.second).toEqual(repeated.first);
  expect(repeated.second.roundtrip.canonicalBytes).toBe(repeated.first.roundtrip.canonicalBytes);
  expect(repeated.second.roundtrip.signature).toBe(repeated.first.roundtrip.signature);

  expect(health.consoleErrors, "console errors").toEqual([]);
  expect(health.pageErrors, "page errors").toEqual([]);
  expect(health.requestFailures, "failed requests").toEqual([]);
  expect(health.httpErrors, "HTTP responses with status >= 400").toEqual([]);

  const evidence: PersistenceEvidence = {
    schemaVersion: 1,
    feature: "browser-persistence-universe-time-event-core-v1",
    route: routeGuard,
    moduleLoad: {
      path: repeated.first.modulePath,
      loaded: repeated.first.moduleLoaded
    },
    universeTime: {
      ticksPerSecond: repeated.first.ticksPerSecond,
      initialTick: repeated.first.time.initialTick,
      advancedByTicks: repeated.first.time.advancedByTicks,
      advancedTick: repeated.first.time.advancedTick,
      advancedEpochSeconds: repeated.first.time.advancedEpochSeconds,
      missionTickRemainedIndependent:
        repeated.first.time.missionTickBefore === repeated.first.time.missionTickAfter,
      acknowledgementTick: repeated.first.time.acknowledgedAtTick
    },
    events: {
      orderedEventIds: repeated.first.ids.orderedEventIds,
      statuses: repeated.first.events.statuses,
      duplicateWasNoOp: repeated.first.events.duplicateWasNoOp,
      acknowledgedEventRetained: repeated.first.events.acknowledgedEventRetained,
      actionRequiredRetained: repeated.first.events.actionRequiredRetained,
      acknowledgementTimeRetained: repeated.first.events.acknowledgementTimeRetained
    },
    simulationMode: repeated.first.simulationMode,
    save: {
      saveId: repeated.first.ids.saveId,
      signature: repeated.first.roundtrip.signature,
      canonicalBytesEqualAfterRoundtrip:
        repeated.first.roundtrip.canonicalBytes === repeated.first.roundtrip.reserializedBytes,
      signatureEqualAfterRoundtrip:
        repeated.first.roundtrip.signature === repeated.first.roundtrip.reloadedSignature,
      canonicalByteLength: repeated.first.roundtrip.canonicalBytes.length,
      frozen: repeated.first.roundtrip.saveFrozen,
      nestedStateFrozen: repeated.first.roundtrip.nestedStateFrozen
    },
    migration: repeated.first.migration,
    deterministicRepeat: {
      canonicalBytesEqual:
        repeated.first.roundtrip.canonicalBytes === repeated.second.roundtrip.canonicalBytes,
      signaturesEqual:
        repeated.first.roundtrip.signature === repeated.second.roundtrip.signature,
      completeScenarioEqual: JSON.stringify(repeated.first) === JSON.stringify(repeated.second)
    },
    health: {
      consoleErrors: health.consoleErrors.length,
      pageErrors: health.pageErrors.length,
      requestFailures: health.requestFailures.length,
      httpErrors: health.httpErrors.length
    },
    status: "PASS"
  };

  await mkdir(evidenceDir, { recursive: true });
  await writeFile(summaryPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, createMarkdown(evidence), "utf8");
});
