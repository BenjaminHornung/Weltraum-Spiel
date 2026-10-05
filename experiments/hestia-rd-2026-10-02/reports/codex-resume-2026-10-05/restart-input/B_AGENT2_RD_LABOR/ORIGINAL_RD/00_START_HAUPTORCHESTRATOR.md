# Ausführungsauftrag: Hestia Living-World-R&D

## Deine Rolle und das konkrete Ziel

Du bist der Hauptorchestrator eines **neuen, isolierten Forschungs- und Toolingprogramms** für `BenjaminHornung/Weltraum-Spiel`. Du setzt dieses Paket mit fachlichen Unterorchestratoren und eng begrenzten Implementierungs-/Reviewworkern um. Du lieferst nicht nur einen weiteren Plan: Erzeuge ausführbare Vergleichsprototypen, tatsächlich benutzbare Laborwerkzeuge, Tests, frische Evidenz und eine begründete Entwicklungsrichtung.

Die bestehende Produktarbeit läuft unabhängig weiter. Der bisherige A0-Agent sowie P01–P06 behalten alle ihre Zuständigkeiten. Dein Programm berührt keine ihrer Produkt-, Test-, Konfigurations- oder Ergebnisdateien.

Feste Lesebasis: `b3c6523a94cd050f5a9a22dc27f4777fcc03363e`.
Einzige neue, versionierte Schreibwurzel: `experiments/hestia-rd-2026-10-02/` in einer **eigenen frischen lokalen Clone-/Worktree-Familie**. Keine neue GitHub-Repositoryanlage. Keine Änderung des fremden aktiven Checkouts.

## Lies zuerst

`01_PROGRAMM_UND_ISOLATION.md`, `02_QUELLEN_UND_REDDIT.md`, `03_LAB_VERTRAEGE_UND_FIXTURES.md`, `04_MESSUNG_UND_ENTSCHEIDUNG.md`, `05_TASKBOARD.json` und `context/CHECKPOINT_ORIGINAL.md`. Prüfe außerdem die am festen Commit tatsächlich geltenden `AGENTS.md`/nächstgelegenen Regeln. Der beigefügte alte Parallelplan dient als Kollisionskarte, nicht als zusätzlicher Auftrag für dich.

## Ermächtigung innerhalb dieses Auftrags

Du darfst lokale isolierte Kandidatenbranches und Commits erzeugen, Laborcode und Tests in der neuen Schreibwurzel implementieren, eng begrenzte lokale Laborabhängigkeiten installieren, synthetische Fixtures erstellen und eingefrorene Produktdaten read-only auswerten. Kein Push, PR, Merge nach main, Release, Deployment oder Upload zu einem Drittanbieter ohne separaten Auftrag. Keine neuen Modell-/API-Abos, keine globale Agentenkonfiguration und keine Modifikation von Produkt-Saves oder Goldens.

Eine Quellenlücke blockiert nur das betroffene Experiment oder dessen Freigabe. Führe unabhängige Arbeit weiter. Erfinde keine fehlenden Bilder, Originalbytes, Messwerte, Genehmigungen oder Testergebnisse. Eine Roadmap mit `PROPOSED` ist keine Produktfreigabe.

## Erste Ausführungsschritte

- [ ] Verifiziere Repository, vollen Basishash, Tree und lokale Isolation. Erfasse verfügbare Node-/Browser-/GPU- und Agententools ohne globale Änderungen.
- [ ] Prüfe tatsächliche Spawn-/Wait-/Close-Fähigkeiten und das verfügbare Threadlimit. Verwende die vorhandenen Werkzeuge, nicht eine selbstgebaute Orchestrationsplattform.
- [ ] Stelle den kurzen Quellen-/Schreibschutzbefund bereit. Noch keine 30-seitige neue Architekturrunde.
- [ ] Führe RD-00 durch und friere die drei Laborgrenzen ein. RD-01, RD-10 und RD-50 dürfen ihre Quellen-/Reviewvorbereitung gleichzeitig beginnen.
- [ ] Verteile die sechs Unterorchestratoraufträge. Nutze die Abhängigkeiten in `05_TASKBOARD.json`, statt alle Aufgaben blind gleichzeitig zu starten.
- [ ] Sorge früh für die erste startbare Kontrollszene. Danach sollen einzeln prüfbare Wind-/Regen-/Rendererkandidaten sichtbar werden, nicht erst am Ende alles zusammen.

## Logische Hierarchie

Hauptorchestrator → SO-01 bis SO-06 → ausführende Worker und unabhängige Reviewer.
Es gibt keine vierte delegierende Ebene. Leaf-Worker dürfen nicht weiter delegieren.

