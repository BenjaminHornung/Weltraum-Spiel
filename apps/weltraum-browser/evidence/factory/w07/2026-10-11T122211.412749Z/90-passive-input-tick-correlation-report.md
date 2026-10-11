# W07 passive input/tick diagnostic90 — complete observation, normal gate remains FAIL

One authorized diagnostic completed4/4 cases, npmExit0, end18:25:42.147519UTC/41.400954s. This is not gameplay, performance or W07 gate PASS. Four cumulative observation JSON files and original command/raw receipts are preserved under browser-input-tick-passive-diagnostic-90:6 artifacts/1,007,553B. RawSHA c6feaf807346a8add1be3a690c744095246228735a2281b30ef7686d8d090369/1318B. All316 observation records are complete: zero record drops, id-map drops and observer errors. All reported S events were trusted and pointer-locked.

| Nominal hold | DOM capture Down→Up | Browser event.timeStamp gap | Main FactoryInput post gap | Native ΔZ | Native Δticks |
|---|---:|---:|---:|---:|---:|
|125ms|0.700ms|131.200ms|0.400ms|0m|81|
|250ms|179.400ms|251.200ms|176.900ms|-0.550002m|135|
|600ms|507.400ms|602.000ms|507.400ms|-1.550006m|197|

The600ms gesture also has actual ΔX+0.050020m and ΔY-0.298297m; these observations are not an axis-perfect motion guarantee. The125ms events have widely separated browser timestamp fields but are processed and posted nearly together on the main thread. Overlapping observed main longtasks last144–200ms. This establishes that batching in this diagnostic, without identifying its source stack or measuring whole main/worker CPU. Overlay overhead differs from the normal flow. No Native handler/admission/step-between-input time is invented: FactoryInput ACKs carry only id, not snapshot/clock/acceptance; ACK recording is main reception. No Advance IPC exists. Solver CPU and mainFrameCpu remain NOT_OBSERVED on plain/factory.html without measure opt-in.

Normal E2E030fc…/16961B restored exactly in the runner finally. All30 baseline201394… hashes/bytes match. Seven original fixed writers and four previously absent diagnostic output states are restored exactly;88 artifacts were verified before execution. CLI ended and5174 is empty, CPU/GPU/Port released. No source/runtime/driver fix or additional job authorized; product and execution HOLD. The previous full normal17 remains5PASS1FAIL11NOT_RUN. Independent cause assessment and a new exact grant are required for further work.
