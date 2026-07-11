# Capability: Browser mainline CI diagnosis and hardening

## Requirements

### Proven failure repair

- The previously failing browser vertical-slice test MUST verify the low-poly render batch against the intended proving-ground registry.
- The repair MUST NOT change production world, render, flight, planner, executor, objective, HUD, or UI behavior.

### Mandatory Playwright coverage

- Every tracked browser E2E spec on the branch MUST execute in Browser Mainline CI.
- CI MUST fail before grouped execution when any tracked E2E spec is missing from the groups, listed more than once, or referenced after removal.
- Core/autopilot, live runtime/objectives, and UI/layout checks MUST remain required and fail the job on errors.
- Normal-runtime tests MUST NOT expose or use TestBridge.
- CI MUST reject focused-only Playwright tests.

### Actionable diagnostics

- CI MUST expose separate named E2E groups.
- Each group MUST preserve isolated Playwright trace, failure screenshot, and HTML report output.
- Artifact upload MUST run after failures.
- CI MUST print Node, npm, Playwright, and resolved Demo Scout GLB diagnostics.
- Generated top-level evidence JSON MUST be parsed in a named required step.

### Scope safety

- Demo Scout GLB binary validation MUST remain mandatory.
- No check may use `continue-on-error`.
- No `Assets/**` file may change.
- Parallel UI/HUD and world-streaming production scopes MUST remain untouched.

## Scenarios

### Stale render count

Given six base asteroids and eight intentional large-field visual landmarks, when the debug scene publishes its low-poly instance batch, then the batch count equals the authoritative proving-ground field length and the E2E assertion passes.

### Group failure

Given any required spec fails in a named E2E group, when the workflow finishes, then the job is red and that group's failure output, trace/screenshot when produced, and HTML report are available in the uploaded artifact.

### Complete grouped coverage

Given the twelve tracked E2E specs on the baseline branch, when all three CI groups run, then each spec is included exactly once and none is skipped.

### Normal runtime isolation

Given a normal `/` browser runtime test, when it runs in CI, then TestBridge remains unavailable and the test succeeds only through public runtime/UI behavior.

### GLB validation failure

Given the Demo Scout asset is missing, remains an LFS pointer after restoration, or lacks `glTF` magic, when CI validates it, then the workflow fails before tests rather than substituting a fake asset.
