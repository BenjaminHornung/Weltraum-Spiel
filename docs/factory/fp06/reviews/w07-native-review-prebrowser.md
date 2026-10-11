# W07 unabhängiges Native-/Quality-Review — vorheriger Prebrowser-Seal

Reviewphase: `pre-second-browser candidate; NOT final gate`. Unabhängiges read-only Native-/Code-/Contractreview; keine Tests, Builds, Browser-/Profiljobs, Produktänderungen oder Unteragenten gestartet.

**NATIVE_CONTRACT: FAIL — R1. NATIVE_CODE_QUALITY: FAIL — R1/R2.** Vollständiges Paket-Spec-/Hostboundaryreview liegt parallel beim Architekturreviewer; hier kein Urteil über dessen Gesamtumfang. Kein endgültiges W07-PASS. Root hat nach diesen Findings und dem tatsächlichen zweiten Browser-Fail die Produkt-Hold eng für Korrekturen aufgehoben; dieser Bericht bleibt unverändert die frühere Reviewphase. Ein neuer Seal und gezielte Nachprüfung können die Findings schließen.

## Tatsächlich gebundener Kandidat

Basis/Integrator-HEAD `d5502ae7fd5431d58eda51bea062c54691ebe3c2`; Branch `codex/hestia-fp06-integrator-2026-10-11`, Worktree `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`.

- Patch `/workspace/.cloud-setup/fp06-w07-before-second-browser.patch`: SHA256 `bc0986f9b508751644e6f392073caa8da293919b3d689dd96fe8df50c47909c1`, 164001 Bytes.
- Snapshot `/workspace/.cloud-setup/fp06-w07-before-second-browser-files.json`: SHA256 `a8e60ebe89686ed491f4d021b55d80fedeef5afb63c90e0727aec91efb675d95`, Zeitpunkt `2026-10-11T13:40:10.530075+00:00`.
- Beim initialen Rebind stimmten alle **27** tatsächlichen Produktdatei-SHA256/Bytegrößen mit dem Snapshot überein; das Set entsprach exakt dem aktuellen 27-Pfade-Grant. 23 Diffheader lagen ausschließlich in diesem Grant; übrige gewährte Snapshotdateien waren unverändert. Kein Commit-/Git-/LFS-Admissionclaim für diesen Arbeitskandidaten.
- Nach der ausdrücklichen Rootfreigabe neuer Writes waren beim letzten Read `tests/unit/factory/placement.test.ts` und `tests/unit/factory/facilitySession.test.ts` gegenüber diesem früheren Seal geändert. Der Root wurde darauf hingewiesen. Neue Testbytes werden ausdrücklich **nicht** rückwirkend dem alten 24-PASS-Lauf zugerechnet.

Nativeadapter, native Client-/Worker-/Sessiondiffs, Cargo-/Materialaufnahme, Hostport/-Session und relevante Bootstrap-/Admission-/Projection-/Cleanupbereiche wurden tatsächlich gelesen. Referenz ist außerdem die zuvor gelesene feste native Basis. Zahlen und Findingzeilen unten beziehen sich auf die frühere Sealphase, nicht auf kommende Korrekturen.

## Konkrete Findings

**R1 — P1 — Eine zweite Facility kann den reservierten ursprünglichen Cargo-Owner übernehmen.**

`apps/weltraum-browser/src/hestia-prototype/physics/factoryFacilitySession.ts:129` lehnt Duplikate ausschließlich gegen `owners[]` ab, obwohl initialCargo ein separater bereits existierender Owner ist. Der PurePlanner prüft ebenso nur `installations[]` (`src/factory/construction/placement.ts:58`).

Konkreter gültiger Trigger: vorhandene, geöffnete Cargoansicht; normale zulässige Cutter-BOM/Support-/Freiraum-/Actorposition; frische transactionId; `instanceId = ownerId = "fp02_wreck_owner"`. Diese ID erfüllt `isSaveSafeResourceId`. Weder NativePrepare noch PurePlanner enthält für sie eine Reserve-/Duplikatsperre. Damit entsteht unter derselben Owneridentität eine zweite feste Facility zusätzlich zum initialen Cargo-Body.

