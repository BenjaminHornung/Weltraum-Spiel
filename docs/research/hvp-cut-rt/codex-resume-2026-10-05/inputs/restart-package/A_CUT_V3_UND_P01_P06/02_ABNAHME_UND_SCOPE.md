# A: unveränderte Abnahmegrenzen und enger Schreibbereich

## Produktpfade

A besitzt ausschließlich die durch V3/P01–P06 begründeten Änderungen in `apps/weltraum-browser/src/hestia-prototype/**`, `src/hvp/**`, den betroffenen `src/voxel/adaptive/**`, `src/voxel/structural/**`, `src/workers/hvp*` und den notwendigen bestehenden Pool-/Render-Ownershipnähten. Vor jedem Delta konkrete betroffene Dateien im Task notieren. `src/main.ts` ausschließlich für den bereits beauftragten Routefix/erforderliche Fehlergrenze, keine allgemeine Appreform. Zugeordnete neue/fokussierte Tests unter `tests/unit`, `tests/reference`, `tests/e2e`, `tests/performance`.

Kein pauschaler Rewrite dieser Verzeichnisse. Keine neuen Gameplay-/Editor-/Wetterfeatures. Neue Recoverydokumentation unter `docs/research/hvp-cut-rt/codex-resume-2026-10-05/`, abschließende P01–P06-Matrix dort oder im eigenen bestehenden Researchbereich. Historische Originale bleiben.

B-Labor `experiments/hestia-rd-2026-10-02/**` und C-Compiler `tools/hestia_asset_compiler/**` read-only. Keine Root-/Produktdependency-Upgrades, keine globalen `.opencode`, `.codex`, Paseo- oder npm-Konfigurationsänderungen. Root-Schreibkonflikte dem Nutzer melden, nicht mit Ausnahmen im Scopechecker verbergen.

## Numerische Gates aus aktuellem V3-ExecPlan @ 0bfd1e67117d0dd6184e592e9a2a1b8b9f58241a

| Größe | Bestehende Grenze |
|---|---:|
| Input → Applied p95 | ≤250 ms, jede der 14 Populationen |
| Input → bestätigtes Render p95 | ≤250 ms, jede der 14 Populationen |
| Applied → Render p95 | ≤33,34 ms |
| echter nativer World-Hold p95 | ≤50 ms |
| zusammenhängende eigene Arbeit p95 / max | ≤4 ms / ≤8 ms |
| Vorbereitung: Timerlücken | ≤20 ms |
| Frameintervall p95 / p99 | ≤20 ms / ≤33,34 ms |
| reproduzierbarer cut-verursachter Freeze | kein >100 ms |
| CPU | 268435456 Byte |
| Mesh | 134217728 Byte |
| Vorbereitung | 96 MiB |
| Output | 8 MiB |
| Dreiecke / Draw Calls | 500000 / 300 |
| schwere Jobs / Queue bzw. Parts | 2 / 32 |
| Diagnostikreserve | 512 KiB |

Die exakten geltenden Messdefinitionen aus dem ursprünglichen V3-Vertrag zusätzlich abgleichen. Keine Render-/Voxelauflösung oder Colliderpräzision reduzieren, um Grenzen zu erreichen. Keine Plattformquellen mit anderer Voxelauflösung als Ersatz verwenden.

Einzeltests behalten ursprüngliche 5000-ms-Deadlines, der benannte Owner65-Lauf seine native 180-s-Grenze. Keine heute nicht ausgeführten Tests als grün bezeichnen.

## Derivative und Authority

Transport, Mesh, HUD, Colliderhandle und Messreceipt erzeugen keine neue World-/Source-Wahrheit. Hashgleichheit eines Compilerprodukts allein ist keine Admission. Körperpose/Motion, Sourceversion, Eigentum und Native-/Rendercommit müssen zusammenpassen. Generische fremde Objekte erhalten weiterhin den generischen validierenden Pfad; interne Issuer-Beweise nicht durch heuristische Shapechecks ersetzen.

## Prüfungsfolge

Diagnose → kompletter betroffener Testlauf → unabhängiger Authority-Review → B1 aktiv → B2 aktiv → B3/Reuse → Gesamtbuild/Spielpfade → 42 → 1400 → finale technische/visuelle Belege → finaler unabhängiger Review → neuer Feature-Commit/Push.

Read-only Reviews und nicht blockierte Teilvorbereitung dürfen parallel erfolgen. Die Kernfolge darf nicht durch fingierte Stage-/Input-/Sourcebelege übersprungen werden.
