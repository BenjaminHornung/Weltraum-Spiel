# ExecPlan und Baseline: FP06 W00

Stand: 2026-10-10T20:46:08.453050+00:00. Run-ID: `20261010T203413Z-ee35c4bf`. Gesamtstatus W00: **BLOCKED**, kein Abschluss des Produkt-Write-Gates. Der Source-Lock ist geprüft; Ownerentscheidungen und externe Integrationsleases sind offen.

## Goal

Vor W01 eine belegte Repository-/Quellbasis, konkrete Read-/Write-Sets, höchstens zwei Produktwriter und getrennte Test-/Freigabestatus herstellen. Nur W00 bis W11 planen und nur freigegebene Pakete ausführen.

## Context

Repository: `BenjaminHornung/Weltraum-Spiel`. Auditpin, gefetchtes `origin/main`, initialer HEAD und W00-Basis: `e40592c113b72a8dc93725187f92cf948e07f44d`. Keine Änderungen nach Auditpin. Isolierter Worktree `/workspace/scratch/6df2a2bc9dc2/worktrees/fp06-w00` auf `integration/hestia-fp06-v2-2026-10-10`. Der Repositoryklon bleibt detached auf der unveränderten Basis. Der frisch erzeugte Clone hatte vor dem ersten Checkout noch keinen befüllten Index; dessen temporäre Delete-Anzeige war Initialisierungszustand, keine fremde Änderung. Nach Checkout und Worktreeanlage beide sauber.

`git fetch --all --prune`, `git status --short`, `git rev-parse HEAD`, `git rev-parse origin/main`, `git worktree list --porcelain`, `git diff --stat` und `git diff --check` wurden tatsächlich ausgeführt. Baseline-Diff null. AGENTS.md und .agent/PLANS.md vollständig gelesen. README, Septemberstatus und Living-Master-Plan sind historische Status-/Planquellen; heutige HVP-Codeexistenz wurde dagegen direkt geprüft. CODEOWNERS ist BenjaminHornung für alle Pfade.

GitHub-Lesezugriff meldet Admin/Pull/Push für BenjaminHornung. 117 Remotezweige und 5 offene PRs geprüft. Offene PRs: #59, #69, #70, #71, #72, sämtlich Dependabot. Keine dieser PRs wurde verändert. Branch-/PR-Metadaten beweisen keine uncommitteten externen Writer.

## Quellenprüfung

| Quelle | Bytes | Zeilen | SHA-256 | Nachweis |
|---|---:|---:|---|---|
| FP01 | 183726 | 2004 | `ec3e605de2c6a4877c2ff0afae244b3215e7bf8bb267feef4c466b546477080c` | PASS |
| FP02 | 164696 | 1643 | `5c4f068edba3d0c89e77b0d3a40734d4ee1a672c39f3885cbfef31430d942f39` | PASS |
| FP03 | 191555 | 2113 | `7d43e358ae7ead52da3996e85bc52906cb2584a42e0802fc4d1e959df1289cb1` | PASS |
| FP04 | 183440 | 1890 | `a04f8074afc4e1d5cd8d8eb948bb93f42cdc5a5cc73b3f2a077cb13e67e48570` | PASS |
| FP05 | 234260 | 2351 | `8aea627c70e7335a0d5d0c82c3070bfcc7d575605d037e9435ba0935e51557df` | PASS |
| FP06 | 195396 | 2790 | `501bf5d80ee6dec9627e48ea27c271b3f964d21cde61ce9410be7eb77fa182ea` | MEASURED_ATTACHMENT_BYTES |
| KICKOFF | 9795 | 85 | `82242327d42d5cbc35f85ee823d0f7dcef6c8c83656509d6edd0a685c7dddc23` | MEASURED_ATTACHMENT_BYTES |

