import {beforeAll,expect} from "vitest";
import {Candidate,installFixture,stageEdit} from "../src/fork";
import {fixture,splitFixture,type Cell} from "../previous/src/fixtures";
import {couple,propagate} from "../previous/src/native";
import {vec} from "../previous/src/geometry";
import {active,functional,observe,withWorld} from "./harness";
beforeAll(()=>Candidate.init());
const input=process.env.PHY02_SEAM??"";
if(!/^[xyz]-(0\.125|0\.25)-(slide|edit)$/.test(input))throw new Error("Explicit immutable seam case required");
const [axis,size,phase]=input.split("-"),s=Number(size),a=["x","y","z"].indexOf(axis),n=(a+1)%3;
const g=[0,0,0];g[n]=-9.81;
functional("unchanged seam "+input,()=>withWorld(w=>{
  w.timestep=1/60;const [fa,fb]=splitFixture(fixture("box",s),axis as "x"|"y"|"z");
  let left=installFixture(active,w,fa),right=installFixture(active,w,fb);
  if(active.kind==="voxels")couple(left,right);
  for(const c of [...left.colliders,...right.colliders])c.setFriction(0);
  const radius=.1*s,p=[s*.5,s*.5,s*.5],v=[0,0,0];p[n]=4*s+radius+.001;v[a]=2*s;
  const body=w.createRigidBody(Candidate.RigidBodyDesc.dynamic().setTranslation(...p as [number,number,number])
    .setLinvel(...v as [number,number,number]).setCcdEnabled(true));
  const ball=w.createCollider(Candidate.ColliderDesc.ball(radius).setFriction(0).setRestitution(0),body);
  let contacts=0,min=Infinity,max=-Infinity,steps=0;
  observe({axis,cellSize:s,phase,stepsCompleted:0,contactCallbacks:0,changedContactInvalidation:"NOT_RUN"});
  if(phase==="slide"){
    for(let k=0;k<90;k++){
      w.step();steps++;const pos=body.translation(),height=[pos.x,pos.y,pos.z][n];min=Math.min(min,height);max=Math.max(max,height);
      for(const c of [...left.colliders,...right.colliders])w.contactPair(c as unknown as Candidate.Collider,ball,()=>contacts++);
      observe({stepsCompleted:steps,contactCallbacks:contacts,position:pos,min,max});
    }
    expect([body.translation().x,body.translation().y,body.translation().z][a],"internal edge stopped sliding").toBeGreaterThan(3*s);
    expect(min,"seam penetration").toBeGreaterThan(4*s);expect(max,"seam launched body").toBeLessThan(4*s+radius+.025);
    expect(contacts).toBeGreaterThan(0);return;
  }
  // The unchanged edit oracle is independent of the slide assertion; a trap gets a separate disposable process.
  const changed:[number,number,number]=[1,1,1];changed[a]=fa.bounds[a]-1;changed[n]=fa.bounds[n]-1;
  const at=changed.map(v=>(v+.5)*s);at[n]=4*s+radius;
  body.setTranslation(vec(at as unknown as Cell),true);body.setLinvel({x:0,y:0,z:0},true);
  for(let k=0;k<10;k++){w.step();steps++;observe({stepsCompleted:steps});}
  const next={...fa,cells:fa.cells.filter(c=>c.join(":")!==changed.join(":"))},staged=stageEdit(left,next,active.kind==="voxels");
  const neighbor=installFixture(active,w,fb);neighbor.body.setEnabled(false);
  if(active.kind==="voxels"){couple(staged.candidate,neighbor);propagate(staged.candidate,neighbor,changed);}
  w.removeRigidBody(right.body as unknown as Candidate.RigidBody);neighbor.body.setEnabled(true);left=staged.commit();right=neighbor;
  for(let k=0;k<15;k++){w.step();steps++;observe({stepsCompleted:steps,position:body.translation()});}
  expect([body.translation().x,body.translation().y,body.translation().z][n],"removed voxel contact persisted").toBeLessThan(4*s);
  observe({changedContactInvalidation:"PASS",activeBodies:w.bodies.len(),colliders:w.colliders.len(),coverage:"UNKNOWN"});
},vec(g as unknown as Cell)));
