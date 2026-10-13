import assert from "node:assert/strict";
import fs from "node:fs";
import {spawnSync} from "node:child_process";
import {engine,newWorld,install,couple} from "./dist/src/native.js";
import {fixture,splitFixture} from "./dist/src/fixtures.js";
import {recipe,vec} from "./dist/src/geometry.js";
const caseArg=process.argv.find(a=>a.startsWith("--case="))?.slice(7);
if(caseArg){
  assert(/^[xyz]:(0\.125|0\.25):(coupled|uncoupled)$/.test(caseArg));
  const [axis,size,state]=caseArg.split(":"),s=Number(size),a=["x","y","z"].indexOf(axis),n=(a+1)%3;
  const e=await engine("C"),f=fixture("box",s),[fa,fb]=splitFixture(f,axis),g=[0,0,0];g[n]=-9.81;
  const w=new e.R.World(vec(g)),record={case:caseArg,stepsCompleted:0,requestedSteps:90,shift:null,primary:null,cleanup:null,contactCallbacks:0,oracle:"NOT_RUN"};
  try{
    const l=install(e,w,recipe(fa,"voxels")),r=install(e,w,recipe(fb,"voxels"));
    if(state==="coupled")record.shift=couple(l,r);
    for(const c of [...l.colliders,...r.colliders])c.setFriction(0);
    const radius=.1*s,p=[s*.5,s*.5,s*.5],v=[0,0,0];p[n]=4*s+radius+.001;v[a]=2*s;
    const body=w.createRigidBody(e.R.RigidBodyDesc.dynamic().setTranslation(...p).setLinvel(...v).setCcdEnabled(true));
    const ball=w.createCollider(e.R.ColliderDesc.ball(radius).setFriction(0).setRestitution(0),body);
    for(let k=0;k<90;k++){w.step();record.stepsCompleted++;for(const c of [...l.colliders,...r.colliders])w.contactPair(c,ball,()=>record.contactCallbacks++);}
    const pos=body.translation();record.finalPosition=pos;record.mass=body.mass();
    assert([pos.x,pos.y,pos.z][a]>3*s,"internal edge stopped sliding");assert([pos.x,pos.y,pos.z][n]>4*s,"seam penetration");
    assert(record.contactCallbacks>0,"missing real contact");record.oracle="PASS";
  }catch(error){record.primary={name:error.name,message:error.message,stack:error.stack};record.oracle="FAIL";process.exitCode=1;}
  finally{try{w.free();}catch(error){record.cleanup={name:error.name,message:error.message,stack:error.stack};process.exitCode=1;}}
  console.log(JSON.stringify(record)); 
}else{
  const dir=process.env.PHY02_RUN_DIR??"evidence";assert(dir==="evidence"||/^evidence\/runs\/[a-z0-9-]+$/.test(dir));
  const cases=["0.125","0.25"].flatMap(s=>["x","y","z"].flatMap(a=>["uncoupled","coupled"].map(c=>a+":"+s+":"+c))),rows=[];
  for(const c of cases){
    const r=spawnSync(process.execPath,["seam-probe.mjs","--case="+c],{encoding:"utf8",maxBuffer:2*1024*1024,timeout:30000});
    let result;try{result=JSON.parse(r.stdout.trim());}catch{result={oracle:"FAIL",primary:"INVALID_PROBE_OUTPUT",stdout:r.stdout};}
    rows.push({...result,exitCode:r.status,error:r.error?.message??null,stderr:r.stderr});
    console.log(c+": exit "+r.status+" steps "+result.stepsCompleted+"/90");
  }
  fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(dir+"/seam-probe.json",JSON.stringify({
    classification:"LOCAL_WINDOWS_ISOLATED_FUNCTIONAL_NOT_REFERENCE",cases:rows,
    note:"Each case is a separate process because a native trap poisons the WASM instance. Uncoupled is diagnosis only and does not satisfy the mandatory coupling gate."},null,2)+"\n");
  if(rows.some(r=>r.exitCode!==0))process.exitCode=1;
}
