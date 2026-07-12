import { createShipBlueprint, shipBlueprintLayoutHash } from "./blueprint";
import { canonicalJsonHash } from "./canonicalJson";
import {
  compareShipBuilderConnectionEndpoints,
  endpointOccupancyForSocketType,
  evaluatePartConnectionCompatibility,
  shipBuilderEndpointKey
} from "./compatibility";
import type {
  ShipBuilderRequiredSocketRule,
  ShipBuilderValidationPolicy
} from "./compatibility";
import {
  createShipBuilderDiagnostic,
  orderShipBuilderDiagnostics,
  shipBuilderValidationStatusForDiagnostics
} from "./diagnostics";
import type {
  ShipBuilderDiagnostic,
  ShipBuilderDiagnosticEndpoint,
  ShipBuilderDiagnosticSeverity,
  ShipBuilderValidationStatus
} from "./diagnostics";
import type { ConnectionId, PartInstanceId } from "./ids";
import type {
  ComponentKind,
  PartConnectionEndpoint,
  PartDefinition,
  PartInstance,
  PartSocket,
  ShipBlueprint,
  ShipPartCatalogSnapshot,
  SocketType
} from "./types";
import { dataError, dataPath, deepFreeze } from "./validation";

export interface ShipBuilderConnectedComponent {
  readonly instanceIds: readonly PartInstanceId[];
}

export interface ShipBuilderRootComponent extends ShipBuilderConnectedComponent {
  readonly rootInstanceId: PartInstanceId;
}

export interface ShipBuilderOccupiedSocketEndpoint {
  readonly endpoint: ShipBuilderDiagnosticEndpoint;
  /** Authoring-side grouping keeps opposite endpoint roles distinct while coalescing repeated uses within one role. */
  readonly connectionRole: "From" | "To";
  readonly connectionIds: readonly ConnectionId[];
}

export interface ShipBuilderRequiredSocketRequirement {
  readonly source: "ComponentMetadata" | "Policy";
  readonly sourceId: string;
  readonly severity: ShipBuilderDiagnosticSeverity;
}

export interface ShipBuilderUnusedRequiredSocketEndpoint {
  readonly endpoint: ShipBuilderDiagnosticEndpoint;
  readonly requirements: readonly ShipBuilderRequiredSocketRequirement[];
}

export interface ShipBlueprintStructureSummary {
  readonly enabledInstanceCount: number;
  readonly enabledConnectionCount: number;
  readonly compatibleConnectionCount: number;
  readonly structuralEdgeCount: number;
  readonly connectedComponentCount: number;
  readonly disconnectedInstanceCount: number;
  readonly occupiedSocketEndpointCount: number;
  readonly requiredSocketEndpointCount: number;
  readonly unusedRequiredSocketEndpointCount: number;
  readonly diagnosticCount: number;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly infoCount: number;
}

export interface ShipBlueprintStructureReportPayload {
  readonly reportVersion: 1;
  readonly catalogSignature: string;
  readonly blueprintLayoutHash: string;
  readonly policySignature: string;
  readonly status: ShipBuilderValidationStatus;
  readonly diagnostics: readonly ShipBuilderDiagnostic[];
  readonly connectedComponents: readonly ShipBuilderConnectedComponent[];
  readonly rootComponent: ShipBuilderRootComponent | null;
  readonly disconnectedInstanceIds: readonly PartInstanceId[];
  readonly occupiedSocketEndpoints: readonly ShipBuilderOccupiedSocketEndpoint[];
  readonly unusedRequiredSocketEndpoints: readonly ShipBuilderUnusedRequiredSocketEndpoint[];
  readonly summary: ShipBlueprintStructureSummary;
}

export interface ShipBlueprintStructureReport extends ShipBlueprintStructureReportPayload {
  readonly signature: string;
}

interface OccupiedEndpointAccumulator {
  readonly endpoint: ShipBuilderDiagnosticEndpoint;
  readonly socketType: SocketType;
  readonly connectionIds: Set<ConnectionId>;
}

