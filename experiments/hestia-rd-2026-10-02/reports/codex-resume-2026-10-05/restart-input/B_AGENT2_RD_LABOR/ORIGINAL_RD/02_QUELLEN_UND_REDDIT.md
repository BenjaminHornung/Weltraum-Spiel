# Quellen, Reddit-Referenzen und konkrete Ableitungen

## Aussageklassen

`PROJECT_SOURCE`: tatsächlich bereitgestellte Projektquelle, mit historischer Bindung.
`CURRENT_PRIMARY_TEXT`: in dieser Planungsrunde gelesene offizielle Dokumentation oder Entwicklertext.
`AUTHOR_CLAIM`: nicht unabhängig gemessene Aussage eines Demoautors.
`INFERENCE`: unsere nachvollziehbare Ableitung.
`PROPOSED_EXPERIMENT`: neuer Auftrag, noch ohne Ergebnis.
`UNAVAILABLE` / `MEDIA_NOT_VIEWED`: explizite Lücke.

Die beigefügten G-Berichte aus August 2026 sind Entwürfe mit eigenen Referenz-SHAs und teils offenen Ownergates. Sie sind keine vollständige Beschreibung des Oktoberproduktes. Ihr 0,25-m-Labprofil ersetzt nicht das im V3-Checkpoint feste HVP-Quantum von 0,125 m. Ebenso ist ein historisches „kein Surface/Save vorhanden“ nicht ungeprüft aktuell.

## Die sieben Reddit-Referenzen

Die vollständigen URLs stehen in `sources/web_sources.json`. Konzeptbilder und Visual Bible bleiben die Stilbasis. Ein Reddit-Beitrag erlaubt nicht automatisch Code-/Assetübernahme. Medienrechte, Code-Lizenzen und Belegstatus werden getrennt geführt.

| Ref | Gegebene Referenz | Abrufstand dieser Planung | Konkretes Experiment |
|---|---|---|---|
| RR-01 | Camera cutout for voxels | Originalpermalink aus Projektkontext; aktueller Abruf fehlgeschlagen. Frühere Textauswertung liegt vor; Video nicht gesichtet. | RD-15: Kamera-Push-in versus lokale Verdeckungsausblendung. Kollision/Picking unverändert. |
| RR-02 | BFS: new snow system | Originalpermalink aus Projektkontext; aktueller Abruf fehlgeschlagen. Frühere Textauswertung liegt vor; Video nicht gesichtet. | RD-31/RD-33: Partikel, Oberflächenauflage und echte interaktive Materie unterscheiden; Dach/Überhang-Gegenprobe. |
| RR-03 | My raymarching engine | Entwicklertext frisch lesbar; Medien nicht abgespielt. Beschreibt Rust/wgpu-Technik und offene Rekonstruktions-/Lichtfragen. | RD-13/RD-14: lokale Raymarch-/Material-/Licht-Qualität bei einer Geometrieänderung, nicht nur ruhendes Beautybild. |
| RR-04 | Destruction and building in our unannounced voxel physics survival game | Entwicklerantworten frisch lesbar, keine eigene Messung. Greedy-Dreiecksmeshes und Aufteilung getrennter Volumen beschrieben. | RD-13/RD-23/RD-51: Meshpfad als ernsthafte Kontrolle; neue Owner, korrekte Dekoranbindung, keine Marching-Cubes-Stilübernahme. |
| RR-05 | My tiny voxel game is fully destructable | Entwicklertext frisch lesbar; SVO-/Render- und Kollisionspfade beschrieben. Beworbene FPS nicht nachgemessen. | RD-13: gleicher lokaler Voxelbestand, Edit-Upload und Speicher gegen Greedy; kein Boxcollider-Qualitätsrückschritt. |
| RR-06 | Windy voxel forest | Entwicklertext frisch lesbar; vorgebackene voxelisierte Frames, ca. 630 MB für vier Vorlagen/5 s laut Autor. Video nicht gesichtet. | RD-21/RD-22/RD-23: kompakte Animation gegen begrenzte Vorberechnung; entfernte Zellen dürfen nicht durch nächsten Frame zurückkehren. |
| RR-07 | We're using blocky voxels with lots of foliage to create lush environments | Entwicklertext frisch lesbar. 1-m-Voxel und Nicht-Voxel-Bäume als Autorenbeschreibung. | RD-20/RD-41: Schichten, Cluster, Lichtungen und Habitat übernehmen, nicht Maßstab oder Baumrepräsentation. |

