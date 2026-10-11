# FP06 W06 — unabhängiger Spec-/Qualityreview

Reviewbasis: `a30630dd7963c165c673df7ea1b46d52735752ef`, Branch `codex/hestia-fp06-integrator-2026-10-11`, Worktree `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`. Beurteiltes Produktpatch: `/workspace/.cloud-setup/fp06-w06-product-working.patch`; versiegelter 12-Pfad-Snapshot `/workspace/.cloud-setup/fp06-w06-product-working-hashes.json`, zuletzt `capturedAtUtc=2026-10-11T10:45:23.842374+00:00`. Runtime-Hosthash: `3fa34a158a9f257caefdd3f5c52764758a347a6f265d0449462e0a5c71758529`; Sessionhash: `25e7afcc2458bc247044e76e3543b0641923c5f7b64bcd4f2ed01ff811890907`; finaler E2E-Harnesshash: `01f8c2766ff9b435e6e53c6fe13829999bf2dbab9a5d12f04a70ff0f312ad2c1`.

Der Reviewer hat ausschließlich gelesen und diesen externen Bericht geschrieben. Keine Produktwrites, Tests, Browserprozesse, Commits oder Unteragenten. Frühere Browserergebnisse sind tatsächlich gelesene Integratornachweise, keine eigenen Läufe. Nach den Befundmeldungen autorisierte Root neue enge Fixes; dieses Urteil betrifft ausdrücklich den oben versiegelten Vor-Fix-Snapshot und nimmt deren Ergebnis nicht vorweg.

| Bereich | Urteil | Begründung |
|---|---|---|
| Specreview | **FAIL** | Reale Holdbenachrichtigung und einheitliche Resume-/Playguards fehlen; Evidence-Manifestprüfung unvollständig. |
| Quality-/Authorityreview | **FAIL** | R1/R2 sind konkrete Hostgrenzenfehler. Keine zweite World oder unabhängiger Timer gefunden. |
| Vorliegende Unit-/Type-/Buildnachweise | **PASS, begrenzt** | 197 Dateien/1835 Tests, zusätzlich finale 10 Session-/Evidencetests und TS/Build; die Befundpfade sind damit nicht bewiesen. |
| Browser vor letzter Harnessänderung | **FAIL** | Tatsächlicher serieller Lauf 3 PASS/3 FAIL; vollständiges Gate nicht bestanden. |
| Browser des versiegelten finalen Harness | **NOT_RUN** | Neue sieben Fälle auf einem testseitigen Context/page waren zum Reviewzeitpunkt nicht abgeschlossen. |
| Performance | **NOT_RUN** | Keine vergleichbare Baseline/Candidate-Messung; Trace-Latenzen sind Diagnose, kein Performance-PASS. |
| Schreibgrenzen/Snapshot | **PASS bis letzte Hashprüfung** | Genau 12 Produktpfade; alle 12 überprüften Bytes entsprachen dem letzten Snapshot. Zulässige Änderungen des E2E-Harness wurden getrennt neu gelesen. |

Gelesene Spezifikation: vollständiger W06-Brief, FP06 §8.1–8.2, W06/T025–T028 und §19.1–19.3; FP01 §13 vollständig; FP03 §§13–15 vollständig. Produkt: alle zwölf Patchpfade, tatsächliche `startHvp`-Komposition samt Lifecycle/Source/Native-/Consumer-/Save-/Renderanschlüssen, native Client-/Session-/Tick-/Worker-Holdpfade sowie tatsächliche HVP-HUD-/Inputwege. Quellen sind Anforderungen innerhalb des autorisierten W06-Scope, keine selbstständigen neuen Freigaben.

## R1 — P1: Echte native Holds werden vor ihren Beobachtern ausgefiltert

**Stelle:** `apps/weltraum-browser/src/hvp/hvpBootstrap.ts:2148` setzt `FactoryHostView.confirmed` nur für Running/Paused und die gemeinsame Safe-Generation. `:2155` sendet ausschließlich solche Views. `:2215` ruft diese Filterung bei normalen Hostframes auf. `src/factory/session/factorySession.ts:35–38` würde SimulationHold/CoverageHold/RecoveryHold zu RecoveryHold übersetzen, bekommt sie an diesem Anschluss jedoch nie.

