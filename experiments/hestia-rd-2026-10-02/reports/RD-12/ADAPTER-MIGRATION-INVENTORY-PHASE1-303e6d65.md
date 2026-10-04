# RD12 adapter / migration-cost inventory — actual Phase1

This is implementation/compatibility cost inventory, not person-day, native
performance or programme-selection evidence. Product integration remains false.
Paths below are lab-relative; full hashes/changed paths are in the post-commit
candidate binding JSON named in the HANDOFF.

## Owned implementation and reuse

| File | Actual responsibility |
|---|---|
| `src/experiments/babylon/index.ts` | Async C3/C4 admission, one owned engine/scene/camera/loop, bounded compile/private adoption, submission identities, first-terminal and stage-aware cleanup; typed owned host |
| `src/experiments/babylon/projection.ts` | Private full source arrays/material slots/owners/lights, RH frame/quaternions, Float32 tolerance, one RGB→RGBA boundary, stock profile binding and discarded SDK compile-poll cleanup |
| `src/experiments/babylon/readiness.ts` | Minimal deadline/abort promise boundary; late work still observed |
| `src/experiments/babylon/main.ts` | Real native entry controls, strict typed tick, captured selections, unchanged loader/scenario runner, explicit bridge and observed status |
| `src/experiments/babylon/index.html` | Native controls and canvas; lab-only risk/diagnostic visibility |
| `tests/RD-12/unit.test.ts` | Sealed v2 BAB01–04 core, actual SDK CPU projection plus declared controlled acquisition/render, all source values and 20 lifecycle cycles per mode |
| `tests/RD-12/ownership.unit.test.ts` | Four supplemental actual SDK/controlled owning checks: emission, sRGB clear, discarded compile poll, first loss before factory return |
| `tests/RD-12/browser.spec.ts` | Fixed authored native flows, telemetry-bound media, viewport/ROI sensitivity, native loss/20 cycles and explicit non-green mapped-buffer qualification |
| `reports/RD-12/public-api-smoke.ts` | Compile-only actual public constructor/init/material/mesh/camera/device surface |
| `reports/RD-12/oracle.ts` | Versioned scene/material-depth oracle and deliberate-fault sensitivity; no borrowed RD11 invalid crop |
| `reports/RD-12/tsconfig.json` | Focused runtime/API/spec/config types; root unchanged |
| `reports/RD-12/vite.config.ts` | Actual standalone optimized entry build; no root registration substitute or server |
| `reports/RD-12/vitest.config.ts` | Exact RD12-only sequential checks, honest 120s CPU assertion execution budget |
| `reports/RD-12/playwright.config.ts` | Authored native-only configuration; no default executable/webServer, fresh C-only output; cannot grant a lease |
| `reports/RD-12/run.mjs` | C-only pinned execution, one bounded child, fresh cache/TMP/logs/receipts and source bindings |
| `reports/RD-12/bindings.mjs` | START689/shared18/public429/API33, original/v2 oracle history, build assets and direct-parent candidate proof |
| `reports/RD-12/PLAN-PHASE1-303e6d65.md` | Scope/order/DoD and honest Phase1/Phase2 split |
| `reports/RD-12/HANDOFF-PHASE1-303e6d65-20261004-A.md` | Reproduction, evidence/limits, preserved failures and HEAD wiring authority |
| `reports/RD-12/ADAPTER-MIGRATION-INVENTORY-PHASE1-303e6d65.md` | This actual compatibility/cost inventory |

Five runtime/entry files: 458 TypeScript lines plus 34 HTML lines, 45,677 source
bytes. Public wrapper registrations are retained intentionally. Current optimized
output: 44 JS chunks/1,831,052 bytes, main 1,219,207 bytes (~295.56k gzip), plus
actual entry and 429 unchanged public fixture files. This is not transferred-byte
or GPU-time evidence. No dependency added by the leaf and no speculative world,
input, save, physics, Havok, generic scene abstraction or root-config layer.

Reused unchanged: fixture import/digest/payload authority, inventory/replay loader,
`createFrameInput`, scenario sampling/runner and mount reservation/lifecycle.
Reviewed RD03/RD11 patterns but did not import a Three host or copy unbounded
readiness/private-autojoin/stale-status defects into the Babylon entry.

## Concrete compatibility costs / remaining native qualification

- RGB source stride 3 expands privately to SDK RGBA stride 4 with alpha 1: four
  extra CPU/upload-attribute bytes per colored vertex **per projected mesh**.
  Native upload/allocation totals are not measured. No source schema or payload
  changes; materials still own opacity.
- Source doubles privately project to Float32 at `1e-5` component tolerance.
  Shader matrices/driver numerics/native readback still require Phase2 evidence.
- StandardMaterial's stock GLSL/WGSL, image processing/ACES and lighting BRDF are
  not Three Lambert/canonical hooks. Specular is black; emission remains lit;
  water ordering/depth/opacity bind, but water/weather/sky/shadow/AO/BRDF/output/
  sample/canvas-alpha equivalence remains unsupported or unproved. C0 shadows
  are currently disabled; no prettier demo/extra particles substitute the control.
- First-error monitoring uses declared non-private `_device` only under exact
  9.29.0. Partial initialization uses pinned `_CommonDispose` and base disposal;
  disposed material readiness only terminates the SDK's uncancellable next poll.
  These are explicit version-specific maintenance seams, not cross-version APIs.
- Both compiler option paths are empty and every C4 stock material must report
  WGSL before compile. A native cold Q0 trace must still prove no glslang/TWGSL/
  CDN/offsite traffic; compile-only/constructor resolution is not that proof.
- Pinned WebGPU stock vertex/index allocation lacks COPY_SRC. SDK-retained CPU
  attributes and source poses are **not mapped native GPU data**. The authored
  qualification test deliberately requires PASS_NATIVE_READBACK and therefore
  cannot qualify this current stock inspection result. Fix/qualify privately
  under Phase2 authority; never relabel it PASS or weaken the frozen gate.
- The v1 meaningful ROI/sensitivity oracle is fixed before native candidate
  observation. Insensitive faults fail; restoration sensitivity is not stock
  cross-renderer/art parity. Qualified C0 references/native screenshots are absent
  in Phase1. Historical REN12/water/stale-status failures stay open.
- No CPU/GPU selection timings, driver, allocated-memory or art success numbers
  are invented. Actual check wall times/hash/exit availability is in receipts.
  Missing RR7/six-concept/five-LFS evidence is still missing.

## Next boundary (HEAD, then same leaf)

HEAD alone adds the actual factory import and C3/C4 entries to the frozen registry,
and `src/experiments/babylon/index.html` to root Vite input after independent
recheck. No product wiring. Return a new full freeze and actual native lease to
this same leaf for optimized/native Phase2. Until then no browser, server, port
or GPU job; this Phase1 package cannot close the whole programme.
