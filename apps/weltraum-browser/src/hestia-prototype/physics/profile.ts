import { STARTER_CELESTIAL_CATALOG, STARTER_BODY_IDS, surfaceGravityMetersPerSecondSquared } from "../../celestial";
import {fnv1aHash} from "../../core/hash";

/** Scoped prototype tuning; shared without loading the solver into the UI. */
export const HVP_PLAYER_PROFILE = Object.freeze({ height: 1.8, radius: 0.3, eyeHeight: 1.65,
  walkSpeed: 3, sprintSpeed: 5, stepHeight: 0.26, stepWidth: 0.125, offset: 0.01, slopeRadians: Math.PI / 4,
  jumpHeight: 0.8, terminalSpeed: 35 });

export interface HvpPlayerCheckpoint {
  readonly version:"hvp-player-checkpoint-v1";readonly profileDigest:string;readonly gravity:number;
  readonly position:Readonly<{x:number;y:number;z:number}>;readonly grounded:boolean;readonly velocityY:number;
  readonly jumpCount:number;readonly coverageHold:boolean;
}
export const HVP_PLAYER_PROFILE_DIGEST=fnv1aHash(JSON.stringify(HVP_PLAYER_PROFILE));
export const validateHvpPlayerCheckpoint=(value:unknown,gravity:number):HvpPlayerCheckpoint=>{
  const c=value as HvpPlayerCheckpoint|null;
  if(!c||Object.keys(c).sort().join(",")!=="coverageHold,gravity,grounded,jumpCount,position,profileDigest,velocityY,version"
    ||c.version!=="hvp-player-checkpoint-v1"||c.profileDigest!==HVP_PLAYER_PROFILE_DIGEST||c.gravity!==gravity
    ||!c.position||Object.keys(c.position).sort().join(",")!=="x,y,z"||![c.position.x,c.position.y,c.position.z].every(n=>Number.isFinite(Math.fround(n)))
    ||typeof c.grounded!=="boolean"||typeof c.coverageHold!=="boolean"||!Number.isFinite(c.velocityY)||Math.abs(c.velocityY)>HVP_PLAYER_PROFILE.terminalSpeed
    ||!Number.isSafeInteger(c.jumpCount)||c.jumpCount<0){throw new Error("Invalid player checkpoint/profile");}
  return c;
};

/** Small authored L-shaped timber specimen, separate from terrain/vegetation. */
export const HVP_INERTIA_KEY = "hvp:physics:inertia";
export const HVP_INERTIA_CELLS = Object.freeze(Array.from({length:8*8*2},(_,i)=>
  Object.freeze({x:i%8,y:Math.floor(i/8)%8,z:Math.floor(i/64),materialId:1})).filter(c=>c.x<1||c.y<1));

/** Six connected half-metre timber blocks; the bottom foot is terrain anchored. */
export const HVP_BRANCH_KEY = "hvp:branch:parent";
export const HVP_BRANCH_CELLS = Object.freeze([[0,0],[0,1],[0,2],[1,2],[2,2],[3,2]].flatMap(([bx,by])=>
  Array.from({length:64},(_,i)=>Object.freeze({x:bx!*4+i%4,y:by!*4+Math.floor(i/4)%4,z:Math.floor(i/16),materialId:1}))));
export const HVP_BRANCH_SUPPORT = Object.freeze({x:10,y:11,z:2});

/** Separate small salvage content; the normal timber/root-tree scale is unchanged. */
export const HVP_SALVAGE_CELLS=Object.freeze([
  ...Array.from({length:8},(_,y)=>Object.freeze({x:0,y,z:0,materialId:1})),
  Object.freeze({x:1,y:7,z:0,materialId:1}),
  ...Array.from({length:8},(_,i)=>Object.freeze({x:2+i%4,y:7+Math.floor(i/4),z:0,materialId:1}))
]);
export const HVP_SALVAGE_ZONE=Object.freeze({minX:-11.9,maxX:-11.1,minZ:-13,maxZ:-12.25});

export const resolveHvpGravity = (): number => {
  const body = STARTER_CELESTIAL_CATALOG.indexes.bodyById[STARTER_BODY_IDS.hestia];
  if (body === undefined) { throw new Error("Hestia gravity profile missing"); }
  const gravity = surfaceGravityMetersPerSecondSquared(body);
  if (!Number.isFinite(gravity) || gravity <= 0) { throw new Error("Hestia gravity profile invalid"); }
  return gravity;
};
