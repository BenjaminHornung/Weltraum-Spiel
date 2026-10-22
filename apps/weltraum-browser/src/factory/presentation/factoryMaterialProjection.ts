import { canonicalSignature } from "../../resources/serialization";
import type { ResourceContainerSnapshot } from "../../resources/containers";
import type { ResourceStack } from "../../resources/types";
import type { FactoryCatalog, FactoryItem } from "../contracts";
import type { FactoryInstallation } from "../construction/placement";
import { readRuntimeFactoryInstallationProfile, transformFactoryPoint, type FactoryVector } from "../construction/installationProfile";
import { readDryFactoryBeltPort } from "../session/dryFactorySlice";
import type {
  FactoryHostView,
  FactoryPresentationBelt,
  FactoryPresentationMachine,
  FactoryPresentationPowerLink,
  FactoryPresentationRead
} from "../session/hostPort";
import type { FactoryFacilityOwner, FactoryFacilityRead } from "../../hestia-prototype/physics/factoryFacilitySession";

export interface FactoryMaterialPowerLinkProjection {
  readonly linkId: string;
  readonly fromPortId: string;
  readonly toPortId: string;
  readonly sourceProfileDigest: string;
  readonly targetProfileDigest: string;
  readonly containerId: string;
  readonly containerRevision: number;
  readonly stackId: string;
  readonly itemId: "fp02.comp.field_cable";
  readonly itemVersion: number;
  readonly itemDigest: string;
  readonly quantityUnits: number;
  readonly lengthMm: number;
  readonly routeMm: readonly [FactoryVector, FactoryVector, FactoryVector, FactoryVector];
  readonly assetId: "play_cable_link_v1";
  readonly endAssetId: "play_cable_end_v1";
}

export type FactoryMaterialMachineRole = "input" | "wip" | "output" | "offcut" | "storage";

export interface FactoryMaterialLotProjection {
  readonly instanceId: string;
  readonly definitionSourceId: string;
  readonly profileDigest: string;
  readonly sourceDigest: string;
  readonly installationRevision: number;
  readonly role: FactoryMaterialMachineRole;
  readonly containerId: string;
  readonly containerRevision: number;
  readonly itemId: string;
  readonly itemVersion: number;
  readonly itemDigest: string;
  readonly stackId: string;
  readonly stackCount: number;
  readonly quantityUnits: number;
  readonly assetId: string;
}

export interface FactoryMaterialPacketProjection {
  readonly lineId: string;
  /** C23 component identity; the separate Native owner is lineId. */
  readonly driveInstanceId: string;
  readonly bandContainerId: string;
  readonly containerRevision: number;
  readonly packetId: string;
  readonly stackId: string;
  readonly itemId: string;
  readonly itemVersion: number;
  readonly itemDigest: string;
  readonly quantityUnits: number;
  readonly positionMm: number;
  readonly worldPositionMm: FactoryVector;
  readonly assetId: string;
}

export type FactoryMaterialProjection = Readonly<{
  links: readonly FactoryMaterialPowerLinkProjection[];
  lots: readonly FactoryMaterialLotProjection[];
  packets: readonly FactoryMaterialPacketProjection[];
}>;

const EMPTY_PROJECTION: FactoryMaterialProjection = Object.freeze({
  links: Object.freeze([]), lots: Object.freeze([]), packets: Object.freeze([])
});

const materialAssetByItem: Readonly<Record<string, string>> = Object.freeze({
  "fp02.bulk.steel_known": "play_steel_v1",
  "fp02.bulk.steel_semi": "play_semi_v1",
  "fp02.bulk.steel_profile": "play_profile_v1",
  "fp02.bulk.steel_sheet": "play_sheet_v1",
  "fp02.bulk.steel_offcut": "play_offcut_v1"
});

const integer = (value: number): boolean => Number.isSafeInteger(value);
const vector = (value: readonly number[]): value is FactoryVector => value.length === 3 && value.every(integer);
const sameVector = (left: readonly number[], right: readonly number[]): boolean => left.length === right.length
  && left.every((value, index) => value === right[index]);
const copyVector = (value: FactoryVector): FactoryVector => Object.freeze([value[0], value[1], value[2]]) as FactoryVector;

const itemByResource = (catalog: FactoryCatalog, resourceId: string): FactoryItem | undefined =>
  catalog.items.find(item => item.resourceId === resourceId);

