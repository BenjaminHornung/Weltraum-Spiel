import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { afterAll, afterEach, beforeEach, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  const enabled = process.env.FP06_COST_DIAGNOSTICS === "1";
  const rawOutput = process.env.FP06_COST_OUTPUT ?? "";

  type BucketStats = {
    calls: number;
    inclusiveMs: number;
    exclusiveMs: number;
  };
  type StepMetadata = Record<string, number | string | null>;
  type StepSample = {
    testName: string;
    phase: "prepareDryFactoryStep" | "commitDryFactoryStep" | "readDryFactorySupply";
    ordinal: number;
    totalMs: number;
    metadata: StepMetadata;
    exclusiveByBucketMs: Record<string, number>;
    inclusiveByBucketMs: Record<string, number>;
    callsByBucket: Record<string, number>;
  };
  type TestSample = {
    testName: string;
    status: string;
    wallMs: number;
    wrappedTopLevelMs: number;
    unattributedWallMs: number;
    stepCounts: {
      prepareDryFactoryStep: number;
      commitDryFactoryStep: number;
      readDryFactorySupply: number;
    };
    totalsByBucket: Record<string, BucketStats>;
    steps: StepSample[];
  };

  interface StackFrame {
    key: string;
    startMs: number;
    childMs: number;
  }

  let currentTestName = "module_init";
  let currentTestStartMs = 0;
  let currentWrappedTopLevelMs = 0;
  let currentTotals: Record<string, BucketStats> = {};
  let currentSteps: StepSample[] = [];
  let currentStepCounts = {
    prepareDryFactoryStep: 0,
    commitDryFactoryStep: 0,
    readDryFactorySupply: 0
  };

  const callStack: StackFrame[] = [];
  let activeStep: {
    phase: StepSample["phase"];
    ordinal: number;
    startMs: number;
    exclusiveByBucketMs: Record<string, number>;
    inclusiveByBucketMs: Record<string, number>;
    callsByBucket: Record<string, number>;
  } | null = null;

  const globalTotals: Record<string, BucketStats> = {};
  const tests: TestSample[] = [];

  const sumContainerChars = (
    containers:
      | readonly {
          canonicalJson?: string;
          definition?: { canonicalJson?: string };
          state?: { canonicalJson?: string; contents?: readonly unknown[] };
        }[]
      | undefined
  ) => {
    if (!Array.isArray(containers)) return { containerCanonicalChars: null, stackCount: null };
    let containerCanonicalChars = 0;
    let stackCount = 0;
    for (const c of containers) {
      containerCanonicalChars +=
        (c?.canonicalJson?.length ?? 0) +
        (c?.definition?.canonicalJson?.length ?? 0) +
        (c?.state?.canonicalJson?.length ?? 0);
      stackCount += Array.isArray(c?.state?.contents) ? c.state.contents.length : 0;
    }
    return { containerCanonicalChars, stackCount };
  };

  const sumReceiptChars = (
    receipts: readonly { requestCanonicalJson?: string }[] | undefined
  ): number | null => {
    if (!Array.isArray(receipts)) return null;
    let total = 0;
    for (const r of receipts) total += r?.requestCanonicalJson?.length ?? 0;
    return total;
  };

  const extractStepMetadata = (
    phase: StepSample["phase"],
    args: readonly unknown[],
    result: unknown
  ): StepMetadata => {
    if (phase === "readDryFactorySupply") {
      const material = args[1] as {
        revision?: number;
        containers?: readonly {
          canonicalJson?: string;
          definition?: { canonicalJson?: string };
          state?: { canonicalJson?: string; contents?: readonly unknown[] };
        }[];
        receipts?: readonly { requestCanonicalJson?: string }[];
        reservations?: readonly unknown[];
      } | undefined;
      const installed = args[2] as readonly unknown[] | undefined;
      const links = args[3] as readonly unknown[] | undefined;
      const supply = result as {
        canonicalJson?: string;
        authorityBytes?: string;
        ports?: readonly unknown[];
        offers?: readonly unknown[];
      } | undefined;
      const { containerCanonicalChars, stackCount } = sumContainerChars(material?.containers);
      return {
        inMaterialRevision: material?.revision ?? null,
        inContainerCount: Array.isArray(material?.containers) ? material.containers.length : null,
        inStackCount: stackCount,
        inReceiptCount: Array.isArray(material?.receipts) ? material.receipts.length : null,
        inReceiptRequestCanonicalChars: sumReceiptChars(material?.receipts),
        inReservationCount: Array.isArray(material?.reservations) ? material.reservations.length : null,
        inExistingContainerCanonicalChars: containerCanonicalChars,
        inInstalledCount: Array.isArray(installed) ? installed.length : null,
        inLinkCount: Array.isArray(links) ? links.length : null,
        outSupplyCanonicalJsonChars: supply?.canonicalJson?.length ?? null,
        outSupplyAuthorityBytesChars: supply?.authorityBytes?.length ?? null,
        outPortCount: Array.isArray(supply?.ports) ? supply.ports.length : null,
        outOfferCount: Array.isArray(supply?.offers) ? supply.offers.length : null
      };
    }

    if (phase === "prepareDryFactoryStep") {
      const state = args[0] as {
        revision?: number;
        machines?: readonly unknown[];
        belts?: readonly unknown[];
        lastStep?: {
          inputBytes?: string;
          factsBytes?: string;
          nextStateBytes?: string;
          materialBytes?: string;
        } | null;
      } | undefined;
      const input = args[1] as {
        material?: {
          revision?: number;
          containers?: readonly {
            canonicalJson?: string;
            definition?: { canonicalJson?: string };
            state?: { canonicalJson?: string; contents?: readonly unknown[] };
          }[];
          receipts?: readonly { requestCanonicalJson?: string }[];
          reservations?: readonly unknown[];
        };
        supply?: { canonicalJson?: string; authorityBytes?: string };
      } | undefined;
      const proposal = result as {
        status?: string;
        baseStateBytes?: string;
        inputBytes?: string;
        materialBaseBytes?: string;
        state?: {
          revision?: number;
          lastStep?: {
            inputBytes?: string;
            factsBytes?: string;
            nextStateBytes?: string;
            materialBytes?: string;
          } | null;
        };
        material?: {
          revision?: number;
          containers?: readonly unknown[];
          receipts?: readonly { requestCanonicalJson?: string }[];
          reservations?: readonly unknown[];
        };
        power?: { canonicalJson?: string; supplyCanonicalJson?: string };
      } | undefined;
      const { containerCanonicalChars, stackCount } = sumContainerChars(input?.material?.containers);
      return {
        inStateRevision: state?.revision ?? null,
        inMachineCount: Array.isArray(state?.machines) ? state.machines.length : null,
        inBeltCount: Array.isArray(state?.belts) ? state.belts.length : null,
        inPriorLastStepTotalChars: state?.lastStep
          ? (state.lastStep.inputBytes?.length ?? 0) +
            (state.lastStep.factsBytes?.length ?? 0) +
            (state.lastStep.nextStateBytes?.length ?? 0) +
            (state.lastStep.materialBytes?.length ?? 0)
          : 0,
        inMaterialRevision: input?.material?.revision ?? null,
        inContainerCount: Array.isArray(input?.material?.containers) ? input.material.containers.length : null,
        inStackCount: stackCount,
        inReceiptCount: Array.isArray(input?.material?.receipts) ? input.material.receipts.length : null,
        inReceiptRequestCanonicalChars: sumReceiptChars(input?.material?.receipts),
        inReservationCount: Array.isArray(input?.material?.reservations)
          ? input.material.reservations.length
          : null,
        inExistingContainerCanonicalChars: containerCanonicalChars,
        inSupplyCanonicalJsonChars: input?.supply?.canonicalJson?.length ?? null,
        inSupplyAuthorityBytesChars: input?.supply?.authorityBytes?.length ?? null,
        outStatus: proposal?.status ?? null,
        outBaseStateBytesChars: proposal?.baseStateBytes?.length ?? null,
        outInputBytesChars: proposal?.inputBytes?.length ?? null,
        outMaterialBaseBytesChars: proposal?.materialBaseBytes?.length ?? null,
        outNextStateBytesChars: proposal?.state?.lastStep?.nextStateBytes?.length ?? null,
        outFactsBytesChars: proposal?.state?.lastStep?.factsBytes?.length ?? null,
        outMaterialBytesChars: proposal?.state?.lastStep?.materialBytes?.length ?? null,
        outPowerCanonicalJsonChars: proposal?.power?.canonicalJson?.length ?? null,
        outPowerSupplyCanonicalJsonChars: proposal?.power?.supplyCanonicalJson?.length ?? null,
        outMaterialRevision: proposal?.material?.revision ?? null,
        outContainerCount: Array.isArray(proposal?.material?.containers)
          ? proposal.material.containers.length
          : null,
        outReceiptCount: Array.isArray(proposal?.material?.receipts) ? proposal.material.receipts.length : null,
        outReceiptRequestCanonicalChars: sumReceiptChars(proposal?.material?.receipts),
        outReservationCount: Array.isArray(proposal?.material?.reservations)
          ? proposal.material.reservations.length
          : null
      };
    }

    const state = args[0] as { revision?: number } | undefined;
    const input = args[1] as {
      material?: {
        revision?: number;
        containers?: readonly {
          canonicalJson?: string;
          definition?: { canonicalJson?: string };
          state?: { canonicalJson?: string; contents?: readonly unknown[] };
        }[];
        receipts?: readonly { requestCanonicalJson?: string }[];
        reservations?: readonly unknown[];
      };
    } | undefined;
    const proposal = args[2] as {
      status?: string;
      baseStateBytes?: string;
      inputBytes?: string;
      materialBaseBytes?: string;
    } | undefined;
    const committed = result as {
      status?: string;
      state?: {
        revision?: number;
        lastStep?: {
          inputBytes?: string;
          factsBytes?: string;
          nextStateBytes?: string;
          materialBytes?: string;
        } | null;
      };
      material?: {
        revision?: number;
        containers?: readonly unknown[];
        receipts?: readonly { requestCanonicalJson?: string }[];
        reservations?: readonly unknown[];
      };
    } | undefined;
    const { containerCanonicalChars, stackCount } = sumContainerChars(input?.material?.containers);
    return {
      inStateRevision: state?.revision ?? null,
      inMaterialRevision: input?.material?.revision ?? null,
      inContainerCount: Array.isArray(input?.material?.containers) ? input.material.containers.length : null,
      inStackCount: stackCount,
      inReceiptCount: Array.isArray(input?.material?.receipts) ? input.material.receipts.length : null,
      inReceiptRequestCanonicalChars: sumReceiptChars(input?.material?.receipts),
      inReservationCount: Array.isArray(input?.material?.reservations)
        ? input.material.reservations.length
        : null,
      inExistingContainerCanonicalChars: containerCanonicalChars,
      inProposalStatus: proposal?.status ?? null,
      inProposalBaseStateBytesChars: proposal?.baseStateBytes?.length ?? null,
      inProposalInputBytesChars: proposal?.inputBytes?.length ?? null,
      inProposalMaterialBaseBytesChars: proposal?.materialBaseBytes?.length ?? null,
      outStatus: committed?.status ?? null,
      outStateRevision: committed?.state?.revision ?? null,
      outMaterialRevision: committed?.material?.revision ?? null,
      outContainerCount: Array.isArray(committed?.material?.containers)
        ? committed.material.containers.length
        : null,
      outReceiptCount: Array.isArray(committed?.material?.receipts) ? committed.material.receipts.length : null,
      outReceiptRequestCanonicalChars: sumReceiptChars(committed?.material?.receipts),
      outNextStateBytesChars: committed?.state?.lastStep?.nextStateBytes?.length ?? null,
      outMaterialBytesChars: committed?.state?.lastStep?.materialBytes?.length ?? null
    };
  };

  const record = (key: string, inclusiveMs: number, exclusiveMs: number): void => {
    const g = (globalTotals[key] ??= { calls: 0, inclusiveMs: 0, exclusiveMs: 0 });
    g.calls += 1;
    g.inclusiveMs += inclusiveMs;
    g.exclusiveMs += exclusiveMs;

    const t = (currentTotals[key] ??= { calls: 0, inclusiveMs: 0, exclusiveMs: 0 });
    t.calls += 1;
    t.inclusiveMs += inclusiveMs;
    t.exclusiveMs += exclusiveMs;

    if (activeStep) {
      activeStep.callsByBucket[key] = (activeStep.callsByBucket[key] ?? 0) + 1;
      activeStep.inclusiveByBucketMs[key] = (activeStep.inclusiveByBucketMs[key] ?? 0) + inclusiveMs;
      activeStep.exclusiveByBucketMs[key] = (activeStep.exclusiveByBucketMs[key] ?? 0) + exclusiveMs;
    }
  };

  const wrap = <T extends (...args: never[]) => unknown>(
    key: string,
    fn: T,
    stepPhase?: StepSample["phase"]
  ): T => {
    if (!enabled) return fn;
    const wrapped = ((...args: Parameters<T>): ReturnType<T> => {
      const startMs = performance.now();
      const frame: StackFrame = { key, startMs, childMs: 0 };
      const isTopLevel = callStack.length === 0;
      const startedStep =
        stepPhase && !activeStep
          ? (activeStep = {
              phase: stepPhase,
              ordinal: (currentStepCounts[stepPhase] += 1),
              startMs,
              exclusiveByBucketMs: {},
              inclusiveByBucketMs: {},
              callsByBucket: {}
            })
          : null;

      callStack.push(frame);
      let result: unknown;
      try {
        result = fn(...args);
        return result as ReturnType<T>;
      } finally {
        const endMs = performance.now();
        callStack.pop();
        const inclusiveMs = endMs - startMs;
        const exclusiveMs = Math.max(0, inclusiveMs - frame.childMs);
        const parent = callStack.at(-1);
        if (parent) {
          parent.childMs += inclusiveMs;
        } else if (isTopLevel) {
          currentWrappedTopLevelMs += inclusiveMs;
        }
        record(key, inclusiveMs, exclusiveMs);
        if (startedStep && activeStep === startedStep) {
          currentSteps.push({
            testName: currentTestName,
            phase: startedStep.phase,
            ordinal: startedStep.ordinal,
            totalMs: inclusiveMs,
            metadata: extractStepMetadata(startedStep.phase, args, result),
            exclusiveByBucketMs: startedStep.exclusiveByBucketMs,
            inclusiveByBucketMs: startedStep.inclusiveByBucketMs,
            callsByBucket: startedStep.callsByBucket
          });
          activeStep = null;
        }
      }
    }) as T;
    return wrapped;
  };

  const beginTest = (name: string): void => {
    currentTestName = name;
    currentTestStartMs = performance.now();
    currentWrappedTopLevelMs = 0;
    currentTotals = {};
    currentSteps = [];
    currentStepCounts = {
      prepareDryFactoryStep: 0,
      commitDryFactoryStep: 0,
      readDryFactorySupply: 0
    };
  };

  const endTest = (status: string): void => {
    const wallMs = performance.now() - currentTestStartMs;
    tests.push({
      testName: currentTestName,
      status,
      wallMs,
      wrappedTopLevelMs: currentWrappedTopLevelMs,
      unattributedWallMs: Math.max(0, wallMs - currentWrappedTopLevelMs),
      stepCounts: currentStepCounts,
      totalsByBucket: currentTotals,
      steps: currentSteps
    });
  };

  const resolveValidatedOutputPath = (): string => {
    if (!rawOutput.trim()) {
      throw new Error(
        "FP06_COST_OUTPUT is required when FP06_COST_DIAGNOSTICS=1 and must resolve inside evidence/factory/play/2026-10-15/review-continuation/*.json"
      );
    }
    const allowedRoot = resolve(
      process.cwd(),
      "evidence/factory/play/2026-10-15/review-continuation"
    );
    const resolvedOut = resolve(process.cwd(), rawOutput);
    const rel = relative(allowedRoot, resolvedOut);
    if (!rel || rel.startsWith("..") || isAbsolute(rel) || !resolvedOut.endsWith(".json")) {
      throw new Error(
        `FP06_COST_OUTPUT (${rawOutput}) must resolve to a .json file inside ${allowedRoot}`
      );
    }
    if (existsSync(resolvedOut)) {
      throw new Error(`FP06_COST_OUTPUT already exists and will not be overwritten: ${resolvedOut}`);
    }
    return resolvedOut;
  };

  const buildReport = (outputPath: string) => ({
    schema: "hestia.fp06.domain-cost-attribution-diagnostic/v1",
    generatedAtUtc: new Date().toISOString(),
    outputPath,
    notes: {
      exclusiveTiming:
        "Stack-based exclusiveMs subtracts direct wrapped child call durations from each parent frame. InclusiveMs overlaps across parent/child buckets and must not be summed.",
      unattributedWallMs:
        "wallMs minus wrappedTopLevelMs includes test setup, object allocation outside wrapped exports, and Vitest expect matchers; it is NOT exact matcher time.",
      metadataLimitations:
        "Per-step size metadata reads only already-existing canonical strings and array lengths on inputs/outputs. Transient internal canonical strings discarded inside validateDryMaterial (MaterialPlan.baseCanonicalJson), beltReference (BeltStepProposal.baseLineCanonicalJson/inputCanonicalJson/proposalBytes), and productionStep (ProductionProposal intermediate bindings) are not exposed on DryFactoryProposal and are NOT_MEASURED.",
      notMeasuredBoundaries: {
        intraModuleCalls: "NOT_MEASURED",
        reason:
          "ESM intra-module calls (e.g. serializeCanonicalJson/canonicalize inside serialization.ts, local canonicalJson/isImmutableData/validateDryMaterial inside dryFactorySlice.ts, assertView/binding inside reservations.ts, commitFactoryProductionStep internal stepFactoryProduction recomputation inside productionStep.ts, commitFactoryBeltStep internal advanceFactoryBelt recomputation inside beltReference.ts) do not cross module import bindings unless called from an external module.",
        vitestExpectMatcherTime: "NOT_MEASURED",
        internalTransientCanonicalStringSizes: "NOT_MEASURED",
        commitRecomputationNote:
          "Cross-module calls triggered during commitDryFactoryStep/commitFactoryProductionStep/commitFactoryBeltStep/commitFactoryMaterialStep are captured in each commit step's inclusiveByBucketMs and exclusiveByBucketMs; intra-module self-calls remain inside the caller's exclusiveMs."
      }
    },
    globalTotalsByBucket: globalTotals,
    tests
  });

  return { enabled, wrap, beginTest, endTest, resolveValidatedOutputPath, buildReport };
});

