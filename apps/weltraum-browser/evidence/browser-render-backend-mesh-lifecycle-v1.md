# Browser Render Backend Mesh Lifecycle V1 Evidence

## Result

- Status: `PASS`
- Normal route: `/`
- TestBridge absent before and after: `true`
- Harness: `640x360`, DPR `1`, antialias `false`, lighting `None`
- Console/Page/Request/HTTP errors: `0/0/0/0`

## Lifecycle

- Parent fallback visible keys: `planet:parent`
- Child active visible keys: `planet:child`
- Replacement visible keys: `planet:child`
- After child removal: `planet:parent`
- After reset: `0` visible keys
- After rebuild: `planet:child`
- Stale replace/remove: `RejectedStaleRevision` / `RejectedStaleRevision`
- Pinned fallback remove: `RejectedContentConflict`
- Reset/replay: `Accepted` / `Accepted`

## Canvas Evidence

- `render-backend-parent-fallback.png`: diff `0`, non-background `0.16576388888888888`, bounds `196,103-443,256`
- `render-backend-child-active.png`: diff `0`, non-background `0.16576388888888888`, bounds `196,103-443,256`
- `render-backend-replacement-active.png`: diff `0`, non-background `0.16576388888888888`, bounds `196,103-443,256`

- Parent-to-child changed ratio: `0.16576388888888888`
- Child-to-replacement changed ratio: `0.16576388888888888`

## Diagnostics After Rebuild

```json
{
  "acceptedArtifacts": 5,
  "rejectedArtifacts": 1,
  "activeRepresentations": 2,
  "activeFallbacks": 1,
  "geometryAllocations": 5,
  "geometryDisposals": 3,
  "materialAllocations": 12,
  "materialDisposals": 7,
  "estimatedGpuBytes": 252,
  "ownedCpuBytes": 252,
  "replacementCount": 1,
  "removeCount": 1,
  "staleRejectCount": 2,
  "resetCount": 1,
  "evictionCount": 0,
  "evictionRejectCount": 0,
  "rehydrationCount": 0,
  "renderTargetAllocations": 0,
  "renderTargetDisposals": 0,
  "activeRenderTargets": 0,
  "backendRevision": 1,
  "backendState": "Available",
  "residentRepresentationKeys": [
    "planet:child",
    "planet:parent"
  ],
  "visibleRepresentationKeys": [
    "planet:child"
  ],
  "pinnedFallbackRepresentationKeys": [
    "planet:parent"
  ],
  "lastCommandStatus": "Accepted",
  "lastOwnershipOutcome": "NotApplicable"
}
```

## Verification

- Command: `npm run test:e2e -- tests/e2e/render-backend-mesh-lifecycle.spec.ts`
- Canvas tolerance: per-channel 12; changed-pixel ratio <= 0.005
- Observed: `pass`