const exactItem = (catalog: FactoryCatalog, sourceId: string): FactoryItem | undefined =>
  catalog.items.find(item => item.sourceId === sourceId);

const containerById = (material: FactoryPresentationRead["material"], id: string): ResourceContainerSnapshot | undefined => {
  const found = material.containers.filter(container => container.state.containerId === id);
  return found.length === 1 ? found[0] : undefined;
};

const exactNativeOwner = (facilities: FactoryFacilityRead, instanceId: string): FactoryFacilityOwner | undefined => {
  const found = facilities.owners.filter(owner => owner.instanceId === instanceId);
  return found.length === 1 ? found[0] : undefined;
};

const installationFor = (domain: FactoryPresentationRead, instanceId: string): FactoryInstallation | undefined => {
  const found = domain.installations.filter(installation => installation.instanceId === instanceId);
  return found.length === 1 ? found[0] : undefined;
};

const ownerMatchesInstallation = (
  installation: FactoryInstallation,
  facilities: FactoryFacilityRead
): FactoryFacilityOwner | undefined => {
  try {
    const owner = exactNativeOwner(facilities, installation.instanceId);
    if (!owner || owner.ownerId !== owner.instanceId || owner.transactionId.length === 0
      || owner.installationRevision < 1 || owner.installationRevision > facilities.revision
      || !integer(owner.installationRevision) || !Number.isFinite(owner.bodyHandle) || owner.bodyHandle < 0
      || owner.colliderHandles.length === 0 || owner.colliderHandles.some(handle => !Number.isFinite(handle) || handle < 0)
      || new Set(owner.colliderHandles).size !== owner.colliderHandles.length
      || !vector(owner.centerMm) || !vector(installation.centerMm)
      || !sameVector(owner.centerMm, installation.centerMm) || owner.quarterTurns !== installation.quarterTurns
      || !Number.isInteger(owner.quarterTurns) || owner.quarterTurns < 0 || owner.quarterTurns > 3
      || owner.definitionRef.sourceId !== installation.definitionSourceId) return undefined;
    const profile = readRuntimeFactoryInstallationProfile(installation.definitionSourceId);
    if (owner.definitionRef.version !== profile.definitionRef.version || owner.definitionRef.digest !== profile.definitionRef.digest
      || owner.sourceDigest !== installation.sourceDigest || owner.sourceDigest !== profile.sourceDigest
      || owner.profileDigest !== installation.profileDigest || owner.profileDigest !== profile.profileDigest
      || owner.massMg !== installation.massMg || owner.massMg !== profile.massMg) return undefined;
    return owner;
  } catch {
    return undefined;
  }
};

const partObservationMatches = (
  owner: FactoryFacilityOwner,
  installation: FactoryInstallation,
  domain: FactoryPresentationRead,
  facilities: FactoryFacilityRead
): boolean => {
  try {
    const observations = facilities.partObservations?.filter(row => row.instanceId === owner.instanceId) ?? [];
    if (observations.length !== 1) return false;
    const row = observations[0]!;
    const profile = readRuntimeFactoryInstallationProfile(installation.definitionSourceId);
    if (row.definitionRef.sourceId !== profile.definitionRef.sourceId || row.definitionRef.version !== profile.definitionRef.version
      || row.definitionRef.digest !== profile.definitionRef.digest || row.sourceDigest !== owner.sourceDigest
      || row.profileDigest !== owner.profileDigest || row.installationRevision !== owner.installationRevision
      || row.terrainRevision !== domain.terrainRevision || row.facilityRevision !== facilities.revision
      || !row.published || !row.confirmed || !row.complete || row.parts.length !== profile.source.parts.length) return false;
    const partIds = new Set<string>();
    for (const part of row.parts) {
      if (partIds.has(part.partId) || !profile.source.parts.some(expected => expected.partId === part.partId)
        || part.status !== "Present" || part.colliderHandles.length === 0) return false;
      partIds.add(part.partId);
    }
    const binding = { instanceId: row.instanceId, definitionRef: row.definitionRef, sourceDigest: row.sourceDigest,
      profileDigest: row.profileDigest, installationRevision: row.installationRevision, terrainRevision: row.terrainRevision,
      facilityRevision: row.facilityRevision, published: row.published, confirmed: row.confirmed,
      complete: row.complete, parts: row.parts };
    return canonicalSignature(binding) === row.observationDigest;
  } catch {
    return false;
  }
};

