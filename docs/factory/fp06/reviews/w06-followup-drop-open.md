# FP06 W06 — unabhängiges R1–R4-Nachreview

Beurteilte Basis: `a30630dd7963c165c673df7ea1b46d52735752ef`, Integratorworktree `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`. Fixsnapshot `/workspace/.cloud-setup/fp06-w06-product-working-hashes.json`, `capturedAtUtc=2026-10-11T10:57:23.337183+00:00`, zwölf `productFiles`. Patch `/workspace/.cloud-setup/fp06-w06-product-working.patch` hat erwarteten SHA256 `2e2afaa87f63fdf76b36468c6a15bc1c68b3887804cc610cb95798ff4d6e7cbb`. Beide Bindungen zu Reviewbeginn tatsächlich geprüft; 12/12 Produktbytehashes stimmen.

Read-only Review; ausschließlich dieser Bericht geschrieben. Keine Produktwrites, Teststarts, Browserprozesse, Commits oder Unteragenten. Erstbericht und Vorfixevidence bleiben erhalten; dessen Urteile werden nicht überschrieben.

| Urteil | Status | Grund |
|---|---|---|
| Specreview R1–R4 | **FAIL** | R1/R3/R4 korrigiert; R2 enthält noch tatsächlichen ungeprüften Native-Restart über HUD-Drop. |
| Quality-/Authorityreview | **FAIL** | Bekannter unbestätigter Nativezustand kann über vorhandenen Drop-Button trotzdem resumed werden. |
| Selektiertes erstes GREEN | **PASS, begrenzt** | Gelesener Integratorlog:24 Tests PASS,26 skipped; kein Vollregressions-PASS daraus. |
| Vollständige betroffene Host-/Sessiondateien | **PASS, begrenzt** | Während des Reviews abgeschlossen:50 Tests PASS,2 Dateien,214,34s,exit0; Drop-Rest war nicht enthalten. |
| Finaler Typecheck/Build nach Fix | **PASS, begrenzt** | Neu gelesenes `build-r1-final.txt`:tsc+Vite erfolgreich,exit0; noch vor offenem Dropfix. |
| Browser nach Fix | **NOT_RUN / laufend** | Neues tatsächliches Hostbediengate lief noch; nur erste3 Fälle abgeschlossen. Vorfix3PASS/3FAIL bleibt historisch FAIL. |
| Finales Manifest/Paketreceipt/Commit | **NOT_RUN** | Noch offen. |
| Performance | **NOT_RUN** | Keine neue Baseline/Candidate-Messung; Harnessaufteilung erzeugt keine Performancefreigabe. |

## R1: Holdbenachrichtigung — geschlossen im beurteilten Code

`hvpBootstrap.ts:2156–2160` sendet alle aktuellen Views, auch unbestätigte Nativeholds. `read()` (`:2147–2154`) bindet dieselbe Terrain-/Nativegeneration und erteilt bestätigten Tickstatus weiterhin nur bei Running/Paused plus gemeinsamer Safe-Generation. `hostPort.ts:18` dokumentiert explizit, dass die Subscription informative unbestätigte Holds enthalten kann.

`factorySession.ts:33–51` unterscheidet nun:

- Native CoverageHold/SimulationHold oder sonst unbestätigter laufender View: `WaitingForHost`, unveränderte Steps/Elapsed/Rest/nativeTick, keine Fachgutschrift.
- `isQuiescent` bei `:61` bleibt für WaitingForHost true, sodass die erforderliche Neighbor-/Coverage-Reparatur nicht von ihrer eigenen Factoryprojektion gesperrt wird.
- ReturnReady nur bei erneut tatsächlich bestätigter Running/Paused-View. Bei gleichem Nativecounter wird ausschließlich das Label wiederReady; bei höherem Counter werden die tatsächlich neu bestätigten Ticks einmalig mit dem bestehenden Rest verarbeitet.
- Native RecoveryHold/Disposed, Session-/Epochbruch, rückläufiger oder unsicherer Tick: terminaler RecoveryHold. Späterer Running-View kann ihn nicht aufheben.

