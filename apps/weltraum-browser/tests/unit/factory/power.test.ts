import { describe, expect, it, vi } from "vitest";
import * as catalogLoader from "../../../src/factory/catalog/fp02Catalog";
import { createResourceContainerState } from "../../../src/resources/containers";
import { prepareFactoryPowerSources, type FactoryPowerSourceSnapshot } from "../../../src/factory/power/sourceAdapter";
import { readFactoryPower } from "../../../src/factory/power/powerReadView";
import { canonicalJson, canonicalSignature } from "../../../src/resources/serialization";
import { createFp02Fixture } from "../../../src/factory/catalog/fp02Catalog";
import { stepFactoryPower, type FactoryEnergy, type FactoryPowerBinding, type FactoryPowerInput,
  type FactoryPowerRequest, type FactoryPowerState, type FactoryPowerSuccess, type FactoryPowerSupply } from "../../../src/factory/power/factoryPower";

const catalog = createFp02Fixture("cargo").catalog;
const binding: FactoryPowerBinding = { sessionId: "native-session", epoch: 1, netRevision: 1,
  catalogDigest: catalog.catalogDigest, sourceProfileDigest: "fp01-fixed-net-observation-v1" };
const energy = (milliJoules: string, denominator = "1"): FactoryEnergy => ({ n: milliJoules, d: denominator });
const initial = (storedJ = 12_960_000, battery = true): FactoryPowerState => ({ version: "fp06-factory-power-v1", binding,
  tickEndUs: "0", revision: 0, battery: battery ? { instanceId: "fp02_cargo_c03_unit_1", storedEnergy: energy(String(storedJ * 1000)) } : null, consumers: [] });
const request = (consumerId = "cut", watts = 3500, priority: FactoryPowerRequest["priority"] = "P2"): FactoryPowerRequest =>
  ({ consumerId, deviceInstanceId:consumerId, jobId: `job-${consumerId}`, portId: consumerId, requiredMilliWatt: String(watts * 1000), priority, enabled: true });
const input = (state: FactoryPowerState, watts: number, requests: readonly FactoryPowerRequest[], deltaUs = 100_000): FactoryPowerInput => {
  const tickStartUs = state.tickEndUs; const tickEndUs = String(BigInt(tickStartUs) + BigInt(deltaUs));
  const data = { version: "fp06-power-supply-v1" as const, binding, tickStartUs, tickEndUs,
    offers: [{ instanceId: "fp02_cargo_c01_unit_1", portId: "wind", availableMilliWatt: String(watts * 1000),
      nameplateMilliWatt: "6000000", quality: "confirmed" as const }],
    ports: [{ portId: "wind", assetId: "fp02_cargo_c01_unit_1", direction: "out" as const, active: true, maxMilliWatt: "6000000" },
      { portId: "bus", assetId: "fp02_cargo_c04_unit_1", direction: "both" as const, active: true, maxMilliWatt: "40000000" },
      ...(state.battery ? [{ portId: "battery", assetId: state.battery.instanceId, direction: "both" as const, active: true, maxMilliWatt: "8000000" }] : []),
      ...requests.map(r => ({ portId: r.portId, assetId: r.consumerId, direction: "in" as const, active: true, maxMilliWatt: "40000000" }))],
    links: [{ linkId: "wind-bus", fromPortId: "wind", toPortId: "bus", active: true, maxMilliWatt: "15000000" },
      ...(state.battery ? [{ linkId: "battery-bus", fromPortId: "battery", toPortId: "bus", active: true, maxMilliWatt: "15000000" }] : []),
      ...requests.map(r => ({ linkId: `bus-${r.portId}`, fromPortId: "bus", toPortId: r.portId, active: true, maxMilliWatt: "15000000" }))],
    battery: state.battery ? { instanceId: state.battery.instanceId, portId: "battery" } : null,
    authorityBytes:canonicalJson({kind:"synthetic-headless-power-net-fixture"}) };
  const supply: FactoryPowerSupply = { ...data, canonicalJson: canonicalJson(data), digest: canonicalSignature(data) };
  return { binding, tickStartUs, tickEndUs, confirmed: true, supply, requests };
};
const success = (state: FactoryPowerState, value: FactoryPowerInput): FactoryPowerSuccess => {
  const result = stepFactoryPower(state, value); expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.reason); return result;
};
const rebind = (value: FactoryPowerInput, patch: Partial<Omit<FactoryPowerSupply, "canonicalJson" | "digest">>): FactoryPowerInput => {
  const { canonicalJson: _json, digest: _digest, ...prior } = value.supply;
  const data = { ...prior, ...patch }; return { ...value, supply: { ...data, canonicalJson: canonicalJson(data), digest: canonicalSignature(data) } };
};
const expectBalance = (r: FactoryPowerSuccess) => {
  const q = (e: FactoryEnergy) => ({ n: BigInt(e.n), d: BigInt(e.d) });
  const sum = (...es: FactoryEnergy[]) => es.map(q).reduce((a,b) => ({ n:a.n*b.d+b.n*a.d, d:a.d*b.d }), { n:0n,d:1n });
  const equal = (a: ReturnType<typeof sum>, b: ReturnType<typeof sum>) => expect(a.n*b.d).toBe(b.n*a.d);
  equal(sum(r.balance.sourceActual,r.balance.dischargeToBus),sum(r.balance.work,r.balance.chargeFromBus));
  equal(sum(r.balance.sourcePotential),sum(r.balance.sourceActual,r.balance.curtailed));
  equal(sum(r.balance.storedDelta,r.balance.chargeLoss,r.balance.dischargeLoss,r.balance.dischargeToBus),sum(r.balance.chargeFromBus));
};

