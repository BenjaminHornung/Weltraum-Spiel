import {expect,it,vi} from "vitest";
import type {HvpDecodedGame} from "../../src/hestia-prototype/persistence/gameCheckpoint";
import type {HvpPhysicsClient} from "../../src/hestia-prototype/physics/client";
import {replaceHvpScene} from "../../src/hestia-prototype/persistence/sceneReplacement";

// This fixture isolates coordinator ordering; complete Save validation has its own real codec suite.
vi.mock("../../src/hestia-prototype/persistence/gameCheckpoint",()=>({assertHvpDecodedGame:vi.fn()}));

it("rechecks ownership after awaited graphics staging before committing Native restore",async()=>{
  let current=true,finish!:(value:{publish():void;rollback():void;finish():void})=>void;
  const graphics=new Promise<{publish():void;rollback():void;finish():void}>(resolve=>{finish=resolve;});
  const commit=vi.fn(async()=>{}),rollback=vi.fn(async()=>{}),renderRollback=vi.fn(),pause=vi.fn(async()=>{});
  const physics={read:()=>({status:"Paused",ticks:0,terrainGeneration:0,bodies:[],player:null,bodyCount:0,colliderCount:0}),
    prepareRestore:async()=>({}),commitRestore:commit,rollbackRestore:rollback,command:pause} as unknown as HvpPhysicsClient;
  const operation=replaceHvpScene({checkpoint:{world:{}}} as HvpDecodedGame,"load-stale",physics,[],()=>graphics,()=>current);
  await Promise.resolve();current=false;finish({publish(){},rollback:renderRollback,finish(){}});
  await expect(operation).rejects.toThrow("RecoveryHold");expect(commit).not.toHaveBeenCalled();
  expect(rollback).toHaveBeenCalledOnce();expect(renderRollback).toHaveBeenCalledOnce();expect(pause).toHaveBeenCalledWith("Pause");
});
