# W04 final independent Spec / Code Quality review

Reviewer `/root/w00_architecture`; writer `/root/fp06_domain`; branch `codex/hestia-fp06-domain-2026-10-11`; base / observed HEAD `1f2c568ec9db7b6b2895eb2a3b4f37797030dac8`. Product WRITE HOLD was respected. Review is read-only: no tests, builds, profiling / browser jobs, product writes, commits or subagents were started. Only this external report is written.

## Verdict and scope

**SPEC: PASS. CODE QUALITY: PASS**, for the three sealed files implementing the **pure W04 Production/Material proposal contract**. No unresolved blocker was found in that boundary. The two prior draft findings concerning forged adopted NoOp payloads and historical manual-command replay are closed in the actual code and supported by genuine preserved REDs.

| Gate | Result |
|---|---|
| Independent source / code contract review | PASS at final sealed byte hashes below |
| Existing writer TDD / affected regression evidence | PASS, with exact before / after const-capture binding distinguished below |
| Existing final domain TypeScript + Vite build evidence | PASS |
| Reviewer's runtime execution | NOT_RUN, prohibited by the review grant |
| Shared actual World Power + Production + Material adoption / usable UI | NOT_RUN; W09 |
| Common Save / Recovery, offline prevention after actual restore | NOT_RUN; W10 |
| Browser gameplay / end-to-end material and performance | NOT_RUN; W11 |
| Final W04 commit / Git or LFS evidence binding / root package gate | PENDING; commitSha remains null |

These verdicts do not turn unit Host fixtures into actual native geometry, a completed gameplay loop, a combined Save, or a performance acceptance.

## Immutable byte / grant binding

Final seal `/workspace/.cloud-setup/fp06-w04-product-working-hashes.json`: SHA256 **`01bd38888e4dc808c1d1acfc921f5e7a44ccdd36e39b498c8ebee7879f4266d0`**, captured `2026-10-11T13:52:30.894769+00:00`. Patch `fp06-w04-product-working.patch`: **67259 bytes**, SHA256 **`2cd262226ac36464316b18f6cdf4f70c18ff78c5d92fdcde9cdd8a57059b47ed`**. The exact three-path set matches `fp06-task-briefs/w04-grant.json`, base, actor and branch. Initial and final hash checks found no product drift.

Own run `apps/weltraum-browser/evidence/factory/w04/run-20261011T124704Z`; manifest SHA256 **`7654cb46edef96a71211555c7b6d71a530664634a6e5d150d31ede42b5dbe621`**. All **40** referenced artifacts have exact byte length / SHA256; all **14** raw gzip logs decompress losslessly, with exact raw byte counts and digests matching their actual receipts. Manifest receipt metadata (cwd, exit, elapsed and raw / gzip identity) matches every underlying receipt. Product / manifest references agree with the final seal. No historical RED log is rewritten.

| Path relative to apps/weltraum-browser | Final bytes | Final SHA256 |
|---|---:|---|
| `src/factory/production/productionStep.ts` | 29154 | `f74397051a7b2da13d6d183ccf573cb633cb932e915e1ebaf6bf6a50da29c449` |
| `src/factory/production/recipeAdmission.ts` | 12898 | `c77eeaa220cbb491c51356533bdd8f1e6d221f67e9406b458d4a6c06ebac4102` |
| `tests/unit/factory/production.test.ts` | 23542 | `7c31bf5f375af31c3ed0057cda4ce2a87951fff7412506fcab057c0d517769b6` |

Final full check time: `2026-10-11T14:06:26.843395+00:00`. Source / predecessor boundary: full W04 brief, approved `fp06-manual-assembly-admission.md`, FP02 §5 / B05–B07 in §7 / §12, FP01 §6, actual W02 material reserve/finish/commit, actual W03 allocator/grants, and current immutable catalog. Source preflight pins FP02 SHA256 `5c4f068edba3d0c89e77b0d3a40734d4ee1a672c39f3885cbfef31430d942f39` and FP01 `ec3e605de2c6a4877c2ff0afae244b3215e7bf8bb267feef4c466b546477080c`; no new Owner decision, recipe time, material quantity, timer limit, dependency or world authority is adopted.