describe("FP06 W03 actual electrical allocation", () => {
  it("T013 assigns exactly210000J over60 confirmed seconds; no battery needed", () => {
    let state = initial(0,false); let work = 0n;
    for (let tick=0; tick<600; tick++) { const r=success(state,input(state,3500,[request()]));
      expect(r.grants[0].allocatedMilliWatt).toBe("3500000"); expect(r.balance.work.d).toBe("1");
      work += BigInt(r.balance.work.n); expectBalance(r); state=r.nextState; }
    expect(work).toBe(210_000_000n); expect(state.tickEndUs).toBe("60000000");
  });
  it("T014 net-side6800W/6600W charges200W, stores190J, loses10J", () => {
    const state=initial(); const value=input(state,3600,[request("cell",6600)],1_000_000);
    const data=rebind(value,{ offers:[value.supply.offers[0],{ instanceId:"fp02_cargo_c01_unit_2",portId:"wind2",availableMilliWatt:"3200000",nameplateMilliWatt:"6000000",quality:"confirmed" }],
      ports:[...value.supply.ports,{portId:"wind2",assetId:"fp02_cargo_c01_unit_2",direction:"out",active:true,maxMilliWatt:"6000000"}],
      links:[...value.supply.links,{linkId:"wind2-bus",fromPortId:"wind2",toPortId:"bus",active:true,maxMilliWatt:"15000000"}] });
    const r=success(state,data); expect(r.balance.work).toEqual(energy("6600000"));
    expect(r.balance.chargeFromBus).toEqual(energy("200000")); expect(r.balance.storedDelta).toEqual(energy("190000"));
    expect(r.balance.chargeLoss).toEqual(energy("10000")); expect(r.balance.dischargeToBus).toEqual(energy("0")); expectBalance(r);
  });
  it("T015 reserve energy serves onlyP0/P1, production retains zero work", () => {
    const state=initial(3_600_000); const r=success(state,input(state,0,[request("life",100,"P0"),request("basic",100,"P1"),request("cut",1200),request("extra",100,"P3")]));
    expect(r.grants.map(g=>[g.consumerId,g.allocatedMilliWatt])).toEqual([["life","100000"],["basic","100000"],["cut","0"],["extra","0"]]);
    expect(r.balance.dischargeToBus).toEqual(energy("20000")); expect(r.balance.dischargeLoss).toEqual(energy("20000","19")); expectBalance(r);
    const floor=initial(720_000); const stopped=success(floor,input(floor,0,[request("life",100,"P0")]));
    expect(stopped.grants[0].allocatedMilliWatt).toBe("0"); expect(stopped.nextState.battery?.storedEnergy).toEqual(floor.battery?.storedEnergy);
    const direct=success(state,input(state,1200,[request("cut",1200)])); expect(direct.grants[0].allocatedMilliWatt).toBe("1200000");
  });
  it("T016 stable IDs and jointly reserved restart500W for2confirmed seconds", () => {
    const loads=[request("a",1000),request("b",1000)]; const state=initial(0,false);
    const a=success(state,input(state,1600,loads)); const b=success(state,input(state,1600,[...loads].reverse()));
    expect(b.canonicalJson).toBe(a.canonicalJson); expect(a.grants.map(g=>g.allocatedMilliWatt)).toEqual(["1000000","0"]);
    let waiting=success(state,input(state,0,loads)).nextState;
    const insufficient=success(waiting,input(waiting,1499,loads)); expect(insufficient.grants.every(g=>g.work.n==="0")).toBe(true);
    waiting=insufficient.nextState;
    for(let tick=0;tick<20;tick++) { const r=success(waiting,input(waiting,1500,loads));
      expect(r.grants.every(g=>g.work.n==="0")).toBe(true); waiting=r.nextState; }
    const restarted=success(waiting,input(waiting,1500,loads));
    expect(restarted.grants.map(g=>[g.consumerId,g.allocatedMilliWatt])).toEqual([["a","1000000"],["b","0"]]);
    expect(restarted.nextState.consumers.find(c=>c.consumerId==="b")?.stableSupplyUs).toBe("0");
  });
  it("exact discharge remainder is identical for1/10/1000interval parts and survives JSON", () => {
    const run=(parts:number) => { let state=initial(); for(let i=0;i<parts;i++) {
      const r=success(state,input(state,0,[request()],1_000_000/parts)); expectBalance(r); state=JSON.parse(JSON.stringify(r.nextState)); }
      return state.battery?.storedEnergy; };
    expect(run(10)).toEqual(run(1)); expect(run(1000)).toEqual(run(1));
    expect(run(1)).toEqual(energy("246170000000","19"));
  });
  it("disconnected real conductor gives NET_DISCONNECTED despite sufficient global offer", () => {
    const state=initial(0,false); const value=input(state,3500,[request()]);
    const r=success(state,rebind(value,{links:value.supply.links.map(l=>({...l,active:l.linkId!=="bus-cut"}))}));
    expect(r.grants[0]).toMatchObject({status:"NET_DISCONNECTED",allocatedMilliWatt:"0",work:energy("0")});
  });
  it("shared cable/port capacity is consumed jointly, no phantom motor partial work", () => {
    const state=initial(0,false); const value=input(state,3500,[request("a",2000),request("b",2000)]);
    const r=success(state,rebind(value,{links:value.supply.links.map(l=>({...l,maxMilliWatt:l.linkId==="wind-bus"?"2500000":l.maxMilliWatt}))}));
    expect(r.grants.map(g=>g.allocatedMilliWatt)).toEqual(["2000000","0"]); expectBalance(r);
  });
  it("8kW battery ceiling, full-SOC curtailment, disabled output and exact reserve crossing", () => {
    const state=initial(); const large=success(state,input(state,0,[request("big",8001)])); expect(large.balance.work.n).toBe("0");
    const full=initial(14_400_000); const charge=success(full,input(full,5000,[request()]));
    expect(charge.balance.chargeFromBus.n).toBe("0"); expect(charge.balance.curtailed).toEqual(energy("150000")); expectBalance(charge);
    const blocked=success(state,input(state,0,[{...request(),enabled:false}])); expect(blocked.balance.work.n).toBe("0"); expect(blocked.balance.dischargeToBus.n).toBe("0");
    const near=initial(3_600_001); const before=JSON.stringify(near);
    const noOverrun=success(near,input(near,0,[request()])); expect(noOverrun.balance.work.n).toBe("0"); expect(JSON.stringify(near)).toBe(before);
  });
  it("stale epoch, repeated interval, unconfirmedclock and tampered normbytes reject atomically", () => {
    const state=initial(); const value=input(state,3500,[request()]); const before=JSON.stringify(state);
    for(const bad of [{...value,confirmed:false},{...value,binding:{...binding,epoch:2}},
      {...value,tickStartUs:"1"},{...value,supply:{...value.supply,canonicalJson:"{}"}}]) {
      const r=stepFactoryPower(state,bad); expect(r.ok).toBe(false); expect(r.nextState).toBe(state); }
    const r=success(state,value); expect(stepFactoryPower(r.nextState,value).ok).toBe(false); expect(JSON.stringify(state)).toBe(before);
  });
  it("invalid/duplicate source values and noncanonical rational state are rejected, never repaired", () => {
    const state=initial(); const value=input(state,3500,[request()]);
    for(const power of ["-1","NaN","Infinity","01","6000001"]) {
      const r=stepFactoryPower(state,rebind(value,{offers:[{...value.supply.offers[0],availableMilliWatt:power}]})); expect(r.ok).toBe(false); expect(r.nextState).toBe(state); }
    const duplicate=stepFactoryPower(state,rebind(value,{offers:[...value.supply.offers,...value.supply.offers]})); expect(duplicate.ok).toBe(false);
    const bad={...state,battery:{...state.battery!,storedEnergy:energy("25920000000","2")}};
    expect(stepFactoryPower(bad,value).ok).toBe(false);
  });
});