Neue actual-Bootstraptests `hvp-bootstrap.test.ts:542` gehen durch den echten Emitter und echte `mountFactorySession`; sie ersetzen den früher allein direkten Mocklistenerbeweis. Der Fakephysicsadapter steuert den gelesenen NativeStatus, baut keine zweite World. `hostLifecycle.test.ts:95–112` prüft nullCredit und ReturnReady zusätzlich headless.

**Sicherer Endpfad:** Die heutige reine Uhrsession hat keine offenen Material-/Publicationtransaktionen; `canEndSession` (`factorySession.ts:63`) erlaubt deshalb ihren geordneten Dispose auch im terminalen Hold. Die tatsächliche Entryextension reicht diese Capability ausdrücklich weiter (`factoryEntry.ts:41`). Der Host fragt sie bei `hvpBootstrap.ts:2030`; ohne optionale Capability gilt weiterhin `isQuiescent` als Default. Sonstige Pending-/Save-/Neighbor-/Consumerbarrieren bleiben bestehen. Cleanup läuft unverändert awaitbar vor nativen/Renderowner und hält die Mountlease bis zum Ende. Test `hvp-bootstrap.test.ts:621` prüft Ende im RecoveryHold ohne Resume; Busyextension ohne neue Capability wird weiterhin am Ende abgewiesen (`:531ff`). W09 darf diese Clock-only-Capability nicht ungeprüft auf echte offene Commits übernehmen.

**Keine neue zweite Authority:** Fachzeit bleibt Ableitung des nativen Counters. UI wartet sichtbar (`factoryEntry.ts:24–28`) und aktiviert Controls nur bei Ready **und** nativer Bestätigung. Terminale Consumer-Recoveryzustände bleiben zusätzlich in den bestehenden Safe-Generation-/Controllerguards gehalten; aus `confirmed=false` allein werden keine neuen Quell- oder Miningrechte abgeleitet.

## R2: Gemeinsamer Resume-/Playguard — größtenteils korrigiert, Drop-Rest offen

`factoryCanResume` (`hvpBootstrap.ts:785`) verwendet nun tatsächlich `readFactoryView().confirmed` und hidden. Port-Resume (`:2180`), HVP-HUD-Resume (`:2094`), HUD-Play (`:2101`) und der existierende Spielerinput-Blockedpfad (`:1347`, einschließlich „Spiel fortsetzen“/Pointerlock) verwenden denselben Guard. Native Coverage-/Simulation-/Recoveryhold wird vor diesen Dispatches abgewiesen; alte Profile ohne Extension behalten ihre bisherigen Wege. Neue Tests `hvp-bootstrap.test.ts:573` prüfen Port, HUD, Pointerlockstart und Spielerfortsetzung mit null zusätzlichem Nativecommand auf allen drei Holds.

### Offener P1-Rest: „Fallkörper neu starten“ resumiert dieselbe native World ungeprüft

**Trigger:** Factory-HVP ist im echten SimulationHold, eigene `read().confirmed=false`, Session `WaitingForHost`. Spieler klickt den normalen sichtbaren Button `#hvp-physics-drop` („Fallkörper neu starten“).

**Pfad:** `hvpHud.ts:222` ruft `physicsCommand("Drop")`. Neuer Hostguard `hvpBootstrap.ts:2094` gilt ausdrücklich nur für `kind === "Resume"`; Drop wird bei `:2098` trotzdem dispatched. Native `physics/session.ts:429–433` prüft Terrain-/Moving-/extraHeld, aber keinen SimulationHold, setzt die Dropbodypose neu und ruft **`tick.resume()`**. `physics/tick.ts:30–34` verwirft Backlog und setzt die WorldRunning. Beim nächsten Read-Ack kann WaitingForHost wiederReady werden. Bei Coverage-/Recoveryhold kann derselbe ungeprüfte Drop stattdessen bis zum nativen Throw und bisherigen Workerfailpfad gelangen.

