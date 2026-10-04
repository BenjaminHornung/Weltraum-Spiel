# RD13 Phase1 CPU handoff

Actual factory, dense GLSL3 DDA, same-input greedy control and usable standalone
entry are implemented. `productIntegrated=false`. Native graphics are **NOT RUN**.

Start with [PHASE1.md](./PHASE1.md), [RAY-RULES.md](./RAY-RULES.md) and
[EXECPLAN.md](./EXECPLAN.md). The implementation is
`src/experiments/voxel-rays/index.ts`; its entry is the adjacent `index.html`.
Focused CPU tests use `vitest.config.ts`; standalone entry compilation uses
`vite.config.ts`. `tsconfig.json` also checks the authored native harness.

Raw, write-once command receipts, RED seals, GREEN results, build products and
the final actual commit/tree/parent/file bindings are retained at:

`C:/IFI_SourceCode/Temp/Hestia-RD-2026-10-02-runs/RD-13/phase1-d17d9704-20261004-a/`

In particular, inspect `postcommit-audit.json` and
`commands/scope-postcommit.json`/`.stdout`. Those external records avoid an
impossible self-referential commit hash. Automatic throughput logs are neither
copied nor committed.

HEAD still owns registration, gallery/home, Vite/package/shared contracts and
the next freeze. Native tests in `tests/RD-13/native.spec.ts` are authored and
typechecked, not executed. Only explicit new wiring/freeze/native authorization
permits Phase2. No art, image parity, full-F01 parity or performance result is
claimed; no product promotion is requested.
