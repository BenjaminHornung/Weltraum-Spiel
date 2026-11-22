import { expect,it } from "vitest";
import { serialize } from "node:v8";
import { writeFileSync } from "node:fs";
import { createTerrainComponentIndex,compactSupportReport } from "../../../src/voxel/structural/componentIndex";
import { createHvpTerrainRoot } from "../../../src/hestia-prototype/terrain/cutPlan";
import { analyzeHvpSupportSnapshot,createHvpSupportTimingsCollector } from "../../../src/hestia-prototype/terrain/supportPlan";
import { materializeHvpCoastSource,prepareHvpCoastSource } from "../../../src/hvp/hvpCoastSource";
import type { HvpCell } from "../../../src/hestia-prototype/terrain/picking";
import { rootFor,cutAt,diagonalFixture,uFixture } from "../../unit/componentIndex/compactFixtures";

it("compares frozen source snapshots with cold, world-order streaming, and repeated preparation",()=>{
  const trials=3;
  const arm=createHvpTerrainRoot(prepareHvpCoastSource(materializeHvpCoastSource()),"rockarm-scale",1);
  const cases=[
    {id:"rock-arm",visits:21,coldBlocks:47,warmBlocks:2,warmMiB:3,cut:cutAt(arm,[176,78,76],[180,82,80])},
    {id:"mixed-u",visits:5,coldBlocks:4,warmBlocks:1,warmMiB:1,cut:cutAt(rootFor(uFixture()),[12,2,4])},
    ...[2,6,10].flatMap(last=>[false,true].map(anchor=>({
      id:`diagonal-${last+1}-blocks${anchor?"-second-anchor":""}`,
      visits:last+(anchor?1:2),coldBlocks:last+1,warmBlocks:1,warmMiB:1,
      cut:cutAt(rootFor(diagonalFixture(last,anchor),[192,32,16]),[14,2,4])
    })))
  ];
  const rows=[];
  for(const {id,cut,visits,coldBlocks,warmBlocks,warmMiB} of cases) {
    const blocks:HvpCell[]=[];
    for(let z=0;z<Math.ceil(cut.before.sizeZ/16);z++)
      for(let y=0;y<Math.ceil(cut.before.sizeY/16);y++)
        for(let x=0;x<Math.ceil(cut.before.sizeX/16);x++) blocks.push([x,y,z]);
    for(let trial=0;trial<trials;trial++){
      const changed=cut.changed.map(c=>c.cell);
      const control=()=>{
        const clock=createHvpSupportTimingsCollector(),start=performance.now();
        const report=analyzeHvpSupportSnapshot(cut.after,changed,{},clock);
        const elapsed=performance.now()-start;
        const spans=clock.done(report.fragments.length,report.fragments.reduce((n,f)=>n+f.cells.length,0));
        return {report,elapsed,spans};
      };
      const candidate=()=>{
        const empty=createTerrainComponentIndex(cut.before);
        const measure=(index:typeof empty)=>{
          const start=performance.now(),result=index.prepareCompact(cut),prepareMs=performance.now()-start;
          const bridgeStart=performance.now(),report=compactSupportReport(result),legacyAdapterMs=performance.now()-bridgeStart;
          return {result,report,prepareMs,legacyAdapterMs,residentBytes:index.residentBytes(),partV8Bytes:serialize(result.fragments.map(f=>f.parts)).byteLength};
        };
        const cold=measure(empty);empty.dispose();
        // The whole fixture streams in grid order, independent of the location and shape of the later cut.
        const streamed=createTerrainComponentIndex(cut.before,4096);
        const warmStart=performance.now(),prewarm=streamed.warm(blocks),streamMs=performance.now()-warmStart;
        const streamResidentBytes=streamed.residentBytes(),warm=measure(streamed),repeat=measure(streamed);
        streamed.dispose();
        return {cold,warm,repeat,prewarm,streamMs,streamResidentBytes};
      };
      let reference,run;
      if(trial%2===0){reference=control();run=candidate();}else{run=candidate();reference=control();}
      for(const [state,sample] of [["cold",run.cold],["streamed",run.warm],["repeated",run.repeat]] as const){
        expect(sample.report.status).toBe(reference.report.status);
        expect(sample.report.fragments).toEqual(reference.report.fragments);
        const stats=sample.result.counters;
        expect(stats.componentsVisited).toBeLessThanOrEqual(visits);
        expect(stats.blocksBuilt).toBeLessThanOrEqual(state==="cold"?coldBlocks:warmBlocks);
        if(state!=="cold"){
          expect(stats.dirtyBlocksBuilt).toBe(stats.blocksBuilt);
          expect(stats.workingBytes).toBeLessThanOrEqual(warmMiB*1024*1024);
          expect(stats.voxelPayloadBytesCopied).toBe(0);
        }
        rows.push({id,trial,state,baseDigest:cut.before.sourceDigest,sourceRevision:cut.before.revision,targetRevision:cut.after.revision,
          order:trial%2===0?"oracle-first":"candidate-first",directRemoved:cut.changed.length,fragments:sample.result.fragments.length,
          cells:sample.result.fragments.map(f=>f.cellCount),shapes:sample.result.fragments.map(f=>f.colliderBoxes.length),
          oracleMs:reference.elapsed,oracleSpans:reference.spans,oracleProbes:reference.report.probes,
          prepareMs:sample.prepareMs,legacyAdapterMs:sample.legacyAdapterMs,residentBytes:sample.residentBytes,
          structuredCloneV8PartsBytes:sample.partV8Bytes,counters:sample.result.counters,
          ...(state==="streamed"?{streamMs:run.streamMs,streamedBlocks:blocks.length,streamResidentBytes:run.streamResidentBytes}:{}),
          oracleDiff:0});
      }
    }
  }
  const receipt={profile:"isolated CPU, no solver or renderer",trials,rows};
  if(process.env.HVP_P1_RECEIPT) writeFileSync(process.env.HVP_P1_RECEIPT,JSON.stringify(receipt,null,2)+"\n");
  else console.info("P1_SCALE",JSON.stringify(receipt));
},240000);
