# ExecPlan: Hestia FP06 W00–W11

## Goal

Den ersten bedienbaren, material-/energieerhaltenden und sicher speicherbaren Factory-Slice liefern. W00 schafft zunächst überprüfbare Basis, Quellen und Schreibgrenzen. Ein W00-PASS allein behauptet keine spielbare Fabrik.

## Context

Repository `BenjaminHornung/Weltraum-Spiel`; direkt erneut abgefragtes `origin/main`, lokale Basis und Auditpin stimmen auf `e40592c113b72a8dc93725187f92cf948e07f44d` überein. Dokumentationsbranch `codex/hestia-fp06-w00-2026-10-11`, eigener Worktree `/workspace/Weltraum-Spiel/.worktrees/fp06-w00-2026-10-11`. Der ursprüngliche Checkout `/workspace/Weltraum-Spiel` auf `work` war sauber und bleibt erhalten.

Quellen: README_START_HIER, beide identischen Brief-Dateien, vollständiger FP06-Plan, Orchestratorauftrag, Prüfprotokoll und relevante FP01–FP05-Abschnitte gelesen; alle 33 Manifestgrößen/-hashes und SHA256SUMS bestätigt. Vollständige maschinenlesbare Provenienz: [source-lock.json](source-lock.json). FP01 fachlich angenommen laut Handoff; FP02–FP05 versionsgebundene Vorschläge; FP06 weiterhin mit gezielten Ownergates. Die zwei identischen G06-Researchdateien zählen einmal. `docs/current-mainline-state.md` ist Snapshot vom 2026-09-06 auf `15f3550…`, kein aktuelles HVP-Abwesenheitsbeweisstück.

Repo-Regeln: AGENTS.md, README, Statussnapshot, Roadmap, `.agent/PLANS.md`, CODEOWNERS, aktuelle Package-/Lock-/Playwright-Konfiguration geprüft. DevToolbox-Workspace-/Spec-Tools sind in dieser Umgebung nicht verfügbar; äquivalente lokale Scope-, Evidence-, Test- und Reviewprüfungen werden dokumentiert.

## Non-goals

W12–W29, Enginewechsel, Dependency-Upgrades, main-Merge, Force-Push und Veröffentlichung sind ausgeschlossen. Keine neue UI-/Renderer-/Worker-Autorität, keine großen HVP-Refactors, keine pauschalen Timeout- oder Queue-Erhöhungen.

## Architecture decision

Three.js/HVP/Voxel/Physics/Save bleiben erhalten. Resources ist alleinige Warenautorität; UI liest Snapshots und sendet Commands. Genau ein Integrator `/root/fp06_integrator` besitzt gemeinsame Contracts-, Host-, Physics- und Savegrenzen. Höchstens ein weiterer isolierter Domain-/Assetwriter darf parallel arbeiten. Aktuell gibt es den Dokumentationswriter `/root` sowie genau zwei isolierte Produktwriter: `/root/fp06_integrator` auf `codex/hestia-fp06-integrator-2026-10-11` für abgenommene W02/W05-Integration und anschließend W07 sowie `/root/fp06_domain` auf `codex/hestia-fp06-domain-2026-10-11` für W08, derzeit mit gehaltenen Produktbytes zum Review. Die tatsächlich delegierten Audit-/Review-/Preflightagenten arbeiten read-only. W01 hat nach der konkreten Portkorrektur sein unabhängiges Gate bestanden; Die Nutzerantworten „D03-Policy freigeben“ und „Startplatz-Fixture freigeben“ lösen seit 10:34:17 UTC die beiden zusätzlichen konkreten Ownergates; noch offene Paketgates bleiben davon getrennt.

## Implementation phases