**Expected:** Jeder tatsächliche Factory-Bedienweg, der diese World fortsetzt, muss denselben bestätigten Native-Readguard prüfen. **Actual:** Der zweite Resume/Playguard ist erfolgreich vereinheitlicht, aber der vorhandene World-Restartcommand Drop bildet noch einen anderen Eingang. Testschleife `hvp-bootstrap.test.ts:591ff` betätigt bisher Resume/Play, nicht Drop.

**Enger erforderlicher Fix/RED:** Factory-HUDguard auch auf Drop anwenden; normale Legacyprofile unverändert. Im tatsächlichen Bootstraptest während SimulationHold/CoverageHold/RecoveryHold zusätzlich `#hvp-physics-drop` betätigen und null neue Nativecommands verlangen. Gegenprobe für erlaubten Drop bei bestätigtem aktuellem Paused/Running-Host. Keine neue Timeout-, Queue- oder Powerrestartpolicy nötig.

Dieser verbleibende R2-Pfad wurde Root sofort mit Trigger und Zeilen mitgeteilt. Bis zu seinem Fix und frischem Snapshot ist ein vollständiges R2-/Quality-PASS falsch.

## R3: Manifestreferenzen/Dateidigests — geschlossen innerhalb der Evidenceadmission

`verify-evidence.mjs:33–44` prüft Referenzpfad und SHA256form; leere Pfadsegmente, `.`/`..`, absolute/Drive-/Backslash-/NULpfade sind unzulässig. `:48–57` fordert versioniertes Hestia-FP06-Manifest plus gebundene Artifacts/EvidenceFiles, statt beliebiges `{}` als Manifest gelten zu lassen.

`artifacts`/`evidenceFiles` werden bei `:59–70` ausschließlich gegen bereits im begrenzten lokalen Baum admitted Dateien aufgelöst. Fehlende Datei, Digest-/Bytesmismatch und doppelte Referenz lehnen ab; keine Symlink-/Außenpfadverfolgung. Die vorher befundeten Inputs mit `../../outside.png`, `missing.txt`, falschem SHA und `{"test":"real"}` erreichen keinen erfolgreichen Abschluss mehr. Tests `hostLifecycle.test.ts:121–143` decken sie jeweils ab; `:146–159` bindet zusätzlich Commands/Verification/Review und echte mutierte Artifactbytes.

**Historische Quellbytes:** `productFiles` (`verify-evidence.mjs:72–75`) wird ausdrücklich nur auf Pfad-/Hash-/Byteform geprüft; es sind Receipts zu ihrem jeweils verzeichneten historischen Commit. Der Prüfer liest nicht fälschlich heutige HEAD-/Worktreebytes gegen alte W01-Hashes. Ausgabe bei `:90` beschreibt genau diese Grenze. Tatsächliche lokale Runartifacts werden dagegen vollständig SHA256-geprüft. Alle drei vorhandenen W00/W01-Manifeste benutzen passende `/v1`-Schemaformen und lokale Artefaktlisten; ihre semantischen damaligen Gate-/PENDINGzustände bleiben unverändert.

**Abschlussgrenze:** Dieser Checker prüft die Admission vorhandener Evidence, nicht Fachtests, unabhängigen Review oder die Vollständigkeit eines Paketreleases. Finaler W06-Receipt braucht weiterhin tatsächlichen Kandidaten-/Source-Lock-/Command-/Gatebeleg. Die FP06 §19.3-Placeholderhülle besitzt weder hier unterstütztes Evidence-Schema noch gebundene Artefakte und wird abgelehnt; ein vorhandener RED-/PENDINGrun darf mit gültigen lokalen Artefakten weiterhin hochgeladen werden. Aus uploadbarer Evidence wird kein Gameplay-PASS.