Die genannten Technikinhalte sind Autorenbeschreibungen. Sie beweisen keine Hestia-Performance, Browserkompatibilität oder vollständige Zerstörungs-/Persistenzsemantik.

RD-01 muss pro Referenz eine Karte liefern: Originaltitel/URL, Autor soweit öffentlich sichtbar, Text-/Medienzugriff, tatsächlich gesehene Zeitintervalle, Aussage versus Beobachtung, gewünschte Wirkung, Ausschlüsse, Hestia-Experiment und Ergebnislink. Fehlt Medienzugriff, bleibt dieser Teil offen. Ein Thumbnail ist kein Videovergleich. Kein Umgehen von Zugriffssperren, keine erfundenen Zeitcodes.

## Aktuelle externe Primärquellen

- Three WebGPURenderer-Handbuch: Backendwahl, TSL, async init und Migrationsgrenzen. Der heute gelesene Text ist keine Garantie für die gepinnte alte Paketversion; RD-10/RD-11 prüfen dortige APIs.
- Three Material-Dokumentation: `onBeforeCompile` gilt für WebGLRenderer. Shaderport muss explizit sein.
- Babylon-Spezifikationen: alternativer Browserrenderer und Material-/Partikelfähigkeiten. Featureliste ist keine Geschwindigkeitsevidenz.
- PlayCanvas-Dokumentation: zusätzlicher Vergleichskandidat in der Vorauswahl. Nicht parallel ein vierter kompletter Port.
- GPU Gems 3, Kapitel 16, Tiago Sousa/Crytek: prozedurale Haupt-/Detailbewegung und Windparameter als technische Referenz. Hestia übernimmt nicht ungeprüft glatte Biegung kanonischer Holzzellen oder Alpha-Blattkarten im Hero-Nahbereich.
- Offizielle Codex-/Work-Subagentdokumentation: parallele spezialisierte Aufgaben sind möglich; effektive Hostfähigkeiten und Kontingente trotzdem prüfen. Keine erfundene Unterstützung rekursiver Unteragenten und keine Installation einer neuen Agentenplattform.

## Gelieferte lokale Quellen

`context/` enthält ausgewählte Originalbytes mit Dateinamen-/SHA-256-Zuordnung in `sources/project_sources.json`: V3-Checkpoint, alter Parallelplan, Reddit-Chat, Visual Bible sowie relevante Authoring-, Toolchain-, Content- und QA-Entwürfe. Vollständige Konzepte als Bilddateien sind hier nicht erneut enthalten. RD-01 muss sie aus der gepinnten Repository-Fundstelle beziehungsweise den ausdrücklich verfügbaren Nutzerdateien auflösen. LFS-Pointer nicht als Bild behandeln.

Der historische R03-Engine-Bakeoff wurde in dieser Planungsrunde nicht im Original aufgelöst; Erwähnungen in anderen Berichten sind Sekundärpointer. RD-10 sucht ihn gezielt, übernimmt ihn nicht als bestandenen heutigen Benchmark. Das Fehlen blockiert nicht den neuen kontrollierten Vergleich.

## Heute tatsächlich geprüft, nicht geprüft

Die Planung hat die Vorpaket-Schreibgrenzen, den Checkpoint, relevante Projekttexte und die WebGL-/Shadergrenze in `visualEffects.ts` am festen Commit einbezogen. Es wurden keine neuen Produktbuilds, Spieltests, GPU-Benchmarks oder Reddit-Videobewertungen ausgeführt. Die Paketvalidierung prüft nur die neue Planstruktur, Referenzen und Archivintegrität. Alle Versuche unten starten daher ohne erfundene grüne Ausgangswerte.
