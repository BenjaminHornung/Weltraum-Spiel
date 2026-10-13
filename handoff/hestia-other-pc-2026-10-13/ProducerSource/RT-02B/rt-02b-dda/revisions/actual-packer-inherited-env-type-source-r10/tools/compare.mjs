import assert from 'node:assert/strict';
export function compare(actual,expected,label='ray',epsilon=1e-9){
 const {distance:a,normal:an,...ar}=actual,{distance:b,normal:bn,...br}=expected;
 assert.deepEqual(ar,br,label);assert.ok(Math.abs(a-b)<=epsilon,label+' distance '+a+' != '+b);
 an.forEach((n,i)=>assert.ok(Math.abs(n-bn[i])<=epsilon,label+' normal'));
}
