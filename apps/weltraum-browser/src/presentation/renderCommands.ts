import { canonicalSignature } from "./canonical";
import {
  compareAscii,
  isContentHash,
  validateRevision,
  validateSemanticId,
  ArtifactRevision,
  BackendRevision,
  ContentHash,
  RepresentationKey,
  SourceRevision
} from "./ids";
import { validateMaterialProfile, type MaterialProfile } from "./materialProfile";
import { validateMeshArtifact, type MeshArtifact } from "./meshArtifact";
import { validateFrameProjectionSnapshot, validateVisibilityPlan, type FrameProjectionSnapshot, type VisibilityPlan } from "./visibilityPlan";
import { deepFreezeMetadata, invalidResult, issue, type ValidationIssue, type ValidationResult, validResult, throwIfInvalid } from "./validation";

export interface InitializeBackendCommand {
  readonly kind: "InitializeBackend";
  readonly backendRevision: BackendRevision;
}

export interface UpsertMeshArtifactCommand {
  readonly kind: "UpsertMeshArtifact";
  readonly backendRevision: BackendRevision;
  readonly artifact: MeshArtifact;
  readonly materialProfiles: readonly MaterialProfile[];
}

export interface RevisionBoundRepresentationCommand {
  readonly backendRevision: BackendRevision;
  readonly representationKey: RepresentationKey;
  readonly expectedSourceRevision: SourceRevision;
  readonly expectedArtifactRevision: ArtifactRevision;
  readonly expectedContentHash: ContentHash;
}

export interface RemoveRepresentationCommand extends RevisionBoundRepresentationCommand {
  readonly kind: "RemoveRepresentation";
}

export interface EvictRepresentationCommand extends RevisionBoundRepresentationCommand {
  readonly kind: "EvictRepresentation";
}

export interface ApplyVisibilityPlanCommand {
  readonly kind: "ApplyVisibilityPlan";
  readonly backendRevision: BackendRevision;
  readonly plan: VisibilityPlan;
}

export interface ApplyFrameProjectionCommand {
  readonly kind: "ApplyFrameProjection";
  readonly backendRevision: BackendRevision;
  readonly snapshot: FrameProjectionSnapshot;
}

export interface ResetBackendCommand {
  readonly kind: "ResetBackend";
  readonly backendRevision: BackendRevision;
  readonly nextBackendRevision: BackendRevision;
}

export interface DisposeBackendCommand {
  readonly kind: "DisposeBackend";
  readonly backendRevision: BackendRevision;
}

export type RenderCommand =
  | InitializeBackendCommand
  | UpsertMeshArtifactCommand
  | RemoveRepresentationCommand
  | EvictRepresentationCommand
  | ApplyVisibilityPlanCommand
  | ApplyFrameProjectionCommand
  | ResetBackendCommand
  | DisposeBackendCommand;

export type RenderCommandStatus =
  | "Accepted"
  | "RejectedStaleRevision"
  | "RejectedInvalidArtifact"
  | "RejectedUnsupportedCapability"
  | "RejectedContentConflict"
  | "AlreadyApplied"
  | "NotFound"
  | "BackendUnavailable";

export type BufferOwnershipOutcome =
  | "MovedToBackend"
  | "RetainedByCaller"
  | "AlreadyOwnedByBackend"
  | "ReleasedByBackend"
  | "NotApplicable";

export interface RenderCommandResult {
  readonly status: RenderCommandStatus;
  readonly ownership: BufferOwnershipOutcome;
  readonly reasonCode?: string;
  readonly message?: string;
}

export const renderCommandResult = (
  status: RenderCommandStatus,
  ownership: BufferOwnershipOutcome = "NotApplicable",
  reasonCode?: string,
  message?: string
): RenderCommandResult => Object.freeze({ status, ownership, reasonCode, message });

