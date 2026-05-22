# Proposal

## Problem

The previous flight-control fix removed the wild-spin failure for imported functional ships, but movement with the Blender/imported visual can still appear jittery. The next fix must not rework torque, inertia, or recoil unless evidence proves the physics path is unstable.

## Goal

Classify movement jitter in the live PrototypeBootstrapHost path as physics jitter, imported visual hierarchy jitter, camera/focus jitter, or assist-request conflict, then apply the smallest safe fix so ImportedDemoScout is visually smooth in ChaseLocked while translating.

## Scope

- Capture per-frame and per-fixed-step evidence for ship, Rigidbody, imported visual root, functional socket rig, camera, focus, bounds, RCS, SAS/translation assist, and docking assist state.
- Stabilize ChaseLocked camera movement and focus if evidence shows the Rigidbody is smooth but camera/focus moves discontinuously.
- Add translation assist diagnostics and a grace/smoothing guard if evidence shows auto-stop or SAS is counteracting held translation.
- Verify ImportedDemoScout, GeneratedPrimitives, SAS on/off, DockingAssist on/off, and a short ImportedDemoCargo comparison.

## Non-Goals

- No new RCS torque-authority or weapon-recoil redesign.
- No DOTS/ECS migration.
- No hiding physics jitter with camera smoothing if Rigidbody force/velocity evidence is unstable.
- No per-frame hierarchy scans in gameplay hot paths; evidence-only diagnostics may sample hierarchy in tests.
