# W07 trusted-key captured-error closure after85 — HOLD, BrowserNOT_RUN

Candidate84 remains immutable and independently SPEC/QUALITY FAIL for F1/P2: it reported only the first original input rejection and could replace originals on final-release failure. This is an E2E diagnostic-provenance issue; no new Native or material failure is claimed.

Only the existing E2E helper changes. Immediately-bound allSettled captures every original Down/timedUp reason object unchanged. The always-fresh Up still follows both settled requests, including success. Its failure is appended; Context.close is attempted before any Read or next gesture, and any close failure is appended too. One reason is thrown unchanged; multiple reasons are carried by a compact AggregateError. No retry, swallowing, or continuing after failure occurs. Error-path correctness is source reviewed here, not a newly executed transport-error test.

All prior gesture bounds, adaptive caps, trusted public Keyboard calls, same Page/World, released readbacks, source reach/Float/material assertions, timeout/queue limits and authority remain unchanged. No other product byte changed. Original TypeScript plus Vite Build85 passed at17:37:51.204371UTC in4.23665s; rawSHA5f30c4de…/1904B. Full30path diffcheck passed. New seal contains exactly one E2E delta versus candidate84; all29 other files match, overall28 actual products differ from reviewed base. The original candidate84 seal/patch/source copies remain intact.

CPU/GPU/5174 are free and all products are held. No browser, protocol-error execution, pulse-length guarantee, package PASS or commit is claimed. Independent delta review is required before a new explicitly authorized browser run.