const sourceFixture=(allSources=false):FactoryPowerSourceSnapshot=>{
  const fixture=createFp02Fixture("cargo");
  const selected=fixture.resourceState.contents.filter(s=>(allSources&&/^fp02_cargo_c0[123]_unit_[1-4]$/.test(s.stackId))||s.stackId==="fp02_cargo_c01_unit_1"||s.stackId==="fp02_cargo_c03_unit_1");
  const installed=selected.map(s=>{
    const source=s.extensions["factory.source"] as {cargoId:"C01"|"C02"|"C03";itemId:string;definitionVersion:number;definitionDigest:string};
    return {instanceId:s.stackId,cargoId:source.cargoId,itemSourceId:source.itemId,definitionVersion:source.definitionVersion,
      definitionDigest:source.definitionDigest,containerId:`installed_${s.stackId}`,ownerId:`owner_${s.stackId}`,
      portId:source.cargoId==="C03"?"battery":s.stackId==="fp02_cargo_c01_unit_1"?"wind":`source_${s.stackId}`,installationRevision:1,confirmed:true};
  });
  const resourceContainers=[createResourceContainerState({...fixture.resourceState,
    contents:fixture.resourceState.contents.filter(s=>!selected.includes(s))},catalog.resources),
    ...installed.map(a=>createResourceContainerState({containerId:a.containerId,ownerId:a.ownerId,revision:1,
      contents:[{...selected.find(s=>s.stackId===a.instanceId)!,ownerId:a.ownerId}]},catalog.resources))];
  const base=input(initial(),3500,[request()]);
  const extraSources=installed.filter(a=>a.portId!=="wind"&&a.portId!=="battery");
  return {binding,tickStartUs:"0",tickEndUs:"100000",installed,resourceContainers,
    ports:[...base.supply.ports,...extraSources.map(a=>({portId:a.portId,assetId:a.instanceId,direction:"out" as const,active:true,maxMilliWatt:a.cargoId==="C01"?"6000000":"2000000"}))],
    links:[...base.supply.links,...extraSources.map(a=>({linkId:`link_${a.portId}`,fromPortId:a.portId,toPortId:"bus",active:true,maxMilliWatt:"15000000"}))],
    observation:{version:"fp01-fixed-net-observation-v1",binding,tickStartUs:"0",tickEndUs:"100000",profileId:"FIXED-NET-OBSERVATION",
      quality:"confirmed",values:[{instanceId:"fp02_cargo_c01_unit_1",availableMilliWatt:"3500000"}]}};
};
describe("FP06 W03 finite installed source and read projection",()=>{
  it("validates cold source catalog bytes once and reuses only the same exact current raw bytes",()=>{
    const snapshot=sourceFixture(),current={...catalog},spy=vi.spyOn(catalogLoader,"loadFactoryCatalog");
    try{
      const cold=prepareFactoryPowerSources(current,snapshot);expect(spy).toHaveBeenCalledTimes(1);spy.mockClear();
      for(let i=0;i<3;i++)expect(prepareFactoryPowerSources(current,snapshot)).toEqual(cold);
      expect(spy).not.toHaveBeenCalled();
      expect(prepareFactoryPowerSources({...current},snapshot)).toEqual(cold);expect(spy).toHaveBeenCalledTimes(1);
      current.canonicalJson=` ${catalog.canonicalJson}`;
      expect(prepareFactoryPowerSources(current,snapshot)).toEqual(cold);expect(spy).toHaveBeenCalledTimes(2);
      expect(prepareFactoryPowerSources(current,snapshot)).toEqual(cold);expect(spy).toHaveBeenCalledTimes(2);
    }finally{spy.mockRestore();}
  });
  it("rechecks current digest, binding and malformed raw catalog bytes after a warm source read",()=>{
    const snapshot=sourceFixture(),current={...catalog},cold=prepareFactoryPowerSources(current,snapshot);
    current.catalogDigest="forged";expect(()=>prepareFactoryPowerSources(current,snapshot)).toThrow(/SourceCatalogMismatch/);
    current.catalogDigest=catalog.catalogDigest;
    expect(()=>prepareFactoryPowerSources(current,{...snapshot,binding:{...snapshot.binding,catalogDigest:"forged"}})).toThrow(/SourceCatalogMismatch/);
    for(const bytes of ["{", "{}"]){current.canonicalJson=bytes;expect(()=>prepareFactoryPowerSources(current,snapshot)).toThrow();}
    current.canonicalJson=catalog.canonicalJson;expect(prepareFactoryPowerSources(current,snapshot)).toEqual(cold);
    const invalid={...snapshot,resourceContainers:snapshot.resourceContainers.map(c=>({...c,contents:c.contents.map(stack=>stack.resourceId==="fp02_bulk_steel_known"?{...stack,quantity:stack.quantity+1}:stack)}))};
    expect(()=>prepareFactoryPowerSources(current,invalid)).toThrow(/ResourceBytes/);
  });
  it("reads a caller canonical getter once per source read and observes its changed bytes",()=>{
    const snapshot=sourceFixture();let bytes=catalog.canonicalJson,reads=0;
    const current=new Proxy({...catalog},{get(target,key,receiver){if(key==="canonicalJson"){reads++;return bytes;}return Reflect.get(target,key,receiver);}});
    const cold=prepareFactoryPowerSources(current,snapshot);expect(reads).toBe(1);
    expect(prepareFactoryPowerSources(current,snapshot)).toEqual(cold);expect(reads).toBe(2);
    bytes="{}";expect(()=>prepareFactoryPowerSources(current,snapshot)).toThrow();expect(reads).toBe(3);
    bytes=catalog.canonicalJson;expect(prepareFactoryPowerSources(current,snapshot)).toEqual(cold);expect(reads).toBe(4);
  });
  it("retains uncached JSON parsing for non-string canonical source inputs",()=>{
    const snapshot=sourceFixture();
    expect(()=>prepareFactoryPowerSources({...catalog,canonicalJson:undefined as never},snapshot)).toThrow(SyntaxError);
    const current={...catalog,canonicalJson:new String(catalog.canonicalJson) as never},spy=vi.spyOn(catalogLoader,"loadFactoryCatalog");
    try{const cold=prepareFactoryPowerSources(current,snapshot);expect(prepareFactoryPowerSources(current,snapshot)).toEqual(cold);expect(spy).toHaveBeenCalledTimes(2);}finally{spy.mockRestore();}
  });
  it("actual installed serials from Resources admit fixed net-side observations, not cargo nameplate",()=>{
    const snapshot=sourceFixture(); const before=JSON.stringify(snapshot);
    const supply=prepareFactoryPowerSources(catalog,snapshot);
    expect(supply.offers[0]).toMatchObject({instanceId:"fp02_cargo_c01_unit_1",availableMilliWatt:"3500000",nameplateMilliWatt:"6000000"});
    expect(supply.battery).toEqual({instanceId:"fp02_cargo_c03_unit_1",portId:"battery"});
    const r=success(initial(),{...input(initial(),3500,[request()]),supply}); expect(r.grants[0].work).toEqual(energy("350000"));
    expect(JSON.stringify(snapshot)).toBe(before); expect(Object.isFrozen(supply)).toBe(true);
  });
  it("unknown/unconfirmed environment offers zero new wind/PVenergy, valid battery remains usable",()=>{
    const snapshot=sourceFixture();
    for(const observation of [null,{...snapshot.observation!,quality:"pending" as const},{...snapshot.observation!,quality:"unsupported" as const}]) {
      const supply=prepareFactoryPowerSources(catalog,{...snapshot,observation});
      expect(supply.offers[0].availableMilliWatt).toBe("0");
      const r=success(initial(),{...input(initial(),0,[request()]),supply}); expect(r.balance.sourceActual.n).toBe("0"); expect(r.balance.dischargeToBus.n).toBe("350000");
    }
    const noInstall=prepareFactoryPowerSources(catalog,{...snapshot,installed:[],observation:null});
    expect(noInstall.offers).toEqual([]); expect(noInstall.battery).toBeNull();
  });
  it("stale source bindings, wrong source version, forged/duplicated finite pieces reject without mutation",()=>{
    const snapshot=sourceFixture(),before=JSON.stringify(snapshot);
    for(const bad of [
      {...snapshot,observation:{...snapshot.observation!,binding:{...binding,netRevision:2}}},
      {...snapshot,observation:{...snapshot.observation!,version:"unsupported" as never}},
      {...snapshot,installed:[{...snapshot.installed[0],definitionDigest:"forged"},snapshot.installed[1]]},
      {...snapshot,installed:[{...snapshot.installed[0],confirmed:false},snapshot.installed[1]]},
      {...snapshot,resourceContainers:[...snapshot.resourceContainers,createFp02Fixture("cargo").resourceState]},
      {...snapshot,installed:[...snapshot.installed,snapshot.installed[0]]}
    ]) expect(()=>prepareFactoryPowerSources(catalog,bad)).toThrow();
    expect(JSON.stringify(snapshot)).toBe(before);
    expect(()=>prepareFactoryPowerSources({...catalog,catalogDigest:"forged"},snapshot)).toThrow();
  });
  it("WX-FAV-01 is a pinned net-side fixture, changed numerical claims are rejected",()=>{
    const snapshot=sourceFixture();
    expect(()=>prepareFactoryPowerSources(catalog,{...snapshot,observation:{...snapshot.observation!,profileId:"WX-FAV-01"}})).toThrow(/Observation/);
    const expected={...snapshot,observation:{...snapshot.observation!,profileId:"WX-FAV-01" as const,
      values:[{instanceId:"fp02_cargo_c01_unit_1",availableMilliWatt:"1800000"}]}};
    expect(prepareFactoryPowerSources(catalog,expected).offers[0].availableMilliWatt).toBe("1800000");
  });
  it("read view separates nameplate, potential, actualwork, losses and stored energy without own authority",()=>{
    const state=initial(); const r=success(state,input(state,3500,[request()]));
    const view=readFactoryPower(r) as {nameplateMilliWatt:string;sourceActualMilliWatt:FactoryEnergy;allocatedMilliWatt:string;storedEnergy:FactoryEnergy};
    expect(view).toMatchObject({nameplateMilliWatt:"6000000",sourceActualMilliWatt:energy("3500000"),allocatedMilliWatt:"3500000",storedEnergy:state.battery!.storedEnergy});
    expect(Object.isFrozen(view)).toBe(true); expect(readFactoryPower(r)).toEqual(view);
  });
});

