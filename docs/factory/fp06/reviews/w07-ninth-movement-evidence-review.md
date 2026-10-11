# W07 ninth normal browser: independent movement evidence review

Read-only review, 2026-10-11 UTC. **Retained command/artifact/derived-coordinate bindings MATCH. Ninth normal gate FAIL: 5 PASS, 1 FAIL, 11 NOT_RUN. Observed overshoot/oscillation confirmed; transport or Native root cause NOT_ESTABLISHED.** No final product-byte, manifest, package or Git gate is granted. Phase68 fine-pulse diagnostic is excluded.

Run root: `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/apps/weltraum-browser/evidence/factory/w07/2026-10-11T122211.412749Z`.

## Actual command and retained bytes

`67-real-browser-ninth-command.json` (971 bytes, SHA256 `78cc9d3becb0f7a14ddfddbca95726abd1cecedfd5ccc22af207d9c409382de1`) records normal `npm run test:e2e -- --config=/workspace/.cloud-setup/fp06-w07.playwright.config.mts tests/e2e/factory-placement.spec.ts`, cwd the Integrator application, Chromium `/usr/bin/chromium`, output `browser-ninth/`, existing config SHA `53a55a48da97d43a02e317fb8edc844d57a9b5687f356a7ebf4f5b470efcf900`.

Actual start `2026-10-11T16:03:48.664698+00:00`, end `2026-10-11T16:05:14.315084+00:00`, duration **85.65040222300013 s**, exit **1**, matching `67-real-browser-ninth.exit.txt`.

`67-real-browser-ninth.raw.log.gz` (1,679 bytes, SHA `ebbfc3835c1b87398acfab5ff739593b3c73abc3783a98566ade3c42e9ceefc3`) decompresses with valid gzip integrity to **8,164 bytes / SHA `31ba4dbd904090a4b20edadcf1fc1f501c3c623a653a3bf9ffc35a57149e6a10`**, exactly receipt-bound. Actual stdout reports 5 passed, 1 failed, 11 did not run; the failed stand assertion expects x≤-6.1 and receives -5.699980735778809. Readable `.log` is not substituted for raw bytes.

## Native movement and diagnosis reconstruction

`browser-ninth/browser-native-walk-taps.json`: **162,329 bytes**, SHA `433c0caace6ce019d47be224b3accfe3db85ea77de55fc4615d064520301a972`. `67-native-walk-readonly-diagnosis.json`: **21,838 bytes**, SHA `db23a7a761eac1ed78cdb52688375052fa50ed5d209ab38047e5e55d831ceba1`. Source hash/size/tap count match; all eight derived before/after/delta/tick values and both released-read summaries per gesture were independently recomputed and match exactly.

Initial x=-5.5; target=-6.25; recorded source-stand interval **[-6.4,-6.1]**, width **0.3 m**. Rounded presentation below; the original JSON retains exact values.

| Tap | Key / requested delay | Final x (m) | Δx (m) | Total observed tick Δ | Released-read ticks |
| --- | --- | ---: | ---: | ---: | --- |
| 1 | D / 250 ms | -6.500004 | -1.000004 | 115 | 1402,1434 |
| 2 | A / 250 ms | -5.349999 | +1.150004 | 121 | 1553,1589 |
| 3 | D / 300 ms | -6.400003 | -1.050004 | 115 | 1704,1737 |
| 4 | A / 250 ms | -5.450000 | +0.950004 | 114 | 1852,1886 |
| 5 | D / 267 ms | -6.500004 | -1.050004 | 111 | 2013,2044 |
| 6 | A / 250 ms | -5.649991 | +0.850013 | 112 | 2159,2191 |
| 7 | D / 250 ms | -6.599994 | -0.950004 | 110 | 2303,2335 |
| 8 | A / 250 ms | -5.699981 | +0.900013 | 107 | 2445,2476 |

The controller alternates across the narrow interval rather than attaining it. All eight exact final x values miss the interval. Tap3 is only **3.433 μm below the strict -6.4 endpoint**, a near-boundary miss, not a large collision failure. Each displacement is 0.85–1.15 m; ordinary correction gestures can overshoot a 0.3 m stand interval. This establishes observed correction behavior, not its complete input/physics cause.

All **16 actual** released readbacks advance native ticks; each pair has exactly stable XYZ, grounded=true, native Running, player Walking. Factory/terrain/structural/moving/body-residency/neighbor transactions are Idle at all inspected readbacks, with no installed facility. The diagnosis property `transactionStatesFromEveryReleasedRead` contains eight final-read summaries, not sixteen entries; independent inspection additionally verified the first read of every pair. Total tick deltas include time before readback/settling and cannot be interpreted as held-key ticks.

## Timing limit and root-cause boundary

The actual retained trace ZIP (4,895,755 bytes, SHA `425d4d0097e808df07d0c7a2dd56dbace25d3c491edebb31db4d9c63565b9dcc`) contains **four** `keyboardPress` API spans for the final four gestures. Independent `0-trace.trace` reconstruction exactly matches diagnosis timings: **663.479 / 674.701 / 605.445 / 611.003 ms** for requested delays **267 /250 /250 /250 ms**. These are total Playwright API durations, including protocol/dispatch/wait overhead. They are not measured physical key-hold durations. No corresponding timing proof exists here for the first four gestures.

The trace's four `type:input` records are Playwright input-snapshot references. They do not provide trusted DOM keyDown/keyUp timestamps or outgoing Worker Read(input) timestamps. The 34 retained DOM snapshots show sampled released/neutral input state; they do not trace every event during each gesture. Consequently neither uneven API durations nor stable post-release positions prove an Input/Native/Hold/obstacle defect—or prove their absence during unobserved intervals. “Harness overshoot” is a reasonable description of the observed correction sequence; a causal claim that a specific harness/protocol bug caused it remains **unproven**. The diagnosis's own `causeLimit` accurately states that limit.

## Archive preservation and scope limits

`67-browser-ninth-artifact-receipt.json` (5,599 bytes, SHA `1c7ae260438e7fc41112b77118acf109e397f57aa9fb967f068412456e4d28ae`) binds **27/27 existing artifact payloads**, total **12,504,694 bytes**; every actual file size/hash matches independently. It identifies only `browser-native-walk-taps.json` as fresh custom test output. No ninth paid Cutter capture/material proof exists here.

The original eighth receipt SHA `ab38347d257a874ca78f763bb872766f3b31861db893afede213a137bbac6371` still binds **31/31 unchanged archived payloads**, total **21,173,064 bytes**, all independently checked against actual files. Its historical paid image/failed normal gate are preserved and remain separate from ninth evidence.

The ninth run does not establish Ghost move/rotate/cancel, paid Cutter installation, second-Cutter/C26 rejection, subsequent stand/service access, or normal session disposal: successor cases were not run. Human Owner art, W09 complete flow, W10 save/reload, W11 performance, final master-manifest/Git/LFS acceptance are unclaimed. Only existing-file/JSON/gzip/hash/ZIP reads were performed; no test, browser, build, native job or product/evidence edit. This external report is the sole write.