| Paket | Abhängigkeiten | Geplante Rolle | Jetzt |
|---|---|---|---|
| W00 | keine | /root Dokumentation | PASS: Baseline und unabhängiges Review |
| W01 | W00 | /root/fp06_integrator | PASS: a30630dd7963c165c673df7ea1b46d52735752ef, 46 Tests/Build/Review |
| W02 | W01 | /root/fp06_domain, eigener Worktree | PASS technisch: 10e1e3026610065206d8ac4b361d3f1686114dd8, 61 Tests/Build/Cargo1/Review; initiale TDD-Abweichung FAIL/NOT_RUN bleibt |
| W03 | W01 | /root/fp06_integrator | PASS:fee8f3bf4b971fc3a5e56884d245126b6b264b3d, echte R1/R2 RED/Fixes/80 betroffene und finale Gegenproben/tsc/Review/87 HEADrefs |
| W04 | W02/W03 | /root/fp06_domain | NOT_RUN: Vorgänger PASS; nach W08-Writerslot und W03-Integration eigener Drei-Pfad-Grant |
| W05 | W01 | /root/fp06_domain, eigener Worktree | PASS:26d5e892c2b401b9011234dabf86955af7462fb8,16 Fachtests/46 Regressionen/Build/GPU/Review |
| W06 | W01 | /root/fp06_integrator | PASS:2c044e02f1f31a2db3de3a0df9156bd71a431a7a, Host-/Browser-/Review-/Gitgates mit getrennten Bytephasen |
| W07 | W02/W05/W06 | /root/fp06_integrator | NOT_RUN: Vorgänger PASS; reviewed Branchintegration läuft vor eigenem Grant |
| W08 | W02 | /root/fp06_domain | IN_PROGRESS: exakt drei exklusiv freigegebene Dateien, Ausgang26d5 |
| W09 | W04/W07/W08 | /root/fp06_integrator | BLOCKED: Vorgänger |
| W10 | W09 | /root/fp06_integrator | BLOCKED: Vorgänger; D11 freigegeben |
| W11 | W10 | Integrator, unabhängige Reviews | BLOCKED: Vorgänger |

Die Abhängigkeiten sind keine Schreibfreigaben. Nach W01-PASS kann etwa W02 mit W03 und später W05 mit Integrationsvorbereitung parallel laufen; immer maximal zwei tatsächliche Writer. Exakte paketbezogene Zielpfade, aktuelle/geplante Branches, Read-Sets und tatsächliche Produktwrite-Grants stehen in [write-ownership.json](write-ownership.json). Jeder Writer startet von einem vollständigen reviewed predecessor SHA in eigenem Branch/Worktree. Unabhängiger Reviewer prüft Fachvertrag und Codequalität vor Freigabe abhängiger Arbeit.

## Tests and evidence

Frischer Run `2026-10-11T090924Z` auf der obigen Basis:

| Prüfung | Befehl / tatsächliches Ergebnis |
|---|---|
| Fetch/Audit | `git fetch --all --prune`, Exit 0; `ls-remote origin refs/heads/main`, lokale Refs, Status und Worktrees erfasst. |
| Quellen | `sha256sum -c SHA256SUMS.txt`: 33/33 OK; unabhängiger Manifestcheck Größen/SHA256: 33/33 PASS. |
| Build | `npm --prefix apps/weltraum-browser run build`: Exit 0, TypeScript + Vite PASS. Bestehende Chunkgrößenwarnung bleibt. |
| Fokussierte Basis | `npm --prefix apps/weltraum-browser run test -- tests/unit/hvp-bootstrap.test.ts tests/unit/resourceCatalog.test.ts tests/unit/resourceContainers.test.ts tests/unit/resourceTransfer.test.ts tests/unit/hvp-physics.test.ts tests/unit/hvp-world-save.test.ts tests/unit/hvp-game-save.test.ts tests/unit/hvp-world-replacement.test.ts`: Exit 0; 8 Dateien, 95 Tests, 189,88 s. |
| Frischer vollständiger Unitlauf | NOT_RUN in W00. Früherer Cloud-Onboardinglauf auf demselben SHA: 195 Dateien/1810 Tests grün; historische separate Evidence, kein neuer W00-Lauf. |
| Frischer Browserlauf | NOT_RUN in W00; keine Browser-/Visual-/Gameplay-Abnahme behauptet. Der Worktree hat zunächst LFS-Pointer; Build ist kein Nachweis korrekter runtime assets. Vor Browserpaketen begrenzte Runtime-LFS-Wiederherstellung und Hashprüfung erforderlich. |
| GitHub-PR-Audit | GraphQL API: `Forbidden`; öffentliche Pulls-Seite HTTP 200. Sichtbar #59/#69/#70/#71/#72, ausschließlich Dependency-Upgrades; Heads über Git geprüft. Keine vollständige API-Sicht oder Kenntnis externer uncommitted Writer behauptet. |

