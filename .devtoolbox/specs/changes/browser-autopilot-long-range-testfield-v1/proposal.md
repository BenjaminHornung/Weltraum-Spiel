# Browser Autopilot Long-Range Testfield V1

## Motivation
DevToolbox MCP returned `unauthorized_path` for this worktree path, so this change starts with direct fallback tracking artifacts only. The goal is to prepare a long-range browser autopilot testfield that can expose planner limits, stability issues, and stress/fail classifications without touching product code yet.

## Scope
- Bootstrap the spec/change artifacts for the long-range testfield.
- Define the desired course matrix, metrics expectations, and evidence model.
- Keep all work additive and isolated to `.devtoolbox/specs/changes/browser-autopilot-long-range-testfield-v1/**`.

## Non-goals
- No product/source/test code changes yet.
- No Unity runs.
- No build/test execution.
- No planner rewrite or multi-obstacle algorithm redesign.

## Success
- The change folder contains proposal, spec, design, tasks, and manual execution tracking.
- The behavioral target is explicit enough for later implementation work.
- The spec clearly separates pass/fail/stress expectations and prevents hidden success claims.
