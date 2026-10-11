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

Three.js/HVP/Voxel/Physics/Save bleiben erhalten. Resources ist alleinige Warenautorität; UI liest Snapshots und sendet Commands. Genau ein Integrator `/root/fp06_integrator` besitzt gemeinsame Contracts-, Host-, Physics- und Savegrenzen. Höchstens ein weiterer isolierter Domain-/Assetwriter darf parallel arbeiten. Aktuell gibt es den Dokumentationswriter `/root` sowie genau zwei isolierte Produktwriter: `/root/fp06_integrator` auf `codex/hestia-fp06-integrator-2026-10-11` für W06 und `/root/fp06_domain` auf `codex/hestia-fp06-domain-2026-10-11` für W05. Die tatsächlich delegierten Audit-/Review-/Preflightagenten arbeiten read-only. W01 hat nach der konkreten Portkorrektur sein unabhängiges Gate bestanden; Die Nutzerantworten „D03-Policy freigeben“ und „Startplatz-Fixture freigeben“ lösen seit 10:34:17 UTC die beiden zusätzlichen konkreten Ownergates; noch offene Paketgates bleiben davon getrennt.

## Implementation phases

| Paket | Abhängigkeiten | Geplante Rolle | Jetzt |
|---|---|---|---|
| W00 | keine | /root Dokumentation | PASS: Baseline und unabhängiges Review |
| W01 | W00 | /root/fp06_integrator | PASS: a30630dd7963c165c673df7ea1b46d52735752ef, 46 Tests/Build/Review |
| W02 | W01 | /root/fp06_domain, eigener Worktree | PASS technisch: 10e1e3026610065206d8ac4b361d3f1686114dd8, 61 Tests/Build/Cargo1/Review; initiale TDD-Abweichung FAIL/NOT_RUN bleibt |
| W03 | W01 | /root/fp06_integrator | NOT_RUN: Ownerpolicy freigegeben; nach frei gewordenem Integratorslot |
| W04 | W02/W03 | /root/fp06_integrator | BLOCKED: Vorgänger; D05 freigegeben |
| W05 | W01 | /root/fp06_domain, eigener Worktree | IN_PROGRESS: echter neuer Grant auf sauberem Domainbranch, Fachtests zuerst |
| W06 | W01 | /root/fp06_integrator | IN_PROGRESS: echter Host-/Browser-RED, fokussiertes GREEN; vollständiger Paketgate offen |
| W07 | W02/W05/W06 | /root/fp06_integrator | BLOCKED: Vorgänger; D11 freigegeben |
| W08 | W02 | Domainwriter | BLOCKED: Vorgänger; D06 freigegeben |
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
- [ ] W06: echte Host-/Kadenz-/Browser-REDs; vollständige frische Unitsuite 197 Dateien/1835 Tests PASS, 10 Session-/Evidencefälle PASS, Build/Typecheck PASS. Browser 3/6 PASS, übrige Fälle erschöpfen 30-s-Gesamtbudgets; tatsächliche Traces gesichert, fortlaufender normaler Sessionflow wird ohne Limitänderung geprüft. Host-Codeprüfung läuft, Endgate/Commit offen.
- [x] Browserprüfungen erhalten eine ausdrückliche serielle Lease für Port 5174; unveränderte 30-s-/5-s-/20-s-Defaults aus der vorhandenen Playwright-Konfiguration. Externe Umgebungsconfigs ändern ausschließlich Port und eigene Evidence-Ausgabepfade, keine Produktkonfiguration. W06s noch fehlgeschlagener kombinierter Browserfall wird in fokussierte reale Bedienfälle zerlegt und nach Unitabschluss seriell geprüft; kein neuer Timeout angenommen.
- [ ] W05: Fachtestcode und Sourceprüfung zuerst; CPUjobs erst nach ausdrücklicher Lease, keine Runtimeimplementation vor BusinessRED.
- [ ] W03/W04/W07–W11 je Paket RED/GREEN/Regression/Review/Evidence/Commit-Gate.

## Definition of Done

W00 ist abgeschlossen, wenn Basis-/Hash-/Baselinebelege, klare Locks, ehrliche Decisions, unabhängiges Review und vollständiger Commit-SHA vorliegen. W00 darf mit dokumentierten offenen Folgegates abgeschlossen werden. W01–W11 sind erst abgeschlossen nach ihren tatsächlichen Fach-, Browser-, Save-, Material-, Energie- und Reviewgates; NOT_RUN/BLOCKED bleibt sichtbar. Die abschließende Paketübersicht enthält Agent/Branch, vollständigen SHA, geänderte Dateien, Tests, Review/Evidence und nächste Blocker.

## Review-Fixprotokoll

Erstreview FAIL wegen R1 falscher Shared-Physics-/Save-/Workflowpfade und R2 Planprosa als Dateipfade. Reale `src/hestia-prototype`-Pfade und `browser-mainline-ci.yml` aufgenommen, Bootstraptest geschützt, vorhandene geschlossene Save-/Main-/Lockfileverträge als Read-only geschützt. Prosa in reine individuelle Pfade und separate Restriktionen aufgelöst; Branchüberschneidungen frisch neu erhoben. Ein Folge-Review prüft genau diese Änderungen und die inzwischen eingetroffenen Nutzerfreigaben.

`git diff --cached --check` meldet Exit 2 ausschließlich bei unveränderten Rohlog-Whitespace/EOF-Leerzeilen. Kein Produktcode betroffen; kein pauschal sauberer Gesamtdiff behauptet. Rohlogs bleiben bytegenau erhalten.
