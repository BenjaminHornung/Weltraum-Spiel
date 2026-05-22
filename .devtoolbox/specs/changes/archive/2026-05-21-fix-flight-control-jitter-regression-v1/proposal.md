# Proposal

## Change
`fix-flight-control-jitter-regression-v1`

## Problem
Recent imported-ship and control binding work needed a focused flight-control regression evidence pass to prove translation, attitude, SAS, main thrust, camera, and F6 visual switching remained physically stable in PlayMode.

## Goal
Keep the collected PlayMode movement diagnostics, screenshots, logs, and CSV evidence in a validated DevToolbox change folder so workspace validation and archive preflight can reason about it.

## Scope
- Evidence for imported ship translation controls.
- Evidence for attitude controls, SAS behavior, main thrust, and F6 visual switching.
- Documentation-only metadata for the already-recorded test artifacts.

## Non-Goals
- No new gameplay implementation in this maintenance repair.
- No retuning of flight, thrust, camera, or visual switching behavior.
