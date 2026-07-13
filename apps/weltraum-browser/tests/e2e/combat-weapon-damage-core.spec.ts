import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ciTimeout } from "./support/ciTiming";

type CombatDomain = typeof import("../../src/combat/index");

const evidenceDir = path.resolve(process.cwd(), "evidence");
const summaryPath = path.join(evidenceDir, "browser-combat-weapon-damage-core-v1-summary.json");
const markdownPath = path.join(evidenceDir, "browser-combat-weapon-damage-core-v1.md");
const generator = "apps/weltraum-browser/tests/e2e/combat-weapon-damage-core.spec.ts";
const focusedCommand = "npm run test:e2e -- tests/e2e/combat-weapon-damage-core.spec.ts";

interface BrowserFailures {
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly requestFailures: string[];
  readonly httpErrors: string[];
}

interface TestBridgeState {
  readonly ownProperty: boolean;
  readonly inWindow: boolean;
}

interface CombatScenarioRun {
  readonly scenarioName: "fixed-hybrid-projectile-module-hit";
  readonly modulePath: "/src/combat/index.ts";
  readonly ids: {
    readonly weaponId: string;
    readonly targetId: string;
    readonly proxyId: string;
    readonly moduleId: string;
    readonly projectileId: string;
    readonly hitId: string;
    readonly packetId: string;
    readonly eventIds: readonly string[];
  };
  readonly permission: {
    readonly allowed: boolean;
    readonly blockers: readonly string[];
    readonly primaryReason: string | null;
  };
  readonly weaponState: {
    readonly before: { readonly ammo: number | null; readonly energy: number | null; readonly heat: number | null; readonly cooldownSeconds: number; readonly shotSequence: number };
    readonly after: { readonly ammo: number | null; readonly energy: number | null; readonly heat: number | null; readonly cooldownSeconds: number; readonly shotSequence: number };
  };
  readonly hit: {
    readonly targetEntityId: string;
    readonly proxyId: string;
    readonly moduleId: string | null;
    readonly point: { readonly x: number; readonly y: number; readonly z: number };
    readonly distanceMeters: number;
    readonly incomingSpeedMetersPerSecond: number | null;
  };
  readonly damage: {
    readonly armor: { readonly before: number; readonly after: number; readonly applied: number };
    readonly hull: { readonly before: number; readonly after: number; readonly applied: number };
    readonly module: { readonly before: number; readonly after: number; readonly applied: number; readonly statusBefore: string; readonly statusAfter: string };
    readonly penetratingDamage: number;
    readonly effects: readonly string[];
  };
  readonly eventPhaseOrder: readonly string[];
  readonly damageSignature: string;
  readonly eventSequenceSignature: string;
  readonly canonicalJson: string;
  readonly scenarioSignature: string;
}

interface CombatBrowserEvidence {
  readonly schemaVersion: "browser-combat-weapon-damage-core-v1";
  readonly status: "PASS";
  readonly generator: string;
  readonly scenarioName: CombatScenarioRun["scenarioName"];
  readonly publicModulePath: CombatScenarioRun["modulePath"];
  readonly normalRoute: {
    readonly path: "/";
    readonly debugSceneVisible: true;
    readonly testBridgeBefore: TestBridgeState;
    readonly testBridgeAfter: TestBridgeState;
  };
  readonly browserGuards: {
    readonly registeredBeforeNavigation: true;
    readonly faviconRequestHandling: "test-local 204 for the implicit /favicon.ico browser request";
    readonly consoleErrorCount: 0;
    readonly pageErrorCount: 0;
    readonly requestFailureCount: 0;
    readonly nonSuccessHttpResponseCount: 0;
  };
  readonly deterministicRepeat: {
    readonly canonicalJsonIdentical: true;
    readonly scenarioSignatureIdentical: true;
    readonly derivedIdsIdentical: true;
  };
  readonly pinned: {
    readonly scenarioSignature: string;
    readonly eventSequenceSignature: string;
    readonly damageSignature: string;
    readonly projectileId: string;
    readonly hitId: string;
    readonly packetId: string;
    readonly eventIds: readonly string[];
  };
  readonly scenario: CombatScenarioRun;
  readonly verification: {
    readonly command: string;
    readonly expectedResult: "one focused Playwright test passes and overwrites exactly two deterministic evidence files";
    readonly observedResult: "pass";
  };
}

