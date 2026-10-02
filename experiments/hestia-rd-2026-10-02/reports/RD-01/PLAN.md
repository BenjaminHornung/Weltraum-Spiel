# RD-01 execution plan

## Goal and context
Ship seven source-bound reference cards, an honest concept inventory and a deterministic JSON catalog/CLI for RD-40. Start: `89b55315fa7800a7a417c49e5e5a272f17410b4b`; read-only product source: `b3c6523a94cd050f5a9a22dc27f4777fcc03363e`. All 18 frozen files passed the pre-work byte check (`RD-01/preflight-freeze.json`).

## Non-goals and architecture
Only the four RD-01 allowlisted directories change. No UI, renderer, shared registration/configuration, product integration, media download, LFS retrieval, new dependencies, delegation or DevToolbox. Plain JSON plus a small pure catalog function and Node CLI; RD-40 can import the generated JSON. HTTP access, historical claims, current author text, media observation and Art acceptance stay separate. `ProductIntegrated=false`.

## Phases and checks
1. Write `tests/RD-01/unit.test.ts` with unchanged REF01–REF04 thresholds; run against the absent implementation and retain RED raw logs/test bytes.
2. Fetch the seven exact original URLs with a 15 s request timeout and 256 KiB decoded-body cap. Follow no redirects/challenges/authentication. Inspect only publicly readable links, if any. Bind status, content type, date, URL and access class; no HTTP result implies playback.
3. Audit original input bytes and pinned Git concept blobs. Missing targets and LFS pointers remain unavailable. Author `reference-cards/RR-01.json`–`RR-07.json`, `concepts.json`; implement `src/tools/reference-index/` and generate `index.json`.
4. Run GREEN and fresh final `npm run check`, focused REF tests/typecheck, `npm run build`, explicit RD-01 boundary guard with start/base, normal/reverse CLI byte comparison, fresh source/freeze checks and diff self-review. Commit only the four literal allowlisted directories. Publish a post-commit machine receipt with full commit/tree/parent/paths and artifact/log digests in the own runroot.

## Risks and safe stop
Unavailable post/media or concept payload blocks only the corresponding media/Art claims, not this catalog. A frozen-byte mismatch, outside tracked write, unexpected link/reparse escape, material contract change or unsafe source access stops dependent work. The two exact automatic untracked regular throughput logs are untouched; original all-files gate remains `FAIL_ACCEPTED_NARROW_EXCEPTION`, not clean PASS. Browser `NOT_APPLICABLE`; GPU/Art/product/performance `NOT_RUN` / `NOT_AUTHORIZED`.

## Progress
- Discovery/freeze preflight complete; no tracked writes before the byte check.
- REF01–REF04 written first and genuinely RED (four failures), then GREEN with identical test bytes.
- Seven original HTTP requests and pinned-byte audit complete; post/media/image gaps remain explicit.
- Cards, concept inventory and pure catalog/CLI implemented. Fresh lab check, four focused tests, focused TS-test check, build, source/freeze audit and normal/reverse CLI byte comparison passed.
- RD-01 guard passed with the narrow automatic-log exception, not a clean all-files PASS. Own final diff review/scoped commit/post-commit receipt close the task; HEAD acceptance remains separate.

## Done
Seven exact original references and honest concept availability; REF01–REF04 RED then GREEN; repeatable byte-identical index; unchanged pinned inputs/frozen/RD-02 files; scoped commit and evidence-bound terminal handoff. No acceptance outside RD-01 catalog functionality.
