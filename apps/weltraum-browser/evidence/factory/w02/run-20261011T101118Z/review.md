# W02 review record

Writer: `/root/fp06_domain`; branch `codex/hestia-fp06-domain-2026-10-11`; predecessor W01 independently reviewed at `a30630dd7963c165c673df7ea1b46d52735752ef`.

This is the writer's self-review. Independent spec/contract/code review and the package exit gate are **NOT_RUN** here and must be supplied by root before dependent writes. The writer does not approve their own gate.

## Behavior and boundaries checked

Only the four granted W02 product files changed. Existing Resources, shared Contracts, Host, Physics, Save, UI, renderer, package/lock/config files are unchanged. The material view owns no shadow inventory: actual quantity lives in `ResourceContainerSnapshot.state.contents`; reservations describe custody and future output-space entitlement, and receipts describe completed commands. Display mass is freshly derived from those same quantities.

Admission accepts only positive safe integer mg, pieces or mm and checks integer mass multiplication. Existing Resources kg/m³ capacity limits must convert exactly to whole mg/mm³. Source-packed and conservative envelope volumes are rational cross-product comparisons with temporary BigInts; no rounded mass or volume credit, epsilon admission or persisted BigInt. Unknown real rock/gravel profiles remain inadmissible. T009 explicitly names a separate synthetic gravel profile and never creates real mining/cargo.

All transfers retain Resources access, directional-port, mission, ownership, sealed and indivisible-piece rules. A full split consumes one parent into two uniquely identified lineage children. C26 physically moves into exactly one real WIP container. Preparation uses immutable local candidates; source changes publish only with the complete verified candidate. Commit binds full catalog/resource/definition/state/reservation/receipt bytes and re-evaluates the command, so changed capacities, revisions or forged candidate fields cannot withdraw part of a source.

Output reservations cover exact mass, rational volume and stack slots. Foreign owners cannot fill that space or access reserved WIP. Active recipe WIP rejects ordinary transfers even from its job owner; incomplete or processed work is not silently returned as pristine cargo. Owner release requires empty WIP. Completion consumes the exact recipe-bound WIP once and creates both product and retained offcut in one candidate; repeat IDs return the existing receipt, while changed request bytes conflict. Grade/condition/custody are preserved, and incompatible declared input qualities reject before any withdrawal.

The caller remains the single Host/session authority. W04 must prove actual allocated energy and completed work before requesting `finish-recipe`, and the Host must admit session/epoch commands before calling this pure material seam. Those integrations are outside W02 and are not claimed here. WIP container capacity must cover the declared conservative input/output envelopes, including 18,000,000 mm³ for an 8-kg CUT output. No mining, fluid, destruction, clock, UI or save behavior is implemented by W02.

## Actual test history and TDD deviation

The first run failed while importing missing W02 modules and collected **zero** tests. This is **SETUP_FAIL**, not a business RED. Runtime business RED for the original T009–T012 before their implementation is **NOT_RUN**. Their initial implementation therefore deviated from the user's requested test-first sequence; this record does not reconstruct or replay a fictional earlier failure.

Two subsequent safety changes have actual business RED before their fixes:

* `red-wip-lock.log`: 1 failed, 12 passed; ordinary owner transfer from recipe WIP incorrectly returned Prepared. The following one-line WIP lock preceded GREEN.
* `red-condition-preservation.log`: 1 failed, 13 passed; completed source condition was missing. `red-material-quality.log`: 2 failed, 13 passed; missing condition plus incompatible declared grades incorrectly admitted. The minimal preservation/mixing guards followed these REDs.

Final focused and affected regressions: 5 files, **61 tests passed** (15 W02, 12 W01, 34 existing Resources). Final TypeScript/Vite build: **PASS**; the pre-existing large-chunk warning remains. An early build attempt failed on TypeScript narrowing/brand/unused-import errors; corrected before the final build, with original outputs retained. These actual results establish behavior, not compliance with the missing original RED sequence.

Existing Cargo core browser regression: **PASS**, one Chromium test in 6.3 s, using the external scoped configuration under the explicitly leased port 5174 with unchanged 30-s test, 5-s expectation and 20-s startup defaults. Freshly regenerated historical reports were copied into this run; their deterministic bytes match the baseline. Only the two known historical paths were then restored from exact byte backups and both baseline hashes rechecked. Playwright closed its own server; a TCP probe found 5174 free and the lease was explicitly returned to root. This regression proves the unchanged browser Resources import/transfer boundary; it is not W09 gameplay or visual acceptance. W02 itself has no UI/render changes.