**Trigger:** Die laufende native World erreicht SimulationHold (`physics/tick.ts:27`, realer Worker-Timer `physicsWorker.ts:81–100`), CoverageHold (`physics/session.ts:305–306`, `:193`) oder einen tatsächlich gehaltenen Recoveryzustand. Das nächste echte Read-Ack veröffentlicht den Status im Client (`physics/client.ts:174`). Der Host liest ihn, filtert ihn aber aus, bevor die Factorysession oder die zweite UI-Subscription ihn erhält.

**Actual:** Factorysession bleibt `Ready` mit altem Tick/Rest. `factoryEntry.ts:25` bleibt auf dem alten Label „Aktiv“; Stop-/Recoveryzustand und Capabilitygrenzen sind nicht projiziert. Tickcredit während des gehaltenen Views wird zwar nicht direkt gebucht, aber der Status-/Recoveryvertrag wird verletzt. Derselbe Filter verschweigt normale transient unbestätigte Terrain-/Consumer-/Neighborzustände. Epoch-/Sessionwechsel bei weiter bestätigter View werden im Sessionguard erkannt; bei unbestätigter View kommt auch diese Information nicht beim Observer an. `current()` schützt Dispose und Mountgeneration separat.

**Vorhandene Testlücke:** `hostLifecycle.test.ts:23–25` sendet jeden fake View direkt an die Listener, auch unbestätigte und gehaltene. Deshalb beweist `:74–80` den Sessionguard, nicht die echte Hostbenachrichtigung. `hvp-bootstrap.test.ts:510–532` prüft einen Busy-Read und Resumeablehnung, aber keinen Statuswechsel durch den tatsächlichen Bootstrap-Emitter.

**Minimaler notwendiger RED:** Aktuelle Bootstrapkomposition mit native-statussteuerbarem Physicsadapter und echter `mountFactorySession`-Extension: bestätigten Running-Tick binden, anschließend echten Hostframe mit SimulationHold/CoverageHold/RecoveryHold durchlaufen lassen; explizit sichtbaren Hold, unveränderten Rest/Schritt und keine Tickgutschrift prüfen. Ein direkter Mocklistener-Aufruf genügt nicht.

**Fixgrenze:** Hostzustände müssen beobachtbar sein, auch wenn sie keine Fachzeit freigeben. Transientes Coverage-/Neighborhold darf nicht in einen dauerhaften `factoryBlocked`-Zustand kippen, der seine erforderliche Neighborreparatur selbst blockiert. Ein quieszenter transienter HostHold mit null Credit und sicherem ReturnReady erst bei bestätigter nativer View ist technisch sinnvoll; echter RecoveryHold bleibt fail-closed. Auf `endSession` bei `factoryBlocked()` (`:2028`) achten: ein terminal gehaltenes Aggregat ist kein laufender Commit, den „abwarten“ repariert.

## R2 — P1: Resume/Play verwenden unterschiedliche Bestätigung und umgehen Nativeholds

**Stellen:** `hvpBootstrap.ts:2176–2178` prüft im Port den internen `confirmed()`-Predicate und speziell SimulationHold, verwendet aber nicht das eigene vollständige `read().confirmed` aus `:2148`. HVP-HUD `physicsCommand` (`:2091`) und `play` (`:2098`) prüfen für Factory denselben internen Predicate ohne NativeStatus. Er enthält bei `:1814–1816` Consumer-/Factory-/Neighbor-/Dormancyguards, aber keinen nativen Running/Paused-Guard.

**Konkreter Trigger 1:** Native SimulationHold bei sonst quieszenter aktueller World. Die Factory-Port-Resumehandlung lehnt bewusst ab. Der im selben Factoryentry sichtbare HVP-Knopf `#hvp-physics-pause` wählt bei jedem Nicht-Running-Status Resume (`hvpHud.ts:219–220`) und gelangt dagegen durch den Factory-HUDguard. Native `tick.resume()` (`physics/tick.ts:30–34`) verwirft Backlog und setzt Running. Die ReadView sagt unbestätigt, aber ein alternativer derselben Session gehörender Bedienweg setzt fort.