interface OccupiedEndpointRoleAccumulator {
  readonly endpoint: ShipBuilderDiagnosticEndpoint;
  readonly connectionRole: "From" | "To";
  readonly connectionIds: Set<ConnectionId>;
}

interface RequiredEndpointRecord {
  readonly endpoint: ShipBuilderDiagnosticEndpoint;
  readonly requirements: readonly ShipBuilderRequiredSocketRequirement[];
  readonly instanceIndex: number;
}

const compareText = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

const resolvedDefinition = (
  instance: PartInstance,
  catalog: ShipPartCatalogSnapshot
): PartDefinition => {
  const definition = catalog.indexes.partById[instance.partDefinitionId];
  if (definition === undefined) {
    throw dataError("UnknownReference", "/instances", "Part definition is missing after blueprint validation.");
  }
  return definition;
};

const resolvedSocket = (
  endpoint: PartConnectionEndpoint,
  blueprint: ShipBlueprint,
  catalog: ShipPartCatalogSnapshot
): PartSocket => {
  const instance = blueprint.instances.find((candidate) => candidate.stableInstanceId === endpoint.partInstanceId);
  if (instance === undefined) {
    throw dataError("UnknownInstance", "/connections", "Connection instance is missing after blueprint validation.");
  }
  const socket = resolvedDefinition(instance, catalog).sockets.find((candidate) => candidate.socketId === endpoint.socketId);
  if (socket === undefined) {
    throw dataError("UnknownSocket", "/connections", "Connection socket is missing after blueprint validation.");
  }
  return socket;
};

const policyRuleMatchesSocket = (
  rule: ShipBuilderRequiredSocketRule,
  definition: PartDefinition,
  socket: PartSocket
): boolean => {
  const componentKinds = [...new Set(definition.components.map((component) => component.kind))] as ComponentKind[];
  return (
    (rule.partDefinitionIds.length === 0 || rule.partDefinitionIds.includes(definition.partDefinitionId)) &&
    (rule.categoryIds.length === 0 || rule.categoryIds.includes(definition.categoryId)) &&
    (rule.componentKinds.length === 0 || rule.componentKinds.some((kind) => componentKinds.includes(kind))) &&
    (rule.socketTypes.length === 0 || rule.socketTypes.includes(socket.socketType)) &&
    (rule.socketIds.length === 0 || rule.socketIds.includes(socket.socketId))
  );
};

const requirementSeverityRank: Readonly<Record<ShipBuilderDiagnosticSeverity, number>> = Object.freeze({
  Error: 0,
  Warning: 1,
  Info: 2
});

const compareRequirements = (
  left: ShipBuilderRequiredSocketRequirement,
  right: ShipBuilderRequiredSocketRequirement
): number => {
  const sourceComparison = compareText(left.source, right.source);
  if (sourceComparison !== 0) {
    return sourceComparison;
  }
  const idComparison = compareText(left.sourceId, right.sourceId);
  return idComparison !== 0 ? idComparison : requirementSeverityRank[left.severity] - requirementSeverityRank[right.severity];
};

const requirementsForSocket = (
  definition: PartDefinition,
  socket: PartSocket,
  policy: ShipBuilderValidationPolicy
): readonly ShipBuilderRequiredSocketRequirement[] => {
  const componentIds = new Set(definition.components.map((component) => component.componentId));
  const requirements: ShipBuilderRequiredSocketRequirement[] = socket.requiredForComponentIds
    .filter((componentId) => componentIds.has(componentId))
    .map((componentId) => ({ source: "ComponentMetadata", sourceId: componentId, severity: "Error" }));

  for (const rule of policy.requiredSocketRules) {
    if (policyRuleMatchesSocket(rule, definition, socket)) {
      requirements.push({ source: "Policy", sourceId: rule.ruleId, severity: rule.severity });
    }
  }

  return requirements.sort(compareRequirements);
};

