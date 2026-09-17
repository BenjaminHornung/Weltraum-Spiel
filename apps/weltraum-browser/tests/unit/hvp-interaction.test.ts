import {expect,it} from "vitest";
import {describeHvpImpulseTarget,describeHvpImpulseResult} from "../../src/hvp/hvpHud";

it("explains fixed, absent and movable targets without promising arbitrary terrain motion",()=>{
  const empty={target:null,distanceMeters:null,massKg:null,point:null};
  expect(describeHvpImpulseTarget({...empty,kind:"Fixed"})).toContain("nur gelöste Körper");
  expect(describeHvpImpulseTarget({...empty,kind:"NoContact"})).toContain("4 m");
  expect(describeHvpImpulseTarget({...empty,kind:"NotPlaying"})).toContain("Spielen anklicken");
  expect(describeHvpImpulseTarget({...empty,kind:"Dynamic",massKg:300,distanceMeters:2})).toContain("300.0 kg");
  expect(describeHvpImpulseResult("Contact is not dynamic")).toContain("fest verankert");
  expect(describeHvpImpulseResult("Solver contact impulse")).toContain("Stoß ausgelöst");
  expect(describeHvpImpulseResult(undefined)).toContain("greift oder zieht kein Objekt");
});