describe("W03 review oracles",()=>{
  it("separates real network bottleneck from generation shortage and damaged source capability",()=>{
    const state=initial(0,false),value=input(state,3500,[request()]);
    const limited=success(state,rebind(value,{links:value.supply.links.map(l=>({...l,maxMilliWatt:l.linkId==="wind-bus"?"2500000":l.maxMilliWatt}))}));
    expect(limited.grants[0].status).toBe("NET_CAPACITY");
    const shortage=success(state,input(state,2500,[request()])); expect(shortage.grants[0].status).toBe("WAIT_POWER");
    const snapshot=sourceFixture(),broken={...snapshot,resourceContainers:snapshot.resourceContainers.map(c=>
      c.containerId===snapshot.installed[0].containerId?createResourceContainerState({...c,contents:c.contents.map(s=>({...s,condition:0}))},catalog.resources):c)};
    expect(prepareFactoryPowerSources(catalog,broken).offers[0].availableMilliWatt).toBe("0");
  });
  it("saved fractional state must belong to the exact versioned mW/µs efficiency lattice",()=>{
    const state=initial(),value=input(state,0,[request()]);
    const incompatible={...state,battery:{...state.battery!,storedEnergy:energy("90720000001","7")}};
    expect(stepFactoryPower(incompatible,value)).toMatchObject({ok:false,reason:"IncompatibleEnergyQuantum"});
  });
  it("restart timer resets on a changed job or interval shortage, never renders or omitted loads",()=>{
    let state=success(initial(0,false),input(initial(0,false),0,[request("cut",1000)])).nextState;
    for(let i=0;i<10;i++) state=success(state,input(state,1500,[request("cut",1000)])).nextState;
    const changed={...request("cut",1000),jobId:"replacement-job"};
    state=success(state,input(state,1500,[changed])).nextState;
    expect(state.consumers[0].stableSupplyUs).toBe("100000");
    state=success(state,input(state,1499,[changed])).nextState; expect(state.consumers[0].stableSupplyUs).toBe("0");
    state=success(state,input(state,1500,[changed])).nextState;
    const paused=stepFactoryPower(state,{...input(state,1500,[changed]),confirmed:false}); expect(paused.nextState).toBe(state);
    state=success(state,input(state,0,[])).nextState; expect(state.consumers[0].stableSupplyUs).toBe("0");
  });
});

