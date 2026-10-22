# Prüfung des Standes und gezielte Neupriorisierung

## 1. Tatsächlich gelesener Stand

Repository `BenjaminHornung/Weltraum-Spiel`, Produktcheckpoint `17b1db4201a28e7b607c30707bdc2b75e3484a10`, Branch `feature/hestia-destruction-program-2026-10-07`. Remote-Branch entsprach beim Abruf diesem SHA. `main` war `e40592c113b72a8dc93725187f92cf948e07f44d` und ist **keine** Ersatzbasis für diese Spikes.

Primäre Quelle: `.devtoolbox/specs/changes/hestia-destruction-program-2026-10-07/INTERIM_CHECKPOINT_2026-10-09.md`. Zusätzlich gelesen: aktuelles `RESUME.md`, East-Entscheidung, `terrainProducts.ts` (relevante aktuelle Kette), `worldCheckpoint.ts`, `rapierPort.ts`, `settings/types.ts`, `package.json`, `AGENTS.md`, Universe-Clock sowie ausgewählte Commitänderungen. Das ist keine vollständige unabhängige Zeilenprüfung aller Änderungen und kein neuer Build-/Testlauf.

Der Checkpoint berichtet G0 und historische D1-Mechanismen als qualifiziert. D2–D4 sind in Arbeit. D5, S1–S4, M1–M8 und formale Qualifikation sind offen. Vorhanden sind bereits 32³-Render-/Collisionjobs mit 34³-Halo, private Render-Admission und Cold-/Park-/Wake-Recipewiederverwendung. Diese Mechanismen nicht nochmals neu beauftragen.

r36 ist ein ungültiges Gesamtpaar: Control scheiterte an Neighbor/Wake, Candidate später an authored Ready; 26,173 s Terrainkompilierung und 707,1/705,8/462,6 ms einzelne Cuts sind Diagnose, keine Referenz-P95. Der letzte Startup-Cleanup war nicht bewiesen. Der neue Testtreiber-Fix benötigt echte Browserausführung. Eine übersprungene Coexistence-Prüfung ist explizit nachzuholen.

## 2. Konsequenz für A0

Der Engpass ist jetzt nicht einfach der alte 384-Zellen-Mikrofall. D3 hat einen vollständigen Startup-/Neighbor-/Save-/Wake-Pfad zu tragen. Insbesondere ist Source-/Saveverträglichkeit mit alternativen Collisionrepräsentationen bereits teuer. Eine zuerst komplett fertig qualifizierte 0.12-/Trimesh-Kette und unmittelbar anschließende Neukonstruktion für 0.21/Voxels würde wahrscheinliche Doppelarbeit erzeugen.

Deshalb: M5/PHY-01/PHY-02 **jetzt als Entscheidungssprint**, PHY-03 als kontrollierten möglichen Cutover vor S1/S2/M4 und vor der teuren Abschlussserie einplanen. Kein automatisches Upgrade. Ein negatives oder klar blockiertes Ergebnis ist eine endliche Entscheidung für den vorläufigen 0.12-Pfad; Wetter-/GPUforschung hält A0 dann nicht weiter an.

## 3. Konkrete unnötige Arbeit: East-Render

`terrainProducts.ts::compileChunks` erzeugt `neighborRaw` mit der vollständigen Render-/Collisionpipeline, konsumiert aber nur `neighborRaw.collision`. Die sichtbare Eastdarstellung stammt aus `neighborProjection`. Der zugehörige Bericht benennt selbst eine noch nicht freigegebene collision-only-Ausnahme.

Dieses Paket empfiehlt und formuliert die **enge Freigabe bei Auftragsübernahme**: gleiche Source-/Halo-/Material-/Session-/Generationsprüfungen, eigene Purpose-/Algorithmusbindung, nur Collisionprodukt erzeugen. Kein schwächerer generischer Collisionjob; kein leeres Renderprodukt als vollständige Darstellung ausgeben. Alle 256 East-Collision-Coverages bleiben. Produktübernahme nur durch A0 nach Parität und Cleanupnachweis.

Adapterzahlen (831 ms East-Renderarbeit in einem früheren Test) sind keine vorhergesagte SceneReady-Ersparnis. Der Zweck ist das Entfernen belegbar ungenutzter Arbeit, nicht eine erfundene Zeitgarantie.

## 4. Rapier: drei verschiedene Entscheidungen

A. **Version/Build:** 0.12 gegen den expliziten Zielkandidaten JS 0.21.0. Das offizielle TS-Changelog im Rusttag v0.36.0 bestätigt die Basis Rust 0.36.0/Parry 0.31. Exakte npm-Builds, .d.ts und WASM-Bytes müssen im Spike installiert/geprüft werden. Kein eigener Rust0.36.1-Build nur aufgrund der Versionsnummer.
B. **Collisionrepräsentation:** aktuelle Trimeshes bzw. mehrere Cuboids pro Body gegen native Voxel-Shapes unter demselben modernen Solver. `compound` ist im Projekt keine nachgewiesene `ColliderDesc.compound`-API.
C. **Persistenz:** HVP speichert eigene World-/Body-Codecs mit hartem Solverbezug, keine hier nachgewiesenen nativen Rapier-Snapshots. Sourceformat, Solverprofil und Collision-/Surfacezuordnung sind getrennte Versionsachsen.

