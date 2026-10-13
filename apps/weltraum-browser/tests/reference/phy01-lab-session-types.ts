import type {HvpCollisionCoverage} from "../../src/hestia-prototype/player/locomotion";
import type {HvpDecodedLabGame} from "../../src/hestia-prototype/persistence/gameCheckpoint";
import type {HvpLabWorldCheckpoint,HvpWorldCheckpoint} from "../../src/hestia-prototype/persistence/worldCheckpoint";
import type {HvpCollisionSector} from "../../src/hestia-prototype/physics/terrainColliders";
import type {createHvpLabPhysicsSession,createHvpPhysicsSession,HvpLabPhysicsSession,HvpPhysicsSession} from "../../src/hestia-prototype/physics/session";

type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Assert<T extends true>=T;
type SessionParameters<C>=[
  sectors:readonly HvpCollisionSector[],
  spawn:Readonly<{x:number;y:number;z:number}>,
  gravity?:number,
  player?:Readonly<{spawn:{x:number;y:number;z:number};coverage:readonly HvpCollisionCoverage[]}>,
  inertiaSpawn?:Readonly<{x:number;y:number;z:number}>,
  branchSpawn?:Readonly<{x:number;y:number;z:number}>,
  sessionId?:string,
  checkpoint?:C,
  branchKind?:"branch"|"salvage",
  measureBodyHold?:boolean
];

export type PublicFactoryParametersRemainExact=Assert<Equal<Parameters<typeof createHvpPhysicsSession>,SessionParameters<unknown>>>;
export type LabFactoryDiffersOnlyAtIssuedGameCheckpoint=Assert<Equal<Parameters<typeof createHvpLabPhysicsSession>,SessionParameters<HvpDecodedLabGame>>>;
export type PublicCheckpointReturnRemainsLegacy=Assert<Equal<ReturnType<HvpPhysicsSession["checkpoint"]>,HvpWorldCheckpoint>>;
export type LabCheckpointReturnIsExact=Assert<Equal<ReturnType<HvpLabPhysicsSession["checkpoint"]>,HvpLabWorldCheckpoint>>;
export type PublicSolverLiteralRemainsLegacy=Assert<Equal<HvpWorldCheckpoint["solver"],"rapier-0.12.0">>;
export type LabSolverLiteralIsExact=Assert<Equal<HvpLabWorldCheckpoint["solver"],"rapier-0.21.0-phy01.migration2:legacy-impulse-v1">>;

// @ts-expect-error lab world checkpoint has the migration2 solver literal, not the public legacy literal
export type RejectedLabWorldAssignment=Assert<HvpLabWorldCheckpoint extends HvpWorldCheckpoint?true:false>;
// @ts-expect-error lab session exposes the lab checkpoint contract and cannot become a public session
export type RejectedLabSessionAssignment=Assert<HvpLabPhysicsSession extends HvpPhysicsSession?true:false>;
