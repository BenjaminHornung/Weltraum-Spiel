# RD-02 implementation plan

## Goal / context
Deliver actual F00–F07 LabFixtureV1 manifests, typed binary files and validated
presentation-replay scenarios for RD-03. Authority: original RD-02 card and
document 03, RD-00 frozen contracts; product read base
`b3c6523a94cd050f5a9a22dc27f4777fcc03363e`. Start
`63e52eea0f2afbde03ab83b8d66f62941097b314`, tree
`addf696048a320b9739fc1dc901047600d52e51c`.

## Constraints / architecture
Only exporters, fixtures, tests/RD-02 and reports/RD-02 are writable. No delegation,
shared-contract/config/package changes, product execution, service or GPU lease.
ProductIntegrated=false. Frozen importer owns private copies. Synthetic unit-face
projection and native product greedy projection remain separate. No World/Save/
Cut authority. Native TS staging changes import specifiers only, with Node's pinned
type erasure, original Git/byte bindings and adapter hashes. Manifest <=1 MiB and
payload <=128 MiB are checked before export/import allocations.

## Ordered phases
1. Verify all freeze bytes and original source graph; capture own boundary and
   lab-only pinned install in the external RD-02 run root.
2. Write FX01–FX05 and negative tests; execute RED against missing behavior and
   retain exact tests/stub/log bytes outside the candidate.
3. Implement the minimal exporter, synthetic recipes and pure b3 crop/vegetation
   adapter. Export static fixtures/scenarios, validate with frozen importer, and
   check source mutation, hashes and canonical re-export.
4. GREEN focused unit tests, own full lab check, supplemental RD-02 typecheck,
   build, concrete task/start/base boundary. Review full diff, exact-path local
   commit and terminal inventory/handoff. No merge/push/PR.

## Evidence / completion
Own wrapper captures commands, exit codes, raw log SHA/bytes under
`C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-02`.
Run `check`, `test:unit -- tests/RD-02`, `build`, and `verify:boundary -- --task
RD-02 --start 63e52eea0f2afbde03ab83b8d66f62941097b314 --base
b3c6523a94cd050f5a9a22dc27f4777fcc03363e`. Inventory binds each fixture, payload,
source and scenario. Export process CPU/time/bytes are diagnostic costs, not game
runtime performance. Browser/screenshots are NOT_APPLICABLE: no UI/render code.
Media/art/selection benchmarks remain NOT_RUN or unavailable.

## Risks / safe stop
Fail closed on source/blob/hash drift, cap overflow, invalid ownership/support or
coverage. Stop only a genuinely unavailable product path, not independent
synthetic fixtures. HEAD owns any material contract delta. Revert only own narrow
commits if separately authorized; preserve all foreign processes and automatic
untracked throughput logs. No DevToolbox tracking: not requested/authorized.

## Progress
- Freeze: PASS, 18/18 digests and original taskboard match; clean start branch.
- Source discovery: coast v5 and vegetation v3 are bounded pure generators; native
  presentation profiles/cameras are data. Crop boundary policy will be explicit
  open presentation boundary, no analytical ghost or coverage inflation.
- RED: six intended missing-implementation failures, later two missing-static-file
  failures and one missing-native-palette-binding failure retained externally.
- Implementation: 16 snapshots / eight replay scenarios, actual b3 crop and five
  native species; actual file export/import/re-export and reverse-order export.
- GREEN: nine focused checks, lab and supplementary typecheck, build pass. Native
  material runs gathered by material with shared immutable vertex payloads; caps
  and native profiles unchanged. Exact 1.8m marker and concrete F04 cell bindings.
- Precommit verification/review complete: full staged text/stat/whitespace review,
  independent face oracle plus all typed manifests/payloads/scenarios checked;
  task/start/base boundary and 18 freeze rows pass. All 429 actual fixture files
  match normal/reverse/static byte-for-byte; raw RED/GREEN logs are SHA-bound.
- Closeout is one narrow local commit and its external SHA/tree/full-path receipt;
  HEAD's independent verification and any integration remain separate. No blocker
  or integration claim; own source/log/install/build artifacts retained.