const machineNativeConfirmed = (
  machine: FactoryPresentationMachine,
  installation: FactoryInstallation,
  owner: FactoryFacilityOwner,
  domain: FactoryPresentationRead,
  facilities: FactoryFacilityRead
): boolean => {
  const rows = facilities.production?.filter(row => row.instanceId === machine.instanceId) ?? [];
  if (rows.length !== 1 || !machine.confirmed || machine.profileDigest !== owner.profileDigest
    || machine.sourceDigest !== owner.sourceDigest || machine.installationRevision !== owner.installationRevision) return false;
  const row = rows[0]!;
  if (!row.confirmed || row.profileDigest !== owner.profileDigest || row.sourceDigest !== owner.sourceDigest
    || row.installationRevision !== owner.installationRevision || row.terrainRevision !== domain.terrainRevision
    || row.facilityRevision !== facilities.revision) return false;
  return installation.definitionSourceId === "B05"
    ? true
    : partObservationMatches(owner, installation, domain, facilities);
};

const exactPowerPort = (
  installation: FactoryInstallation,
  owner: FactoryFacilityOwner,
  portId: string,
  domain: FactoryPresentationRead,
  facilities: FactoryFacilityRead
): NonNullable<FactoryFacilityRead["powerPorts"]>[number] | undefined => {
  try {
    const matches = facilities.powerPorts?.filter(port => port.portId === portId) ?? [];
    if (matches.length !== 1) return undefined;
    const port = matches[0]!;
    const profile = readRuntimeFactoryInstallationProfile(installation.definitionSourceId);
    const sourcePort = profile.source.ports.find(candidate => candidate.sourceId === port.sourcePortId);
    if (!sourcePort || !sourcePort.role.startsWith("Power") || port.instanceId !== installation.instanceId
      || port.portId !== `power_${installation.instanceId}` || port.profileDigest !== owner.profileDigest
      || port.sourceDigest !== owner.sourceDigest || port.installationRevision !== owner.installationRevision
      || port.terrainRevision !== domain.terrainRevision || port.facilityRevision !== facilities.revision || !port.confirmed
      || !vector(port.positionMm) || !vector(port.outwardNormal)) return undefined;
    if (["B06", "B07", "B09"].includes(installation.definitionSourceId)
      && !partObservationMatches(owner, installation, domain, facilities)) return undefined;
    const expectedPosition = transformFactoryPoint(sourcePort.centerM.map(value => value * 1000), installation.centerMm, installation.quarterTurns);
    const expectedNormal = transformFactoryPoint(sourcePort.normal, [0, 0, 0], installation.quarterTurns);
    if (!sameVector(port.positionMm, expectedPosition) || !sameVector(port.outwardNormal, expectedNormal)) return undefined;
    return port;
  } catch {
    return undefined;
  }
};

const cableStackFor = (
  link: FactoryPresentationPowerLink,
  domain: FactoryPresentationRead
): Readonly<{ container: ResourceContainerSnapshot; stack: ResourceStack; item: FactoryItem }> | undefined => {
  const item = exactItem(domain.material.catalog, "fp02.comp.field_cable");
  if (!item || item.quantityBasis !== "mm" || link.active !== true || !integer(link.lengthMm)
    || link.lengthMm <= 0 || link.lengthMm > 40_000 || link.lengthMm % 250 !== 0) return undefined;
  const prefix = "link_";
  if (!link.linkId.startsWith(prefix) || link.linkId.length === prefix.length) return undefined;
  const commandId = link.linkId.slice(prefix.length);
  if (link.containerId !== `installed_cable_${commandId}`
    || !domain.material.receipts.some(receipt => receipt.transactionId === commandId)) return undefined;
  const container = containerById(domain.material, link.containerId);
  if (!container || container.definition.maxStackCount !== 1 || container.state.contents.length !== 1) return undefined;
  const stack = container.state.contents[0]!;
  if (stack.stackId !== `cable_${commandId}` || stack.resourceId !== item.resourceId || stack.quantity !== link.lengthMm) return undefined;
  return { container, stack, item };
};