**Konkreter Trigger 2:** CoverageHold ohne bereits als busy/recovery ausgewiesenen Nachbarcontroller. Auch Port-Resume kann es durchlassen, weil nur SimulationHold ausgeschlossen ist. Native `session.resume/play` wirft bei `extraHeld()` (`session.ts:136`, `:313–317`); gewöhnliche Resume/Play-Fehler gehen im Worker über `physicsWorker.ts:185–187` in Worlddisposal. Ein bekannter gehaltenes ReadView muss vor Dispatch abgelehnt werden, statt seine eigene native World zu verlieren.

**Minimaler notwendiger RED:** Statuswechsel in actual Bootstrapadapter, alle Factory-Resume-/Playeingänge einschließlich Legacy-HUD und Spielerfortsetzung prüfen; erwartete Native-Commandanzahl null bei gehaltenem/unbestätigtem Host. Gegenprobe bestätigt Paused→Running auf demselben aktuellen Host. Normalprofil ohne Extension muss seine bestehende Policy behalten. Das ist eine Guardangleichung innerhalb freigegebener D11-Implementierung, keine neue Powerrestartpolicy.

## R3 — P2: Evidencechecker prüft JSONsyntax, keine Manifestreferenzen oder Dateidigests

**Stelle:** `tools/factory/verify-evidence.mjs:24–32`. Er parst JSON und fordert mindestens eine JSONdatei. Keine Stelle interpretiert `manifest.json`, `evidenceFiles`, Referenzpfade, vorhandene referenzierte Dateien oder ihren SHA256. Die aktuelle CI erklärt dieses Ergebnis bei `.github/workflows/browser-mainline-ci.yml:295` zur Voraussetzung des erfolgreichen Factoryuploads.

**Konkreter Input/Expected/Actual, statisch vollständig nachvollziehbar:** In einem sonst kleinen erlaubten Baum enthält `w06/run/manifest.json` etwa `{"evidenceFiles":[{"path":"../../outside.png","sha256":"0000000000000000000000000000000000000000000000000000000000000000"}]}`. Erwartet gemäß FP06 §19.2 ist Ablehnung einer die Rungrenze verlassenden Referenz. Actual geht durch JSON.parse, erhöht jsonFiles und endet erfolgreich; der Inhalt wird danach nie geprüft. Genauso passieren `path:"missing.png"` und falscher SHA256 einer vorhandenen Datei. Vorhandener bereits bestandener Test `hostLifecycle.test.ts:106–107` akzeptiert sogar `manifest.json='{"test":"real"}'`; das ist direkte Evidence für diese fehlende Semantik, kein hier ausgeführter neuer Test.

**Spezifikation:** FP06 §19.2 fordert „JSON/Manifestreferenzen und Hash-/Pfadgrenzen“. §19.3 bezeichnet die Placeholderhülle mit SOURCE_LOCK_REQUIRED/null Candidate/fehlenden Nachweisen explizit als nicht abschließbar; ein Manifestdateiname allein reicht nicht. Reine Syntax-/Budgetadmission darf keinen gültigen Paketabschluss suggerieren. Nicht-PASS-Logs und RED-Artefakte dürfen weiter hochgeladen werden; ihre Unabschließbarkeit muss sichtbar bleiben.

**Bereits gut:** Depth12, Entries4096 inklusive Verzeichnisse, Files4096, 32MiB/file, 8MiB/JSON, 256MiB/gesamt; Symlinks und Nichtdateien werden abgelehnt, vor großen JSONreads wird admitted. Keine Bibliothek oder globale Queue-/Timeoutänderung. Befund ist falsche Evidenceadmission, keine behauptete externe Ausführung oder Datenausleitung.

**Minimaler RED:** Fehlende referenzierte Datei, fremder/aufsteigender Referenzpfad, falscher Hash und nicht abschließbare PASS-Placeholderhülle; jeweils null erfolgreiche Admission. Gültiges tatsächlich lokal gehashtes Manifest zulassen. Paketstatus und rohe JSON-Captures voneinander unterscheiden.