FP01-FP05 wurden nach der anfänglichen Attachmentlücke gefunden und unabhängig hashgleich bestätigt. Keine fehlende Quelle bleibt als aktueller Blocker stehen. Die vollständigen Bytebestände sind vorhanden; W00 liest Kapitel 1 und Provenienz, zukünftige Worker müssen ihre relevanten Fachkapitel selbst lesen. Kein vollständiges semantisches Audit sämtlicher 10.001 Vorgängerzeilen wird behauptet.

## Non-goals

Keine Produktimplementierung ohne Gate. Kein Merge/Push nach main, Engine-/Dependencywechsel, Physics-/Voxel-/Save-Neuarchitektur, Cut-Nebenreparatur oder W12-W29. Keine Änderung fremder Worktrees, alter Reports, globaler Timeouts oder Limits.

## Architecture decision

Vorhandene Resources bleiben Warenautorität, HVP/Worker bleiben World-/Physicsautorität, Renderer/UI bleiben Projektionen. Versionierte 0,125-m-Terrainzellen werden nicht in das 0,25-m-Bauraster umgedeutet. Aktueller HVP-Handle exportiert nur `dispose()`, kein bestehendes Factory-Hostport. Der alte `hvp-game-checkpoint-v1` bleibt geschlossen, mit 16-MiB-Transport-/64-MiB-Decodegrenzen und bisherigen Worldowner-/Körperlimits. Neue enge Hooks sind spätere ausdrücklich freizugebende W06/W07/W10-Aufgaben.

## Implementation phases

1. W00: Basispin, Quellen, Regeln, Branch-/PR-/Worktree-/Lockinventur und Baseline erheben.
2. W00: Nur source-lock.json, write-ownership.json, decisions.md und diese baseline.md erzeugen; unabhängige lesende Reviews.
3. W01: erst nach W00-Gate, W01/D01 und katalogbezogenem Mengenfreeze. Dann ausdrücklich A:W03/B:W05 und A:W06/B:W02 bei disjunkten Locks, A:W04/B:W08 nach Vorgängern, W07, W09, W10, W11. Separate Art-/Gameplayabnahmen entstehen nach den zugehörigen Captures/Läufen.

## Tests and evidence

Umgebung: Linux, Node `v24.19.0`, npm `11.9.0`. README/CI nennen Node 22; dieser Lauf ist deshalb kein identischer CI-Umgebungsnachweis. Installierte Produktpins stimmen exakt: Three.js 0.185.1, Rapier compat 0.12.0, TypeScript 7.0.2, Vite 8.1.5, Vitest 4.1.11, Playwright 1.61.1. Manifest und Lockfile unverändert.

`npm ci --offline` schlug wegen fehlendem Cacheentry `why-is-node-running@2.3.0` fehl. `npm ci --no-audit --no-fund --fetch-retries=0 --fetch-timeout=20000` installierte 59 Packages erfolgreich. Dies ist ein Infrastrukturvorgang, keine Feature-Red/Green-Sequenz.

| Lauf | Tatsächlicher Befehl | Exitcode | Rohlog SHA-256 |
|---|---|---:|---|
| `build` | `npm run build` | 0 | `bf9c7834280677ee45082ab4e8144c42cef4ffa36275527835d8a2dcebc1d60c` |
| `hvp-bootstrap-unit` | `npm run test -- tests/unit/hvp-bootstrap.test.ts` | 0 | `18856935d8b8804025a3e868fdcd2b3fe1a793649444b0adc7e45e5b2cd81087` |
| `playwright-core-attempt` | `npm run test:e2e -- tests/e2e/resource-cargo-core.spec.ts tests/e2e/ship-power-thermal-core.spec.ts tests/e2e/browser-storage-save-repository.spec.ts --workers=1` | 1 | `e45c090e5c7e979f9ff820c73503494c2349b2953980501630cba27f307e6ad3` |
| `playwright-headless-install` | `npx --no-install playwright install --only-shell chromium` | 1 | `2a7ac4587d422825c05ca33dc000f653f9143c100a5a6853f691a94ae60406fa` |
| `playwright-install` | `npx --no-install playwright install chromium` | 1 | `e608c3112beec7015b1ab12a8b81e4fa9a47d049b9c18e9a663eece6288c22b6` |
| `resource-power-unit` | `npm run test -- tests/unit/resourceCatalog.test.ts tests/unit/resourceContainers.test.ts tests/unit/resourceTransfer.test.ts tests/unit/shipPowerAllocation.test.ts tests/unit/shipPowerThermalStep.test.ts tests/unit/shipPowerThermalDeterminism.test.ts` | 0 | `766bba487f5ba6677985aa0a8f3d3733453ca1be06f5011a655660ba26466874` |
| `save-terrain-integration` | `npm run test -- tests/unit/hvp-game-save.test.ts tests/unit/hvp-world-save.test.ts tests/unit/hvp-terrain-consumer.test.ts` | 0 | `0bc84e5631e6d117386af2464cb3d11e58d4399547ae995f67bd8c89cedb58b4` |

