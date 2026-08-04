import {
  MICROVOXEL_BASE_QUANTUM_METERS,
  deepFreeze,
  hashAdaptiveCanonical
} from "../../voxel/adaptive";

export const HESTIA_UMBRELLA_TREE_SCHEMA_VERSION = "hestia-surface-umbrella-tree-v1" as const;
export const HESTIA_UMBRELLA_TREE_GRAPH_SCHEMA_VERSION = "hestia-surface-umbrella-tree-graph-v1" as const;
export const HESTIA_UMBRELLA_TREE_SPECIES_ID = "hestia.umbrella-tree.v1" as const;
export const HESTIA_UMBRELLA_TREE_FIXTURE_INSTANCE_ID = "hestia.surface-play.umbrella.phase2" as const;
export const HESTIA_UMBRELLA_TREE_FIXTURE_SEED = `${HESTIA_UMBRELLA_TREE_FIXTURE_INSTANCE_ID}-seed` as const;
export const HESTIA_UMBRELLA_TREE_LEVEL = 4 as const;
export const HESTIA_UMBRELLA_TREE_EDIT_HALO_QUANTA = 3 as const;

export const HESTIA_UMBRELLA_TREE_MATERIALS = deepFreeze({
  root: {
    materialId: 1,
    densityKgPerCubicMeter: 850,
    structuralClass: "hestia.surface-play.umbrella.root.v1"
  },
  wood: {
    materialId: 2,
    densityKgPerCubicMeter: 650,
    structuralClass: "hestia.surface-play.umbrella.wood.v1"
  },
  canopy: {
    materialId: 3,
    densityKgPerCubicMeter: 120,
    structuralClass: "hestia.surface-play.umbrella.canopy.v1"
  }
} as const);

export type HestiaSurfaceScatterKind =
  | "black_trunk"
  | "cyan_luminous_sprout"
  | "cyan_luminous_cap";

export type HestiaSurfaceVegetationAuthorityKind =
  | "StructuralUmbrellaTree"
  | "DecorativeNonSolid";

export const hestiaSurfaceVegetationAuthorityKind = (
  kind: HestiaSurfaceScatterKind
): HestiaSurfaceVegetationAuthorityKind =>
  kind === "black_trunk" ? "StructuralUmbrellaTree" : "DecorativeNonSolid";

export type HestiaUmbrellaTreeMaterialRole = "root" | "wood" | "canopy";
export type HestiaUmbrellaTreeNodeRole =
  | "root-anchor"
  | "root-junction"
  | "trunk-crown"
  | "primary-tip"
  | "secondary-tip"
  | "canopy-center";
export type HestiaUmbrellaTreeSegmentRole =
  | "root"
  | "trunk"
  | "primary"
  | "secondary"
  | "canopy";

export interface HestiaUmbrellaTreePoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface HestiaUmbrellaTreeNode {
  readonly nodeId: string;
  readonly parentNodeId: string | null;
  readonly role: HestiaUmbrellaTreeNodeRole;
  readonly positionMeters: Readonly<HestiaUmbrellaTreePoint>;
}

export interface HestiaUmbrellaTreeSegment {
  readonly segmentId: string;
  readonly parentNodeId: string;
  readonly childNodeId: string;
  readonly role: HestiaUmbrellaTreeSegmentRole;
  readonly materialRole: HestiaUmbrellaTreeMaterialRole;
  readonly startRadiusMeters: number;
  readonly endRadiusMeters: number;
  readonly lobeRadiiMeters: Readonly<HestiaUmbrellaTreePoint> | null;
}

export interface HestiaUmbrellaTreeGraph {
  readonly schemaVersion: typeof HESTIA_UMBRELLA_TREE_GRAPH_SCHEMA_VERSION;
  readonly graphId: string;
  readonly rootNodeId: string;
  readonly trunkHeightMeters: number;
  readonly baseRadiusMeters: number;
  readonly primaryBranchCount: number;
  readonly secondaryBranchCount: number;
  readonly canopyLobeCount: number;
  readonly nodes: readonly HestiaUmbrellaTreeNode[];
  readonly segments: readonly HestiaUmbrellaTreeSegment[];
  readonly contentHash: string;
}

export interface HestiaUmbrellaTree {
  readonly schemaVersion: typeof HESTIA_UMBRELLA_TREE_SCHEMA_VERSION;
  readonly instanceId: string;
  readonly seed: string;
  readonly speciesId: typeof HESTIA_UMBRELLA_TREE_SPECIES_ID;
  readonly rootQuantum: Readonly<HestiaUmbrellaTreePoint>;
  readonly instanceHash: string;
  readonly graph: HestiaUmbrellaTreeGraph;
  readonly contentHash: string;
}

export interface CreateHestiaUmbrellaTreeInput {
  readonly instanceId?: string;
  readonly seed?: string;
  readonly rootQuantum?: Readonly<HestiaUmbrellaTreePoint>;
}

const finiteSafeInteger = (value: number, path: string): number => {
  if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
    throw new TypeError(`${path} must be a safe integer without signed zero.`);
  }
  return value;
};

