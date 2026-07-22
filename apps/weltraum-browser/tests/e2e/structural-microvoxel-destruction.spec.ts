import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type AdaptiveDomain = typeof import("../../src/voxel/adaptive/index");
type StructuralDomain = typeof import("../../src/voxel/structural/index");

const evidenceDirectory = path.resolve(process.cwd(), "evidence");
const summaryPath = path.join(evidenceDirectory, "browser-structural-microvoxel-destruction-v1-summary.json");
const markdownPath = path.join(evidenceDirectory, "browser-structural-microvoxel-destruction-v1.md");

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

interface StructuralEvidence {
  readonly schemaVersion: "browser-structural-microvoxel-destruction-v1";
  readonly status: "PASS";
  readonly generator: "apps/weltraum-browser/tests/e2e/structural-microvoxel-destruction.spec.ts";
  readonly route: "/";
  readonly proofScope: "pure-core-browser-proof-via-direct-vite-import";
  readonly visualUiChange: false;
  readonly testBridge: { readonly ownProperty: false; readonly inWindow: false };
  readonly obligations: readonly Obligation[];
  readonly observations: Readonly<Record<string, unknown>>;
  readonly browserErrors: BrowserErrors;
  readonly excludedClaims: readonly ["runtime-wiring", "renderer-integration", "physics-integration", "gameplay-integration"];
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

const createMarkdown = (evidence: StructuralEvidence): string => {
  const obligationRows = evidence.obligations
    .map((entry) => `| ${entry.id} | ${entry.status} | ${entry.details} |`)
    .join("\n");
  return `# Browser Structural Microvoxel Destruction V1 Evidence

This timestamp-free artifact is generated from the same in-memory result as the JSON summary.

## Result

- Status: **${evidence.status}**
- Route: \`${evidence.route}\`
- Scope: \`${evidence.proofScope}\`
- TestBridge absent: \`true\`
- Visual UI change: \`${evidence.visualUiChange}\`
- Browser console/page/request/HTTP errors: \`${evidence.browserErrors.console.length}/${evidence.browserErrors.page.length}/${evidence.browserErrors.request.length}/${evidence.browserErrors.http.length}\`
- Excluded claims: ${evidence.excludedClaims.map((claim) => `\`${claim}\``).join(", ")}

This proves only pure Structural/Adaptive core execution inside Chromium through direct Vite imports on the normal application route. It does not claim runtime, renderer, physics, gameplay, or visual-product integration, and no screenshot is required because there is no visual UI change.

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