const PINNED = {
  scenarioSignature: "b06ee1f07dceba22",
  eventSequenceSignature: "8bd75e8db29a410f",
  damageSignature: "791a23555e1ad973",
  projectileId: "projectile:5b0f79241853e574",
  hitId: "hit:e397b1eefcf10e9a",
  packetId: "packet:2b910b9724e7309a",
  eventIds: [
    "event:bf4acc7730117cce",
    "event:e10fcb0cbd0c6683",
    "event:482d49b8b5854074",
    "event:0614d97af131a7cc",
    "event:e364f76f0a0bf485"
  ]
} as const;

const installBrowserFailureCollectors = (page: Page): BrowserFailures => {
  const failures: BrowserFailures = { consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location();
      failures.consoleErrors.push(`${message.text()} @ ${location.url}:${location.lineNumber}:${location.columnNumber}`);
    }
  });
  page.on("pageerror", (error) => failures.pageErrors.push(error.message));
  page.on("requestfailed", (request) => failures.requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`));
  page.on("response", (response) => {
    if (!response.ok()) failures.httpErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
  });
  return failures;
};

const readTestBridgeState = (page: Page): Promise<TestBridgeState> => page.evaluate(() => ({
  ownProperty: Object.prototype.hasOwnProperty.call(window, "TestBridge"),
  inWindow: "TestBridge" in window
}));

const createMarkdown = (evidence: CombatBrowserEvidence): string => `# Browser Combat Weapon Damage Core v1 Evidence

Generated by \`${evidence.generator}\` through the normal Browser route.

## Result

- Status: \`${evidence.status}\`
- Scenario: \`${evidence.scenarioName}\`
- Public module: \`${evidence.publicModulePath}\`
- Route: \`${evidence.normalRoute.path}\`
- Debug scene ready: \`${evidence.normalRoute.debugSceneVisible}\`
- TestBridge absent before and after: \`${!evidence.normalRoute.testBridgeBefore.ownProperty && !evidence.normalRoute.testBridgeBefore.inWindow && !evidence.normalRoute.testBridgeAfter.ownProperty && !evidence.normalRoute.testBridgeAfter.inWindow}\`
- Implicit favicon request: ${evidence.browserGuards.faviconRequestHandling}; all app and dynamically imported module requests remain observed by the failure collectors.
- Console/Page/Network/HTTP error counts: \`${evidence.browserGuards.consoleErrorCount}/${evidence.browserGuards.pageErrorCount}/${evidence.browserGuards.requestFailureCount}/${evidence.browserGuards.nonSuccessHttpResponseCount}\`

## Pinned Deterministic Identity

- Scenario signature: \`${evidence.pinned.scenarioSignature}\`
- Event-sequence signature: \`${evidence.pinned.eventSequenceSignature}\`
- Damage signature: \`${evidence.pinned.damageSignature}\`
- Projectile ID: \`${evidence.pinned.projectileId}\`
- Hit ID: \`${evidence.pinned.hitId}\`
- Damage Packet ID: \`${evidence.pinned.packetId}\`
- Event IDs: ${evidence.pinned.eventIds.map((eventId) => `\`${eventId}\``).join(", ")}

## Canonical Event Flow

${evidence.scenario.eventPhaseOrder.map((phase, index) => `${index + 1}. \`${phase}\``).join("\n")}

The accepted Hybrid shot consumed Ammo and Energy atomically, added deterministic Heat, set cooldown, and incremented the shot sequence once. The Projectile hit the explicit Target/Proxy/Module; Armor absorbed first and the penetrating remainder independently damaged Hull and the named Module.

## Final State

