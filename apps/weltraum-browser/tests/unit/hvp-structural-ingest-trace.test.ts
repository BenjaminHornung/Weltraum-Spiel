import {describe,expect,it} from "vitest";
import {serializeStructuralObject} from "../../src/voxel/structural";
import {ingestHvpStructuralCells} from "../../src/hestia-prototype/terrain/structuralIngest";
import type {HvpCutSpan} from "../../src/hestia-prototype/runtime/cutTrace";

const cells=[{x:0,y:0,z:0,materialId:1},{x:1,y:0,z:0,materialId:1},{x:16,y:0,z:0,materialId:2}] as const;
const materials=[{materialId:1,densityKgPerCubicMeter:512,structuralClass:"stone",destructible:true,tags:null},
  {materialId:2,densityKgPerCubicMeter:768,structuralClass:"metal",destructible:true,tags:null}];
const create=(trace?:HvpCutSpan[])=>ingestHvpStructuralCells("trace-source",cells,materials,[{x:0,y:0,z:0}],trace?{commandId:"trace-command",thread:"body",trace:span=>trace.push(span)}:undefined);

describe("HVP structural ingest trace",()=>{
  it("preserves complete canonical serialization with absent, present, and throwing observers",()=>{
    const spans:HvpCutSpan[]=[];const plain=create();const observed=create(spans);
    const throwing=ingestHvpStructuralCells("trace-source",cells,materials,[{x:0,y:0,z:0}],{commandId:"trace-command",thread:"body",trace:()=>{throw new Error("trace sink");}});
    expect(serializeStructuralObject(observed)).toBe(serializeStructuralObject(plain));
    expect(serializeStructuralObject(throwing)).toBe(serializeStructuralObject(plain));
    expect(serializeStructuralObject(observed)).not.toContain("ingestTotalMs");
    expect(spans.map(span=>span.phase)).toEqual(["ingestSortRunsMs","ingestJournalMs","ingestMaterializeMs","ingestProofsMs","ingestStructuralMs","ingestTotalMs"]);
    expect(spans.every(span=>span.commandId==="trace-command"&&span.thread==="body"&&span.duration>=0)).toBe(true);
  });
  it("keeps duplicate and invalid-anchor failures equivalent and traced",()=>{
    const duplicate=[cells[0]!,cells[0]!];const plain=()=>ingestHvpStructuralCells("duplicate",duplicate,materials);
    const spans:HvpCutSpan[]=[];const traced=()=>ingestHvpStructuralCells("duplicate",duplicate,materials,[],{commandId:"duplicate-command",thread:"body",trace:span=>spans.push(span)});
    expect(plain).toThrow(/duplicate/i);expect(traced).toThrow(/duplicate/i);expect(spans.map(span=>span.phase)).toEqual(["ingestSortRunsMs","ingestTotalMs"]);
    const invalidAnchor=()=>ingestHvpStructuralCells("anchor",cells,materials,[{x:99,y:0,z:0}]);
    const invalidAnchorTrace=()=>ingestHvpStructuralCells("anchor",cells,materials,[{x:99,y:0,z:0}],{commandId:"anchor-command",thread:"body",trace:()=>{throw new Error("trace sink");}});
    expect(invalidAnchor).toThrow(/occupied/);expect(invalidAnchorTrace).toThrow(/occupied/);
  });
});
