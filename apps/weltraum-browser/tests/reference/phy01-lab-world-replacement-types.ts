import type {HvpDecodedGame,HvpDecodedLabGame} from "../../src/hestia-prototype/persistence/gameCheckpoint";
import type {HvpLabWorldCheckpoint,HvpWorldCheckpoint} from "../../src/hestia-prototype/persistence/worldCheckpoint";
import type {HvpCollisionSector} from "../../src/hestia-prototype/physics/terrainColliders";
import type {HvpLabPhysicsSession,HvpPhysicsSession} from "../../src/hestia-prototype/physics/session";
import type {HvpLabWorldReplacement,HvpWorldReplacement,prepareHvpLabWorldReplacement,prepareHvpWorldReplacement}
  from "../../src/hestia-prototype/physics/worldReplacement";

type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Expect<T extends true>=T;
type AssignableTo<Target,Source extends Target>=Source;
type ReplacementMeshes=readonly {index:number;mesh:HvpCollisionSector}[];

export type PublicReplacementArgumentsRemain=[
  before:HvpPhysicsSession,checkpoint:unknown,replacements:ReplacementMeshes,measureBodyHold?:boolean
];
export type PublicReplacementArgumentsAreStable=Expect<Equal<
  Parameters<typeof prepareHvpWorldReplacement>,PublicReplacementArgumentsRemain>>;
export type PublicReplacementReturnIsStable=Expect<Equal<
  Awaited<ReturnType<typeof prepareHvpWorldReplacement>>,HvpWorldReplacement>>;
export type PublicSessionCheckpointIsStable=Expect<Equal<
  ReturnType<HvpPhysicsSession["checkpoint"]>,HvpWorldCheckpoint>>;

export type LabReplacementArgumentsRemain=[
  before:HvpLabPhysicsSession,game:HvpDecodedLabGame,replacements:ReplacementMeshes,current:()=>boolean,measureBodyHold?:boolean
];
export type LabReplacementArgumentsAreFixed=Expect<Equal<
  Parameters<typeof prepareHvpLabWorldReplacement>,LabReplacementArgumentsRemain>>;
export type LabReplacementReturnIsFixed=Expect<Equal<
  Awaited<ReturnType<typeof prepareHvpLabWorldReplacement>>,HvpLabWorldReplacement>>;
export type LabSessionCheckpointIsLab=Expect<Equal<
  ReturnType<HvpLabPhysicsSession["checkpoint"]>,HvpLabWorldCheckpoint>>;
export type PublicDecodedCheckpointRemainsPublic=Expect<Equal<
  HvpDecodedGame["checkpoint"]["world"],HvpWorldCheckpoint>>;
export type LabDecodedCheckpointRemainsLab=Expect<Equal<
  HvpDecodedLabGame["checkpoint"]["world"],HvpLabWorldCheckpoint>>;

declare const labWorld:HvpLabWorldCheckpoint;
// @ts-expect-error a fixed LAB checkpoint cannot enter the public World checkpoint contract
export type LabCheckpointCannotBecomePublic=AssignableTo<HvpWorldCheckpoint,typeof labWorld>;
declare const labSession:HvpLabPhysicsSession;
// @ts-expect-error the LAB owner session cannot enter the public replacement factory
export type LabSessionCannotBecomePublic=AssignableTo<HvpPhysicsSession,typeof labSession>;
declare const labTransaction:HvpLabWorldReplacement;
// @ts-expect-error the LAB transaction handle cannot enter the public replacement contract
export type LabTransactionCannotBecomePublic=AssignableTo<HvpWorldReplacement,typeof labTransaction>;
