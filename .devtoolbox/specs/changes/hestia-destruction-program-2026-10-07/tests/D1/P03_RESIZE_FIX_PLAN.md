# P03 actual drawing-buffer resize

Normal native RED on frozen product-r27: HVP-14 resized CSS to1280x720 while canvas.width/height remained1920x1080; actual process exit1, original5s assertion. HVP-01 real C01/Fly→Reset/C04/Orbit/input-stop/native-parity passed.

Small scope: ThreeRenderBackend exposes its existing renderer.setSize through a bounded available-state viewport method and remembers the current width/height for renderer reset. HVP bootstrap registers one resize callback with its existing owned listener collection; dispose removes it. Existing HVP camera continues to own camera projection. No graphics-settings profile, render-scale/DPR/quality/default changes, renderer exposure or dependency.

Unit: actual fake renderer calls, invalid/unavailable/disposed inputs have no renderer mutation, reset preserves latest viewport, ownership diagnostics unchanged. Whole lifecycle/revision/backend suites and relevant Bootstrap lifecycle checks; TSC. New product/source/build/HTTP freeze then unchanged normalUI resize/native/resource parity and realEnd/restart proof. SelectedP03 remains incomplete forLateReply/fullpose and fullphase/formalseries.