Werkzeuge: Debian 13, Node 22.23.3/npm 10.9.8 aus `/workspace/.cloud-setup/activate.sh`, unveränderter App-Lockfile, Three 0.185.1, Rapier 0.12.0, TS 7.0.2, Vite 8.1.5, Vitest 4.1.11. System-Chromium 154.0.8037.57 für spätere Browserprüfungen. Ignorierte Buildartefakte sind keine Produktdiffs; temporärer Dependency-Symlink wurde nach Tests entfernt.

Evidence: [Run-Manifest](../../../apps/weltraum-browser/evidence/factory/w00/2026-10-11T090924Z/manifest.json), tatsächliche Textlogs und Audit-JSON im selben Run. Keine Alt-Evidence überschrieben.

### W00-Fälle ohne erfundene Negativtest-Ergebnisse

| Fall | Tatsächlich beobachteter Zustand | Ergebnis |
|---|---|---|
| T001 Auditpinabweichung | Auditpin, Remote und lokale Basis identisch. | Positiver Basisabgleich PASS; künstlicher Driftfall NOT_RUN. Regel: auf Drift betroffene Writes halten, keine automatische Rebase. |
| T002 Fremdclaim am HVP-Host | Lokal kein fremder Produktwriter; überlappende Remote-Branches vorhanden, deren Aktivität unbekannt. | Lokale Claim-Erhebung PASS; tatsächlicher konkurrierender Claim-Fall NOT_RUN. W00-Hostgrant war leer. Vor W06 wurden Main und lokale Worktrees erneut geprüft und der eng begrenzte Integratorgrant erteilt; keine aktive fremde lokale Hostschreibclaim beobachtet. Externe uncommitted Claims bleiben nicht sichtbar. |
| T003 Bereits roter Alttest | Frischer Build und 95 Basistests grün. | Basis PASS; Baseline-Failure-Beispiel NOT_RUN, keine Assertion gelockert. |
| T004 Veränderte Quelle bei gleichem Namen | Alle 33 Dateihashes/-größen stimmen. | Integrität PASS; künstliche Manipulation NOT_RUN. Hashdrift blockiert betroffene Fixtureübernahme. |

W00 ist eine Dokument-/Auditkarte, daher kein erfundener Produktcode-TDD-Zyklus. Für W01–W11 wird das fachlich erwartete RED mit Befehl/Exit/Log vor Implementierung bewahrt, danach fokussiertes GREEN, betroffene Regressionen, Diffprüfung und unabhängiges Review. Ein Importfehler ersetzt keinen fachlichen Negativfall.

## Risks

Bestehender Remote-Branch `origin/integration/hestia-fp06-v2-2026-10-10` auf `07c7587b1a646b6a460025fe5b98c4ef6ac43182` enthält ausschließlich vier frühere W00-Dokumente, keine W01–W11-Implementierung. Seine alten Locks und Baseline gelten nicht automatisch weiter. Cut-/HVP-/Destruction-/Performance-Branches überlappen Host-/Physics-/Savepfade; vollständige Heads und Überschneidungen im Run `branch-conflicts.json`. Branch-Präsenz ist kein aktiver Writerbeweis. Fremde Änderungen werden nicht übernommen oder überschrieben.