vi.mock("../../../src/core/hash", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/core/hash")>();
  if (!harness.enabled) return actual;
  return {
    ...actual,
    fnv1aHash: harness.wrap("hash.fnv1aHash", actual.fnv1aHash)
  };
});

vi.mock("../../../src/resources/serialization", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/resources/serialization")>();
  if (!harness.enabled) return actual;
  return {
    ...actual,
    canonicalizeJsonValue: harness.wrap(
      "serialization.canonicalizeJsonValue",
      actual.canonicalizeJsonValue
    ),
    canonicalJson: harness.wrap("serialization.canonicalJson", actual.canonicalJson),
    canonicalSignature: harness.wrap("serialization.canonicalSignature", actual.canonicalSignature)
  };
});

vi.mock("../../../src/resources/containers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/resources/containers")>();
  if (!harness.enabled) return actual;
  return {
    ...actual,
    createResourceContainerDefinition: harness.wrap(
      "resources.createResourceContainerDefinition",
      actual.createResourceContainerDefinition
    ),
    createResourceContainerState: harness.wrap(
      "resources.createResourceContainerState",
      actual.createResourceContainerState
    ),
    createResourceContainerSnapshot: harness.wrap(
      "resources.createResourceContainerSnapshot",
      actual.createResourceContainerSnapshot
    )
  };
});

