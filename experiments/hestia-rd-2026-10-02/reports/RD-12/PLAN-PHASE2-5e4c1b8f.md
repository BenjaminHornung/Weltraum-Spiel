# ExecPlan: RD12 frozen native functional diagnostic

## Goal
Run the unchanged BAB01–04 native suite against the exact HEAD optimized build;
retain honest failures, qualify only observed functional evidence, and deliver a
local evidence-only candidate with source/media/receipt bindings and cleanup.

## Context
Executed source `5e4c1b8fea9026bc38aa38f4258d9892f2b848b7`, tree
`6e7d9936f712fad8b9cd7183a528c487b4fa36b9`. Immutable HEAD freeze/lease and
509-file build are supplied by HEAD. Original native spec, v1/v2 gates, fixtures,
profiles, thresholds and regions are immutable. Phase1 evidence remains intact.
Only new `tests/RD-12/**`, `reports/RD-12/**` and fresh owned external receipts
are authored. `productIntegrated=false` throughout.

## Non-goals
No runtime/root/shared/dependency/package edits, agents, delegation, qualified
GPU performance, vendor acceptance, art/product parity, publication or deletion.
Logical teardown counts are not released VRAM. CPU-retained buffers are not
native readback. Do not replace the HEAD build with a local build or dev server.

## Architecture decision
Reuse the frozen config's once-only admission. A single task-owned launcher
holds its legitimately created admission environment across inventory and
sequential native jobs; it never invents an existing-root capability. Keep
command logs in a separate fresh sibling root. A managed Vite preview serves
only the frozen optimized build at 127.0.0.1:5280 after exclusive free-port proof.
Subsequent supplemental configs use distinct fresh result sinks, never overwrite
the original native results. Seal every new harness before its native invocation.

## Implementation phases
1. Rehash the immutable freeze, lease, HEAD proof, 713 source files, 509 build
   assets/public429, shared18/API33 and pinned executables. Check exact source
   identity, scope and 52-input boundary. Preserve an explicit preflight receipt.
2. Prove port5280 free; start one owned managed preview. Rehash HTTP served bodies
   against the complete build manifest and retain console/readiness evidence.
3. Import the unchanged config once; enumerate its actual CLI inventory, then run
   the complete original suite unchanged with actual exit/timeout/result receipts.
4. Diagnose observed failures before any supplemental reader/capture harness.
   Preserve original results. Seal versioned supplemental checks; keep original
   semantic assertions/ROI/thresholds, report each discrepancy separately. Prove
   visible home/gallery navigation, normal-route bridge absence, observed default
   backend/adapter, functional lifecycle/loss and full-resolution media when valid.
5. Stop only the owned native launcher and preview; prove port free. Package valid
   native PNG/facts/contact sheet/measurements with relative paths and hashes.
   Self-review, fresh scoped checks, local evidence commit and postcommit bindings.

## Tests and evidence
Actual CLI inventory determines the denominator. Every native attempt has a
pre-run own-source seal, frozen runtime/build identity, raw output, exit/signal/
timeout, result/trace/media hashes. Original mapped-buffer assertions must run
and honestly fail while readback remains UNSUPPORTED. Insensitive fault ROI is
FAIL/DEFER, not a reason to change a crop or threshold. Any supplemental facts
reader first records the exact DOM/text discrepancy and its version distinction.

## Risks
Default adapter may be software or unavailable; classify observation, not a
qualified GPU lease. Hidden facts or fractional screenshot geometry may break
the original harness. Runtime readiness/compilation failures remain owning
findings; no runtime fixes are authorized. Original attempts are never relabelled.

## Rollback / safe stop
Stop on exact immutable mismatch, occupied5280, foreign path/process or material
authority gap. Preserve evidence and stop only task-owned IDs. No reset, remerge,
history rewrite, file deletion, foreign browser/process cleanup or HEAD ledger writes.

## Progress log
- [x] Read the grant, frozen config/native semantics, current source and build schemas.
- [x] Immutable preflight713/shared18/API33/public429/build509/executables and free-port proof.
- [x] Managed exact-build preview and all509 HTTP served bodies rehashed successfully.
- [x] Actual inventory16; unchanged original attempt exit1, FAIL16, no timeout.
- [x] Separately sealed native DOM diagnosis3PASS; explicit reader-v2 supplement12PASS/4FAIL, exit1, no timeout.
- [x] Both owned managed processes completed exit0; exclusive port5280 bind/release proves cleanup.
- [x] Relative253-file slice: 68 unchanged native PNG/facts pairs, compressed decoded ROI pixels, measurements and derived contact sheet.
- Final self-review/checks/commit/bindings are delivered as actual fresh receipts and
  the external postcommit candidate, not claimed merely by this precommit document.

## Observed deviations and findings
- Frozen facts reader sees empty innerText because the diagnostics details is
  collapsed. Original16 failures retained; separate diagnosis proves textContent
  discrepancy before versioned fallback. Original spec remains byte-identical.
- Earlier supplemental reader type check failed TS2345; only its nonempty string
  guard changed, and a fresh types check passed before supplemental native execution.
- Native locator captures work, including DPR2 CSS-size captures. No fractional
  geometry failure was observed, and no capture API/crop was changed.
- Native buffer assertions fail UNSUPPORTED for both backends, as anticipated.
- F06 faults produce MAE~0.00182, below unchanged0.01 sensitivity; both FAIL/DEFER.
  F01 omission controls pass same-backend qualification only. See the owning findings.
- No runtime repair was attempted; actual GPU identity/performance is unqualified.
- First precommit utility gate failed on cwd-scoped git ls-files hiding the root
  automatic logs. Its exact helper version/error/receipt are retained. Use full
  porcelain status and fresh02 review/check/guard/bindings; no native/test/media change.
- Native source remains5e4c1b8f. The authorized evidence-only commit must be an
  additive child of5e, not a fake direct303 candidate or a newly executed runtime.

## Definition of Done
Actual terminal results, exact denominator, backend/served-source/receipt/media
bindings, owning findings and cleanup proof are delivered. Native qualification
may fail; no whole-programme, performance, art or product completion claim.
