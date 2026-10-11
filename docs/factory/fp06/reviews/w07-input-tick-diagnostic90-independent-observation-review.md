# W07 passive diagnostic90: independent observations

**Evidence binding MATCH; diagnostic only, not a normal gate. W07 remains FAIL88.** Actual four diagnostic cases PASS, exit0, 41.400954145996366s, ended `2026-10-11T18:25:42.147519+00:00`. No new jobs, experiments, product/evidence edits or package/Git acceptance.

Run root: `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/apps/weltraum-browser/evidence/factory/w07/2026-10-11T122211.412749Z`; archive `browser-input-tick-passive-diagnostic-90/`.

Raw-gzip (495bytes, SHA `d33335d8ea6e17157e1b21f8ea2cbf319f45d7ae3662234017c68279ebe39ccb`) independently decompresses to **1318bytes / SHA `c6feaf807346a8add1be3a690c744095246228735a2281b30ef7686d8d090369`**, matching command receipt/exit. `90-passive-diagnostic-artifact-receipt.json` SHA `7336732165031100cd13c6f95d032a702e1d7c7a7a68bb334be52943bbc94b3a` binds **6/6 actual payloads**, independently size/hash checked:

| Archive artifact | Bytes | SHA256 |
| --- | ---: | --- |
| diagnostic-input-tick-89-ready.json | 53207 | `c187af3eee8ef2c1c70be185e8f815a33ff766cc78e9f7cc6c8bef90618f82a1` |
| diagnostic-input-tick-89-125.json | 108483 | `734950ffc81d972ce0b4effe6fe9c08f36721578d55f34a1ec08a56d352cdb8f` |
| diagnostic-input-tick-89-250.json | 139572 | `9dd4b5a8a56641f54e7dccf590b9237f11f1688b3155db242d38f8655a534b7b` |
| diagnostic-input-tick-89-600.json | 176872 | `1dd37e14debe03aa36929d4d976ec2a8bc1fcc4b83ff1e60159b48d6e2dd681e` |
| playwright-output/.last-run.json | 45 | `91d1c43004802cd49950d78eb11c8fa7d05da8ffffe219a8b13b2f561bc00903` |
| playwright-report/index.html | 529374 | `5a837eea08c3603c9a46821422bc9d4f91cd6f8cdfd06df1dea86c333348de8c` |

All recorded KeyS down/up events are trusted/nonrepeat, pointer locked, page visible. Independent same-origin subtraction yields:

| Requested ms | Event-stamp gap ms | Main handler gap ms | Main FactoryInput-post gap ms | Down/up handler latency ms | Native Δz m / tick Δ |
| ---: | ---: | ---: | ---: | --- | --- |
| 125 | 131.2 | 0.7 | 0.4 | 139.7 /9.2 | 0 /81 |
| 250 | 251.2 | 179.4 | 176.9 | 159.6 /87.8 | -0.5500021 /135 |
| 600 | 602.0 | 507.4 | 507.4 | 153.0 /58.4 | -1.5500059 /197 |

The125ms event stamps fall within the same recorded144ms main longtask; its handlers/posts then occur almost together. The250/600ms stamps fall within respective162+176ms/158+165ms longtasks. Continuous nearby tasks include144–239ms durations. These establish delayed main-thread event handling and compressed Main posting intervals. They do not identify the expensive function, renderer/GPU cause or Worker input lifetime.

The600ms path ends x=-5.449979782/y=2.101745605/z=9.774991989: Δx=+0.050020218m and declining height, so it is not a plane-perfect pure-axis calibration. Release readbacks eventually stabilize; intermediate600ms Y/X continues settling. All snapshots report zero dropped records/id-map drops/observer errors and no product errors; these are observer counters, not proof of transport acceptance.

Actual `physicsWorker.ts` SHA `776ec49c1c8e180eb02e11d9e5a828087d4b7efd57a65619989c3408276056cb`, lines78–118, owns a private `1000/60`ms interval; FactoryInput acknowledgements bypass snapshot/clock/timing publication. Source cadence is not measured callback/step timing. Worker handler start/end, accepted boolean and individual step times remain **NOT_OBSERVED**. Measurement opt-in is false; solver/main-frame CPU are explicitly NOT_OBSERVED. Main ACK arrival times cannot substitute for Worker processing times.

Restore receipt reports baseline30/native restoration and normal E2E030fc; this scoped observation review does not grant final source/evidence packaging or reinterpret diagnostic PASS as normal gameplay success.