const stableText = (value: string, path: string): string => {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    throw new TypeError(`${path} must be a non-empty canonical string.`);
  }
  return value;
};

const hashUnit = (value: unknown): number =>
  Number.parseInt(hashAdaptiveCanonical(value).slice(-8), 16) / 0x1_0000_0000;

const point = (x: number, y: number, z: number): Readonly<HestiaUmbrellaTreePoint> => {
  if (![x, y, z].every(Number.isFinite)) {
    throw new TypeError("Umbrella Tree graph positions must be finite.");
  }
  return deepFreeze({ x, y, z });
};

const identity = (
  instanceHash: string,
  kind: "graph" | "node" | "segment",
  path: string
): string => `hestia.surface-play.umbrella-${kind}.v1:${hashAdaptiveCanonical({
  domain: `hestia-surface-umbrella-${kind}-identity-v1`,
  instanceHash,
  path
}).slice(-16)}`;

const buildGraph = (
  instanceHash: string,
  rootQuantum: Readonly<HestiaUmbrellaTreePoint>
): HestiaUmbrellaTreeGraph => {
  const unit = (path: string): number => hashUnit({
    domain: HESTIA_UMBRELLA_TREE_GRAPH_SCHEMA_VERSION,
    instanceHash,
    path
  });
  const root = point(
    (rootQuantum.x + 0.5) * MICROVOXEL_BASE_QUANTUM_METERS,
    (rootQuantum.y + 0.5) * MICROVOXEL_BASE_QUANTUM_METERS,
    (rootQuantum.z + 0.5) * MICROVOXEL_BASE_QUANTUM_METERS
  );
  const trunkHeightMeters = 5.4 + unit("trunk-height") * 1.2;
  const baseRadiusMeters = 0.4 + unit("base-radius") * 0.15;
  const primaryBranchCount = 5;
  const secondaryCounts = Array.from(
    { length: primaryBranchCount },
    () => 1
  );
  const canopyLobeCount = 4;
  const yawOffset = unit("yaw-offset") * Math.PI * 2;
  const nodes: HestiaUmbrellaTreeNode[] = [];
  const segments: HestiaUmbrellaTreeSegment[] = [];

  const addNode = (
    path: string,
    role: HestiaUmbrellaTreeNodeRole,
    positionMeters: Readonly<HestiaUmbrellaTreePoint>,
    parentNodeId: string | null
  ): HestiaUmbrellaTreeNode => {
    const node = deepFreeze({
      nodeId: identity(instanceHash, "node", path),
      parentNodeId,
      role,
      positionMeters
    });
    nodes.push(node);
    return node;
  };
  const addSegment = (
    path: string,
    role: HestiaUmbrellaTreeSegmentRole,
    materialRole: HestiaUmbrellaTreeMaterialRole,
    parent: HestiaUmbrellaTreeNode,
    child: HestiaUmbrellaTreeNode,
    startRadiusMeters: number,
    endRadiusMeters: number,
    lobeRadiiMeters: Readonly<HestiaUmbrellaTreePoint> | null = null
  ): void => {
    segments.push(deepFreeze({
      segmentId: identity(instanceHash, "segment", path),
      parentNodeId: parent.nodeId,
      childNodeId: child.nodeId,
      role,
      materialRole,
      startRadiusMeters,
      endRadiusMeters,
      lobeRadiiMeters
    }));
  };

  const rootNode = addNode("root", "root-anchor", root, null);
  const rootJunction = addNode(
    "root-junction",
    "root-junction",
    point(root.x, root.y + 0.5, root.z),
    rootNode.nodeId
  );
  addSegment(
    "root",
    "root",
    "root",
    rootNode,
    rootJunction,
    baseRadiusMeters * 1.45,
    baseRadiusMeters
  );
  const crownNode = addNode(
    "trunk-crown",
    "trunk-crown",
    point(root.x, root.y + trunkHeightMeters, root.z),
    rootJunction.nodeId
  );
  addSegment(
    "trunk",
    "trunk",
    "wood",
    rootJunction,
    crownNode,
    baseRadiusMeters,
    baseRadiusMeters * 0.52
  );

  const primaryTips: HestiaUmbrellaTreeNode[] = [];
  const secondaryTips: HestiaUmbrellaTreeNode[] = [];
  for (let primaryIndex = 0; primaryIndex < primaryBranchCount; primaryIndex += 1) {
    const yaw = yawOffset + primaryIndex * Math.PI * 2 / primaryBranchCount;
    const reach = trunkHeightMeters
      * (0.2 + unit(`primary/${primaryIndex}/reach`) * 0.04);
    const rise = trunkHeightMeters
      * (0.055 + unit(`primary/${primaryIndex}/rise`) * 0.03);
    const primary = addNode(
      `primary/${primaryIndex}`,
      "primary-tip",
      point(
        crownNode.positionMeters.x + Math.cos(yaw) * reach,
        crownNode.positionMeters.y + rise,
        crownNode.positionMeters.z + Math.sin(yaw) * reach
      ),
      crownNode.nodeId
    );
    primaryTips.push(primary);
    const primaryRadius = 0.15 + unit(`primary/${primaryIndex}/radius`) * 0.06;
    addSegment(
      `primary/${primaryIndex}`,
      "primary",
      "wood",
      crownNode,
      primary,
      primaryRadius,
      primaryRadius * 0.58
    );

    for (let secondaryIndex = 0; secondaryIndex < secondaryCounts[primaryIndex]; secondaryIndex += 1) {
      const side = secondaryIndex % 2 === 0 ? 1 : -1;
      const branchYaw = yaw + side * (0.35 + secondaryIndex * 0.24);
      const secondaryReach = trunkHeightMeters * (
        0.075
        + unit(`primary/${primaryIndex}/secondary/${secondaryIndex}/reach`) * 0.025
      );
      const secondary = addNode(
        `primary/${primaryIndex}/secondary/${secondaryIndex}`,
        "secondary-tip",
        point(
          primary.positionMeters.x + Math.cos(branchYaw) * secondaryReach,
          primary.positionMeters.y + trunkHeightMeters * (
            0.025
            + unit(`primary/${primaryIndex}/secondary/${secondaryIndex}/rise`) * 0.025
          ),
          primary.positionMeters.z + Math.sin(branchYaw) * secondaryReach
        ),
        primary.nodeId
      );
      secondaryTips.push(secondary);
      addSegment(
        `primary/${primaryIndex}/secondary/${secondaryIndex}`,
        "secondary",
        "wood",
        primary,
        secondary,
        primaryRadius * 0.62,
        primaryRadius * 0.34
      );
    }
  }

  const canopyParents = secondaryTips.length > 0 ? secondaryTips : primaryTips;
  for (let lobeIndex = 0; lobeIndex < canopyLobeCount; lobeIndex += 1) {
    const parent = canopyParents[(lobeIndex * 3) % canopyParents.length];
    const yaw = yawOffset + lobeIndex * Math.PI * 2 / canopyLobeCount
      + unit(`canopy/${lobeIndex}/yaw`) * 0.22;
    const offset = trunkHeightMeters
      * (0.025 + unit(`canopy/${lobeIndex}/offset`) * 0.035);
    const center = addNode(
      `canopy/${lobeIndex}`,
      "canopy-center",
      point(
        parent.positionMeters.x + Math.cos(yaw) * offset,
        parent.positionMeters.y + trunkHeightMeters
          * (0.012 + unit(`canopy/${lobeIndex}/rise`) * 0.018),
        parent.positionMeters.z + Math.sin(yaw) * offset
      ),
      parent.nodeId
    );
    addSegment(
      `canopy/${lobeIndex}`,
      "canopy",
      "canopy",
      parent,
      center,
      0,
      0,
      point(
        trunkHeightMeters * (0.075 + unit(`canopy/${lobeIndex}/radius-x`) * 0.012),
        trunkHeightMeters * (0.045 + unit(`canopy/${lobeIndex}/radius-y`) * 0.008),
        trunkHeightMeters * (0.072 + unit(`canopy/${lobeIndex}/radius-z`) * 0.012)
      )
    );
  }

  const payload = deepFreeze({
    schemaVersion: HESTIA_UMBRELLA_TREE_GRAPH_SCHEMA_VERSION,
    graphId: identity(instanceHash, "graph", "root"),
    rootNodeId: rootNode.nodeId,
    trunkHeightMeters,
    baseRadiusMeters,
    primaryBranchCount,
    secondaryBranchCount: secondaryCounts.reduce((sum, count) => sum + count, 0),
    canopyLobeCount,
    nodes: deepFreeze(nodes),
    segments: deepFreeze(segments)
  });
  return deepFreeze({
    ...payload,
    contentHash: hashAdaptiveCanonical(payload)
  });
};