const powerLinkProjection = (
  link: FactoryPresentationPowerLink,
  domain: FactoryPresentationRead,
  facilities: FactoryFacilityRead
): FactoryMaterialPowerLinkProjection | undefined => {
  try {
    if (!link.active || link.routeMm.length !== 4 || link.routeMm.some(point => !vector(point))) return undefined;
    const sourcePorts = facilities.powerPorts?.filter(port => port.portId === link.fromPortId) ?? [];
    const targetPorts = facilities.powerPorts?.filter(port => port.portId === link.toPortId) ?? [];
    if (sourcePorts.length !== 1 || targetPorts.length !== 1) return undefined;
    const sourcePort = sourcePorts[0]!, targetPort = targetPorts[0]!;
    if (sourcePort.instanceId === targetPort.instanceId || sourcePort.role === "PowerConsumer" || targetPort.role === "PowerProducer") return undefined;
    const sourceInstallation = installationFor(domain, sourcePort.instanceId), targetInstallation = installationFor(domain, targetPort.instanceId);
    if (!sourceInstallation || !targetInstallation) return undefined;
    const sourceOwner = ownerMatchesInstallation(sourceInstallation, facilities);
    const targetOwner = ownerMatchesInstallation(targetInstallation, facilities);
    if (!sourceOwner || !targetOwner || link.sourceProfileDigest !== sourceOwner.profileDigest
      || link.targetProfileDigest !== targetOwner.profileDigest
      || !exactPowerPort(sourceInstallation, sourceOwner, link.fromPortId, domain, facilities)
      || !exactPowerPort(targetInstallation, targetOwner, link.toPortId, domain, facilities)) return undefined;
    const [first, second, third, fourth] = link.routeMm;
    if (!sameVector(first, sourcePort.positionMm) || !sameVector(fourth, targetPort.positionMm)) return undefined;
    let routeLength = 0;
    for (const [from, to] of [[first, second], [second, third], [third, fourth]] as const) {
      let changedAxes = 0;
      for (let axis = 0; axis < 3; axis++) {
        const delta = Math.abs(to[axis]! - from[axis]!);
        if (delta !== 0) changedAxes++;
        routeLength += delta;
      }
      if (changedAxes > 1) return undefined;
    }
    if (!Number.isSafeInteger(routeLength) || Math.ceil(routeLength / 250) * 250 !== link.lengthMm) return undefined;
    const paid = cableStackFor(link, domain);
    if (!paid) return undefined;
    const copiedRoute = [
      copyVector(link.routeMm[0]), copyVector(link.routeMm[1]), copyVector(link.routeMm[2]), copyVector(link.routeMm[3])
    ] as const;
    const routeMm: FactoryMaterialPowerLinkProjection["routeMm"] = Object.freeze(copiedRoute);
    return Object.freeze({ linkId: link.linkId, fromPortId: link.fromPortId, toPortId: link.toPortId,
      sourceProfileDigest: link.sourceProfileDigest, targetProfileDigest: link.targetProfileDigest,
      containerId: paid.container.state.containerId, containerRevision: paid.container.state.revision,
      stackId: paid.stack.stackId, itemId: "fp02.comp.field_cable", itemVersion: paid.item.version, itemDigest: paid.item.digest,
      quantityUnits: paid.stack.quantity, lengthMm: link.lengthMm, routeMm,
      assetId: "play_cable_link_v1", endAssetId: "play_cable_end_v1" });
  } catch {
    return undefined;
  }
};

const materialGroups = (domain: FactoryPresentationRead, container: ResourceContainerSnapshot) => {
  const groups = new Map<string, { item: FactoryItem; stackId: string; stackCount: number; quantity: bigint }>();
  for (const stack of container.state.contents) {
    const item = itemByResource(domain.material.catalog, stack.resourceId);
    if (!item || !Object.hasOwn(materialAssetByItem, item.sourceId) || !integer(stack.quantity) || stack.quantity <= 0) continue;
    const group = groups.get(item.sourceId) ?? { item, stackId: stack.stackId, stackCount: 0, quantity: 0n };
    if (group.stackCount === 0 || stack.stackId < group.stackId) group.stackId = stack.stackId;
    group.stackCount++;
    group.quantity += BigInt(stack.quantity);
    groups.set(item.sourceId, group);
  }
  return [...groups.values()].filter(group => group.quantity <= BigInt(Number.MAX_SAFE_INTEGER)
    && group.stackCount <= container.definition.maxStackCount);
};

