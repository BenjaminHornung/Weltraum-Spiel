const fs=require('node:fs'),crypto=require('node:crypto');
(async()=>{
 const {createServer}=await import('vite');const srv=await createServer({configFile:false,root:process.cwd(),server:{middlewareMode:true},appType:'custom',logLevel:'error'});
 const rp=await srv.ssrLoadModule('/src/hestia-prototype/physics/rapierPort.ts');
 const {createHvpLocomotion}=await srv.ssrLoadModule('/src/hestia-prototype/player/locomotion.ts');
 const {resolveHvpGravity,HVP_PLAYER_PROFILE}=await srv.ssrLoadModule('/src/hestia-prototype/physics/profile.ts');await srv.close();await rp.initializeHvpRapier();const R=rp.R;
 const b=fs.readFileSync('../../art/factory/crashsite-hybrid-v2/crashsite-hybrid-v2.glb');const sha=crypto.createHash('sha256').update(b).digest('hex');
 if(b.readUInt32LE(0)!==0x46546c67||b.readUInt32LE(4)!==2)throw Error('Not GLB2');
 const jsonLength=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+jsonLength).toString('utf8'));const bin=b.subarray(28+jsonLength),verts=[],ids=[],shifted=[];
 for(const n of j.nodes)if(n.matrix||n.translation||n.rotation||n.scale)throw Error('Nonidentity node');
 for(const mesh of j.meshes)for(const p of mesh.primitives){
  if(p.mode!==undefined&&p.mode!==4)throw Error('Not triangles');const a=j.accessors[p.attributes.POSITION],v=j.bufferViews[a.bufferView],base=verts.length/3;
  if(a.componentType!==5126||a.type!=='VEC3')throw Error('Unexpected POSITION');
  for(let k=0;k<a.count;k++){const xyz=[0,1,2].map(q=>bin.readFloatLE((v.byteOffset||0)+(a.byteOffset||0)+k*(v.byteStride||12)+q*4));const door=mesh.name==='cargo_bay'&&j.materials[p.material].name==='amber'&&xyz[0]>=-1.5&&xyz[0]<=2.5&&xyz[1]>=2.75&&xyz[1]<=2.875&&xyz[2]>=2.25&&xyz[2]<=2.375;const conduit=mesh.name==='spine'&&j.materials[p.material].name==='petrol'&&xyz[0]>=-2.75&&xyz[0]<=4.5&&xyz[1]>=2.75&&xyz[1]<=2.875&&((xyz[2]>=-1.25&&xyz[2]<=-1.125)||(xyz[2]>=1.125&&xyz[2]<=1.25));if(door||conduit){xyz[1]+=.25;shifted.push({index:base+k,kind:door?'marker':'conduit'});}verts.push(...xyz);}
  const ia=j.accessors[p.indices],iv=j.bufferViews[ia.bufferView];if(![5123,5125].includes(ia.componentType))throw Error('Unexpected indices');const bytes=ia.componentType===5123?2:4;
  for(let k=0;k<ia.count;k++){const o=(iv.byteOffset||0)+(ia.byteOffset||0)+k*bytes;ids.push(base+(bytes===2?bin.readUInt16LE(o):bin.readUInt32LE(o)));}
 }
 const anchor={x:6.5,y:1.5,z:7.5},gravity=resolveHvpGravity(),world=new R.World({x:0,y:-gravity,z:0});
 world.createCollider(R.ColliderDesc.trimesh(new Float32Array(verts),new Uint32Array(ids)),world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(anchor.x,anchor.y,anchor.z)));
 world.createCollider(R.ColliderDesc.cuboid(8.25,.125,5.125).setTranslation(6.25,1.375,8.625));
 const player=createHvpLocomotion(world,{x:6.5,y:2.41,z:13.5},gravity,(x,z)=>x>=-16&&x<16&&z>=-16&&z<16);player.setEnabled(true);
 const samples=[];const neutral={x:0,z:0,sprint:false,jump:false};player.setInput(neutral);for(let k=0;k<120;k++){player.step();world.step();}const start=player.read();
 const go=(x,z,label)=>{let frames=0;for(;frames<240;frames++){const p=player.read().position;if(Math.hypot(x-p.x,z-p.z)<.02)break;player.setInput({x:Math.max(-1,Math.min(1,(x-p.x)/.05)),z:Math.max(-1,Math.min(1,(z-p.z)/.05)),sprint:false,jump:false});player.step();world.step();}player.setInput(neutral);for(let k=0;k<5;k++){player.step();world.step();}const state=player.read();const reached=Math.hypot(x-state.position.x,z-state.position.z)<.03&&state.grounded;samples.push({label,target:{x,z},frames,reached,...state});return reached;};
 const entered=go(6.5,8.9,'through-door');const turned=go(8,8.9,'inside-turn');const walkedInside=go(8,8,'bay-walk');const inner=player.read();const back1=go(8,8.9,'return-aisle');const back2=go(6.5,8.9,'return-door');const exited=go(6.5,13.5,'leave-ramp');const outside=player.read();
 const result={kind:'ISOLATED_PROPOSED_VISIBLE_DOOR_AND_CONDUIT_RAISE_250MM_NOT_ASSET_OR_GAMEPLAY_ACCEPTANCE',assetSha256:sha,proposedModifiedVertices:shifted.length,markerVertices:shifted.filter(x=>x.kind==='marker').length,conduitVertices:shifted.filter(x=>x.kind==='conduit').length,anchor,proposedApron:{minX:-2,maxX:14.5,minZ:3.5,maxZ:13.75,topY:1.5},playerProfile:HVP_PLAYER_PROFILE,gravity,vertices:verts.length/3,triangles:ids.length/3,trianglePayloadBytes:verts.length*4+ids.length*4,start,inner,outside,entered,turned,walkedInside,back1,back2,exited,allReached:entered&&turned&&walkedInside&&back1&&back2&&exited,samples};
 player.dispose();world.free();console.log(JSON.stringify(result));
})().catch(e=>{console.error(e.stack);process.exitCode=1});

