import { Matrix4 } from 'three';
import type { Vec3 } from '../../src/contracts/fixture';
import type { RayVolume } from '../../src/experiments/voxel-rays/volume';
/** Independent, explicitly synthetic test inputs only; never rewrite original fixture/profile bytes. */
function cells(slots:readonly number[],dimensions:Vec3=[slots.length,1,1],coverage=slots.map(()=>1),translation:Vec3=[0,0,0]):RayVolume {
  const packed=new Uint8Array(slots.length*4);
  slots.forEach((slot,i)=>{packed[i*4]=Number(slot!==0);packed[i*4+1]=coverage[i];packed[i*4+2]=slot;});
  const worldFromGrid=new Matrix4().makeTranslation(...translation);
  return {dimensions,offset:[0,0,0],originMeters:translation,quantumMeters:1,slots:Uint8Array.from(slots),coverage:Uint8Array.from(coverage),packed,
    worldFromGrid,gridFromWorld:worldFromGrid.clone().invert(),materialIds:['synthetic-dry','synthetic-wet','synthetic-wood'],materials:[],sourceSlotSha256:'2'.repeat(64),
    source:{ownerId:'rd13-synthetic-test',sourceNamespace:'rd13-synthetic-not-fixture',sourceRevision:0,regionId:'synthetic-cells',fixtureDigest:'0'.repeat(64),recipeSha256:'1'.repeat(64),
      sourceIds:[],sourceIdMeaning:{},originalDimensions:dimensions,originalOriginMeters:translation}};
}
const row=cells([1,1,0,2]); const d=1/Math.sqrt(3);
export const nativeCases:readonly {id:string;volume:RayVolume;origin:Vec3;direction:Vec3}[]=[
  {id:'entry-first-cell',volume:row,origin:[-1,.5,.5],direction:[1,0,0]},
  {id:'negative-zero-components',volume:row,origin:[5,.5,.5],direction:[-1,0,0]},
  {id:'negative-world-floor',volume:cells([1,0,2],[3,1,1],[1,1,1],[-4,0,0]),origin:[-4.25,.5,.5],direction:[1,0,0]},
  {id:'exact-negative-boundary',volume:row,origin:[1,.5,.5],direction:[-1,0,0]},
  {id:'inside-contiguous-run',volume:row,origin:[.5,.5,.5],direction:[1,0,0]},
  {id:'hollow-inside-air',volume:cells([1,0,1]),origin:[1.5,.5,.5],direction:[1,0,0]},
  {id:'null-component-outside-slab',volume:row,origin:[-1,2,.5],direction:[1,0,0]},
  {id:'zero-length-grazing',volume:row,origin:[-1,1,.5],direction:[1,0,0]},
  {id:'all-three-tied-axes',volume:cells([0,1,1,0,1,0,0,2],[2,2,2]),origin:[-1,-1,-1],direction:[d,d,d]},
  {id:'unknown-before-hit',volume:cells([0,0,1],[3,1,1],[1,0,1]),origin:[.5,.5,.5],direction:[1,0,0]},
  {id:'unknown-miss-is-not-clearance',volume:cells([0,0],[2,1,1],[1,0]),origin:[.5,.5,.5],direction:[1,0,0]},
  {id:'exit-at-unknown-face',volume:cells([1,0],[2,1,1],[1,0]),origin:[.5,.5,.5],direction:[1,0,0]},
];
