import { canonicalJson, canonicalSignature, canonicalizeJsonValue } from "../../resources/serialization";
import { createResourceContainerState } from "../../resources/containers";
import { loadFactoryCatalog } from "../catalog/fp02Catalog";
import type { ResourceContainerState } from "../../resources/containers";
import type { FactoryCatalog } from "../contracts";
import { FACTORY_POWER_POLICY } from "./factoryPower";
import type { FactoryPowerBinding, FactoryPowerPort, FactoryPowerLink, FactoryPowerSupply } from "./factoryPower";
export interface FactoryInstalledPowerAsset {
  readonly instanceId: string; readonly cargoId: "C01" | "C02" | "C03";
  readonly itemSourceId: string; readonly definitionVersion: number; readonly definitionDigest: string;
  readonly containerId: string; readonly ownerId: string; readonly portId: string;
  readonly installationRevision: number; readonly confirmed: boolean;
}
export interface FactoryFixedNetObservation {
  readonly version: "fp01-fixed-net-observation-v1";
  readonly binding: FactoryPowerBinding; readonly tickStartUs: string; readonly tickEndUs: string;
  readonly profileId: "WX-FAV-01" | "FIXED-NET-OBSERVATION";
  readonly quality: "confirmed" | "pending" | "unsupported";
  /** Net-side values after generator conversion, not a climate/curve implementation. */
  readonly values: readonly Readonly<{ instanceId: string; availableMilliWatt: string }>[];
}
export interface FactoryPowerSourceSnapshot {
  readonly binding: FactoryPowerBinding; readonly tickStartUs: string; readonly tickEndUs: string;
  readonly installed: readonly FactoryInstalledPowerAsset[];
  /** Read-only current Resources authority snapshots, including cargo and installed stores. */
  readonly resourceContainers: readonly ResourceContainerState[];
  readonly ports: readonly FactoryPowerPort[]; readonly links: readonly FactoryPowerLink[];
  readonly observation: FactoryFixedNetObservation | null;
}
const cmp=(a:string,b:string):number=>a<b?-1:a>b?1:0;
const requireUint=(value:string,max:bigint):bigint=>{
  if(typeof value!=="string"||!/^(0|[1-9][0-9]{0,18})$/.test(value)||BigInt(value)>max) throw new Error("InvalidSourceInteger");
  return BigInt(value);
};
const unique=<T>(values:readonly T[],key:(value:T)=>string,max:number):void=>{
  if(!Array.isArray(values)||values.length>max) throw new Error("SourceCollectionBound");
  const seen=new Set<string>(); for(const v of values) {const k=key(v); if(seen.has(k)) throw new Error("DuplicateSourceIdentity"); seen.add(k);}
};
/** Consumes confirmed installation and CURRENT real Resources snapshots. It
 * never installs, transfers, creates cargo, initializes/fills SOC, or samples
 * the renderer. Unknown climate/curves yield zero, not nameplate generation. */
