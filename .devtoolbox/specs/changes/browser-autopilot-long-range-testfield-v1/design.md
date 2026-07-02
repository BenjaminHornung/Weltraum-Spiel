# Design Notes

## Additive course catalog
Extend the proving-ground catalog by adding new long-range entries instead of replacing the existing set. Preserve the current 11-course baseline and grow the matrix toward 20-25 total cases.

## Metrics extraction / runner split
Keep the scenario runner as the execution surface and expand its metrics extraction instead of rewriting it. The runner should expose the evidence needed for distance, profile, classification, planHash stability, and terminal-speed checks.

## Planner-limit visibility
Make planner limits visible through course metadata and reported metrics so `KnownStress` and `ExpectedFail` cannot be mistaken for a clean pass.

## Explicit non-goal
Do not attempt a multi-obstacle planner rewrite. This change is for catalog growth, measurement, and reporting only.