Das hat eine konkrete Hostfolge: `hvpBootstrap.ts:2222` benutzt `factoryCosts.set(request.instanceId, ...)` und ersetzt für diese ID den initialen Cargobeitrag; `:2231` benutzt `factoryScenes.set(scene.id, scene)` und ersetzt die vorhandene Cargo-Scene. Native Cargo, logische Facility und Projection-/Kostenregistrierung besitzen dadurch widersprüchliche Owner-Membership. Das muss vor nativer/Renderer-Allokation im PurePlanner und an der privaten Nativeadmission abgewiesen werden, ohne BOM-/Owner-/Kostenänderung. Der entsprechende echte Negativfall war im früheren Sealtestset nicht enthalten.

Präzisierung eines frühen Hinweises: Das zuvor zusätzlich genannte Beispiel `hvp-drop` ist **kein** belegter Trigger; sein Bindestrich scheitert bereits an der Resource-ID-Regel. Dieses Finding stützt sich ausschließlich auf die tatsächliche gültige Cargo-ID und die oben benannten Maps.

**R2 — P2 — Der neue Legacy-Checkpointguard fragt Cargo noch nach Native-Dispose ab.**

`apps/weltraum-browser/src/hestia-prototype/physics/session.ts:235` ruft `facilities.read()` im neuen Guard auf, bevor `:236` `disposed` prüft. Konkreter Trigger: Session mit initialCargo erzeugen, `session.dispose()` ausführen, anschließend direkt `session.checkpoint()` aufrufen. `dispose():450` hat bereits `world.free()` ausgeführt; die vorgezogene Cargoabfrage erreicht `factoryFacilitySession.ts:99–100` mit `cargoBody.translation()/rotation()` und Nativeworldlookup. Der Guard muss die entsorgte Session zuerst sicher ablehnen.

Der Worker verweigert spätere Befehle nach Dispose und schützt somit den normalen IPC-Pfad; die neue direkte Session-API-Grenze bleibt trotzdem inkorrekt. Das ist eine zusätzliche Checkpointstelle, nicht das bereits korrigierte normale `session.read()`.

## Tatsächlich nachvollzogene positive Grenzen und verbleibende Reichweite

- Ein private Rapier-Worldowner bleibt bestehen. Native Facility ist ein begrenzter eigener Fixed-Adapter; UI und Renderer erhalten benannte Befehle/projizierte Fakten. InitialCargo/Open befinden sich im selben vorhandenen Native Sessionadapter, und der ursprüngliche vollständige C01–C28-Resourcescontainer wird einmal beim exklusiven Factorymount aufgenommen. Der S0-Körper erzeugt keine Materialmenge, kein Salvage und keinen Flugantrieb.
- Cargo hat geschlossene immutable Source-/Profilbytes, Pose/Access außerhalb der Maschinenzone, Source-Slotprüfungen und echte native Support-/Freiraum-/LOS-/Reachqueries. Native Open bindet Owner/Profil/Terrain-/Facilityrevision und idempotenten Receipt; UI-Openstate wird aus diesen Fakten gelesen. Der aktuelle Reach/BOMweg bleibt bewusst cargo-lokal; entfernte W09-Bauten benötigen den angekündigten endlichen Pickup→NativeWalk→Depositweg.
- Vorbereitung geschieht nach bestätigter Pause und mit Disabled-Candidate-Members. Snapshot-Membership enthält tatsächliche alte Body-/Colliderobjekte/Handles, relevante Body-/Colliderfacts, Friction, Primitiveextent und Shapeidentität; Candidatepose und Enabledphase werden geprüft. Rollback entfernt den neuen Body samt Collidern, aktualisiert Scenequeries und prüft alte vollständige Membership und Revision. Nicht belegte Wiederherstellung bleibt RecoveryHold; Finalize prüft Candidate/Altbestand erneut. Keine Collidercount-only-Rückerstattung.
- Facilityhold wird in Schritt-/Resume-/Play-/Drop-, Neighbor-/Residency- und Workerrelease-Grenzen berücksichtigt. Alte Worldfamilien bleiben in ihren bestehenden Listen; Cargo wird separat ausdrücklich aufgenommen. Der normale disposed→`read()`-Zugriff ist im Seal mit `!disposed` geschützt; dies ist tatsächlich Gegenstand der vorherigen Logs23/25. R2 betrifft den separat noch fehlenden Checkpointschutz.
- InitialOwner zählt beim 16-Facilitylimit mit. 64 Gesamtbodies inklusive Dormant, 32 Dynamic und 4096 Collider bleiben unverändert. Hostadmission zählt initialCargo, gestagte/aktive/Geistrepräsentationen und konservative Prepare-Kopien/-Memberfacts vor der entsprechenden Allokation. Nativebytes werden ehrlich als unsupported gemeldet. Kein Timeout-/Queue-/Dependency-/Legacyfamilienupgrade im gelesenen Nativediff. Diese Prüfung macht keinen separaten Peakmemory-Messclaim.
- Legacy-Checkpoint/-Save/-Load lässt vorhandene Facilities/Cargo nicht still aus. Vollständige Combinedaufnahme ist ausdrücklich W10 und hier NOT_RUN. Ohne Factoryprofile bleiben normale Source-/Native-/Vegetationwege erhalten; tatsächliche breit gebundene DefaultCoast-Endregression ist kein hier behaupteter neuer Lauf.