vi.mock("../../../src/resources/transfer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/resources/transfer")>();
  if (!harness.enabled) return actual;
  return {
    ...actual,
    transferResource: harness.wrap("resources.transferResource", actual.transferResource)
  };
});

vi.mock("../../../src/factory/catalog/fp02Catalog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/factory/catalog/fp02Catalog")>();
  if (!harness.enabled) return actual;
  return {
    ...actual,
    loadFactoryCatalog: harness.wrap("catalog.loadFactoryCatalog", actual.loadFactoryCatalog),
    createFp02Fixture: harness.wrap("catalog.createFp02Fixture", actual.createFp02Fixture)
  };
});

vi.mock("../../../src/factory/material/resourcesAdapter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/factory/material/resourcesAdapter")>();
  if (!harness.enabled) return actual;
  return {
    ...actual,
    assertExactContainerCapacity: harness.wrap(
      "validation.assertExactContainerCapacity",
      actual.assertExactContainerCapacity
    ),
    assertMaterialSnapshots: harness.wrap(
      "validation.assertMaterialSnapshots",
      actual.assertMaterialSnapshots
    ),
    replaceMaterialContents: harness.wrap(
      "transformation.replaceMaterialContents",
      actual.replaceMaterialContents
    ),
    readMaterialMassMg: harness.wrap("validation.readMaterialMassMg", actual.readMaterialMassMg)
  };
});

