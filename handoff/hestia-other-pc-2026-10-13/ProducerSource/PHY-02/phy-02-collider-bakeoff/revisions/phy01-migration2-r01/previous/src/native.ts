import R012 from "rapier012";
import R021 from "rapier021";
import {recipe,rotate,vec,type CollisionRecipeDraft,type Kind,type Vec} from "./geometry.js";
import type {Fixture} from "./fixtures.js";
export type Mode="A"|"B"|"C";
export type Engine={mode:Mode;version:string;R:typeof R021};
let legacyInit:Promise<void>|undefined,modernInit:Promise<void>|undefined;
export async function engine(mode:Mode):Promise<Engine>{
  const R=mode==="A"?R012 as unknown as typeof R021:R021;
  await (mode==="A"?(legacyInit??=R012.init()):(modernInit??=R021.init()));
  return {mode,version:mode==="A"?"0.12.0":"0.21.0",R};
}
export function descriptors(e:Engine,r:CollisionRecipeDraft){
  const {R}=e;
  if(e.mode==="A"&&r.kind==="voxels")throw new Error("UNSUPPORTED voxels in 0.12");
  const result=r.kind==="voxels"
    ?[R.ColliderDesc.voxels(r.voxels!.slice(),{x:r.fixture.cellSize,y:r.fixture.cellSize,z:r.fixture.cellSize})]
    :r.kind==="triangles"
      ?[R.ColliderDesc.trimesh(r.triangles!.vertices.slice(),r.triangles!.indices.slice())]
      :r.boxes!.map(b=>{
        const s=r.fixture.cellSize;
        return R.ColliderDesc.cuboid((b.max.x-b.min.x)*s/2,(b.max.y-b.min.y)*s/2,(b.max.z-b.min.z)*s/2)
          .setTranslation((b.max.x+b.min.x)*s/2,(b.max.y+b.min.y)*s/2,(b.max.z+b.min.z)*s/2);
      });
  for(const d of result)d.setDensity(0).setFriction(.7).setRestitution(0);
  return result;
}
export function install(e:Engine,w:R021.World,r:CollisionRecipeDraft,dynamic=false,enabled=true,prepared?:R021.ColliderDesc[]){
  const {R}=e,f=r.fixture,m=r.mass;
  const d=(dynamic?R.RigidBodyDesc.dynamic():R.RigidBodyDesc.fixed())
    .setTranslation(...f.origin).setRotation(f.rotation).setEnabled(enabled)
    .setLinearDamping(0).setAngularDamping(0);
  if(dynamic)d.setAdditionalMassProperties(m.mass,m.center,m.axes.principalInertia,m.axes.frame);
  const body=w.createRigidBody(d),colliders:R021.Collider[]=[];
  try{
    for(const c of prepared??descriptors(e,r))colliders.push(w.createCollider(c,body));
    return {engine:e,world:w,recipe:r,body,colliders};
  }catch(error){w.removeRigidBody(body);throw error;}
}
export type Installed=ReturnType<typeof install>;
export const newWorld=(e:Engine,gravity=0)=>new e.R.World({x:0,y:-gravity,z:0});
export function publishQueries(e:Engine,w:R021.World){
  if(e.mode==="A"){
    (w as unknown as R012.World).updateSceneQueries();
    return {steps:0};
  }
  w.step();
  return {steps:1};
}
export function directRay(i:Installed,o:Vec,d:Vec,max=100):number|null {
  const ray=new i.engine.R.Ray(o,d),hits=i.colliders.map(c=>c.castRay(ray,max,true)).filter(n=>n>=0);
  return hits.length?Math.min(...hits):null;
}
export function worldRay(i:Installed,o:Vec,d:Vec,max=100):number|null{
  const h=i.world.castRay(new i.engine.R.Ray(o,d),max,true);
  if(!h)return null;
  return i.engine.mode==="A"?(h as unknown as {toi:number}).toi:h.timeOfImpact;
}
export function stageEdit(active:Installed,input:Fixture,incremental=false){
  const f=active.recipe.fixture,next=recipe(input,active.recipe.kind,active.recipe.binding.sourceRevision+1);
  if(input.id!==f.id||input.cellSize!==f.cellSize||JSON.stringify(input.origin)!==JSON.stringify(f.origin)
    ||JSON.stringify(input.bounds)!==JSON.stringify(f.bounds)||JSON.stringify(input.rotation)!==JSON.stringify(f.rotation))
    throw new Error("Edit changed owner/frame/coverage");
  if(incremental&&(active.recipe.kind!=="voxels"||active.engine.mode!=="C"))throw new Error("UNSUPPORTED incremental representation");
  const candidate=install(active.engine,active.world,incremental?active.recipe:next,active.body.isDynamic(),false);
  try{
    if(incremental){
      const before=new Set(f.cells.map(c=>c.join(":"))),after=new Set(input.cells.map(c=>c.join(":")));
      for(const c of f.cells)if(!after.has(c.join(":")))candidate.colliders[0].setVoxel(...c,false);
      for(const c of input.cells)if(!before.has(c.join(":")))candidate.colliders[0].setVoxel(...c,true);
      const m=next.mass;
      if(candidate.body.isDynamic())candidate.body.setAdditionalMassProperties(m.mass,m.center,m.axes.principalInertia,m.axes.frame,false);
    }
    let status:"staged"|"committed"|"rolled-back"="staged";
    return {candidate:{...candidate,recipe:next},get status(){return status;},
      commit(){
        if(status!=="staged")throw new Error("Candidate already consumed");
        if(!active.body.isValid()||!active.body.isEnabled())throw new Error("Stale active body");
        candidate.body.setTranslation(active.body.translation(),false);candidate.body.setRotation(active.body.rotation(),false);
        candidate.body.setLinvel(active.body.linvel(),false);candidate.body.setAngvel(active.body.angvel(),false);
        active.world.removeRigidBody(active.body);candidate.body.setEnabled(true);status="committed";
        return {...candidate,recipe:next};
      },
      rollback(){
        if(status!=="staged")throw new Error("Candidate already consumed");
        active.world.removeRigidBody(candidate.body);status="rolled-back";
      }};
  }catch(error){active.world.removeRigidBody(candidate.body);throw error;}
}
export function seamShift(a:Installed,b:Installed){
  const f=a.recipe.fixture,g=b.recipe.fixture;
  const actualFrame=(i:Installed)=>{
    const p=i.body.translation(),q=i.body.rotation(),f=i.recipe.fixture;
    if([p.x,p.y,p.z].some((v,k)=>Math.abs(v-f.origin[k])>1e-7)
      ||[q.x,q.y,q.z,q.w].some((v,k)=>Math.abs(v-[f.rotation.x,f.rotation.y,f.rotation.z,f.rotation.w][k])>1e-7))
      throw new Error("Seam pose changed from recipe frame");
  };
  actualFrame(a);actualFrame(b);
  if(f.cellSize!==g.cellSize||JSON.stringify(f.rotation)!==JSON.stringify(g.rotation))throw new Error("Invalid seam size/rotation");
  const delta=vec(g.origin.map((n,i)=>n-f.origin[i]) as unknown as readonly[number,number,number]);
  const inverse={...f.rotation,x:-f.rotation.x,y:-f.rotation.y,z:-f.rotation.z},local=rotate(inverse,delta);
  const shift=[local.x/f.cellSize,local.y/f.cellSize,local.z/f.cellSize] as const;
  if(!shift.every(n=>Math.abs(n-Math.round(n))<1e-8))throw new Error("Invalid seam origin");
  const s=shift.map(Math.round) as [number,number,number];
  const overlap=s.map((n,i)=>Math.min(f.bounds[i],n+g.bounds[i])-Math.max(0,n));
  if(overlap.some(n=>n<0)||overlap.filter(n=>n===0).length!==1)throw new Error("Non-adjacent seam coverage");
  return s;
}
export function couple(a:Installed,b:Installed){
  if(a.recipe.kind!=="voxels"||b.recipe.kind!=="voxels"||a.world!==b.world)throw new Error("Invalid native neighbors");
  const s=seamShift(a,b);a.colliders[0].combineVoxelStates(b.colliders[0],...s);return s;
}
export function propagate(a:Installed,b:Installed,cell:readonly[number,number,number]){
  const s=seamShift(a,b);a.colliders[0].propagateVoxelChange(b.colliders[0],...cell,...s);
}
