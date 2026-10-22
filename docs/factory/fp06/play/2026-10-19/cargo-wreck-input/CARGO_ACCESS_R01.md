# Cargo access R01

Current HEAD remains `7ee85b0e0e3dedc5a41c3ccf98b3fe92b64f846e`; preserve all newer local work and Ready-v4's hardware-accepted raw mouse input.

The user reports severe lag, inaccessible Cargo while pointer locked, and a glitching box instead of the expected crash ship. These are separate observed problems. This small UI grant fixes Cargo entry first while the other causes are examined.

## Confirmed behavior and chosen interaction

The existing shell has B/M/Esc only. A Running-only View cargo button cannot be clicked while the mouse is captured. Today the usable path is Esc -> Open workshop -> Cargo -> Open cargo.

Add I as the inventory/Cargo-screen shortcut alongside B and M. Add E while Playing only when the same fresh confirmed Ready interaction exposes reachable cargo or an existing handled load. E opens the existing Cargo/transport panel, without executing a material/open-cargo command. The player can then use its existing Open cargo button with a free cursor. Reachability still means existing Native distance <=4m, LOS, support and clearance; no new aim/raycast claim is made.

Use existing openSurface -> host.setSurface -> pauseForFactoryFocus. Held input is cleared and pointer lock released immediately; the existing Pause acknowledgement remains mandatory. Close remains Paused and only explicit Play resumes. Typing, key-repeat, modifiers, stale binding, start/hold and transaction guards remain effective. Correct both HUD keyhint literals and Field Guide's contradictory E statement; refresh existing Entry interaction text to match.

No new stored representation, schema, Clock policy, interaction distance, Native command, resources, collider, renderer or asset changes in this grant.

## Lease and validation

Only `/root/fp06_ui_writer` may edit:

- `apps/weltraum-browser/src/factory/ui/factoryShell.ts`
- `apps/weltraum-browser/src/factory/factoryEntry.ts` (existing interaction hint literals only)
- `apps/weltraum-browser/tests/unit/factory/factoryShell.test.ts`

Root remains the sole runtime integrator. No other product writer may touch these paths. Existing shell tests must prove reachable E/handling and general I opening the same panel, inaccessible E doing nothing, no material commands, repeat/typing/stale guards, preservation across Pause acknowledgement and Close without resume. Reuse the existing bootstrap modal/input test instead of adding another large mock. Run full shell tests, TSC and whitespace checks. Independent source review and actual Chrome E/I -> free cursor -> Cargo actions -> Close/Pause -> explicit Play are required before acceptance. Preserve raw input source SHA `5E0A00047EC60149D79D66B1C59E1382C43DE9AD41BCABACC4456C7DD59D6A1E`.

## Other findings, not authorized by this UI lease

- Hybrid-v2 GLB exists but is explicitly NOT_ADMITTED/OWNER_REVIEW_PENDING; 15.125m hull is not a replacement for the 1.5m Cargo-access witness. An actual integration decision is still required.
- Current Cargo-model palettes have exact coplanar front faces. A targeted two-model visual revision is being considered; original exports/Goldens, Native bounds and strict hashes must remain intact.
- Chrome uses the actual AMD RX7900XTX D3D11 WebGL path, not a software fallback. A root automation Play attempt currently reproduced WrongDocumentError before Running; it is a separate failure from measured simulation lag. No new CPU/GPU profile or fourth candidate in the historically closed performance window is implied.

Progress: UI source and independent final source review PASS. All25 existing/extended Shell cases, TypeScript and scoped whitespace checks pass. A review finding about cached Playing state was fixed with fresh `port.read().phase`; the regression proves a later Paused state does not let E open the panel. Actual external-Chrome E/I, free cursor, Open cargo, Close-without-resume and explicit Play remain pending. The raw-pointer behavior is preserved by the separately reviewed one-line backpressure fix.