export const createRenderCommand = <T extends RenderCommand>(command: T): T => {
  let frozen: T;
  if (command.kind === "UpsertMeshArtifact") {
    const profiles = Object.freeze([...command.materialProfiles].sort((left, right) => compareAscii(left.id, right.id)));
    frozen = deepFreezeMetadata({ ...command, materialProfiles: profiles }) as T;
  } else {
    frozen = deepFreezeMetadata({ ...command }) as T;
  }
  throwIfInvalid("RenderCommand", validateRenderCommand(frozen));
  return frozen;
};

export const validateRenderCommand = (command: unknown): ValidationResult => {
  const issues: ValidationIssue[] = [];
  const add = (result: ValidationResult): void => {
    if (!result.valid) issues.push(...result.issues);
  };
  if (command === null || typeof command !== "object" || Array.isArray(command)) {
    return invalidResult([issue("InvalidRenderCommand", "command", "must be an object")]);
  }
  const record = command as Record<string, unknown>;
  add(validateRevision(record.backendRevision, "backendRevision"));
  try {
    switch (record.kind) {
      case "InitializeBackend":
      case "DisposeBackend":
        break;
      case "UpsertMeshArtifact": {
        const typed = record as unknown as UpsertMeshArtifactCommand;
        add(validateMeshArtifact(typed.artifact));
        const ids = new Set<string>();
        typed.materialProfiles.forEach((profile, index) => {
          add(validateMaterialProfile(profile));
          if (ids.has(profile.id)) issues.push(issue("DuplicateMaterialProfile", `materialProfiles[${index}]`, "profile IDs must be unique"));
          ids.add(profile.id);
        });
        const referenced = new Set(typed.artifact.materialRanges.map((range) => range.materialProfileId));
        if (referenced.size !== ids.size || [...referenced].some((id) => !ids.has(id))) {
          issues.push(issue("MaterialProfileCoverageMismatch", "materialProfiles", "must contain exactly one definition for every referenced profile ID"));
        }
        break;
      }
      case "RemoveRepresentation":
      case "EvictRepresentation": {
        const typed = record as unknown as RevisionBoundRepresentationCommand;
        add(validateSemanticId(typed.representationKey, "representationKey"));
        add(validateRevision(typed.expectedSourceRevision, "expectedSourceRevision"));
        add(validateRevision(typed.expectedArtifactRevision, "expectedArtifactRevision"));
        if (!isContentHash(typed.expectedContentHash)) issues.push(issue("InvalidContentHash", "expectedContentHash", "must use canonical fnv1a64 format"));
        break;
      }
      case "ApplyVisibilityPlan":
        add(validateVisibilityPlan((record as unknown as ApplyVisibilityPlanCommand).plan));
        break;
      case "ApplyFrameProjection":
        add(validateFrameProjectionSnapshot((record as unknown as ApplyFrameProjectionCommand).snapshot));
        break;
      case "ResetBackend": {
        const typed = record as unknown as ResetBackendCommand;
        add(validateRevision(typed.nextBackendRevision, "nextBackendRevision"));
        if (typed.nextBackendRevision !== typed.backendRevision + 1) {
          issues.push(issue("InvalidBackendResetRevision", "nextBackendRevision", "must be exactly backendRevision + 1"));
        }
        break;
      }
      default:
        issues.push(issue("UnsupportedCommandKind", "kind", "must be a supported render command kind"));
    }
  } catch {
    issues.push(issue("MalformedCommandPayload", "command", "does not contain the required payload for its kind"));
  }
  return issues.length === 0 ? validResult() : invalidResult(issues);
};

const commandFieldsForSignature = (command: RenderCommand): unknown => {
  if (command.kind === "UpsertMeshArtifact") {
    return { ...command, materialProfiles: [...command.materialProfiles].sort((left, right) => compareAscii(left.id, right.id)) };
  }
  return command;
};

export const renderCommandSignature = (command: RenderCommand): ContentHash =>
  canonicalSignature({ version: 1, command: commandFieldsForSignature(command) });