\`\`\`json
${JSON.stringify({ weaponState: evidence.scenario.weaponState, hit: evidence.scenario.hit, damage: evidence.scenario.damage }, null, 2)}
\`\`\`

## Canonical Scenario JSON

\`\`\`json
${evidence.scenario.canonicalJson}
\`\`\`

## Focused Verification

- Command: \`${evidence.verification.command}\`
- Expected: ${evidence.verification.expectedResult}
- Observed: \`${evidence.verification.observedResult}\`
`;

test("normal route runs the deterministic combat weapon and damage scenario twice", async ({ page }) => {
  test.setTimeout(ciTimeout(60_000, 90_000));
  const failures = installBrowserFailureCollectors(page);
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/");
  await page.waitForSelector("#debug-scene", { state: "visible" });
  await page.waitForLoadState("networkidle");

  const testBridgeBefore = await readTestBridgeState(page);
  expect(testBridgeBefore).toEqual({ ownProperty: false, inWindow: false });

  const repeated = await page.evaluate<{
    readonly first: CombatScenarioRun;
    readonly second: CombatScenarioRun;
  }>(async () => {
    const modulePath = "/src/combat/index.ts";
    const combat = (await import(/* @vite-ignore */ modulePath)) as CombatDomain;

    const runScenario = (): CombatScenarioRun => {
      const capability = combat.createWeaponCapability({
        weaponId: "weapon:e2e-hybrid",
        mount: { kind: "Fixed", halfArcRadians: Math.PI / 8 },
        delivery: {
          kind: "Projectile",
          speedMetersPerSecond: 100,
          radiusMeters: 0.5,
          massKilograms: 2,
          lifetimeSeconds: 2,
          maximumPathRangeMeters: 150
        },
        maximumRangeMeters: 150,
        damageType: "Kinetic",
        rawDamage: 60,
        rateOfFirePerSecond: 2,
        maximumTrackingErrorRadians: 0.01,
        ammoPerShot: 2,
        energyPerShot: 5,
        heat: { heatPerShot: 4, maximumHeat: 20, coolingPerSecond: 1 }
      });
      const state = combat.createWeaponRuntimeState({
        weaponId: capability.weaponId,
        lifecycle: "Operational",
        cooldownSeconds: 0,
        ammo: 6,
        energy: 30,
        heat: 3,
        shotSequence: 7
      }, capability);
      const pose = combat.createWeaponMountPose({
        sourceEntityId: "ship:e2e-source",
        ownerId: "owner:e2e-source",
        frameId: "frame:e2e-combat",
        muzzlePosition: { x: 0, y: 0, z: 0 },
        forward: { x: 0, y: 0, z: 1 },
        up: { x: 0, y: 1, z: 0 },
        muzzleDirection: { x: 0, y: 0, z: 1 },
        sourceVelocity: { x: 0, y: 0, z: 0 }
      });
      const target = combat.createCombatTarget({
        targetId: "ship:e2e-target",
        ownerId: "owner:e2e-target",
        frameId: "frame:e2e-combat",
        tick: 500,
        position: { x: 0, y: 0, z: 100 },
        velocity: { x: 0, y: 0, z: 0 },
        targetable: true,
        lifecycle: "Active"
      });
      const decoy = combat.createCombatTarget({
        targetId: "ship:e2e-decoy",
        ownerId: "owner:e2e-decoy",
        frameId: "frame:e2e-combat",
        tick: 500,
        position: { x: 500, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        targetable: true,
        lifecycle: "Active"
      });
      const selectedTarget = combat.selectCombatTargetById([decoy, target], "ship:e2e-target");
      if (selectedTarget === null) throw new Error("Expected stable-ID target selection to succeed.");

      const request = {
        capability,
        state,
        pose,
        target: selectedTarget,
        tick: 500,
        policy: { relation: "Hostile" as const, friendlyFire: "Denied" as const, permission: "Allowed" as const },
        lineOfFire: "Clear" as const
      };
      const permission = combat.evaluateFirePermission(request);
      const fired = combat.fireWeapon(request);
      if (!fired.accepted || fired.delivery?.kind !== "Projectile") throw new Error("Expected the deterministic Projectile fire transition to be accepted.");

      const proxy = combat.createCollisionProxy({
        kind: "Sphere",
        proxyId: "proxy:e2e-target-weapon",
        entityId: selectedTarget.targetId,
        moduleId: "module:e2e-weapon",
        frameId: selectedTarget.frameId,
        center: selectedTarget.position,
        radiusMeters: 2
      });
      const advanced = combat.advanceProjectile(fired.delivery.projectile, 1, 501, [proxy]);
      if (advanced.status !== "Hit") throw new Error("Expected swept Projectile collision to resolve one Hit.");

      const packet = combat.createDamagePacketFromHit(advanced.hit, fired.delivery.projectile.payload);
      const damageable = combat.createDamageableSnapshot({
        targetEntityId: selectedTarget.targetId,
        armor: { current: 12, maximum: 20, resistances: combat.zeroResistanceFixture({ Kinetic: 0.25 }) },
        hull: { current: 100, maximum: 100, resistances: combat.zeroResistanceFixture({ Kinetic: 0.1 }) },
        modules: [{
          moduleId: "module:e2e-weapon",
          role: "Weapon",
          current: 40,
          maximum: 100,
          resistances: combat.zeroResistanceFixture({ Kinetic: 0.25 }),
          degradedThreshold: 70,
          disabledThreshold: 30,
          disabledRecoverability: "Recoverable"
        }]
      });
      const damage = combat.applyDamage(packet, damageable);
      const eventSequence = combat.createCanonicalCombatEventSequence([
        ...fired.events,
        ...advanced.events,
        ...damage.events
      ]);
      const beforeModule = damage.before.modules.find((module) => module.moduleId === packet.moduleId);
      const afterModule = damage.after.modules.find((module) => module.moduleId === packet.moduleId);
      if (beforeModule === undefined || afterModule === undefined) throw new Error("Expected explicit Module damage state.");

      const semantic = {
        scenarioName: "fixed-hybrid-projectile-module-hit" as const,
        modulePath: modulePath as "/src/combat/index.ts",
        ids: {
          weaponId: capability.weaponId,
          targetId: selectedTarget.targetId,
          proxyId: proxy.proxyId,
          moduleId: beforeModule.moduleId,
          projectileId: fired.delivery.projectile.projectileId,
          hitId: advanced.hit.hitId,
          packetId: packet.packetId,
          eventIds: eventSequence.events.map((event) => event.eventId)
        },
        permission: {
          allowed: permission.allowed,
          blockers: permission.blockers,
          primaryReason: permission.primaryReason
        },
        weaponState: {
          before: { ammo: state.ammo, energy: state.energy, heat: state.heat, cooldownSeconds: state.cooldownSeconds, shotSequence: state.shotSequence },
          after: { ammo: fired.state.ammo, energy: fired.state.energy, heat: fired.state.heat, cooldownSeconds: fired.state.cooldownSeconds, shotSequence: fired.state.shotSequence }
        },
        hit: {
          targetEntityId: advanced.hit.targetEntityId,
          proxyId: advanced.hit.proxyId,
          moduleId: advanced.hit.moduleId,
          point: advanced.hit.point,
          distanceMeters: advanced.hit.distanceMeters,
          incomingSpeedMetersPerSecond: advanced.hit.incomingSpeedMetersPerSecond
        },
        damage: {
          armor: { before: damage.before.armor.current, after: damage.after.armor.current, applied: damage.armorDamage },
          hull: { before: damage.before.hull.current, after: damage.after.hull.current, applied: damage.hullDamage },
          module: { before: beforeModule.current, after: afterModule.current, applied: damage.moduleDamage, statusBefore: beforeModule.status, statusAfter: afterModule.status },
          penetratingDamage: damage.penetratingDamage,
          effects: damage.effects
        },
        eventPhaseOrder: eventSequence.events.map((event) => event.phase),
        damageSignature: damage.signature,
        eventSequenceSignature: eventSequence.signature
      };
      const canonicalJson = combat.canonicalCombatJson(semantic);
      return {
        ...semantic,
        canonicalJson,
        scenarioSignature: combat.combatHash(semantic)
      };
    };

    return { first: runScenario(), second: runScenario() };
  });

  const testBridgeAfter = await readTestBridgeState(page);
  expect(testBridgeAfter).toEqual({ ownProperty: false, inWindow: false });
  expect(failures).toEqual({ consoleErrors: [], pageErrors: [], requestFailures: [], httpErrors: [] });

  expect(repeated.second).toEqual(repeated.first);
  expect(repeated.second.canonicalJson).toBe(repeated.first.canonicalJson);
  expect(repeated.second.scenarioSignature).toBe(repeated.first.scenarioSignature);
  expect(repeated.second.ids).toEqual(repeated.first.ids);
  expect(repeated.first.permission).toEqual({ allowed: true, blockers: [], primaryReason: null });
  expect(repeated.first.weaponState).toEqual({
    before: { ammo: 6, energy: 30, heat: 3, cooldownSeconds: 0, shotSequence: 7 },
    after: { ammo: 4, energy: 25, heat: 7, cooldownSeconds: 0.5, shotSequence: 8 }
  });
  expect(repeated.first.hit).toMatchObject({
    targetEntityId: "ship:e2e-target",
    proxyId: "proxy:e2e-target-weapon",
    moduleId: "module:e2e-weapon",
    point: { x: 0, y: 0, z: 97.5 },
    distanceMeters: 97.5,
    incomingSpeedMetersPerSecond: 100
  });
  expect(repeated.first.damage).toEqual({
    armor: { before: 12, after: 0, applied: 12 },
    hull: { before: 100, after: 70.3, applied: 29.7 },
    module: { before: 40, after: 15.25, applied: 24.75, statusBefore: "Degraded", statusAfter: "Disabled" },
    penetratingDamage: 33,
    effects: ["WeaponDisabled"]
  });
  expect(repeated.first.eventPhaseOrder).toEqual(["WeaponFire", "ProjectileSpawned", "Hit", "DamageApplied", "ModuleStateChanged"]);

  expect(repeated.first.scenarioSignature).toBe(PINNED.scenarioSignature);
  expect(repeated.first.eventSequenceSignature).toBe(PINNED.eventSequenceSignature);
  expect(repeated.first.damageSignature).toBe(PINNED.damageSignature);
  expect(repeated.first.ids.projectileId).toBe(PINNED.projectileId);
  expect(repeated.first.ids.hitId).toBe(PINNED.hitId);
  expect(repeated.first.ids.packetId).toBe(PINNED.packetId);
  expect(repeated.first.ids.eventIds).toEqual(PINNED.eventIds);

  const evidence: CombatBrowserEvidence = {
    schemaVersion: "browser-combat-weapon-damage-core-v1",
    status: "PASS",
    generator,
    scenarioName: repeated.first.scenarioName,
    publicModulePath: repeated.first.modulePath,
    normalRoute: {
      path: "/",
      debugSceneVisible: true,
      testBridgeBefore,
      testBridgeAfter
    },
    browserGuards: {
      registeredBeforeNavigation: true,
      faviconRequestHandling: "test-local 204 for the implicit /favicon.ico browser request",
      consoleErrorCount: 0,
      pageErrorCount: 0,
      requestFailureCount: 0,
      nonSuccessHttpResponseCount: 0
    },
    deterministicRepeat: {
      canonicalJsonIdentical: true,
      scenarioSignatureIdentical: true,
      derivedIdsIdentical: true
    },
    pinned: PINNED,
    scenario: repeated.first,
    verification: {
      command: focusedCommand,
      expectedResult: "one focused Playwright test passes and overwrites exactly two deterministic evidence files",
      observedResult: "pass"
    }
  };

  await mkdir(evidenceDir, { recursive: true });
  await writeFile(summaryPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, createMarkdown(evidence), "utf8");
});