## Exact state / material / power contract

Line references refer to the final sealed products under `apps/weltraum-browser`.

**One complete authoritative input and candidate pair.**
`production/productionStep.ts:98–108` binds complete current Host / clock / power / command bytes and full native Material bytes in separate closed fields. `recipeAdmission.ts:86–112` validates the frozen catalog including native ResourceCatalog, every actual native container definition/state and exact capacity before using / caching its complete canonical representation. Only derived snapshot summaries are excluded; contents, owner/custody, catalog, revisions, reservations and receipt history remain bound. `productionStep.ts:128–180` compares current full production core and exact confirmed 100000-us interval, session/epoch, monotone net revision, source/catalog digest, current installation and Host facts. There is no UI amount, renderer completion, wall-time clock or alternative Cargo authority.

`stepFactoryProduction` returns a proposed Production/Material pair. `commitFactoryProductionStep:374–379` rejects stale input/base, independently re-evaluates the proposal, compares the complete verified payload and replay proof, and returns the freshly verified pair. It does not mutate another World. W09 must adopt that pair **together with the actual W03 next state and current native Host facts** at one common World CAS boundary; a standalone W04 return does not debit World electricity by itself.

**Actual electrical work.**
`readFactoryProductionRequest:208–223` requests energy only for an admitted unfinished electric process and includes exact machine instance, consumer, job and input-port identities. Missing input/full sinks/invalid machine disable the request. `allocatedWork:225–243` checks the complete canonical power body/digest, current binding, tick interval and next power state, then the exact consumer/device/job/port grant and rational work:

`work.n × 1000000 = allocatedMilliWatt × 100000 × work.d`.

Only full allocated required power with Powered status advances work; zero/unpowered grants produce zero work and mismatched grants reject. The common Host must supply the actual W03 receipt: this pure seam checks its complete bytes and exact work binding, rather than independently proving the native origin of caller-supplied facts. An enabled request cannot silently omit its grant. Disabled/manual consumers may legitimately be absent from the shared allocator receipt, avoiding an invented electric In-port for C05. W03 owns restart/headroom/battery policy; W04 does not duplicate or bypass it.

The frozen CUT profile is 1200 W × 100 ms = 120000 mJ per productive step, **300 steps / 36000 J**. The Former is 2000 W × 100 ms = 200000 mJ, **400 steps / 80000 J**. `recipeAdmission:138–142` validates exact duration/power/work arithmetic. `productionStep:307–323` retains the accumulated integer work, rejects oversupply and completes only at the exact target. No accelerated time, quality factor or null-duration fallback is introduced.

**Native WIP once, whole outputs together, exact capacities.**
`recipeAdmission:143–170` requires distinct installed/input/output/offcut/WIP roles, verifies the actually paid native installation BOM, rejects damaged parts/tool mismatch and source-buffer overcapacity, and binds exact source lot / input port. `productionStep:292–304` creates one recipe-bound W02 reservation and moves actual inputs into native WIP once. Active steps validate the reservation owner, concrete WIP, recipe bytes, output claims, begin receipt and actual exact WIP lots (:182–193); they never re-debit the free input container.

Output and offcut claims are separate actual sinks, and `recipeAdmission:180–184` includes **all** reservations plus the incoming batch when checking each capacity. Source maxima remain Cutter **16/22.5/6 kg**, Former **15/21/6 kg** for input/product/cassette. W02 `resourcesAdapter.ts:17–35` uses integer mg and exact rational source volume, including stack limits, and `reservations.ts:168–187` proves the whole output policy at reservation time. `productionStep:325–335` uses W02's complete atomic finish candidate and records completion only after successful complete product/offcut adoption. W02 `reservations.ts:196–224` checks mass, mixed custody/quality, emits provenance, removes WIP and transfers every output in one unpublished candidate. No partial product or guessed refund is admitted.

