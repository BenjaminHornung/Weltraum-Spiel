import { parentPort } from 'node:worker_threads';
import { fixtures } from './helpers.mjs';
import { createWeatherReadView } from '../dist/src/contracts.js';
parentPort.once('message',async({order})=>{
  const bundle=await fixtures();const rows=[];
  for(const index of order){const f=bundle[index];const view=await createWeatherReadView(f);rows.push({index,result:await view.read(f.query)});}
  parentPort.postMessage(rows);
});
