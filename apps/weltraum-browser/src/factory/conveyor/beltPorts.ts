import type { MaterialView } from "../material/reservations";
import { safeWhole } from "../material/quantity";
import { isSaveSafeResourceId } from "../../resources/ids";

/** Runtime tuples are east x, height y, north z; W07 supplies installed native facts. */
export interface BeltInstalledPort {
  readonly instanceId: string; readonly installRevision: number;
  readonly deviceId: string; readonly deviceDigest: string; readonly portSourceId: string;
  readonly containerId: string; readonly nativePortId: string;
  readonly placementCenterMm: readonly [number, number, number];
  readonly quarterTurns: 0 | 1 | 2 | 3;
  readonly centerMm: readonly [number, number, number];
  readonly outwardNormal: readonly [number, number, number];
}
export interface BeltInstallation {
  readonly version: "fp06-straight-installed-belt-v1";
  readonly installationId: string; readonly revision: number;
  readonly catalogDigest: string; readonly sourceProfileDigest: string;
  readonly source: BeltInstalledPort; readonly target: BeltInstalledPort;
  readonly lengthMm: number; readonly moduleInstanceIds: readonly string[];
  readonly driveInstanceId: string; readonly powerPortId: string;
  readonly consumerId: string; readonly jobId: string;
  readonly bandContainerId: string; readonly bandInPortId: string; readonly bandOutPortId: string;
}
const require = (condition: boolean, reason: string): void => { if (!condition) throw new Error(reason); };
const same = (a: readonly number[], b: readonly number[]): boolean => a.length === b.length && a.every((n, i) => n === b[i]);
const rotate = ([x, y, z]: readonly number[], turns: number): readonly number[] =>
  turns === 0 ? [x, y, z] : turns === 1 ? [-z, y, x] : turns === 2 ? [-x, y, -z] : [z, y, -x];