vi.mock("../../../src/factory/material/reservations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/factory/material/reservations")>();
  if (!harness.enabled) return actual;
  return {
    ...actual,
    createFactoryMaterialView: harness.wrap(
      "material.createFactoryMaterialView",
      actual.createFactoryMaterialView
    ),
    prepareFactoryMaterialStep: harness.wrap(
      "material.prepareFactoryMaterialStep",
      actual.prepareFactoryMaterialStep
    ),
    commitFactoryMaterialStep: harness.wrap(
      "material.commitFactoryMaterialStep",
      actual.commitFactoryMaterialStep
    )
  };
});

vi.mock("../../../src/factory/power/sourceAdapter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/factory/power/sourceAdapter")>();
  if (!harness.enabled) return actual;
  return {
    ...actual,
    prepareFactoryPowerSources: harness.wrap(
      "power.prepareFactoryPowerSources",
      actual.prepareFactoryPowerSources
    )
  };
});

vi.mock("../../../src/factory/power/factoryPower", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/factory/power/factoryPower")>();
  if (!harness.enabled) return actual;
  return {
    ...actual,
    stepFactoryPower: harness.wrap("power.stepFactoryPower", actual.stepFactoryPower)
  };
});

vi.mock("../../../src/factory/production/recipeAdmission", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/factory/production/recipeAdmission")>();
  if (!harness.enabled) return actual;
  return {
    ...actual,
    isImmutableProductionData: harness.wrap(
      "validation.isImmutableProductionData",
      actual.isImmutableProductionData
    ),
    productionMaterialCanonicalJson: harness.wrap(
      "serialization.productionMaterialCanonicalJson",
      actual.productionMaterialCanonicalJson
    ),
    admitFactoryRecipe: harness.wrap("validation.admitFactoryRecipe", actual.admitFactoryRecipe)
  };
});

