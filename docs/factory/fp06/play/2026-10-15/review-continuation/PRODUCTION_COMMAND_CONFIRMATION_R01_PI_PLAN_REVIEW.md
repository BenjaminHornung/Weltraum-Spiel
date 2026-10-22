Read-only additional advisor: Pi / opencode-go/deepseek-v4.1-flash, agent eb04a70c-fd51-4110-b1e4-480d5c08d8ab, 18 October 2026. Advisory only; Root retains decisions and acceptance.

**Confirmed, same root cause.** `controlOwner` (`factorySession.ts:356`) gates on `native.confirmed`, and `set-enabled` (`:457`) sets `commandBusy=true` at `:432` **before** `await host.pause()`. After that await, `host.read().confirmed` is false by construction: `hvpBootstrap.ts:2345` → `confirmed()` `:1931` → `factoryBlocked()` `:807` → `isQuiescent()` `:738` → `!commandBusy`. So `controlOwner` returns null → `:460` throws `NativeDeviceControlUnavailable`. `host.pause()` does return a fresh post-pause view (`hvpBootstrap.ts:2840-2843`), but it is discarded at `:457` and would carry the same `confirmed:false`.

**Do not change the global gates.** Reject these three non-fixes: relaxing `isQuiescent` (would let capture/end-session run during a command), relaxing Bootstrap `confirmed()` (weakened admission everywhere), or passing `admittedHeader` as the value after an await (stale).

Smallest correction (one file, `factorySession.ts`):

1. Split `:354-363` into `controlOwnerProof(id,native,facilities)` = the current body **minus** `!native.confirmed`, and `controlOwner(...)` = `proof && native.confirmed ? proof : null`. `readUi` (`:368`, `:416`) and `readPresentation` stay byte-identical.
2. At `:458` use `controlOwnerProof`, keeping the **fresh** `native=host.read()` / `facilities=host.handling?.read()` taken after the pause.
3. Keep `:459` unchanged (`sessionId`/`epoch` + `command.expected===uiBinding()`); note `uiBinding()` (`:352`) already does its own current `host.read()`, so this is a live binding check.
4. Add the two post-pause checks the pause actually guarantees: `native.physicsStatus==="Paused"` (pause awaited the native ACK and the published view) and the existing `facilities.state==="Idle"` + `socket.confirmed===true` + `socket.accessible===true` + digest/revision/centerMm/quarterTurns equality already in the proof.
5. Add the no-drift bound using the pre-command header only as a **comparison**, never as a value source: require `admittedHeader.nativeTick===native.nativeTick && admittedHeader.terrain.revision===native.terrain.revision`. Any Native advance during the pause then rejects with `StaleDeviceControlBinding` instead of silently accepting.

Preserved by construction: `commandBusy=true` at `:432` and its release in `finally` `:538`; `:430`/`:431` still reject busy/unconfirmed before the flag is set; `:460` revision check, `:461` `lastPower=undefined`, `finish(...)`/`history.accept` idempotency, no new await, no host-port or schema change.

Affected callers: only the `set-enabled` branch. `start`/`manual-*` need the separate `factsFor` parameter fix; `connect-power` (`:464-469`) already uses a post-pause facility proof (`admitted(p)`) and never reads `native.confirmed` — that is the precedent to copy. `connect-belt` is pre-await and uses `admittedHeader` legitimately.

Test expectations: add one focused case where the fixture host derives `confirmed` from the session's own quiescence (so it flips false during `commandBusy`) and assert `set-enabled` commits and the toggle persists; RED controls that must still reject — genuinely unconfirmed pre-command header (`StaleOrBusyCommand` at `:431`), non-Idle facilities or unconfirmed socket (`NativeDeviceControlUnavailable`), and a `nativeTick` bump during the pause (`StaleDeviceControlBinding`).

Residual risk: if `pause()` ever resolves before the paused view is published, requiring `physicsStatus==="Paused"` becomes flaky — check that the toggle test asserts a Paused view, or fall back to `["Running","Paused"]` as the host itself does.

Next: have the planner diff `controlOwner` into proof+gate and confirm `readUi` output is unchanged for a blocked host.
