import {collisionSectors,type HvpCollisionSource} from "../snapshot/src/hestia-prototype/physics/terrainColliders";
import {createHvpWorkerPhysicsSession} from "../snapshot/src/hestia-prototype/physics/session";

const floor:HvpCollisionSource={sizeX:256,sizeY:8,sizeZ:256,cellMeters:.125,originMeters:{x:-16,y:-.125,z:-16},
  readSlot:(_x,y,_z)=>y===0?1:0};
const drop={x:-12,y:2,z:-10};
const player={spawn:{x:.75,y:.92,z:-1},coverage:[{minX:-16,maxX:16,minZ:-16,maxZ:16}]};
const direction=(session:Awaited<ReturnType<typeof createHvpWorkerPhysicsSession>>,point:{x:number;y:number;z:number})=>{
  const position=session.read().player!.position,delta={x:point.x-position.x,y:point.y-(position.y+.75),z:point.z-position.z};
  const length=Math.hypot(delta.x,delta.y,delta.z);
  return {x:delta.x/length,y:delta.y/length,z:delta.z/length};
};

export async function captureLegacyWorld(){
  const collision=[...collisionSectors(floor)],session=await createHvpWorkerPhysicsSession(collision,drop,9.81,player,
    {x:2,y:2,z:2},{x:0,y:0,z:0},"saved-world");
  try{
    session.play();session.advance(1/60);
    const structural=session.read().structural;
    if(!structural){throw new Error("Missing native branch source");}
    session.prepareBranch({id:"release",generation:0,sourceDigest:structural.sourceDigest,direction:direction(session,{x:.75,y:1.25,z:0})});
    session.commitBranch("release");session.finalizeBranch("release");
    const ownerId="hvp:terrain-fragment:r1:12345678";
    session.prepareTerrain("fragment",0,[{index:0,mesh:collision[0]!}],[{ownerId,origin:{x:-16,y:-8,z:-16},massKg:9.375,
      cells:[{x:48,y:68,z:128,materialId:1},{x:49,y:68,z:128,materialId:1}],
      colliderBoxes:[{min:[48,68,128],max:[50,69,129]}]}]);
    session.commitTerrain("fragment");session.finalizeTerrain("fragment");
    session.input({x:1,z:0,sprint:false,jump:false});
    for(let i=0;i<240;i+=1){session.advance(1/60);}
    session.input({x:0,z:0,sprint:false,jump:false});
    session.pause();
    if(!session.read().bodies.find(body=>body.ownerId===ownerId)?.sleeping){throw new Error("Native terrain owner did not sleep");}
    session.parkDistantBodies();
    const checkpoint=JSON.parse(JSON.stringify(session.checkpoint()));
    return {checkpoint,collision:collision.map(({vertices,indices})=>({vertices:Array.from(vertices),indices:Array.from(indices)}))};
  }finally{session.dispose();}
}