ID-Mapping, exakte Mengen/Volumen, native Facility-Installation und vollständiger kombinierter Save sind relevante Vertragsrisiken. Die Entscheidungshistorie und die inzwischen ausdrücklich akzeptierten konkreten Varianten sind in [decisions.md](decisions.md) nachvollziehbar. W11 braucht echte sichtbare Bedienung und Material-/Energienachweise; Owner-Art-/Gameplay-Abnahme kann nicht durch einen Agenten erfunden werden.

## Rollback / safe stop

Bei unklarer Quelle, Zuständigkeit oder relevantem Ownergate nur betroffene Produktwrites stoppen. W00 liegt isoliert; ursprünglicher Checkout, main und sämtliche Remote-Branches bleiben erhalten. Kein Main-Merge, Force-Push, Überschreiben fremder Änderungen oder Veröffentlichen. Reviewte Commitübernahme erfolgt nur auf isolierten Implementierungsbranches. Produktfehler vor Commit behalten alten Zustand; bei unsicherem Rollback RecoveryHold. Git-Revert interpretiert veröffentlichte Saves nicht still um.

## Progress log

- [x] Upload sicher entpackt; Quellen gelesen und beide Integritätslisten geprüft.
- [x] Main neu abgefragt; Regeln, Worktrees, Branches, sichtbare PRs und Integrationspfade geprüft.
- [x] Isolierten W00-Branch/Worktree angelegt; vier Dokumente und frische Audit-/Baseline-Evidence erstellt.
- [x] Build und 95 fokussierte Basistests PASS.
- [x] Unabhängiges W00-Dokument-/Vertragsreview nach R1/R2-Fix: Spec/Qualität PASS.
- [x] W00-Commit `656c52458eff15133025bb21dc3e5b7b708cfbf7`; Worktree danach sauber.
- [x] Nutzerantwort übernommen: W01-Freeze und D05/D06/D07/D11 ausdrücklich freigegeben am 2026-10-11 09:23:32 UTC.
- [x] W01-Integrator mit exakt fünf Produktzielen, eigener Branch/Worktree und geprüftem W00-Vorgänger gestartet.
- [x] W01 tatsächliches RED/GREEN, Quelle CASS-OFFCUT nach Review korrigiert, 46 Tests/Build/Diff und unabhängige Spec-/Qualitätsnachprüfung PASS bei a30630dd7963c165c673df7ea1b46d52735752ef. [Reviews](reviews/w01-followup.md).
- [x] Zweiten Writer tatsächlich auf eigener Domainbranch/worktree eingerichtet; 82 benötigte LFS-Payloadhashes bestätigt, unveränderte gepinnte Dependencies verfügbar. Genau zwei disjunkte W02-/W06-Grants.
- [x] D03-Restart und konkretes initiales StartSiteprofil zunächst als offene Ownerfragen dokumentiert, anschließend beide ausdrücklichen Nutzerfreigaben am 2026-10-11 um 10:34:17 UTC übernommen; Paketgates bleiben erforderlich.
- [x] W02 technisches Paketgate: 61 Tests/Build/Cargo1 und unabhängige Spec-/Codeprüfung PASS bei 10e1e3026610065206d8ac4b361d3f1686114dd8. Anfänglicher T009–12 Business-RED vor Implementation NOT_RUN wegen Modulimport-Setupfehler; historische TDD-Konformität FAIL bleibt ausdrücklich sichtbar, kein erfundener Ownerwaiver. [Vollbericht](reviews/w02-package-report.md), [Nachprüfung](reviews/w02-followup.md).
- [ ] W06: echte Host-/Kadenz-/Browser-REDs; vollständige frische Unitsuite 197 Dateien/1835 Tests PASS, 10 Session-/Evidencefälle PASS, Build/Typecheck PASS. Browser 3/6 PASS, übrige Fälle erschöpfen 30-s-Gesamtbudgets; tatsächliche Traces gesichert, fortlaufender normaler Sessionflow wird ohne Limitänderung geprüft. Unabhängiges Erstreview Spec/Quality FAIL: Holdfilter, Resume-/Playguards, Manifestvalidierung und Factory-Restartroute. Enge echte RED/Fixes laufen; Endgate/Commit offen. [Befunde](reviews/w06-first.md).
- [x] Browserprüfungen erhalten eine ausdrückliche serielle Lease für Port 5174; unveränderte 30-s-/5-s-/20-s-Defaults aus der vorhandenen Playwright-Konfiguration. Externe Umgebungsconfigs ändern ausschließlich Port und eigene Evidence-Ausgabepfade, keine Produktkonfiguration. W06s noch fehlgeschlagener kombinierter Browserfall wird in fokussierte reale Bedienfälle zerlegt und nach Unitabschluss seriell geprüft; kein neuer Timeout angenommen.
- [ ] W05: vier echte anfängliche Fachtests RED (4 AssertionFailures, keine Importfehler); kleinste Presentation-/Assetimplementation danach. Gezieltes GREEN, Build und echte synthetische GPUprobe warten auf freie serielle CPU-/Browserlease.
- [ ] W03/W04/W07–W11 je Paket RED/GREEN/Regression/Review/Evidence/Commit-Gate.

