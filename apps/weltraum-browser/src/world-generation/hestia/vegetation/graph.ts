import { MICROVOXEL_BASE_QUANTUM_METERS } from "../../../voxel/adaptive";
import {
  HESTIA_UMBRELLA_TREE_GRAPH_SCHEMA_VERSION,
  type HestiaUmbrellaTreeGraph,
  type HestiaUmbrellaTreeGraphBudget,
  type HestiaUmbrellaTreeNode,
  type HestiaUmbrellaTreeNodeRole,
  type HestiaUmbrellaTreeSegment,
  type HestiaUmbrellaTreeSegmentRole,
  type HestiaVegetationInstance,
  type HestiaVegetationMaterialRole
} from "./contracts";
import {
  freezeHestiaVegetationValue,
  hashHestiaVegetationCanonical,
  hestiaVegetationHashUnitFloat
} from "./canonical";
import { vegetationFail } from "./validation";

const DEFAULT_GRAPH_BUDGET: HestiaUmbrellaTreeGraphBudget = freezeHestiaVegetationValue({
  maxSecondaryBranches: 27,
  maxCanopyLobes: 8
});

const finite = (value: number, path: string): number => {
  if (!Number.isFinite(value)) return vegetationFail("InvalidSample", path, "Umbrella graph inputs must be finite.");
  return value;
};

const positiveInteger = (value: number, path: string): number => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    return vegetationFail("InvalidBudget", path, "Umbrella graph budgets must be positive safe integers.");
  }
  return value;
};

const validateInstance = (instance: HestiaVegetationInstance): void => {
  if (instance.schemaVersion !== "hestia-vegetation-v1") {
    return vegetationFail("InvalidSample", "instance/schemaVersion", "Umbrella graph input requires the V1 vegetation schema.");
  }
  if (instance.speciesId !== "hestia.umbrella-tree.v1") {
    return vegetationFail("InvalidSpeciesId", "instance/speciesId", "A complete structural graph is available only for Umbrella Tree V1.");
  }
  if (typeof instance.instanceId !== "string" || instance.instanceId.length === 0
    || typeof instance.instanceHash !== "string" || instance.instanceHash.length === 0) {
    return vegetationFail("InvalidSample", "instance", "Umbrella graph input requires stable instance identity.");
  }
  for (const axis of ["x", "y", "z"] as const) {
    finite(instance.rootQuantum[axis], `instance/rootQuantum/${axis}`);
    if (!Number.isSafeInteger(instance.rootQuantum[axis])) {
      return vegetationFail("InvalidSample", `instance/rootQuantum/${axis}`, "Umbrella graph roots require safe global quanta.");
    }
  }
};

const graphId = (instance: HestiaVegetationInstance, kind: "graph" | "node" | "segment", path: string): string =>
  `hestia.vegetation.umbrella-${kind}.v1:${hashHestiaVegetationCanonical({
    domain: `hestia-umbrella-${kind}-identity-v1`,
    instanceHash: instance.instanceHash,
    path
  }).slice(-16)}`;

const unit = (instance: HestiaVegetationInstance, path: string): number => hestiaVegetationHashUnitFloat({
  domain: "hestia-umbrella-tree-graph-v1",
  instanceHash: instance.instanceHash,
  path
});

const point = (x: number, y: number, z: number) => freezeHestiaVegetationValue({
  x: finite(x, "graph/position/x"),
  y: finite(y, "graph/position/y"),
  z: finite(z, "graph/position/z")
});

