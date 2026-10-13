import type { Descriptor, CaseRecord } from "./case-types";
export declare function parseBoundJson(bytes: Uint8Array, maxBytes?: number): unknown;
export declare function consumeCaseRecords(raw: unknown, selected: readonly Descriptor[], binding: {
    engineBinding: string;
    wasmSha256: string;
}): Readonly<{
    protocol: "COMPLETE_DATA_PROTOCOL" | "HOLD";
    records: CaseRecord[];
    missing: string[];
    ordinaryFailures: string[];
    stopIndex: number | null;
    nativeAcceptance: false;
    physicalHeap: "UNPROVEN";
    referenceAcceptance: false;
}>;
export declare function consumeHistorical(raw: unknown, cases: readonly Descriptor[]): {
    classification: string;
    pass: number;
    fail: number;
    nativeCurrent: string;
};