const lotProjections = (domain: FactoryPresentationRead, facilities: FactoryFacilityRead, host: FactoryHostView): FactoryMaterialLotProjection[] => {
  const result: FactoryMaterialLotProjection[] = [];
  const roles: readonly FactoryMaterialMachineRole[] = ["input", "wip", "output", "offcut"];
  for (const machine of domain.machines) {
    try {
      if (!["B05", "B06", "B07"].includes(machine.definitionRef.sourceId)) continue;
      const installation = installationFor(domain, machine.instanceId);
      if (!installation || installation.definitionSourceId !== machine.definitionRef.sourceId
        || machine.definitionRef.version !== readRuntimeFactoryInstallationProfile(installation.definitionSourceId).definitionRef.version
        || machine.definitionRef.digest !== readRuntimeFactoryInstallationProfile(installation.definitionSourceId).definitionRef.digest) continue;
      const owner = ownerMatchesInstallation(installation, facilities);
      if (!owner || !machineNativeConfirmed(machine, installation, owner, domain, facilities)) continue;
      for (const role of roles) {
        const containerId = machine.custody[`${role}ContainerId` as "inputContainerId" | "wipContainerId" | "outputContainerId" | "offcutContainerId"];
        const expectedId = `${role}_${machine.instanceId}`;
        if (containerId !== expectedId) continue;
        if (role !== "wip") {
          const sourceRows = facilities.sources?.filter(source => source.instanceId === machine.instanceId && source.containerId === containerId) ?? [];
          if (sourceRows.length !== 1) continue;
        }
        const container = containerById(domain.material, containerId);
        if (!container || !integer(container.state.revision)) continue;
        for (const group of materialGroups(domain, container)) {
          result.push(Object.freeze({ instanceId: machine.instanceId, definitionSourceId: installation.definitionSourceId,
            profileDigest: owner.profileDigest, sourceDigest: owner.sourceDigest, installationRevision: owner.installationRevision,
            role, containerId, containerRevision: container.state.revision, itemId: group.item.sourceId,
            itemVersion: group.item.version, itemDigest: group.item.digest, stackId: group.stackId, stackCount: group.stackCount,
            quantityUnits: Number(group.quantity), assetId: materialAssetByItem[group.item.sourceId]! }));
        }
      }
    } catch {
      // A stale machine or malformed source hides only its own visual lots.
    }
  }

  if (host.input?.surface === "cargo") {
    for (const installation of domain.installations) {
      try {
        if (installation.definitionSourceId !== "B09") continue;
        const owner = ownerMatchesInstallation(installation, facilities);
        if (!owner || !partObservationMatches(owner, installation, domain, facilities)) continue;
        const containerId = `storage_${installation.instanceId}`;
        const sourceRows = facilities.sources?.filter(source => source.instanceId === installation.instanceId && source.containerId === containerId) ?? [];
        if (sourceRows.length !== 1 || sourceRows[0]!.accessible !== true) continue;
        const container = containerById(domain.material, containerId);
        if (!container || !integer(container.state.revision)) continue;
        for (const group of materialGroups(domain, container)) {
          result.push(Object.freeze({ instanceId: installation.instanceId, definitionSourceId: installation.definitionSourceId,
            profileDigest: owner.profileDigest, sourceDigest: owner.sourceDigest, installationRevision: owner.installationRevision,
            role: "storage", containerId, containerRevision: container.state.revision, itemId: group.item.sourceId,
            itemVersion: group.item.version, itemDigest: group.item.digest, stackId: group.stackId, stackCount: group.stackCount,
            quantityUnits: Number(group.quantity), assetId: materialAssetByItem[group.item.sourceId]! }));
        }
      } catch {
        // A stale storage owner or malformed source hides only its own visual lots.
      }
    }
  }
  return result;
};

