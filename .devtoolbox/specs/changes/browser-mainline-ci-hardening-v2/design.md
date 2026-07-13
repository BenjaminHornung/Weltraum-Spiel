# Design

## Single source of group membership

`apps/weltraum-browser/package.json` owns three explicit Playwright commands. The workflow strictly tokenizes each complete script, requires the exact `playwright test` prefix, and permits only normalized discovered spec paths after that prefix. Flags, shell syntax, commands, comments, quoted extras, and other non-spec tokens fail closed. The parsed paths are compared with recursive filesystem discovery under `tests/e2e`; the workflow does not maintain a second spec list.

The validator reports discovered and assigned counts plus each group list. It fails on unassigned files, duplicate assignments, stale script entries, missing/invalid group scripts, or a changed aggregate command. Dependency-free self-checks prove one valid representative and reject both a shell-suffix mutation and a `--grep` mutation containing misleading `.spec.ts` text.

## Required independent execution

The browser workflow remains one job with one CI worker and a finite 45-minute timeout. Each E2E group has the same prerequisite-success and `!cancelled()` condition. A failed group therefore does not skip later diagnostic groups, and the failed step still makes the job fail because `continue-on-error` is not used.

## Artifact isolation

CI supplies a safe group identifier to Playwright. The configuration rejects values outside lowercase alphanumeric segments separated by single hyphens. Valid values suffix both automatic output and HTML report folders. An unset variable preserves the existing aggregate paths.

The long live-flight spec keeps local trace and automatic screenshots disabled, but retains them on CI failures. Explicit product evidence screenshots in the test remain unchanged.

## Current setup and evidence gates

Checkout keeps `lfs: false` and restores only the Demo Scout GLB plus four required reference PNGs if any is an LFS pointer. After dependency/browser installation, CI reports Node, npm, Playwright, and GLB type/size. After E2E, every top-level evidence JSON file is parsed. Artifact upload retains existing paths and adds Markdown plus explicit group folders.
