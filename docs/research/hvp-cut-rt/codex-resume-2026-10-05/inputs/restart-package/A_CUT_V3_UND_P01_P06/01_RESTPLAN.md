# A-Restplan: kleine Implementierungsschritte bis zum tatsächlichen V3-Abschluss

## A00: Wiederanlauf und belegte Bestandsaufnahme

Alte auftragsbezogene Sessions einschließlich Enkel inventarisieren, fehlende lokale Deltas sichern, alte Writer ablösen und neuen Branch aufsetzen. Vorhandene Code-/Teststände und lokale Rohdaten anhand der aktuellen ExecPlan-Pointer binden. Nicht das ganze Laufarchiv kopieren, um nur Status zu bestimmen.

Erzeuge einmalig RECOVERY.md und ein aktuelles TASKBOARD.json im neuen Research-Unterpfad. F1-Quellen, originale Assertions und heutige Testdateien vergleichen. Jede Aussage als CODE_PRESENT, REPORTED_PASS, FRESH_PASS, FAIL, UNKNOWN oder NOT_RUN unterscheiden. Vorhandene frühere Erfolge bleiben Evidenz für ihren alten Quellstand.

Ergebnis: klarer aktiver Writer, erreichbare echte Quellen, kein laufender Altwriter, exakte bekannte Blocker. Keine Read-only-Person muss erst einen neuen Gesamtauftrag planen.

## A01: Aktuellen Korrekturstand unabhängig prüfen und Privacy reparieren

Direkter Reviewer/Q liest den F1- und Runner-Diff auf unveränderlichem Stand. Seine abgebrochene Vorgängersession ist kein Abschlussurteil. Prüfe insbesondere null/undefined-Defaultverhalten, native Sort-Rückgabe, unbounded Arrayprüfung beim Hashing, Getter/Proxy/Species und Fehlerreihenfolge. Prüfe Belege der behaupteten früheren RED/GREEN-Sequenzen, ohne unbekannte alte Läufe zu neuen PASS zu machen.

Zusätzlicher Privacy-Fix ist in diesem neuen Auftrag ausdrücklich eingeschlossen: keine vollständige CDP-SystemInfo-Antwort speichern. Nur erlaubte Metadaten projizieren, einschließlich Fehlerpfaden, verschachtelter Payloads und Testattachments. Synthetische Canarywerte in commandLine, Profilpfad, URL/Token und Fehlertext einfügen. Publizierbare Ergebnisse dürfen keinen Canary enthalten; erlaubte Hardware-/Versionsfelder und notwendige Fehlercodes bleiben. Keine realen Secrets zum Test einsammeln. Historische private Originale geschützt lassen; additive Redaktionsbelege statt Geschichtsüberschreibung.

Ergebnis: sauberer unabhängiger Quellreview innerhalb benannter Coverage und komplette neue Privacy-Regressionsfälle. Erst dann echten Collector/Browser starten.

## A02: Structural-/Terrain-/Owner-/Runnerfehler ursächlich schließen

Aktuelle gemeldete Reihenfolge:
- Structural 53 bestanden, 1 Timeout.
- Terrain 3 bestanden, 1 Timeout.
- Owner65 bei ungefähr 180 Sekunden gestoppt; Gesamtausgang unbekannt.
- Reporter51 im Rohstdout, kombinierter Bootstrap ohne Endergebnis.

Ermittle exakte Testnamen aus vollständigen Rohreports. Unveränderte Assertion/Timeout zunächst separat reproduzieren. Prüfe reale Fortschrittsgrenzen: Fortschreiten des Cursors, Ledgerbesitz, wiederholte Komplettvalidierung, Hasharbeit, Callback-/RPCabschluss, Restorepfad. Keine Vermutung „zu wenig Timeout“ als Fix.

Instrumentiere nur benötigte Phasen. Diagnoseinstrumentierung und spätere saubere Messung trennen. Pro Hypothese ein enges Delta mit Regressionstest. Test-only Konfigurationsfehler getrennt von Produktfehlern behandeln.