test("normal Chromium route proves Structural Microvoxel Destruction Core V1", async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(new URL(page.url()).pathname).toBe("/");

  const testBridge = await page.evaluate(() => ({
    ownProperty: Object.prototype.hasOwnProperty.call(window, "TestBridge"),
    inWindow: "TestBridge" in window
  }));
  expect(testBridge).toEqual({ ownProperty: false, inWindow: false });

  const evidence = await page.evaluate<StructuralEvidence>(async () => {
    const structuralPath = String("/src/voxel/structural/index.ts");
    const adaptivePath = String("/src/voxel/adaptive/index.ts");
    const [structural, adaptive] = await Promise.all([
      import(/* @vite-ignore */ structuralPath) as Promise<StructuralDomain>,
      import(/* @vite-ignore */ adaptivePath) as Promise<AdaptiveDomain>
    ]);
    const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    const equal = (left: unknown, right: unknown): boolean =>
      adaptive.canonicalAdaptiveJson(left) === adaptive.canonicalAdaptiveJson(right);
    const hashPattern = /^fnv1a64-v1:[0-9a-f]{16}$/;
    const bodyId = adaptive.stableAuthorityId("planet.structural-proof");
    const surfaceFrameId = adaptive.stableAuthorityId("frame.surface");
    const regionId = adaptive.stableAuthorityId("region.structural-proof");
    const generatorVersion = adaptive.stableAuthorityId("generator.structural-v1");
    const keyAt = (x: number, y: number, z: number) => adaptive.createAdaptiveBrickKey({
      bodyId, surfaceFrameId, regionId, generatorVersion, level: 4, originQuantum: { x, y, z }
    });
    const centralKey = keyAt(0, 0, 0);
    const adaptiveBaseField = adaptive.createAdaptiveBaseFieldDescriptor({
      kind: "constant-v1",
      identity: adaptive.stableAuthorityId("base.structural-proof"),
      version: generatorVersion,
      sourceRevision: adaptive.authorityRevision(1),
      sample: { density: 0, occupancy: 0, materialId: null }
    });
    const adaptiveJournal = adaptive.createAdaptiveEditJournal([
      {
        editId: "edit.fixture-base", sequence: 1, expectedRegionRevision: 0, resultRegionRevision: 1,
        actorId: "actor.browser-proof", sourceId: "source.browser-proof", operation: "AddBox",
        box: { min: { x: 0, y: 0, z: 0 }, max: { x: 8, y: 8, z: 1 } },
        materialId: "material.fixture", semanticId: "semantic.fixture"
      },
      {
        editId: "edit.fixture-neck", sequence: 2, expectedRegionRevision: 1, resultRegionRevision: 2,
        actorId: "actor.browser-proof", sourceId: "source.browser-proof", operation: "AddBox",
        box: { min: { x: 8, y: 8, z: 1 }, max: { x: 9, y: 9, z: 4 } },
        materialId: "material.fixture", semanticId: "semantic.fixture"
      },
      {
        editId: "edit.fixture-upper", sequence: 3, expectedRegionRevision: 2, resultRegionRevision: 3,
        actorId: "actor.browser-proof", sourceId: "source.browser-proof", operation: "AddBox",
        box: { min: { x: 7, y: 7, z: 4 }, max: { x: 10, y: 10, z: 6 } },
        materialId: "material.fixture", semanticId: "semantic.fixture"
      }
    ]);
    const adaptiveKeys = [centralKey, keyAt(-16, 0, 0), keyAt(0, -16, 0), keyAt(0, 0, -16)];
    const adaptiveBricks = adaptiveKeys.map((key) => adaptive.materializeAdaptiveBrick({ key, baseField: adaptiveBaseField, editJournal: adaptiveJournal }));
    const brickRevision = adaptive.authorityRevision(0);
    const resident = adaptiveBricks.map((brick) => ({
      key: brick.key,
      readiness: "ready" as const,
      byteSize: adaptive.ADAPTIVE_BRICK_ESTIMATED_BYTES,
      work: adaptive.ADAPTIVE_BRICK_ESTIMATED_WORK,
      contentHash: brick.contentHash,
      provenanceHash: brick.provenance.provenanceHash,
      baseFieldDescriptorDigest: brick.baseFieldDescriptorDigest,
      journalDigest: brick.provenance.journalDigest,
      sourceRevision: brick.sourceRevision,
      editRevision: brick.editRevision,
      brickRevision
    }));
    const snapshotDraft: import("../../src/voxel/adaptive/index").AdaptivePlannerSnapshot = {
      schemaVersion: "adaptive-microvoxel-planner-snapshot-v1",
      bodyId, surfaceFrameId, regionId, generatorVersion,
      authority: {
        schemaVersion: "adaptive-microvoxel-planner-authority-v1",
        baseField: adaptiveBaseField,
        editJournal: adaptiveJournal,
        brickRevision
      },
      planningEpoch: adaptive.authorityRevision(1),
      resident,
      activeCoverage: [],
      refinementRequests: [],
      budgets: { maxBricks: 4, maxBytes: Number.MAX_SAFE_INTEGER, maxWork: Number.MAX_SAFE_INTEGER, maxCoverageQuantum: Number.MAX_SAFE_INTEGER }
    };
    const validationProofs = adaptive.createAdaptiveResidentValidationProofs({ bricks: adaptiveBricks, brickRevision, snapshot: snapshotDraft });
    const adaptiveSnapshot = {
      ...snapshotDraft,
      resident: resident.map((entry, index) => ({ ...entry, validationProof: validationProofs[index] }))
    };
    const adaptiveAuthority = adaptive.createAdaptiveAuthorityRetention({ baseField: adaptiveBaseField, editJournal: adaptiveJournal });
    const frame = {
      schemaVersion: structural.STRUCTURAL_FRAME_BINDING_SCHEMA_VERSION,
      bodyId, surfaceFrameId, regionId, generatorVersion,
      objectOriginQuantum: { x: 0, y: 0, z: 0 }
    };
    const jointId = adaptive.stableAuthorityId("joint.base-to-upper");
    const jointEndpointA = structural.createStructuralCellAddress(centralKey, { x: 0, y: 0, z: 0 });
    const jointEndpointB = structural.createStructuralCellAddress(centralKey, { x: 8, y: 8, z: 4 });
    const objectInput = () => structural.createStructuralObjectFromAdaptive({
      objectId: "object.structural-browser-proof",
      frame,
      authority: adaptiveAuthority,
      snapshot: adaptiveSnapshot,
      materials: [{ materialId: 1, densityKgPerCubicMeter: 512, structuralClass: "fixture", destructible: true, tags: null }],
      materialBindings: [{ adaptiveMaterialId: "material.fixture", structuralMaterialId: 1 }],
      bricks: adaptiveBricks,
      anchors: [{ anchorId: "anchor.base", cell: structural.createStructuralCellAddress(centralKey, { x: 0, y: 0, z: 0 }) }],
      joints: [{
        jointId,
        jointClass: "fixture-bridge",
        endpointA: { cell: jointEndpointA, role: "base" },
        endpointB: { cell: jointEndpointB, role: "upper" }
      }],
      objectRevision: 0,
      editRevision: 0,
      commandEvidence: []
    });
    const before = objectInput();
    const beforeRepeat = objectInput();
    const command = structural.validateStructuralDestructionCommand({
      schemaVersion: structural.STRUCTURAL_COMMAND_SCHEMA_VERSION,
      kind: "SubtractSphere",
      commandId: "command.detach-upper",
      targetObjectId: "object.structural-browser-proof",
      expectedObjectRevision: 0,
      resultingObjectRevision: 1,
      expectedAdaptiveSource: before.source,
      materialFilter: null,
      actor: "actor.browser-proof",
      source: "source.browser-proof",
      sequence: 1,
      budgets: {
        maxVisitedBricks: 8,
        maxVisitedCells: 256,
        maxSelectedCells: 16,
        maxChangedCells: 16,
        maxConnectivityCells: 256,
        maxConnectivityFacts: 32,
        maxComponents: 8,
        maxMassCells: 256
      },
      shape: { kind: "sphere", space: "global-quantum", centerQuantum: { x: 8, y: 8, z: 2 }, radiusQuantum: 1 }
    });
    const beforeMass = structural.deriveStructuralObjectMassProperties(before, { maxVisitedCells: 256 });
    const result = structural.applyStructuralDestructionCommand(before, command);
    const repeat = structural.applyStructuralDestructionCommand(beforeRepeat, command);
    assert(result.status === "Applied" && repeat.status === "Applied", "The deterministic subtraction must be applied twice.");
    assert(result.selectedVoxelCount === 2 && result.changedVoxelCount === 2, "The sphere must remove exactly neck cells z=1 and z=2.");
    assert(repeat.selectedVoxelCount === 2 && repeat.changedVoxelCount === 2, "The identical repeat changed its exact removal counts.");
    const after = result.object;
    const afterRepeat = repeat.object;
    const afterMass = structural.deriveStructuralObjectMassProperties(after, { maxVisitedCells: 256 });
    assert(beforeMass.occupiedVoxelCount === 85 && beforeMass.totalMassKg === 85, "The initial fixture must contain 85 one-kilogram cells.");
    assert(afterMass.occupiedVoxelCount === 83 && afterMass.totalMassKg === 83, "The result must contain 83 one-kilogram cells.");
    assert(beforeMass.totalMassKg - afterMass.totalMassKg === 2, "Removed mass must be exactly two kilograms.");

    const classification = structural.deriveStructuralComponentClassification(after, { maxVisitedCells: 256, maxComponents: 8, maxIndexedFacts: 32 });
    const repeatClassification = structural.deriveStructuralComponentClassification(afterRepeat, { maxVisitedCells: 256, maxComponents: 8, maxIndexedFacts: 32 });
    assert(classification.components.length === 2, "The cut must yield exactly two six-neighbor components.");
    assert(classification.anchoredComponents.length === 1 && classification.detachedComponents.length === 1, "The result must have one anchored and one detached component.");
    assert(classification.fragments.length === 1 && classification.fragments[0].componentId === classification.detachedComponents[0].componentId, "The detached Component must publish exactly one deterministic Fragment identity.");
    assert(classification.fragments[0].fragmentId === repeatClassification.fragments[0].fragmentId, "Fragment ID changed under an identical repeat.");
    const anchored = classification.anchoredComponents[0];
    const detached = classification.detachedComponents[0];
    assert(anchored.occupiedCells.length === 64 && detached.occupiedCells.length === 19, "Component cell counts must be 64 anchored and 19 detached.");
    const persistentJoint = after.joints.find((joint) => joint.jointId === jointId);
    const jointRemainsPresent = persistentJoint !== undefined &&
      equal(persistentJoint.endpointA.cell, jointEndpointA) && equal(persistentJoint.endpointB.cell, jointEndpointB);
    assert(jointRemainsPresent, "The destruction result must retain the Joint and both contracted endpoints.");
    const endpointComponentIds = (["A", "B"] as const).map((endpoint) =>
      classification.components.find((component) => component.activeJoints.some((fact) => fact.jointId === jointId && fact.endpoint === endpoint))?.componentId ?? null
    );
    const jointEndpointsActive = endpointComponentIds.every((componentId) => componentId !== null);
    assert(jointEndpointsActive, "Both occupied Joint endpoints must remain active after destruction.");
    const jointsCreateConnectivity = endpointComponentIds[0] === endpointComponentIds[1];
    assert(!jointsCreateConnectivity, "The active Joint endpoints must remain in separate six-neighbor components.");
    const anchoredMass = structural.deriveStructuralComponentMassProperties(after, anchored, { maxVisitedCells: 256, maxConnectivityCells: 256, maxComponents: 8, maxConnectivityFacts: 32 });
    const detachedMass = structural.deriveStructuralComponentMassProperties(after, detached, { maxVisitedCells: 256, maxConnectivityCells: 256, maxComponents: 8, maxConnectivityFacts: 32 });
    assert(anchoredMass.totalMassKg === 64 && detachedMass.totalMassKg === 19, "Component masses must be 64 kg and 19 kg.");
    const comInsideBounds = (mass: typeof afterMass): boolean => mass.centerOfMassMeters !== null && mass.boundsMeters !== null &&
      mass.centerOfMassMeters.x >= mass.boundsMeters.min.x && mass.centerOfMassMeters.x <= mass.boundsMeters.max.x &&
      mass.centerOfMassMeters.y >= mass.boundsMeters.min.y && mass.centerOfMassMeters.y <= mass.boundsMeters.max.y &&
      mass.centerOfMassMeters.z >= mass.boundsMeters.min.z && mass.centerOfMassMeters.z <= mass.boundsMeters.max.z;
    const massProducts = [afterMass, anchoredMass, detachedMass];
    assert(massProducts.every((mass) => Number.isFinite(mass.totalMassKg) && comInsideBounds(mass)), "Every nonempty mass product needs finite mass and in-bounds COM.");
    assert(massProducts.every((mass) => Object.values(mass.inertiaTensorKgMetersSquared).length === 6 &&
      Object.values(mass.inertiaTensorKgMetersSquared).every((value) => Number.isFinite(value))), "Every inertia tensor must expose six finite values.");

    assert(equal(classification.components.map((component) => component.componentId), repeatClassification.components.map((component) => component.componentId)), "Component IDs changed under an identical repeat.");
    assert(equal(classification.components.map((component) => component.componentContentHash), repeatClassification.components.map((component) => component.componentContentHash)), "Component content hashes changed under an identical repeat.");
    assert(after.contentHash === afterRepeat.contentHash && after.evidenceHash === afterRepeat.evidenceHash && result.resultHash === repeat.resultHash, "Object content, evidence, or result hash changed under an identical repeat.");
    const repeatedHashes = [
      ...classification.components.map((component) => component.componentId),
      ...classification.components.map((component) => component.componentContentHash),
      after.contentHash, after.evidenceHash, result.resultHash
    ];
    assert(repeatedHashes.every((hash) => hashPattern.test(hash)), "A deterministic Structural hash has an unexpected format.");

    const meshResult = structural.extractStructuralMeshData(after, { maxVisitedCells: 256, maxQuads: 512, maxVertices: 2_048, maxIndices: 3_072 });
    assert(meshResult.status === "Produced", "The fixture mesh must be produced with explicit known-Air neighbor coverage.");
    const mesh = meshResult.product;
    assert(mesh.positions.length % 12 === 0 && mesh.normals.length === mesh.positions.length && mesh.indices.length % 6 === 0, "Mesh arrays have invalid deterministic cardinality.");
    assert([...mesh.positions, ...mesh.normals, ...mesh.indices].every((value) => Number.isFinite(value)), "Mesh arrays must contain only finite numbers.");
    const occupied = new Set<string>();
    for (const item of after.bricks.flatMap((entry) => entry.cells.map((cell) => structural.structuralAddressForBrickCell(entry, cell.localIndex)))) {
      const point = structural.globalQuantumForStructuralCell(item);
      occupied.add(`${point.x}:${point.y}:${point.z}`);
    }
    const directions = [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]] as const;
    let expectedExposedUnitFaces = 0;
    for (const key of occupied) {
      const [x, y, z] = key.split(":").map(Number);
      for (const [dx, dy, dz] of directions) if (!occupied.has(`${x + dx}:${y + dy}:${z + dz}`)) expectedExposedUnitFaces += 1;
    }
    let emittedUnitFaces = 0;
    for (let quad = 0; quad < mesh.positions.length / 12; quad += 1) {
      const positions = mesh.positions.slice(quad * 12, quad * 12 + 12).map((value) => value / structural.MICROVOXEL_BASE_QUANTUM_METERS);
      const normal = mesh.normals.slice(quad * 12, quad * 12 + 3);
      assert(positions.every((value) => Number.isInteger(value)), "Mesh vertices must map back to integer quantum coordinates.");
      assert(normal.filter((value) => value !== 0).length === 1 && normal.every((value) => value === -1 || value === 0 || value === 1), "Mesh normals must be axis aligned.");
      const axis = normal.findIndex((value) => value !== 0);
      const otherAxes = [0, 1, 2].filter((value) => value !== axis);
      const corners = Array.from({ length: 4 }, (_, corner) => positions.slice(corner * 3, corner * 3 + 3));
      const plane = corners[0][axis];
      assert(corners.every((corner) => corner[axis] === plane), "Every quad must lie on one integer plane.");
      const firstMin = Math.min(...corners.map((corner) => corner[otherAxes[0]]));
      const firstMax = Math.max(...corners.map((corner) => corner[otherAxes[0]]));
      const secondMin = Math.min(...corners.map((corner) => corner[otherAxes[1]]));
      const secondMax = Math.max(...corners.map((corner) => corner[otherAxes[1]]));
      for (let first = firstMin; first < firstMax; first += 1) for (let second = secondMin; second < secondMax; second += 1) {
        const inside = [0, 0, 0];
        inside[axis] = normal[axis] === -1 ? plane : plane - 1;
        inside[otherAxes[0]] = first;
        inside[otherAxes[1]] = second;
        const outside = [...inside];
        outside[axis] += normal[axis];
        assert(occupied.has(`${inside[0]}:${inside[1]}:${inside[2]}`), "A mesh unit face has no occupied interior cell.");
        assert(!occupied.has(`${outside[0]}:${outside[1]}:${outside[2]}`), "An internal face was emitted between occupied cells.");
        emittedUnitFaces += 1;
      }
    }
    assert(emittedUnitFaces === expectedExposedUnitFaces, "Greedy mesh coverage must equal the independently counted exposed unit faces.");

    const obligations: Obligation[] = [
      { id: "SMV-BROWSER-01", status: "PASS", details: "Normal route loaded and both TestBridge absence checks passed before direct Vite imports." },
      { id: "SMV-BROWSER-02", status: "PASS", details: "The 85-cell Level-4 fixture uses binary material 1 at 512 kg/m^3, or exactly 1 kg per cell." },
      { id: "SMV-BROWSER-03", status: "PASS", details: "Center-inclusion SubtractSphere removed exactly neck cells z=1 and z=2: 2 cells and 2 kg." },
      { id: "SMV-BROWSER-04", status: "PASS", details: "Six-neighbor classification yielded one 64-cell anchored base and one 19-cell detached upper component while both endpoints of the retained bridging Joint remained active without adding connectivity." },
      { id: "SMV-BROWSER-05", status: "PASS", details: "Mass, COM, bounds, and all six symmetric inertia values are finite; every COM is inside its bounds." },
      { id: "SMV-BROWSER-06", status: "PASS", details: "Identical repeats preserved component IDs/content hashes and object content/evidence/result hashes." },
      { id: "SMV-BROWSER-07", status: "PASS", details: "Greedy mesh arrays are finite, axis-aligned, externally complete, and contain no occupied-to-occupied internal face." },
      { id: "SMV-BROWSER-08", status: "PASS", details: "The proof exercises only public pure-core barrels and makes no runtime, renderer, physics, or gameplay integration claim." }
    ];
    return {
      schemaVersion: "browser-structural-microvoxel-destruction-v1",
      status: "PASS",
      generator: "apps/weltraum-browser/tests/e2e/structural-microvoxel-destruction.spec.ts",
      route: "/",
      proofScope: "pure-core-browser-proof-via-direct-vite-import",
      visualUiChange: false,
      testBridge: { ownProperty: false, inWindow: false },
      obligations,
      observations: {
        fixture: { adaptiveLevel: 4, occupiedBrickCount: 1, knownAirNeighborBrickCount: 3, materialId: 1, densityKgPerCubicMeter: 512, cellMassKg: 1, base: "8x8 at z=0", neck: "(8,8,z=1..3)", upper: "3x3x2 at x/y=7..9,z=4..5" },
        command: { kind: "SubtractSphere", space: "global-quantum", centerQuantum: { x: 8, y: 8, z: 2 }, radiusQuantum: 1, status: result.status, selectedVoxelCount: result.selectedVoxelCount, changedVoxelCount: result.changedVoxelCount },
        mass: { beforeVoxelCount: beforeMass.occupiedVoxelCount, afterVoxelCount: afterMass.occupiedVoxelCount, beforeMassKg: beforeMass.totalMassKg, afterMassKg: afterMass.totalMassKg, removedMassKg: beforeMass.totalMassKg - afterMass.totalMassKg, componentMassesKg: [anchoredMass.totalMassKg, detachedMass.totalMassKg], finite: true, centersOfMassInsideBounds: true, inertiaValueCountPerProduct: 6 },
        components: { totalCount: classification.components.length, anchoredCount: classification.anchoredComponents.length, detachedCount: classification.detachedComponents.length, anchoredVoxelCount: anchored.occupiedCells.length, detachedVoxelCount: detached.occupiedCells.length, jointsCreateConnectivity },
        joint: { jointId, remainsPresent: jointRemainsPresent, endpointAActive: endpointComponentIds[0] !== null, endpointBActive: endpointComponentIds[1] !== null, endpointComponentIdsDistinct: endpointComponentIds[0] !== endpointComponentIds[1] },
        deterministicHashes: { componentIdsEqual: true, componentContentHashesEqual: true, objectContentHashesEqual: true, evidenceHashesEqual: true, resultHashesEqual: true },
        mesh: { status: meshResult.status, arraysFinite: true, axisAlignedNormals: true, noInternalFaces: true, exposedUnitFaceCoverageExact: true }
      },
      browserErrors: { console: [], page: [], request: [], http: [] },
      excludedClaims: ["runtime-wiring", "renderer-integration", "physics-integration", "gameplay-integration"]
    };
  });

  expect(evidence.status).toBe("PASS");
  expect(evidence.route).toBe("/");
  expect(evidence.testBridge).toEqual({ ownProperty: false, inWindow: false });
  expect(evidence.obligations).toHaveLength(8);
  expect(evidence.obligations.every((entry) => entry.status === "PASS")).toBe(true);
  expect(browserErrors).toEqual({ console: [], page: [], request: [], http: [] });

  const completedEvidence: StructuralEvidence = {
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
