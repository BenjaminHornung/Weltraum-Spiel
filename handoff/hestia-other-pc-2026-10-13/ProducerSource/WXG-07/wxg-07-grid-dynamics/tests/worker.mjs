import {parentPort} from 'node:worker_threads';
import {loadFixture} from '../src/fixture.mjs';
import {decodeCheckpoint,encodeCheckpoint,digest} from '../src/checkpoint.mjs';
const {model}=loadFixture(32);
parentPort.on('message',({id,source,binding,delay})=>{
  const state=model.replay(decodeCheckpoint(model,source,binding),id.weatherTick),checkpoint=encodeCheckpoint(model,state,binding);
  setTimeout(()=>parentPort.postMessage({...id,checkpoint,snapshotDigest:digest(checkpoint)}),delay);
});
