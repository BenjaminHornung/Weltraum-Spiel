import {expect,it,vi} from "vitest";
import {createHvpMeasurements} from "../../src/hestia-prototype/runtime/measurements";

it("is inert without opt-in and records raw timings without retaining a timeline",()=>{
  const clock={now:()=>0,timeOrigin:1000,measure:vi.fn(),clearMeasures:vi.fn()};
  createHvpMeasurements(false,clock as never).record("frameIntervalMs",0,16.7);
  expect(clock.measure).not.toHaveBeenCalled();
  const m=createHvpMeasurements(true,clock as never);
  m.record("frameIntervalMs",10,16.7);
  m.worker({origin:1100,steps:[[20,.2],[20,.3]],dropped:2});
  expect(clock.measure.mock.calls.map(c=>c[1])).toEqual([
    {start:10,duration:16.7,detail:{sampleId:"frameIntervalMs:0",data:undefined}},
    {start:120,duration:.2,detail:{sampleId:"solverStepCpuMs:1",data:undefined}},
    {start:120,duration:.3,detail:{sampleId:"solverStepCpuMs:2",data:undefined}}
  ]);
  expect(clock.clearMeasures).toHaveBeenCalledTimes(3);expect(m.read()).toMatchObject({samples:3,errors:0,dropped:2});
});
it("reports invalid or unsupported measurement output without breaking gameplay",()=>{
  const clock={now:()=>0,timeOrigin:1000,measure:()=>{throw new Error("unsupported");},clearMeasures:vi.fn()};
  const m=createHvpMeasurements(true,clock as never);
  expect(()=>{m.record("frameIntervalMs",0,16);m.record("bad",NaN,0);m.worker({origin:NaN,steps:[],dropped:0});}).not.toThrow();
  expect(m.read()).toMatchObject({samples:0,errors:3});
});
