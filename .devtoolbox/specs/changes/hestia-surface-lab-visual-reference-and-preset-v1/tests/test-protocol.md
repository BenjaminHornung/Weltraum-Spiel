# Test Protocol

## Checkpoint 1

1. Confirm branch is `docs/hestia-surface-lab-visual-preset-v1` and base commit is `5ff47aeef3c42c0b933e8480dafa5680759a40df`.
2. Verify each available source is a real PNG, not an LFS pointer; record dimensions and absence of requested image 41.
3. Check every image audit contains all mandated fields and an evidence classification.
4. Check the primary-image comparison matrix contains all mandated columns.
5. Check all twelve conflict questions receive explicit, non-masking answers.
6. Run DevToolbox validation/verification and completion preflight when authorized.
7. Run one bundled Git scope check: `git status --short`, `git diff --check`, `git diff --stat`, `git diff --name-only`, plus staged-name and LFS checks before commit.
8. Fail if any path outside the approved allowlist changes or if any image/binary/LFS pointer is staged.

## Checkpoint 2

1. Parse `docs/concept-art/hestia-surface-lab-visual-preset-v1.json` with a standards-compliant JSON parser.
2. Verify stable required top-level fields and `runtimeAuthority: false`.
3. Verify all JSON `sourceImages` exist; missing sources may appear only in audit/missing-source metadata, not as usable source paths.
4. Validate relative Markdown links and cross-document target values.
5. Verify every palette entry has Hex, purpose, maximum dominance, provenance, and Direct Evidence or Provisional status.
6. Verify every numerical target is guidance and explicitly not performance-proven.
7. Verify the Markdown preset and compact handoff have no conflicting terrain, fog, water, vegetation, camera, or acceptance values.
8. Run dual review, address concrete findings, then run fresh test-runner and DevToolbox verification.
9. Repeat the bundled Git scope/staging check and fail on any forbidden path, image, binary, LFS pointer, source, test, runtime, evidence, package, roadmap, or asset modification.

## Expected evidence

Command summaries, DevToolbox execution/verification IDs, reviewed file list, review findings and resolutions, and both commit SHAs. No runtime screenshot or product build is required for this docs-only change.
