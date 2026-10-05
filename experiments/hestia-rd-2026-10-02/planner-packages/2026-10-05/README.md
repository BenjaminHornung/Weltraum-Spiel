# Hestia RD package for external GitHub review

Repository: BenjaminHornung/Weltraum-Spiel. Review branch: `feature/resume-hestia-rd-2026-10-05`. Product changes are outside this delivery; all changed files belong to the RD lab.

The exact final archive is `Hestia_RD_Planner_Final_2026-10-05.zip` (68,078,891 bytes), tracked with the repository's existing Git LFS policy. ZIP SHA256:

`87cddafc768dd24bbde7bf5a260dfeb1d184d66d600e967f09a22971034e4a4a`

Contained MANIFEST.json SHA256:

`254a797d75646c8f390832483dfabb05bb291c0bd84ace1c33e55f5156ddc170`

## Retrieve and verify

Use the existing Git/Git LFS on the review host; no package installation is needed for the contained build/checker. Clone this branch, then retrieve the single package object:

```text
git lfs pull --include="experiments/hestia-rd-2026-10-02/planner-packages/2026-10-05/Hestia_RD_Planner_Final_2026-10-05.zip"
```

Verify the ZIP against `.zip.sha256`, extract it into a separate regular directory, then from the extracted root use Node22.23.2 (the review host's approved executable):

```text
node scripts/check-rd-results.mjs MANIFEST.json 254a797d75646c8f390832483dfabb05bb291c0bd84ace1c33e55f5156ddc170
python -m http.server 5280 --bind 127.0.0.1 --directory dist
```

The standard-library server command requires Python3 and a free loopback port. Stop only the service you started. Open `/RD-RESULTS.html`, `/src/qa/combined-scene/index.html` and the linked habitat/weather/asset-inspection tools. Source rebuilds/tests require the pinned dependencies explicitly listed in RUNBOOK.md; running the contained build and checker needs no node_modules. Host paths in original receipts are provenance, not credentials or review-host configuration to execute.

## Review anchors

- Read the extracted `RESULTS.md`, `RUNBOOK.md`, `ADOPTION_QUEUE.md`, `reports/codex-resume-2026-10-05/CORE_INDEX.json`, `CASE_EVIDENCE.json` and `FINAL-EXECUTION.md`.
- All23 original cards/97cases have source/run/status bindings:82PASS,15PARTIAL. Selected route/tools are implemented; native/human gates are not promoted to passing claims.
- Source-bound CPU198/198; native32/33 with UI43 caller-path admission failure, then unchanged corrected UI43 1/1; actual delivery5/5. These are separate populations. Combined100 transitions/20 mounts share one document/canvas/renderer/loop with zero owned cleanup counts.
- REN12-v2 native fault/restore/held-out sensitivity has a stricter pre-holdout solid threshold. Originalv1 failure stays recorded. BabylonDEFER and nativeRaysREJECT retain their original negative denominators.
- PRODUCT_INTEGRATED=false, ART=PENDING_OWNER, Q0_FUNCTIONAL_UNQUALIFIED; optionalRD22/RD33 NOT_STARTED_OPTIONAL. Native shadow/AO/readback and target-GPU benchmark gaps remain explicit.

The ZIP is an immutable delivery sealed before this publication commit. Its `executionAnchor=16a5d29a...` and `UNCOMMITTED_HASH_BOUND` describe that historical execution, not the later GitHub publication commit. Use the exact ZIP bytes for checksum/receipt verification; normal Git text/LFS checkout transformations are not archive source identities. The GitHub branch exposes readable current implementation and reports, while the ZIP additionally carries the frozen build, local raw runs and media omitted by normal working-run ignore rules. `FINAL-HANDOFF.md` and the integrity/closure sidecars remain historical completion evidence; this README documents the later authorized GitHub publication.
