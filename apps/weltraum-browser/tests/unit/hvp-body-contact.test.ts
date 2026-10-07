import {beforeAll,expect,it} from "vitest";
import checkpoint from "../fixtures/hvp-contact-r90-body384.json";
import {decodeHvpBody} from "../../src/hestia-prototype/persistence/bodyCheckpoint";
import {R,initializeHvpRapier,isHvpSolidCollider} from "../../src/hestia-prototype/physics/rapierPort";
import {installHvpRigidBody} from "../../src/hestia-prototype/physics/rigidBody";
import {captureHvpBodyHit} from "../../src/hestia-prototype/physics/bodyCut";
import {rotateStructuralWorldVector} from "../../src/voxel/structural";

beforeAll(initializeHvpRapier);
it("keeps a genuine native Body384 contact pickable across recorded micrometer motion",()=>{
  const saved=decodeHvpBody(checkpoint),recipe=saved.recipe;
  expect(recipe.source.contentHash).toBe("fnv1a64-v1:70d85a5593bd44c9");
  expect(recipe.colliders).toHaveLength(1);
  const eye={x:7,y:1.7817648649215698,z:-6.25};
  const direction={x:.674457592559825,y:-.3802508144914189,z:.6328635507888075};
  const poses=[
    {position:{x:8.427063941955566,y:.973335862159729,z:-4.908839225769043},
      rotation:{x:.03764636069536209,y:.6483198404312134,z:.01415773294866085,w:.7603049874305725}},
    {position:{x:8.4270601272583,y:.9733350872993469,z:-4.908840179443359},
      rotation:{x:.037642061710357666,y:.6483198404312134,z:.01416098140180111,w:.7603051066398621}}
  ];
  const world=new R.World({x:0,y:0,z:0});
  try{
    const body=installHvpRigidBody(world,recipe),target={ownerId:checkpoint.ownerId,body,recipe};
    const targets=new Map([[target.ownerId,target]]);
    // Diagnostic interpolation, not a claim to have recorded the exact Begin pose.
    const samples=Array.from({length:65},(_,i)=>({position:Object.fromEntries(Object.keys(poses[0]!.position).map(k=>
      [k,Math.fround(poses[0]!.position[k as "x"]+(poses[1]!.position[k as "x"]-poses[0]!.position[k as "x"])*i/64)])) as typeof poses[0]["position"],
      rotation:Object.fromEntries(Object.keys(poses[0]!.rotation).map(k=>
        [k,Math.fround(poses[0]!.rotation[k as "x"]+(poses[1]!.rotation[k as "x"]-poses[0]!.rotation[k as "x"])*i/64)])) as typeof poses[0]["rotation"]}));
    const failures:unknown[]=[];
    for(const [index,pose] of samples.entries()){
      body.setTranslation(pose.position,false);body.setRotation(pose.rotation,false);
      world.propagateModifiedBodyPositionsToColliders();world.updateSceneQueries();
      const native=world.castRay(new R.Ray(eye,direction),4,true,undefined,undefined,undefined,undefined,
        c=>isHvpSolidCollider(c)&&c.parent()?.isKinematic()!==true);
      expect(native?.collider.parent()).toBe(body);
      const position=body.translation(),rotation=body.rotation(),inverse={x:-rotation.x,y:-rotation.y,z:-rotation.z,w:rotation.w};
      const local=rotateStructuralWorldVector(inverse,{x:eye.x-position.x,y:eye.y-position.y,z:eye.z-position.z});
      const ray=rotateStructuralWorldVector(inverse,direction),center=recipe.mass.centerOfMassMeters!;
      const enter=native!.toi+1e-6;
      const start={x:local.x+center.x+ray.x*enter,y:local.y+center.y+ray.y*enter,z:local.z+center.z+ray.z*enter};
      const hit=captureHvpBodyHit(world,targets,eye,direction,index);
      if(hit===null){failures.push({index,pose,toi:native!.toi,start,bounds:recipe.colliders[0]});}
      else{expect(hit.ownerId).toBe(target.ownerId);expect(hit.cell).toEqual([189,84,76]);}
    }
    console.log("R90 genuine contact interpolation",{samples:samples.length,failures:failures.slice(0,6),failedCount:failures.length});
    expect(failures).toEqual([]);
  }finally{world.free();}
},120_000);
