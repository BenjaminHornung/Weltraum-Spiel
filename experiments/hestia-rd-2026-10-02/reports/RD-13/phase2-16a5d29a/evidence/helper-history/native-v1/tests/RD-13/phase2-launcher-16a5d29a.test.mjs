import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
test('actual launcher checks deadline and owned stop after a busy child receipt; no future admission wait',()=>{
 const text=readFileSync(resolve('reports/RD-13/phase2-16a5d29a/native-launch.mjs'),'utf8');
 const block=/busy=false;[\s\S]*?(if\(expired\|\|stopRequested\)\{process.exitCode=1;\}else\{process.exitCode=result.exitCode\?\?1;\})/.exec(text)?.[1];assert(block);
 const actual=new Function('expired','stopRequested','result','process',block);
 for(const [expired,stopRequested,code,expected] of [[false,false,0,0],[true,false,0,1],[false,true,0,1],[false,false,1,1],[false,false,null,1]]){
  const process={exitCode:undefined};actual(expired,stopRequested,{exitCode:code},process);assert.equal(process.exitCode,expected);
 }
 assert(!text.includes('while (true)'));assert(text.includes('clearInterval(control);clearTimeout(deadline)'));
});