## Definition of Done

W00 ist abgeschlossen, wenn Basis-/Hash-/Baselinebelege, klare Locks, ehrliche Decisions, unabhängiges Review und vollständiger Commit-SHA vorliegen. W00 darf mit dokumentierten offenen Folgegates abgeschlossen werden. W01–W11 sind erst abgeschlossen nach ihren tatsächlichen Fach-, Browser-, Save-, Material-, Energie- und Reviewgates; NOT_RUN/BLOCKED bleibt sichtbar. Die abschließende Paketübersicht enthält Agent/Branch, vollständigen SHA, geänderte Dateien, Tests, Review/Evidence und nächste Blocker.

## Review-Fixprotokoll

Erstreview FAIL wegen R1 falscher Shared-Physics-/Save-/Workflowpfade und R2 Planprosa als Dateipfade. Reale `src/hestia-prototype`-Pfade und `browser-mainline-ci.yml` aufgenommen, Bootstraptest geschützt, vorhandene geschlossene Save-/Main-/Lockfileverträge als Read-only geschützt. Prosa in reine individuelle Pfade und separate Restriktionen aufgelöst; Branchüberschneidungen frisch neu erhoben. Ein Folge-Review prüft genau diese Änderungen und die inzwischen eingetroffenen Nutzerfreigaben.

`git diff --cached --check` meldet Exit 2 ausschließlich bei unveränderten Rohlog-Whitespace/EOF-Leerzeilen. Kein Produktcode betroffen; kein pauschal sauberer Gesamtdiff behauptet. Rohlogs bleiben bytegenau erhalten.

## W06 Nachreview vor Endgate

R1/R3/R4 sind im beurteilten Fixsnapshot geschlossen. Die 50 betroffenen Host-/Sessiontests und tsc/Vite sind PASS; das ist kein globaler Folge-PASS für spätere Fixes. R2 bleibt FAIL wegen tatsächlichem HUD-Drop→tick.resume während Nativehold. Derselbe bestätigte Nativeguard wird eng auch für Drop geprüft und angewendet; ursachenspezifische Budgetassertions folgen. [Nachreview](reviews/w06-followup-drop-open.md). Das neue siebenteilige echte Browsergate läuft; Teilfälle, historische Fehlruns und Performance NOT_RUN werden nicht zum abgeschlossenen Paketgate umgedeutet.

## Folgepaket-Vorbereitung und konkrete Verteilung

[W10-Vorprüfung](reviews/w10-preflight.md) benennt die nötige eigene Factoryprofileaufnahme, vollständige native Ownerzuordnung, gemeinsame Hostbarriere und Materialrestore ohne Reset von WIP/Receipts. Die fünf zusätzlichen exakten Integratorpfade sind ausschließlich geplant; W09 muss vorher bestehen, und Materialwrites werden erst nach Abgabe durch den Domainwriter erlaubt. Alte geschlossene V1-Decoder und Repositorybudgets bleiben geschützt.