## Tatsächlich gelesene vorhandene Laufprovenienz

Eigener Run: `apps/weltraum-browser/evidence/factory/w07/2026-10-11T122211.412749Z`. Die folgenden vorhandenen Log-/Exitdateien wurden gelesen; keine Wiederholung gestartet. Gzipraw und lesbare Texte stimmen für alle fünf Phasen nach **beidseitiger** ANSI-, Zeilenend- und Zeilenendwhitespace-Normalisierung überein. Unveränderte Originalbytes besitzen weiter jeweils ihre eigenen Digests; Normalisierung behauptet keine rohe Bytegleichheit.

| Phase | Tatsächliches Ergebnis | SHA256 lesbares Log |
| --- | --- | --- |
| 23 Native disposal/member Business-RED | 3 FAIL / 4 SKIP, exit 1; actual `null pointer passed to rust` plus fehlende Mutationrejections | `31948805735910dd0950bd205b0ef0348e9b79d0fb8d3f425a71199479a1a50e` |
| 24 Extent/candidate Business-RED | 2 FAIL / 7 SKIP, exit 1 | `4634e57fc09c27a5fbb4ef795747f9009ba8ea08c79987fc2916269d99973db0` |
| 25 Native/source/member Fokus-GREEN | 24 PASS / 3 Testdateien, exit 0 | `e71e4b32efae01f62f55d97d2168db2c58a30b2c0a8519f21d87f04aab07e3ec` |
| 26 Integrity-Build | exit 0; tatsächlicher Viteabschluss, Größenwarnung allein kein Fehler | `799c8a6afb680b06d426d130439e5854a56bdff1b4d7245629ca7e711022e119` |
| 27 Browser second | 1 PASS / 1 FAIL / 4 NOT_RUN, exit 1 | `adc1f869d4efc2e717a2730044b5e362516dda5eaf1a7dbd08ad69be4bae7067` |

Im Browserlog steht tatsächlich `HVP representations must share one projection frame`; Ghost-/Facilitymesh übernehmen im früheren Hostpfad den fremden S0-Artifaktrahmen. Fatalcleanup erzeugt anschließend den Cargo-Openfolgefehler. Root/Architekturreviewer behandeln den richtigen gemeinsamen Hostframe in der ausdrücklich freigegebenen Korrektur. Hier kein Browser-PASS und keine Unterstellung zusätzlicher Browserläufe für die vier nicht gestarteten Fälle.

Die frühere Intake-Mitteilung trennte den zuerst statisch beobachteten disposed→`read()`-Fehler, die gelesene Korrektur und den Writerbericht. Jetzt ist der tatsächliche zugehörige RED/GREENinhalt ebenfalls gelesen; Root berichtet dessen RED lag zeitlich vor dem Reviewerhinweis. Für R1/R2 dieses Berichts existiert **kein** rückwirkend behaupteter RED/GREENbeleg in Phase25; dazu folgt die echte neue Korrekturphase.

Read-only Nachweise: `git rev-parse HEAD`, begrenzte `git diff`-/`nl`-/`rg`-Reads, Python-SHA256/Byteprüfung der 27 Snapshotdateien und des Patchs/Grants, gzip-Text-/Exitreads und Normalisierungsvergleich. Gesamtmanifest-, Git-/LFS-Checkout- und endgültige aktuelle W07-Paketadmission: NOT_RUN/noch nicht vorgelegt. Nächster Schritt ist der ausdrücklich angekündigte neue Seal mit eng gebundenem R1/R2-/Frame-Nachweis.
