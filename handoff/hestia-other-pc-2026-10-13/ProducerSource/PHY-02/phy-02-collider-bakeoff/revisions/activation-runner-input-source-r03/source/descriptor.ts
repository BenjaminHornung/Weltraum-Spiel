import type {Profile} from "../../phy01-migration2-r01/src/fork";
import type {Kind} from "../../phy01-migration2-r01/previous/src/geometry";
import type {stageEdit} from "../../activation-source-contract-r02/candidates/stageEdit";

type FileRef={readonly path:string;readonly bytes:number;readonly sha256:string};
type Staged=ReturnType<typeof stageEdit>;
type ProfileBinding=
  | {readonly profile:Extract<Profile,"legacy-impulse-v1">;readonly dynamicGyroscopicForces:false;readonly worldConstructor:"World"}
  | {readonly profile:Extract<Profile,"gyroscopic-v1">;readonly dynamicGyroscopicForces:true;readonly worldConstructor:"GyroscopicWorld"};
type Population=ProfileBinding & {
  readonly kind:Kind;
  readonly sourceStatus:"SOURCE_ONLY";
  readonly futureCaseCount:4;
  readonly preparedRegressionTitles:readonly [string,string,string];
  readonly originalSleepFail:{readonly id:string;readonly matrixOrdinal:number;readonly title:string;readonly rawStatus:"FAIL";readonly rawPath:string;readonly rawSha256:string;readonly pointer:string;readonly vitestPath:string;readonly vitestSha256:string;readonly vitestStatus:"failed"};
  readonly futureTitleRegex:string;
  readonly futureBindingRequirements:{readonly PHY02_PROFILE:Profile;readonly PHY02_KIND:Kind;readonly outputOwner:"LATER_EXPLICIT_GRANT_ONLY"};
  readonly newRuntimeStatus:"NOT_RUN";
};
export interface SourceOnlyReceiver {
  readonly schema:"phy02.activation.source-receiver.r03";
  readonly status:"SOURCE_ONLY";
  readonly slotStatus:"NOT_SLOT_READY";
  readonly grants:"NO_GRANTS";
  readonly startup:"FORBIDDEN";
  readonly selectedPreparation:{readonly regressions:18;readonly originalSleepFail:6;readonly total:24;readonly populations:6;readonly newRuntimeExecutions:0};
  readonly historicalMatrix:{readonly cases:192;readonly rawPASS:146;readonly rawFAIL:46;readonly remainingNativeMechanisms:40;readonly status:"UNCHANGED_INDEPENDENT_HISTORICAL"};
  readonly sourceMode:{readonly overlayExtension:".ts.source";readonly loaderInvocations:0;readonly candidateInit:"DEFERRED_REAL_WASM_LOAD_NOT_CALLED";readonly runtimeResolver:"NOT_QUALIFIED";readonly role:"DATA_AND_SOURCE_ONLY_RECEIVER"};
  readonly candidate:{readonly id:"rapier-0.21.0-phy01.migration2";readonly npmBase:"0.21.0";readonly engineVersion:"0.36.0";readonly parry3dVersion:"0.31.1";readonly vanillaSubstitution:false;readonly vendorCount:99;readonly wasmSHA256:string;readonly cargoLockSHA256:string;readonly adapter:FileRef;readonly factory:FileRef;readonly profile:FileRef;readonly stageEdit:FileRef;readonly stagedOperations:{readonly commit:keyof Pick<Staged,"commit">;readonly cancel:keyof Pick<Staged,"rollback">;readonly matureProtocolAdoption:false}};
  readonly fixture:{readonly recordPath:string;readonly recordBytes:number;readonly recordSHA256:string;readonly pointer:"/records/1";readonly id:"perforated-wall";readonly cellSize:0.125;readonly cellCount:23;readonly sourceDigest:string;readonly generator:FileRef;readonly generatorArguments:readonly ["perforated-wall",0.125];readonly originalRemoval:string;readonly preparedRemoval:string;readonly detachedOriginal:{readonly id:"detached";readonly cells:"[removed]";readonly origin:readonly [1,0,0]};readonly oracleChanges:0};
  readonly selectedPopulations:readonly [Population,Population,Population,Population,Population,Population];
  readonly overlaySources:{readonly typed18Origin:FileRef;readonly prepared18:string;readonly originalSix:string;readonly originalCallback:string;readonly originalOracleSource:FileRef;readonly originalCallbackBoundary:string;readonly sourceImportDelta:string};
  readonly importGraph:{readonly typed18Proof:FileRef & {readonly count:365};readonly oldReceiverHarness:FileRef;readonly futureWasmCapture:FileRef;readonly sourceEdges:string;readonly newReceiverValueImports:0;readonly engineClones:0};
  readonly cleanupOwnership:{readonly originalSix:{readonly owner:string;readonly cleanup:string;readonly primaryError:string;readonly cleanupError:string;readonly poisonedProcess:string;readonly outputBinding:string};readonly prepared18:{readonly owner:string;readonly cleanup:string;readonly primaryError:"MAY_BE_MASKED_IF_FREE_ALSO_THROWS";readonly collector:"NO_INDEPENDENT_CLEANUP_OBSERVER_IN_EXISTING_SOURCE"};readonly futureRequirement:string;readonly nativeHeapRecovery:"UNPROVEN"};
  readonly openProofs:readonly string[];
  readonly ownerChoice:false;
}
