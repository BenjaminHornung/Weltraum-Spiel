# Hestia Core Engine review checkpoint — 2026-10-22

This branch captures the current Core Engine work for external source review. It is an incomplete checkpoint, with the original 30 packages, 18 gates, R0–R5 and three phases retained. Weltraum-Spiel gameplay prototypes from the separate FP06 candidate are outside this snapshot.

The baseline is commit 6ac0f61947c5a6aa3e5b156831542d8188c75c0a. The review tree contains all 16 modified tracked files, the five new world-generation/frame-test files, the asset compiler, WXG source context, and labelled isolated source candidates under source-candidates/. Those candidates are review copies; their presence does not adopt them into the product.

Root preparation is corrected and independently source-reviewed. Its actual read-only preload passed against the same A0 and baseline HEAD. The controller and payload are hash-bound, old approvals are rejected, and all restored owner/evidence/protection checks are covered by pure fake cases. R03 remains spent; this branch gives no execution authority.

Current WXG CPU evidence retains 17/17 accepted cases. No new Node/AST, build, browser, M5, Native24, physics, GPU or save run was performed for this checkpoint. Real 90-second admission performance, reference measurements and product adoption remain open. See HESTIA_GESAMTSTAND.md and the root-controller acceptance/read-only reports.

Export boundaries:
- Installed tool/dependency trees, raw grants, process records, stdout/stderr, historical dumps, review patches and generated binary outputs are excluded.
- WXG keeps source, fixtures, scripts, package/config and input-binding manifests. Generated dist and binary fixtures need regeneration; the historical complete input reproduction still has its documented missing lockfile. Absolute provenance paths in InputBindings.json are retained; full historical membership checks are not reproducible from this source-only export.
- Isolated candidates retain source and selected manifests/reports. Their original execution guards and target-machine paths are preserved. They are not a standalone execution environment.
- REVIEW_FILE_MANIFEST.json lists the explicit exports with byte counts and SHA-256. The normal tracked baseline and its 16-file diff are additional to that list.

Review starts with the normal src changes and their five newly added dependencies, then root-ast-controller/, then the relevant source-candidates package. No runtime gate is closed by this publication.