Build: PASS. Resource-/Powerunit: 66/66 PASS. HVP-Bootstrap: 26/26 PASS. Save-/Terrainintegration (bestehende Vitest-Integrationssuites): 31/31 PASS. Zusammen 123 fokussierte Testfälle in zehn Dateien; keine Vollsuite. Kein neuer Factorytest wurde behauptet.

Playwright: Originalkonfiguration und sechs entdeckte Tests aus drei Specs tatsächlich gestartet, ein Worker. Alle sechs scheiterten vor Browserstart: erwartetes Chromium Headless Shell v1228 fehlt. Normaler Chrome-Download und gezielter Headless-Download lieferten ungültige ZIP-Archive. **Infrastruktur FAIL; UI-/Browserassertions BLOCKED, kein Produkt-PASS.** Es wurden weder Timeouts erhöht noch Testassertions geändert.

Browser-Ausführung erfolgte in `/workspace/scratch/6df2a2bc9dc2/baseline-browser` mit 693 byteidentischen Baseline-Dateien und genau denselben installierten Dependencies. Alte Evidence und dist wurden aus der Kopie ausgeschlossen; der Bytevergleich steht in `baseline-browser-source-manifest.json`. Dadurch überschreibt der Alt-Testgenerator keine vorhandenen Reports im Repository. Keine Source-/Test-/Configänderung in dieser Kopie.

Runbelege: `/workspace/scratch/6df2a2bc9dc2/w00-evidence/20261010T203413Z-ee35c4bf`. Vorliegende Logs und Command-Receipts enthalten Basisbezug, genaue Befehle, CWD, Zeiten, Exitcodes und Digests. GitHub-Inventar und Local-Verification-Status liegen als separate Rohbelege im äußeren W00-Evidenceverzeichnis. Diese Belege werden als eigener Evidenzdownload gesichert. LFS-Smudge wurde beim Checkout unterdrückt; daher keine visuelle/GLB/LFS-CI-Abnahme aus diesem Lauf ableiten.

Die W00-Kartenfälle werden getrennt bewertet: FP06-T001 NOT_RUN für die absichtlich hergestellte Auditpin-Divergenz (tatsächlicher Pinvergleich PASS ohne Divergenz); FP06-T002 NOT_RUN für eine künstlich kollidierende Writerlease; FP06-T003 PASS für die belegte Trennung realer Baseline-Infrastrukturfehler von Produktfehlern; FP06-T004 NOT_RUN für absichtlich manipulierte Quellbytes (tatsächliche Hashprüfung PASS). Kein pauschales W00-Test-PASS aus nicht ausgeführten Negativfällen.

## Locks, laufende Arbeiten und Risiken

Zwei echte ausschließlich lesende W00-Agenten wurden gestartet: `/root/w00_source_gate_audit` und `/root/w00_repository_lock_audit`. Produktwriter: 0/2. Integratorslot A und Domainslot B sind reservierte Rollen, keine erfundenen gestarteten Agenten. W01-W11 bleiben BLOCKED, ohne Produktbranch oder Kandidatencommit.