export const createHestiaUmbrellaTreeGraph = (
  instance: HestiaVegetationInstance,
  budgetValue: HestiaUmbrellaTreeGraphBudget = DEFAULT_GRAPH_BUDGET
): HestiaUmbrellaTreeGraph => {
  validateInstance(instance);
  const maxSecondaryBranches = positiveInteger(budgetValue.maxSecondaryBranches, "graphBudget/maxSecondaryBranches");
  const maxCanopyLobes = positiveInteger(budgetValue.maxCanopyLobes, "graphBudget/maxCanopyLobes");
  if (maxCanopyLobes < 4) {
    return vegetationFail("InvalidBudget", "graphBudget/maxCanopyLobes", "Umbrella Tree requires budget for at least four canopy lobes.");
  }

  const root = point(
    (instance.rootQuantum.x + 0.5) * MICROVOXEL_BASE_QUANTUM_METERS,
    (instance.rootQuantum.y + 0.5) * MICROVOXEL_BASE_QUANTUM_METERS,
    (instance.rootQuantum.z + 0.5) * MICROVOXEL_BASE_QUANTUM_METERS
  );
  const trunkHeightMeters = 6 + unit(instance, "trunk-height") * 8;
  const baseRadiusMeters = 0.35 + unit(instance, "base-radius") * 0.45;
  const primaryBranchCount = 5 + Math.floor(unit(instance, "primary-count") * 5);
  if (maxSecondaryBranches < primaryBranchCount) {
    return vegetationFail("InvalidBudget", "graphBudget/maxSecondaryBranches", "Every primary branch requires budget for at least one secondary branch.");
  }
  const desiredSecondaryCounts = Array.from({ length: primaryBranchCount }, (_, index) =>
    1 + Math.floor(unit(instance, `primary/${index}/secondary-count`) * 3));
  const secondaryCounts = Array(primaryBranchCount).fill(1) as number[];
  let remainingSecondaryBudget = maxSecondaryBranches - primaryBranchCount;
  for (let round = 1; round <= 2 && remainingSecondaryBudget > 0; round += 1) {
    for (let index = 0; index < primaryBranchCount && remainingSecondaryBudget > 0; index += 1) {
      if (desiredSecondaryCounts[index] > round) {
        secondaryCounts[index] += 1;
        remainingSecondaryBudget -= 1;
      }
    }
  }
  const desiredCanopyLobes = 4 + Math.floor(unit(instance, "canopy-count") * 5);
  const canopyLobeCount = Math.min(desiredCanopyLobes, maxCanopyLobes, 8);
  const yawOffset = unit(instance, "yaw-offset") * Math.PI * 2;
  const nodes: HestiaUmbrellaTreeNode[] = [];
  const segments: HestiaUmbrellaTreeSegment[] = [];

  const addNode = (
    path: string,
    role: HestiaUmbrellaTreeNodeRole,
    positionMeters: HestiaUmbrellaTreeNode["positionMeters"],
    parentNodeId: string | null
  ): HestiaUmbrellaTreeNode => {
    const node = freezeHestiaVegetationValue({ nodeId: graphId(instance, "node", path), parentNodeId, role, positionMeters });
    nodes.push(node);
    return node;
  };
  const addSegment = (
    path: string,
    role: HestiaUmbrellaTreeSegmentRole,
    materialRole: HestiaVegetationMaterialRole,
    parent: HestiaUmbrellaTreeNode,
    child: HestiaUmbrellaTreeNode,
    startRadiusMeters: number,
    endRadiusMeters: number,
    lobeRadiiMeters: HestiaUmbrellaTreeSegment["lobeRadiiMeters"] = null
  ): HestiaUmbrellaTreeSegment => {
    const segment = freezeHestiaVegetationValue({
      segmentId: graphId(instance, "segment", path),
      parentNodeId: parent.nodeId,
      childNodeId: child.nodeId,
      role,
      materialRole,
      shape: role === "canopy" ? "ellipsoid" as const : "capsule" as const,
      startRadiusMeters,
      endRadiusMeters,
      lobeRadiiMeters
    });
    segments.push(segment);
    return segment;
  };

  const rootNode = addNode("root", "root-anchor", root, null);
  const rootJunction = addNode(
    "root-junction",
    "root-junction",
    point(root.x, root.y + 0.5, root.z),
    rootNode.nodeId
  );
  addSegment("root", "root", "root", rootNode, rootJunction, baseRadiusMeters * 1.45, baseRadiusMeters, null);
  const crownNode = addNode(
    "trunk-crown",
    "trunk-crown",
    point(root.x, root.y + trunkHeightMeters, root.z),
    rootJunction.nodeId
  );
  addSegment("trunk", "trunk", "wood", rootJunction, crownNode, baseRadiusMeters, baseRadiusMeters * 0.52, null);

  const primaryTips: HestiaUmbrellaTreeNode[] = [];
  const secondaryTips: HestiaUmbrellaTreeNode[] = [];
  for (let primaryIndex = 0; primaryIndex < primaryBranchCount; primaryIndex += 1) {
    const yaw = yawOffset + primaryIndex * Math.PI * 2 / primaryBranchCount;
    const reach = 1.2 + unit(instance, `primary/${primaryIndex}/reach`) * 0.6;
    const rise = 0.25 + unit(instance, `primary/${primaryIndex}/rise`) * 0.9;
    const primary = addNode(
      `primary/${primaryIndex}`,
      "primary-tip",
      point(crownNode.positionMeters.x + Math.cos(yaw) * reach, crownNode.positionMeters.y + rise, crownNode.positionMeters.z + Math.sin(yaw) * reach),
      crownNode.nodeId
    );
    primaryTips.push(primary);
    const primaryRadius = 0.12 + unit(instance, `primary/${primaryIndex}/radius`) * 0.1;
    addSegment(`primary/${primaryIndex}`, "primary", "wood", crownNode, primary, primaryRadius, primaryRadius * 0.58, null);

    for (let secondaryIndex = 0; secondaryIndex < secondaryCounts[primaryIndex]; secondaryIndex += 1) {
      const side = secondaryIndex % 2 === 0 ? 1 : -1;
      const branchYaw = yaw + side * (0.35 + secondaryIndex * 0.24);
      const secondaryReach = 0.45 + unit(instance, `primary/${primaryIndex}/secondary/${secondaryIndex}/reach`) * 0.3;
      const secondary = addNode(
        `primary/${primaryIndex}/secondary/${secondaryIndex}`,
        "secondary-tip",
        point(
          primary.positionMeters.x + Math.cos(branchYaw) * secondaryReach,
          primary.positionMeters.y + 0.15 + unit(instance, `primary/${primaryIndex}/secondary/${secondaryIndex}/rise`) * 0.55,
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
        primaryRadius * 0.34,
        null
      );
    }
  }

  const canopyParents = secondaryTips.length > 0 ? secondaryTips : primaryTips;
  for (let lobeIndex = 0; lobeIndex < canopyLobeCount; lobeIndex += 1) {
    const parent = canopyParents[(lobeIndex * 3) % canopyParents.length];
    const yaw = yawOffset + lobeIndex * Math.PI * 2 / canopyLobeCount + unit(instance, `canopy/${lobeIndex}/yaw`) * 0.22;
    const offset = 0.2 + unit(instance, `canopy/${lobeIndex}/offset`) * 0.45;
    const center = addNode(
      `canopy/${lobeIndex}`,
      "canopy-center",
      point(
        parent.positionMeters.x + Math.cos(yaw) * offset,
        parent.positionMeters.y + 0.08 + unit(instance, `canopy/${lobeIndex}/rise`) * 0.22,
        parent.positionMeters.z + Math.sin(yaw) * offset
      ),
      parent.nodeId
    );
    const radii = freezeHestiaVegetationValue({
      x: 0.65 + unit(instance, `canopy/${lobeIndex}/radius-x`) * 0.3,
      y: 0.28 + unit(instance, `canopy/${lobeIndex}/radius-y`) * 0.2,
      z: 0.6 + unit(instance, `canopy/${lobeIndex}/radius-z`) * 0.3
    });
    addSegment(`canopy/${lobeIndex}`, "canopy", "canopy", parent, center, 0, 0, radii);
  }

  const payload = freezeHestiaVegetationValue({
    schemaVersion: HESTIA_UMBRELLA_TREE_GRAPH_SCHEMA_VERSION,
    graphId: graphId(instance, "graph", "root"),
    instanceId: instance.instanceId,
    rootNodeId: rootNode.nodeId,
    trunkHeightMeters,
    baseRadiusMeters,
    primaryBranchCount,
    secondaryBranchCount: secondaryCounts.reduce((sum, count) => sum + count, 0),
    canopyLobeCount,
    nodes: freezeHestiaVegetationValue(nodes),
    segments: freezeHestiaVegetationValue(segments)
  });
  return freezeHestiaVegetationValue({ ...payload, contentHash: hashHestiaVegetationCanonical(payload) });
};