**Kleine verbleibende Testqualitätlücke, kein fehlender Runtimebudgetguard:** Directorybudgettest `hostLifecycle.test.ts:165` und Oversizetest `:173` verwenden jetzt `manifest.json='{}'`. Wegen neuer Manifestablehnung würden beide exit1-Assertions auch ohne jeweils betroffenen Budgetguard grün bleiben. Ein gültiges gebundenes Manifest oder eine konkrete `stderr`-Assertion auf Entry-/Bytebudgetfehler macht den Nachweis wieder ursachenspezifisch. Die actual Runtimebudgets stehen weiterhin vor Reads/Admission und blieben unverändert. Diese kleine Grenze wurde Root separat gemeldet.

## R4: Factory-Neustartroute — geschlossen

`hvpBootstrap.ts:808` führt nach geordnetem Ende bei Extension zu `/factory.html` (optional `?hvpMeasure=1`), während Normal-HVP seine bisherige `/?hestiaPrototype=1`-Route behält. Vorhandenes Profil-/Sourcefixture wird dadurch nicht gewechselt. Actual-Hosttest `hvp-bootstrap.test.ts:608` klickt echten End-/Neustartknopf im Fake-DOM-Host und prüft die Navigation; das ersetzt eine bloße Stringprüfung. Echte Browserbedienung nach allen Fixes bleibt gesondertes noch ausstehendes Gate.

## Verification und Abschlussgrenze

Gelesene neue Evidence im tatsächlichen `evidence/factory/w06/2026-10-11T101422.629584Z/`: `green-r1-targeted.txt`/`.exitcode` dokumentiert `vitest run tests/unit/hvp-bootstrap.test.ts tests/unit/factory/hostLifecycle.test.ts -t W06|FP06 W06`,24PASS/26skipped,58,53s. Im Laufe dieses Reviews schloss `green-r1-host-regressions.txt` tatsächlich vollständig mit50PASS/2Dateien/214,34s undexit0. `build-r1-final.txt` undexit0 dokumentieren den frischen tsc+Vite-Build. `green-browser-r1-serial-runner-trace.txt` enthielt noch nur3 abgeschlossene PASS-Fälle (normal,Entry,duplicate); daraus folgt kein abgeschlossenes Browsergate. Keine eigenen Läufe; noch ausstehende Browser-/Evidencebelege bleiben offen, der neu befundete Dropweg ist auch in diesen50 Tests nicht enthalten.

Unverändert: genau zwölf Produktpfade, derselbe HTML-/CI-/Vite-Scope, normale Flight-/HVPimports ohne Factoryruntime, kein NativeWorldexport, kein neuer unabhängiger Timer, keine neuen Abhängigkeiten/Versions-/Globalbudgetänderungen. Read-/DOMprojektionskosten sind weiterhin ungemessen; die Harnessaufteilung ist kein Performancebeweis.

Nächster enger Integratorschritt ist der offene Dropguard mit wirklichem Bootstrap-RED/GREEN sowie ursachenspezifische Budgetassertions. Danach neuen Byte-/Patchsnapshot versiegeln, diesen Rest unabhängig nachprüfen und nur die tatsächlich erforderlichen noch offenen Gatebefehle abschließen. W06 als Ganzes bleibt bis dahin offen.

**Abschließende Snapshotfortschreibung:** Während des read-only Reviews ersetzte der Integrator die Snapshotdatei durch `capturedAtUtc=2026-10-11T11:02:41.090831+00:00` (Patch SHA256 `ba1f0f813ffb16dc318831a423222e1b82cc636ebbb040eb53f4021cf09e1592`). Alle befundeten Runtime- und Unitdateien haben dieselben Bytes wie zu Reviewbeginn. Ausschließlich E2E-Harness besitzt jetzt SHA256 `e69942f50c459fe81c793a5ae20b882634bf8c2cfba902894be3c299026caa16`: manuelles zusätzliches Contexttracing entfernt, ein Context/page mit realer baseURL und alle sieben Bedien-/Assertfälle bleiben. Diese Änderung wurde gelesen; kein neuer Runtime-/Authorityscope. Abschließender Hashvergleich zeigte12/12 aktuelle Produktpfade passend zu dieser Fortschreibung. Der offene Dropguard ist weiterhin im tatsächlich gelesenen Runtimecode vorhanden.
