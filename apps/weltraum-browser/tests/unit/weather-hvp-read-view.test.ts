import { describe, expect, it, vi } from "vitest";
import { createHvpCoastWeatherModel, createHvpWeatherReadView, type HvpWeatherInput } from "../../src/weather/hvpWeather";
import { trajectoryQuery } from "../../src/weather/model/weather";
import type { WeatherResult } from "../../src/weather/model/common";

const input:HvpWeatherInput={worldId:"fixture.world",sessionId:"fixture.session",epoch:0,revision:0,sourceDigest:"26d5308d",tick:60,
  position:{x:0,y:0,z:0},terrain:{sessionId:"fixture.session",epoch:0,revision:0,sourceDigest:"26d5308d",
    sizeX:16,sizeY:16,sizeZ:16,originMeters:{x:-1,y:-1,z:-1},cellMeters:.125,readSlot:()=>0}};
const model=createHvpCoastWeatherModel(input.worldId,input.sessionId);

describe("confirmed HVP weather projection",()=>{
  it("reproduces the independent normal-PMD WXG coast oracle at simulation tick 120",async()=>{
    const source=await model, query=trajectoryQuery(source.input.bundle,{x:1,y:0,z:0},120);
    const weather=await source.read(query);
    expect(weather.WeatherSnapshotId).toBe("sha256:5ac049cdc449e467a5e9952e4c305370354599c8a72ce269751589b75280c4ad");
    expect(weather.binding.macroGeography?.digest).toBe("sha256:cadc3c8e0f6bdbad5c3c75dd7c9e2a52cdc2d7bb0558ce3696960318d1b52696");
    expect(weather.status).toBe("Known");
    if(weather.status==="Known"){
      expect(weather.sample.temperatureK).toBeCloseTo(282.7607693068899,9);
      expect(weather.sample.windBodyFixedMps).toEqual({x:0,y:12,z:0});expect(weather.sample.precipitation).toEqual([]);
    }
  });
  it("samples the 60 Hz confirmed physics clock at 120 Hz universe time and invalidates the old cut",async()=>{
    const owner=createHvpWeatherReadView(()=>model);
    expect(owner.update(input)).toBeUndefined();
    await vi.waitFor(()=>expect(owner.update(input)?.sampleTick).toBe(120));
    const frame=owner.update(input)!;
    expect(frame.windMps[0]).toBe(12);expect(frame.windMps[1]).toBe(0);expect(frame.windMps[2]).toBe(0);
    expect(frame).toMatchObject({sourceDigest:input.sourceDigest,rain01:0,snow01:0,cloudCoverage:.3});
    expect(owner.update({...input,tick:61})).toBe(frame);
    const cut={...input,revision:1,sourceDigest:"f73a9761",tick:120};
    expect(owner.update(cut)).toBeUndefined();
    await vi.waitFor(()=>expect(owner.update(cut)?.sampleTick).toBe(240));
    expect(owner.update(cut)).toMatchObject({revision:1,sourceDigest:cut.sourceDigest});
    expect(owner.update({...cut,tick:20})).toBeUndefined();
    owner.dispose();expect(owner.update(input)).toBeUndefined();
  });
  it("coalesces overlapping reads and suppresses a late answer after restore or disposal",async()=>{
    const source=await model;
    const releases:Array<()=>void>=[];
    const read=vi.fn(async(q:Parameters<typeof source.read>[0])=>{
      await new Promise<void>(resolve=>releases.push(resolve));return source.read(q);
    });
    const owner=createHvpWeatherReadView(async()=>({...source,read}));
    owner.update(input);await vi.waitFor(()=>expect(releases).toHaveLength(1));
    const firstCut={...input,revision:1,sourceDigest:"aaaaaaaa"};
    const restored={...firstCut,epoch:1,sourceDigest:"bbbbbbbb"};
    expect(owner.update(firstCut)).toBeUndefined();expect(owner.update(restored)).toBeUndefined();
    releases[0]!();await vi.waitFor(()=>expect(releases).toHaveLength(2));
    expect(owner.update(restored)).toBeUndefined();releases[1]!();
    await vi.waitFor(()=>expect(owner.update(restored)?.sourceDigest).toBe("bbbbbbbb"));
    expect(read).toHaveBeenCalledTimes(2);
    expect(owner.update({...restored,tick:NaN})).toBeUndefined();owner.dispose();
  });
  it("uses precipitation flux from the producer and suppresses unknown or foreign world replies",async()=>{
    const source=await model;
    let mode:"rain"|"unknown"|"foreign"="rain";
    const read=async(q:Parameters<typeof source.read>[0]):Promise<WeatherResult>=>{
      const r=await source.read(q);if(r.status!=="Known")throw Error("Known fixture required");
      if(mode==="unknown")return {...r,status:"UnknownCoverage",reasonCode:"missing-known-neighbor"};
      if(mode==="foreign")return {...r,binding:{...r.binding,worldId:"other"}};
      return {...r,sample:{...r.sample,precipitation:[
        {speciesId:"H2O",phase:"liquid",massFluxKgPerM2S:2.5/3600},
        {speciesId:"H2O",phase:"solid",massFluxKgPerM2S:5/3600}] }};
    };
    const settled=vi.fn(async(q:Parameters<typeof read>[0])=>read(q));
    const owner=createHvpWeatherReadView(async()=>({...source,read:settled}));
    owner.update(input);
    await vi.waitFor(()=>expect(owner.update(input)).toMatchObject({rain01:.25,snow01:.5}));
    const covered={...input,revision:1,sourceDigest:"roof",terrain:{...input.terrain!,revision:1,sourceDigest:"roof",readSlot:(_x:number,y:number)=>y===12?2:0}};
    expect(owner.update(covered)).toBeUndefined();
    await vi.waitFor(()=>expect(owner.update(covered)).toMatchObject({exposure:"Sheltered",rain01:0,snow01:0}));
    const recut={...input,revision:2,sourceDigest:"open",terrain:{...input.terrain!,revision:2,sourceDigest:"open"}};
    expect(owner.update(recut)).toBeUndefined();
    await vi.waitFor(()=>expect(owner.update(recut)).toMatchObject({exposure:"Open",rain01:.25,snow01:.5}));
    for(const [i,next] of (["unknown","foreign"] as const).entries()){
      mode=next;const change={...input,revision:i+3};
      expect(owner.update(change)).toBeUndefined();
      await vi.waitFor(()=>expect(settled).toHaveBeenCalledTimes(i+4));
      await settled.mock.results.at(-1)!.value;
      expect(owner.update(change)).toBeUndefined();
    }
  });
});
