# Prompt: Spec Cleanup and Sorting Agent

Goal:
Produce a read-only classification of active DevToolbox changes and propose
archive/reconcile/split actions.

Context:
- Read AGENTS.md.
- Read `docs/legacy-unity/devtoolbox-audits/change-audit-2026-06-14.md`.
- Read `docs/legacy-unity/current-prototype-state-2026-06-15.md`.
- Read exact-arrival test protocol.
- Read planning consistency audit.
- Read 07_specs_sorting_backlog.md.

Constraints:
- Do not edit runtime code.
- Do not toggle tasks.
- Do not archive.
- Do not delete evidence.
- Do not assume stale docs are true if later test evidence contradicts them.

Output:
Create `docs/roadmap/spec-sorting-YYYY-MM-DD.md` with table columns:
- Change
- Group
- Current state
- Evidence
- Stale/conflict notes
- Recommended action
- Next safe task

Done when:
- All active changes are categorized.
- Contradictions are explicitly listed.
- Archive candidates require later preflight, not immediate archive.
