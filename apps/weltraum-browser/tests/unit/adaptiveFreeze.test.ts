import {expect,it} from "vitest";
import {deepFreeze,isDeepFrozen,requireDenseDataPropertyArray,requirePlainRecord,requireFinite} from "../../src/voxel/adaptive/validation";

it("does not treat a shallow Object.freeze as a recursive source proof",()=>{
  const value={child:{cells:[1,2,3]}};
  deepFreeze(value);
  expect(deepFreeze(value)).toBe(value);expect(isDeepFrozen(value)).toBe(true);
  const shallow=Object.freeze({child:{x:1}});expect(isDeepFrozen(shallow)).toBe(false);
  deepFreeze(shallow);expect(Object.isFrozen(shallow.child)).toBe(true);
});
it("does not memoize a cyclic subtree when a later sibling prevents the freeze",()=>{
  const parent:{child?:{parent:unknown};bad?:Uint8Array;later?:object}={};
  const child={parent};parent.child=child;parent.bad=new Uint8Array(1);
  expect(()=>deepFreeze(parent)).toThrow();parent.later={x:1};delete parent.bad;
  deepFreeze(child);expect(Object.isFrozen(parent)).toBe(true);expect(Object.isFrozen(parent.later)).toBe(true);
});
it("does not trust an externally supplied partial traversal as a full graph proof",()=>{
  const child={x:1},parent={child};deepFreeze(parent,new WeakSet([child]));
  expect(Object.isFrozen(child)).toBe(false);deepFreeze(parent);expect(Object.isFrozen(child)).toBe(true);
});
it("copies arrays, enforces limits and validates mutable child values even beneath frozen layouts",()=>{
  const child={x:1},array=Object.freeze([child]),record=Object.freeze({child});
  const first=requireDenseDataPropertyArray(array,"a","InvalidCanonicalValue");
  requirePlainRecord(record,"r");
    const next=requireDenseDataPropertyArray(array,"a","InvalidCanonicalValue");expect(next).not.toBe(first);expect(next).not.toBe(array);
    (next as unknown[])[0]=null;expect(requireDenseDataPropertyArray(array,"a","InvalidCanonicalValue")[0]).toBe(child);
    expect(requirePlainRecord(record,"r")).toBe(record);
  expect(()=>requireDenseDataPropertyArray(array,"a","InvalidCanonicalValue",{maximumLength:0})).toThrow();
  child.x=NaN;expect(()=>requireFinite((requirePlainRecord(record,"r").child as {x:number}).x,"x")).toThrow();
  const mutable=[1];requireDenseDataPropertyArray(mutable,"a","InvalidCanonicalValue");delete mutable[0];
  expect(()=>requireDenseDataPropertyArray(mutable,"a","InvalidCanonicalValue")).toThrow();
  const accessor:number[]=[];Object.defineProperty(accessor,"0",{get:()=>1,enumerable:true});Object.freeze(accessor);
  expect(()=>requireDenseDataPropertyArray(accessor,"a","InvalidCanonicalValue")).toThrow();
  expect(()=>requirePlainRecord(Object.freeze({get x(){return 1;}}),"r")).toThrow();
});