/** FP02 main Solid ports, derived from frozen recipes; offcut uses its separate cassette. */
export const BELT_PORT_RECIPE_BINDING_VERSION = "fp02-solid-port-recipe-binding-v1";
const processPorts: Readonly<Record<string, Readonly<{ recipes: readonly string[]; side: "inputs" | "outputs" }>>> = Object.freeze({
  "B06:IN-STEEL": { recipes: ["REC-01-CUT"], side: "inputs" },
  "B06:OUT-SEMI": { recipes: ["REC-01-CUT"], side: "outputs" },
  "B07:IN-SEMI": { recipes: ["REC-02-PROFILE", "REC-03-SHEET"], side: "inputs" },
  "B07:OUT-PROFILE-OR-SHEET": { recipes: ["REC-02-PROFILE", "REC-03-SHEET"], side: "outputs" },
  "B08:IN-ROCK": { recipes: ["REC-04-CRUSH"], side: "inputs" },
  "B08:OUT-GRAVEL": { recipes: ["REC-04-CRUSH"], side: "outputs" }
});
export function assertFactoryBeltItemPorts(installation: BeltInstallation, itemId: string, material: MaterialView): void {
  for (const port of [installation.source, installation.target]) {
    if (port.portSourceId === "B09:MAT-IN" || port.portSourceId === "B09:MAT-OUT") continue;
    const binding = processPorts[port.portSourceId];
    require(!!binding && itemId !== "fp02.bulk.steel_offcut" && binding.recipes.some((id) =>
      material.catalog.recipes.find((recipe) => recipe.sourceId === id)?.[binding.side].some((term) => term.itemId === itemId)), "BeltPortMaterialFamilyMismatch");
  }
}
export function assertFactoryBeltPorts(installation: BeltInstallation, material: MaterialView): void {
  const i = installation;
  require(i.version === "fp06-straight-installed-belt-v1", "UnknownBeltInstallationVersion");
  safeWhole(i.revision, "BeltInstallRevision");
  require(i.catalogDigest === material.catalog.catalogDigest, "BeltCatalogMismatch");
  require(typeof i.sourceProfileDigest === "string" && i.sourceProfileDigest.length > 0, "UnboundBeltSourceProfile");
  for (const id of [i.installationId, i.driveInstanceId, i.powerPortId, i.consumerId, i.jobId,
    i.bandContainerId, i.bandInPortId, i.bandOutPortId, ...i.moduleInstanceIds]) require(isSaveSafeResourceId(id), "InvalidBeltId");
  safeWhole(i.lengthMm, "BeltLength");
  require(i.lengthMm % 1_000 === 0 && i.lengthMm <= material.catalog.conveyor.maxFixtureLineLengthMm,
    "UnsupportedBeltLength");
  require(i.moduleInstanceIds.length === i.lengthMm / 1_000 && new Set(i.moduleInstanceIds).size === i.moduleInstanceIds.length
    && !i.moduleInstanceIds.includes(i.driveInstanceId), "InvalidPaidBeltModuleBinding");
  require(new Set([i.source.containerId, i.target.containerId, i.bandContainerId]).size === 3, "AliasedBeltCustody");
  for (const [p, expectedRole, nativeDirection] of [[i.source, "SolidBatchOut", "Outbound"], [i.target, "SolidBatchIn", "Inbound"]] as const) {
    require([p.instanceId, p.containerId, p.nativePortId].every(isSaveSafeResourceId), "InvalidBeltPortId");
    safeWhole(p.installRevision, "BeltPortInstallRevision");
    require(Number.isInteger(p.quarterTurns) && p.quarterTurns >= 0 && p.quarterTurns <= 3, "InvalidBeltPortRotation");
    const device = material.catalog.devices.find((d) => d.sourceId === p.deviceId);
    const port = device?.ports.find((entry) => entry.sourceId === p.portSourceId);
    require(!!device && device.digest === p.deviceDigest && !!port && port.role === expectedRole && port.externallyConnectable
      && port.centerMm !== null && port.outwardNormal !== null && port.sizeMm?.[0] === 750 && port.sizeMm[1] === 750,
      "IncompatibleBeltCatalogPort");
    require(p.placementCenterMm.length === 3 && p.placementCenterMm.every((n) => Number.isSafeInteger(n) && n % 250 === 0)
      && p.centerMm.length === 3 && p.centerMm.every(Number.isSafeInteger), "InvalidBeltPortPlacement");
    const local = port!.centerMm!;
    const rotated = rotate([local[0], local[2], local[1]], p.quarterTurns);
    const normal = port!.outwardNormal!;
    require(same(p.centerMm, rotated.map((n, k) => n + p.placementCenterMm[k]))
      && same(p.outwardNormal, rotate([normal[0], normal[2], normal[1]], p.quarterTurns)), "BeltPortPoseMismatch");
    const snapshot = material.containers.find((entry) => entry.state.containerId === p.containerId);
    const native = snapshot?.definition.transferPorts.find((entry) => entry.portId === p.nativePortId);
    require(!!native && (native.direction === nativeDirection || native.direction === "Bidirectional"), "MissingNativeBeltPort");
  }
  require(i.source.instanceId !== i.target.instanceId && i.source.instanceId !== i.driveInstanceId && i.target.instanceId !== i.driveInstanceId,
    "AliasedBeltInstallation");
  const delta = i.target.centerMm.map((n, k) => n - i.source.centerMm[k]);
  require(i.source.outwardNormal[1] === 0 && same(delta, i.source.outwardNormal.map((n) => n * i.lengthMm))
    && same(i.target.outwardNormal, i.source.outwardNormal.map((n) => -n)), "InvalidDirectedBeltRoute");
  const band = material.containers.find((entry) => entry.state.containerId === i.bandContainerId);
  require(!!band && band.definition.maxStackCount === 1 && band.definition.maxMassKg <= 10 && !band.state.sealed,
    "UnboundedBeltCustodyContainer");
  for (const [id, direction] of [[i.bandInPortId, "Inbound"], [i.bandOutPortId, "Outbound"]]) {
    require(band!.definition.transferPorts.some((port) => port.portId === id && (port.direction === direction || port.direction === "Bidirectional")),
      "MissingNativeBeltCustodyPort");
  }
  require(!material.reservations.some((reservation) => reservation.wipContainerId === i.bandContainerId), "ReservedBeltCustodyContainer");
}
