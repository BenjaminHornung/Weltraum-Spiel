import { canonicalJson, canonicalSignature, canonicalizeJsonValue } from "../../resources/serialization";

/** JSON-safe exact rationals are milliJoules; no tick rounding or floating SOC. */
export interface FactoryEnergy { readonly n: string; readonly d: string }
export interface FactoryPowerBinding {
  readonly sessionId: string; readonly epoch: number; readonly netRevision: number;
  readonly catalogDigest: string; readonly sourceProfileDigest: string;
}
export interface FactoryPowerPort {
  readonly portId: string; readonly assetId: string;
  readonly direction: "in" | "out" | "both"; readonly active: boolean; readonly maxMilliWatt: string;
}
export interface FactoryPowerLink {
  readonly linkId: string; readonly fromPortId: string; readonly toPortId: string;
  readonly active: boolean; readonly maxMilliWatt: string;
}
export interface FactoryPowerOffer {
  readonly instanceId: string; readonly portId: string; readonly availableMilliWatt: string;
  readonly nameplateMilliWatt: string; readonly quality: "confirmed" | "pending" | "unsupported";
}
export interface FactoryPowerSupply {
  readonly version: "fp06-power-supply-v1"; readonly binding: FactoryPowerBinding;
  readonly tickStartUs: string; readonly tickEndUs: string;
  readonly offers: readonly FactoryPowerOffer[]; readonly ports: readonly FactoryPowerPort[];
  readonly links: readonly FactoryPowerLink[];
  readonly battery: Readonly<{ instanceId: string; portId: string }> | null;
  /** Full current installation/Resources/observation bytes, bound by the supply. */
  readonly authorityBytes: string;
  readonly canonicalJson: string; readonly digest: string;
}
export interface FactoryPowerRequest {
  readonly consumerId: string; readonly deviceInstanceId: string; readonly jobId: string; readonly portId: string;
  readonly priority: "P0" | "P1" | "P2" | "P3";
  readonly requiredMilliWatt: string; readonly enabled: boolean;
}
export interface FactoryPowerConsumerState {
  readonly consumerId: string; readonly requestKey: string;
  readonly waiting: boolean; readonly stableSupplyUs: string;
}
export interface FactoryPowerState {
  readonly version: "fp06-factory-power-v1"; readonly binding: FactoryPowerBinding;
  readonly tickEndUs: string; readonly revision: number;
  readonly battery: Readonly<{ instanceId: string; storedEnergy: FactoryEnergy }> | null;
  readonly consumers: readonly FactoryPowerConsumerState[];
}
export interface FactoryPowerInput {
  readonly binding: FactoryPowerBinding; readonly tickStartUs: string; readonly tickEndUs: string;
  readonly confirmed: boolean; readonly supply: FactoryPowerSupply;
  readonly requests: readonly FactoryPowerRequest[];
}
export interface FactoryPowerGrant {
  readonly consumerId: string; readonly deviceInstanceId: string; readonly jobId: string; readonly portId: string;
  readonly requiredMilliWatt: string; readonly allocatedMilliWatt: string; readonly work: FactoryEnergy;
  readonly status: "Powered" | "Idle" | "WAIT_POWER" | "WAIT_RESTART" | "NET_DISCONNECTED" | "NET_CAPACITY";
}
export interface FactoryPowerSuccess {
  readonly ok: true; readonly supplyCanonicalJson: string; readonly nameplateMilliWatt: string; readonly binding: FactoryPowerBinding; readonly tickStartUs: string; readonly tickEndUs: string;
  readonly nextState: FactoryPowerState; readonly grants: readonly FactoryPowerGrant[];
  readonly balance: Readonly<{ sourcePotential: FactoryEnergy; sourceActual: FactoryEnergy; curtailed: FactoryEnergy;
    work: FactoryEnergy; chargeFromBus: FactoryEnergy; dischargeToBus: FactoryEnergy;
    chargeLoss: FactoryEnergy; dischargeLoss: FactoryEnergy; storedDelta: FactoryEnergy }>;
  readonly canonicalJson: string; readonly digest: string;
}
export type FactoryPowerStep = FactoryPowerSuccess | Readonly<{ ok: false; reason: string; nextState: FactoryPowerState }>;

// Versioned technical binding: all-or-nothing, cold/stoppable interval requests,
// no external line or standby loss, one finite C03 store, stable forest routing.
export const FACTORY_POWER_POLICY = Object.freeze({ version: "fp01-factory-power-policy-v1",
  sourceObservationVersion: "fp01-fixed-net-observation-v1",
  capacityMilliJoule: "14400000000", productionReserveMilliJoule: "3600000000",
  hardwareMinimumMilliJoule: "720000000", maxBatteryMilliWatt: "8000000",
  efficiencyNumerator: "19", efficiencyDenominator: "20", restartHeadroomMilliWatt: "500000",
  restartStableUs: "2000000", storedQuantumDenominator: "380000000", standbyLoss: "0", externalLineLoss: "0" });