WAIT_POWER / WAIT_INPUT / WAIT_OUTPUT / WAIT_WASTE retain old material and existing work. A full sink disables work allocation. A known failed finish keeps WIP and accumulated target work, with no product and no completion receipt; a later valid output retry does not need new work or new inputs. Changed sink capacity between prepare and commit rejects at the full CAS and returns the current unchanged pair.

The **5.75-kg cassette + 0.5-kg new offcut exceeds the actual 6-kg source limit** in the exact capacity calculation; 5.5 + 0.5 fits. This follows the read implementation, not a newly executed test. Present W04 tests directly cover pre-start full product / waste sinks and stale changed output capacity. The exact 5.75/6 boundary and actual live mid-process obstruction are honestly disclosed as remaining integration evidence, not relabeled unit PASS or a new blanket package block.

## Replay closure and prior findings resolved

**Draft forged-NoOp finding: CLOSED.**
Previously the replay could use a receipt prefix while accepting changed base / material / plans / work. Final `ProductionAdoptedPayload:34–45` stores distinct complete closed segments: all remaining proposal fields including base/work/status, full input binding, next authoritative core, complete material candidate, all material plan fields and complete native candidates. `proposalBytes:352–360` produces them. `commitFactoryProductionStep:366–372` requires the same original full authority input, current next-state core/replay and **entire accepted payload**, plus exact current Material candidate. Any changed base, receipt list, plans or work now rejects; the four independent cases at test :145–154 directly cover each dimension. The real preserved `red-noop-four` log shows all four formerly returned NoOp before the fix; the final 175 suite includes these cases. A matching replay returns the existing state/material without consuming energy or material again.

`exactKeys:85–88` checks **own-key cardinality and membership** using Reflect.ownKeys, not joined-name equality or inherited fields. External binding/payload strings are parsed and recanonicalized before trust (:89–126), and next-core/replay consistency is checked (:164–169). The joined-key alias with inherited original values at tests :155–163 genuinely returned NoOp in `red-closed-keys`; it is rejected in the final code and covered by the final suite. Removing derived `lastStep` from authoritative core avoids recursively nesting all earlier replay records while retaining every current authoritative field and full current adopted proof.

**Draft historical manual-command finding: CLOSED.**
Final :260–266 checks an existing command ID's complete bytes before comparing it to the currently active job. Exact old command replay becomes inert; changed old bytes remain an idempotency conflict. Thus JobA's accepted montage/finish can be retried after JobB is laid out without treating the old request as new work, rejecting it merely because JobB is current, consuming inputs, changing JobB's phase or duplicating receipts. Tests :174–188 explicitly exercise both historical Work and Finish after JobB and verify preserved receipts/WIP/material. The preserved `red-safety-five` log shows this case failed before the fix; it is in both the 175 suite and final four-case run.

Command history advances with confirmed World intervals even for inert retries; the accepted command receipt is retained once. This is semantic command idempotence, not a claim that every later repeated intent freezes the entire shared world clock.

## Manual null-time process and walking-away behavior

REC05 retains **durationMs:null / 0 W / 0 J**, its exact 4-kg profiles +2-kg sheet input and 5.8-kg brace +0.2-kg offcut output. `recipeAdmission:129–142` limits manual admission to frozen REC05 on B05; :146–177 requires the paid native C05/B05 installation, intakt basic mechanical tool, confirmed actor/service reach and **actual accessible container revisions**. The input/output IDs cannot point to an arbitrary remote Cargo.

