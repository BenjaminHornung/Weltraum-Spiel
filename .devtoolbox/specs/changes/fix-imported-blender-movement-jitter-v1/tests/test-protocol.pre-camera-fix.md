# Imported Blender Movement Jitter Evidence

- Scene: Assets/InitTestScene8509392e-e363-491b-9ac0-c6523349607c.unity
- Unity: 6000.4.7f1
- Driver: PlayMode scene, PlayerShipController test hook, scripted physics stepping, SimpleFollowCamera LateUpdate.
- Goal: classify physics vs imported visual vs camera/focus vs assist-conflict jitter before applying behavioral changes.

## pre-chase-scout-w-sas-on-docking-on
- Classification: NoSignificantJitterMeasured
- Ship delta variance: 0.00171
- Visual-root minus ship-delta max: 0
- Camera minus focus-delta max: 0.000001
- Focus delta max: 0.143266
- Force direction min dot: 1
- Velocity direction min dot: 1
- Force flip count: 0
- AutoStop active frames: 0
- External assist conflict frames: 0
- Visual local errors pos/rot/scale: 0 / 0 / 0
- Functional rig local errors pos/rot/scale: 0 / 0 / 0
- Bounds/nozzle refresh deltas: 0 / 0
- Max angular velocity: 0
- Max camera anchor error: 0

## pre-orbit-scout-w
- Classification: CameraFocusJitter
- Ship delta variance: 0.001712
- Visual-root minus ship-delta max: 0
- Camera minus focus-delta max: 0.011283
- Focus delta max: 0.143333
- Force direction min dot: 1
- Velocity direction min dot: 1
- Force flip count: 0
- AutoStop active frames: 0
- External assist conflict frames: 0
- Visual local errors pos/rot/scale: 0 / 0 / 0
- Functional rig local errors pos/rot/scale: 0 / 0 / 0
- Bounds/nozzle refresh deltas: 0 / 0
- Max angular velocity: 0
- Max camera anchor error: 1.558947

## pre-chase-generated-w
- Classification: NoSignificantJitterMeasured
- Ship delta variance: 0.001714
- Visual-root minus ship-delta max: 0
- Camera minus focus-delta max: 0.000002
- Focus delta max: 0.143402
- Force direction min dot: 1
- Velocity direction min dot: 1
- Force flip count: 0
- AutoStop active frames: 0
- External assist conflict frames: 0
- Visual local errors pos/rot/scale: 0 / 0 / 0
- Functional rig local errors pos/rot/scale: 0 / 0 / 0
- Bounds/nozzle refresh deltas: 0 / 1
- Max angular velocity: 0
- Max camera anchor error: 0

## pre-chase-scout-w-sas-off
- Classification: NoSignificantJitterMeasured
- Ship delta variance: 0.001715
- Visual-root minus ship-delta max: 0
- Camera minus focus-delta max: 0.000001
- Focus delta max: 0.143471
- Force direction min dot: 1
- Velocity direction min dot: 1
- Force flip count: 0
- AutoStop active frames: 0
- External assist conflict frames: 0
- Visual local errors pos/rot/scale: 0 / 0 / 0
- Functional rig local errors pos/rot/scale: 0 / 0 / 0
- Bounds/nozzle refresh deltas: 0 / 0
- Max angular velocity: 0
- Max camera anchor error: 0

## pre-chase-scout-w-docking-off
- Classification: NoSignificantJitterMeasured
- Ship delta variance: 0.001717
- Visual-root minus ship-delta max: 0
- Camera minus focus-delta max: 0.000002
- Focus delta max: 0.143539
- Force direction min dot: 1
- Velocity direction min dot: 1
- Force flip count: 0
- AutoStop active frames: 0
- External assist conflict frames: 0
- Visual local errors pos/rot/scale: 0 / 0 / 0
- Functional rig local errors pos/rot/scale: 0 / 0 / 0
- Bounds/nozzle refresh deltas: 0 / 0
- Max angular velocity: 0
- Max camera anchor error: 0

## pre-chase-scout-a-left
- Classification: NoSignificantJitterMeasured
- Ship delta variance: 0.001719
- Visual-root minus ship-delta max: 0
- Camera minus focus-delta max: 0.000002
- Focus delta max: 0.143608
- Force direction min dot: 1
- Velocity direction min dot: 1
- Force flip count: 0
- AutoStop active frames: 0
- External assist conflict frames: 0
- Visual local errors pos/rot/scale: 0 / 0 / 0
- Functional rig local errors pos/rot/scale: 0 / 0 / 0
- Bounds/nozzle refresh deltas: 0 / 0
- Max angular velocity: 0
- Max camera anchor error: 0

## pre-chase-scout-h-up
- Classification: NoSignificantJitterMeasured
- Ship delta variance: 0.00172
- Visual-root minus ship-delta max: 0
- Camera minus focus-delta max: 0.000002
- Focus delta max: 0.143677
- Force direction min dot: 1
- Velocity direction min dot: 1
- Force flip count: 0
- AutoStop active frames: 0
- External assist conflict frames: 0
- Visual local errors pos/rot/scale: 0 / 0 / 0
- Functional rig local errors pos/rot/scale: 0 / 0 / 0
- Bounds/nozzle refresh deltas: 0 / 0
- Max angular velocity: 0
- Max camera anchor error: 0

## pre-chase-cargo-w
- Classification: NoSignificantJitterMeasured
- Ship delta variance: 0.001722
- Visual-root minus ship-delta max: 0
- Camera minus focus-delta max: 0.000002
- Focus delta max: 0.143745
- Force direction min dot: 1
- Velocity direction min dot: 1
- Force flip count: 0
- AutoStop active frames: 0
- External assist conflict frames: 0
- Visual local errors pos/rot/scale: 0 / 0 / 0
- Functional rig local errors pos/rot/scale: 0 / 0 / 0
- Bounds/nozzle refresh deltas: 0 / 0
- Max angular velocity: 0
- Max camera anchor error: 0

## Classification
- Primary pre-fix classification: NoSignificantJitterMeasured
- Chase camera-minus-focus max: 0.000001
- Orbit camera-minus-focus max: 0.011283
- Generated camera-minus-focus max: 0.000002
- SAS-off camera-minus-focus max: 0.000001
- Docking-off camera-minus-focus max: 0.000002
- Left force dot min: 1
- Up force dot min: 1
- Cargo classification: NoSignificantJitterMeasured