Fairer Vergleich: A=0.12+heutige Repräsentation, B=0.21+gleiche Repräsentation, C=0.21+native Voxelrepräsentation. A→C alleine belegt keinen Solver- oder Shapeeffekt. Erst Fähigkeits-/Korrektheitsfragen, dann Gesamtzeiten inklusive Aufbau/Edit/Query/Step/Dispose.

## 5. Neue Konzepte: tragfähige Anschlüsse und notwendige Präzisierungen

Die Registry übersteuert innerhalb des Konzeptpakets veraltete Quellenangaben. Sie ist aber selbst PROPOSED und untersucht hauptsächlich einen älteren main, nicht den laufenden Destruction-Code. Folgende Ausführungspräzisierungen werden hier **neu vorgeschlagen**, nicht als Quellfakten ausgegeben:

1. PHY-03 nicht an das Ende aller drei Phasen binden. Frühe begrenzte Solver-/Colliderentscheidung, eine Produktintegrationsstelle bei A0.
2. S3/S4, GFX-01/02 und RT-/Wettersettings besitzen gemeinsam nur einen Settings-/Telemetrypfad. Bestehendes `src/settings/**` erweitern, keinen zweiten `graphics/**`-Store bauen.
3. Registry G-12 wird eingeschränkt: **bestehendes verpflichtendes Block-AO und der AO-Merge-Key bleiben Teil des korrekten Primärprodukts**. Nur neue optionale Screen-Space-/Ray-/GI-Lichtprodukte dürfen nachgelagert sein, mit Fallback statt falsch als aktuell deklarierter History. Keine 120-ms-Verbesserung durch Entfernen vorgeschriebener Qualität.
4. CPU-/Frametime-Differenzen sind keine exakten GPU-Passzeiten. Ohne GPU-Timer bleibt eine GPU-Schwelle unbewiesen. Ein A/B-Framevergleich bewertet das ganze sichtbare Ergebnis, nicht heimlich einen 2-ms-Raypass.
5. UniverseTime bleibt der vorhandene ganzzahlige SimulationTick (120 Hz); Physics60Hz ist eine andere Taktrate. Keine TickUs-Zweitautorität.
6. PlanetaryMacroData wird von Klima/Wetter gelesen und projektiert. Kein zweiter Geografie-Seed und kein neues Meer aus lokaler Chunkresidenz.
7. Wetterstrategie A ist die erste kleine Versuchsbasis; B bleibt separater Grid-/Replay-/Stabilitätsspike. Kein Modellwechsel durch Kamera oder Dormanz.
8. Atmosphären-Gasmischungen sind ohne Sourceparameter nicht bekannt. Hestia-Testannahmen und exotische Stoffdaten ausdrücklich kennzeichnen. Airless/Unknown/Unsupported nicht durch Erdwetter ersetzen.
9. PLT-02 ist eine **bedarfsgetriebene** deterministische Numerikprobe, keine Pflicht zum Neubau einer universellen Mathebibliothek. Held-Suarez ist ein Vergleichsbenchmark, keine bereits freigegebene dritte Laufzeitkomponente eines billigen ClimateCompilers.
10. Der Registry-Scopeguard mit `grep ... || echo scope ok` ist nicht hinreichend: Baseline, Gitfehler, gestagte/ungestagte/ungetrackte Dateien und verbotene Pfade getrennt prüfen. Ein sauberer Commit-Diff allein ignoriert laufende Writes.
11. WXG-06 und PHY-05 erhalten eine gemeinsame Fluid-Authorityentscheidung, aber getrennte Medien/Oracles. Luft-Wake ist kein Tank-/Rohrsolver; SPH ist kein ganzes Meer.
12. Cloudfähigkeit und lokale Qualität werden pro Nachweis getrennt. Keine GPU-/Gerätefreigabe aus Cloud-Unit-PASS, keine Wiederholung aller Unit-Implementierungsarbeiten auf dem Laptop.

## 6. Bewusst keine neuen globalen Entscheidungen

Keine vollständige eigene Engine, kein pauschaler WebGPU-/Rapierwechsel, kein neues Wirtschaftssystem, keine unbeschränkte Planetensimulation, keine Ray-/Fluidtextur als Voxelautorität. Physikalische Drift kann zu einem expliziten neuen Solverprofil führen, wird aber nicht durch umbenannte Goldens oder automatisch gelockerte Toleranzen versteckt.

Ein modernes Verhalten darf fachlich richtiger als ein Legacybug sein. Die Legacyassertion bleibt als alte Erwartung erhalten; ein unabhängiges fachliches Oracle und eine dokumentierte Verhaltensänderung sind für eine neue Produktsemantik erforderlich. Das verhindert sowohl blindes Festhalten an 0.12 als auch blinde Migration.
