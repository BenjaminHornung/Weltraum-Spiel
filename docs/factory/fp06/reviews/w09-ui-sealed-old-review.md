# W09 sealed UI independent source, contract and retained-evidence review

**Old candidate UI SPEC/QUALITY: FAIL solely F01 (technology control lifetime). Retained evidence/source-byte binding: PASS. Commit/Native/browser/full-W09 acceptance: NOT_RUN/PENDING.** Root granted only technologyView.ts + panels.test.ts follow-up after this finding; those later bytes/evidence are outside this verdict. No tests, build, browser, Native or profiling jobs were executed by reviewer. The earlier scaffold draft report remains immutable.

Subject: `/workspace/Weltraum-Spiel/.worktrees/fp06-ui-w09-2026-10-11`, branch `codex/hestia-fp06-ui-w09-2026-10-11`, base/HEAD `43a61c0f5be5df69e4f8bb42db89da3d7a3a4b2b`. Original seal (3751B) SHA256 `3ed3df962f5fd51dacf9b0c38c72c2f2cb7291159b3b7805d0ac58f055d28317`, sealed20:41:18.044457Z; actual patch (45461B) `997fb8170fc40c709c366d5b2c90ff5ed1a88b93a384eef83b8d75680a2a76ef`. Original five source files independently matched seal before the granted follow-up:

| Product (under apps/weltraum-browser) |Bytes|SHA256|
|---|---:|---|
|src/factory/ui/cargoPanel.ts|15555|6d7b7b565927e811dca394e67dccda51d9fe5fd6294e98611ecbcd1e042d6f78|
|src/factory/ui/machinePanel.ts|6494|9905cc0d9bd04ee2dc15903b03fca2399e4fa95fdf828ed6853787f97a19c2e7|
|src/factory/ui/powerPanel.ts|1283|2ffe21ca555fdd9f60d06997fd2a42a3c4775319ec7768e45aaeb161529a7f15|
|src/factory/ui/technologyView.ts|1212|95a6f969587634e50324cb3471b766d15a6257e9811c7f19161ff34800ea293a|
|tests/unit/factory/panels.test.ts|19075|2041382db969318d148170e649d911a12298fec75191b81f52069af2875a8ca6|

## Concrete finding F01 — preserve interactive technology controls

`technologyView.ts:7–10` calls `panel.content.replaceChildren()` on every Host publication and inside each technology button's click callback. This removes the actual selected/focused native button immediately. Preserving selected ID/details does not preserve its DOM node or browser keyboard focus; subsequent Enter/Tab cannot continue from that control. Source requirement FP03§14.3/§14.6 (lines1480–1487/1510–1518) requires real focus priority and logical keyboard navigation. This is a direct DOM-lifetime defect, not an invented observed browser or Native-input failure. Browser-specific blur/focusout ordering and native movement consequences were NOT_RUN. Retain stable buttons by technology ID and update selected details separately; meaningful countercase must preserve control identity/connection across selection and unrelated publications, including keyboard-focus semantics. Root/Domain received finding immediately. No other concrete required fix found.

## Other reviewed contracts

`cargoPanel.ts:34–104` delegates focus and owns only pending intent/DOM lifetime. Command IDs use UUIDhex with save-safe prefixes and retain raw Native session UUID. Duplicate submissions are blocked while pending; unknown/synchronous failed replies preserve that identity and expose readReceipt recovery. Both command ID and complete canonical request must match to settle. No receipt changes inventory or production numbers. Foreign session/epoch submissions and older publications are rejected; capabilities and Ready state constrain commands. Internal focus transitions retain ownership; dispose unsubscribes/removes listeners, releases held panel focus and ignores late replies. Actual Host input neutralization remains an integration gate.

Cargo controls retain stable nodes and editable exact quantities across publications; BigInt decimal parsing admits integer mg/mm/pieces only, rejects zero/negative/sub-unit/nonfinite/exponential/over-lot values. Transfers/pickups use accessible published endpoints, lot/container/entity revisions and source bindings; claim/capacity/geometry/lineage authority stays Host-owned. No UI timer, stock ledger, material gift, physics writer or optimistic stock exists.

Machine start matches frozen W01 catalogDigest and recipe ID/version/digest, selects exact immutable recipe inputs from published reachable input lots; manual recipes additionally require freshProduction lots and explicit active/finish commands. No missing enabled fact is invented for toggles. Status/work/buffers come from snapshots; null manual duration is never converted into zero or a countdown. Power projects actual published amounts; connection intents remain Integrator Entry work. Technology enumerates every Host-provided entry and exposes requirements/PLANNED without research locks; actual complete Host technology population is not proved by a one-technology fixture. German labels and native semantic controls are present. No claim of final visual or full native usability.

## Retained evidence binding

At20:44:39.251319Z all23 manifest refs matched actual SHA256/bytes (76298B); manifest14341B SHA256 `15e257c3063ca24d3774e21258e1611c822529d6a7cae97ff62817fb2f3147b2`. Initial29 paths =5 products +24 own-run files. Current35 paths additionally contain exactly six Root-authorized history-before-tech-focus-fix archive files; all five copied old seal/patch/manifest/report/review bytes match their originals. This is authorized preservation, not a scope defect. No commit exists; normal-Git/LFS/HEAD binding is not claimed. Frozen Host protocol remains8995B SHA256 `07b7a3e6ecf4b94fed367585dc4c094cb906d5688985e23177362867a3dc945c`.

All eight retained gzip payloads verify decompression integrity, actual compressed SHA/size, raw receipt SHA/size and exact external original-byte equality (22529 raw/6684 compressed bytes). Original command receipts remain unchanged. UTC date2026-10-11, actual cwd ownWT/apps/weltraum-browser:

|Phase|Actual start→end UTC|Exit|Actual retained result|
|---|---|---:|---|
|01 initialRED|20:21:38.680198→20:21:39.537366|1|4 collected assertion FAIL; no import failure|
|02 firstGREEN|20:29:47.384140→20:29:48.092080|0|4 PASS|
|03 safety/transferRED|20:31:44.068992→20:31:44.922800|1|4 assertion FAIL/6 PASS|
|04 receipt-payloadRED|20:34:24.414223→20:34:25.219646|1|1 assertion FAIL/10 PASS|
|05 UUID-shaped sessionRED|20:36:21.900185→20:36:22.720213|1|1 assertion FAIL/11 skipped; targeted UUID case|
|06 finalGREEN|20:38:05.835591→20:38:06.638684|0|12 UI PASS|
|07 affected regression|20:38:06.639444→20:38:08.012182|0|46 PASS in4 Catalog/Resources files|
|08 original full build|20:38:08.012509→20:38:11.781184|0|tsc -p tsconfig.json && vite build PASS; chunk-size warning retained|

Final UI rawSHA256 `ee7a6b25541aac7522a8fdf21a66641da9c2b0de2d77a4122f895e311c7a575e`/346B; regression `404f1ad5cd6dd2d90d8a065d2772279579883bf4ce8b9b8645e5440860623ab6`/457B; build `b513948a07670fe8498c06d767cf17629ca351150897baf9d183be1fe55c6a0f`/1904B. These prove the original sealed candidate's recorded phases only, not future fix bytes. Synthetic Document/snapshot unit evidence is explicit; no browser, screenshots, actual focus cancellation, paid native flow, save/recovery, hardware or Owner-art acceptance is inferred. Writer external report10796B SHA256 `8651857d04cc3f4981ea7a63de747e6fa7601a092b7a032af513130f78160a35`; own original report7360B SHA256 `8418ed33fb5224894552f14a73c8780acea825725971444bec072f74b0776f0c`.
