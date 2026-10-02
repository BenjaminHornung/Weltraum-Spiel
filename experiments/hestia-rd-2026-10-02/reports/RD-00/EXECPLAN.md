# ExecPlan: RD-00 contract freeze

## Goal and context
Implement the exact RD-00 card at start `807e8b4cc4528bd9d02122109e08e2e869305047`.
Read-only product base: `b3c6523a94cd050f5a9a22dc27f4777fcc03363e`.
The pinned coordination EXECPLAN, RUN and input-package remain byte-identical.

## Non-goals and architecture
No product edits, delegation, GPU benchmark, physics, renderer host, ECS or plugins.
Use JSON metadata, private imported payload buffers, explicit scenario time and a
small lifecycle wrapper. RD-03 owns the actual Three renderer/effect seam.
Write only new files from the RD-00 allowlist; external artifacts use the assigned
RD-00 run root. Preserve host-generated `.opencode/throughput.jsonl` and
`.opencode/throughput.md`; report these two paths separately, never blanket-ignore
other foreign files. DevToolbox tracking is not authorized; local checks replace it.
HEAD relayed the user's explicit narrow automatic-log exception: only UNTRACKED
regular contained files at those exact names are allowed. Staged/committed logs,
third files and junction/symlink names fail; the original strict all-files gate is
reported separately and is not claimed clean. Collectors are not claimed stopped.

## Phases and verification
1. Establish exact bases, tools, input hashes and free loopback port 5280.
2. Write BC00/BC01/C00/C01 negative tests; execute against unsafe baseline stubs
   and retain their actual failing assertions (RED).
3. Implement fixture/frame/scenario/result validation, private payload ownership,
   lifecycle, static registration, control page and boundary checker (GREEN).
4. Run lab check, unit, build, boundary and task-owned Chromium diagnostic smoke
   serially. Retain command lines, exit codes, logs, screenshot and cleanup proof.
5. Self-review the diff, scope authored whitespace checks separately from original
   Markdown hardbreaks, commit the narrow candidate and produce terminal handoff.

## Risks and safe stop
Stop for a material contract/ownership conflict or unsafe target. Retain artifacts;
never reset, delete or clean foreign work. Unsupported measurements have no value.
Browser smoke is functional diagnosis, not performance or art acceptance.

## Definition of Done
Exact card implemented, fresh gates pass (or exact unavailable evidence stated),
full candidate SHA/tree, frozen exports/start command and all changed paths recorded.
ProductIntegrated=false; shared-file ownership transfers to HEAD only at handoff.

## Progress
- Discovery: exact start/base/tree and required tool versions confirmed.
- RED: four real BC00/BC01/C00/C01 assertion failures retained; initial GREEN 10/10.
- HEAD steering: semantic SHA separation, bound profile/color payloads, owner/support
  namespaces and exact snapshot revisions implemented; expanded GREEN 13/13.
- Verification milestones are recorded in HANDOFF.md and the external command ledger.