## R4 — P2: „Neu starten“ nach Factoryende wechselt ungefragt zum Legacyprofil

**Stelle/Trigger:** `hvpBootstrap.ts:806` ist `restartAfterEnd` weiterhin fest an `/?hestiaPrototype=1` gebunden; `:2040` verbindet denselben Handler auch mit dem Factory-Endschirm. Echter Factory-Spieler beendet über „Sitzung beenden“ und klickt „Neu starten“.

**Actual:** Navigation geht zur alten HVP-Coast-URL; Factorypanel, Sessionextension und später das angenommene eigene Startsiteprofil sind verschwunden. Erwartet für den neuen isolierten Prototypeentry ist ein Neustart dieses Factoryprofils, während Normal-HVP seine alte Route behält. Der Browser-Disposefall prüft bisher Ende, nicht den nächsten Start. Vor W07/W09 darf dies kein stiller Profilwechsel werden.

## Positiv geprüfte Grenzen und Performanceeinschätzung

- `factory.html` bootet ausschließlich `factoryEntry.ts`; `main.ts` bleibt unverändert. Der einzige neue Factoryimport in altem Bootstrap ist `import type` (`hvpBootstrap.ts:1`). Keine neue Runtimefactory-Anforderung des Normalimports im Patch.
- Genau ein bestehender HVP-Mountguard (`:757–761`), ein vorhandener Renderer und ein vorhandener Physicsclient. Der neue Port exportiert keine ThreeScene, RapierWorld, CreateBody-, Mining- oder freien Terrainwritefähigkeiten. Die alten HVPwerkzeuge bleiben im Host verdrahtet; der Port selbst erteilt dafür keine neuen Factoryrechte. W07 muss weiterhin echte Support-/Terrainrevisionen und spätere Mutationsgrenzen prüfen.
- Native-Baseline nach echtem Hostaufbau. Sechs **neue** bestätigte Ticks werden in `factorySession.ts:39–45` ganzzahlig zu 100ms abgeleitet; wiederholter Tick erzeugt null Credit, Rücksprung/IDwechsel und unsichere Zahl schließen. Keine setInterval-/setTimeout-Zweitwelt. rAF dient als Beobachtung eines nativen Counters, erzeugt keine eigene DeltaTime-Fachzeit. W09 muss alle bestätigten Fachschritte tatsächlich auf seine Domainreduzierungen abbilden, nicht nur dieses Projektionszählwerk anzeigen.
- Portpause stoppt Playerinput, wartet echten nativen Pause-Ack und liest danach (`:2170–2173`); bei normalem bestätigtem Paused kann der letzte Tickrest verarbeitet werden. R1/R2 beschreiben seine fehlende Behandlung nichtnormaler Acks.
- Legacy Coldload wird bei Extension vor Storeöffnung zurückgewiesen (`:997–998`); Save/Load/LoadNew werden über denselben ehrlichen Ablehnungsgrund gesperrt (`:1975–1981`, `:2056–2059`). Kein separater Factorysave und kein Verlust behaupteter vorhandener Factorydaten. Gemeinsamer Save bleibt W10 und derzeit nicht verfügbar.
- Dispose setzt disposed sofort, hält die bestehende Lease bis async Cleanup settle (`:833–845`, `:904`), räumt Factory vor nativen/Renderowner ab und verwendet Epochschutz. Bestehender Bootstraptest prüft späte async Extension und fehlenden Zugriff auf Ersatzsession. Factorycallbacks neutralisieren unsubscribed/disposed/current; reale Browserdisposalevidence meldet 0owned workers/listeners/timers/jobs/bodies/colliders/bytes, nicht null process/GPUusage.
- Factory-Readview kostet konstante Snapshotreads plus zwei kleine Objektfreezes (`:2146–2151`); `physics/client.ts:201` gibt gespeicherten Snapshot zurück, kein Body-/Voxelvollscan im Factoryread. Es gibt dennoch vermeidbare pro-rAF-Allokation/Projection: Host sendet denselben View erneut, zweite UI-Subscription (`factoryEntry.ts:37`) schreibt JSON/Status auf jedem Frame; bei neuem Tick projizieren Sessionlistener und Hostlistener doppelt. Änderungsgebundene Projektion darf dies verkleinern, muss aber Hold-/Pause-/Terrainänderungen weiterhin liefern. Ohne Baseline kein quantifizierter Regressions- oder Performance-PASS.
- Vite registriert `index.html` und `factory.html` explizit mit bestehender Vite8-Konfiguration; Buildlog enthält beide. Ein neuer E2Epfad wurde nur in live angehängt; gespeicherter CI-Inventurlog meldet 42 Specs genau einmal. Aggregate, bestehende Altzuordnungen, Action-/Node-/LFSversionen und globale Timeouts bleiben gleich.

