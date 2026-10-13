import {beforeAll,expect,it} from "vitest";
import * as R from "../../phy01-migration2-r01/producer/src/rapier021Candidate";
beforeAll(()=>R.init());
it("selected primary candidate creates every dynamic body with explicit gyro false",()=>{
  expect(R.PHY01_SOLVER_PROFILE.id).toBe("rapier-0.21.0-phy01.migration2:legacy-impulse-v1");
  const world=new R.World({x:0,y:0,z:0});
  try{
    for(let i=0;i<3;i++)expect(world.createRigidBody(R.RigidBodyDesc.dynamic()).gyroscopicForcesEnabled()).toBe(false);
    expect(world.bodies.len()).toBe(3);
  }finally{world.free();}
});
