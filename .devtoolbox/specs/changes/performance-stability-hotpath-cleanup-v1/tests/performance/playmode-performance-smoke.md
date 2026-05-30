# PlayMode Performance Smoke

- Runtime: 30.03s across 4762 frames (158.6 fps observed in editor PlayMode).
- Visual switches: 6 (Generated -> Scout -> Cargo -> Generated loop).
- Camera mode cycles: 10; visual bounds refreshes 5 -> 11.
- Autopilot manual replan count: 1; final disengaged count: 1.
- RCS nozzle refreshes: 15 -> 30; max force applications/frame: 0; allocator status: idle.
- Profiler GC recorder: active; max recorded GC allocated in frame: 1530979 bytes.
- Profiler main-thread recorder: active; max sample: 42960700 ns.
- Screenshot: captured at E:\Unity\Weltraum Spiel\Weltraum Spiel\.devtoolbox\specs\changes\performance-stability-hotpath-cleanup-v1\tests\screenshots\playmode-performance-final.png.

Docs checked: E:/Unity/Documentation/en/ScriptReference/Unity.Profiling.ProfilerRecorder.StartNew.html and E:/Unity/Documentation/en/ScriptReference/Rigidbody.AddForceAtPosition.html.
