# Programm, Entwicklungsrichtung und Isolation

## 1. Zielbild und untersuchte Alternativen

Das Ziel ist kein weiterer Technologiestapel neben einem unfertigen Spiel. Hestia soll fein blockig, lebendig und nach Eingriffen konsistent aussehen; kleine Werkzeuge sollen die Iteration daran beschleunigen. Der aktive Prototyp muss unabhängig davon seine Schnitte, Physik und Persistenz fertigstellen können.

Drei grundsätzlich mögliche Wege:

| Weg | Vorteil | Hauptrisiko | Entscheidung dieses Plans |
|---|---|---|---|
| Sofort mehr Produktänderungen parallel | einzelne Effekte direkt im Spiel | konkurriert mit V3, P02/P03/P04, erhöht Fehler- und Integrationsfläche | nicht wählen |
| Nur Research und neue Konzeptdokumente | kein Produktkonflikt | keine empirische Entscheidung, keine benutzbaren Werkzeuge | nicht ausreichend |
| Isolierte, quellgebundene Vergleichsprototypen plus kleine Tools | echte Versuche und messbare Kandidaten ohne Produktblockade | spätere Integration bleibt gesondert nötig | gewählt |

## 2. Three.js: vorläufiges Urteil, keine Vorentscheidung des Tests

Die Produktbasis bleibt Three.js. Die aktuelle Quelle nutzt WebGLRenderer und GLSL-Hooks über `onBeforeCompile`. Three.js dokumentiert einen WebGPU-/TSL-Pfad mit WebGL2-Backend; dieselben alten Materialhooks sind dort kein Drop-in-Vertrag. Deshalb sind Bibliothek, Backend und Shaderport drei getrennte Vergleichsachsen.

Kontrolle: existierende gepinnte Three-Version/WebGL2 mit unveränderter Szenenqualität.
Kandidat 1: Three/WebGPURenderer + TSL auf derselben Version, soweit dort unterstützt. Den realen Backendtyp messen. `forceWebGL` ist ein gesonderter Kompatibilitätstest, nicht gleich dem alten WebGLRenderer.
Kandidat 2: Babylon.js als schmaler Gegenadapter auf denselben Daten. Keine zweite Physik oder komplette Gameplaymigration.
Zusatzfrage: lokal begrenztes direktes Voxel-Raymarching gegenüber Greedy-Mesh. Das ist ein anderer Geometriepfad, nicht automatisch ein Enginewechsel.
PlayCanvas wird im Quellen-/Fähigkeitsvergleich behandelt; eine zusätzliche Implementierung benötigt einen konkreten Vorteil, den Babylon/Three nicht prüfen. Unity, Unreal, Godot oder eine native Rust/C++-Engine sind keine parallel zu implementierenden Spielports in diesem Programm.

Keine Rendertechnik beseitigt automatisch unveränderte CPU-Destruction-, Hash-, Ingest- oder native Hold-Arbeit. Die Entscheidung verlangt getrennte CPU-/GPU-/Upload-/Mesh-Rebuilddaten und vergleichbare Bilder.

## 3. Isolationsvertrag

Arbeitsbasis: `BenjaminHornung/Weltraum-Spiel@b3c6523a94cd050f5a9a22dc27f4777fcc03363e`.
Neue Schreibwurzel relativ zur RD-Clone-Wurzel: `experiments/hestia-rd-2026-10-02/`.

Der Hauptorchestrator legt einen neuen lokalen Clone in einem freien Geschwisterverzeichnis an. Es werden keine existierenden Verzeichnisse gelöscht oder bereinigt. Unterworktrees werden nur aus diesem neuen RD-Clone erzeugt, nicht aus der aktiven Produkt-Worktree-Familie. Read-only-Produktbezug bleibt auf den festen Commit gepinnt, auch wenn main oder A0 weiterlaufen.

Außerhalb der neuen Wurzel darf **keine bestehende getrackte Datei** geändert werden, insbesondere nicht:

- `apps/weltraum-browser/**`, einschließlich Source, Tests, Evidence, package.json/lock und Playwrightconfig;
- `tools/blender/**`, bestehende Assetcompiler, `docs/**`, `art/**` oder Konzeptbilder;
- `.github/**`, Rootpakete, `.gitignore`, AGENTS, Modell-/IDE-/Providerkonfiguration;
- alte P01–P06-Ergebnisse, Produkt-Saves oder Golden-Bilder.

