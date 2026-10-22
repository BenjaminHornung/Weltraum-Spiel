Additional read-only Pi review, same approved DeepSeek advisor, 18 October2026. Root closed the final binding link independently: hvpBootstrap.ts:2675 freezes hostPort with the literal local read function; line2361 assigns the same function to readFactoryView. No wrapper publication occurs on host.read.

**No concrete defect found in the plan.** Source purity and negative cases check out; one link I could not close in this window is listed at the end.

Purity of the read (the basis for the temporary `commandBusy=false`):
1. `read()` (`hvpBootstrap.ts:2338-2351`) only reads: `current()`, `terrainRoot.read()`, `physics!.read()`, `confirmed()`, `factorySaveAvailable()`, `factoryContinueAvailable()`, `factoryRecoveryAvailable()`, `factoryPausePending()`. No writes, no await, no `factoryListeners` iteration.
2. Notification is separate, as you stated: `publishFactoryView` (`:2354-2360`) does `syncCarrierProjection()` → `read()` → `for (const listener of factoryListeners)` → `syncInstalledProjection()`. `readFactoryView = read` (`:2361`) never notifies.
3. `factorySaveAvailable()` internally uses `confirmed(true)` (`:2328`, `:1931` `ignoreFactory` branch), so the temporary flip cannot make Save appear available — save admission already ignores `factoryBlocked()`.
4. Everything else in `isQuiescent()` (`factorySession.ts:738`) stays enforced during the window: `disposed`, `captureBarrier`, `recoveryBusy`, `view.state!=="RecoveryHold"`, `construction.busy`, `handling.busy`. Only the self-inflicted `commandBusy` term changes, which is exactly why unrelated hidden Host holds remain enforced.

Negative cases that must still reject, and do under this shape:
1. Genuinely unconfirmed pre-command header → `:431` `StaleOrBusyCommand`, unaffected (the flip must not be used there).
2. Non-Idle facilities / unconfirmed or inaccessible socket / digest-revision mismatch → still rejected by `controlOwner` (`:356-359`), unchanged.
3. `sessionId`/`epoch` drift or `command.expected !== uiBinding()` → `:459` `StaleDeviceControlBinding`, and `uiBinding()` takes its own fresh `host.read()`.
4. `view.state==="RecoveryHold"` → `:429`.
5. Legacy pause-window drift: a pause ACK that advances `facilities.revision` or `terrain.revision` legitimately rejects via `:459` — same class as `connect-power`'s `StaleCableCommandAfterPause`. Safe direction (reject, not accept).

Strictest implementation condition (not a defect, but the only way this stays safe): the window must contain **exactly** the single `host.read()` expression — set `commandBusy=false`, read, restore `true` in `finally`, with no `reconcile()`, no `notifyUi()`, no `await`, and no `finish()` inside it. If the writer instead clears the flag around the whole post-pause block, `:461` `setDomainEnabled` and `finish()`→`notifyUi()` would run quiescent, letting a UI listener observe a confirmed, idle session mid-command. Verify that in the diff.

Unverified link (assert, don't assume): I confirmed `readFactoryView = read` (`:2361`) and its use in `factoryCanResume` (`:810`), but not the literal `read:` binding inside the host-port object that `factorySession` calls; my grep pattern missed it because the key has no space before the value. Confirm `host.read()` resolves to `readFactoryView!()` in that object literal before the patch lands.

Next: have the writer paste the final `set-enabled` branch so the three window boundaries (set → single read → `finally` restore) can be checked literally.
