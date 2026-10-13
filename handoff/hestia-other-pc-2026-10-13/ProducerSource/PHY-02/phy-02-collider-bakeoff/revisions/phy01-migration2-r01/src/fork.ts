import * as Candidate from "../producer/src/rapier021Candidate";
import type {Engine,Installed} from "../previous/src/native";
import {install,stageEdit} from "../previous/src/native";
import {recipe,type Kind} from "../previous/src/geometry";
import type {Fixture} from "../previous/src/fixtures";
export {Candidate,recipe,stageEdit};
export type Profile="legacy-impulse-v1"|"gyroscopic-v1";
export const profiles:readonly Profile[]=["legacy-impulse-v1","gyroscopic-v1"];
export const kinds:readonly Kind[]=["triangles","multi-cuboid","voxels"];
export const WASM_SHA256="ed3c8933d523eafb7d4d7a9a8efa04dd0da9d2279d4ae8cefb794c276ee98ea9";
export function context(profile:Profile,kind:Kind){
  if(!profiles.includes(profile)||!kinds.includes(kind))throw new Error("Unsupported explicit profile/representation");
  const World=profile==="gyroscopic-v1"?Candidate.GyroscopicWorld:Candidate.World;
  // The existing primitive port uses only common typed Collider/Body methods; both native namespaces are explicitly byte-bound.
  const engine:Engine={mode:kind==="voxels"?"C":"B",version:"0.21.0-phy01.migration2",R:{...Candidate,World} as unknown as Engine["R"]};
  return {profile,kind,engine,World,id:"rapier-0.21.0-phy01.migration2:"+profile};
}
export type Context=ReturnType<typeof context>;
export const worldFor=(c:Context,gravity:number|{x:number;y:number;z:number}=0)=>new c.World(typeof gravity==="number"?{x:0,y:-gravity,z:0}:gravity);
export function installFixture(c:Context,w:InstanceType<Context["World"]>,f:Fixture,dynamic=false){
  return install(c.engine,w as unknown as Installed["world"],recipe(f,c.kind),dynamic);
}
export function publish(w:InstanceType<Context["World"]>){
  w.propagateModifiedBodyPositionsToColliders();w.updateSceneQueries();
}
export function publishInstalled(i:Installed){publish(i.world as unknown as InstanceType<Context["World"]>);}
