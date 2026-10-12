# W09 partial implementation command inventory

All197 actual command receipts are preserved with exact stdout and lossless original gzip. Every SHA/byte/gzip binding was checked. PASS below refers only to the executed command scope. Historical fixtures, failures, timeouts and unrun browser cases remain explicit. No aggregate test count is claimed across repeated phases.

| Phase | Actual child exit | Actual elapsed seconds | Result/classification | Actual test summary |
|---|---:|---:|---|---|
| [01-cargo-custody-business-red](../01-cargo-custody-business-red.log) | 1 | 0.781402 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  3 failed  /  1 passed (4) |
| [02-cargo-custody-green](../02-cargo-custody-green.log) | 0 | 0.814556 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  4 passed (4) |
| [03-native-carrier-business-red](../03-native-carrier-business-red.log) | 1 | 3.283981 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  3 failed  /  11 skipped (14) |
| [04-native-carrier-first-green](../04-native-carrier-first-green.log) | 1 | 3.264023 | FAIL_SETUP_OR_ORACLE_OR_MIXED | Test Files  1 failed (1); Tests  1 failed  /  2 passed  /  11 skipped (14) |
| [05-native-carrier-custody-green](../05-native-carrier-custody-green.log) | 0 | 4.153161 | PASS_COMMAND_SCOPE | Test Files  2 passed (2); Tests  18 passed (18) |
| [06-interface-native-original-build](../06-interface-native-original-build.log) | 0 | 4.196401 | PASS_COMMAND_SCOPE |  |
| [07-cargo-complete-foot-identity-request-red](../07-cargo-complete-foot-identity-request-red.log) | 1 | 3.006853 | FAIL_COLLECTED_ASSERTIONS | Test Files  2 failed (2); Tests  3 failed  /  18 skipped (21) |
| [08-cargo-foot-identity-request-green](../08-cargo-foot-identity-request-green.log) | 0 | 4.746976 | PASS_COMMAND_SCOPE | Test Files  2 passed (2); Tests  21 passed (21) |
| [09-paired-native-carrier-movement-red](../09-paired-native-carrier-movement-red.log) | 1 | 1.798399 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  2 failed  /  17 skipped (19) |
| [10-paired-native-carrier-first-green](../10-paired-native-carrier-first-green.log) | 0 | 6.082993 | PASS_COMMAND_SCOPE | Test Files  3 passed (3); Tests  40 passed (40) |
| [11-shared-authority-complete-command-replay-red](../11-shared-authority-complete-command-replay-red.log) | 1 | 0.849285 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  4 failed (4) |
| [12-shared-authority-history-green](../12-shared-authority-history-green.log) | 0 | 0.943903 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  4 passed (4) |
| [13-native-local-depot-red](../13-native-local-depot-red.log) | 1 | 2.107169 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  16 skipped (17) |
| [14-native-local-depot-collected-business-red](../14-native-local-depot-collected-business-red.log) | 1 | 2.105321 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  16 skipped (17) |
| [15-native-local-depot-first-green](../15-native-local-depot-first-green.log) | 0 | 2.055225 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  16 skipped (17) |
| [16-native-local-source-business-red](../16-native-local-source-business-red.log) | 1 | 2.132138 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  17 skipped (18) |
| [17-native-local-source-green](../17-native-local-source-green.log) | 0 | 2.644974 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  2 passed  /  16 skipped (18) |
| [18-native-carrier-client-publication-red](../18-native-carrier-client-publication-red.log) | 1 | 2.232012 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  24 skipped (25) |
| [19-native-carrier-client-publication-green](../19-native-carrier-client-publication-green.log) | 0 | 2.118752 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  24 skipped (25) |
| [20-shared-construction-authority-red](../20-shared-construction-authority-red.log) | 1 | 1.162289 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  4 skipped (5) |
| [21-shared-authority-carrier-affected-green](../21-shared-authority-carrier-affected-green.log) | 0 | 10.012615 | PASS_COMMAND_SCOPE | Test Files  5 passed (5); Tests  72 passed (72) |
| [22-dry-joint-clock-power-red](../22-dry-joint-clock-power-red.log) | 1 | 0.999915 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  5 skipped (6) |
| [23-dry-confirmed-step-first-green](../23-dry-confirmed-step-first-green.log) | 0 | 1.140395 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  6 passed (6) |
| [24-carrier-authority-dry-build](../24-carrier-authority-dry-build.log) | 1 | 2.344740 | FAIL_SETUP_OR_ORACLE_OR_MIXED |  |
| [25-carrier-type-narrow-build](../25-carrier-type-narrow-build.log) | 0 | 4.389758 | PASS_COMMAND_SCOPE |  |
| [26-dry-replay-fresh-facts-red](../26-dry-replay-fresh-facts-red.log) | 1 | 0.870194 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  5 skipped (6) |
| [27-native-full-slot-release-red](../27-native-full-slot-release-red.log) | 1 | 2.018751 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  18 skipped (19) |
| [28-dry-facts-and-full-release-green](../28-dry-facts-and-full-release-green.log) | 0 | 3.012640 | PASS_COMMAND_SCOPE | Test Files  2 passed (2); Tests  3 passed  /  22 skipped (25) |
| [29-native-paired-jump-autostep-regression](../29-native-paired-jump-autostep-regression.log) | 0 | 1.803186 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  2 passed  /  19 skipped (21) |
| [30-native-uuid-binding-red](../30-native-uuid-binding-red.log) | 1 | 0.964862 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  6 skipped (7) |
| [31-native-uuid-binding-green](../31-native-uuid-binding-green.log) | 0 | 0.986497 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  6 skipped (7) |
| [32-carrier-release-transport-red](../32-carrier-release-transport-red.log) | 1 | 2.204200 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  24 skipped (25) |
| [33-carrier-release-transport-green](../33-carrier-release-transport-green.log) | 0 | 2.225495 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  24 skipped (25) |
| [34-host-native-custody-red](../34-host-native-custody-red.log) | 1 | 1.030355 | FAIL_SETUP_OR_ORACLE_OR_MIXED | Test Files  1 failed (1); Tests  2 failed  /  5 skipped (7) |
| [35-host-native-support-red](../35-host-native-support-red.log) | 1 | 0.995668 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  6 skipped (7) |
| [36-host-native-custody-green](../36-host-native-custody-green.log) | 0 | 1.268028 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  2 passed  /  5 skipped (7) |
| [37-host-custody-integration-build](../37-host-custody-integration-build.log) | 1 | 2.615633 | FAIL_SETUP_OR_ORACLE_OR_MIXED |  |
| [38-host-custody-integration-build-green](../38-host-custody-integration-build-green.log) | 0 | 4.422812 | PASS_COMMAND_SCOPE |  |
| [39-native-uuid-power-red](../39-native-uuid-power-red.log) | 1 | 0.902482 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  6 skipped (7) |
| [40-native-uuid-full-domain-green](../40-native-uuid-full-domain-green.log) | 0 | 0.866955 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  2 passed  /  5 skipped (7) |
| [41-native-depot-read-and-partial-custody-red](../41-native-depot-read-and-partial-custody-red.log) | 1 | 2.724062 | FAIL_COLLECTED_ASSERTIONS | Test Files  2 failed (2); Tests  2 failed  /  25 skipped (27) |
| [42-native-depot-read-and-partial-custody-green](../42-native-depot-read-and-partial-custody-green.log) | 0 | 2.446599 | PASS_COMMAND_SCOPE | Test Files  2 passed (2); Tests  2 passed  /  25 skipped (27) |
| [43-host-complete-custody-and-history-integration](../43-host-complete-custody-and-history-integration.log) | 0 | 1.067800 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  19 skipped (20) |
| [44-local-factory-products-profile-red](../44-local-factory-products-profile-red.log) | 1 | 1.601815 | FAIL_SETUP_OR_ORACLE_OR_MIXED | Test Files  1 failed (1); Tests  1 failed  /  19 skipped (20) |
| [45-local-factory-products-profile-red](../45-local-factory-products-profile-red.log) | 1 | 1.636359 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  19 skipped (20) |
| [46-local-factory-products-profile-green](../46-local-factory-products-profile-green.log) | 0 | 1.721813 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  19 skipped (20) |
| [47-ui-carrier-projection-build](../47-ui-carrier-projection-build.log) | 1 | 2.736507 | FAIL_SETUP_OR_ORACLE_OR_MIXED |  |
| [48-local-bom-depot-install-red](../48-local-bom-depot-install-red.log) | 1 | 2.223556 | FAIL_SETUP_OR_ORACLE_OR_MIXED | Test Files  1 failed (1); Tests  1 failed  /  20 skipped (21) |
| [49-local-bom-depot-install-green](../49-local-bom-depot-install-green.log) | 1 | 2.108585 | FAIL_SETUP_OR_ORACLE_OR_MIXED | Test Files  1 failed (1); Tests  1 failed  /  20 skipped (21) |
| [50-local-depot-payment-red](../50-local-depot-payment-red.log) | 1 | 1.043192 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  8 skipped (9) |
| [51-remote-native-depot-install-green](../51-remote-native-depot-install-green.log) | 0 | 2.240460 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  20 skipped (21) |
| [52-local-depot-payment-green](../52-local-depot-payment-green.log) | 0 | 1.344364 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  8 skipped (9) |
| [53-paid-depot-projection-affected](../53-paid-depot-projection-affected.log) | 0 | 11.272650 | PASS_COMMAND_SCOPE | Test Files  5 passed (5); Tests  82 passed (82) |
| [54-live-paid-machine-soc-red](../54-live-paid-machine-soc-red.log) | 1 | 1.340855 | FAIL_SETUP_OR_ORACLE_OR_MIXED | Test Files  1 failed (1); Tests  1 failed  /  7 skipped (8) |
| [55-live-paid-machine-soc-green](../55-live-paid-machine-soc-green.log) | 0 | 1.280816 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  7 skipped (8) |
| [56-installed-battery-supply-red](../56-installed-battery-supply-red.log) | 1 | 1.160234 | FAIL_SETUP_OR_ORACLE_OR_MIXED | Test Files  1 failed (1); Tests  1 failed  /  7 skipped (8) |
| [57-installed-battery-supply-green](../57-installed-battery-supply-green.log) | 0 | 1.273410 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  7 skipped (8) |
| [58-host-installed-machine-domain-red](../58-host-installed-machine-domain-red.log) | 1 | 1.356354 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  20 skipped (21) |
| [59-host-installed-machine-domain-green](../59-host-installed-machine-domain-green.log) | 0 | 1.541480 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  20 skipped (21) |
| [60-live-host-original-build](../60-live-host-original-build.log) | 1 | 2.715484 | FAIL_SETUP_OR_ORACLE_OR_MIXED |  |
| [61-live-host-original-build-fixed](../61-live-host-original-build-fixed.log) | 0 | 4.313043 | PASS_COMMAND_SCOPE |  |
| [62-heavy-route-e2e-build](../62-heavy-route-e2e-build.log) | 1 | 2.329040 | FAIL_SETUP_OR_ORACLE_OR_MIXED |  |
| [63-heavy-route-e2e-build-fixed](../63-heavy-route-e2e-build-fixed.log) | 0 | 4.521098 | PASS_COMMAND_SCOPE |  |
| [64-normal-heavy-route](../64-normal-heavy-route.log) | 1 | 20.635692 | FAIL_NORMAL_BROWSER_GATE | 1 failed; 12 did not run; 1 passed (19.9s) |
| [65-ui-cargo-open-red](../65-ui-cargo-open-red.log) | 1 | 9.621628 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  36 skipped (37) |
| [66-ui-cargo-open-green](../66-ui-cargo-open-green.log) | 0 | 8.905405 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  36 skipped (37) |
| [67-native-cargo-open-build](../67-native-cargo-open-build.log) | 0 | 4.646507 | PASS_COMMAND_SCOPE |  |
| [68-normal-heavy-route](../68-normal-heavy-route.log) | 1 | 22.178353 | FAIL_NORMAL_BROWSER_GATE | 1 failed; 12 did not run; 1 passed (21.5s) |
| [69-supported-pickup-route-build](../69-supported-pickup-route-build.log) | 0 | 4.123159 | PASS_COMMAND_SCOPE |  |
| [70-normal-supported-heavy-route](../70-normal-supported-heavy-route.log) | 1 | 25.833331 | FAIL_NORMAL_BROWSER_GATE | 1 failed; 12 did not run; 3 passed (25.2s) |
| [71-released-native-read-build](../71-released-native-read-build.log) | 0 | 4.926249 | PASS_COMMAND_SCOPE |  |
| [72-normal-settled-heavy-route](../72-normal-settled-heavy-route.log) | 1 | 29.334360 | FAIL_NORMAL_BROWSER_GATE | 1 failed; 10 did not run; 5 passed (28.7s) |
| [73-native-paired-veto-read-red](../73-native-paired-veto-read-red.log) | 1 | 2.162263 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  21 skipped (22) |
| [74-native-paired-veto-read-green](../74-native-paired-veto-read-green.log) | 0 | 2.165043 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  21 skipped (22) |
| [75-native-veto-affected-green](../75-native-veto-affected-green.log) | 0 | 9.770589 | PASS_COMMAND_SCOPE | Test Files  3 passed (3); Tests  68 passed (68) |
| [76-native-veto-build](../76-native-veto-build.log) | 0 | 4.152288 | PASS_COMMAND_SCOPE |  |
| [77-normal-heavy-veto-witness](../77-normal-heavy-veto-witness.log) | 0 | 24.098556 | PASS_COMMAND_SCOPE | 5 passed (23.5s) |
| [78-native-neutral-veto-retention-red](../78-native-neutral-veto-retention-red.log) | 1 | 2.356918 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  21 skipped (22) |
| [79-native-neutral-veto-retention-green](../79-native-neutral-veto-retention-green.log) | 0 | 2.216781 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  21 skipped (22) |
| [80-native-neutral-veto-retention-build](../80-native-neutral-veto-retention-build.log) | 0 | 4.421484 | PASS_COMMAND_SCOPE |  |
| [81-normal-retained-heavy-veto-witness](../81-normal-retained-heavy-veto-witness.log) | 0 | 23.580963 | PASS_COMMAND_SCOPE | 5 passed (23.0s) |
| [82-real-receiver-and-native-budget-faults-red](../82-real-receiver-and-native-budget-faults-red.log) | 1 | 39.933467 | FAIL_SETUP_OR_ORACLE_OR_MIXED | Test Files  1 failed (1); Tests  5 failed  /  37 skipped (42) |
| [83-real-consumed-carrier-projection-rollback-red](../83-real-consumed-carrier-projection-rollback-red.log) | 1 | 9.177106 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  41 skipped (42) |
| [84-real-receiver-and-native-budget-faults-green](../84-real-receiver-and-native-budget-faults-green.log) | 0 | 41.577218 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  5 passed  /  37 skipped (42) |
| [85-native-production-observation-red](../85-native-production-observation-red.log) | 1 | 1.882418 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  22 skipped (23) |
| [86-native-production-observation-green](../86-native-production-observation-green.log) | 0 | 1.815401 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  22 skipped (23) |
| [87-real-carrier-release-retirement-red](../87-real-carrier-release-retirement-red.log) | 1 | 9.200622 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  42 skipped (43) |
| [88-real-carrier-release-retirement-green](../88-real-carrier-release-retirement-green.log) | 0 | 9.629193 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  42 skipped (43) |
| [89-live-ui-production-commands-red](../89-live-ui-production-commands-red.log) | 1 | 1.873995 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  2 failed  /  21 skipped (23) |
| [90-shared-cas-command-reply-red](../90-shared-cas-command-reply-red.log) | 1 | 1.787807 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  23 skipped (24) |
| [91-live-ui-production-commands-green](../91-live-ui-production-commands-green.log) | 1 | 2.748272 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  2 passed  /  21 skipped (24) |
| [92-pending-process-replay-dispose-red](../92-pending-process-replay-dispose-red.log) | 1 | 2.952987 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  3 failed  /  24 skipped (27) |
| [93-live-process-command-green](../93-live-process-command-green.log) | 0 | 4.854010 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  6 passed  /  21 skipped (27) |
| [94-native-belt-quarterturn-binding-red](../94-native-belt-quarterturn-binding-red.log) | 1 | 0.963468 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  5 failed  /  8 skipped (13) |
| [95-native-belt-quarterturn-binding-green](../95-native-belt-quarterturn-binding-green.log) | 0 | 1.032324 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  5 passed  /  8 skipped (13) |
| [96-native-power-socket-read-red](../96-native-power-socket-read-red.log) | 1 | 1.867206 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  23 skipped (24) |
| [97-native-power-socket-read-green](../97-native-power-socket-read-green.log) | 0 | 1.835705 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  23 skipped (24) |
| [98-finite-native-cable-power-red](../98-finite-native-cable-power-red.log) | 1 | 1.895255 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  27 skipped (28) |
| [99-finite-native-cable-power-green](../99-finite-native-cable-power-green.log) | 1 | 2.201691 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  27 skipped (28) |
| [100-powered-host-rejection-cause](../100-powered-host-rejection-cause.log) | 1 | 2.024947 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  27 skipped (28) |
| [101-finite-native-cable-power-green](../101-finite-native-cable-power-green.log) | 0 | 2.609061 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  27 skipped (28) |
| [102-transient-service-block-active-work-red](../102-transient-service-block-active-work-red.log) | 1 | 2.733888 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  28 skipped (29) |
| [103-transient-service-block-active-work-green](../103-transient-service-block-active-work-green.log) | 0 | 3.031906 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  28 skipped (29) |
| [104-installed-consumer-restart-headroom-red](../104-installed-consumer-restart-headroom-red.log) | 1 | 1.259385 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  12 skipped (13) |
| [105-installed-consumer-restart-headroom-green](../105-installed-consumer-restart-headroom-green.log) | 0 | 1.363553 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  12 skipped (13) |
| [106-native-power-owner-admission-red](../106-native-power-owner-admission-red.log) | 1 | 2.653036 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  29 skipped (30) |
| [107-native-power-owner-admission-green](../107-native-power-owner-admission-green.log) | 0 | 2.810756 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  29 skipped (30) |
| [108-first-clear-native-baseline-red](../108-first-clear-native-baseline-red.log) | 1 | 2.711779 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  29 skipped (30) |
| [109-first-clear-native-baseline-green](../109-first-clear-native-baseline-green.log) | 0 | 2.713052 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  29 skipped (30) |
| [110-live-domain-original-build](../110-live-domain-original-build.log) | 1 | 2.780749 | FAIL_SETUP_OR_ORACLE_OR_MIXED |  |
| [111-live-domain-typed-original-build](../111-live-domain-typed-original-build.log) | 0 | 4.246713 | PASS_COMMAND_SCOPE |  |
| [112-paid-fixed-belt-source-red](../112-paid-fixed-belt-source-red.log) | 1 | 1.696219 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  24 skipped (25) |
| [113-paid-fixed-belt-source-green](../113-paid-fixed-belt-source-green.log) | 0 | 1.716018 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  24 skipped (25) |
| [114-paid-native-belt-domain-red](../114-paid-native-belt-domain-red.log) | 1 | 0.998882 | FAIL_SETUP_OR_ORACLE_OR_MIXED | Test Files  1 failed (1); Tests  1 failed  /  13 skipped (14) |
| [115-paid-native-belt-domain-fixture-red](../115-paid-native-belt-domain-fixture-red.log) | 1 | 1.369324 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  13 skipped (14) |
| [116-paid-native-belt-domain-green](../116-paid-native-belt-domain-green.log) | 0 | 1.442629 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  13 skipped (14) |
| [117-live-paid-belt-command-red](../117-live-paid-belt-command-red.log) | 1 | 2.650448 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  30 skipped (31) |
| [118-live-paid-belt-command-green](../118-live-paid-belt-command-green.log) | 0 | 2.919090 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  30 skipped (31) |
| [119-paid-c05-manual-usable-brace-admission](../119-paid-c05-manual-usable-brace-admission.log) | 1 | 1.353697 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  31 skipped (32) |
| [120-paid-c05-manual-buffer-access-red](../120-paid-c05-manual-buffer-access-red.log) | 1 | 1.361837 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  31 skipped (32) |
| [121-paid-c05-manual-usable-brace-green](../121-paid-c05-manual-usable-brace-green.log) | 0 | 3.340478 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  31 skipped (32) |
| [122-exact-cable6500-depot-joint-red](../122-exact-cable6500-depot-joint-red.log) | 1 | 1.750676 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  32 skipped (33) |
| [123-exact-cable6500-native-release-red](../123-exact-cable6500-native-release-red.log) | 1 | 1.946383 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  32 skipped (33) |
| [124-exact-cable6500-native-release-green](../124-exact-cable6500-native-release-green.log) | 0 | 1.977545 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  32 skipped (33) |
| [125-published-native-connections-ui-red](../125-published-native-connections-ui-red.log) | 1 | 1.577578 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  33 skipped (34) |
| [126-published-native-connections-ui-green](../126-published-native-connections-ui-green.log) | 0 | 1.588892 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  33 skipped (34) |
| [127-needed-source-layout-cable-jobs-red](../127-needed-source-layout-cable-jobs-red.log) | 1 | 0.943030 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  2 failed  /  9 skipped (11) |
| [128-needed-source-layout-cable-jobs-green](../128-needed-source-layout-cable-jobs-green.log) | 0 | 0.937538 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  2 passed  /  9 skipped (11) |
| [129-paid-band-blackout-graph-output-countercases](../129-paid-band-blackout-graph-output-countercases.log) | 1 | 2.004389 | FAIL_SETUP_OR_ORACLE_OR_MIXED | Test Files  1 failed (1); Tests  2 failed  /  14 skipped (16) |
| [130-paid-band-valid-fixtures-countercases](../130-paid-band-valid-fixtures-countercases.log) | 1 | 1.968350 | FAIL_SETUP_OR_ORACLE_OR_MIXED | Test Files  1 failed (1); Tests  2 failed  /  14 skipped (16) |
| [131-paid-band-real-c03-countercases](../131-paid-band-real-c03-countercases.log) | 1 | 33.868780 | FAIL_ORIGINAL_PERFORMANCE_LIMIT | Test Files  1 failed (1); Tests  2 failed  /  14 skipped (16) |
| [132-paid-band-v8-attribution](../132-paid-band-v8-attribution.log) | 1 | 10.915177 | FAIL_ORIGINAL_PERFORMANCE_LIMIT | Test Files  1 failed (1); Tests  1 failed  /  15 skipped (16) |
| [133-paid-band-candidate-one](../133-paid-band-candidate-one.log) | 1 | 15.295799 | FAIL_ORIGINAL_PERFORMANCE_LIMIT | Test Files  1 failed (1); Tests  1 failed  /  1 passed  /  14 skipped (16) |
| [134-paid-band-candidate-two](../134-paid-band-candidate-two.log) | 1 | 9.310227 | FAIL_ORIGINAL_PERFORMANCE_LIMIT | Test Files  1 failed (1); Tests  1 failed  /  1 passed  /  14 skipped (16) |
| [135-private-byte-guard-red](../135-private-byte-guard-red.log) | 1 | 1.089115 | FAIL_SETUP_OR_ORACLE_OR_MIXED | Test Files  1 failed (1); Tests  1 failed  /  3 passed  /  16 skipped (20) |
| [136-private-byte-guard-actual-red](../136-private-byte-guard-actual-red.log) | 1 | 1.092213 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  2 failed  /  2 passed  /  16 skipped (20) |
| [137-private-byte-guard-green](../137-private-byte-guard-green.log) | 0 | 1.111142 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  4 passed  /  16 skipped (20) |
| [138-private-byte-guards-and-domain-regressions](../138-private-byte-guards-and-domain-regressions.log) | 0 | 14.726724 | PASS_COMMAND_SCOPE | Test Files  2 passed (2); Tests  38 passed  /  3 skipped (41) |
| [139-actual-conveyor-material-regressions](../139-actual-conveyor-material-regressions.log) | 0 | 17.391969 | PASS_COMMAND_SCOPE | Test Files  2 passed (2); Tests  29 passed (29) |
| [140-original-build-after-paid-band-guards](../140-original-build-after-paid-band-guards.log) | 1 | 2.876380 | FAIL_SETUP_OR_ORACLE_OR_MIXED |  |
| [141-host-fixture-type-repair](../141-host-fixture-type-repair.log) | 0 | 1.546129 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  33 skipped (34) |
| [142-original-build-test-type-repair](../142-original-build-test-type-repair.log) | 0 | 4.552509 | PASS_COMMAND_SCOPE |  |
| [143-actual-runtime-versions](../143-actual-runtime-versions.log) | 0 | 0.092846 | PASS_COMMAND_SCOPE |  |
| [144-external-proposal-output-forgery-red](../144-external-proposal-output-forgery-red.log) | 1 | 0.988307 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  25 skipped (26) |
| [145-external-output-complete-guards-green](../145-external-output-complete-guards-green.log) | 0 | 1.726392 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  23 passed  /  3 skipped (26) |
| [146-complete-external-receipt-power-red](../146-complete-external-receipt-power-red.log) | 1 | 1.141713 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  2 failed  /  26 skipped (28) |
| [147-complete-w02-receipts-claims-red](../147-complete-w02-receipts-claims-red.log) | 1 | 1.112070 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  2 failed  /  28 skipped (30) |
| [148-complete-joint-admission-guards-green](../148-complete-joint-admission-guards-green.log) | 0 | 2.279487 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  27 passed  /  3 skipped (30) |
| [149-original-build-complete-joint-guards](../149-original-build-complete-joint-guards.log) | 0 | 4.116411 | PASS_COMMAND_SCOPE |  |
| [150-native-depot-snap-custody-red](../150-native-depot-snap-custody-red.log) | 1 | 3.215540 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  3 failed  /  25 skipped (28) |
| [151-external-output-alias-red](../151-external-output-alias-red.log) | 1 | 1.181442 | FAIL_SETUP_OR_ORACLE_OR_MIXED | Test Files  1 failed (1); Tests  3 failed  /  30 skipped (33) |
| [152-external-output-alias-red](../152-external-output-alias-red.log) | 1 | 1.366791 | FAIL_SETUP_OR_ORACLE_OR_MIXED | Test Files  1 failed (1); Tests  3 failed  /  30 skipped (33) |
| [153-external-output-alias-red](../153-external-output-alias-red.log) | 1 | 1.276512 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  3 failed  /  30 skipped (33) |
| [154-output-alias-and-joint-guards-green](../154-output-alias-and-joint-guards-green.log) | 0 | 4.677113 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  19 passed  /  14 skipped (33) |
| [155-output-alias-original-build](../155-output-alias-original-build.log) | 1 | 2.541765 | FAIL_SETUP_OR_ORACLE_OR_MIXED |  |
| [156-output-alias-test-types-green](../156-output-alias-test-types-green.log) | 0 | 1.367129 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  3 passed  /  30 skipped (33) |
| [157-output-alias-original-build](../157-output-alias-original-build.log) | 0 | 4.510300 | PASS_COMMAND_SCOPE |  |
| [158-native-depot-snap-custody-green](../158-native-depot-snap-custody-green.log) | 0 | 7.958264 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  28 passed (28) |
| [159-native-depot-original-build](../159-native-depot-original-build.log) | 0 | 4.734589 | PASS_COMMAND_SCOPE |  |
| [160-exact-material-cache-one-candidate](../160-exact-material-cache-one-candidate.log) | 1 | 9.152665 | FAIL_ORIGINAL_PERFORMANCE_LIMIT | Test Files  1 failed (1); Tests  1 failed  /  1 passed  /  31 skipped (33) |
| [161-exact-material-cache-guards](../161-exact-material-cache-guards.log) | 1 | 5.101401 | FAIL_SETUP_OR_ORACLE_OR_MIXED | Test Files  1 failed (1); Tests  1 failed  /  19 passed  /  14 skipped (34) |
| [162-exact-material-cache-affected](../162-exact-material-cache-affected.log) | 0 | 29.611218 | PASS_COMMAND_SCOPE | Test Files  3 passed (3); Tests  45 passed (45) |
| [163-exact-material-cache-original-build](../163-exact-material-cache-original-build.log) | 0 | 4.092539 | PASS_COMMAND_SCOPE |  |
| [164-exact-material-cache-guards](../164-exact-material-cache-guards.log) | 0 | 4.894942 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  20 passed  /  14 skipped (34) |
| [165-exact-material-cache-original-build](../165-exact-material-cache-original-build.log) | 0 | 4.322501 | PASS_COMMAND_SCOPE |  |
| [166-whole-montage-local-choice-red](../166-whole-montage-local-choice-red.log) | 1 | 1.453295 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  34 skipped (35) |
| [167-whole-montage-local-choice-green](../167-whole-montage-local-choice-green.log) | 0 | 1.747500 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  34 skipped (35) |
| [168-local-delivery-ui-pending-affected](../168-local-delivery-ui-pending-affected.log) | 0 | 4.371702 | PASS_COMMAND_SCOPE | Test Files  2 passed (2); Tests  10 passed  /  40 skipped (50) |
| [169-local-delivery-entry-original-build](../169-local-delivery-entry-original-build.log) | 1 | 2.563962 | FAIL_SETUP_OR_ORACLE_OR_MIXED |  |
| [170-local-delivery-entry-original-build](../170-local-delivery-entry-original-build.log) | 0 | 4.578209 | PASS_COMMAND_SCOPE |  |
| [171-carrier-context-hud-business-red](../171-carrier-context-hud-business-red.log) | 1 | 9.324632 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  43 skipped (44) |
| [172-carrier-context-hud-focused-green](../172-carrier-context-hud-focused-green.log) | 0 | 9.903992 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  43 skipped (44) |
| [173-carrier-context-hud-default-restore-and-fault-regressions](../173-carrier-context-hud-default-restore-and-fault-regressions.log) | 0 | 54.265497 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  7 passed  /  37 skipped (44) |
| [174-carrier-context-hud-original-build](../174-carrier-context-hud-original-build.log) | 0 | 4.248900 | PASS_COMMAND_SCOPE |  |
| [175-paid-rawbin-actual-source-service-red](../175-paid-rawbin-actual-source-service-red.log) | 1 | 1.479330 | FAIL_SETUP_OR_ORACLE_OR_MIXED | Test Files  1 failed (1); Tests  1 failed  /  11 skipped (12) |
| [176-paid-rawbin-current-source-oracle-correction](../176-paid-rawbin-current-source-oracle-correction.log) | 0 | 1.407416 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  11 skipped (12) |
| [177-cable4750-8000-actual-source-native-spatial-oracles](../177-cable4750-8000-actual-source-native-spatial-oracles.log) | 1 | 9.774355 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  2 failed  /  28 skipped (30) |
| [178-cable-source-native-confirmation-countercase-witness](../178-cable-source-native-confirmation-countercase-witness.log) | 1 | 9.511066 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  2 failed  /  28 skipped (30) |
| [179-complete-tech-host-red](../179-complete-tech-host-red.log) | 1 | 1.009381 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  35 skipped (36) |
| [180-complete-tech-host-green](../180-complete-tech-host-green.log) | 0 | 1.086461 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  35 skipped (36) |
| [181-tech-units-native-availability-red](../181-tech-units-native-availability-red.log) | 1 | 1.100291 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  36 skipped (37) |
| [182-tech-native-availability-red](../182-tech-native-availability-red.log) | 1 | 1.211541 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  1 failed  /  37 skipped (38) |
| [183-tech-host-ui-green](../183-tech-host-ui-green.log) | 0 | 1.335914 | PASS_COMMAND_SCOPE | Test Files  2 passed (2); Tests  5 passed  /  48 skipped (53) |
| [184-tech-original-build](../184-tech-original-build.log) | 1 | 2.303593 | FAIL_SETUP_OR_ORACLE_OR_MIXED |  |
| [185-tech-typed-host-green](../185-tech-typed-host-green.log) | 0 | 1.075342 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  1 passed  /  37 skipped (38) |
| [186-tech-original-build](../186-tech-original-build.log) | 0 | 4.451124 | PASS_COMMAND_SCOPE |  |
| [187-new-supported-battery-cable-red](../187-new-supported-battery-cable-red.log) | 1 | 21.523775 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  3 failed  /  2 passed  /  28 skipped (33) |
| [188-supported-battery-source-native-green](../188-supported-battery-source-native-green.log) | 0 | 21.456347 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  5 passed  /  28 skipped (33) |
| [189-cable-finite-custody-regressions](../189-cable-finite-custody-regressions.log) | 0 | 3.143516 | PASS_COMMAND_SCOPE | Test Files  2 passed (2); Tests  10 passed  /  41 skipped (51) |
| [190-supported-battery-cable-original-build](../190-supported-battery-cable-original-build.log) | 0 | 4.120357 | PASS_COMMAND_SCOPE |  |
| [191-cable-rollback-publication-history-oracles](../191-cable-rollback-publication-history-oracles.log) | 0 | 6.493767 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  4 passed  /  38 skipped (42) |
| [192-cable-whole40-native-negative-guards](../192-cable-whole40-native-negative-guards.log) | 0 | 3.645777 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  2 passed  /  42 skipped (44) |
| [193-cable-fault-typed-original-build](../193-cable-fault-typed-original-build.log) | 0 | 4.268770 | PASS_COMMAND_SCOPE |  |
| [194-cable-recovery-new-intent-red](../194-cable-recovery-new-intent-red.log) | 1 | 7.231498 | FAIL_COLLECTED_ASSERTIONS | Test Files  1 failed (1); Tests  3 failed  /  1 passed  /  40 skipped (44) |
| [195-cable-recovery-new-intent-green](../195-cable-recovery-new-intent-green.log) | 0 | 9.043318 | PASS_COMMAND_SCOPE | Test Files  1 passed (1); Tests  6 passed  /  38 skipped (44) |
| [196-cable-recovery-host-ui-affected](../196-cable-recovery-host-ui-affected.log) | 0 | 26.728585 | PASS_COMMAND_SCOPE | Test Files  2 passed (2); Tests  59 passed (59) |
| [197-cable-recovery-original-build](../197-cable-recovery-original-build.log) | 0 | 4.303717 | PASS_COMMAND_SCOPE |  |

The JSON companion contains exact commands, working directories, UTC start/end times, raw SHA256/bytes, failure causes, and phase limitations. Important mixed/setup histories include04,34,44,48–49,54,56,82,114,129–130,135,140,151–152,161,169,175 and184. Performance131–134/160 is not business assertion RED and remains failed.

Final guard sequence:194 three collected assertion failures →195 six targeted passes →19659 full Host/UI passes →197 original TypeScript/Vite build pass. Source193 remains historical; Source197 is final partial candidate.
