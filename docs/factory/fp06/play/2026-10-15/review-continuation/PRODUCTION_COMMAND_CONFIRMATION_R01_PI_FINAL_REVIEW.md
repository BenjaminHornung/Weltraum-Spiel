Additional read-only Pi review, same approved DeepSeek advisor, 18 October2026. Earlier test-only finding is retained in advisor history and withdrawn below after checking finish->uiBinding. Root full82 tests and TSC pass; actual R15 toggle disables/enables now commit. The distinct InvalidBeltStepCursor failure is preserved separately and is not passed production acceptance.

**Finding withdrawn — you are right.** `finish` (`factorySession.ts:426`) builds the receipt with `binding:uiBinding()` unconditionally, before `history.accept`/`notifyUi`. That call defaults to `host.read()` (`uiBinding(native:FactoryHostView=host.read())`, `:352`), and it runs in the catch path **after** the inner `finally{commandBusy=true}` and **before** the outer `finally{commandBusy=false}` at `:544`. So the recorded order is:

`… uiBinding@:430 → true`, `admittedHeader@:431 → true`, `fresh read with flag false → true` (throws), `finish→uiBinding → false` ⇒ `slice(-2) === [true,false]`, exactly as the test asserts and independently of any listener. My earlier derivation stopped at `notifyUi()` and missed the receipt binding.

Hash matches the frozen artifact: `factorySession.ts` SHA256 = `FA80A39F4A4829207377EFA4C39918C35DC80FC3A9606E1E102A5035BC7E4AFF`.

Reviewed state: product branch (busy across await, single flipped fresh read, inner `finally` restore, fresh `current`/session/epoch/`Paused`/`confirmed`/`binding` + unchanged `controlOwner`), `factsFor(…,hostView=host.read())` with `admittedHeader` at the start/manual call site, `uiBinding(native)` single-read, three regression tests. No defects.

One non-actionable observation: the `[true,false]` pair relies on there being no `session.ui.subscribe` in that test, since the outer `finally{commandBusy=false;notifyUi()}` would append a `true` read through `readUi()` if listeners existed. It is correct as written and the writer's 82/82 confirms it; a future addition of a listener there would need the assertion re-anchored, not the product changed.

Omitted runtime by me: no tests, TSC, build, or browser — your 82/82, 47.76 s, and TSC PASS are the evidence.
