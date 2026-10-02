import { boundedJson, cellCount, exportFixture, frame, sha } from './fixture-export.mjs';

export const VERSION = 'rd02-small-fixtures-v1';
export const SEED = 20261002;
export const MATERIALS = [
  ['dry', 'limestone-dry', [0.78, 0.76, 0.69]], ['wet', 'limestone-wet', [0.27, 0.29, 0.27]],
  ['wood', 'wood', [0.32, 0.21, 0.10]], ['leaf', 'foliage', [0.19, 0.48, 0.11]],
  ['accent', 'accent', [0.45, 0.12, 0.62]], ['emission', 'emission', [1, 0.5, 0.04]],
].map(([id, role, colorLinearRgb]) => ({ id, role, colorLinearRgb }));
export const CAMERAS = [
  { id: 'near', positionMeters: [5, 3, -5], targetMeters: [2, 1.8, 2], up: [0, 1, 0], verticalFovDegrees: 60 },
  { id: 'medium', positionMeters: [9, 6, -9], targetMeters: [2, 1.8, 2], up: [0, 1, 0], verticalFovDegrees: 55 },
  { id: 'far', positionMeters: [15, 10, -15], targetMeters: [2, 1.8, 2], up: [0, 1, 0], verticalFovDegrees: 55 },
];
export function grid(id, dimensions, originMeters = [0, 0, 0], known = true, materialIds = MATERIALS.map(m => m.id)) {
  const count = cellCount(dimensions);
  return { id, dimensions, originMeters, slots: new Uint8Array(count), coverage: new Uint8Array(count).fill(known ? 1 : 0), materialIds };
}
export function box(volume, lo, hi, slot) {
  if (lo.some((value, axis) => value < 0 || hi[axis] > volume.dimensions[axis] || value >= hi[axis])) {
    throw new Error('Authored box outside fixture');
  }
  const [sx, sy] = volume.dimensions;
  for (let z = lo[2]; z < hi[2]; z += 1) {
    for (let y = lo[1]; y < hi[1]; y += 1) {
      for (let x = lo[0]; x < hi[0]; x += 1) {
        const i = x + sx * (y + sy * z); volume.slots[i] = slot; volume.coverage[i] = 1;
      }
    }
  }
}
const owner = (id, volumes, sourceRevision = 0, origin = [0, 0, 0], sourceIds = ['volume']) => ({ ownerId: id, sourceRevision,
  sourceNamespace: 'rd02-authored-cells-v1', sourceIds, frame: frame(id, origin), volumes });