Vorgefundene Rootregeln werden gelesen und befolgt, nicht ersetzt. Lokale Artefakte/Logs gehören in einen eigenen Run-Ordner außerhalb des Repositorys. Lab-node_modules, Toolcache und Browserprofile gehören ausschließlich in eigene ignorierte Lab-/Runpfade. Kein `npm install` im Produktverzeichnis, kein globales Paketupdate. Keine Portübernahme, kein Beenden fremder Node-/Chromeprozesse. Server nur auf Loopback, eigener freier Port ab 5280, strikt geprüft. Kein Proxy zur laufenden Produktoberfläche und kein Teilen ihrer IndexedDB oder Service Worker.

Ein anderes Loopback-Port liefert eine eigene Origin; der Browser erhält zusätzlich ein eigenes temporäres Profil. Verwende eine Lab-Datenbank mit `hestia-rd-`-Namespace oder zunächst reinen Dateiimport/-export. Kein Lesen der echten Spielstand-DB aus der Lab-Origin.

**Nachweis:** Kandidatenbaum außerhalb der neuen Wurzel muss bytegleich zur Lesebasis sein. Zusätzlich uncommitteten Diff, staged Diff, untracked Pfade und Symlinks prüfen. Ein bloßes „git status clean“ auf einem unerlaubten Commit reicht nicht. Verknüpfungen, die Writes aus der Wurzel herausführen, sind verboten.

## 4. Fachliche Grenzen zur alten Parallelisierung

| Alte Zuständigkeit | RD liest allenfalls | RD macht stattdessen |
|---|---|---|
| A0 Cut-RT-/World-/Workerintegration | eingefrorene Quellen/Snapshots | eigene Renderer-/Effektprototypen; keine neuen Cut-Fixes |
| P01 Klassifikationskerne | Ergebnisse/öffentliche Typen | keine zweite Optimierung derselben Funktionen |
| P02 vegetation.ts byte-identische Beschleunigung | eingefrorene Pflanzenquelle | neue Wind-/Silhouettenversuche in Labdateien |
| P03 Player/Kamera-Allokationen | Kamera-/Sichtanforderungen | eigenes Occlusion-Testfixture, kein Kamerapatch |
| P04 look.ts Tuning | altes Lookprofil als Kontrolle | Material-/Shadervergleich und Authoringtool, keine neue Produkt-Look-ID |
| P05/P06 Produktreview und Produktmessungen | später veröffentlichte Reports | ausschließlich Lab-QA und Lab-Benchmark; keine doppelte Art-/V3-Freigabe |

## 5. Was „vollständig parallel“ bedeutet

Kein RD-Schreibpaket braucht die Freigabe einer alten Produktdatei. Innerhalb RD gibt es normale Abhängigkeiten: ein kleiner Fixture-/Vertragsfreeze, dann parallele Versuche, danach gemeinsame Prüfung. Auf demselben physischen Rechner sind belastbare GPU-Messungen dennoch seriell zu koordinieren. Blockierte Messung bedeutet `WAITING_FOR_DEVICE`, nicht Stop aller Implementierung.

## 6. KISS- und Ergebnisdisziplin

Ein Labprojekt, eine installierbare Toolchain, drei kleine geteilte Grenzverträge. Kein eigener Workflowserver, Graphdatenbank, Eventbusframework, Pluginmarktplatz, allgemeiner Editor oder universeller Engineadapter. Gemeinsame Helfer erst nach zweitem konkretem Gebrauch. Ein ineffizienter Kontrollalgorithmus darf als Oracle bleiben, aber nicht ungekennzeichnet Produktionskandidat werden.

Es wird kein Feature dadurch „schnell“, dass Qualität, Datenmenge, Transparenz, Schattentreue oder getestete Kamerapfade still reduziert werden. Alternative Fidelity-Profile sind eigene sichtbare Experimente. Untersuchung darf auch unpassende Richtungen dokumentieren; die Übernahmeentscheidung darf sie nicht als gleichwertig ausgeben.

## 7. Freigaben

Dieser Plan beauftragt lokale RD-Implementierung, keine Produktmigration. Nach einem technisch guten Kandidaten entscheidet der Owner über Art-/Designrichtung. Danach prüft der Produkthauptagent die kleinste Integrationskarte gegen seinen dann aktuellen festen Stand. Laborerfolg allein ist weder `ART_ACCEPTED` noch `PERF_ACCEPTED` für HVP noch eine Freigabe zum Überschreiben bestehender Verträge.
