import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type AdaptiveDomain = typeof import("../../src/voxel/adaptive/index");

const evidenceDirectory = path.resolve(process.cwd(), "evidence");
const summaryPath = path.join(evidenceDirectory, "browser-adaptive-microvoxel-authority-v1-summary.json");
const markdownPath = path.join(evidenceDirectory, "browser-adaptive-microvoxel-authority-v1.md");

interface BrowserErrors {
  readonly console: readonly string[];
  readonly page: readonly string[];
  readonly request: readonly string[];
  readonly http: readonly string[];
}

interface Obligation {
  readonly id: string;
  readonly status: "PASS";
  readonly details: string;
}

interface AuthorityEvidence {
  readonly schemaVersion: "browser-adaptive-microvoxel-authority-v1";
  readonly status: "PASS";
  readonly generator: "apps/weltraum-browser/tests/e2e/adaptive-microvoxel-authority.spec.ts";
  readonly route: "/";
  readonly proofScope: "pure-core-browser-proof";
  readonly visualUiChange: false;
  readonly testBridge: { readonly ownProperty: false; readonly inWindow: false };
  readonly obligations: readonly Obligation[];
  readonly observations: Readonly<Record<string, unknown>>;
  readonly browserErrors: BrowserErrors;
  readonly excludedClaims: readonly ["renderer", "streaming", "worker", "TestBridge-integration"];
}

const collectBrowserErrors = (page: Page): { console: string[]; page: string[]; request: string[]; http: string[] } => {
  const errors = { console: [] as string[], page: [] as string[], request: [] as string[], http: [] as string[] };
  page.on("console", (message) => {
    if (message.type() === "error") errors.console.push(message.text());
  });
  page.on("pageerror", (error) => errors.page.push(error.message));
  page.on("requestfailed", (request) => {
    errors.request.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? "unknown"}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) errors.http.push(`${response.status()} ${response.request().method()} ${response.url()}`);
  });
  return errors;
};

const createMarkdown = (evidence: AuthorityEvidence): string => {
  const obligationRows = evidence.obligations
    .map((entry) => `| ${entry.id} | ${entry.status} | ${entry.details} |`)
    .join("\n");
  return `# Browser Adaptive Microvoxel Authority V1 Evidence

This timestamp-free artifact is generated from the same in-memory result as the JSON summary.

## Result

- Status: **${evidence.status}**
- Route: \`${evidence.route}\`
- Scope: \`${evidence.proofScope}\`
- TestBridge absent: \`true\`
- Visual UI change: \`${evidence.visualUiChange}\`
- Browser console/page/request/HTTP errors: \`${evidence.browserErrors.console.length}/${evidence.browserErrors.page.length}/${evidence.browserErrors.request.length}/${evidence.browserErrors.http.length}\`
- Excluded claims: ${evidence.excludedClaims.map((claim) => `\`${claim}\``).join(", ")}

This is pure-core protocol proof executed inside Chromium on the normal application route. It does not claim renderer, worker, streaming, TestBridge, gameplay, or visual-product integration, and no screenshot is required because there is no visual UI change.

## Obligations

| ID | Status | Deterministic detail |
| --- | --- | --- |
${obligationRows}

## Stable observations

\`\`\`json
${JSON.stringify(evidence.observations, null, 2)}
\`\`\`
`;
};

