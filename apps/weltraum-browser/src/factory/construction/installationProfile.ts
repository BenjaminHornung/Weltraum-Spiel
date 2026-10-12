import type { FactoryTerm } from "../contracts";
import { getFactoryAssetSource,readFactoryAssetDefinition, type FactoryAssetSource } from "../presentation/factoryAssets";
import { canonicalJson, canonicalSignature } from "../../resources/serialization";

export type FactoryVector = readonly [number, number, number];
export interface FactoryBoundsMm { readonly min: FactoryVector; readonly max: FactoryVector }
export interface FactoryInstallationProfile {
  readonly version: "fp06-installation-profile-v1";
  readonly definitionRef: Readonly<{ sourceId: string; version: number; digest: string }>;
  readonly sourceDigest: string; readonly profileDigest: string; readonly canonicalJson: string;
  readonly source: FactoryAssetSource; readonly massMg: number; readonly bom: readonly FactoryTerm[];
  readonly colliders: readonly Readonly<{ partId: string; centerMm: FactoryVector; sizeMm: FactoryVector; rotationZRadians: number }>[];
  readonly supportPatchesMm: readonly Readonly<{ centerMm: FactoryVector; sizeMm: readonly [number, number] }>[];
  readonly boundsMm: FactoryBoundsMm; readonly sourceServiceBoundsMm: FactoryBoundsMm; readonly servicePolicy: Readonly<{ version:"fp06-normative-service-binding-v1"; sourceRefs:readonly string[]; method:string }>; readonly serviceBoundsMm: FactoryBoundsMm; readonly sweepBoundsMm: readonly FactoryBoundsMm[];
}
const vectorMm = (v: readonly number[]): FactoryVector => Object.freeze([v[0]! * 1000, v[1]! * 1000, v[2]! * 1000]);
export const transformFactoryPoint = (point: readonly number[], centerMm: readonly number[], quarterTurns: number): FactoryVector => {
  if (point.length !== 3 || centerMm.length !== 3 || ![...point, ...centerMm].every(Number.isFinite) || !Number.isInteger(quarterTurns) || quarterTurns < 0 || quarterTurns > 3) throw new Error("Invalid Factory transform");
  const [x, y, z] = point as FactoryVector;
  const rotated: FactoryVector = quarterTurns === 0 ? [x,y,z] : quarterTurns === 1 ? [z,y,-x] : quarterTurns === 2 ? [-x,y,-z] : [-z,y,x];
  return Object.freeze([rotated[0] + centerMm[0]!, rotated[1] + centerMm[1]!, rotated[2] + centerMm[2]!]);
};
export const transformFactoryBounds = (bounds: FactoryBoundsMm, centerMm: readonly number[], turns: number): FactoryBoundsMm => {
  const a = transformFactoryPoint(bounds.min, centerMm, turns), b = transformFactoryPoint(bounds.max, centerMm, turns);
  return Object.freeze({ min: Object.freeze(a.map((v,i) => Math.min(v,b[i]!))) as FactoryVector, max: Object.freeze(a.map((v,i) => Math.max(v,b[i]!))) as FactoryVector });
};
/** Versioned technical binding. Frozen W01 POWER pose remains null; S0 authoring poses remain marked authoring-only. */
export const createFactoryInstallationProfile = (sourceId: string): FactoryInstallationProfile => {
  const definition = readFactoryAssetDefinition(sourceId);
  if (!definition) throw new Error("Unknown Factory installation definition");
  const source = getFactoryAssetSource(sourceId);
  const bom = "bom" in definition ? definition.bom : [{ itemId: sourceId, quantityUnits: 1 }];
  const massMg = "massMg" in definition ? definition.massMg : definition.massMgPerUnit;
  const boxes = source.parts.flatMap(part => part.boxes.map(box => Object.freeze({ partId: part.partId, centerMm: vectorMm(box.centerM), sizeMm: vectorMm(box.sizeM), rotationZRadians: box.rotationZRadians ?? 0 })));
  const min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity];
  for (const box of boxes) {
    const cos = Math.abs(Math.cos(box.rotationZRadians)), sin = Math.abs(Math.sin(box.rotationZRadians));
    const extent = [(cos*box.sizeMm[0]+sin*box.sizeMm[1])/2,(sin*box.sizeMm[0]+cos*box.sizeMm[1])/2,box.sizeMm[2]/2];
    for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i]!,box.centerMm[i]!-extent[i]!); max[i] = Math.max(max[i]!,box.centerMm[i]!+extent[i]!); }
  }
  const data = { version: "fp06-installation-profile-v1" as const, definitionRef: { sourceId, version: definition.version, digest: definition.digest },
    sourceDigest: canonicalSignature(source), source, massMg, bom, colliders: boxes,
    supportPatchesMm: source.supportPatchesM.map(patch => Object.freeze({ centerMm: vectorMm(patch.centerM), sizeMm: Object.freeze(patch.sizeM.map(v => v*1000)) as readonly [number,number] })),
    boundsMm: { min: min as unknown as FactoryVector, max: max as unknown as FactoryVector },
    sourceServiceBoundsMm: { min: vectorMm(source.serviceBoundsM.min), max: vectorMm(source.serviceBoundsM.max) },
    servicePolicy: {version:"fp06-normative-service-binding-v1" as const,sourceRefs:sourceId==="B06"?["FP02:7:B06","FP02:9.2","FP03:4.4:minimum-1m-service","FP03:13.1:1m-side-service","approved:factory-startsite-v1:cutter-service"]:source.sourceRefs,method:sourceId==="B06"?"full-one-meter-adjacent-to-proven-north-body-edge":"unchanged-source-authoring-service"},
    serviceBoundsMm: sourceId==="B06"?{min:[-1500,0,1000] as const,max:[1500,2000,2000] as const}:{ min: vectorMm(source.serviceBoundsM.min), max: vectorMm(source.serviceBoundsM.max) },
    sweepBoundsMm: source.joints.map(joint => ({ min: vectorMm(joint.sweepBoundsM.min), max: vectorMm(joint.sweepBoundsM.max) })) };
  const bytes = canonicalJson(data);
  // All descendants originate in frozen catalog/source data or are immutable numerical projections.
  const freeze = <T>(v:T):T => { if (v && typeof v === "object" && !Object.isFrozen(v)) { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
  return freeze({ ...data, canonicalJson: bytes, profileDigest: canonicalSignature(data) });
};