## Tatsächliche Evidence, Gate und nächste Prüfung

Evidencebasis: `apps/weltraum-browser/evidence/factory/w06/2026-10-11T101422.629584Z/` im genannten Worktree.

| Gelesener Nachweis | Ergebnis / Grenze |
|---|---|
| `red-session.txt` | 6 echte Fachassertions zunächst FAIL; Tickrest/Exklusivität/Dispose/Pause nachweisbar RED. |
| `red-host-hook.txt` | Actual Bootstrapextension fehlt, erwartete hostPort-Assertion FAIL. |
| `red-native-hold.txt` | Initialer fake RecoveryHold wird zunächst fälschlich akzeptiert, fachliches RED. Beweist noch keine spätere echte Hostbenachrichtigung. |
| `green-full-unit.txt` + `.exitcode` | `npm run test`: 197 Dateien,1835 Tests PASS,646,37s. |
| `green-host-regressions.txt` | Zwei Dateien,36 Tests PASS,191,50s. |
| `green-final-session-evidence.txt` + `.exitcode` | Eine Datei,10 Tests PASS. |
| `typecheck-final.txt/.exitcode`, `build.txt` | TS und vorhandener Build erfolgreich; Buildlog enthält ausgelieferte factory.html. |
| `green-browser.txt/.exitcode` | Trotz Dateiname tatsächliches FAIL: unter vorhandenen30s drei PASS (normal/duplicate/dispose), drei FAIL (pauseframes/persistence/resume). |
| `browser-serial-timing-diagnostics.json` | Native Uhrenassertions waren erfüllt; tatsächliche Bedienung erschöpfte vorhandenen30s: Klick6–7s, Reads1,5–2s,12rAF6,63s,Screenshot3,55s. Kein Beleg neuer Timeoutpolicy oder vergleichbarer Performance. |
| Finaler `factory-host.spec.ts` | Ein normaler testseitig besessener Context mit tatsächlicher baseURL und Trace, Ready eigener Fall, dann derselbe Host für duplicate/pause12rAF/alle Legacywege/resume/dispose. Keine TestBridge, Stateinjektion, Zeitgeschenke, Entfall der Assertions oder Timeoutänderung. Ergebnis **NOT_RUN** zum Reviewzeitpunkt. |

W06 bleibt vor dem nächsten abhängigen W07-Integrationsgate offen. Zuerst enge R1/R2-Host-RED/GREEN und R3-Evidencereferenz-RED/GREEN, anschließend frischer versiegelter Snapshot und unabhängiges Nachreview; Browserprüfung allein auf der freigegebenen Hardwarelease. Bereits vorhandenes Unit-PASS bleibt ehrlich beobachtete Vor-Fix-Evidence, keine Freigabe der gefundenen ungeprüften Pfade. Finales Manifest/review.md/Paketreceipt und Candidatecommit waren beim beurteilten Arbeitsstand noch nicht abgeschlossen.

Letzte unabhängige Byteprüfung vor Schreiben dieses Berichts: 12/12 Pfade stimmen mit dem Snapshot `2026-10-11T10:45:23.842374+00:00` überein, keine Hashmismatches. Nachfolgende ausdrücklich grantete Fixes erfordern neue Hashes und eigenes Urteil.
