# Normal layout and closed cable jobs v4

Decision 17 October 2026; existing V5 terrain and every old profile stay intact.
Real normal-input runs R01/R02 paid for Battery, Distributor, Former, Workbench
and Cutter in one scene with 2,984,400,000 mg retained, Native Idle and no Hold.
The original Distributor default overlaps Battery. The proven replacement is
[-4750,1500,5250], quarterTurns 1; all other machine defaults remain unchanged.

The confirmed sockets give a five-link tree: Battery→Distributor 5250 mm,
Distributor→Cutter 2750 mm, Distributor→raw belt 8000 mm,
Distributor→middle belt 5000 mm, Battery→Former 8500 mm. Total 29,750 mm from
the finite 40,000 mm supply. Actual reach/LOS and paid connection still require
normal-play verification; geometric distances alone are not acceptance.

Reuse was checked first. In the real R02 scene a whole CABLE40 transport reaches
the Cutter input but its normal whole-load action is disabled by material
admission. The cable occupies 120,000,000 mm3; Cutter input is 18,000,000 mm3,
Former input 16,875,000 mm3. In particular an 8500-mm cable occupies 25,500,000
mm3 and cannot enter either input unchanged. No buffer/collider enlargement or
partial Native custody transfer is authorized. Large payloads may also be
blocked by the completed Cutter; build order and ordinary storage remain part
of actual gameplay, not a reason to weaken collision.

Smallest extension: add exactly TWO closed jobs to the existing job table,
CABLE2750 and CABLE8500, with new sourceRef
fp06-technical-s0-closed-native-socket-cable-jobs-v4. Keep all nine historical
jobs, CABLE40, their canonical bytes/digests and all old sourceRefs. New jobs
use the same existing light closed-job transport envelope and exact catalog
mass/packed-volume calculations. No caller-sized body or general length parser.
Enumeration already uses the closed table; current exact deposited-custody,
paid material, release/rollback, reach/LOS and stale-binding checks all remain.
Display these jobs and the three already exposed raw CABLE IDs in metres.

Writer scope: cargoHandlingProfile.ts, itemVisuals.ts, factoryEntry.ts default,
and their focused existing tests only. Verify historical digests unchanged,
new exact terms/mass/volume, malformed IDs still rejected, existing handling
release/rollback and UI labels. No old Golden rewrite. Parent alone integrates
and plays the full build, wiring and fresh production from a fixed build.

## Explicit correction after real R03 input observation

The earlier 16,875,000 mm3 Former-input figure above was mistaken: it describes
WIP, not input. Authoritative B07 catalog input is 15,000,000 mg, giving an
existing input capacity of 33,750,000 mm3. CABLE40 still cannot fit; CABLE8500
DOES fit. The normal UI admits whole transfer into Former input, avoiding its
ground package obstructing player access/LOS. Use that existing path before
adding any new re-pickup API. CABLE8500 remains a new exact transport length
(historical largest job is 8000); no capacity, partial Native custody, geometry
or historical profile is changed. This correction supersedes only the mistaken
input-volume/reuse assertion; all failed-attempt evidence remains intact.

Further catalog correction: B06 input is 16,000,000 mg / 36,000,000 mm3.
The earlier 18,000,000 figure also referred to WIP (8 kg), not input. CABLE40
still exceeds both real inputs; both do admit an 8500-mm whole cable package.
R03 actually transferred CABLE8500 whole to Former input, then paid the 8500-mm
Battery→Former link from that ordinary stack. After a normal 5250-mm package,
Battery→Distributor also committed and released custody. Total material remains
2,984,400,000 mg. These are actual link results, not geometric predictions.
