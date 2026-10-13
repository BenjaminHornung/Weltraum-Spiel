export type Profile = "legacy-impulse-v1" | "gyroscopic-v1";
export type Kind = "triangles" | "multi-cuboid" | "voxels";
export interface Descriptor {
    ordinal: number;
    id: string;
    profile: Profile;
    kind: Kind;
    group: string;
    gyro: boolean;
    title: string;
    historicalStatus: "PASS" | "FAIL";
    historicalAcceptance: string;
    historicalRawPath: string;
    failureClassification: string | null;
    historicalPointer: string | null;
    runtimeCurrent: string;
}
export interface ErrorValue {
    kind: "ThrownUndefined" | "Error" | "ThrownValue";
    name?: string;
    message?: string;
    value?: string;
}
export interface ResourceObservation {
    caseId: string;
    acquisition: {
        status: "NOT_RUN" | "PASS" | "FAIL";
        error?: ErrorValue;
    };
    acquired: boolean;
    primary: {
        status: "NOT_RUN" | "PASS" | "FAIL";
        error?: ErrorValue;
    };
    primaryPresent: boolean;
    cleanup: {
        status: "NOT_RUN" | "PASS" | "FAIL";
        error?: ErrorValue;
    };
    releaseAttempts: number;
    stopCauses: string[];
    disposition: "PREPARED" | "NOT_ACQUIRED" | "RELEASED" | "POISONED";
}
export interface CaseRecord {
    caseId: string;
    ordinal: number;
    profile: Profile;
    kind: Kind;
    group: string;
    gyro: boolean;
    status: "NOT_RUN" | "PASS" | "FAIL";
    primaryPresent: boolean;
    primary?: ErrorValue;
    resources: ResourceObservation[];
    diagnostics: Record<string, unknown>;
    poisoned: boolean;
    engineBinding: string;
    wasmSha256: string;
    classification: "DIAGNOSTIC_NOT_REFERENCE";
}
