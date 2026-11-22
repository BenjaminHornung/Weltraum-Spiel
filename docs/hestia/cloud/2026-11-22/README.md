# A0 Core, 22. November 2026

Der Integrationsbranch `codex/hestia-a0-core-r2-2026-11-22` baut auf dem veröffentlichten Reviewstand `1aab99397435104b54258e6ef3d5663d704e3a27` auf. Die sechs R2-Teilarbeiten liegen gemeinsam in `fdc9a34ab4f36869f342e5c7f77e632a60b2df55`. Die folgenden Läufe prüfen den darauf aufgebauten Produktcode von `190f738f887c3dec3ec4b1ccd03f319abb430690`.

| Prüfung | Ergebnis in der Cloud |
| --- | --- |
| Produktionsbuild und R05-Bindung | Vite-Build erfolgreich. Der HVP-Loader lädt den geprüften Physics-Worker und das projektspezifische Rapier-WASM. Beide SHA-256 stehen im Browserbeleg. |
| Regressionen des kombinierten Stands | 247 von 247 Tests in 20 Dateien bestanden bei aktivierter Prüfung der gebauten Solverbindung. Ein weiterer fokussierter Lauf zu Save und Solver bestand mit 21 von 21 Tests. Die Testauswahlen überschneiden sich. |
| PrepareBranch | 8 Kontrollläufe und 8 Kandidatenläufe in frischen Prozessen mit wechselnder Reihenfolge. Der Median der Worker-Bearbeitungszeit sinkt von 805,4 auf 705,8 ms. Anfangs 384 Zellen, 64 entfernt, Fragmente mit 128 und 192 Zellen. Beide Builds liefern dieselben Massen, Source-Hashes und Freigabezähler. |
| Saveformat | Beide Builds liefern für die Hestia-Fixture bytegleich 173.205 Bytes, für die Sonderzeichen-Fixture 1.187 Bytes. Der bestehende Test für das private Save-Repository lief beim Kontrolllauf nach 5.062 ms ins 5-Sekunden-Limit und bestand auf dem kombinierten Stand in 3.984 ms. |
| Privater ColdLoad und Recut | Je ein R2- und A0-Spielstand im frischen Prozess mit neuen Workern geladen, bewegtes Fragment von 150 auf 148,828125 kg geschnitten, Revision 2 gespeichert. Nach Dispose jeweils null lebende Worker, Timer, Bodies und Collider. Die Prüfung verwendet das private MemorySaveRepository. Der öffentliche Save-Cutover bleibt gesperrt. |
| Ein echter Felsarm-Schnitt | Chromium 149 mit SwiftShader, Pointer Lock, normales Werkzeug, realer Mausklick. 64 Zellen und 300 kg entfernt, 384 Zellen mit 1.722,65625 kg an einen fallenden Körper übertragen. Root, native Generation und sichtbare Renderkeys stimmen bei Revision 1 überein. |
| Zwei reguläre Playwright-Szenarien im gebauten Core | Gemeinsamer Lauf mit einem Worker und ohne Wiederholungen, Exit 1. Bei HVP-09B blieb nach dem Klick der Cut-Beleg 30 s aus. Der Fehlersnapshot zeigt Pausendialog und SimulationHold. Bei HVP-10 wurde der Felsarm erfolgreich abgetrennt, die Zielvorschau erfasste das fallende Fragment innerhalb von 15 s nicht. Der Test erreichte den F-Impuls nicht. |

## Wo der normale Schnitt Zeit verbraucht

Der gemessene Felsarm-Schnitt benötigte vom Mausklick bis zur Bestätigung 1.608,3 ms und bis zur ersten zum Commit passenden Renderübergabe 2.155,1 ms. Die 1.314,7 ms der lokalen Stützplanung enthalten die Wartezeiten zwischen den Arbeitsschritten. Davon entfielen 551,1 ms auf die Startzellen der Zusammenhangssuche und 463,6 ms auf die Stützprüfung. Die native Welt war für 7,6 ms belegt. Collider-Aufbereitung und Installation dauerten 1,1 und 0,4 ms. Überlappende Messwerte dürfen nicht addiert werden.

68 disjunkte Messintervalle desselben Main-Thread-Tasks liegen vollständig innerhalb der Stützplanung. Ihre Laufzeiten summieren sich auf 163,8 ms. Das längste Intervall dauerte 10,5 ms. Die übrigen 1.150,9 ms lagen außerhalb dieser Intervalle, unter anderem zwischen Abgabe und Wiederaufnahme des Tasks. Diese Aufteilung misst verstrichene Zeit. Sie lässt offen, welcher Anteil auf Rendering, sonstige Browserarbeit oder Scheduling entfällt.

Der nächste A0-Vergleich liegt in `hestia-prototype/terrain/supportPlan.ts` und dem Aufruf in `terrainProducts.ts`. Für Startzellen und Zusammenhangssuche sind aktive Rechenzeit und Wartezeit zwischen den Arbeitsschritten getrennt zu erfassen. Zellmenge, Masse, Fragmente, Revision und Renderbindung gehören in denselben Vorher-Nachher-Vergleich. Für den nächsten Browserlauf sollen beim echten Klick beziehungsweise Tastendruck Pointer Lock, Pause, Spielertick, Zielentfernung und Worker-Antwort demselben Befehl zugeordnet werden.

## Reproduktion

Für die Grafikressourcen ist ein mit Git LFS ausgechecktes Repository erforderlich. Im Verzeichnis `apps/weltraum-browser` wurden der Build und der Worker-Lauf so ausgeführt.

```sh
npm ci --ignore-scripts
npm run build
node tests/performance/prepare-branch/worker-cut.mjs . 388bd198dee0ab31165855c03a359ec7ce6b78df8cd538cd82506c179f23ea96 /tmp/hestia-prepare-branch.json
HESTIA_CHECK_BUILT_SOLVER=1 ./node_modules/.bin/vitest run --maxWorkers=1 tests/unit/phy01-source-binding.test.ts tests/unit/phy01-lab-codec.test.ts tests/unit/browserStorageCodec.test.ts
```

Der gemessene Browserpfad beginnt auf `/?hestiaPrototype=1&hvpMeasure=1&hvpScenario=rock-arm`. Über „Stütze anvisieren (2 + Klick)“ und „Spielen“ zur bestätigten Vorschau „64 Stützzellen“ gehen, dann mit der linken Maustaste schneiden. Die Marker für `cutInputToAppliedMs` und `cutFirstCommittedRenderSubmitMs` müssen dieselbe Command-ID und denselben Startzeitpunkt tragen. Der zweite Marker erfasst die Übergabe an den Renderer. Für die Auswertung auf dem Zielgerät fehlen die Referenzmessungen einschließlich Solver- und Frame-Perzentilen und Native24.

[Browserlauf mit Buildbindung](player-cut.json) · [Worker-Rohwerte beider Builds](combined-prepare-branch.json) · [Bytevergleich, ColdLoad und Cleanup](private-save.json) · [Isolierte Messreihe zur Koordinatenänderung](prepare-branch.json)