Explicit start/reserve → LAID_OUT (:292–304), separate active montage receipt → ASSEMBLED (:314–317), separate valid finish → atomic product/offcut (:319–335). Finish before Work rejects. Ordinary clock or animation performs no montage and cannot complete a zero-J job. Current active commands recheck recipe, job, actor, paid installation/tool/service and reach; wrong actor, damaged tool and unavailable reach reject with unchanged native WIP.

`passiveManual:276–283` preserves the real job/WIP binding and forbids nonzero electrical work while permitting a confirmed clock to advance when the actor walks away. It does not fabricate a montage receipt. On return, the next active command is freshly admitted. Tests :190–203 check away in both laid-out and assembled phases, no passive output, rejected remote Work and successful valid return. Tests :212–237 check explicit ordered sequence, null-time clock behavior, premature finish and actor/tool/reach rejects. The JSON phase roundtrip proves the data is persistable and revalidated at the pure seam; it **does not** prove common Save or native restore.

No manual minimum time, later automatic 30-s/4-kW profile, extra tool purchase, bolt minigame or Owner freeze is invented. The actual W09 Host must source these facts from the real paid bench/native player/tool/service, rather than copying the explicitly synthetic unit facts.

## Cache and implementation quality

The implementation remains two pure modules using actual W02/W03 contracts; it owns no physics world, renderer, battery, World clock or Cargo store. Local WeakSet/WeakMap entries hold **derived validation or complete bytes**, not mutable amounts. `recipeAdmission:70–82` admits caching only recursively frozen plain-data records / arrays with data descriptors and no symbols; getters, custom prototypes, mutable descendants and new external objects do not gain the identity cache. Catalog reuse requires exact source data and native ResourceCatalog comparison (:84–100); material reuse requires native snapshot/capacity validation (:96–112). Internal cached serializer outputs are immutable and preserve full bytes, so no digest-only comparison replaces the CAS.

`productionStep:83–126,136–170,351–360` caches only complete validated segments / internally generated frozen proposals. External / JSON-restored records take strict own-shape and canonical-byte validation. The native ResourceCatalog displayName mutation test (:205–210) demonstrates rejection instead of trusting an unchanged claimed source canonical string. The earlier real safety RED accepted that mutation before the fix.

The existing recorded V8 profiles explain why redundant nested escaping/re-parsing was replaced by closed canonical segments. No new CPU job was launched by this reviewer. The original 5000-ms timeouts remain historical FAIL evidence and no source tick, quantity, timer or queue cap was changed. Passing unit timing after this representation change is evidence of the actual bounded test result, **not** World/browser performance acceptance.

## Existing executed evidence and final-type-change binding

All commands ran by the writer from `/workspace/Weltraum-Spiel/.worktrees/fp06-domain-2026-10-11/apps/weltraum-browser`; exact argv/cwd/timestamps/product snapshots and lossless raw identity live in the fourteen own-run receipts.

| Receipt / purpose | Actual exit / result | Wrapper seconds |
|---|---|---:|
| red-initial | 1; 7 collected business assertion REDs | 2.538 |
| green-attempt-1 | 1; 4 timeout FAIL /3 PASS | 51.617 |
| profile-before-byte-cache | 1; unchanged T017 timeout,6 skipped | 11.547 |
| green-byte-cache-original-seven | 1; 4 FAIL /3 PASS /5 skipped | 34.292 |
| red-safety-five | 1; 5 collected safety REDs /7 skipped | 3.000 |
| red-noop-four | 1; 4 distinct adopted-payload REDs /11 skipped | 2.699 |
| green-authority-core-fifteen | 1; 4 timeout FAIL /11 PASS | 51.694 |
| profile-authority-core | 1; unchanged T017 timeout,14 skipped | 10.843 |
| green-canonical-segments-fifteen | 0; 15 PASS | 12.484 |
| red-closed-keys | 1; collected joined-key/inherited-data RED /15 skipped | 1.238 |
| green-final-affected | 0; **13 files /175 PASS**,16 production +159 regressions | 35.127 |
| build-final | 1; TS18048 on command capture | 2.779 |
| green-type-narrowing | 0; **4 PASS /12 skipped**, final product bytes | 3.331 |
| build-final-type-fixed | 0; full TypeScript + Vite, final product bytes | 4.338 |