vi.mock("../../../src/factory/production/productionStep", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/factory/production/productionStep")>();
  if (!harness.enabled) return actual;
  return {
    ...actual,
    createFactoryProductionState: harness.wrap(
      "production.createFactoryProductionState",
      actual.createFactoryProductionState
    ),
    readFactoryProductionRequest: harness.wrap(
      "production.readFactoryProductionRequest",
      actual.readFactoryProductionRequest
    ),
    stepFactoryProduction: harness.wrap(
      "production.stepFactoryProduction",
      actual.stepFactoryProduction
    ),
    commitFactoryProductionStep: harness.wrap(
      "production.commitFactoryProductionStep",
      actual.commitFactoryProductionStep
    )
  };
});

vi.mock("../../../src/factory/conveyor/beltReference", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/factory/conveyor/beltReference")>();
  if (!harness.enabled) return actual;
  return {
    ...actual,
    assertFactoryBeltState: harness.wrap(
      "validation.assertFactoryBeltState",
      actual.assertFactoryBeltState
    ),
    advanceFactoryBelt: harness.wrap("conveyor.advanceFactoryBelt", actual.advanceFactoryBelt),
    commitFactoryBeltStep: harness.wrap("conveyor.commitFactoryBeltStep", actual.commitFactoryBeltStep)
  };
});