type Q = { n: bigint; d: bigint };
const gcd = (a: bigint, b: bigint): bigint => { a=a<0n?-a:a; while(b!==0n) { const r=a%b; a=b; b=r; } return a; };
const q = (n: bigint, d=1n): Q => { if(d<=0n) throw new Error("InvalidRational"); const g=gcd(n,d); return { n:n/g,d:d/g }; };
const zero=q(0n);
const add=(a:Q,b:Q):Q=>q(a.n*b.d+b.n*a.d,a.d*b.d);
const sub=(a:Q,b:Q):Q=>q(a.n*b.d-b.n*a.d,a.d*b.d);
const mul=(a:Q,b:Q):Q=>q(a.n*b.n,a.d*b.d);
const div=(a:Q,b:Q):Q=>q(a.n*b.d,a.d*b.n);
const compare=(a:Q,b:Q):number=>a.n*b.d<b.n*a.d?-1:a.n*b.d>b.n*a.d?1:0;
const minimum=(...values:Q[]):Q=>values.reduce((a,b)=>compare(a,b)<=0?a:b);
const positive=(a:Q):Q=>a.n>0n?a:zero;
const saved=(a:Q):FactoryEnergy=>({n:String(a.n),d:String(a.d)});
const integer=(value:string,max=9_223_372_036_854_775_807n):bigint=> {
  if(typeof value!=="string"||!/^(0|[1-9][0-9]{0,24})$/.test(value)) throw new Error("InvalidInteger");
  const result=BigInt(value); if(result>max) throw new Error("IntegerOutOfRange"); return result;
};
const restored=(value:FactoryEnergy):Q=>{
  const n=integer(value.n,14_400_000_000n*10n**24n),d=integer(value.d,10n**24n);
  if(d===0n||380_000_000n%d!==0n) throw new Error("IncompatibleEnergyQuantum");
  const result=q(n,d); if(result.n!==n||result.d!==d) throw new Error("NoncanonicalEnergy"); return result;
};
const id=(value:string):void=> { if(typeof value!=="string"||!value.length||value.length>128||/\s/.test(value)) throw new Error("InvalidId"); };
const numberRevision=(value:number):void=>{ if(!Number.isSafeInteger(value)||value<0) throw new Error("InvalidRevision"); };
const unique=<T>(values:readonly T[],key:(entry:T)=>string,max:number):void=>{
  if(!Array.isArray(values)||values.length>max) throw new Error("CollectionBound");
  const seen=new Set<string>(); for(const entry of values) { const k=key(entry); id(k); if(seen.has(k)) throw new Error("DuplicateId"); seen.add(k); }
};
const order=(a:string,b:string):number=>a<b?-1:a>b?1:0;
const bindingCore=(binding:FactoryPowerBinding):string=>canonicalJson({ sessionId:binding.sessionId,
  epoch:binding.epoch,catalogDigest:binding.catalogDigest,sourceProfileDigest:binding.sourceProfileDigest });
const frozen=<T>(value:T):T=>canonicalizeJsonValue(value) as T;
interface Budget { ports:Map<string,Q>; links:Map<string,Q>; sources:Map<string,Q>; batteryPower:Q; virtualStored:Q }
interface Flow { source:Q; battery:Q }
const clone=(a:Budget):Budget=>({ ports:new Map(a.ports),links:new Map(a.links),sources:new Map(a.sources),batteryPower:a.batteryPower,virtualStored:a.virtualStored });

/** Pure plan, never a World commit. The host must atomically adopt with this
 * interval/session/epoch/net revision; W04 may consume only an adopted receipt. */