SO-01: Referenzen, eingefrorene Fixtures, Runner.
SO-02: Renderer, Materialien/Licht, Kameralesbarkeit.
SO-03: Vegetation, Wind, Lebenszyklus.
SO-04: Wetter, Regenabschattung, Nässe, begrenzter Schneeversuch.
SO-05: Kleine Authoring- und Vergleichswerkzeuge.
SO-06: unabhängige Prüfungen, Kombination, Entscheidung und Übernahmekarten.

**Funktioniert echtes verschachteltes Spawning nicht**, bleibt die Hierarchie fachlich bestehen: Unterorchestratoren liefern eng gebundene Workeraufträge, du startest diese direkt und routest ihre Ergebnisse zurück. Behaupte kein gestartetes Kind ohne echte Tool-ID. Bei nur seriell verfügbarer Ausführung arbeite den DAG seriell mit demselben Scope ab; keine fingierten unabhängigen Reviews. Wo die bestehende Umgebung `worker-alternate` anbietet, nutze diesen Typ mit unterschiedlichen Rollenprompts statt neue Providertypen einzurichten.

## Globale Kapazitätsgrenze

Höchstens `min(tatsächlich verfügbares Hostlimit, 8)` gleichzeitig offene Kindthreads, **einschließlich** Unterorchestratoren und Reviewern. Standardmäßig höchstens vier schreibende Worker und zwei aktive Unterorchestratoren; reserviere einen freien Slot für Review/Recovery. Passe nach unten an, wenn Speicher oder Hostlimit das verlangen. Nicht jeder SO erhält ein eigenes zusätzliches globales Kontingent.

Nicht alle sechs SOs mit wartenden Threads die Kapazität blockieren lassen. Zwischen abgeschlossenen Stufen dürfen sie mit durablem Handoff geschlossen und später fortgesetzt werden. Keine Kinder schließen, deren Ergebnisse noch benötigt werden. Höchstens zwei schwere lokale Build-/Testprozesse; qualifizierte GPU-Messung exklusiv pro physischem Gerät. Den alten Produktbenchmark nicht unterbrechen oder überlasten.

## Schreibbesitz und Integration

Jeder Worker schreibt ausschließlich seine Karten-Allowlist in seinem isolierten Worktree. Shared contracts, root package/lock/config, statische Registrierung und gemeinsame Snapshots haben jeweils einen ausdrücklich benannten Writer. SOs und Reviewer korrigieren Leaf-Code nicht heimlich parallel. Fehler gehen an den zuständigen Writer; nach dessen terminalem Handoff darfst du einen neuen alleinigen Fix-Writer benennen.

Integriere lokal ausschließlich geprüfte RD-Kandidaten, seriell und an konkrete Commits gebunden. Jeder Integrationsdiff muss außerhalb der RD-Schreibwurzel leer sein. Keine konfliktverdeckenden Optionen, kein automatisches Rebase fremder Arbeit. Der Ursprung des Produktbranches bleibt unberührt.

## Arbeitsweise je Paket

1. Frage/Hypothese und Kontrollvariante benennen.
2. Relevante Primärquelle sowie tatsächliche Codegrenze lesen.
3. Negativ-/Paritätstest schreiben und den erwarteten Fehler nachweisen.
4. Kleinste lauffähige Umsetzung; meist Kontrolle plus zwei Alternativen.
5. Frische Unit-/Lifecycle-/Browserprüfungen; Performance und Bilder in getrennten Läufen.
6. Unabhängigen Review soweit echte separate Session verfügbar ist.
7. Engen Kandidatencommit samt Ergebnis, Grenzen und nächstem Gate zurückgeben.

Keine vorab verordnete „performanteste“ Technik. Keine unendliche Optimierung nach erfülltem Ziel. Keine dritte Alternative ohne konkreten Befund, der die ersten beiden unbrauchbar oder unentschieden macht. Eine begründete Ablehnung ist ein Ergebnis, ein nicht gestarteter Versuch aber kein fehlgeschlagener Benchmark.

## Abschlusslieferung

Liefere den startbaren Lab-Stand mit exakten Installations-/Start-/Testbefehlen, lokalem Commit/Tree, geprüfter Schreibgrenze, sechs Teilberichten, sieben Referenzkarten, verfügbaren Vorher-/Nachherclips, Rohmessungen und `ADOPTION_QUEUE.md`. Führe je Fähigkeit separat: implemented, unit tested, browser tested, performance qualified, human art accepted, product integrated. Die letzte Spalte bleibt in diesem Programm immer **nein**.

Beantworte konkret: Was behalten wir an Three.js? Wo hilft TSL/WebGPU wirklich? Ist ein alternativer Renderer seinen Migrationspreis wert? Welches Wind-/Foliagemodell bleibt nach Zerstörung korrekt? Welche Regen-/Nässetechnik trägt Überhänge und bewegte Objekte? Welche Werkzeuge ersparen jetzt Handarbeit? Welche Kandidaten sollen nach dem laufenden V3-Gate mit welchem kleinsten Produktschritt übernommen werden?
