interface Vector {x:number;y:number;z:number}
interface Rotation extends Vector {w:number}
export interface NativeBodyFacts {
  mass:number;localCom:Vector;principalInertia:Vector;inertiaFrame:Rotation;
  translation:Vector;rotation:Rotation;velocity:Vector;angularVelocity:Vector;sleeping:boolean;gyro:boolean;
}
const tolerance=1e-5;
function scalar(actual:number,expected:number,label:string){
  if(!Number.isFinite(actual)||!Number.isFinite(expected)||Math.abs(actual-Math.fround(expected))>Math.max(1,Math.abs(expected))*tolerance)throw new Error("Canonical native mismatch: "+label);
}
function vector(actual:Vector,expected:Vector,label:string){
  for(const axis of ["x","y","z"] as const)scalar(actual[axis],expected[axis],label+"."+axis);
}
function rotation(actual:Rotation,expected:Rotation,label:string){
  if(!Object.values(actual).every(Number.isFinite))throw new Error("Nonfinite native rotation: "+label);
  const sign=actual.x*expected.x+actual.y*expected.y+actual.z*expected.z+actual.w*expected.w<0?-1:1;
  for(const axis of ["x","y","z","w"] as const)scalar(actual[axis]*sign,expected[axis],label+"."+axis);
}
/** Native body origin is canonical COM; q and -q are the same physical rotation. */
export function assertCanonicalNativeBody(actual:NativeBodyFacts,expected:NativeBodyFacts):void{
  scalar(actual.mass,expected.mass,"mass");
  for(const key of ["localCom","principalInertia","translation","velocity","angularVelocity"] as const)vector(actual[key],expected[key],key);
  rotation(actual.inertiaFrame,expected.inertiaFrame,"inertiaFrame");rotation(actual.rotation,expected.rotation,"rotation");
  if(actual.sleeping!==expected.sleeping||actual.gyro!==expected.gyro)throw new Error("Canonical native flag mismatch");
}
export function assertMassImpulse(before:Vector,after:Vector):void{vector(after,{...before,x:before.x+1},"massImpulse");}