export const stepFactoryPower=(state:FactoryPowerState,input:FactoryPowerInput):FactoryPowerStep=>{
  try {
    const supply=input.supply;
    if(state.version!=="fp06-factory-power-v1"||supply.version!=="fp06-power-supply-v1") throw new Error("UnsupportedVersion");
    for(const binding of [state.binding,input.binding,supply.binding]) {
      id(binding.sessionId); id(binding.catalogDigest); id(binding.sourceProfileDigest);
      numberRevision(binding.epoch); numberRevision(binding.netRevision);
    }
    numberRevision(state.revision);
    if(input.binding.sourceProfileDigest!==FACTORY_POWER_POLICY.sourceObservationVersion) throw new Error("UnsupportedSourceProfile");
    if(input.confirmed!==true||bindingCore(state.binding)!==bindingCore(input.binding)
      ||canonicalJson(input.binding)!==canonicalJson(supply.binding)||input.binding.netRevision<state.binding.netRevision) throw new Error("StaleBinding");
    const start=integer(input.tickStartUs),end=integer(input.tickEndUs),prior=integer(state.tickEndUs),dt=end-start;
    if(start!==prior||dt<=0n||dt>60_000_000n||supply.tickStartUs!==input.tickStartUs||supply.tickEndUs!==input.tickEndUs) throw new Error("StaleInterval");
    const {canonicalJson:supplyBytes,digest:supplyDigest,...supplyData}=supply;
    if(typeof supply.authorityBytes!=="string"||supply.authorityBytes.length>8_388_608||canonicalJson(JSON.parse(supply.authorityBytes))!==supply.authorityBytes) throw new Error("InvalidSourceAuthorityBytes");
    if(canonicalJson(supplyData)!==supplyBytes||canonicalSignature(supplyData)!==supplyDigest) throw new Error("SourceBytesMismatch");
    unique(supply.ports,p=>p.portId,256); unique(supply.links,l=>l.linkId,255); unique(supply.offers,o=>o.instanceId,6);
    unique(input.requests,r=>r.consumerId,64); unique(state.consumers,c=>c.consumerId,64);
    const ports=new Map(supply.ports.map(p=>[p.portId,p]));
    const edgeOrder=[...supply.links].sort((a,b)=>order(a.linkId,b.linkId));
    const offerOrder=[...supply.offers].sort((a,b)=>order(a.instanceId,b.instanceId));
    const time=q(dt,1_000_000n); // mW * microseconds /1e6 = exact mJ.
    const toEnergy=(power:Q):Q=>mul(power,time);
    const capacity=q(14_400_000_000n),eta=q(19n,20n);
    const oldStored=state.battery?restored(state.battery.storedEnergy):zero;
    if(compare(oldStored,capacity)>0) throw new Error("BatteryCapacityExceeded");
    if(state.battery) { if(state.battery.instanceId!=="fp02_cargo_c03_unit_1") throw new Error("UnknownBattery"); }
    if((state.battery?.instanceId??null)!==(supply.battery?.instanceId??null)) throw new Error("BatteryAssetMismatch");
    if(supply.battery) {
      const p=ports.get(supply.battery.portId);
      if(!p||p.assetId!==supply.battery.instanceId||p.direction!=="both") throw new Error("BatteryPortMismatch");
    }
    const budget:Budget={ports:new Map(),links:new Map(),sources:new Map(),batteryPower:q(8_000_000n),virtualStored:oldStored};
    for(const p of supply.ports) {
      id(p.assetId); if(!["in","out","both"].includes(p.direction)||typeof p.active!=="boolean") throw new Error("InvalidPort");
      budget.ports.set(p.portId,p.active?q(integer(p.maxMilliWatt,40_000_000n)):zero);
    }
    // A forest is the deliberately bounded first-slice topology. Reject loops
    // rather than pretend greedy routing implements a general cyclic solver.
    const parents=new Map(supply.ports.map(p=>[p.portId,p.portId]));
    const root=(v:string):string=>{ while(parents.get(v)!==v) v=parents.get(v)!; return v; };
    for(const l of edgeOrder) {
      if(!ports.has(l.fromPortId)||!ports.has(l.toPortId)||l.fromPortId===l.toPortId||typeof l.active!=="boolean") throw new Error("InvalidLink");
      const rate=q(integer(l.maxMilliWatt,40_000_000n)); budget.links.set(l.linkId,l.active?rate:zero);
      if(l.active) { const a=root(l.fromPortId),b=root(l.toPortId); if(a===b) throw new Error("UnsupportedCyclicNet"); parents.set(a,b); }
    }
    let sourcePotential=zero;
    for(const o of offerOrder) {
      const expected=o.instanceId.match(/^fp02_cargo_c(01|02)_unit_([1-4])$/);
      const plate=expected?.[1]==="01"?6_000_000n:2_000_000n;
      if(!expected||Number(expected[2])>(expected[1]==="01"?2:4)||integer(o.nameplateMilliWatt)!==plate) throw new Error("UnknownFiniteSource");
      const offered=integer(o.availableMilliWatt,plate),p=ports.get(o.portId);
      if(!p||p.assetId!==o.instanceId||p.direction!=="out"||!["confirmed","pending","unsupported"].includes(o.quality)) throw new Error("SourcePortMismatch");
      const potential=o.quality==="confirmed"?q(offered):zero;
      budget.sources.set(o.instanceId,potential); sourcePotential=add(sourcePotential,toEnergy(potential));
    }
    const path=(b:Budget,from:string,to:string,ignoreBudget=false):{portIds:string[];linkIds:string[]}|null=>{
      if(from===to||!ports.has(from)||!ports.has(to)||ports.get(from)!.direction==="in"||ports.get(to)!.direction==="out") return null;
      const seen=new Set([from]); const queue=[{portIds:[from],linkIds:[] as string[]}];
      while(queue.length) { const current=queue.shift()!; const at=current.portIds.at(-1)!;
        if(!ports.get(at)!.active||(!ignoreBudget&&(b.ports.get(at)!.n<=0n))) continue;
        if(at===to) return current;
        if(at!==from&&ports.get(at)!.direction!=="both") continue;
        for(const edge of edgeOrder) {
          if(!edge.active||(!ignoreBudget&&b.links.get(edge.linkId)!.n<=0n)) continue;
          const next=edge.fromPortId===at?edge.toPortId:edge.toPortId===at?edge.fromPortId:null;
          if(next===null||seen.has(next)) continue; seen.add(next);
          queue.push({portIds:[...current.portIds,next],linkIds:[...current.linkIds,edge.linkId]});
        }
      } return null;
    };
    const route=(b:Budget,from:string,to:string,wanted:Q):Q=>{
      const p=path(b,from,to); if(!p) return zero;
      const amount=minimum(wanted,...p.portIds.map(i=>b.ports.get(i)!),...p.linkIds.map(i=>b.links.get(i)!));
      for(const i of p.portIds) b.ports.set(i,sub(b.ports.get(i)!,amount));
      for(const i of p.linkIds) b.links.set(i,sub(b.links.get(i)!,amount)); return amount;
    };
    const draw=(b:Budget,target:string,wanted:Q,priority:FactoryPowerRequest["priority"],batteryAllowed=true):Flow=>{
      let remaining=wanted,source=zero,battery=zero;
      for(const o of offerOrder) {
        const amount=route(b,o.portId,target,minimum(remaining,b.sources.get(o.instanceId)!));
        b.sources.set(o.instanceId,sub(b.sources.get(o.instanceId)!,amount)); source=add(source,amount); remaining=sub(remaining,amount);
      }
      if(supply.battery&&batteryAllowed&&remaining.n>0n) {
        const floor=q(priority==="P0"||priority==="P1"?720_000_000n:3_600_000_000n);
        const energyBound=div(mul(positive(sub(b.virtualStored,floor)),eta),time);
        battery=route(b,supply.battery.portId,target,minimum(remaining,b.batteryPower,energyBound));
        b.batteryPower=sub(b.batteryPower,battery); b.virtualStored=sub(b.virtualStored,div(toEnergy(battery),eta));
      } return {source,battery};
    };
    let current=budget,sourceUsed=zero,discharge=zero,work=zero;
    const grants:FactoryPowerGrant[]=[],consumers:FactoryPowerConsumerState[]=[];
    const oldConsumers=new Map(state.consumers.map(c=>[c.consumerId,c]));
    for(const c of state.consumers) { if(typeof c.waiting!=="boolean") throw new Error("InvalidWaitState"); if(typeof c.requestKey!=="string"||c.requestKey.length>2048||canonicalJson(JSON.parse(c.requestKey))!==c.requestKey) throw new Error("InvalidRequestBytes");
      integer(c.stableSupplyUs,2_000_000n); }
    const requests=[...input.requests].sort((a,b)=>order(a.priority,b.priority)||order(a.consumerId,b.consumerId));
    for(const r of requests) {
      id(r.jobId); id(r.portId); id(r.deviceInstanceId); if(!["P0","P1","P2","P3"].includes(r.priority)||typeof r.enabled!=="boolean"||!ports.has(r.portId)) throw new Error("InvalidRequest");
      const consumerPort=ports.get(r.portId)!;
      if(consumerPort.direction!=="in"||consumerPort.assetId!==r.deviceInstanceId) throw new Error("ConsumerPortBindingMismatch");
      const required=q(integer(r.requiredMilliWatt,40_000_000n));
      const key=canonicalJson(r),old=oldConsumers.get(r.consumerId),waiting=old?.waiting??false;
      let stable=old?.requestKey===key?integer(old.stableSupplyUs,2_000_000n):0n;
      let status:FactoryPowerGrant["status"]="Idle",allocated=zero,nextWaiting=waiting;
      if(r.enabled&&required.n>0n) {
        const reachable=offerOrder.some(o=>path(current,o.portId,r.portId,true)!==null)
          ||(supply.battery!==null&&path(current,supply.battery.portId,r.portId,true)!==null);
        const trial=clone(current); const load=draw(trial,r.portId,required,r.priority);
        const loadFull=compare(add(load.source,load.battery),required)===0;
        const headroom=waiting&&loadFull?draw(trial,r.portId,q(500_000n),r.priority):{source:zero,battery:zero};
        const sufficient=loadFull&&(!waiting||compare(add(headroom.source,headroom.battery),q(500_000n))===0);
        if(sufficient) {
          current=trial;
          if(waiting&&stable<2_000_000n) {
            stable=dt+stable>2_000_000n?2_000_000n:dt+stable; status="WAIT_RESTART";
          } else { allocated=required; sourceUsed=add(sourceUsed,toEnergy(load.source)); discharge=add(discharge,toEnergy(load.battery));
            work=add(work,toEnergy(required)); status="Powered"; nextWaiting=false; stable=0n; }
        } else {
          nextWaiting=true; stable=0n; status=reachable?"WAIT_POWER":"NET_DISCONNECTED";
          if(reachable) {
            const withoutLineLimits=clone(current);
            for(const p of supply.ports) withoutLineLimits.ports.set(p.portId,p.active?q(40_000_000n):zero);
            for(const l of edgeOrder) withoutLineLimits.links.set(l.linkId,l.active?q(40_000_000n):zero);
            const hypothetical=draw(withoutLineLimits,r.portId,add(required,waiting?q(500_000n):zero),r.priority);
            if(compare(add(hypothetical.source,hypothetical.battery),add(required,waiting?q(500_000n):zero))===0) status="NET_CAPACITY";
          }
        }
      } else stable=0n;
      consumers.push({consumerId:r.consumerId,requestKey:key,waiting:nextWaiting,stableSupplyUs:String(stable)});
      grants.push({consumerId:r.consumerId,deviceInstanceId:r.deviceInstanceId,jobId:r.jobId,portId:r.portId,requiredMilliWatt:r.enabled?r.requiredMilliWatt:"0",allocatedMilliWatt:String(allocated.n),work:saved(toEnergy(allocated)),status});
    }
    // Omitted requests keep their WAIT_POWER history but cannot accrue time.
    for(const c of state.consumers) if(!input.requests.some(r=>r.consumerId===c.consumerId)) consumers.push({...c,stableSupplyUs:"0"});
    unique(consumers,c=>c.consumerId,64); consumers.sort((a,b)=>order(a.consumerId,b.consumerId));
    let charge=zero;
    if(supply.battery&&discharge.n===0n) {
      const capacityPower=div(div(positive(sub(capacity,oldStored)),eta),time);
      const charging=draw(current,supply.battery.portId,minimum(q(8_000_000n),capacityPower),"P1",false);
      charge=toEnergy(charging.source); sourceUsed=add(sourceUsed,charge);
    }
    const chargeLoss=div(charge,q(20n)),dischargeLoss=div(discharge,q(19n));
    const delta=sub(mul(charge,eta),div(discharge,eta)),nextStored=add(oldStored,delta);
    const nextState:FactoryPowerState={version:state.version,binding:input.binding,tickEndUs:input.tickEndUs,revision:state.revision+1,
      battery:state.battery?{instanceId:state.battery.instanceId,storedEnergy:saved(nextStored)}:null,consumers};
    numberRevision(nextState.revision);
    const result={ok:true as const,supplyCanonicalJson:canonicalJson({...supplyData,offers:offerOrder,links:edgeOrder,
      ports:[...supply.ports].sort((a,b)=>order(a.portId,b.portId))}),nameplateMilliWatt:String(offerOrder.reduce((total,o)=>total+BigInt(o.nameplateMilliWatt),0n)),binding:input.binding,tickStartUs:input.tickStartUs,tickEndUs:input.tickEndUs,nextState,grants,
      balance:{sourcePotential:saved(sourcePotential),sourceActual:saved(sourceUsed),curtailed:saved(sub(sourcePotential,sourceUsed)),
        work:saved(work),chargeFromBus:saved(charge),dischargeToBus:saved(discharge),chargeLoss:saved(chargeLoss),dischargeLoss:saved(dischargeLoss),storedDelta:saved(delta)}};
    return frozen({...result,canonicalJson:canonicalJson(result),digest:canonicalSignature(result)});
  } catch(error) { return Object.freeze({ok:false,reason:error instanceof Error?error.message:"InvalidPowerInput",nextState:state}); }
};