Lokale Standardregistry: kein Stateverzeichnis, 0 laufende eigene Runs, 0 Reservierungen, 0 stale Records. In vier bekannten Checkouts keine Git-Index-/HEAD-/Ref-Locks. Das ist kein globaler Writerfrei-Nachweis.

Cut-/Destruction-/Perfzweige besitzen gemeinsamen Mergebase `9341fb906383515057e659a99e16a381632f2bea`; ihre kumulativen Diffs berühren hvpBootstrap.ts, hvp-bootstrap.test.ts und beide Physics-Hostdateien. HUD-spezifische Änderungen seit `b3c6523...` betreffen hvpHud.ts und Tests; Bundle-spezifische main.ts und Tests/Evidence. RD-eigene Änderungen liegen unter experiments. Die geprüften neuen Factorypfade sind unberührt. Das archivierte OWNERSHIP.json vom 02.10. nennt ausdrücklich vorgeschlagene Planung, keine erteilten Leases. Assetcompiler meldet PRODUCT_INTEGRATED=NO.

Alte Checkouts unter `/workspace/scratch/49bdb658bda9` sind detached auf `15f3550bd604856b25d40a7ac700ec4d5106b89e` und `b352efc4120a5cc60b3cf7035c765f0004a5b035`. Ihre fünf bestehenden Dirty-Dateien wurden lesend inventarisiert und nicht verändert. Neue Factoryarbeiten verwenden diese Worktrees nicht.

Offene Risiken: keine belegte W01-/D01-/Quantisierungsfreigabe, ungeklärte externe HVP-/Physics-/Savewriter, fehlender Playwrightbrowser, abweichendes Nodeprofil, noch keine Art-/Gameplay-/Performanceabnahme. Fehler der alten Basis bleiben von Featurefehlern getrennt.

## Rollback / safe stop

W00 darf nur die vier Dokumente schreiben. Jede unbekannte relevante Quelle/Zuständigkeit hält den betreffenden Produktpfad. Kein automatisches Rebase, kein Checkout eines fremden Agentenzweigs. Dokumentdiff kann als eigener Commit verworfen werden; veröffentlichte Saves bleiben unverändert. Neue Productwriter erst nach protokollierter Ownerfreigabe und konkretem exklusivem File-Lock.

## Progress log

- [x] Repository-/Auditpin und clean W00-Basis belegt.
- [x] FP01-FP06-Bytes und Quellenprovenienz gebunden.
- [x] Branch-/PR-/Worktree-/Lokallockinventur durchgeführt, Beobachtungsgrenze genannt.
- [x] Build und 66 Resource-/Powerunit-Tests ausgeführt und bestanden.
- [x] Playwright tatsächlich versucht; Browserassertions durch Infrastruktur blockiert.
- [x] HVP-/Save-/Terrainlauf final bewertet, 26 plus 31 Fälle bestanden.
- [x] Vier Dokumente zwei unabhängigen lesenden Reviews vorgelegt; Scope-/Scheduling-/Abnahmehinweise korrigiert. Finale Reviewurteile und Commit-SHA werden im separaten Runreceipt gesichert.
- [ ] Ownergate für W01/D01 und Katalog-/Mengenfreeze.
- [ ] W01-W11 implementiert, Unit-/Integration-/Playwright- und getrennte V2-Gates bestanden.

## Definition of Done

W00-Exit verlangt eine für fremde Writer eindeutig freigegebene erste Tranche mit verifizierten Quellen, konkretem Integrator, Write-Sets, Baseline und unabhängigen Reviews. Der aktuelle W00-Dokument-/Preflightstand ist belegbar, aber dieser Exit bleibt **BLOCKED**, solange die produktrelevanten Ownergates fehlen. Keine Fabrik und kein V2 sind implementiert. Der minimale nächste Ownerentscheid steht konkret in decisions.md.
