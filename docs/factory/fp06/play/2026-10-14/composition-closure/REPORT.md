# FP06 continuation — 14 October 2026

**Overall BLOCKED. No product candidate or new write window opened.**

Actual code base: `a89c1991aa148ff77d001d204de6a3e56fda13ef`, branch
`codex/hestia-fp06-play-candidate-2026-10-12`. Fresh remote main remains
`e40592c113b72a8dc93725187f92cf948e07f44d`; it was not substituted for the
local implementation. All 33 handoff entries again pass size/SHA verification.
The original paid-band block remains 15,736 bytes with SHA-256
`a16258decde43993c5b6bc6c41248ef6e34294a86572bca2f108eb64c6ae8223`.

Root performed diagnosis and wrote only new docs/evidence. The actual agent
`/root/composition_contract_readonly` independently reviewed source and the
proposed contract, without tests, writes or profiling. No concurrent product
writer, main merge, push, publication, dependency change, W12–W29 work, recipe,
Save, terrain, Physics, authority or budget change.

| Check | Actual result |
|---|---|
| Original output-blockage test | FAIL: 5,000 ms limit unchanged; test phase 14.27 s, one failed / 39 explicitly filtered tests |
| Separate V8 attribution run | FAIL gate, 20.91 s test phase; profiling is not a performance acceptance run |
| Current TypeScript / Vite build | PASS; existing chunk warning retained |
| Cold development entry | FAIL initialization within existing 20 s helper wait; no Factory UI or Native state reached |
| Regular production entry / ordinary inputs | Ready, 14 commands completed, including actual 341 kg pickup; FAIL on first loaded move |
| Current native heavy route | SimulationHold at tick 324; no teleport, pose injection, collider change or new installation |
| Material custody at stop | Cargo 2,643,400,000 mg + carrier 341,000,000 mg = 2,984,400,000 mg; seven carried stacks retained |
| TestBridge / browser errors | TestBridge absent, production browser errors empty |
| Owned-data candidate / new tests | NOT_RUN, OWNER_REVIEW_PENDING |

Production used the exact previously committed driver (SHA-256
`f202f85319cd15733e9183066e54e91fc610cfb61a9daaa09cca5be54ec76ea6`),
same command file and existing 5 s ACK/neutral/new-tick waits. It ran at
1280×720 on Chromium 154.0.8037.57, software Mesa/llvmpipe, LP_NUM_THREADS=1,
Xeon Platinum 8573C, four-CPU cgroup quota. Actual first loaded target was
z=12.175; player remained at x≈−5.85, z=11.875. The successful pickup is not
the complete transport/depot/exit/native installation proof. The development
startup failure is separate from the production entry's successful startup.

## Attribution and scope exception

The V8 runner and test-worker profiles are separate processes and are not
added. In the test worker: canonical serializer self time ≈5.80 s,
structuredClone ≈5.69 s, Dry's local serializer ≈2.77 s. Inclusive material
snapshot validation is ≈1.60 s and overlaps other measurements. Samples under
advanceBand assign ≈4.78 s of clone work to prepareDryFactoryStep, ≈0.45 s
to the local serializer and ≈0.25 s to state-core serialization. These are
profiled samples, not unprofiled wall-time predictions or browser FPS.

The existing defensive clone excludes nested Proxies. Removing it or trusting
Object.isFrozen does not preserve that contract. The independent analysis
identifies a possible private fresh-allocation/child-proof seam across
W04/W08/W09, with external/restored/mutable results retaining full validation.
Its speedup has not been implemented or established.

Root collected today's additional read-only profile before fully re-reading
the old closed C1 budget. This was outside that profiling allowance and is
explicitly retained as a scope exception. It is not an authorized reopened C1
run and grants no new candidate, cache, refactor or further profiling. No
production file was changed. The owner question concerns a separately bounded
new eight-path contract window in `OWNER_PROPOSAL.md`, not retrospective
authorization of that profile.

The proposal was tightened after independent review: descriptor-only W04
proof is insufficient; preliminary Dry tests must exclude the original paid
pair; inherited array iteration and copied/forged results retain fallback;
allowed output roots and the one-candidate/no-new-profile budget are explicit.

## Package and acceptance status

W00–W08 retain historical scoped receipts as documented in the preceding
native-continuation report; this run is not whole-package recertification.

| Package | Status | Next dependency |
|---|---|---|
| W09 | BLOCKED | Original band gate, reproducible loaded Native movement, full current paid layout and fresh 16 kg cycle |
| W10 | BLOCKED / NOT_RUN | W09 PASS; no common Factory Save implemented in this continuation |
| W11 | BLOCKED / partial evidence | W10 and complete ordinary-input functional/gameplay/Save/performance proof |

Functional: startup/pickup partial, full cycle BLOCKED. UI: current English
production menu/cargo paths observed, full process/restart path NOT_RUN.
Save: common Factory Save NOT_RUN. Visual: existing V2 Blender candidate
remains NOT_ADMITTED and OWNER_REVIEW_PENDING. Gameplay: transport fails after
pickup; full 16 kg loop NOT_RUN. Performance: original band and loaded route
FAIL; real-GPU acceptance NOT_RUN.

See `SOURCE_LOCK.json`, `INDEPENDENT_REVIEW.md`, `OWNER_PROPOSAL.md`, and actual
raw evidence under
`apps/weltraum-browser/evidence/factory/play/2026-10-14/composition-attribution/`.
No blanket PASS or completed playable/save delivery is claimed.