const solidEndpointMatches = (
  endpoint: FactoryPresentationBelt["source"],
  role: "SolidBatchIn" | "SolidBatchOut",
  domain: FactoryPresentationRead,
  facilities: FactoryFacilityRead
): boolean => {
  try {
    if (!endpoint.confirmed) return false;
    const installation = installationFor(domain, endpoint.instanceId);
    if (!installation || installation.definitionSourceId !== endpoint.deviceId) return false;
    const owner = ownerMatchesInstallation(installation, facilities);
    if (!owner || endpoint.installRevision !== owner.installationRevision) return false;
    if (["B06", "B07", "B09"].includes(installation.definitionSourceId)
      && !partObservationMatches(owner, installation, domain, facilities)) return false;
    const bound = readDryFactoryBeltPort(domain.material.catalog, installation, endpoint.portSourceId, owner.installationRevision);
    if (bound.instanceId !== endpoint.instanceId || bound.deviceId !== endpoint.deviceId || bound.deviceDigest !== endpoint.deviceDigest
      || bound.installRevision !== endpoint.installRevision || bound.nativePortId !== endpoint.nativePortId || bound.containerId !== endpoint.containerId
      || bound.quarterTurns !== endpoint.quarterTurns || !sameVector(bound.placementCenterMm, endpoint.placementCenterMm)
      || !sameVector(bound.centerMm, endpoint.centerMm) || !sameVector(bound.outwardNormal, endpoint.outwardNormal)) return false;
    const proofs = facilities.solidPorts?.filter(proof => proof.portId === endpoint.nativePortId) ?? [];
    if (proofs.length !== 1) return false;
    const proof = proofs[0]!;
    return proof.instanceId === endpoint.instanceId && proof.sourcePortId === endpoint.portSourceId
      && proof.definitionRef.sourceId === endpoint.deviceId && proof.definitionRef.digest === endpoint.deviceDigest
      && proof.installationRevision === endpoint.installRevision && proof.sourceDigest === owner.sourceDigest
      && proof.profileDigest === owner.profileDigest && proof.terrainRevision === domain.terrainRevision
      && proof.facilityRevision === facilities.revision && proof.role === role && proof.confirmed && proof.supported
      && proof.serviceClear && proof.sweepClear && sameVector(proof.positionMm, endpoint.centerMm)
      && sameVector(proof.outwardNormal, endpoint.outwardNormal);
  } catch {
    return false;
  }
};

const paidBeltDriveMatches = (line: FactoryPresentationBelt, installation: FactoryInstallation, domain: FactoryPresentationRead): boolean => {
  const paid = containerById(domain.material, installation.materialContainerId);
  const drive = exactItem(domain.material.catalog, "fp02.comp.belt_drive");
  const module = exactItem(domain.material.catalog, "fp02.comp.belt_module");
  if (!paid || !drive || !module || paid.state.contents.length !== 5) return false;
  const driveStacks = paid.state.contents.filter(stack => stack.resourceId === drive.resourceId);
  const moduleStacks = paid.state.contents.filter(stack => stack.resourceId === module.resourceId);
  const instance = (stack: ResourceStack): string | undefined => {
    const value = stack.extensions["factory.source"];
    return value && typeof value === "object" && !Array.isArray(value)
      && "instanceId" in value && typeof value.instanceId === "string" && value.instanceId.length > 0 ? value.instanceId : undefined;
  };
  const moduleInstances = moduleStacks.map(instance);
  return driveStacks.length === 1 && driveStacks[0]!.quantity === 1 && instance(driveStacks[0]!) === line.driveInstanceId
    && moduleStacks.length === 4 && moduleStacks.every(stack => stack.quantity === 1)
    && moduleInstances.every((id): id is string => id !== undefined) && new Set(moduleInstances).size === 4;
};