Nach W05 übernimmt der Domainwriter W08 und anschließend die drei reinen Produktionspfade von W04, sobald W03 bestanden ist. Der Integrator übernimmt W03 und W07; so können Produktion und native Platzierung nach ihren jeweiligen Vorgängergates unabhängig entstehen. Höchstens zwei Implementierungswriter; gemeinsam genutzte Contracts/Host/Physics/Save bleiben ausschließlich beim Integrator.

## W06 Reviewhalt und unabhängiger W03-Start

W06-Code-/Evidencecommit:5b596f932dc769052e17603965d0179a4937d948. Runtimewrites sind gehalten; eine eng begrenzte Evidence-only-Folge bindet tatsächliche CLIwerte und drei bisher ignorierte eigene Runartefakte an Git/LFS. Der Abschlussreview bleibt offen. W03 hängt ausschließlich von abgenommenem W01 ab; deshalb erhält derselbe Integrator jetzt ausschließlich seine vier Powerpfade. W07/W09 bleiben von ihrem tatsächlichen W06-Gate abhängig. Maximal zwei tatsächliche Produktwriter: W03 Integrator und W05 Domain, mit disjunkten Grenzen.

[W05-Erstreview](reviews/w05-first.md):Spec/Quality FAIL bei gebundenem Erststand trotz korrekter ursprünglicher Unit-/Build-/GPUbelege. Reale zusätzliche REDs zeigen die Trag-/Phasen-/Markerlücken; enge Fixes laufen. Ein anfänglicher falscher Bildverband bei Root wurde durch erneute Einzelbild-/Hashprüfung korrigiert, kein Capture-FAIL erfunden.

## W06 endgültiges Paketgate und W07 Integrationskarte

W06 PASS bei2c044e02f1f31a2db3de3a0df9156bd71a431a7a: unabhängige [Spec-/Qualitätsprüfung](reviews/w06-final.md), [finaler Git-/LFSreceipt](reviews/w06-final-commit.md) und [vollständiger Paketbericht mit299 tatsächlichen Pfaden](reviews/w06-package-report.md). 286 Manifestartefakte im HEAD tatsächlich gebunden; zwölf Produktdateien gegenüber Codecommit unverändert. Tests sind jeweils ihrem Byte-/Zeitstand zugeordnet:1835vorReview,50betroffene+7Browser vorletztemDrop,4gezielteDrop/Resume/Budgetfälle+TypeScript final. Performance NOT_RUN.

[W07 Integrationskarte](reviews/w07-integration-map.md) begründet die exakt zusätzlich geplanten Source-/Host-/Native-/Testpfade. Noch kein Grant/W07-PASS. Quellen erlauben einen endlichen bezahlten C03+C04+C07-Stromstart; réelle Akkuaufstellung, Leitungen und Geräteaufnahme bleiben Fachgates. Wind über Terrain-Y-Coverage ist UNKNOWN und keine notwendige Voraussetzung dieses ersten Batteriekreislaufs. Keine zusätzliche Nivellierung/Plattform/Inventargutschrift.

[W05-Nachreview](reviews/w05-followup-sockets-open.md):Trag- und Phasenfehler geschlossen;15Tests/schema/build/neueGPUprobe PASS. Die Quelle verlangt sichtbar zugänglichePowerOuts; zwei vollständig eingebettete/coplananre S0-Sockets bleiben technischer Qualitätsbefund. Eine eng freigegebene Sichtflächenkorrektur mit echtem RED läuft. MenschlicheArtabnahme bleibt NOT_RUN, kein neuer pauschalerOwnerblocker.

## W05 endgültiges Paketgate und W08-Start

