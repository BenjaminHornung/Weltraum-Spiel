# HEAD preparation for RD03

RD00, RD02 and repaired RD01 are locally accepted. Product integration remains false; reference media/art and qualified GPU/performance acceptance remain unavailable.

## Bounded ownership handoff

With RD01 finished/accepted/soft-archived and SO01 idle, HEAD is the sole writer. HEAD takes over only the RD02 freeze-verifier/CLI compatibility seam and its focused regression/required generator-hash annotations. Native generators, five consumed contracts, manifests, payloads, scenarios and old receipts remain unchanged. The original RD02 worktree at `48cb9775` and freeze `63e52eea` remain the historical reproduction path.

## Ordered changes

1. RED: existing freeze verifier ignores a supplied input reference. Add one native regression; then accept only an explicit immutable HEAD freeze with valid commit/tree/current-root byte bindings. Preserve original five consumed contract hashes independently; never disable the 18-file input check.
2. Add exact lab-only `@types/three@0.185.1`, required by forthcoming typed Three code. Account for locked type transitives; no Rapier runtime import/init. Include actual lab tests in typecheck and use native Vite `publicDir: 'fixtures'`.
3. Commit/freeze the real shared inputs. Fresh export normal/reverse against this explicit input ref; prove all canonical manifest/payload/scenario bytes unchanged, update only generator/recipe/inventory annotations, and rerun focused checks/boundary.
4. Launch RD03 from the actual accepted SHA/lock/fixture inventory, not a placeholder. RD03 owns the real `src/runner/index.html`, runner and Three control files. HEAD wires real exports, native Vite 8 `build.rolldownOptions.input`, and RD03-specific browser artifacts after code handoff, then verifies an optimized build/preview. No missing entry imported early or dev timing relabeled as optimized.

## URL / verification contract

Public fixtures are `/inventory.json` and `/Fxx-NAME/...`, not `/fixtures/...`. Resolve inventory paths from the public asset root (`import.meta.env.BASE_URL`) and payload paths from each manifest URL. The real standalone runner HTML remains `/src/runner/index.html`; an input alias does not create a route.

Focused regression, fresh types/unit/build, regenerated canonical-byte comparison, HEAD-profile boundary and static review gate the new leaf start. Existing diagnostic Canvas2D is retained; no concurrent competing canvas/loop or product claim. No DevToolbox tracking requested; local equivalent checks are recorded in owned run artifacts.
