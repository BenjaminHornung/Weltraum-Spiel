import {expect,it} from "vitest";
import {createOwnedCanonicalHashCursor as baseline} from "../reference/hvp-r67-ownedCanonicalHashSteps";
import {createOwnedCanonicalHashCursor as candidate} from "../../src/voxel/adaptive/ownedCanonicalHashSteps";
import {canonicalAdaptiveJson,hashAdaptiveCanonical} from "../../src/voxel/adaptive";
import {ingestHvpStructuralCells} from "../../src/hestia-prototype/terrain/structuralIngest";

it("compares alternating exact preimage/current kernels on the complete384-cell structural payload",()=>{
  const cells=Array.from({length:384},(_,index)=>({x:176+index%24,y:82+Math.floor(index/24)%4,z:76+Math.floor(index/96),materialId:1}));
  const source=ingestHvpStructuralCells("r67-measure",cells,[{materialId:1,densityKgPerCubicMeter:512,
    structuralClass:"stone",destructible:true,tags:null}]);
  const payload=Object.freeze(Object.fromEntries(Object.entries(source).filter(([key])=>key!=="contentHash")));
  const before=canonicalAdaptiveJson(payload),expected=hashAdaptiveCanonical(payload),samples={baseline:[] as number[],candidate:[] as number[]};
  const run=(factory:typeof baseline)=>{
    const cursor=factory(payload);const start=performance.now();let result;
    try{do{result=cursor.advance(128);}while(result===undefined);}
    finally{cursor.dispose();}
    const elapsed=performance.now()-start;expect(result.contentHash).toBe(expected);return elapsed;
  };
  for(let warm=0;warm<8;warm+=1){run(baseline);run(candidate);}
  for(let pair=0;pair<9;pair+=1){for(const kind of pair%2===0?["baseline","candidate"] as const:["candidate","baseline"] as const){
    let total=0;for(let repetition=0;repetition<8;repetition+=1){total+=run(kind==="baseline"?baseline:candidate);}
    samples[kind].push(total/8);
  }}
  expect(canonicalAdaptiveJson(payload)).toBe(before);
  console.info("R67_KERNEL_MEASUREMENT",JSON.stringify({classification:"DIAGNOSTIC_NOT_GAME_ACCEPTANCE",batchSize:8,samples}));
});
