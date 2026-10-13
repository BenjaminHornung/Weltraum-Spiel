import {it,expect} from "vitest";
import fixture from "../../snapshot/tests/fixtures/hvp-contact-r90-body384.json";
import {decodeHvpBody} from "../../snapshot/src/hestia-prototype/persistence/bodyCheckpoint";
import {assertCanonicalNativeBody,assertMassImpulse,type NativeBodyFacts} from "../src/nativeOracle";
const {recipe,motion,checkpoint}=decodeHvpBody(fixture);
const expected:NativeBodyFacts={mass:recipe.mass.totalMassKg,localCom:{x:0,y:0,z:0},principalInertia:recipe.axes.principalInertia,
  inertiaFrame:recipe.axes.frame,translation:motion.translationMeters,rotation:motion.rotation,velocity:motion.linvelMetersPerSecond,
  angularVelocity:motion.angvelRadPerSecond,sleeping:checkpoint.sleeping,gyro:false};
it("checks the bound fixture's canonical facts without creating a native world",()=>{expect(()=>assertCanonicalNativeBody(expected,expected)).not.toThrow();});
for(const field of ["mass","principalInertia","translation","inertiaFrame"] as const){
  it("rejects wrong or nonfinite canonical "+field,()=>{
    for(const wrong of [NaN,Infinity,field==="mass"?expected.mass+1:123]){
      const actual=structuredClone(expected);
      if(field==="mass")actual.mass=wrong;else actual[field].x=wrong;
      expect(()=>assertCanonicalNativeBody(actual,expected)).toThrow();
    }
  });
}
it("rejects wrong native flags",()=>{expect(()=>assertCanonicalNativeBody({...expected,gyro:true},expected)).toThrow();});
it("rejects NaN or changed Y velocity after impulse",()=>{
  expect(()=>assertMassImpulse({x:0,y:0,z:0},{x:NaN,y:0,z:0})).toThrow();
  expect(()=>assertMassImpulse({x:0,y:0,z:0},{x:1,y:1,z:0})).toThrow();
});
