# Browser Adaptive Microvoxel Authority V1 Evidence

This timestamp-free artifact is generated from the same in-memory result as the JSON summary.

## Result

- Status: **PASS**
- Route: `/`
- Scope: `pure-core-browser-proof`
- TestBridge absent: `true`
- Visual UI change: `false`
- Browser console/page/request/HTTP errors: `0/0/0/0`
- Excluded claims: `renderer`, `streaming`, `worker`, `TestBridge-integration`

This is pure-core protocol proof executed inside Chromium on the normal application route. It does not claim renderer, worker, streaming, TestBridge, gameplay, or visual-product integration, and no screenshot is required because there is no visual UI change.

## Obligations

| ID | Status | Deterministic detail |
| --- | --- | --- |
| AMV-BROWSER-01 | PASS | L0-L4 quantum ladder, negative alignment, safe bounds, ancestry, and half-open extents verified. |
| AMV-BROWSER-02 | PASS | Every non-leaf parent has eight unique children that exactly partition its volume. |
| AMV-BROWSER-03 | PASS | Invalid alignment, negative zero, unsafe numbers, and ancestry-unsafe coordinates fail closed. |
| AMV-BROWSER-04 | PASS | Stable IDs reject empty, untrimmed, oversized, and unpaired-surrogate identities. |
| AMV-BROWSER-05 | PASS | Only deeply frozen constant-v1 descriptor data is accepted; callback and malformed shapes fail closed. |
| AMV-BROWSER-06 | PASS | Identity, version, revision, and sample variations change descriptor, content, and provenance authority. |
| AMV-BROWSER-07 | PASS | Ordered edits apply exactly once and immutable journal snapshots preserve prior values. |
| AMV-BROWSER-08 | PASS | Duplicate, gapped, malformed-coordinate, and non-finite edits fail closed. |
| AMV-BROWSER-09 | PASS | A-B-A rematerialization restores exact canonical bytes, content hash, and provenance hash. |
| AMV-BROWSER-10 | PASS | Constructor-issued immutable proof is accepted for exact authority, epoch, and snapshot. |
| AMV-BROWSER-11 | PASS | Stale epoch/snapshot and wrong authority/key/revision proofs fail before request or coverage authority. |
| AMV-BROWSER-12 | PASS | Copied, forged, and tampered proofs fail local-brand and digest validation. |
| AMV-BROWSER-13 | PASS | Required and optional request sets preserve deterministic desired/materialize semantics. |
| AMV-BROWSER-14 | PASS | Fallback remains atomic until all 64 L4 children are ready, then selected coverage replaces it. |
| AMV-BROWSER-15 | PASS | Complete selected coverage is unique, gap-free, non-overlapping, and volume exact. |
| AMV-BROWSER-16 | PASS | Brick-budget rejection is typed, deterministic, and side-effect empty. |
| AMV-BROWSER-17 | PASS | Cancelled residency cannot gain selected or fallback coverage authority. |
| AMV-BROWSER-18 | PASS | Collapse releases only derived products and rematerializes from retained authority. |
| AMV-BROWSER-19 | PASS | Eviction is idempotent and reload preserves descriptor, journal, bytes, content, and provenance. |
| AMV-BROWSER-20 | PASS | Canonical key/descriptor/journal/content/provenance/snapshot/proof/plan vectors match pinned literals. |

## Stable observations

```json
{
  "extents": [
    {
      "level": 0,
      "cellSizeMeters": 2,
      "extentQuantum": 256,
      "childCount": 8
    },
    {
      "level": 1,
      "cellSizeMeters": 1,
      "extentQuantum": 128,
      "childCount": 8
    },
    {
      "level": 2,
      "cellSizeMeters": 0.5,
      "extentQuantum": 64,
      "childCount": 8
    },
    {
      "level": 3,
      "cellSizeMeters": 0.25,
      "extentQuantum": 32,
      "childCount": 8
    },
    {
      "level": 4,
      "cellSizeMeters": 0.125,
      "extentQuantum": 16,
      "childCount": 0
    }
  ],
  "rejectionCounts": {
    "coordinate": 4,
    "descriptor": 4,
    "edit": 4,
    "identity": 5,
    "proof": 7
  },
  "proofFirstPath": "InvalidPlannerInput:snapshot/resident/0/validationProof",
  "descriptorAuthority": {
    "uniqueDescriptorDigests": 5,
    "uniqueContentHashes": 5,
    "uniqueProvenanceHashes": 5
  },
  "journal": {
    "firstRecordCount": 1,
    "secondRecordCount": 2,
    "addThenSubtractOccupancy0": 0,
    "subtractThenAddOccupancy0": 1
  },
  "aba": {
    "aContentHash": "fnv1a64-v1:50c0020c4b891832",
    "bContentHash": "fnv1a64-v1:95ba2c5457522be6",
    "aProvenanceHash": "fnv1a64-v1:3188b7bcfd593186",
    "bProvenanceHash": "fnv1a64-v1:02497ae49bc53ebc",
    "restored": true
  },
  "planner": {
    "requiredCount": 64,
    "optionalCount": 64,
    "fallbackCounts": [
      1,
      1,
      0
    ],
    "selectedCount": 64,
    "selectedVolume": 262144,
    "rejectedSideEffectCount": 0,
    "cancelledCoverageCount": 0
  },
  "release": {
    "collapseReleasedCount": 1,
    "evictionReleasedCounts": [
      1,
      0
    ],
    "authorityRetained": true
  },
  "canonicalVectors": {
    "key": {
      "byteLength": 216,
      "canonicalHash": "fnv1a64-v1:69a1fd51ba189b76"
    },
    "descriptor": {
      "byteLength": 188,
      "canonicalHash": "fnv1a64-v1:fbe25906701bf507",
      "descriptorDigest": "fnv1a64-v1:d35f808b2c5eee48"
    },
    "journal": {
      "byteLength": 482,
      "digest": "fnv1a64-v1:c8c7dc4baf7edc73",
      "canonicalHash": "fnv1a64-v1:b827d6f7d538d9f7"
    },
    "materialized": {
      "contentHash": "fnv1a64-v1:6fa95b9c11f2b5f6",
      "provenanceHash": "fnv1a64-v1:52acc30fb9b5da37"
    },
    "snapshot": {
      "acceptedDigest": "fnv1a64-v1:a4742926bffe485b",
      "proofDigest": "fnv1a64-v1:a756afcc8e9eb4cf",
      "rejectedDigest": "fnv1a64-v1:2d171393565cf1be"
    },
    "proof": {
      "contentHash": "fnv1a64-v1:6fa95b9c11f2b5f6",
      "provenanceHash": "fnv1a64-v1:52acc30fb9b5da37",
      "descriptorDigest": "fnv1a64-v1:e37982c711163a94",
      "journalDigest": "fnv1a64-v1:4144927f889a3178",
      "proofDigest": "fnv1a64-v1:7ff499bc651aab0e"
    },
    "accepted": {
      "planHash": "fnv1a64-v1:29d23cf307090000",
      "desiredCount": 64,
      "materializeCount": 64,
      "uncoveredRequiredKeyCount": 64
    },
    "rejected": {
      "planHash": "fnv1a64-v1:0c86d956b8677bce",
      "budget": "brick-count",
      "required": 64,
      "limit": 0
    }
  }
}
```
