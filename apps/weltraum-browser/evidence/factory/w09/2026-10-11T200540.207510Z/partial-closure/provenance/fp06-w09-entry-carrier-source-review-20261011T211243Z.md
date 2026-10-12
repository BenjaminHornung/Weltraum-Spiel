# W09 mutable Entry/Carrier source observation

Read-only Integrator WT `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`, actual HEAD `aeb6680044eb455a10d0bba6e67979c153fd248f`. **Draft findings only; no source/quality/gameplay/package gate.** No tests/build/browser/Native/profiling or product/evidence edits. Native Deposit→Install48 correction is separate ongoing work.

Source reads started2026-10-11T21:08:54.379597Z and ended21:12:43.712316Z. Four directly reviewed Entry/presentation/protocol files were byte-identical at both readings:

|Path under apps/weltraum-browser|Bytes|Start=End SHA256|
|---|---:|---|
|src/hvp/hvpBootstrap.ts|171356|dd35de2527e1883627a061a0179051f6233f23347e184e3f21430b783c18906d|
|src/factory/presentation/factoryAssets.ts|12189|c80339580cc87b038c8a82e2d9e10981f8c125dc40b2a174248616d55daa487c|
|src/factory/factoryEntry.ts|10993|d110bbe6877d5796660cde4630ace45f04bef4457feebe149c00749d8bf6db8a|
|src/factory/session/hostPort.ts|9550|e84d17ea0b2f07db1d6e1427b4d7009ffde8f4588daa414b5a0bf206cdf5393a|

Supporting `dryFactorySlice.ts` was actively modified:12313B/startSHA `4b374d95ab02967fe930f5c411e74e17249a6a66ddc12ad2c30bc282916a7f46`→17318B/endSHA `9c26d01b8ea87d2bf65dbc5c5ec88092f4cde4d7c8f6e14509025c0a4577b92d`; not an immutable multi-file candidate. End-only supporting bindings: factorySession13935B/`98cdb8d21de71c17fcf61c3431fd19b8258ee8e16f60a1f7c76e601dab01e4f2`; cargoHandling13892B/`b5c4e663c2c0796d65b86e2af9c2bc4d403a710fd37d180f9403be10cb293018`; native factoryFacilitySession45123B/`f0ac243f62c2801209edd6844a6965b5fdfb0ce5153997187505ce64428bcfb3`.

## Concrete findings sent immediately to Root/Integrator

**C1 — unproved hidden Carrier retirement can escape as Ready/Rejected.** Bootstrap2226–2232 stages accepted meshes/material leases in a local scene; its catch directly calls dropFactoryScene. If a later Upsert fails and retirement of an earlier accepted representation also rejects, plain `Factory retire` escapes and scene identity was never assigned to carrierScene. prepare catch2271–2272 can successfully rollback Native, delete costs and rethrow that plain failure. cargoHandling114/119–120 has prepared=false because prepare never returned, then treats it as ordinary Ready/Rejected. Renderer rollback remains unproved. Preserve teardown identity and propagate terminal RecoveryHold for failed retirement; retain a meaningful accepted-first-Upsert/later-Upsert-reject/Remove-reject countercase. This is a code-path counterexample, not an executed browser failure.

**C2 — temporary Native membership capture lacks Carrier cost allowance.** Pickup2270 admits only five mesh copies plus materialBinding characters. Native prepareCarrier310/326 additionally retains members(world): per-body/per-collider canonical strings/maps for existing World membership; deposit/release also capture members. Facility prepare2244 already reserves explicit collision/count overhead for comparable work. The Carrier estimate does not include that added capture. A conservative existing-contract allowance before allocation is required to substantiate unchanged CPU caps. No measured cap exceedance or new cap/Owner policy is claimed.

## Admission observations and present limits

Entry mounts/disposes all four panels, projects Host snapshots and unsubscribes on close. Build keys refuse focused panels and text/select controls. Bootstrap1364–1366 includes panel focus in existing player-input isBlocked; setPanelFocus2280 delegates stop/held-input neutralization. Closing never automatically resumes/relocks. Actual held-input/browser focus behavior was not executed.

Carrier vertices derive from the matching immutable CargoHandlingProfile digest; five boxes correspond to Native carrierBoxes (payload plus four supports), fixedq1 frame and published Native positionMm. Projection changes transforms, not material or Native pose. Native read has profileDigest, not a separate SourceGeometryDigest field; no such independently observed receipt is invented. Hidden keys precede Upsert, material leases are tracked, slot revisions increase safely, normal retirement deletes scene cost and leases. C1 limits failure-path cleanup admission; no new100-cycle lifecycle proof is inferred from W05.

B05/B09/brace are explicit technical S0 proxies with catalog/source bindings and connected body/support boxes; brace geometry is a declared1m-family proxy, not final Art/structural acceptance. No terrain mask/material credit or renderer inventory authority observed.

At the factorySession read, public machines were empty, power unsupported/UNCONNECTED, technology list contained only two entries and submit admitted only open/pickup/deposit/return/transfer. Production/recipe/manual/power/belt UI adoption and complete technology population were still absent. These are mutable implementation seams, not a final defect verdict or complete normal W09 flow. Source-only observations do not substitute for the pending native/material/paid flow, sealed candidate and actual tests.
