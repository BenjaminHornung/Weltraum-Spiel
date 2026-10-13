import assert from "node:assert/strict";
export const results: {name:string;status:"PASS"|"FAIL";error?:unknown}[]=[];
export function it(name:string,run:()=>void){
  try{run();results.push({name,status:"PASS"});}
  catch(error){results.push({name,status:"FAIL",error});throw error;}
}
export function expect(actual:unknown){
  return {
    toBe(expected:unknown){assert.ok(Object.is(actual,expected));},
    toEqual(expected:unknown){assert.deepStrictEqual(actual,expected);},
    toBeUndefined(){assert.strictEqual(actual,undefined);},
    toThrow(){assert.strictEqual(typeof actual,"function");assert.throws(actual as ()=>void);},
  };
}