export const createHestiaUmbrellaTree = (
  input: CreateHestiaUmbrellaTreeInput = {}
): HestiaUmbrellaTree => {
  const instanceId = stableText(
    input.instanceId ?? HESTIA_UMBRELLA_TREE_FIXTURE_INSTANCE_ID,
    "tree.instanceId"
  );
  const seed = stableText(input.seed ?? `${instanceId}-seed`, "tree.seed");
  const rootInput = input.rootQuantum ?? { x: 8, y: 0, z: 8 };
  const rootQuantum = deepFreeze({
    x: finiteSafeInteger(rootInput.x, "tree.rootQuantum.x"),
    y: finiteSafeInteger(rootInput.y, "tree.rootQuantum.y"),
    z: finiteSafeInteger(rootInput.z, "tree.rootQuantum.z")
  });
  const identityPayload = deepFreeze({
    schemaVersion: HESTIA_UMBRELLA_TREE_SCHEMA_VERSION,
    instanceId,
    seed,
    speciesId: HESTIA_UMBRELLA_TREE_SPECIES_ID,
    rootQuantum
  });
  const instanceHash = hashAdaptiveCanonical(identityPayload);
  const graph = buildGraph(instanceHash, rootQuantum);
  const payload = deepFreeze({
    ...identityPayload,
    instanceHash,
    graph
  });
  return deepFreeze({
    ...payload,
    contentHash: hashAdaptiveCanonical(payload)
  });
};