it("restart admission compares full request bytes even for actual FNV collisions",()=>{
  const a={...request("cut",1000),jobId:"jak7yxej28s7d"},b={...request("cut",1000),jobId:"jx3ru1udh6xuh"};
  expect(canonicalSignature(a)).toBe(canonicalSignature(b)); expect(canonicalJson(a)).not.toBe(canonicalJson(b));
  let state=initial(0,false); state=success(state,input(state,0,[a])).nextState;
  for(let i=0;i<10;i++) state=success(state,input(state,1500,[a])).nextState;
  const changed=success(state,input(state,1500,[b])); expect(changed.nextState.consumers[0].stableSupplyUs).toBe("100000");
});

it("source admission rejects changed CURRENT Resources normbytes and unsupported profile before a receipt",()=>{
  const snapshot=sourceFixture(); const mutated={...snapshot,resourceContainers:snapshot.resourceContainers.map(c=>
    c.containerId===snapshot.installed[0].containerId?{...c,contents:c.contents.map(s=>({...s,condition:0}))}:c)};
  expect(()=>prepareFactoryPowerSources(catalog,mutated)).toThrow(/ResourceBytes/);
  expect(()=>prepareFactoryPowerSources(catalog,{...snapshot,binding:{...binding,sourceProfileDigest:"unsupported"},observation:null})).toThrow(/SourceProfile/);
});

