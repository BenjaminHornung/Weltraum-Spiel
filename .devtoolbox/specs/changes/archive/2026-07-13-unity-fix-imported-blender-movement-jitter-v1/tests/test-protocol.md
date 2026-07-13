# Imported Blender Movement Jitter Evidence

- Scene: Assets/Scenes/PrototypeBootstrapHost.unity
- Unity: 6000.4.7f1
- Driver: PlayMode scene, PlayerShipController test hook, scripted physics stepping, SimpleFollowCamera LateUpdate.
- Goal: classify physics vs imported visual vs camera/focus vs assist-conflict jitter after the camera smoothing fix.

## post-chase-scout-w-sas-on-docking-on
- Classification: NoSignificantJitterMeasured
- Ship delta variance: 0.00171
- Visual-root minus ship-delta max: 0
- Camera minus focus-delta max: 0.000017
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
- Max camera anchor error: 0.001617 (expected smoothing lag, not classified as jitter by itself)

## post-orbit-scout-w
- Classification: NoSignificantJitterMeasured
- Ship delta variance: 0.001712
- Visual-root minus ship-delta max: 0
- Camera minus focus-delta max: 0.000116
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
- Max camera anchor error: 0.016918 (expected smoothing lag, not classified as jitter by itself)

## post-chase-generated-w
- Classification: NoSignificantJitterMeasured
- Ship delta variance: 0.001714
- Visual-root minus ship-delta max: 0
- Camera minus focus-delta max: 0.000016
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
- Max camera anchor error: 0.001618 (expected smoothing lag, not classified as jitter by itself)

## post-chase-scout-w-sas-off
- Classification: NoSignificantJitterMeasured
- Ship delta variance: 0.001715
- Visual-root minus ship-delta max: 0
- Camera minus focus-delta max: 0.000016
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
- Max camera anchor error: 0.001619 (expected smoothing lag, not classified as jitter by itself)

## post-chase-scout-w-docking-off
- Classification: NoSignificantJitterMeasured
- Ship delta variance: 0.001717
- Visual-root minus ship-delta max: 0
- Camera minus focus-delta max: 0.000016
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
- Max camera anchor error: 0.00162 (expected smoothing lag, not classified as jitter by itself)

## post-chase-scout-a-left
- Classification: NoSignificantJitterMeasured
- Ship delta variance: 0.001719
- Visual-root minus ship-delta max: 0
- Camera minus focus-delta max: 0.000015
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
- Max camera anchor error: 0.001621 (expected smoothing lag, not classified as jitter by itself)

## post-chase-scout-h-up
- Classification: NoSignificantJitterMeasured
- Ship delta variance: 0.00172
- Visual-root minus ship-delta max: 0
- Camera minus focus-delta max: 0.000016
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
- Max camera anchor error: 0.001621 (expected smoothing lag, not classified as jitter by itself)

## post-chase-cargo-w
- Classification: NoSignificantJitterMeasured
- Ship delta variance: 0.001722
- Visual-root minus ship-delta max: 0
- Camera minus focus-delta max: 0.000016
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
- Max camera anchor error: 0.001622 (expected smoothing lag, not classified as jitter by itself)

## Classification
- Primary post-fix classification: NoSignificantJitterMeasured
- Chase camera-minus-focus max: 0.000017
- Orbit camera-minus-focus max: 0.000116
- Generated camera-minus-focus max: 0.000016
- SAS-off camera-minus-focus max: 0.000016
- Docking-off camera-minus-focus max: 0.000016
- Left force dot min: 1
- Up force dot min: 1
- Cargo classification: NoSignificantJitterMeasured