vi.mock("../../../src/factory/construction/placement", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/factory/construction/placement")>();
  if (!harness.enabled) return actual;
  return {
    ...actual,
    factoryMaterialBytes: harness.wrap("serialization.factoryMaterialBytes", actual.factoryMaterialBytes),
    prepareFactoryPlacement: harness.wrap(
      "construction.prepareFactoryPlacement",
      actual.prepareFactoryPlacement
    )
  };
});

vi.mock("../../../src/factory/session/dryFactorySlice", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/factory/session/dryFactorySlice")>();
  if (!harness.enabled) return actual;
  return {
    ...actual,
    adoptDryFactoryBelt: harness.wrap("dry.adoptDryFactoryBelt", actual.adoptDryFactoryBelt),
    readDryFactoryBeltPort: harness.wrap("dry.readDryFactoryBeltPort", actual.readDryFactoryBeltPort),
    readDryFactorySupply: harness.wrap(
      "dry.readDryFactorySupply",
      actual.readDryFactorySupply,
      "readDryFactorySupply"
    ),
    reconcileDryFactoryInstallations: harness.wrap(
      "dry.reconcileDryFactoryInstallations",
      actual.reconcileDryFactoryInstallations
    ),
    prepareDryFactoryStep: harness.wrap(
      "dry.prepareDryFactoryStep",
      actual.prepareDryFactoryStep,
      "prepareDryFactoryStep"
    ),
    commitDryFactoryStep: harness.wrap(
      "dry.commitDryFactoryStep",
      actual.commitDryFactoryStep,
      "commitDryFactoryStep"
    )
  };
});

if (!harness.enabled) {
  it.skip("FP06 domain cost attribution diagnostic (requires FP06_COST_DIAGNOSTICS=1 and FP06_COST_OUTPUT)", () => {});
} else {
  const validatedOutPath = harness.resolveValidatedOutputPath();

  beforeEach((context) => {
    harness.beginTest(context.task.name);
  });

  afterEach((context) => {
    harness.endTest(context.task.result?.state ?? "unknown");
  });

  afterAll(() => {
    mkdirSync(dirname(validatedOutPath), { recursive: true });
    writeFileSync(
      validatedOutPath,
      `${JSON.stringify(harness.buildReport(validatedOutPath), null, 2)}\n`,
      { encoding: "utf8", flag: "wx" }
    );
  });

  await import("./dryFactorySlice.test");
}