Danach ganze betroffene Populationen ohne bail/skip/retry und mit vollständigen Ergebnisdateien ausführen. Owner65 muss wieder eine tatsächliche komplette Ergebnismenge unter den geltenden Grenzen liefern. Teilpopulationen sind Diagnose, kein Ersatz. Ein äußerer Watchdog, der versehentlich den gesamten mehrfachen Orchestratorumlauf statt den vereinbarten nativen Befehl misst, wird als Runnerfehler korrigiert, nicht zum Anlass für höhere Fachgrenzen genommen.

Ergebnis: keine unerklärten aktuellen Structural-/Terrain-Timeouts, ganze Owner- und Reporter/Bootstrap-Ergebnisse gebunden. Historische FAIL/UNKNOWN bleiben.

## A03: B1 Owner-first und Mesh-only produktiv fertigstellen

Lies vorhandenen Code in physics/bodyCutSession.ts, client.ts, physicsProtocol.ts, physicsWorker.ts, session.ts, structuralPlan.ts, rigidRecipe.ts; terrain/structuralIngest.ts; presentation/bodyMeshAdmission.ts; workers/hvpBodyMeshJob.ts sowie die tatsächlich vorhandenen Compiler-/Pool-Aufrufer. Verwende existierende inaktive Kandidaten; nicht erneut erfinden.

Beweise vor Aktivierung:
- pro Eingabe genau eine Owner-Planberechnung;
- Anfrage/Antwort gebunden an Request, Command, Owner, Source, Incarnation/Epoch und relevante Revision;
- Child-Projektion kann nicht durch fremdes gleich aussehendes Transportobjekt zur Authority werden;
- Legacy-Geometrie, AO, Winding, Normalen, Materialwerte und Fehlerreihenfolge erhalten;
- im aktuellen ExecPlan genannte höheren Material-IDs sowie ungültige Werte vollständig geprüft;
- kein monolithischer Start-/Finalisierungsschritt außerhalb des Slicebudgets;
- aktive Cancels zwischen allen Yield-/Transfer-/Stage-Grenzen;
- ein gültiger aber geometrisch gefälschter Meshreply scheitert vor Render-/Worldpublikation.

Binde anschließend die bestehende Produktionscallback-/Jobdispatchkette an den akzeptierten Pfad. Keine „nur Tests benutzen neuen Code“-Integration. Callgraph und repräsentativen echten Requesttrace als Nachweis liefern.

## A04: B1 Ressourcen, Atomizität und realer Body384-Ablauf

Speicher nicht nur aus Endarrays schätzen. Alte Quelle/alter Body, Ownerplan, Child-Zellen, Packing-/Hashscratch, Transfer-/Decodekopien, erwartetes Admissionmesh, neues Render-/Physikprodukt und Diagnostik können gleichzeitig leben. Vollständigen Lebenszyklus bilanziert erfassen; Reserve vor Allocation. Ausgabe-, Vorbereitungs-, Queue- und Globalgrenzen erhalten.

Fault Injection vor/während/zwischen Stage, Commit, Renderpublish, Finalize: alter oder neuer Gesamtzustand, nie Mischzustand. Fehlgeschlagener Rollback bleibt sichtbar in RecoveryHold. Dispose/Reset/World-Replacement, verspäteter Reply und doppelte Antwort dürfen keine Ressourcen/Authority wiederbeleben.

Dann echter normaler Body384-Spielerinput bis Applied und bestätigt dargestelltem Ergebnis. Kein TestBridge-SetWorld, kein vorgetäuschter künstlicher Zeitfortschritt. Speichern, neue Session/ColdLoad, Recut und bewegten Parent prüfen. Eine neu dargestellte Preview zählt nicht als committed Renderfolge.

Ergebnis: B1 technisch bestanden, bevor B2 aktiviert wird.

## A05: B2 Terrain und B3 Zellzugriff

Terrain-Komposition aus vorhandenen akzeptierten Rekonstruktions-, Journal-, Materialisierungs-, Resident- und Structural-Cursorn übernehmen. Kein neuer unabhängiger Ingest. Terrainbearbeitung, Kollisionsupdate, Support/Fragmenttransfer, Material und Nachbar-/Randverhalten prüfen. Für gleiche Inputs identische Source-/Hash-/Geometrie-/Fehlerergebnisse.

