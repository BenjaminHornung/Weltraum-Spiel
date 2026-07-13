# Behavioral Spec: Browser Demo Scout Nozzle VFX Binding v2

## Required behavior

1. The Demo Scout visual descriptor contains exactly twenty unique authored RCS
   nozzle entries with finite positions and normalized opposite force/exhaust
   directions.
   The procedural fallback instead contains exactly six position-only legacy
   marker bindings and makes no direction, score, compatibility, or allocation
   claim.
2. A complete GLB resolves every nozzle to one unique expected node. A missing,
   duplicate, ambiguous, reused, or invalid node falls back only that logical
   nozzle and reports why.
3. Owner actuator telemetry publishes separate applied main and applied RCS
   translation vectors whose sum equals the existing combined acceleration.
   Flight integration and resulting ship state do not change.
4. Main flame scale uses separated main acceleration. RCS puffs use separated
   RCS translation plus already-body-local angular acceleration.
5. Translation uses owner orientation for world-to-body conversion. Render
   interpolation never becomes VFX selection truth.
6. For the authored GLB registry, pure translation selects only
   force-compatible nozzles. Roll, yaw, pitch, and SAS select only positive
   torque-compatible nozzles. Simultaneous modes use the union; main thrust does
   not contaminate the RCS set. Zero-floor compatibility applies only to these
   directional bindings and their per-node manifest fallbacks.
7. For the procedural fallback, nonzero separated applied RCS translation or
   nonzero body-local angular acceleration makes all six legacy markers visible
   as an aggregate presentation-only activity indicator. Idle or net-cancelled
   telemetry selects zero legacy puffs. Raw flags never create visibility.
8. TestBridge snapshots use a discriminated directional-nozzle versus
   legacy-marker union. Directions, diagnostics, compatibility, and scores are
   exposed only for directional bindings; source and final visibility remain
   explicit for both kinds while normal `/` remains gated.
9. `Demo Scout GLB`, `ProceduralFallback`, current VFX styling, plan hashes,
   executor locking, terminal physics, and render-smoothing truth stay intact.

## Acceptance

- Focused unit tests cover separated telemetry, complete XYZ sums, frame
  conversion, exact positive/negative roll/yaw/pitch sets, cancellation,
  6-to-20-to-6 pool disposal, idle, and binding fallbacks including non-finite
  positions.
- Browser E2E proves `GLBLoaded`, twenty unique authored bindings, compatible
  visible puffs at authored positions/directions, and existing TestBridge gates.
- Full unit, build, focused browser regressions, and exact-head CI are green.
