import { createHvpTerrainRoot } from '../../src/hestia-prototype/terrain/cutPlan.ts';
import { CpuContactPass } from '../../src/ray/cpuContactPass.ts';
import { composeContactPixels } from '../../src/ray/composeContactPixels.ts';

const sha = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
  n => n.toString(16).padStart(2,'0')).join('');
const digest = value => sha(new TextEncoder().encode(JSON.stringify(value)));
const center = [1,2,1];
const template = {sizeX:3,sizeY:3,sizeZ:3,cellMeters:.125,
  originMeters:{x:-.1875,y:-.3125,z:.125},sourceDigest:'linear-contact-bounded-fixture'};
function terrain(unknown=false) {
  return createHvpTerrainRoot({...template,readSlot:(x,y,z)=>
    x===center[0]&&y===center[1]&&z===center[2]?(unknown?undefined:1):0},unknown?'r1-pixel-unknown':'r1-pixel-proof',0);
}

// Bounded input fixture. Cell values and revisions are read only from the current HVP terrain snapshot.
async function volumeOf(snapshot) {
  const cells=[],cellIds=[];
  for(let z=0;z<snapshot.sizeZ;z++)for(let y=0;y<snapshot.sizeY;y++)for(let x=0;x<snapshot.sizeX;x++){
    cells.push(snapshot.readSlot(x,y,z)??-1);cellIds.push('terrain/'+[x,y,z].join('/'));
  }
  const materials=[{id:1,role:'rock',source:'linear-contact-material-fixture'}];
  const payload={size:[snapshot.sizeX,snapshot.sizeY,snapshot.sizeZ],cellMeters:snapshot.cellMeters,
    origin:[snapshot.originMeters.x,snapshot.originMeters.y,snapshot.originMeters.z],cells,cellIds,
    authorityLeafEdge:16,rayPageEdge:8,coverage:cells.includes(-1)?'partial':'complete',exteriorCoverage:'KnownEmpty'};
  return {...payload,id:'r1-contact-fixture',provenance:'ANALYTICAL',rotation:[1,0,0,0,1,0,0,0,1],
    translation:[0,0,0],materials,binding:{domain:'r1-contact-proof',world:'bounded',session:snapshot.sessionId,
      epoch:String(snapshot.epoch),owner:'terrain',sourceRevision:snapshot.revision,sourceGeneration:snapshot.revision,
      sourceDigest:await digest(payload),frame:'world',originEpoch:0,transformGeneration:0,
      materialDigest:await digest(materials),algorithm:'rt01-direction-owned-positive-interval-v1'}};
}

export async function checkTerrainPixels(backend,tile,surfaces,submit) {
  const edge=tile.width;
    const root=terrain(), initial=root.read();
    let volume=await volumeOf(initial);
    const pass=new CpuContactPass(backend,()=>({coordinateFrameId:'world',projectionRevision:1,owners:[volume.binding]}));
    try {
    pass.setEnabled(true);if(!await pass.refresh([volume]))throw Error('initial geometry adoption');
    const shaded=composeContactPixels(pass,tile,surfaces);
    const resultCenter=buf=>Array.from(buf.slice(4*(edge/2*edge+edge/2),4*(edge/2*edge+edge/2)+4));
    const cut=root.prepare({sessionId:initial.sessionId,epoch:initial.epoch,revision:initial.revision,
      sourceDigest:initial.sourceDigest,commandId:'remove-occluder',toolPolicy:'hvp-plasma-v1',
      shape:{kind:'Box',min:center,max:center.map(n=>n+1)}});
    root.commit(cut);
    volume=await volumeOf(root.read());
    const sourceStale=composeContactPixels(pass,tile,surfaces);
    if(!await pass.refresh([volume]))throw Error('cut geometry adoption');
    const relit=composeContactPixels(pass,tile,surfaces);
    const partial=terrain(true);
    volume=await volumeOf(partial.read());
    if(!await pass.refresh([volume]))throw Error('unknown geometry adoption');
    const centralSample=pass.sample(tile.frame,surfaces[edge/2*edge+edge/2].ray);
    const unknown=composeContactPixels(pass,tile,surfaces);
    submit();
    const oldFrame=composeContactPixels(pass,tile,surfaces);
    const changed=Array.from({length:edge*edge},(_,i)=>
      [0,1,2].some(channel=>shaded[4*i+channel]!==tile.raster[4*i+channel])).filter(Boolean).length;
    const proof={
      beforeRevision:initial.revision,afterRevision:root.read().revision,cutCells:cut.changed.length,centerBefore:resultCenter(shaded),
      centerAfter:resultCenter(relit),direct:resultCenter(tile.direct),indirect:resultCenter(tile.indirect),emissive:resultCenter(tile.emissive),
      changedPixels:changed,centerUnknown:centralSample.kind==='RasterFallback'?centralSample.reason:null,
      digests:Object.fromEntries(await Promise.all(Object.entries({raster:tile.raster,shaded,relit,unknown,sourceStale,oldFrame}).map(async([k,v])=>[k,await sha(v.buffer)])))};
    return {proof,shaded,relit,unknown,sourceStale,oldFrame};
    } finally {pass.dispose();}
}