Danach reine Zellzugriffsarbeit reduzieren: Traversalordnung, Grenzfälle, numerische Werte, Getter-/Proxy-/Species-Beobachtungen bewahren. TD-Consumer `tests/reference/tdWalkabilityReference.ts` und seinen echten materialisierenden Verbrauch erneut gegen finalen Kernel prüfen, nicht duplizieren. Kein Plugin- oder Rendererimport in den neutralen Reusepfad.

Ergebnis: B2/B3 aktiv und korrekte vollständige Testpopulation. Ein niedriger Einzel-Slice bei höherer Gesamt-CPU ist nicht automatisch Optimierung; beides messen.

## A06: P01/P03/P04/HUD/Route und vollständiger Spielerpfad

Prüfe P01/P03-Übernahme gegen tatsächliche Dateien, P02-Revert gegen Diff. Vorhandene HUD- und Routefixes (`7e608d4…`, `d8fa028…`) anhand Abstammung und inhaltlichem Delta prüfen, nicht blind erneut cherry-picken. Falls noch fehlend, eng auf neuen A-Branch übernehmen, gemeinsame E2E-Dateien bewusst vereinigen.

P03 in der echten Session: Ego/ThirdPerson, Kamera-Presets, Pointer Lock, Pause/Resume, Reset/Resize, Eingabe, Disposed/Late Reply. P04: bestehende Konzeptquellen plus gleiche Capturepositionen, keine Look-ID-/Saveinkompatibilität und kein Renderer-Neubau. Normale Sonnendirection-Kopplung und Materialvertrag erhalten. Technische Bildprüfung und menschliches ART-Urteil getrennt.

Body/terrain/recut/save/load/neighbor/dormancy/salvage in einem Source-bound Produktionsbuild verbinden. Fehlende baseline-E2Es aus den kleinen Patches nicht verschweigen; Ursache auf dem neuen Gesamtstand klären.

## A07: Qualification vor formaler Performance

Vorab Plan und 14 Populationen (7 Varianten × Cold/Warm) sowie Source/Build/Fixture/Browser/GPU/Viewport/DPR/Modus festschreiben. Erst aktuelle fachliche Gates und vollständigen Runner-/Privacy-Review schließen. Gültige 42 Qualifikationsversuche ausführen. Bei ungültiger/fehlgeschlagener Qualifikation KEINE 1400er-Serie.

Anschließend 1400 Versuche nach bestehendem Protokoll, alle geplanten IDs einschließlich Fehl-/Abbruch-/Warmup-/nicht gestarteter Zustände behalten. Nicht erfolgreiche Versuche aus dem Nenner entfernen. Gleiche stabile Quellen; kein Patch mitten in einer formalen Serie. Bei Unterbrechung nur explizit protokollkonforme Fortsetzung derselben Population, sonst neue getrennte Serie. Keine Siegerauswahl aus gemischten Fragmenten.

Zeit-, Ressourcen- und Framegrenzen aus 02_ABNAHME_UND_SCOPE anwenden. Hardware-/Browsermangel bleibt ein echter ENVIRONMENT_BLOCKED, kein SwiftShader/VM-Ersatz mit Zielgeräte-PASS. Captureläufe und saubere Messläufe getrennt.

## A08: unabhängige Abschlussprüfung und Plannerpaket

Finalen Source/Buildfreeze setzen, vollständige relevante Tests/Type/Productionbuild, Recovery-/Lifecycle-/Privacy-/Scopetests ausführen, unabhängig reviewen. Screenshots zeigen tatsächliche Spielszene, Eingriff, abgetrennte/bewegte Teile und wiederhergestellten Zustand mit beweisbaren Quell-/Framebindungen. Keine beauty-only oder fremden OS-Flächen als Spielbeleg.

Archiv: README mit Startweg, Original-/neue Befunde, Gate-Matrix, exakte Branch/SHA/Buildhashes, Rohreports mit vollständiger Population, Bilder, Redaktions-/Privacyhinweise, offene menschliche ART-Entscheidung und Checksummen. Archiv aus neuer entpackter Kopie validieren; Links und Startkommandos testen. Keine Geheimnisse oder automatisch generierten persönlichen Logs.

Dedizierten Resume-Branch normal pushen, Remote-SHA prüfen. Kein Main-Merge. Nur nach erfüllten technischen Gates TECHNICAL_COMPLETE_OWNER_VISUAL_PENDING, ansonsten konkrete Blockade/Restarbeit.
