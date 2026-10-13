import {parentPort} from 'node:worker_threads';
import {verifyConsumer,verifyBuild} from '../scripts/bindings.mjs';
verifyConsumer();verifyBuild();
const {createAnalyticReadView}=await import('../dist/src/weather.js');
parentPort.once('message',async({data,queries,order})=>{try{const view=await createAnalyticReadView(data);const rows=[];for(const index of order)rows.push({index,result:await view.read(queries[index])});parentPort.postMessage(rows);}catch(e){throw e;}});
