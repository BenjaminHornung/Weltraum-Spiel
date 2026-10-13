// Compile-only signatures; no module is loaded or executed by the noEmit check.
import type {stageEdit as originalStageEdit,Installed} from "../../phy01-migration2-r01/previous/src/native";
import type {Fixture} from "../../phy01-migration2-r01/previous/src/fixtures";
import type {stageEdit} from "../candidates/stageEdit";

type Require<T extends true> = T;
type Staged = ReturnType<typeof stageEdit>;
type Original = ReturnType<typeof originalStageEdit>;
export type StagedSignatureChecks = [
  Require<Parameters<typeof stageEdit> extends [Installed,Fixture,boolean?] ? true : false>,
  Require<Parameters<typeof originalStageEdit> extends Parameters<typeof stageEdit> ? true : false>,
  Require<Staged extends Original ? true : false>,
  Require<Original extends Staged ? true : false>,
  Require<Parameters<Staged["commit"]> extends [] ? true : false>,
  Require<ReturnType<Staged["commit"]> extends Installed ? true : false>,
  Require<Parameters<Staged["rollback"]> extends [] ? true : false>,
  Require<ReturnType<Staged["rollback"]> extends void ? true : false>,
  Require<Staged["status"] extends "staged"|"committed"|"rolled-back" ? true : false>,
  Require<"abort" extends keyof Staged ? false : true>
];
