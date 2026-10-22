import {parentPort,workerData} from "node:worker_threads";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const start=performance.now();
const build=JSON.parse(readFileSync(new URL("../build-binding.json",import.meta.url)));
for(const row of build.files){
  const bytes=readFileSync(new URL("../"+row.path,import.meta.url));
  if(createHash("sha256").update(bytes).digest("hex")!==row.sha256)throw new Error("Worker artifact binding mismatch");
}
const {ScalarMesher,validateInput,validateProducts,identity,byteLength,physicalSlots}=await import("../dist/adapter.mjs");
const {meshHvpOccupancy,meshCollisionInput}=await import("../dist/oracle.mjs");
const {occupancy,budgets}=await import("../src/fixtures.mjs");
const wasm=workerData.variant==="scalar"?await ScalarMesher.create(new Uint8Array(readFileSync(new URL("../dist/scalar.wasm",import.meta.url))),
  build.files.find(f=>f.path==="dist/scalar.wasm").sha256):null;
const context=wasm?.admissionContext()??{instanceId:crypto.randomUUID(),epoch:0};
let busy=false;
parentPort.postMessage({ready:true,initMs:performance.now()-start,wasmInitMs:wasm?.initMs??null,node:process.version,context});
parentPort.on("message",async({id,input,sentMs})=>{
  const received=performance.now(),inputTransfer=received-sentMs;
  if(busy){parentPort.postMessage({id,error:"Double worker invocation"});return;}
  busy=true;
  try{
    let candidate;
    if(wasm)candidate=await wasm.run(input);
    else{
      let t=performance.now();validateInput(input);const binding=await identity(input);const inputValidation=performance.now()-t;
      t=performance.now();const binary=input.purpose==="render"?null:physicalSlots(input),inputCopy=performance.now()-t;
      t=performance.now();const products={render:input.purpose==="collision"?null:meshHvpOccupancy(occupancy(input),budgets,input.sourceDigest,"hvp-terrain-chunk-v1",{ao:true}),
        collision:input.purpose==="render"?null:meshCollisionInput({...occupancy(input),slots:binary})},kernelCall=performance.now()-t;
      t=performance.now();validateProducts(input,products);const outputValidation=performance.now()-t;
      candidate={binding,generation:input.generation,purpose:input.purpose,products,...context,
        costs:{inputValidation,inputCopy,kernelCall,outputCopy:0,outputValidation,adoption:0,total:performance.now()-received},
        memory:{wasmHeapBytes:0,inputBytes:input.slots.byteLength,candidateBytes:byteLength(products)}};
    }
    candidate.costs.inputTransfer=inputTransfer;
    const p=candidate.products,buffers=[p.render?.positions,p.render?.normals,p.render?.indices,p.render?.colors,p.collision?.vertices,p.collision?.indices]
      .filter(Boolean).map(a=>a.buffer);
    parentPort.postMessage({id,candidate,outputSentMs:performance.now()},[...new Set(buffers)]);
  }catch(error){parentPort.postMessage({id,error:String(error.stack??error)});}
  finally{busy=false;}
});