W05 PASS bei26d5e892c2b401b9011234dabf86955af7462fb8:16 abschließende Fachtests,46 frühere betroffene Regressionen bei unverändertem Backend,3/3 Schema,Build und frische Chromium-GPUprobe mit100 echten Lebenszyklen. [Technischer Review](reviews/w05-final.md), [Git-/LFS-Abnahme](reviews/w05-final-commit.md), [vollständiger175-Pfade-Bericht](reviews/w05-package-report.md). Alle90 eigenen LFSreferenzen/74Objekte und156Manifest-Evidencepfade sind tatsächlich anGit gebunden;18Produktbytes identisch zum abgenommenen Snapshot. MenschlicheArtabnahme/Performance bleiben NOT_RUN. Eine unnötige globaleLFSprüfung fand fehlende historischeCacheobjekte außerhalb W05 und endete mit1; das unvollständige stdout bleibt [separat](reviews/w05-historical-lfs-check.json), ohne behaupteten Repositorygesamt-PASS.

W08 erhält nach bestandenem W02 den exklusiven Drei-Datei-Grant auf derselben Domainbranch mit tatsächlichem Ausgang26d5. CPU-/Browserlease wird nach tatsächlichem W03CLIabschluss an W08 übertragen; keine parallelen schweren Messläufe. W03 wartet bei gehaltenen Produktbytes auf unabhängiges Review.

## W03 Erstreview und frische Mainprüfung

[W03-Erstreview](reviews/w03-first.md) ist Spec/Quality FAIL wegen fehlender Maschinen-In-Port-/Owneradmission und fälschlich bestätigter Qualität bei fehlendem einzelnen Quellsample. Die belegten78Tests/Build/LegacyBrowser1 sind historische positive Nachweise dieses Erststands; kein fertiges W03-Gate. Echte enge Negativtests und Fixes erfolgen vor neuer Abnahme. Tatsächlicher W03Parent ist2c044, der dazwischen abgeschlossene W06-Evidence-only-Commit; der ursprüngliche5b596Grant bleibt unverändert nachvollziehbar.

Erneute RemoteMainabfrage um11:49:22UTC mit Exit0 bestätigt e40592c113b72a8dc93725187f92cf948e07f44d. Ursprünglicher workCheckout bleibt sauber. Zwei tatsächliche Produktwriter auf eigenen Branches/Worktrees: W03Integrator und W08Domain. Externe uncommitted Writer bleiben unbekannt; keine Mainänderung/Veröffentlichung.

## W09 normale Bedienaufnahme und W10 Anschluss

[Read-only Vorprüfung](reviews/w09-normal-flow-preflight.md) bindet tatsächliche Entry-/Clock-/Host-/Bootstrap-Callseams. Sieben exakte zusätzliche W09Integratorpfade und zwei W10Pfadanschlüsse sind nur geplant; kein Grant vor grünen Vorgängern. Der spätere normale16kg-Kreislauf muss frisch produzierte Profile/Blech, bestätigte Handmontage und tatsächliche bezahlte native Verwendung der5.8kg-Stütze zeigen. C08 sind drei Container, C09 sechs12kg-Fundamentschuhe laut unverändertem Freeze. Bestehende prozessierende Jobs dürfen ihre bestätigte Tickzufuhr nicht durch pauschales !isQuiescent sperren. Echte Pending-Publikation/Hold und Compounddisposal bleiben geschützt.

W03 neuer finaler Vierdatei-Seal03c47cbba6de6c378c6c63eed8ff47307319eb54511596d37f84ee486526ab05 ist unabhängigSpec/Quality/BytePASS: [Abschlussreview](reviews/w03-final.md). Die ergänzte R2-Testassertion war während vorherigemHold neu geschrieben worden; [damaliger Pendingbericht](reviews/w03-runtime-followup-pending-test.md) bleibt erhalten, neuer Seal und realer1-Fall-Lauf schließen genau diesen Zustand. Testphasen bleiben getrennt; Commit/Packagingbind steht noch aus, kein endgültigesW03-Paket-PASS aus dem Quellreview allein.

## W03 endgültiges Gate und reviewed Integrationsaufnahme

W03 PASS bei fee8f3bf4b971fc3a5e56884d245126b6b264b3d: [vollständiger92-Pfade-Bericht](reviews/w03-package-report.md), [endgültigerGit-/LFSreceipt](reviews/w03-final-commit.md). Alle87Artefakte/4Produktbytes sind committed passend;80frühere betroffeneChecks und spätere finaleCountertests/TypeScript werden korrekt getrennt berichtet. Kein FactoryGameplay-/Wetter-/Save-/Performance-PASS.

