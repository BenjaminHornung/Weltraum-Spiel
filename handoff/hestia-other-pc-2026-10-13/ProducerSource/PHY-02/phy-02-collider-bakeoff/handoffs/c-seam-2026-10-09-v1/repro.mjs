import fs from "node:fs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {spawnSync} from "node:child_process";
import R012 from "rapier012";
import R021 from "rapier021";
const modes=["A-trimesh","A-cuboid","B-trimesh","B-cuboid","C-uncoupled","C-coupled","C-reverse"];
const arg=process.argv.find(a=>a.startsWith("--case="))?.slice(7);
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
if(arg){
  assert(modes.includes(arg));const old=arg.startsWith("A-"),R=old?R012:R021;
  await R.init();const world=new R.World({x:0,y:-9.81,z:0});world.timestep=1/60;
  const s=.125,radius=.1*s,record={mode:arg,version:R.version(),stepsCompleted:0,requestedSteps:90,primary:null,cleanup:null,contactCallbacks:0,solverStepSeconds:world.timestep,slideOracle:"NOT_RUN"};
  try{
    const cells=new Int32Array(Array.from({length:32},(_,i)=>[i%2,Math.floor(i/2)%4,Math.floor(i/8)]).flat());
    const vertices=new Float32Array([0,0,0, .25,0,0, .25,.5,0, 0,.5,0, 0,0,.5, .25,0,.5, .25,.5,.5, 0,.5,.5]);
    const indices=new Uint32Array([0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5]);
    const shape=()=>arg.includes("trimesh")?R.ColliderDesc.trimesh(vertices.slice(),indices.slice())
      :arg.includes("cuboid")?R.ColliderDesc.cuboid(.125,.25,.25).setTranslation(.125,.25,.25)
      :R.ColliderDesc.voxels(cells.slice(),{x:s,y:s,z:s});
    const left=world.createCollider(shape().setDensity(0).setFriction(0).setRestitution(0),world.createRigidBody(R.RigidBodyDesc.fixed()));
    const right=world.createCollider(shape().setDensity(0).setFriction(0).setRestitution(0),world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(.25,0,0)));
    if(arg==="C-coupled")left.combineVoxelStates(right,2,0,0);
    if(arg==="C-reverse")right.combineVoxelStates(left,-2,0,0);
    const body=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(.0625,.5135,.0625).setLinvel(.25,0,0).setCcdEnabled(true));
    const ball=world.createCollider(R.ColliderDesc.ball(radius).setDensity(1).setFriction(0).setRestitution(0),body);
    for(let k=0;k<90;k++){
      world.step();record.stepsCompleted++;record.lastSuccessfulPosition=body.translation();
      for(const c of [left,right])world.contactPair(c,ball,()=>record.contactCallbacks++);
    }
    record.slideOracle=body.translation().x>3*s&&body.translation().y>.5&&record.contactCallbacks>0?"PASS":"FAIL";
    if(record.slideOracle==="FAIL")process.exitCode=1;
  }catch(error){record.primary={name:error.name,message:error.message,stack:error.stack};record.slideOracle="FAIL";process.exitCode=1;}
  finally{try{world.free();}catch(error){record.cleanup={name:error.name,message:error.message,stack:error.stack};process.exitCode=1;}}
  console.log(JSON.stringify(record));
}else{
  const root=new URL("../../",import.meta.url),receiptUrl=new URL("receipt.json",import.meta.url);
  if(fs.existsSync(receiptUrl)){
    const receipt=JSON.parse(fs.readFileSync(receiptUrl,"utf8"));
    for(const f of receipt.dependencies)assert.equal(sha(fs.readFileSync(new URL(f.path,root))),f.sha256,"Dependency byte mismatch "+f.path);
  }
  const results=modes.map(mode=>{
    const r=spawnSync(process.execPath,[new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/,"$1"),"--case="+mode],{encoding:"utf8",maxBuffer:2*1024*1024,timeout:30000});
    let result;try{result=JSON.parse(r.stdout.trim());}catch{result={mode,primary:"INVALID_CHILD_OUTPUT",stdout:r.stdout};}
    return {...result,exitCode:r.status,error:r.error?.message??null,stderr:r.stderr};
  });
  console.log(JSON.stringify({classification:"LOCAL_WINDOWS_ISOLATED_FUNCTIONAL_NOT_REFERENCE",results},null,2));
  if(results.some(r=>r.exitCode!==0))process.exitCode=1;
}
