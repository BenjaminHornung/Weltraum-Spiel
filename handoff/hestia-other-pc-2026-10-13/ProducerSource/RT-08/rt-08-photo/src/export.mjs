import {digest} from '../inputs/gfx03/spikes/gfx-03-backend-bakeoff/src/port.ts';
// RD variant-gallery pattern: recheck current identity after asynchronous PNG encoding.
export async function capturePng(canvas,session,provenance,encode=c=>new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('PNG encoding failed')),'image/png'))){
 if(session.state!=='complete')throw Error('Capture requires complete accumulation');
 const epoch=session.epoch,key=session.bindingKey,samples={...session.samples};
 const current=()=>session.state==='complete'&&session.epoch===epoch&&session.bindingKey===key;
 const blob=await encode(canvas);if(!current())throw Error('Stale PNG capture');
 const bytes=new Uint8Array(await blob.arrayBuffer()),sha256=await digest(bytes);if(!current())throw Error('Stale PNG capture');
 return {blob,sidecar:{...structuredClone(provenance),schema:'rt08.photo-sidecar.v1',executionLocation:'LOCAL_WINDOWS_ISOLATED',productIntegration:'NO',
   snapshotKey:key,epoch,samples,png:{byteLength:bytes.length,sha256},
   visualParity:'NOT_RUN',artDecision:'PENDING_OWNER',realtimeQualification:'NO'}};
}