Der Integrator darf jetzt ausschließlich die unveränderten bereits abgenommenen W02-/W05-Commits10e1e3026610065206d8ac4b361d3f1686114dd8 und26d5e892c2b401b9011234dabf86955af7462fb8 auf seinen sauberen Branch übernehmen und deren Produktbytes vergleichen. W07-Produktwrites benötigen anschließend einen eigenen exakten Grant auf dem tatsächlichen integrierten Head. Kein Mainmerge/Push/Ändern fremder Worktrees.

## Reviewed Copy abgeschlossen; W07 tatsächlicher Start

W02 wurde unverändert auf427069727473e7542ab546c1fbef05cf36e2341d und W05 aufd5502ae7fd5431d58eda51bea062c54691ebe3c2 übernommen. [Tatsächlicher Receipt](reviews/w07-reviewed-integration-receipt.json) bindet22Produktbytes,218kopierteGitpfade und194Git/LFS-Artefaktreferenzen. Tests/Build dabei NOT_RUN, da keine Runtimeänderung. Auf diesem sauberenHead erhielt der Integrator den exakten25Pfad-W07Grant; native Installation, Support und Browsergates sind IN_PROGRESS und nicht PASS.

[W08 Erstprüfung](reviews/w08-first.md) ist Spec/Quality PASS ausschließlich für den unveränderten dreiteiligenSeal e3267d2fdf593043902ea2e795422bb2423e13cf554d9be9a1fda4b592e2f350. Der normaleW09Cutter benötigt gezielt8kg aus einem größerenParent; die bisherige automatische10kg-Maximalportion wäre unpassend. Derselbe Domainwriter darf eng eine optionale exakte nativeEntnahmemenge in seinen drei bestehendenW08Pfaden ergänzen, mit vorherigem echtem8kg-aus20kg-RED, neuemGREEN/Build, Seal und Nachreview. Die altePrüfung bleibt erhalten und ist kein finalesPaketgate für neueBytes. SchwereCLIläufe nutzen weiterhin eine serielleLease, aktuell kurzeW08Leihzeit während Integrator nurW07Tests vorbereitet.

## W08 gezielte Intakekorrektur geprüft; W09 Produktautorität

NeuerW08Seal1ddcf341c9233fb06b3fabde98ba7f2aa9eb919343a126247fe710d4ad3cfecb: [engesNachreview](reviews/w08-intake-followup.md) Spec/Quality PASS. Echte2AssertionFailures vorFix,14finaleTests PASS(raw15.02s,Wrapper15.406s),TypeScript/VitePASS(Wrapper4.694s),61frühere unveränderteRegressionen PASS. Originale historischeREDreceipts bleiben bytegleich; fehlendeCWDs sind als rekonstruierteMetadaten mitOriginaldigests und tatsächlichemExec/RUNbezug ergänzt, ohne erfundenenNeulauf. Das finaleCommit-/Git-/LFSgate ist noch offen.

[W09-Stützenaufnahme](reviews/w09-brace-use-preflight.md) bindetFP02s tatsächlich tragbares/platzierbaresREC05Produkt undFP03s1m-Familie. Der zusätzliche installationProfile-Pfad ist nurgeplant; eine kleine S0-Bodenstütze kann die5.8kg-Outputinstance einmalig in dieselbe bezahlteNativeOwneraufnahme bringen. Ihre konservativenMaße sind expliziter technischerVorschlag, keineQuellenwerte/Ownerfreeze/Traglast-/Plattformbehauptung. WeiterebedingtePfadänderungen erst nachtatsächlichemW07-Vertrag. [W07-nativePrüfliste](reviews/w07-native-review-checklist.md) ist unabhängigeRead-onlyVorbereitung, sämtlicheW07-Ausführungsgates noch offen.
