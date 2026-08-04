# Hestia Coast/Lush design QA

## Evidence

- Runtime: `C:\tmp\hestia-coast-lush-evidence\20260731-coast-verify-01\coast-route-1672x941.png` (`1672x941`).
- Primary references: protected R09-R13 originals under `docs/Konzeptart/Hestia/`, each `1672x941`.
- Comparison: same-size capture; presentation-only review. World, collision, authority and physics facts were not altered.

## Findings

- P0 — Water topology remains worldgen-owned and insufficient in the current capture. Cyan occupies about `0.4%` of the full frame and `0.2%` of the lower 55%; R09-R13 span about `1.0-5.4%` full-frame and `0.6-4.2%` lower-frame cyan. The renderer now preserves the exact Shore/WetDepression facts, uses two instanced batches, and adds a pale Shore rim, but it must not enlarge or invent water coverage.
- P1 — Resolved in the fresh live capture: Coast terrain now reads as 0.5 m stepped/flat-shaded micro-block terrain with broad warm rock exposure rather than the previous smooth green slope.
- P1 — Resolved in the fresh live capture: tall tiered block trees, block understory and four large white cloud clusters establish multiple silhouette and depth scales. They remain constrained to two water plus two decorative vegetation instanced batches and one fixed sky draw.
- P2 — The exact concept-art density and landmark composition still depend on Coast/Lush world facts; presentation must not synthesize those facts.

## Verification status

- Fresh live route: READY at the `1672x941` CSS viewport; suit-control overlay was dismissed before the final visual check.
- Node 22: three focused presentation/environment test files, `16/16` tests passed.
- Node 22: TypeScript `--noEmit` passed; Vite production build passed (`268` modules).
- `git diff --check` and `git diff --cached --check` passed.

final result: blocked

Blocker: the connected visible Coast water/shore topology requires worldgen facts. The fresh view contains no visible lagoon/shore, and presentation must not enlarge or invent authoritative Water facts.
