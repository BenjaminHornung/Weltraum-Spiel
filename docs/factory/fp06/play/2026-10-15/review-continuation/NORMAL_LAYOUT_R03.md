# Normal layout R03 — transport clearance, 2026-10-17

R04 repeated six paid installations and both paid Battery-to-Former/Distributor links with unchanged 2984400000 mg. It reached tick 28461 (474.35 seconds of confirmed Native time), no SimulationHold, no recovery/resume attempt, max observed worker callback gap 54.8 ms. Ordinary Read samples after Cutter: 62 samples, median 3.1 ms, range 2.2–4.8 ms. R03 before NATIVE_READ_R01 had 22 same-six-installation/two-link phase samples, median 10.2 ms, range 8.7–13.1 ms. These are observed phase samples, not matched repeated trials, per-frame FPS or a claim that external scheduling delay is eliminated.

The transport now exposes a separate physical problem: trying the 26-kg BELT4 at actor z=11.4399967 and z=8.4899836 stops westward movement at x about -8.74, with actual `CarrierOverlap` for target x about -8.79. No Hold, material change or collider change occurs. The proposed west detour is rejected as an actual verified route. Between Cutter's east bound x=-6250 and Distributor's west bound x=-5250, the other passage is exactly 1000 mm, the transported hull's unchanged width. That leaves no usable ordinary steering margin.

The next bounded layout candidate moves only Distributor's default center from [-4750,1500,5250] to [-4500,1500,5500], retaining q1 and all dimensions/support/collision geometry. The passage becomes 1250 mm; a 1000-mm hull then has 250 mm of total steering margin. This affects future ordinary placement only; it does not move an installed object or rewrite an existing save.

Existing Native ports in R04: Battery [-1750,2500,2500], Distributor [-4250,2500,5250], Former [-5875,2625,-1750], Cutter [-6375,2625,5750]. New Distributor port is [-4000,2500,5500]. Existing cable rule rounds axis-aligned xyz run upward to 250 mm. Planned q1 belt power ports at raw-belt center [-7250,1500,8500] and middle-belt center [-7250,1500,1500] are [-6875,2250,10250] and [-6875,2250,3250].

Required closed splits of the same finite 40-m C07 cargo: Battery→Former 8500, Battery→Distributor 5250, Distributor→Cutter 2750, Distributor→raw belt 8000, Distributor→middle belt 5500 mm. Total 30000 mm, remaining 10000 mm. All except 5500 already exist. Add exactly CABLE5500 and its UI label using the existing light cable job mechanism; no new resource or asset package. Existing historical profiles/digests remain unchanged; the new split has its own explicit source version. The earlier R01 sum of 29750 was arithmetic error: the earlier five planned lengths sum to 29500, not 29750. Preserve that old record and use this correction.

Scope: factoryEntry.ts default Distributor x/z, cargoHandlingProfile.ts one closed cable split, itemVisuals.ts its label, focused existing profile/UI tests. No Native/Clock/timeout/terrain/collider/resource-balance/old-Golden changes. Root sole integrator, second writer owns only these disjoint paths; W10 writer stays on pure persistence.

Acceptance: focused profile/label checks and exact diff review after source quiescence, normal build, then fresh normal play proving the wider passage, both paid belts, all five paid links, full paid build and fresh 16-kg flow. R04 remains a preserved failed transport route and no Save/restart acceptance. At most two Distributor layout candidates used: R01 and this R03; ProductStorage R02 addresses its independent blocked pose.

Status: measured geometric decision before source change; candidate acceptance pending.

## Actual rejection and rollback, 2026-10-17

R05 ordinary paid pickup/haul/deposit installed only Battery and deposited the original 25-kg Distributor BOM. The actual preview at [-4500,1500,5500], q1 rejected SUPPORT_MISSING after the player left its hull; Confirm remained disabled. An earlier eastward carried step also returned CarrierSupport. Final Native tick 2918, Paused, material 2984400000 mg, no SimulationHold, no Resume, no TestBridge. The extra width is not supported by the actual terrain. R03 is REJECTED, not a playable layout.

The second writer archived its exact R03 patch/failure note and removed only that patch. Accepted R01 Distributor [-4750,1500,5250], R02 ProductStorage [-7250,1500,-5500] and v4 CABLE2750/CABLE8500 remain. CABLE5500/v5, its label and its new test are removed; historical profiles and other writers' work remain. Full R05 report and screenshot 13 are in the evidence directory. Source tests/build before the play attempt did not establish placement acceptance.

A further unimplemented west-axis proposal was rejected by source inspection: Former southwest foot X[-9000,-8500], Z[-4500,-4000] would extend outside every V1-V5 flat support mask for X[-9000,-8750). It is not granted or written. No new layout/terrain/cable candidate follows from that proposal.