const connectedComponentsFor = (
  enabledInstanceIds: readonly PartInstanceId[],
  adjacency: ReadonlyMap<PartInstanceId, ReadonlySet<PartInstanceId>>
): readonly ShipBuilderConnectedComponent[] => {
  const unvisited = new Set(enabledInstanceIds);
  const components: ShipBuilderConnectedComponent[] = [];

  for (const firstInstanceId of enabledInstanceIds) {
    if (!unvisited.has(firstInstanceId)) {
      continue;
    }

    const pending: PartInstanceId[] = [firstInstanceId];
    const instanceIds: PartInstanceId[] = [];
    unvisited.delete(firstInstanceId);
    while (pending.length > 0) {
      const current = pending.shift();
      if (current === undefined) {
        break;
      }
      instanceIds.push(current);
      const neighbors = [...(adjacency.get(current) ?? [])].sort(compareText);
      for (const neighbor of neighbors) {
        if (unvisited.delete(neighbor)) {
          pending.push(neighbor);
        }
      }
    }

    instanceIds.sort(compareText);
    components.push({ instanceIds });
  }

  return components.sort((left, right) => compareText(left.instanceIds[0], right.instanceIds[0]));
};

const definitionHasComponentKind = (
  instance: PartInstance,
  catalog: ShipPartCatalogSnapshot,
  componentKind: ComponentKind
): boolean => resolvedDefinition(instance, catalog).components.some((component) => component.kind === componentKind);

