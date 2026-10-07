(() => {
 const original=Worker.prototype.postMessage,seen=new WeakSet(),pendings=new WeakMap();
 const state={armed:false,ownerId:null,sourceDigest:null,injected:null,events:[],drops:0,lastReadAim:null};
 const record=e=>{e.at=performance.now();if(state.events.length>=64){state.drops++;return;}if(JSON.stringify(e).length>1024){state.drops++;return;}state.events.push(e);};
 Object.defineProperty(window,"hestiaLifecycleFault",{value:state});
 Worker.prototype.postMessage=function(data,...rest){
  if(data?.protocol!=="hvp-physics-owner-v3")return Reflect.apply(original,this,[data,...rest]);
  const pending=pendings.get(this)??new Map();
  if(!seen.has(this)){seen.add(this);pendings.set(this,pending);this.addEventListener("message",event=>{
   const reply=event.data,request=pending.get(reply?.id);if(!request||reply.protocol!==data.protocol||reply.incarnation!==request.incarnation)return;pending.delete(reply.id);
   record({direction:"reply",...request,sequence:reply.sequence,rejected:reply.rejected!==undefined,error:reply.error!==undefined,
    foreignGeometryRejected:reply.rejected==="Foreign local body mesh geometry",
    releasedBeginRequestId:reply.bodyMeshReleased?.beginRequestId??null});
  });}
  if(data.kind==="Read"&&data.cutAim)state.lastReadAim={id:data.id,at:performance.now(),direction:{x:data.cutAim.x,y:data.cutAim.y,z:data.cutAim.z}};
  if(data.kind!=="Read"){
   const request={kind:data.kind,id:data.id,incarnation:data.incarnation,commandId:data.binding?.commandId??data.request?.id??data.transactionId??null,
    beginRequestId:data.binding?.beginRequestId??null,...(data.kind==='BeginBodyCut'?{direction:{...data.request.direction},lastReadAim:state.lastReadAim}:{})};
   if(pending.size<32)pending.set(data.id,request);else state.drops++;record({direction:"request",...request});
  }
  if(data.kind==="AdmitBodyChildMesh"&&state.armed){
   if(state.injected||data.binding?.ownerId!==state.ownerId||data.binding?.sourceDigest!==state.sourceDigest)throw Error("Lifecycle fault binding mismatch");
   const output=data.output;if(output?.buffers?.length!==7||output?.views?.length!==7||output.buffers[0].byteLength>8192||output.byteLength>8388608)throw Error("Lifecycle fault wire bounds");
   const header=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(output.buffers[0]));
   if(header.wire!=="hvp-body-cut-binary-v2"||!header.parts?.length)throw Error("Lifecycle fault header");
   const part=header.parts[0],colors=new Float32Array(output.buffers[4]),offset=part.vertexOffset*3;
   if(!Number.isSafeInteger(offset)||offset<0||offset>=colors.length||part.vertexCount<1)throw Error("Lifecycle fault color span");
   const previous=colors[offset];if(!Number.isFinite(previous)||previous<0||previous>1)throw Error("Lifecycle fault original color");
   colors[offset]=previous===0?1:0;let hash=0x811c9dc5;for(const buffer of output.buffers)for(const byte of new Uint8Array(buffer)){hash^=byte;hash=Math.imul(hash,0x01000193);}
   const contentHash=(hash>>>0).toString(16).padStart(8,"0");
   state.injected={commandId:data.binding.commandId,beginRequestId:data.binding.beginRequestId,admissionId:data.id,
    ownerId:data.binding.ownerId,sourceDigest:data.binding.sourceDigest,outputBytes:output.byteLength,
    oldColor:previous,newColor:colors[offset],oldHash:output.contentHash,newHash:contentHash};
   state.armed=false;
   data={...data,output:{...output,contentHash}};
  }
  return Reflect.apply(original,this,[data,...rest]);
 };
})()
