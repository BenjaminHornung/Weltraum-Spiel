## FP06 advisory — first response (read-only, analysis only)

**Scope of this pass:** repo state + ownership/evidence integrity + the in-flight V2 codec seam in `apps/weltraum-browser/src/factory/persistence/factoryCheckpoint.ts` and `src/factory/session/dryFactorySlice.ts`. No tests, build, or browser run executed (parent owns the verification window) → all execution evidence below is **NOT RUN**.

### State observed

1. HEAD is still `7ee85b0 Preserve historical FP06 evidence and external review entry point`. **Every accepted FP06 candidate (MEMORY‑R01/R02/R03, COMPOSITION‑C02/C03, NATIVE_READ‑R01, CARRIER_MOTION‑R01, BELT_ADMISSION‑R01, SAVE_READ_DRAIN‑R01, V2 Units 1–3) exists only in the dirty worktree**: 41 modified + 8 untracked paths, 2737 insertions. `git diff --check` is clean.
2. `docs/factory/fp06/write-ownership.json` (modified) declares exactly two V2 leases: Writer1 = `factoryCheckpoint.ts`, `factorySaveStore.ts`, `hvpBootstrap.ts`; Writer2 = `dryFactorySlice.ts`, `factorySession.ts`, `hostPort.ts`, `factoryEntry.ts`, `restoreFactorySession.ts`. The dirty tree additionally spans `browser-storage/*` (5 files), `hestia-prototype/physics/*` (4), `player/locomotion.ts`, `factory/{construction,material,power,production,ui}`, `resources/transfer.ts`. Those are consistent with the earlier per‑candidate grants, not with the V2 leases — i.e. **HEAD and the evidence corpus are currently out of sync with the code they describe**.

### V2 contract conformance (read-only claims)

Verified as conforming: strict stored-version dispatcher (`decodeStoredFactoryCheckpoint`, line 1295) rejects unknown versions; V1 public decode keeps its own path while only the store route adapts (`adaptV1Owner`); issued-owner binding is a private `WeakMap` keyed by the frozen decoded object with `assertFactoryDecodedOwner` identity check (1071–1105, 1271–1276); compact conversion/held-generation admission (`admitFactoryV1OwnerImport`, line 1184) runs **before** Native source/collider expansion (`validateNativeSourceAndOwners`, line 1257) and the admission-changed recheck at 1263–1265; both encoders measure a placeholder-signed envelope before/after signing (1340+); V1 public encode path unchanged.

### Findings

**P2 — Deep `facts` (F) tampering is not rejected for V2 owners.**
`validateDryFactoryOwnerCheckpointState` (`factoryCheckpoint.ts` ~1005–1030) validates F only at top level: `ownerDataShape`/`dataOnly`, presence of `confirmed/binding/tickStartUs/tickEndUs/supply/machines/belts`, `facts.binding` equality, the 100 000 µs window, and that `facts.machines[].instanceId` / `facts.belts[].lineId` **sets** equal the domain's. It never cross-validates the nested per-machine/per-belt facts (e.g. `facts.machines[0].facts.installation.definitionRef`, `installationRevision`, nested `tickEndUs`, `command`) against the domain, unlike the V1 path which proves `nextStateBytes === canonicalJson(core)`.
Scenario: a re-signed V2 checkpoint (`encodeFactoryCheckpointV2` re-signs, and FNV‑1a32 is trivially recomputable) with an altered nested machine fact passes decode; `materializeDryFactoryStateV1` then emits historical V1 `inputBytes`/`factsBytes` that are not what the recorded interval actually was. The existing tamper test only flips `facts.tickEndUs` (`dryFactorySlice.test.ts:57-70`), which the top-level equality already catches, so acceptance item 1 ("manipulated F") is only partially covered. Impact is bounded — the next cold step falls through `dryOwnerReplayMatches` to rejection, and domain/`core` truth is still deeply validated — so this is an integrity/acceptance gap, not a state-corruption bug. Smallest remedy: deep-validate each `facts.machines[]` entry (binding, tick window, installation ref/revision) and `facts.belts[]` entry before issuing the owner, reusing the existing fact validators.

**P2 — Evidence-vs-source preconditions for the V2 acceptance criteria are unverifiable in this tree.**
`V2_IMPLEMENTATION_CONTRACT.md` acceptance 1–4 depends on "clean‑r06" and per-candidate reverts, but no committed revision contains the V2 code, and the worktree also holds the earlier candidate patches. Any "focused tests pass against clean‑r06" claim therefore binds to a tree that does not exist in git history, and a single `git checkout`/clean would destroy all of it. Smallest remedy: commit the accepted candidates (or at minimum record `git write-tree` hashes for candidate and clean copy) before the next verification window.

**P3 — `canonicalBytes` early bound is length-in-UTF‑16-units against a byte cap** (`factoryCheckpoint.ts` ~163): `value.length > cap` with `cap = FACTORY_SAVE_TRANSPORT_BYTES` (16 MiB) permits strings up to ~32 MiB before measurement. The real transport gate uses the measured `jsonUtf8Bytes` preflight, so this is only a weakened early guard, not an admission bypass.

### Not verified / open

- No test, TSC, build, or runtime execution performed → **NOT RUN**: V1 byte-equality Goldens, V2→V1 exact bytes over the paid W09 fixture, alias/cold-replay conflict, expansion-before-allocation rejection, full Save/Continue, browser restart, 16 kg loop, 15-min play.
- `README_PLAY.md`'s "combined Save and actual browser restart passed with three paid installations" is consistent with the historical R09 record and is explicitly scoped; it does not claim the V2 route or the 16 kg/WIP+belt restart. No overstated claim found there.
- Unverified assumption: `isImmutableData` gating of `trustedFactoryDryOwners` additions — I read the propagation and the `validateDryFactoryOwnerCheckpointState` deep domain checks and found no forged fast-path entry, but I did not exhaustively trace every `isImmutableData` caller.
- Unverified assumption: the `retainedBytesForImportedOwner` telemetry is not double-counted into `cpuWorkingBytes`; I did not chase every budget consumer.

**Next action I recommend to you (parent):** have me (a) diff-review one bounded seam at a time — suggested first: the V1-adaptation decode ordering and budget accounting at `factoryCheckpoint.ts:1150–1278` — and (b) tell me whether to treat the uncommitted aggregate as the review target or wait for per-candidate commits. I will not edit, build, or run tests without your explicit authorization.