Initial REDs are actual collected assertions (`Rejected` vs expected `Prepared`) before functional implementation; they stop at admission rather than proving downstream output/work conditions at that phase. Later REDs genuinely expose NoOp, history, away-clock, omitted disabled power, native ResourceCatalog mutation and joined-key failures. This separates technical timeout attempts from business REDs.

The 175-test command is:

`npm run test -- tests/unit/factory/production.test.ts tests/unit/factory/material.test.ts tests/unit/factory/catalog.test.ts tests/unit/factory/power.test.ts tests/unit/factory/conveyor.test.ts tests/unit/resourceContainers.test.ts tests/unit/resourceCatalog.test.ts tests/unit/resourceTransfer.test.ts tests/unit/shipPowerAllocation.test.ts tests/unit/shipPowerThermalEvents.test.ts tests/unit/shipPowerThermalDeterminism.test.ts tests/unit/shipPowerThermalStep.test.ts tests/unit/shipPowerValidation.test.ts`.

Raw Vitest duration **34.74 s**, wrapper35.127 s. It ran Step SHA `4fb7d6388ec2c6312beb4f0a31142184de29aefb6a44d39fc416de4493598ecb`,29119 bytes; Admission and Test hashes already equal the final seal. The subsequent build failed because a synchronous lookup callback captured the intentionally mutable `command` variable. The only product change captured its validated `commandId` in one local constant before that lookup. Independent in-memory reversal of precisely those lines yields **exactly** the former29119-byte Step and175-PASS hash; there is no undisclosed runtime diff.

After that sole35-byte type fix, final `f7439705…` bytes ran:

`npm run test -- tests/unit/factory/production.test.ts -t 'historical manual|manual REC05|manual actor|passive manual clock'`

Actual4 PASS /12 skipped, raw2.95 s /wrapper3.331 s, followed by `npm run build`: full TypeScript/Vite PASS, wrapper4.338 s, Vite1.72 s. The unchanged broader suite was not rerun, and this report does not falsely assign its execution to the final hash. The narrow followup is appropriate to the actual const-capture diff.

## Remaining integration evidence / adoption constraints

No code fix is requested by this review. Root may progress to its commit/evidence gate for this exact W04 snapshot. Before calling the complete prototype playable or saveable, W09/W10/W11 must supply their actual gates:

- Real native installation/tool/support/service/actor and source/target access facts; the unit fixtures explicitly remain synthetic.
- One actual Host CAS adopting W03 next electrical state and the complete W04 Material/Production pair, on confirmed six-host-tick steps; no independent material/energy commit or UI-direct finish.
- Actual populated6-kg cassette boundary / output obstruction during an in-flight job, retaining WIP and work without extra allocation; source math is read-verified above but that live scenario has not run here.
- Common Save / recovery of laid-out, assembled, electric WIP and complete receipt bindings with current source/epoch/native fixture and actual reachable controls; no offline work or JSON-only Save claim.
- Actual normal UI loop, browser regressions and performance evidence under unchanged budgets/timeouts.
- Actual final full commit SHA, scoped files and Git/LFS artifact binding. Current report/manifest has null commitSha and grants no push / merge / PR / publication / W12+ work.

The W04 Spec / Quality PASS is limited to this pure contract and its inspected sealed evidence. It does not waive those later dependency gates.

Root delivery copy: only Markdown trailing spaces/final blank lines normalized. Independent original SHA256 `443c43d00902db9107c348fa851c55743ab71f786b2a75c03ca8860693f2e0ea`, 20398 bytes; original remains `/workspace/.cloud-setup/fp06-w04-final-independent-review.md`. Scope, evidence and verdict unchanged.