const packetProjection = (
  line: FactoryPresentationBelt,
  domain: FactoryPresentationRead,
  facilities: FactoryFacilityRead
): FactoryMaterialPacketProjection | undefined => {
  try {
    const packet = line.packet;
    if (!packet || line.lengthMm !== 4_000 || line.source.confirmed !== true || line.target.confirmed !== true
      || !integer(packet.positionMm) || packet.positionMm < 0 || packet.positionMm > line.lengthMm
      || line.bandContainerId !== `belt_${line.lineId}`) return undefined;
    const installation = installationFor(domain, line.lineId);
    if (!installation || installation.definitionSourceId !== "fp06.line.belt_4m") return undefined;
    const owner = ownerMatchesInstallation(installation, facilities);
    if (!owner || !paidBeltDriveMatches(line, installation, domain)) return undefined;
    const powerPort = exactPowerPort(installation, owner, `power_${line.lineId}`, domain, facilities);
    if (!powerPort || powerPort.role !== "PowerConsumer") return undefined;
    if (!solidEndpointMatches(line.source, "SolidBatchOut", domain, facilities)
      || !solidEndpointMatches(line.target, "SolidBatchIn", domain, facilities)) return undefined;
    const [sx, sy, sz] = line.source.centerMm;
    const [tx, ty, tz] = line.target.centerMm;
    const delta: FactoryVector = [tx - sx, ty - sy, tz - sz];
    if (!delta.every(integer) || delta.reduce((sum, value) => sum + Math.abs(value), 0) !== line.lengthMm
      || !sameVector(line.source.outwardNormal.map(value => value * line.lengthMm), delta)
      || !sameVector(line.target.outwardNormal, line.source.outwardNormal.map(value => -value))) return undefined;
    const expectedCenter = [(sx + tx) / 2, (sy + ty) / 2 - 1_000, (sz + tz) / 2] as const;
    if (!sameVector(installation.centerMm, expectedCenter)) return undefined;
    const band = containerById(domain.material, line.bandContainerId);
    if (!band || band.definition.maxStackCount !== 1 || band.state.sealed || band.state.contents.length !== 1
      || domain.material.reservations.some(reservation => reservation.wipContainerId === line.bandContainerId)
      || !band.definition.transferPorts.some(port => port.portId === `band_in_${line.lineId}` && port.direction === "Inbound")
      || !band.definition.transferPorts.some(port => port.portId === `band_out_${line.lineId}` && port.direction === "Outbound")
      || !domain.material.catalog.items.some(item => item.resourceId === band.state.contents[0]!.resourceId
        && item.sourceId === packet.itemId && item.version === packet.itemVersion && item.digest === packet.itemDigest)) return undefined;
    const stack = band.state.contents[0]!;
    if (packet.packetId !== packet.stackId || stack.stackId !== packet.stackId || stack.resourceId !== exactItem(domain.material.catalog, packet.itemId)?.resourceId
      || stack.quantity <= 0 || !integer(stack.quantity)) return undefined;
    const assetId = materialAssetByItem[packet.itemId];
    if (!assetId) return undefined;
    const worldPositionMm: FactoryVector = Object.freeze([
      sx + delta[0] * packet.positionMm / line.lengthMm,
      sy + delta[1] * packet.positionMm / line.lengthMm,
      sz + delta[2] * packet.positionMm / line.lengthMm
    ]);
    if (!worldPositionMm.every(Number.isFinite)) return undefined;
    return Object.freeze({ lineId: line.lineId, driveInstanceId: line.driveInstanceId, bandContainerId: line.bandContainerId,
      containerRevision: band.state.revision, packetId: packet.packetId, stackId: stack.stackId, itemId: packet.itemId,
      itemVersion: packet.itemVersion, itemDigest: packet.itemDigest, quantityUnits: stack.quantity,
      positionMm: packet.positionMm, worldPositionMm, assetId });
  } catch {
    return undefined;
  }
};

const globallyCurrent = (domain: FactoryPresentationRead, host: FactoryHostView, facilities: FactoryFacilityRead): boolean =>
  domain.confirmed && host.confirmed && domain.sessionId === host.sessionId && domain.epoch === host.epoch
  && domain.nativeTick === host.nativeTick && domain.phase === host.physicsStatus
  && (domain.phase === "Running" || domain.phase === "Paused")
  && domain.terrainRevision === host.terrain.revision && facilities.revision === domain.facilityRevision
  && facilities.state === "Idle" && facilities.transactionId === null && facilities.prepared === null
  && domain.catalogDigest === domain.material.catalog.catalogDigest;

/** Read-only, current-owner-bound material views for the factory scene. */
export const readFactoryMaterialProjection = (input: Readonly<{
  domain: FactoryPresentationRead;
  host: FactoryHostView;
  facilities: FactoryFacilityRead;
}>): FactoryMaterialProjection => {
  try {
    const { domain, host, facilities } = input;
    if (!globallyCurrent(domain, host, facilities)) return EMPTY_PROJECTION;
    const links = domain.powerLinks.flatMap(link => {
      const projection = powerLinkProjection(link, domain, facilities);
      return projection ? [projection] : [];
    });
    const lots = lotProjections(domain, facilities, host);
    const packets = domain.belts.flatMap(line => {
      const projection = packetProjection(line, domain, facilities);
      return projection ? [projection] : [];
    });
    if (links.length === 0 && lots.length === 0 && packets.length === 0) return EMPTY_PROJECTION;
    return Object.freeze({ links: Object.freeze(links), lots: Object.freeze(lots), packets: Object.freeze(packets) });
  } catch {
    return EMPTY_PROJECTION;
  }
};