function control() {
  const v = grid('control-cells', [32, 24, 24]);
  box(v, [0, 0, 0], [32, 1, 24], 1);
  for (let i = 0; i < 6; i += 1) { box(v, [i * 4, 1, 2], [i * 4 + 4, i + 2, 8], i + 1); }
  box(v, [23, 1, 17], [25, 20, 19], 3);
  return [owner('control', [v], 0, [0, 0, 0], ['steps', 'material-planes', 'single-shadow-caster'])];
}
function grove(prefix = '', origin = [0, 0, 0]) {
  const ground = grid(`${prefix}grove-ground`, [48, 8, 48]); box(ground, [0, 0, 0], [48, 2, 48], 1);
  const wood = grid(`${prefix}grove-wood`, [48, 48, 48], [0, 0.25, 0]);
  box(wood, [22, 8, 20], [26, 34, 24], 3);
  // Three genuinely open arches; no filled triangular fan underneath them.
  for (const [a, b, z, y] of [[12, 24, 19, 10], [23, 35, 25, 8], [16, 30, 29, 12]]) {
    box(wood, [a, 0, z], [a + 2, y + 2, z + 2], 3);
    box(wood, [b, 0, z], [b + 2, y + 2, z + 2], 3);
    box(wood, [a, y, z], [b + 2, y + 2, z + 2], 3);
  }
  box(wood, [24, 28, 20], [38, 30, 23], 3);
  const canopy = grid(`${prefix}grove-decor`, [48, 48, 48], [0, 0.25, 0]);
  box(canopy, [18, 33, 16], [30, 37, 29], 4); box(canopy, [28, 29, 19], [42, 33, 33], 4);
  box(canopy, [18, 33, 16], [22, 35, 20], 0);
  for (let x = 4; x < 12; x += 2) { box(canopy, [x, 0, 7], [x + 1, 10 + x % 3, 8], 4); }
  box(canopy, [37, 0, 9], [42, 3, 14], 5);
  for (let i = 0; i < canopy.slots.length; i += 1) {
    if (wood.slots[i]) { canopy.slots[i] = 0; }
  }
  // Decor occupancy is a component, not a claim of global known empty space.
  canopy.coveragePolicy = 'occupied-component-only; empty/outside-unproven';
  canopy.coverage.set(canopy.slots.map(v => v > 0 ? 1 : 0));
  return [owner(`${prefix}grove-ground`, [ground], 0, origin),
    owner(`${prefix}root-tree`, [wood, canopy], 0, origin, ['trunk', 'arch-top', 'canopy', 'reeds', 'accent-cluster'])];
}
function shelter(revision) {
  const v = grid('shelter-shell', [40, 32, 32]); box(v, [0, 0, 0], [39, 2, 32], 1);
  box(v, [4, 12, 3], [16, 13, 20], 1); // 0.125m thin low roof.
  box(v, [24, 22, 6], [36, 24, 26], 1); // Second, high roof with overhang.
  box(v, [6, 2, 5], [8, 12, 20], 1); box(v, [8, 2, 18], [16, 12, 20], 1);
  box(v, [6, 2, 9], [8, 9, 13], 0); // Side entry beneath low cave roof.
  box(v, [26, 2, 10], [28, 22, 12], 1); box(v, [32, 2, 20], [34, 22, 22], 1);
  for (let z = 0; z < 32; z += 1) {
    for (let y = 0; y < 32; y += 1) { v.coverage[39 + 40 * (y + 32 * z)] = 0; }
  }
  v.coveragePolicy = 'known occupied/air source box except last X column unknown; outside unknown; no halo';
  const result = [owner('shelter-shell', [v], revision, [0, 0, 0], ['cave', 'side-entry', 'low-roof', 'high-roof', 'overhang'])];
  if (revision === 0) {
    const roof = grid('removable-roof-cells', [8, 1, 17], [2, 1.5, 0.375]); box(roof, [0, 0, 0], [8, 1, 17], 1);
    result.push(owner('removable-roof', [roof], revision, [0, 0, 0], ['roof-piece']));
  }
  return result;
}
function detach(revision) {
  const stump = grid('trunk-cells', [24, 32, 24], [-1.5, 0, -1.5]); box(stump, [10, 0, 10], [14, 30, 14], 3);
  const fragment = grid('fragment-wood', [8, 4, 4]); box(fragment, [0, 0, 0], [revision >= 3 ? 4 : 8, 3, 3], 3);
  const leaf = grid('fragment-leaf', [4, 3, 4], [0.75, 0.375, 0]); box(leaf, [0, 0, 0], [4, 3, 4], 4);
  leaf.coverage.set(leaf.slots.map(v => v > 0 ? 1 : 0)); leaf.coveragePolicy = 'occupied-component-only';
  if (revision === 0) {
    fragment.originMeters = [0.25, 2.5, -0.25]; leaf.originMeters = [1, 2.875, -0.25];
    return { objects: [owner('tree-main', [stump, fragment, leaf], revision, [0, 0, 0], ['trunk/10/0/10', 'branch:wood/0/0/0', 'branch:leaf/0/0/0'])],
      attachments: [{ id: 'branch-leaf', ownerId: 'tree-main', sourceIds: ['branch:leaf/0/0/0'], supportOwnerId: 'tree-main', supportIds: ['branch:wood/0/0/0'] }] };
  }
  const branch = owner('fragment-branch', revision >= 3 ? [fragment] : [fragment, leaf], revision,
    revision === 1 ? [0.5, 2.125, -0.25] : [1, 1, 0.25], revision >= 3 ? ['branch:wood/0/0/0'] : ['branch:wood/0/0/0', 'branch:leaf/0/0/0']);
  if (revision >= 2) { branch.frame = frame('fragment-branch', branch.frame.originMeters, [0, 0, Math.SQRT1_2, Math.SQRT1_2]); }
  return { objects: [owner('tree-main', [stump], revision, [0, 0, 0], ['trunk/10/0/10']), branch],
    attachments: revision >= 3 ? [] : [{ id: 'branch-leaf', ownerId: 'fragment-branch', sourceIds: ['branch:leaf/0/0/0'],
      supportOwnerId: 'fragment-branch', supportIds: ['branch:wood/0/0/0'] }] };
}
function markerMesh() {
  // Non-voxel presentation marker: exact 1.8m, not a rounded 14/15-quantum body.
  const p = []; const n = []; const indices = [];
  for (let axis = 0; axis < 3; axis += 1) {
    for (const sign of [-1, 1]) {
      const u = (axis + 1) % 3; const v = (axis + 2) % 3; const first = p.length / 3;
      const corners = sign === 1 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 0], [0, 1], [1, 1], [1, 0]];
      for (const corner of corners) {
        const point = [0, 0, 0]; point[axis] = sign === 1 ? 1 : 0; point[u] = corner[0]; point[v] = corner[1];
        p.push(...point.map((value, j) => value * [0.4, 1.8, 0.3][j])); n.push(...[0, 1, 2].map(j => j === axis ? sign : 0));
      }
      indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
    }
  }
  return { id: 'figure-marker', positions: new Float64Array(p), normals: new Float32Array(n), indices: new Uint16Array(indices),
    materialId: 'accent', presentationOnly: true };
}
function cutout() {
  const v = grid('cutout-obstacles', [40, 28, 40]); box(v, [0, 0, 0], [40, 2, 40], 1);
  box(v, [4, 2, 4], [8, 26, 34], 1); box(v, [14, 2, 4], [20, 26, 34], 1); // 0.75m passage.
  box(v, [4, 10, 15], [8, 18, 22], 0); box(v, [14, 10, 15], [20, 18, 22], 0); // Windows.
  box(v, [7, 14, 30], [17, 16, 32], 3); box(v, [7, 2, 30], [9, 16, 32], 3); box(v, [15, 2, 30], [17, 16, 32], 3);
  const marker = owner('figure-marker', [], 0, [1.125, 0.25, 2]); marker.meshes = [markerMesh()];
  return [owner('cutout-obstacles', [v], 0, [0, 0, 0], ['left-wall', 'right-wall', 'window', 'root-arch']), marker];
}
function material(revision) {
  const v = grid('material-room', [40, 28, 32]); box(v, [0, 0, 0], [40, 2, 32], 1);
  box(v, [3, 2, 3], [6, 20, 25], 1); box(v, [6, 2, 22], [29, 20, 25], 2); box(v, [3, 20, 3], [30, 22, 25], 1);
  if (revision >= 1) { box(v, [13, 20, 9], [22, 22, 17], 0); }
  box(v, [9, 2, 12], [11, 16, 14], 3); box(v, [7, 16, 10], [15, 18, 18], 4);
  box(v, [25, 2, 15], [28, 5, 18], 6); box(v, [30, 2, 5], [38, 3, 15], 2);
  return [owner('material-room', [v], revision, [0, 0, 0], ['dry-face', 'wet-face', 'wood', 'foliage', 'emitter', 'opening'])];
}
function sourceDigest(input, contracts) {
  return sha(contracts.canonicalJson({ id: input.id, sourceRevision: input.sourceRevision, materials: input.materials, cameras: input.cameras,
    objects: input.objects.map(object => ({ ownerId: object.ownerId, frame: object.frame, sourceIds: object.sourceIds,
      volumes: object.volumes.map(v => ({ id: v.id, dimensions: v.dimensions, originMeters: v.originMeters,
        slots: sha(v.slots), coverage: sha(v.coverage) })),
      meshes: (object.meshes ?? []).map(m => ({ positions: sha(new Uint8Array(m.positions.buffer)), indices: sha(new Uint8Array(m.indices.buffer)) })) })),
    attachments: input.attachments ?? [] }));
}
export async function replay(group, bundles, contracts) {
  const initial = bundles[0].fixture;
  const scenario = contracts.createScenario({ schema: 'hestia-rd-scenario-v1', id: `${group}-REPLAY`,
    fixtureDigest: contracts.getFixtureDigest(initial), ticksPerSecond: 60, durationTicks: 1800, mode: 'presentation-replay',
    initialCameraId: initial.cameras[0].id, initialWeatherPresetId: 'dry',
    weatherPresets: { dry: { windMps: [0, 0, 0], rain01: 0, snow01: 0, cloud01: 0.1 },
      wet: { windMps: [2, 0, 1], rain01: 0.8, snow01: 0, cloud01: 0.8 },
      windy: { windMps: [5, 0, -2], rain01: 0, snow01: 0, cloud01: 0.4 } },
    keyframes: [{ tick: 120, type: 'SelectCamera', cameraId: initial.cameras.at(-1).id },
      { tick: 240, type: 'SetWeatherPreset', presetId: 'wet' },
      { tick: 600, type: 'SelectCamera', cameraId: initial.cameras[0].id },
      { tick: 900, type: 'SetWeatherPreset', presetId: 'windy' }, { tick: 1560, type: 'ResetLab' }],
    snapshots: bundles.slice(1).map((bundle, i) => ({ tick: (i + 1) * 360, type: 'ReplaceSnapshot',
      fixtureDigest: contracts.getFixtureDigest(bundle.fixture), manifest: bundle.fixture })) }, initial);
  return { group, scenario, scenarioBytes: boundedJson(scenario, contracts.canonicalJson), scenarioDigest: await contracts.getScenarioDigest(scenario) };
}
export async function makeSyntheticFixtures(contracts, generatorHash, reverseOrder = false) {
  const bundles = []; const scenarios = [];
  const definitions = [
    ['F00-CONTROL', 1, () => ({ objects: control(), cases: { quantumSteps: [1, 2, 3, 4, 5, 6], shadowCasterCount: 1 } })],
    ['F02-ROOT-GROVE', 1, () => ({ objects: grove(), cases: { openArches: 3, asymmetricCanopy: true, clearing: [0, 0.25, 4.5] } })],
    ['F03-SHELTER', 2, r => ({ objects: shelter(r), cases: { lowRoofMeters: 1.5, highRoofMeters: 2.75,
      thinRoofMeters: 0.125, caveSideEntry: true, removableRoofPresent: r === 0, unknownColumnX: 39 } })],
    ['F04-DETACH', 5, r => ({ ...detach(r), cases: { label: ['intact', 'detach', 'rotate', 'remove', 'reload'][r],
      mode: 'presentation-replay', nativeMutation: false, sourceIdMeaning: {
        'trunk/10/0/10': { region: 'trunk-cells', cell: [10, 0, 10] },
        'branch:wood/0/0/0': { region: 'fragment-wood', cell: [0, 0, 0] },
        ...(r < 3 ? { 'branch:leaf/0/0/0': { region: 'fragment-leaf', cell: [0, 0, 0] } } : {}) } } })],
    ['F05-CUTOUT', 1, () => ({ objects: cutout(), cameras: [...CAMERAS,
      { id: 'inside-wall', positionMeters: [2.125, 1.125, 0.875], targetMeters: [1.125, 1.125, 2.5], up: [0, 1, 0], verticalFovDegrees: 60 }],
      cases: { markerHeightMeters: 1.8, markerPresentationOnly: true, passageWidthMeters: 0.75, physicalOccupancyUnchangedByView: true } })],
    ['F06-MATERIAL', 2, r => ({ objects: material(r), cameras: [...CAMERAS,
      { id: 'interior', positionMeters: [1.5, 1.2, 1], targetMeters: [2.5, 1.4, 2.5], up: [0, 1, 0], verticalFovDegrees: 60 }],
      cases: { openingPresent: r === 1, rolesOnlyNotShaderImplementation: true, shadowedInterior: true } })],
    ['F07-SCALE', 3, r => { const count = [1, 2, 4][r]; return { objects: Array.from({ length: count }, (_, i) => grove(`copy-${i}-`, [i * 6.5, 0, 0])).flat(),
      cases: { label: `${count}x`, copies: count, translationStepMeters: 6.5, samePatch: 'F02-ROOT-GROVE', universalCapacityClaim: false } }; }],
  ];
  for (const [group, count, build] of definitions) {
    const current = [];
    for (let r = 0; r < count; r += 1) {
      const { cases, ...content } = build(r);
      const id = group === 'F07-SCALE' ? `${group}-${[1, 2, 4][r]}x` : r === 0 ? group : `${group}-R${r}`;
      const input = { id, kind: 'synthetic', quantumMeters: 0.125, sourceRevision: r, frame: frame('lab'),
        materials: MATERIALS, cameras: CAMERAS, ...content };
      input.sourceRefs = [{ kind: 'synthetic', generatorPath: 'exporters/synthetic.mjs', generatorCodeSha256: generatorHash,
        generatorVersion: VERSION, seed: SEED, testOnly: true, sourceDigest: sourceDigest(input, contracts) }];
      if (reverseOrder) {
        input.objects.reverse();
        for (const object of input.objects) { object.volumes.reverse(); }
      }
      const bundle = { ...await exportFixture(input, contracts), group, revisionLabel: cases.label ?? (r === 0 ? 'initial' : 'opening'),
        cases, mode: 'presentation-replay' };
      current.push(bundle); bundles.push(bundle);
    }
    scenarios.push(await replay(group, current, contracts));
  }
  return { bundles, scenarios };
}
