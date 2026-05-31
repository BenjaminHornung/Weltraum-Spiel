# Test Protocol: DirectFastTransfer Execution Smoothness

## Planned Evidence

- `tests/logs/editmode-results.xml`: focused Unity EditMode results.
- `tests/logs/playmode-results.xml`: focused Unity PlayMode results.
- `tests/logs/direct-fast-transfer-smoothness-trace.csv`: representative phase/throttle/replan trace.
- `tests/screenshots/direct-fast-transfer-burn.png`: burn phase evidence if visual capture is available.
- `tests/screenshots/direct-fast-transfer-brake.png`: brake phase evidence if visual capture is available.
- `tests/screenshots/direct-fast-transfer-hold.png`: hold phase evidence if visual capture is available.

## Captured Evidence

- `tests/logs/editmode-results.xml`: Unity MCP focused EditMode run `aebf76a96323462e9fc5f218c657b2c3`, 8/8 passed.
- `tests/logs/playmode-results.xml`: Unity MCP focused PlayMode run `5a50860df3504352a0646a3ccecbb5a4`, 7/7 passed.
- `tests/logs/direct-fast-transfer-smoothness-trace.csv`: summary trace metrics from the focused PlayMode smoothness assertions.
- Phase screenshots were not captured because the MCP verification runs return to the test scene after completion; no reliable burn/brake/hold viewport was left to capture.

## Acceptance Checks

- One nominal DirectFastTransfer plan revision through burn, flip, and brake.
- No `Replan:` status for soft tracking correction.
- No main throttle samples below 0.95 during latched full burn.
- No main throttle samples below 0.95 during latched full brake before the brake-end envelope.
- Hard invalid direction still requests replan/abort.
