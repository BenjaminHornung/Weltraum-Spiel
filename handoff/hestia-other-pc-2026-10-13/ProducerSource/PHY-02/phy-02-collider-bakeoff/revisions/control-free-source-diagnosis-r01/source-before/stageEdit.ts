import {install,type Installed} from "../../phy01-migration2-r01/previous/src/native";
import {recipe} from "../../phy01-migration2-r01/previous/src/geometry";
import type {Fixture} from "../../phy01-migration2-r01/previous/src/fixtures";

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
