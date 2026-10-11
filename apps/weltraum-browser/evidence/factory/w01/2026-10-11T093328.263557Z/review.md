# W01 self-review — independent gate pending

Actor: `/root/fp06_integrator`; branch `codex/hestia-fp06-integrator-2026-10-11`; reviewed predecessor `656c52458eff15133025bb21dc3e5b7b708cfbf7`.

## Spec and contract checks

- FP06-T005: all28 C01–C28 rows independently checked against literal source oracles:2,984,400,000mg and12,450,000,000 packedmm³. Exactly74 identifiable1-piece stacks plus four mg lots and one mm cable lot, all79 unique and bound to the same finite cargo-origin event/owner. SALVAGE-01/equipment absent. The battery is one asset with declared12,960,000J initial energy; no electrical inventory item.
- FP06-T006: cutter208,000,000mg, former341,000,000mg, crusher499,000,000mg; each complete BOM retains exactly its own finite chassis. Declared layoutA/B totals3500/6600W and two/three four-metre lines are data, never already installed worldobjects. The sole initial inventory is the existing immutable ResourcesContainerState.
- FP06-T007:250mm placement and125mm actual HVP source remain separate; limestone2400kg/m³ and unapproved prototype-tuning provenance preserved; eight cells37.5kg. Versioned east→x/north→z/height→y is explicit and backed by actual positive-z northern coast/vegetation conventions. Material ports keep source750×750mm/1000mm height; sourceB07 OUT-PROFILE-OR-SHEET name retained. Unfixed POWER/internal geometry is null, not invented coordinates. B09 has one200kg storagebuffer, not independent200kg in/out duplicates; all unspecified source interior volumes are null.
- FP06-T008: the loader compares the COMPLETE canonical v1 normative bytes before constructing a Resources catalog. Unknown recipeversions, changed same-ID data, mapping collisions, altered sourceSHA256, unsafe/fractional quantities, absent/changed volumeprofiles and added Authorityfields reject. Canonical keyreordering produces identical bytes/digests. FNV1a is labelled a noncryptographic signature; actual pinned documentSHA256 hashes stay separate. Definition/version/digest/sourceID survive the explicit save-safe mapping and each stack provenance extension.
- All7 recipe mass equations checked. R05 manual tooltime remains null/unspecified with0 factory-network work; its later30s/4kW variant and R06 are explicitly planned. R07 produces a passive module and cannot mint an electric drive. Unknown Rock/Gravel profiles have Item/Recipe refs but are absent from transfer-admissible nativeResourceDefinitions.
- Known cargo volume is exact wholemm³ per sourceposition with rational partialquantity profiles (5/8,9/4,4/3,15/4 mm³/mg). Loader validates the wholeorigin relation with integer crossmultiplication. Technical derived envelopes: semi/offcut9/4 mm³/mg, brace13,050,000mm³/piece; drive20,000,000mm³/piece=6,750,000 profiles+7,500,000 machinecore+2,000,000 controller+3,750,000 harness. These are explicitly conservative capacity policies, not solid densities. Exact rational capacity comparison for runtime transfers belongs to W02.

## Actual verification

Initial RED:7/7 runtime Fachtests failed because the scaffold did not implement the catalog/fixture. Imports resolved. Second RED after implementing positive data:5PASS/2FAIL; unknown Recipeversion and extra Authorityfield were erroneously admitted, giving a behavioral sourcebinding failure. Complete canonicalbyte admission corrected this. `red.txt` and `red-source-binding.txt` retain actual outputs.

Final `npm --prefix apps/weltraum-browser run test -- tests/unit/factory/catalog.test.ts tests/unit/resourceCatalog.test.ts tests/unit/resourceContainers.test.ts tests/unit/resourceTransfer.test.ts`:4files/45tests PASS (11 W01+34 existingResource tests), exit0, `verified-green-resource-regressions.txt`.

Final `npm --prefix apps/weltraum-browser run build`:PASS, exit0, `verified-build.txt`. Earlier build found the intentionally malformed testLiteralversion typing; `build.txt` preserves this corrected failure. Baseline largebundle warning remains. No dependency/config/timeout changes.

Actual pure catalog snapshots were loaded through a middleware-only Vite SSR server with HMR/watch disabled, no listening player server: `catalog-oracles.json` and `cargo-state.json`. `git diff --check` over product paths: exit0. Raw tool logs also contain pre-existing reporter whitespace; readable .txt copies strip only trailing whitespace, while .txt.raw.gz preserves original bytes. The final staged diff check covers all evidence and product files. No UI/render changes, so screenshots/browsergameplay were not run or claimed in W01. Fullsuite and downstream gates remain their respective packages.

## Scope and remaining gates

Only the five grantedproductpaths and this unique W01 evidence directory changed. No existing Host/Physics/Save/Resources core/UI/config modified; no pushes, main merges, PRs or publication. No W12–W29 work.

Independent review is PENDING, so this self-review does not release downstream writers. B09/source machineinterior capacity and POWER/internalport geometry remain honestly unspecified; later physical binding must define conservative usable geometrical envelopes before real admission. Rock/Gravel remain inadmissible absent a sourcevolume profile; W02 T009 must use an explicitly synthetic isolated testprofile. W03 restartpolicy is outside W01. No Owner visual/gameplay/performance acceptance is claimed.