test("normal Chromium route exhaustively proves adaptive microvoxel authority V1", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(new URL(page.url()).pathname).toBe("/");

  const testBridge = await page.evaluate(() => ({
    ownProperty: Object.prototype.hasOwnProperty.call(window, "TestBridge"),
    inWindow: "TestBridge" in window
  }));
  expect(testBridge).toEqual({ ownProperty: false, inWindow: false });

  const evidence = await page.evaluate<AuthorityEvidence>(async () => {
    const modulePath = String("/src/voxel/adaptive/index.ts");
    const domain = (await import(/* @vite-ignore */ modulePath)) as AdaptiveDomain;
    const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const equal = (left: unknown, right: unknown): boolean =>
      domain.canonicalAdaptiveJson(left) === domain.canonicalAdaptiveJson(right);
    const expectAuthorityError = (action: () => unknown, pathIncludes?: string): string => {
      try {
        action();
      } catch (error) {
        assert(error instanceof domain.AdaptiveAuthorityError, "Expected AdaptiveAuthorityError.");
        if (pathIncludes !== undefined) assert(error.path.includes(pathIncludes), `Expected error path containing ${pathIncludes}.`);
        return `${error.code}:${error.path}`;
      }
      throw new Error("Expected authority input to fail closed.");
    };
    const keyId = (key: import("../../src/voxel/adaptive/index").AdaptiveBrickKey): string => domain.serializeAdaptiveKey(key);
    const hashPattern = /^fnv1a64-v1:[0-9a-f]{16}$/;

    const bodyId = domain.stableAuthorityId("planet.test");
    const surfaceFrameId = domain.stableAuthorityId("frame.surface");
    const regionId = domain.stableAuthorityId("region.test");
    const generatorVersion = domain.stableAuthorityId("generator.v1");
    const makeKey = (level: number, x = 0, y = 0, z = 0) => domain.createAdaptiveBrickKey({
      bodyId, surfaceFrameId, regionId, generatorVersion, level, originQuantum: { x, y, z }
    });

    const extents = domain.ADAPTIVE_LEVELS.map((levelValue) => {
      const level = domain.adaptiveLevel(levelValue);
      const extentQuantum = domain.brickExtentQuantumForLevel(level);
      const candidate = makeKey(level, -extentQuantum, 0, 0);
      const bounds = domain.quantumBoundsForKey(candidate);
      const children = domain.childrenOf(candidate);
      assert(bounds.max.x - bounds.min.x === extentQuantum, `L${level} extent mismatch.`);
      assert(domain.containsQuantumCoordinate(candidate, bounds.min), `L${level} minimum must be included.`);
      assert(!domain.containsQuantumCoordinate(candidate, bounds.max), `L${level} maximum must be excluded.`);
      assert(level === 4 ? children.length === 0 : children.length === 8, `L${level} child count mismatch.`);
      if (children.length > 0) {
        assert(new Set(children.map(keyId)).size === 8, `L${level} children must be unique.`);
        assert(children.every((child) => keyId(domain.parentOf(child)!) === keyId(candidate)), `L${level} ancestry mismatch.`);
        const childVolume = children.reduce((sum, child) => {
          const childBounds = domain.quantumBoundsForKey(child);
          return sum + (childBounds.max.x - childBounds.min.x)
            * (childBounds.max.y - childBounds.min.y)
            * (childBounds.max.z - childBounds.min.z);
        }, 0);
        assert(childVolume === extentQuantum ** 3, `L${level} children must exactly partition the parent.`);
      }
      return { level, cellSizeMeters: domain.cellSizeMetersForLevel(level), extentQuantum, childCount: children.length };
    });
    assert(equal(extents, [
      { level: 0, cellSizeMeters: 2, extentQuantum: 256, childCount: 8 },
      { level: 1, cellSizeMeters: 1, extentQuantum: 128, childCount: 8 },
      { level: 2, cellSizeMeters: 0.5, extentQuantum: 64, childCount: 8 },
      { level: 3, cellSizeMeters: 0.25, extentQuantum: 32, childCount: 8 },
      { level: 4, cellSizeMeters: 0.125, extentQuantum: 16, childCount: 0 }
    ]), "L0-L4 ladder changed.");
    assert(domain.keyFromGlobalQuantum(bodyId, surfaceFrameId, regionId, generatorVersion, 2, { x: -1, y: 0, z: 0 }).originQuantum.x === -64, "Negative floor alignment changed.");
    const coordinateRejections = [
      expectAuthorityError(() => makeKey(2, 1)),
      expectAuthorityError(() => domain.globalQuantumCoordinate(Number.MAX_SAFE_INTEGER + 1)),
      expectAuthorityError(() => domain.keyFromGlobalQuantum(bodyId, surfaceFrameId, regionId, generatorVersion, 4, { x: -0, y: 0, z: 0 })),
      expectAuthorityError(() => makeKey(4, -9_007_199_254_740_976))
    ].sort();

    const baseField = domain.createAdaptiveBaseFieldDescriptor({
      kind: "constant-v1",
      identity: domain.stableAuthorityId("base.test"),
      version: domain.stableAuthorityId("base.v1"),
      sourceRevision: domain.authorityRevision(1),
      sample: { density: 0, occupancy: 1, materialId: domain.stableAuthorityId("material.rock") }
    });
    assert(domain.isDeepFrozen(baseField) && domain.isDeepFrozen(baseField.sample), "Descriptor must be deeply frozen.");
    const emptyJournal = domain.createAdaptiveEditJournal([]);
    const targetKey = makeKey(4);
    const original = domain.materializeAdaptiveBrick({ key: targetKey, baseField, editJournal: emptyJournal });
    const descriptorVariants = [
      domain.createAdaptiveBaseFieldDescriptor({ ...baseField, identity: domain.stableAuthorityId("base.other") }),
      domain.createAdaptiveBaseFieldDescriptor({ ...baseField, version: domain.stableAuthorityId("base.v2") }),
      domain.createAdaptiveBaseFieldDescriptor({ ...baseField, sourceRevision: domain.authorityRevision(2) }),
      domain.createAdaptiveBaseFieldDescriptor({ ...baseField, sample: { ...baseField.sample, density: 0.25 } })
    ];
    const varied = descriptorVariants.map((descriptor) => domain.materializeAdaptiveBrick({ key: targetKey, baseField: descriptor, editJournal: emptyJournal }));
    assert(new Set([original.baseFieldDescriptorDigest, ...varied.map((brick) => brick.baseFieldDescriptorDigest)]).size === 5, "Every descriptor field must alter its digest.");
    assert(new Set([original.contentHash, ...varied.map((brick) => brick.contentHash)]).size === 5, "Every descriptor field must alter content authority.");
    assert(new Set([original.provenance.provenanceHash, ...varied.map((brick) => brick.provenance.provenanceHash)]).size === 5, "Every descriptor field must alter provenance.");
    const descriptorBefore = domain.canonicalAdaptiveJson(baseField);
    assert(domain.canonicalAdaptiveJson(baseField) === descriptorBefore && domain.isDeepFrozen(original), "Materialization mutated immutable inputs.");
    const descriptorRejections = [
      expectAuthorityError(() => domain.validateAdaptiveBaseFieldDescriptor({ ...baseField, kind: "procedural-v1" } as never)),
      expectAuthorityError(() => domain.validateAdaptiveBaseFieldDescriptor({ ...baseField, sample: () => baseField.sample } as never)),
      expectAuthorityError(() => domain.validateAdaptiveBaseFieldDescriptor({ ...baseField, sample: { ...baseField.sample, density: Number.NaN } } as never)),
      expectAuthorityError(() => domain.materializeAdaptiveBrick({ key: targetKey, baseField: undefined as never, editJournal: emptyJournal }))
    ].sort();

    const firstJournal = domain.createAdaptiveEditJournal([{
      editId: "edit.1", sequence: 1, expectedRegionRevision: 0, resultRegionRevision: 1,
      actorId: "actor.test", sourceId: "tool.test", operation: "AddBox",
      box: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } }
    }]);
    const secondJournal = domain.createAdaptiveEditJournal([
      firstJournal.records[0],
      { editId: "edit.2", sequence: 2, expectedRegionRevision: 1, resultRegionRevision: 2,
        actorId: "actor.test", sourceId: "tool.test", operation: "SubtractBox",
        box: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } } }
    ]);
    assert(firstJournal.records.length === 1 && secondJournal.records.length === 2, "Journal append snapshot changed prior records.");
    assert(domain.isDeepFrozen(firstJournal) && domain.isDeepFrozen(secondJournal), "Journal snapshots must be immutable.");
    const addSubtract = domain.materializeAdaptiveBrick({ key: targetKey, baseField, editJournal: secondJournal });
    const subtractAdd = domain.materializeAdaptiveBrick({ key: targetKey, baseField, editJournal: domain.createAdaptiveEditJournal([
      { ...firstJournal.records[0], operation: "SubtractBox" },
      { ...secondJournal.records[1], operation: "AddBox" }
    ]) });
    assert(addSubtract.occupancy[0] === 0 && subtractAdd.occupancy[0] === 1, "Edit sequence must be authoritative.");
    const editRejections = [
      expectAuthorityError(() => domain.createAdaptiveEditJournal([firstJournal.records[0], { ...secondJournal.records[1], editId: "edit.1" }])),
      expectAuthorityError(() => domain.createAdaptiveEditJournal([{ ...firstJournal.records[0], sequence: 2 }])),
      expectAuthorityError(() => domain.createAdaptiveEditJournal([{ ...firstJournal.records[0], box: { min: { x: 1, y: 0, z: 0 }, max: { x: 0, y: 1, z: 1 } } }])),
      expectAuthorityError(() => domain.createAdaptiveEditJournal([({ ...firstJournal.records[0], operation: "SubtractSphere", box: undefined, sphere: { center: { x: 0, y: 0, z: 0 }, radiusQuantum: Number.NaN } } as never)]))
    ].sort();
    const identityRejections = ["", " bad ", "x".repeat(257), "id.\ud800", "id.\udc00"]
      .map((value) => expectAuthorityError(() => domain.stableAuthorityId(value)))
      .sort();

    const abaB = domain.materializeAdaptiveBrick({ key: targetKey, baseField, editJournal: secondJournal });
    const abaA2 = domain.materializeAdaptiveBrick({ key: targetKey, baseField, editJournal: emptyJournal });
    assert(domain.serializeMaterializedAdaptiveBrick(original) === domain.serializeMaterializedAdaptiveBrick(abaA2), "A-B-A canonical bytes changed.");
    assert(original.contentHash === abaA2.contentHash && original.provenance.provenanceHash === abaA2.provenance.provenanceHash, "A-B-A authority hashes changed.");
    assert(original.contentHash !== abaB.contentHash, "Journal variation did not alter materialized authority.");

    const parent = makeKey(2);
    const fine = domain.childrenOf(parent).flatMap((entry) => domain.childrenOf(entry));
    assert(fine.length === 64, "L2 to L4 expansion must produce 64 keys.");
    const request: import("../../src/voxel/adaptive/index").AdaptivePlanRequest = {
      requestId: domain.stableAuthorityId("request.explosion"),
      region: { kind: "aabb", bounds: domain.quantumBoundsForKey(parent) },
      targetLevel: domain.adaptiveLevel(4), reason: "Explosion", requiredForCoverage: true, priority: 10
    };
    const budgets = {
      maxBricks: 4_096,
      maxBytes: Number.MAX_SAFE_INTEGER,
      maxWork: Number.MAX_SAFE_INTEGER,
      maxCoverageQuantum: Number.MAX_SAFE_INTEGER
    };
    const plannerBrickRevision = domain.authorityRevision(0);
    const brickCache = new Map<string, ReturnType<typeof domain.materializeAdaptiveBrick>>([[keyId(targetKey), original]]);
    const brickFor = (key: typeof parent) => {
      const id = keyId(key);
      const cached = brickCache.get(id);
      if (cached !== undefined) return cached;
      const brick = domain.materializeAdaptiveBrick({ key, baseField, editJournal: emptyJournal });
      brickCache.set(id, brick);
      return brick;
    };
    type Readiness = import("../../src/voxel/adaptive/index").AdaptiveReadiness;
    const residentSummary = (key: typeof parent, readiness: Readiness = "ready") => {
      const brick = brickFor(key);
      return {
        key, readiness,
        byteSize: domain.ADAPTIVE_BRICK_ESTIMATED_BYTES,
        work: domain.ADAPTIVE_BRICK_ESTIMATED_WORK,
        contentHash: brick.contentHash,
        provenanceHash: brick.provenance.provenanceHash,
        baseFieldDescriptorDigest: brick.baseFieldDescriptorDigest,
        journalDigest: brick.provenance.journalDigest,
        sourceRevision: brick.sourceRevision,
        editRevision: brick.editRevision,
        brickRevision: plannerBrickRevision
      };
    };
    const snapshot = (
      seeds: readonly { readonly key: typeof parent; readonly readiness?: Readiness }[],
      requests: readonly import("../../src/voxel/adaptive/index").AdaptivePlanRequest[] = [request],
      budgetValues = budgets
    ): import("../../src/voxel/adaptive/index").AdaptivePlannerSnapshot => {
      const summaries = seeds.map((seed) => residentSummary(seed.key, seed.readiness));
      const draft: import("../../src/voxel/adaptive/index").AdaptivePlannerSnapshot = {
        schemaVersion: "adaptive-microvoxel-planner-snapshot-v1",
        bodyId, surfaceFrameId, regionId, generatorVersion,
        authority: { schemaVersion: "adaptive-microvoxel-planner-authority-v1", baseField, editJournal: emptyJournal, brickRevision: plannerBrickRevision },
        planningEpoch: domain.authorityRevision(7), resident: summaries, activeCoverage: [], refinementRequests: requests, budgets: budgetValues
      };
      const ready = summaries.filter((entry) => entry.readiness === "ready");
      const proofs = domain.createAdaptiveResidentValidationProofs({ bricks: ready.map((entry) => brickFor(entry.key)), brickRevision: plannerBrickRevision, snapshot: draft });
      let proofIndex = 0;
      return { ...draft, resident: summaries.map((entry) => entry.readiness === "ready" ? { ...entry, validationProof: proofs[proofIndex++] } : entry) };
    };

    const requestedSnapshot = snapshot([]);
    const accepted = domain.planAdaptiveMicrovoxels({ snapshot: requestedSnapshot });
    assert(accepted.status === "accepted" && accepted.desired.length === 64 && accepted.materialize.length === 64, "Required request set changed.");
    const parentSnapshot = snapshot([{ key: parent }]);
    const fallback = domain.planAdaptiveMicrovoxels({ snapshot: parentSnapshot });
    const partial = domain.planAdaptiveMicrovoxels({ snapshot: snapshot([{ key: parent }, ...fine.slice(0, -1).map((key) => ({ key }))]) });
    const complete = domain.planAdaptiveMicrovoxels({ snapshot: snapshot([{ key: parent }, ...fine.map((key) => ({ key }))]) });
    assert(fallback.coverage.length === 1 && fallback.coverage[0].kind === "fallback" && fallback.materialize.length === 64, "Initial fallback semantics changed.");
    assert(partial.coverage.length === 1 && partial.coverage[0].kind === "fallback" && partial.materialize.length === 1, "Partial fallback must remain atomic.");
    assert(complete.coverage.length === 64 && complete.coverage.every((entry) => entry.kind === "selected") && complete.fallback.length === 0, "Complete selected coverage changed.");
    const selectedVolume = complete.coverage.reduce((sum, entry) => sum
      + (entry.bounds.max.x - entry.bounds.min.x) * (entry.bounds.max.y - entry.bounds.min.y) * (entry.bounds.max.z - entry.bounds.min.z), 0);
    assert(selectedVolume === 64 ** 3 && new Set(complete.coverage.map((entry) => keyId(entry.key))).size === 64, "Selected coverage must be exact and non-overlapping.");
    const optionalRequest = { ...request, requestId: domain.stableAuthorityId("request.optional"), requiredForCoverage: false };
    const optional = domain.planAdaptiveMicrovoxels({ snapshot: snapshot([], [optionalRequest]) });
    assert(optional.coverageStatus.complete && optional.coverageStatus.uncoveredRequiredKeyCount === 0 && optional.materialize.length === 64, "Optional request semantics changed.");
    const cancelled = domain.planAdaptiveMicrovoxels({ snapshot: snapshot([{ key: parent, readiness: "cancelled" }]) });
    assert(cancelled.coverage.length === 0 && cancelled.materialize.length === 64, "Cancelled residency gained coverage authority.");

    const rejected = domain.planAdaptiveMicrovoxels({ snapshot: snapshot([], [request], { ...budgets, maxBricks: 0 }) });
    assert(rejected.status === "rejected", "Expected deterministic brick budget rejection.");
    assert([rejected.desired, rejected.keep, rejected.materialize, rejected.evict, rejected.fallback, rejected.coverage].every((entries) => entries.length === 0), "Rejected plan leaked side effects.");
    const proof = parentSnapshot.resident[0].validationProof!;
    assert(domain.isDeepFrozen(proof) && hashPattern.test(proof.proofDigest), "Constructor proof must be immutable and hashed.");
    assert(proof.snapshotProjectionDigest === fallback.snapshotProjectionDigest, "Proof snapshot binding changed.");
    const validProofAccepted = fallback.status === "accepted" && fallback.coverage.length === 1;
    assert(validProofAccepted, "Constructor-issued proof was not accepted.");
    const proofRejections = [
      expectAuthorityError(() => domain.planAdaptiveMicrovoxels({ snapshot: { ...parentSnapshot, planningEpoch: domain.authorityRevision(8) } }), "validationProof"),
      expectAuthorityError(() => domain.planAdaptiveMicrovoxels({ snapshot: { ...parentSnapshot, budgets: { ...budgets, maxBricks: 4_095 } } }), "validationProof"),
      expectAuthorityError(() => domain.planAdaptiveMicrovoxels({ snapshot: { ...parentSnapshot, authority: { ...parentSnapshot.authority, baseField: descriptorVariants[0] } } }), "validationProof"),
      expectAuthorityError(() => domain.planAdaptiveMicrovoxels({ snapshot: { ...parentSnapshot, resident: [{ ...parentSnapshot.resident[0], key: makeKey(2, 64) }] } }), "validationProof"),
      expectAuthorityError(() => domain.planAdaptiveMicrovoxels({ snapshot: { ...parentSnapshot, resident: [{ ...parentSnapshot.resident[0], brickRevision: domain.authorityRevision(1) }] } }), "validationProof"),
      expectAuthorityError(() => domain.planAdaptiveMicrovoxels({ snapshot: { ...parentSnapshot, resident: [{ ...parentSnapshot.resident[0], validationProof: JSON.parse(domain.canonicalAdaptiveJson(proof)) }] } }), "validationProof"),
      expectAuthorityError(() => domain.planAdaptiveMicrovoxels({ snapshot: { ...parentSnapshot, resident: [{ ...parentSnapshot.resident[0], validationProof: { ...proof, proofDigest: domain.hashAdaptiveCanonical({ tampered: true }) } }] } }), "validationProof")
    ].sort();
    const malformedRequest = { ...request, reason: "NotAReason" as never };
    const proofFirstPath = expectAuthorityError(() => domain.planAdaptiveMicrovoxels({ snapshot: {
      ...parentSnapshot,
      refinementRequests: [malformedRequest],
      resident: [{ ...parentSnapshot.resident[0], validationProof: { ...proof, proofDigest: domain.hashAdaptiveCanonical({ tampered: true }) } }]
    } }), "validationProof");

    const authority = domain.createAdaptiveAuthorityRetention({ baseField, editJournal: secondJournal });
    const releaseChild = fine[0];
    const beforeRelease = domain.materializeAdaptiveBrick({ key: releaseChild, baseField, editJournal: secondJournal });
    const collapse = domain.releaseAdaptiveResidency([parent, releaseChild], [releaseChild], "collapse", authority);
    const collapsedReload = domain.materializeAdaptiveBrick({ key: releaseChild, baseField: collapse.authority.baseField, editJournal: collapse.authority.editJournal });
    assert(collapse.authorityRetained && equal(collapse.residentKeys, [parent]) && collapsedReload.contentHash === beforeRelease.contentHash, "Collapse lost authority.");
    const evicted = domain.releaseAdaptiveResidency([releaseChild], [releaseChild], "evict", authority);
    const evictedAgain = domain.releaseAdaptiveResidency(evicted.residentKeys, [releaseChild], "evict", evicted.authority);
    const evictedReload = domain.materializeAdaptiveBrick({ key: releaseChild, baseField: evictedAgain.authority.baseField, editJournal: evictedAgain.authority.editJournal });
    assert(evicted.releasedKeys.length === 1 && evictedAgain.releasedKeys.length === 0 && equal(evictedReload, beforeRelease), "Eviction must be idempotent and lossless.");

    const vectorKey = domain.createAdaptiveBrickKey({
      bodyId: 'planet.ä"north', surfaceFrameId: "frame.surface", regionId: "region.岩", generatorVersion: "generator.v1",
      level: 4, originQuantum: { x: -16, y: 16, z: -32 }
    });
    const vectorProvider = domain.createAdaptiveBaseFieldDescriptor({
      kind: "constant-v1", identity: domain.stableAuthorityId('base.é"constant'), version: domain.stableAuthorityId("base.v1"),
      sourceRevision: domain.authorityRevision(3),
      sample: { density: -0.25, occupancy: 1, materialId: domain.stableAuthorityId("material.岩"), semanticId: domain.stableAuthorityId("semantic.é") }
    });
    const vectorJournal = domain.createAdaptiveEditJournal([{
      editId: 'edit.é"paint', sequence: 1, expectedRegionRevision: 0, resultRegionRevision: 1,
      actorId: "actor.ä", sourceId: "tool.\\path", operation: "SetMaterialBox",
      box: { min: { x: -16, y: 16, z: -32 }, max: { x: -14, y: 18, z: -30 } },
      materialId: "material.铜", semanticId: 'semantic."cut'
    }]);
    const canonicalVectors = {
      key: { byteLength: new TextEncoder().encode(domain.serializeAdaptiveKey(vectorKey)).length, canonicalHash: domain.hashAdaptiveCanonical(vectorKey) },
      descriptor: { byteLength: new TextEncoder().encode(domain.canonicalAdaptiveJson(vectorProvider)).length, canonicalHash: domain.hashAdaptiveCanonical(vectorProvider), descriptorDigest: domain.hashAdaptiveBaseFieldDescriptor(vectorProvider) },
      journal: { byteLength: new TextEncoder().encode(domain.serializeAdaptiveEditJournal(vectorJournal)).length, digest: vectorJournal.digest, canonicalHash: domain.hashAdaptiveCanonical(vectorJournal) },
      materialized: { contentHash: brickFor(parent).contentHash, provenanceHash: brickFor(parent).provenance.provenanceHash },
      snapshot: { acceptedDigest: accepted.snapshotProjectionDigest, proofDigest: proof.snapshotProjectionDigest, rejectedDigest: rejected.snapshotProjectionDigest },
      proof: { contentHash: proof.contentHash, provenanceHash: proof.provenanceHash, descriptorDigest: proof.baseFieldDescriptorDigest, journalDigest: proof.journalDigest, proofDigest: proof.proofDigest },
      accepted: { planHash: accepted.planHash, desiredCount: accepted.desired.length, materializeCount: accepted.materialize.length, uncoveredRequiredKeyCount: accepted.coverageStatus.uncoveredRequiredKeyCount },
      rejected: { planHash: rejected.planHash, budget: rejected.status === "rejected" ? rejected.budget : "", required: rejected.status === "rejected" ? rejected.required : -1, limit: rejected.status === "rejected" ? rejected.limit : -1 }
    };
    const pinned = {
      key: { canonicalHash: "fnv1a64-v1:69a1fd51ba189b76" },
      descriptor: { canonicalHash: "fnv1a64-v1:fbe25906701bf507", descriptorDigest: "fnv1a64-v1:d35f808b2c5eee48" },
      journal: { digest: "fnv1a64-v1:c8c7dc4baf7edc73", canonicalHash: "fnv1a64-v1:b827d6f7d538d9f7" },
      materialized: { contentHash: "fnv1a64-v1:6fa95b9c11f2b5f6", provenanceHash: "fnv1a64-v1:52acc30fb9b5da37" },
      snapshot: { acceptedDigest: "fnv1a64-v1:a4742926bffe485b", proofDigest: "fnv1a64-v1:a756afcc8e9eb4cf", rejectedDigest: "fnv1a64-v1:2d171393565cf1be" },
      proof: { contentHash: "fnv1a64-v1:6fa95b9c11f2b5f6", provenanceHash: "fnv1a64-v1:52acc30fb9b5da37", descriptorDigest: "fnv1a64-v1:e37982c711163a94", journalDigest: "fnv1a64-v1:4144927f889a3178", proofDigest: "fnv1a64-v1:7ff499bc651aab0e" },
      accepted: { planHash: "fnv1a64-v1:29d23cf307090000", desiredCount: 64, materializeCount: 64, uncoveredRequiredKeyCount: 64 },
      rejected: { planHash: "fnv1a64-v1:0c86d956b8677bce", budget: "brick-count", required: 64, limit: 0 }
    };
    for (const [name, expected] of Object.entries(pinned)) {
      const actual = canonicalVectors[name as keyof typeof canonicalVectors] as Record<string, unknown>;
      for (const [field, expectedValue] of Object.entries(expected)) assert(actual[field] === expectedValue, `${name}.${field} pinned vector changed.`);
    }

    const obligations: Obligation[] = [
      { id: "AMV-BROWSER-01", status: "PASS", details: "L0-L4 quantum ladder, negative alignment, safe bounds, ancestry, and half-open extents verified." },
      { id: "AMV-BROWSER-02", status: "PASS", details: "Every non-leaf parent has eight unique children that exactly partition its volume." },
      { id: "AMV-BROWSER-03", status: "PASS", details: "Invalid alignment, negative zero, unsafe numbers, and ancestry-unsafe coordinates fail closed." },
      { id: "AMV-BROWSER-04", status: "PASS", details: "Stable IDs reject empty, untrimmed, oversized, and unpaired-surrogate identities." },
      { id: "AMV-BROWSER-05", status: "PASS", details: "Only deeply frozen constant-v1 descriptor data is accepted; callback and malformed shapes fail closed." },
      { id: "AMV-BROWSER-06", status: "PASS", details: "Identity, version, revision, and sample variations change descriptor, content, and provenance authority." },
      { id: "AMV-BROWSER-07", status: "PASS", details: "Ordered edits apply exactly once and immutable journal snapshots preserve prior values." },
      { id: "AMV-BROWSER-08", status: "PASS", details: "Duplicate, gapped, malformed-coordinate, and non-finite edits fail closed." },
      { id: "AMV-BROWSER-09", status: "PASS", details: "A-B-A rematerialization restores exact canonical bytes, content hash, and provenance hash." },
      { id: "AMV-BROWSER-10", status: "PASS", details: "Constructor-issued immutable proof is accepted for exact authority, epoch, and snapshot." },
      { id: "AMV-BROWSER-11", status: "PASS", details: "Stale epoch/snapshot and wrong authority/key/revision proofs fail before request or coverage authority." },
      { id: "AMV-BROWSER-12", status: "PASS", details: "Copied, forged, and tampered proofs fail local-brand and digest validation." },
      { id: "AMV-BROWSER-13", status: "PASS", details: "Required and optional request sets preserve deterministic desired/materialize semantics." },
      { id: "AMV-BROWSER-14", status: "PASS", details: "Fallback remains atomic until all 64 L4 children are ready, then selected coverage replaces it." },
      { id: "AMV-BROWSER-15", status: "PASS", details: "Complete selected coverage is unique, gap-free, non-overlapping, and volume exact." },
      { id: "AMV-BROWSER-16", status: "PASS", details: "Brick-budget rejection is typed, deterministic, and side-effect empty." },
      { id: "AMV-BROWSER-17", status: "PASS", details: "Cancelled residency cannot gain selected or fallback coverage authority." },
      { id: "AMV-BROWSER-18", status: "PASS", details: "Collapse releases only derived products and rematerializes from retained authority." },
      { id: "AMV-BROWSER-19", status: "PASS", details: "Eviction is idempotent and reload preserves descriptor, journal, bytes, content, and provenance." },
      { id: "AMV-BROWSER-20", status: "PASS", details: "Canonical key/descriptor/journal/content/provenance/snapshot/proof/plan vectors match pinned literals." }
    ];

    return {
      schemaVersion: "browser-adaptive-microvoxel-authority-v1",
      status: "PASS",
      generator: "apps/weltraum-browser/tests/e2e/adaptive-microvoxel-authority.spec.ts",
      route: "/",
      proofScope: "pure-core-browser-proof",
      visualUiChange: false,
      testBridge: { ownProperty: false, inWindow: false },
      obligations,
      observations: {
        extents,
        rejectionCounts: { coordinate: coordinateRejections.length, descriptor: descriptorRejections.length, edit: editRejections.length, identity: identityRejections.length, proof: proofRejections.length },
        proofFirstPath,
        descriptorAuthority: { uniqueDescriptorDigests: 5, uniqueContentHashes: 5, uniqueProvenanceHashes: 5 },
        journal: { firstRecordCount: firstJournal.records.length, secondRecordCount: secondJournal.records.length, addThenSubtractOccupancy0: addSubtract.occupancy[0], subtractThenAddOccupancy0: subtractAdd.occupancy[0] },
        aba: { aContentHash: original.contentHash, bContentHash: abaB.contentHash, aProvenanceHash: original.provenance.provenanceHash, bProvenanceHash: abaB.provenance.provenanceHash, restored: true },
        planner: { requiredCount: accepted.desired.length, optionalCount: optional.materialize.length, fallbackCounts: [fallback.coverage.length, partial.coverage.length, complete.fallback.length], selectedCount: complete.coverage.length, selectedVolume, rejectedSideEffectCount: 0, cancelledCoverageCount: cancelled.coverage.length },
        release: { collapseReleasedCount: collapse.releasedKeys.length, evictionReleasedCounts: [evicted.releasedKeys.length, evictedAgain.releasedKeys.length], authorityRetained: collapse.authorityRetained && evicted.authorityRetained },
        canonicalVectors
      },
      browserErrors: { console: [], page: [], request: [], http: [] },
      excludedClaims: ["renderer", "streaming", "worker", "TestBridge-integration"]
    };
  });

  expect(evidence.status).toBe("PASS");
  expect(evidence.route).toBe("/");
  expect(evidence.testBridge).toEqual({ ownProperty: false, inWindow: false });
  expect(evidence.obligations).toHaveLength(20);
  expect(evidence.obligations.every((entry) => entry.status === "PASS")).toBe(true);
  expect(browserErrors).toEqual({ console: [], page: [], request: [], http: [] });

  const completedEvidence: AuthorityEvidence = {
    ...evidence,
    browserErrors: {
      console: [...browserErrors.console].sort(),
      page: [...browserErrors.page].sort(),
      request: [...browserErrors.request].sort(),
      http: [...browserErrors.http].sort()
    }
  };
  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(summaryPath, `${JSON.stringify(completedEvidence, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, createMarkdown(completedEvidence), "utf8");
});