it("literal WX-FAV-01 binds all twoC01/fourC02 actual installed sources and nets6800W without repeated conversion loss",()=>{
  const snapshot=sourceFixture(true);
  const observed={...snapshot,observation:{...snapshot.observation!,profileId:"WX-FAV-01" as const,
    values:snapshot.installed.filter(a=>a.cargoId!=="C03").map(a=>({instanceId:a.instanceId,availableMilliWatt:a.cargoId==="C01"?"1800000":"800000"}))}};
  const supply=prepareFactoryPowerSources(catalog,observed);
  expect(supply.offers).toHaveLength(6);
  const value={...input(initial(),0,[request("cut",6600)]),supply}; const r=success(initial(),value);
  expect(r.nameplateMilliWatt).toBe("20000000"); expect(r.balance.sourcePotential).toEqual(energy("680000"));
  expect(r.balance.work).toEqual(energy("660000")); expect(r.balance.chargeFromBus).toEqual(energy("20000"));
  expect(r.balance.storedDelta).toEqual(energy("19000")); expect(r.balance.chargeLoss).toEqual(energy("1000")); expectBalance(r);
});

describe("W03 independent review guards",()=>{
  it("R1 rejects BOTH distributor and foreign In-Port targets before granting cutter work",()=>{
    const state=initial(0,false),base=input(state,3500,[request()]);
    const bus={...base,requests:[{...request(),deviceInstanceId:"cut",portId:"bus"}]};
    const foreign=rebind(base,{ports:[...base.supply.ports,{portId:"foreign",assetId:"foreign_machine",direction:"in",active:true,maxMilliWatt:"15000000"}],
      links:[...base.supply.links,{linkId:"bus_foreign",fromPortId:"bus",toPortId:"foreign",active:true,maxMilliWatt:"15000000"}]});
    const wrongOwner={...foreign,requests:[{...request(),deviceInstanceId:"cut",portId:"foreign"}]};
    const wrongDevice={...base,requests:[{...request(),deviceInstanceId:"foreign_machine"}]};
    const actual=[bus,wrongOwner,wrongDevice].map(value=>stepFactoryPower(state,value));
    expect(actual.map(r=>r.ok)).toEqual([false,false,false]);
    for(const r of actual) {expect(r.nextState).toBe(state);if(!r.ok)expect(r.reason).toBe("ConsumerPortBindingMismatch");}
    const alias={...base,requests:[{...request(),deviceInstanceId:"cut",consumerId:"cut_motor"}]};
    const admitted=success(state,alias); expect(admitted.grants[0]).toMatchObject({consumerId:"cut_motor",deviceInstanceId:"cut",allocatedMilliWatt:"3500000",work:energy("350000")});
  });
  it("R2 absent sample is unsupported zero, never a confirmed observation of calm wind or dark PV",()=>{
    const supply=prepareFactoryPowerSources(catalog,sourceFixture(true));
    const missing=supply.offers.filter(o=>o.instanceId!=="fp02_cargo_c01_unit_1"); expect(missing).toHaveLength(5);
    expect(missing.map(o=>({power:o.availableMilliWatt,quality:o.quality}))).toEqual(Array.from({length:5},()=>({power:"0",quality:"unsupported"})));
    expect(supply.offers[0].quality).toBe("confirmed");
    const snapshot=sourceFixture(); const zeroSample=prepareFactoryPowerSources(catalog,{...snapshot,
      observation:{...snapshot.observation!,values:[{instanceId:"fp02_cargo_c01_unit_1",availableMilliWatt:"0"}]}});
    expect(zeroSample.offers[0]).toMatchObject({availableMilliWatt:"0",quality:"confirmed"});
  });
});