export const prepareFactoryPowerSources=(catalog:FactoryCatalog,snapshot:FactoryPowerSourceSnapshot):FactoryPowerSupply=>{
  if(snapshot.binding.sourceProfileDigest!==FACTORY_POWER_POLICY.sourceObservationVersion) throw new Error("UnsupportedSourceProfile");
  const checked=loadFactoryCatalog(JSON.parse(catalog.canonicalJson));
  if(checked.catalogDigest!==catalog.catalogDigest||snapshot.binding.catalogDigest!==checked.catalogDigest) throw new Error("SourceCatalogMismatch");
  requireUint(snapshot.tickStartUs,9_223_372_036_854_775_807n); requireUint(snapshot.tickEndUs,9_223_372_036_854_775_807n);
  if(BigInt(snapshot.tickEndUs)<=BigInt(snapshot.tickStartUs)) throw new Error("InvalidSourceInterval");
  unique(snapshot.installed,a=>a.instanceId,7); unique(snapshot.resourceContainers,c=>c.containerId,128);
  const containers=new Map(snapshot.resourceContainers.map(c=>{
    const validated=createResourceContainerState(c,checked.resources);
    if(validated.canonicalJson!==c.canonicalJson||validated.signature!==c.signature) throw new Error("ResourceBytesMismatch");
    return [c.containerId,validated] as const;
  }));
  const observation=snapshot.observation;
  if(observation) {
    if(observation.version!=="fp01-fixed-net-observation-v1"||!["WX-FAV-01","FIXED-NET-OBSERVATION"].includes(observation.profileId)
      ||!["confirmed","pending","unsupported"].includes(observation.quality)) throw new Error("UnsupportedObservation");
    if(canonicalJson(observation.binding)!==canonicalJson(snapshot.binding)||observation.tickStartUs!==snapshot.tickStartUs
      ||observation.tickEndUs!==snapshot.tickEndUs||snapshot.binding.sourceProfileDigest!==observation.version) throw new Error("StaleObservation");
    unique(observation.values,v=>v.instanceId,6);
    for(const v of observation.values) {
      const asset=snapshot.installed.find(a=>a.instanceId===v.instanceId&&a.cargoId!=="C03");
      if(!asset) throw new Error("ObservationSourceNotInstalled");
      const power=requireUint(v.availableMilliWatt,asset.cargoId==="C01"?6_000_000n:2_000_000n);
      if(observation.profileId==="WX-FAV-01"&&power!==(asset.cargoId==="C01"?1_800_000n:800_000n)) throw new Error("ObservationFixtureMismatch");
    }
  }
  const offers:FactoryPowerSupply["offers"][number][]=[],batteryAssets:FactoryInstalledPowerAsset[]=[];
  for(const a of [...snapshot.installed].sort((a,b)=>cmp(a.instanceId,b.instanceId))) {
    const row=checked.cargo.find(c=>c.cargoId===a.cargoId),definition=checked.items.find(i=>i.sourceId===a.itemSourceId);
    if(!["C01","C02","C03"].includes(a.cargoId)||!row||!definition||row.itemId!==a.itemSourceId
      ||definition.quantityBasis!=="piece"||a.definitionVersion!==definition.version||a.definitionDigest!==definition.digest
      ||a.confirmed!==true||!Number.isSafeInteger(a.installationRevision)||a.installationRevision<1) throw new Error("InstallationBindingMismatch");
    const ids=Array.from({length:row.quantityUnits},(_,i)=>`${row.runtimeId}_unit_${i+1}`);
    if(!ids.includes(a.instanceId)) throw new Error("UnknownFiniteInstance");
    const occurrences=[...containers.values()].flatMap(c=>c.contents.map(stack=>({container:c,stack}))).filter(({stack})=>{
      const origin=stack.extensions["factory.source"];
      return !!origin&&typeof origin==="object"&&!Array.isArray(origin)&&"instanceId" in origin&&origin.instanceId===a.instanceId;
    });
    if(occurrences.length!==1) throw new Error("FiniteInstanceMissingOrDuplicate");
    const {container,stack}=occurrences[0],origin=stack.extensions["factory.source"];
    if(container.containerId!==a.containerId||container.ownerId!==a.ownerId||stack.resourceId!==definition.resourceId||stack.quantity!==1
      ||canonicalJson(origin)!==canonicalJson({cargoId:a.cargoId,itemId:a.itemSourceId,definitionVersion:a.definitionVersion,
        definitionDigest:a.definitionDigest,sourceEventId:"fp02_crash_a_cargo_origin",instanceId:a.instanceId})) throw new Error("InstalledResourceMismatch");
    const port=snapshot.ports.find(p=>p.portId===a.portId);
    if(!port||port.assetId!==a.instanceId||port.direction!==(a.cargoId==="C03"?"both":"out")) throw new Error("InstalledPowerPortMismatch");
    if(a.cargoId==="C03") {
      if(stack.condition!==undefined&&stack.condition<1) throw new Error("DamagedBatteryProfileUnsupported");
      batteryAssets.push(a); continue;
    }
    const sample=observation?.values.find(v=>v.instanceId===a.instanceId);
    const quality=sample?(observation?.quality??"unsupported"):"unsupported";
    const usable=quality==="confirmed"&&(stack.condition===undefined||stack.condition===1);
    offers.push({instanceId:a.instanceId,portId:a.portId,availableMilliWatt:usable?(sample?.availableMilliWatt??"0"):"0",
      nameplateMilliWatt:a.cargoId==="C01"?"6000000":"2000000",quality});
  }
  if(batteryAssets.length>1) throw new Error("DuplicateBatteryOwner");
  const battery=batteryAssets[0];
  const data={version:"fp06-power-supply-v1" as const,binding:snapshot.binding,tickStartUs:snapshot.tickStartUs,tickEndUs:snapshot.tickEndUs,
    offers,ports:[...snapshot.ports].sort((a,b)=>cmp(a.portId,b.portId)),links:[...snapshot.links].sort((a,b)=>cmp(a.linkId,b.linkId)),
    battery:battery?{instanceId:battery.instanceId,portId:battery.portId}:null,
    authorityBytes:canonicalJson({catalogCanonicalJson:checked.canonicalJson,
      installed:[...snapshot.installed].sort((a,b)=>cmp(a.instanceId,b.instanceId)),
      resources:[...containers.values()].sort((a,b)=>cmp(a.containerId,b.containerId)).map(c=>({containerId:c.containerId,revision:c.revision,canonicalJson:c.canonicalJson})),
      observation:observation?{...observation,values:[...observation.values].sort((a,b)=>cmp(a.instanceId,b.instanceId))}:null})};
  return canonicalizeJsonValue({...data,canonicalJson:canonicalJson(data),digest:canonicalSignature(data)}) as unknown as FactoryPowerSupply;
};
