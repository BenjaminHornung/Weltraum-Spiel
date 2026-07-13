# Test Protocol: WebGL Observability Tooling Audit

Date: 2026-07-13
Status: Research complete; DevToolbox completion preflight blocked

## Scope

Research and documentation only. The permitted repository outputs are the five
Markdown files in this change plus
`docs/research/webgl-observability-tooling-audit-v1.md`.

## Baseline

- Fetched with `git fetch --all --prune`.
- Base ref: `origin/main`.
- Base SHA: `c780656c29ff4e5794be9ba58d6b78396a5826d5`.
- Base commit date: `2026-07-13T16:16:52+02:00`.
- Branch: `research/webgl-observability-tooling-audit-v1`.
- Worktree: `.worktrees/Weltraum-Research-webgl-observability-tooling-audit-v1`.
- Initial checkout required `GIT_LFS_SKIP_SMUDGE=1` because an unrelated
  historical PNG object returns HTTP 404 from the LFS server.

## DevToolbox status

`workspace_prepare_for_agent`, `workspace_discover`, `specs_get_status`,
`specs_validate`, `tasks_load`, and `tasks_completion_preflight` were attempted.
The MCP server returned `unauthorized_path` for the temporary worktree, the
nested repository worktree, and the repository root. No execution was created,
no `tasks_toggle` call was made, and no task checkbox or completion preflight is
bypassed while this root-allowlist blocker remains.

## Collected execution evidence

- External projects were cloned only under `C:\tmp\webgl-observability-audit`;
  no external source, asset, binary, capture, lockfile, or dependency was copied
  into Weltraum-Spiel.
- Spector.js: build/test NOT RUN after script/hook inspection; public demo and
  local Chromium capture PASS with observer-effect warnings. Local capture:
  421 commands, 112 draws, 7 programs, 0 capture-referenced textures, 200
  capture-referenced buffers, 0 nonzero `getError` commands, but 189
  instrumentation-generated WebGL warnings.
- Chrome DevTools MCP: install/prepare/build and targeted CLI/telemetry/trace
  tests PASS; full and browser integration suites NOT RUN; demo/browser NOT RUN.
- stats-gl: build/test NOT RUN; public Three.js and worker demos PASS in
  Chromium, including visible worker stress start/stop.
- MemLab MCP: build/test/server/demo/browser NOT RUN; source and package scripts
  inspected, with the MCP package declaring no tests yet.
- Comlink: build exited 0 with dependency/type drift warnings; type and Node
  tests FAIL in the audit environment; browser tests/demo NOT RUN.
- Current `origin/main` browser app from a temporary archive: `npm ci
  --ignore-scripts`, build, and 473 unit tests PASS. Real Chromium page, GLB
  network request, console, WebGL2 context, and temporary screenshot checked.
- All screenshots, console logs, bundles, and capture summaries remain under
  `C:\tmp`; the Playwright browser session was closed.

## Repository verification

- `git diff --cached --check`: PASS.
- Complete staged diff review: PASS.
- Staged allowlist: PASS, exactly the five Markdown artifacts in this change
  plus `docs/research/webgl-observability-tooling-audit-v1.md`.
- Forbidden-path count: 0.
- Commit, push, and final clean-branch status are verified after this protocol is
  committed and reported in the handoff.
