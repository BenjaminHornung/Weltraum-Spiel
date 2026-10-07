# Recipe measurement quantum

Status: scoped source implementation checked, real latency FAIL250; overall goal INCOMPLETE.

R57 actual-Cut caller attribution samples356.327ms under the existing borrowed Body-plan helper; clock reads alone sample36.736ms. The current reserved recipe still performs suspension/opt-out timing around every internal scalar yield, even though R54's outer helper synchronously coalesces those yields. This measures generator suspension that does not yield to the event loop.

Reuse the exact existing128-unit/1ms helper before the reserved recipe's relabel/timing loop. Move that same function into a small shared physics module to avoid a rigidRecipe/structuralPlan runtime cycle, re-export it at the old import, and remove the now-redundant outer recipe wrapper. Unreserved and generic recipe yields/timing/observers stay unchanged. All validators, mass/classification/transition/greedy/hash work and parent reserve remain; no new ledger, global cache, deadline or enlarged atomic kernel.

Check existing actual borrowed-plan byte parity and first-recipe-quantum cancellation, unchanged stalled128/elapsed1ms/first-error helper controls, original recipe/trace populations, type/build, and identical normal Body384 cut timing. Source correctness is separate from the250ms/hard8ms/worst-shape/resource acceptance. Current Source117/117 belongs to pre-R58; OriginalOwner65 remains UNKNOWN180 and B1 remains open.

R60 actual-recipe lifetime control RED15/16, with302 scalar live-probe checks against the bounded-quantum ceiling64. GREEN full five files38/38, native71.669s, wrapper72.364s, exact tree release1.945s; type/buildPASS and independent source reviewACCEPT. An initial type plan accidentally encoded files:null and was rejected before Native; retained unchanged, corrected fresh r02 plans encode files:[].

Identical normal Body384→352 removes32 cells/135.9375kg and retains expected child digestc05b830d110a061f. Owner417.0ms, input→Applied512.8ms, input→first committed render531.0ms,2630 outer steps, observed maximum3.1ms. ownerIngest186.4ms, ownerRecipe81.3ms, ownerCommand64.0ms, childCells22.4ms. No isolated performance win, formal42 acceptance or all-shape8ms claim. Raw immutable diagnostic: tests/A03-live-body384-r41/body384-recipe-measurement-quantum-r60.DATA.json.
