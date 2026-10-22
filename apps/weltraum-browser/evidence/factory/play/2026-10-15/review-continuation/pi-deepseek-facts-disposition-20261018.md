## Result: no counterexample exists — I withdraw the nested‑F P2 as a V2 regression

**Precision note first:** `apps/weltraum-browser/src/factory/persistence/` (including `factoryCheckpoint.ts`) is **not in HEAD** (`git show HEAD:…factoryCheckpoint.ts` → "exists on disk, but not in HEAD"), and HEAD's `hvpBootstrap.ts` contains no replay validator (`nextStateBytes|factsBytes|DryReplayCheckpointMismatch` → no match). So the "V1 validator" is itself part of this in‑flight continuation (Unit1), not a HEAD baseline artifact. Compared against each other, the two validators are what I reasoned about.

### The exact V1 check inventory (`dryFactorySlice.ts:392–403`)
```text
394  saved = lastStep, exact keys [inputBytes,factsBytes,nextStateBytes,materialBytes]
397  input = JSON.parse(inputBytes), exact keys [facts,materialBytes]
399  uncachedCanonicalJson(input.facts) === factsBytes
399  canonicalJson(JSON.parse(input.materialBytes)) === input.materialBytes
400  nextStateBytes === uncachedCanonicalJson(core)          ← only replay→state binding
401  materialBytes === historicalMaterialBytes
```
Every V1 check is self‑consistency of text plus `nextStateBytes === canonical(core)`; **no check re-derives core from F**, and `nextStateBytes` does not depend on F.

### Differential attempt for a nested field (e.g. `facts.machines[i].facts.installation.installationRevision`, `definitionRef.digest`, nested `tickEndUs`, `command.recipeRef`)
- **V1:** the tamperer rewrites `inputBytes = canonical({facts:F′, materialBytes:M0})` and `factsBytes = canonical(F′)`. Then `399` passes by construction, `400` compares `nextStateBytes` to `canonical(core)` — core untouched, passes; `401` passes (M1 unchanged). **V1 admits.** The only check that could theoretically reject would be `nextStateBytes !== canonical(core)` at line 400, but it has no dependency on F, so it is not a rejecting check for any F alteration.
- **V2 (`dryFactorySlice.ts:421–439`):** same alteration is likewise admitted (checks are top‑level: `confirmed`, `facts.binding`, tick window, ID‑set equality, M0/M1 canonical text).

No input exists where V2 admits and V1 rejects on F. The V2‑only top‑level checks (`427–433`: `facts.confirmed===true`, binding equality, 100 000 µs window, `facts.tickEndUs===state.tickEndUs`, machine/belt ID sets) and `ownerDataShape`/`dataOnly` (`422`) make V2 **strictly stricter** than V1 on F; V2 also validates core directly via `validateDryFactoryCheckpointStateInternal(legacyView,…)` (line 419), which V1's `nextStateBytes` comparison does not do semantically.

**Adjudication:** finding withdrawn as a V2 regression. It is a shared property of the V1 replay‑text model (textual self‑consistency, not F→C re‑evaluation), so it is out of scope under your rule against pre‑existing defects; I am not restating it as a new requirement, and I am not requiring historical facts to match post‑transfer state or changed installation revisions. Residual, correctly scoped observation only: V1 stores a `nextStateBytes` text bound to `core`, V2 stores no such text — but since that V1 text is attacker‑recomputable, it is not a stronger semantic proof than V2's direct core validation. Your TSC/fullDry55/fullCheckpoint17/GetterCalls0 results are unaffected by this item. Source reasoning only; runtime acceptance remains NOT RUN by me.

