# Test Protocol

## Change

`research-browser-voxel-runtime-reference-audit-v1`

## Scope

Research-only audit of Voxelize, Divine Voxel Engine, AresRPG Engine/World and
Veloren for transferable browser-voxel architecture concepts.

## Verification Results

| Check | Status | Evidence |
| --- | --- | --- |
| External provenance and license paths | PASS | All five named project entries record URL, SHA, date, branch/tag, license/path, inspected paths and statuses in the research document. Divine's two required Gitlink repositories are recorded separately. |
| Mandatory source-path coverage | PASS | Classified source-evidence sections cover Voxelize, Divine, AresRPG Engine/World and the focused Veloren scope. Required-term scan returned `MISSING_REQUIRED_TERMS=`. |
| Browser demo checks | PASS WITH CAVEATS | Real headed Chromium checks for Voxelize and Divine record visible behavior, Console and Network separately. Screenshots exist only below `C:\tmp\external-browser-voxel-runtime-reference-audit-v1-20260713\browser-evidence`. AresRPG and Veloren have explicit `NOT RUN`/`NOT APPLICABLE` reasons. |
| DevToolbox `workspace_prepare_for_agent` | BLOCKED | Isolated worktree rejected by configured path guard as `unauthorized_path`; no override used. |
| DevToolbox `workspace_discover` | BLOCKED | Same `unauthorized_path` result for the isolated worktree; no dirty main checkout was used. |
| DevToolbox `specs_get_status` | BLOCKED | Both in-repository and `C:\tmp` locations rejected as `unauthorized_path`. |
| DevToolbox `specs_validate` | BLOCKED | Final change rejected as `unauthorized_path`; no override used. |
| DevToolbox `tasks_load` | BLOCKED | Final `tasks.md` path rejected as `unauthorized_path`. |
| DevToolbox `execution_create` | BLOCKED | Isolated worktree rejected as `unauthorized_path`; therefore no execution ID exists for `execution_add_notes`. |
| DevToolbox `tasks_completion_preflight` | BLOCKED | First completion preflight rejected as `unauthorized_path`. |
| DevToolbox `tasks_toggle` | NOT RUN | Blocking completion preflight was not bypassed; checkboxes remain open. |
| `git diff --check` | PASS | `git diff --cached --check` exited 0 after three detected EOF blank lines were removed. |
| Allowlist review | PASS | Cached diff contains exactly the five files in this change plus `docs/research/browser-voxel-runtime-reference-audit-v1.md`; extra 0, missing 0. |
| Runtime build/tests | NOT APPLICABLE | Research-only documentation; no Weltraum-Spiel runtime, package, asset or test change. |

## Build And Test Policy

No Weltraum-Spiel runtime code changes are in scope, so solution and Unity tests
are not applicable. External builds/tests are only considered after package
scripts, install hooks and Cargo `build.rs` files have been inspected; every
non-executed external suite receives an explicit reason in the research
document.

External status is recorded per project. No external build or test was run:

- Voxelize: Root/package scripts, lifecycle hooks and `build.rs` inspected;
  `preinstall` enforces pnpm, `prepare` invokes Husky and `build.rs`
  requires `protoc`.
- Divine: Root/subpackage scripts inspected; no pre/postinstall, Cargo or
  `build.rs`; build/publish paths write or remove `dist`.
- AresRPG: package scripts inspected; missing dependencies/build output and no
  useful automated Engine suite.
- Veloren: relevant `build.rs` files inspected; large Rust workspace left
  unbuilt.

## Preflight Policy

No task checkbox is manually completed while
`tasks_completion_preflight` is blocked. Content completion and Git
verification are still recorded here and in the final commit; this does not
claim a successful DevToolbox completion state.