export const validateShipBlueprintStructure = (
  source: unknown,
  catalog: ShipPartCatalogSnapshot,
  policy: ShipBuilderValidationPolicy
): ShipBlueprintStructureReport => {
  const blueprint = createShipBlueprint(source, { catalog });
  const enabledInstances = blueprint.instances.filter((instance) => instance.enabled);
  const enabledInstanceIds = enabledInstances.map((instance) => instance.stableInstanceId);
  const instanceById = new Map(blueprint.instances.map((instance) => [instance.stableInstanceId, instance]));
  const adjacency = new Map<PartInstanceId, Set<PartInstanceId>>(
    enabledInstanceIds.map((instanceId) => [instanceId, new Set<PartInstanceId>()])
  );
  const occupancy = new Map<string, OccupiedEndpointAccumulator>();
  const occupiedEndpointRoles = new Map<string, OccupiedEndpointRoleAccumulator>();
  const diagnostics: ShipBuilderDiagnostic[] = [];
  let compatibleConnectionCount = 0;
  let structuralEdgeCount = 0;

  if (enabledInstances.length === 0) {
    diagnostics.push(
      createShipBuilderDiagnostic({
        code: "NoEnabledInstances",
        severity: "Error",
        phase: "Blueprint",
        path: "/instances"
      })
    );
  }

  for (const connection of blueprint.connections) {
    if (!connection.enabled) {
      continue;
    }

    const compatibility = evaluatePartConnectionCompatibility(connection, blueprint, catalog, policy);
    diagnostics.push(...compatibility.diagnostics);
    if (compatibility.status === "Compatible") {
      compatibleConnectionCount += 1;
    }

    const fromInstance = instanceById.get(connection.from.partInstanceId);
    const toInstance = instanceById.get(connection.to.partInstanceId);
    if (fromInstance === undefined || toInstance === undefined) {
      throw dataError("UnknownInstance", "/connections", "Connection instance is missing after blueprint validation.");
    }

    if (fromInstance.enabled && toInstance.enabled) {
      const connectionEndpoints = [
        ["From", connection.from],
        ["To", connection.to]
      ] as const;
      for (const [connectionRole, endpoint] of connectionEndpoints) {
        const key = shipBuilderEndpointKey(endpoint);
        const existing = occupancy.get(key);
        if (existing !== undefined) {
          existing.connectionIds.add(connection.connectionId);
        } else {
          occupancy.set(key, {
            endpoint: { partInstanceId: endpoint.partInstanceId, socketId: endpoint.socketId },
            socketType: resolvedSocket(endpoint, blueprint, catalog).socketType,
            connectionIds: new Set([connection.connectionId])
          });
        }

        const roleKey = `${connectionRole}:${key}`;
        const existingRole = occupiedEndpointRoles.get(roleKey);
        if (existingRole !== undefined) {
          existingRole.connectionIds.add(connection.connectionId);
        } else {
          occupiedEndpointRoles.set(roleKey, {
            endpoint: { partInstanceId: endpoint.partInstanceId, socketId: endpoint.socketId },
            connectionRole,
            connectionIds: new Set([connection.connectionId])
          });
        }
      }
    }

    if (compatibility.contributesToStructure) {
      adjacency.get(connection.from.partInstanceId)?.add(connection.to.partInstanceId);
      adjacency.get(connection.to.partInstanceId)?.add(connection.from.partInstanceId);
      structuralEdgeCount += 1;
    }
  }

  const occupiedWithSocketTypes = [...occupancy.values()].sort((left, right) =>
    compareShipBuilderConnectionEndpoints(left.endpoint, right.endpoint)
  );
  const occupiedSocketEndpoints: ShipBuilderOccupiedSocketEndpoint[] = [...occupiedEndpointRoles.values()]
    .sort((left, right) => {
      const endpointComparison = compareShipBuilderConnectionEndpoints(left.endpoint, right.endpoint);
      return endpointComparison !== 0 ? endpointComparison : compareText(left.connectionRole, right.connectionRole);
    })
    .map((occupied) => ({
      endpoint: occupied.endpoint,
      connectionRole: occupied.connectionRole,
      connectionIds: [...occupied.connectionIds].sort(compareText)
    }));

  for (let index = 0; index < occupiedWithSocketTypes.length; index += 1) {
    const occupied = occupiedWithSocketTypes[index];
    const connectionIds = [...occupied.connectionIds].sort(compareText);
    if (connectionIds.length > 1 && endpointOccupancyForSocketType(policy, occupied.socketType) === "Exclusive") {
      const occupiedIndex = occupiedSocketEndpoints.findIndex(
        (candidate) => compareShipBuilderConnectionEndpoints(candidate.endpoint, occupied.endpoint) === 0
      );
      diagnostics.push(
        createShipBuilderDiagnostic({
          code: "ExclusiveSocketOccupiedMultipleTimes",
          severity: "Error",
          phase: "Occupancy",
          path: dataPath("/occupiedSocketEndpoints", occupiedIndex),
          instanceIds: [occupied.endpoint.partInstanceId],
          connectionIds,
          endpoints: [occupied.endpoint],
          details: { occupancy: "Exclusive", socketType: occupied.socketType }
        })
      );
    }
  }

  const allRequiredEndpoints: RequiredEndpointRecord[] = [];
  const unusedRequiredSocketEndpoints: ShipBuilderUnusedRequiredSocketEndpoint[] = [];
  for (let instanceIndex = 0; instanceIndex < blueprint.instances.length; instanceIndex += 1) {
    const instance = blueprint.instances[instanceIndex];
    if (!instance.enabled) {
      continue;
    }
    const definition = resolvedDefinition(instance, catalog);
    for (const socket of definition.sockets) {
      const requirements = requirementsForSocket(definition, socket, policy);
      if (requirements.length === 0) {
        continue;
      }
      const endpoint = { partInstanceId: instance.stableInstanceId, socketId: socket.socketId };
      const requiredEndpoint = { endpoint, requirements, instanceIndex };
      allRequiredEndpoints.push(requiredEndpoint);
      if (occupancy.has(shipBuilderEndpointKey(endpoint))) {
        continue;
      }

      unusedRequiredSocketEndpoints.push({ endpoint, requirements });
      for (const requirement of requirements) {
        diagnostics.push(
          createShipBuilderDiagnostic({
            code: "RequiredSocketUnused",
            severity: requirement.severity,
            phase: "RequiredSockets",
            path: dataPath(dataPath(dataPath("/instances", instanceIndex), "sockets"), socket.socketId),
            instanceIds: [instance.stableInstanceId],
            endpoints: [endpoint],
            details: {
              requirementSource: requirement.source,
              requirementId: requirement.sourceId
            }
          })
        );
      }
    }
  }
  allRequiredEndpoints.sort((left, right) => compareShipBuilderConnectionEndpoints(left.endpoint, right.endpoint));
  unusedRequiredSocketEndpoints.sort((left, right) =>
    compareShipBuilderConnectionEndpoints(left.endpoint, right.endpoint)
  );

  const connectedComponents = connectedComponentsFor(enabledInstanceIds, adjacency);
  const rootInstance =
    enabledInstances.find((instance) => definitionHasComponentKind(instance, catalog, "ControlCore")) ??
    enabledInstances.find((instance) => definitionHasComponentKind(instance, catalog, "Structural")) ??
    enabledInstances[0];
  const rootConnectedComponent = rootInstance === undefined
    ? undefined
    : connectedComponents.find((component) => component.instanceIds.includes(rootInstance.stableInstanceId));
  const rootComponent = rootInstance === undefined || rootConnectedComponent === undefined
    ? null
    : {
        rootInstanceId: rootInstance.stableInstanceId,
        instanceIds: rootConnectedComponent.instanceIds
      };
  const rootInstanceIds = new Set(rootComponent?.instanceIds ?? []);
  const disconnectedInstanceIds = enabledInstanceIds.filter((instanceId) => !rootInstanceIds.has(instanceId));
  if (disconnectedInstanceIds.length > 0) {
    diagnostics.push(
      createShipBuilderDiagnostic({
        code: "DisconnectedInstances",
        severity: "Error",
        phase: "Graph",
        path: "/disconnectedInstanceIds",
        instanceIds: disconnectedInstanceIds,
        details: { rootInstanceId: rootComponent?.rootInstanceId ?? null }
      })
    );
  }

  const orderedDiagnostics = orderShipBuilderDiagnostics(diagnostics);
  const status = shipBuilderValidationStatusForDiagnostics(orderedDiagnostics);
  const summary: ShipBlueprintStructureSummary = {
    enabledInstanceCount: enabledInstances.length,
    enabledConnectionCount: blueprint.connections.filter((connection) => connection.enabled).length,
    compatibleConnectionCount,
    structuralEdgeCount,
    connectedComponentCount: connectedComponents.length,
    disconnectedInstanceCount: disconnectedInstanceIds.length,
    occupiedSocketEndpointCount: occupiedSocketEndpoints.length,
    requiredSocketEndpointCount: allRequiredEndpoints.length,
    unusedRequiredSocketEndpointCount: unusedRequiredSocketEndpoints.length,
    diagnosticCount: orderedDiagnostics.length,
    errorCount: orderedDiagnostics.filter((diagnostic) => diagnostic.severity === "Error").length,
    warningCount: orderedDiagnostics.filter((diagnostic) => diagnostic.severity === "Warning").length,
    infoCount: orderedDiagnostics.filter((diagnostic) => diagnostic.severity === "Info").length
  };

  const payload: ShipBlueprintStructureReportPayload = {
    reportVersion: 1,
    catalogSignature: catalog.signature,
    blueprintLayoutHash: shipBlueprintLayoutHash(blueprint),
    policySignature: policy.signature,
    status,
    diagnostics: orderedDiagnostics,
    connectedComponents,
    rootComponent,
    disconnectedInstanceIds,
    occupiedSocketEndpoints,
    unusedRequiredSocketEndpoints,
    summary
  };

  return deepFreeze({
    ...payload,
    signature: canonicalJsonHash(payload)
  }) as ShipBlueprintStructureReport;
};
