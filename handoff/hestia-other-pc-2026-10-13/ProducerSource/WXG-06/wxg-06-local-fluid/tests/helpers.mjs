import {background} from '../scripts/read-port.mjs';
import {fromW1,digest,N} from '../dist/contracts.js';
let frozen;
export async function config({wind=null,wall=false,opening=false,unknown=false,revision=1,decay=0.5}={}){
 frozen??=await background();const b=await fromW1(frozen.result),coverage=Array(N**3).fill(0),origin=b.positionMeters.map(x=>x-N/2);
 if(wall||unknown)for(let k=4;k<28;k++)for(let j=4;j<28;j++)if(!(opening&&j>=13&&j<19&&k>=13&&k<19))coverage[16+N*(j+N*k)]=unknown?2:1;
 const raw={schema:'wxg06.obstacle/v1',bodyId:b.bodyId,frameId:b.frameId,worldId:'wxg06.synthetic-world',sessionId:'wxg06.finite-session',epoch:b.epoch,sourceOwner:'wxg06.synthetic-voxel',revision,materialProfile:'wxg06.closed-solid-or-unknown/v1',unit:'meters',cellMeters:1,origin,coverage,provenance:'SyntheticVoxelProjection'};
 return {grid:32,maxBytes:16777216,cellMeters:1,origin,background:b,obstacle:{...raw,digest:await digest(raw)},decayPerSecond:decay,densityKgPerM3:0.01,controlWind:wind};
}
export function event(c,patch={}){const e={id:'nozzle',kind:'Nozzle',tick:c.background.tick,durationTicks:4,revision:c.obstacle.revision,craftRevision:1,frameId:c.background.frameId,epoch:c.background.epoch,sourceOwner:'wxg06.synthetic-signal',from:[10,16,16],to:[14,16,16],radiusMeters:2,speedMps:8,tracerKgPerSecond:0.01,heatKPerSecond:10,massFlowKgPerSecond:null,thrustN:null,active:true,...patch};return {...e,from:e.from.map((x,i)=>x+c.origin[i]),to:e.to.map((x,i)=>x+c.origin[i])};}
export async function readControl(){return frozen??=await background();}
