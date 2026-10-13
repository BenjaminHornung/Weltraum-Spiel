import {encodeHvpBody} from "../../src/hestia-prototype/persistence/bodyCheckpoint";
import {encodeHvpGame,encodeHvpLabGame,type HvpLabGameCheckpoint} from "../../src/hestia-prototype/persistence/gameCheckpoint";
import {createHvpTerrainRoot} from "../../src/hestia-prototype/terrain/cutPlan";
import {ingestHvpStructuralCells} from "../../src/hestia-prototype/terrain/structuralIngest";
import {prepareHvpRigidBody} from "../../src/hestia-prototype/physics/rigidRecipe";
import {HVP_PLAYER_PROFILE_DIGEST,HVP_SOLVER_PROFILE,resolveHvpGravity} from "../../src/hestia-prototype/physics/profile";
import {materializeHvpCoastSource,prepareHvpCoastSource} from "../../src/hvp/hvpCoastSource";

export type SyntheticAuthoredCodecFixtures={lab:HvpLabGameCheckpoint;legacy:ReturnType<typeof encodeHvpGame>};

// SYNTHETIC_AUTHORED_CODEC_ONLY: build from the canonical source and pure structural encoders;
// this is not a capture or claim about an actual game save.
export const createSyntheticAuthoredCodecFixtures=():SyntheticAuthoredCodecFixtures=>{
  const terrainRoot=createHvpTerrainRoot(prepareHvpCoastSource(materializeHvpCoastSource()),"synthetic-codec",0);
  const source=ingestHvpStructuralCells("hvp:physics:drop",[{x:0,y:0,z:0,materialId:1}],
    [{materialId:1,densityKgPerCubicMeter:600,structuralClass:"wood",destructible:true,tags:null}]);
  const recipe=prepareHvpRigidBody(source),collider={isSensor:()=>false,isEnabled:()=>true,friction:()=>.5,restitution:()=>0,
    frictionCombineRule:()=>0,restitutionCombineRule:()=>0};
  const body={numColliders:()=>recipe.colliders.length,isEnabled:()=>true,isDynamic:()=>true,isFixed:()=>false,
    translation:()=>({x:0,y:4,z:0}),rotation:()=>({x:0,y:0,z:0,w:1}),linvel:()=>({x:0,y:0,z:0}),angvel:()=>({x:0,y:0,z:0}),
    collider:()=>collider,isSleeping:()=>false,isCcdEnabled:()=>false} as unknown as Parameters<typeof encodeHvpBody>[3];
  const drop=encodeHvpBody("hvp:physics:drop","drop",recipe,body),gravity=resolveHvpGravity(),terrain=terrainRoot.checkpoint();
  const worldData={sessionId:"synthetic-codec",gravity,terrainGeneration:terrain.revision,tick:{status:"Paused" as const,
    ticks:0,backlogSeconds:0,discardedSeconds:0},collisionDigest:"00000000",dropSpawn:{x:0,y:4,z:0},
    player:{version:"hvp-player-checkpoint-v1" as const,profileDigest:HVP_PLAYER_PROFILE_DIGEST,gravity,
      position:{x:0,y:2,z:0},grounded:true,velocityY:0,jumpCount:0,coverageHold:false},
    coverage:[{minX:-16,maxX:16,minZ:-16,maxZ:16}],bodies:[drop],branch:null,
    moving:{sequence:0,last:null},impulses:0,lastImpulseTick:null,lastImpulse:null,neighbor:null,parked:[]};
  const common={terrain,plants:[] as const,receipts:{
    terrain:{version:"hvp-command-receipts-v1" as const,kind:"terrain" as const,entries:[],last:null},
    structural:{version:"hvp-command-receipts-v1" as const,kind:"structural" as const,entries:[],last:null},
    moving:{version:"hvp-command-receipts-v1" as const,kind:"moving" as const,entries:[],last:null}},
    view:{camera:{mode:"Orbit" as const,preset:"C04-WIDE" as const,fov:55,position:{x:0,y:20,z:30},target:{x:0,y:0,z:0},
        quaternion:{x:0,y:0,z:0,w:1}},playerYaw:0,playerPitch:0,thirdPerson:true,waterEnabled:false,aoEnabled:false,
      tool:{mode:1,sequence:0,structureSequence:0,movingSequence:0,edges:0}},progress:null};
  return {lab:encodeHvpLabGame({...common,world:{version:"hvp-world-checkpoint-v1",solver:HVP_SOLVER_PROFILE.id,...worldData}}),
    legacy:encodeHvpGame({...common,world:{version:"hvp-world-checkpoint-v1",solver:"rapier-0.12.0",...worldData}})};
};
