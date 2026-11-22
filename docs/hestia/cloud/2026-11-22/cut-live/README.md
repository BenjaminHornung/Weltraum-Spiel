# Hestia · Spieler-Cut und gemeinsame Darstellung

## Ziel und Spielprobe

Ein Spieler trennt mit einem Mausklick die Stütze des Felsarms. Der Schnitt gilt spielerisch als bestätigt, wenn der Eingabethread die Veröffentlichung der exakten nativen Generation und der zugehörigen Voxelrevision bestätigt hat. Die primäre Uhr startet am DOM-Zeitstempel des echten Mausklicks. Eingabewartezeit, Nachrichtenwege, Wartezeit auf die Physikwelt und Freigabe zählen mit. Die Zielwerte sind ≤ 10 ms für jeden qualifizierten Schnitt auf dem Referenzgerät und das erste passende Bild innerhalb von zwei regulären Anzeigegelegenheiten und zwei nominellen Bildintervallen nach der Bestätigung. Zur Verteilung gehören p50, p95, p99, Maximum und jede Überschreitung. Die Ergebnistabelle in `evidence/attempts.json` führt auch abgebrochene und abgelehnte Versuche.

Der Kontrollstand ist `cfa7cf7d35e13c7321bf3c819f4826e3dc62c003`. Der erste veröffentlichte gemeinsame Kandidat ist `89c9c657e672fa8d9a82e09623e896ff35283ac0`, Git-Tree `563fead7515ad3a8d620dbd2c9a58cc8da127a9d`. Die Testdaten nennen teilweise lokale Commit-IDs. Der gemeinsame Tree und der Hash des gebauten Clients binden diese an den veröffentlichten Inhalt.

## Ergebnisse vom 22. November 2026

Der veröffentlichte Produktcommit ist `d84b5532068e8e584d031dbdc398c96c405812d4`. Sein Tree `b43941e6002cfab9b6d24a7a8ee39a4669cf4ae8` stimmt mit dem getesteten lokalen Stand überein. Der Produktionsbuild mit TypeScript und Prüfung der R05-WASM endete mit Exitcode 0. Die Buildidentität und die Einzelmessungen stehen in [receipt.json](receipt.json).

| Echte HVP-Spielerklicks im finalen Build | Klick bis bestätigte Physikrevision | Klick bis erste passende Renderübergabe |
| --- | ---: | ---: |
| Standard, Lauf 1 | 672,1 ms | 5.654,9 ms |
| Standard, Lauf 2 | 1.134,7 ms | 2.482,5 ms |
| Eingabepriorität, Lauf 1 | 564,5 ms | 1.438,7 ms |
| Eingabepriorität, Lauf 2 | 1.088,2 ms | 9.804,8 ms |

Alle vier Klicks durchliefen den normalen HVP-Eingabepfad in Chromium 149 mit SwiftShader. Sie entfernten je 64 Zellen mit 300 kg und übergaben genau 384 Zellen mit 1.722,65625 kg an einen dynamischen Körper. Alle vier überschritten 10 ms. Die Eingabepriorität bleibt eine messbare Option. Zwei Versuche je Variante auf gemeinsam genutzter Hardware rechtfertigen keine Aussage über die schnellere Voreinstellung. Der Renderer lieferte die erwartete Weltrevision. Die tatsächliche Anzeigezeit wurde nicht erhoben.

In einem instrumentierten R11-Klick umfasste die Vorbereitung der statischen Kollision 755,6 ms verstrichene Zeit. Die sieben gemessenen Arbeitsscheiben summierten sich auf rund 10,2 ms. Auf dem finalen Standardpfad beanspruchte dieselbe Vorbereitungsphase 410,3 bzw. 744,7 ms. Die native Vorbereitung belegte weitere 108,4 bzw. 195,7 ms verstrichene Zeit. Damit bleibt im Spielerpfad erhebliche Wartezeit zwischen den Arbeitsschritten. Die Daten weisen sie keiner einzelnen Browserkomponente zu. Solver-Step, Schedulerlatenz und Geometriearbeit sind eigene Messgrößen.

Der separate kompakte Fragmentbesitzer senkte in 32 gepaarten Warmmessungen nach vier Aufwärmpaaren die p95 für Rezept, native Installation und Query-Veröffentlichung von 22,68 auf 0,73 ms. Ein vollständiger Rundweg zum echten Worker dauerte separat 17,97 ms. U-förmige Geometrie, Material und Bewegung bleiben erhalten. Für den Einsatz im normalen Produktpfad müssen Veröffentlichung, Picking, Darstellung und Wiederanlauf dieselbe versionierte Fragmentidentität verwenden. Ein Vollquader aus den äußeren Grenzen würde das Loch einer U-Form verschließen. Die erhaltenen Messdaten stehen in [isolated-compact-native-ab.json](evidence/isolated-compact-native-ab.json) und [compact-native-worker-ipc.json](evidence/compact-native-worker-ipc.json).

Zwei echte private Exporte wurden im finalen Build in separaten Prozessen kalt geladen. Einer stammte aus diesem Build, einer aus R3. In beiden Fällen war das Fragment in Bewegung, der erneute Schnitt verringerte die Masse von 150 auf 148,828125 kg und der neue Spielstand erreichte Revision 2. Nach dem Freigeben waren Worker, Jobs, Timer, Listener, native Körper und Collider jeweils null. Diese Laborszene und die Felsarm-Spielerprobe verwenden verschiedene Ausgangskörper.

Der breite Vitest-Lauf auf dem gekennzeichneten R4-Stand umfasste 312 Testdateien. 288 bestanden, 21 schlugen fehl und 3 überschritten das Dateizeitlimit. In den ausgewerteten Ergebnissen standen 2.992 bestandene, 43 fehlgeschlagene und 24 übersprungene Einzeltests. Ein Vergleich derselben 18 auffälligen Suiten auf Ausgangsstand und R9 ergab jeweils 149 bestandene, 34 fehlgeschlagene und 16 ausstehende Fälle. Der finale fokussierte Lauf unter Node 24 bestand mit 74 Tests in zwölf Dateien. Die Belege nennen die jeweilige Quellversion. [Breiter Lauf](evidence/r11-verification.json) · [Vergleich der Regressionen](evidence/paired-regression-triage.json)

Alle 19 seit dem Ausgangsstand geänderten Unit-Testdateien bestanden unter Node 22.23.2 mit 208 von 208 Tests. Alle 1.043 geprüften Quell-, Test- und Assetdateien des finalen Trees stimmten mit Git oder ihrem Git-LFS-Hash überein. Die Browsergruppe für Live-Spielabläufe auf R4 endete nach 30 Minuten. Von 47 Fällen bestanden 4, 16 schlugen fehl, 4 liefen einzeln ins Zeitlimit und 23 starteten vor dem Abbruch nicht. [Testergebnisse](evidence/final-targeted.json)

Die Skalierungsprobe lief auf dem finalen Build für acht Geometrien mit jeweils drei Wiederholungen und drei Cachezuständen. Alle 72 Vergleiche stimmten mit dem bisherigen Stützplan überein. Für den vorgeladenen Felsarm wertete der Index zwei Blöcke neu aus, besuchte 21 Komponenten und kopierte im Index keine Voxel-Nutzdaten. Die anderen Geometrien umfassen ein gemischtmaterialiges U sowie diagonale Strukturen über drei, sieben und elf Blöcke, jeweils mit und ohne zweite Stütze. Die Arbeitszähler und Zeiten stehen in [component-scale.json](evidence/component-scale.json).

Zwei zusätzliche echte Spielerlaufversuche beobachteten denselben Felsarm jeweils über 1,50 m im Fall. Nach dem Aufsetzen bekam das automatisierte Zielen unter Pointer Lock keine bestätigte Vorschau auf den gefallenen Körper. Der zweite Spielerklick wurde deshalb nicht ausgelöst. Beide Läufe endeten mit laufender Physik. Im ersten wurde der Solver vorher mit der normalen Schaltfläche „Spiel fortsetzen“ aus dem SimulationHold geholt. Das ist eine offene Lücke in der Spielerabnahme. Die getrennten privaten Recut-Tests durchliefen den nativen Schnitt erfolgreich. [Zielerfassung und Zustand beider Spielerlaufversuche](evidence/moving-browser-recut.json)

## Implementierung

- Der normale HVP-Spielerpfad betreibt einen abgeleiteten Zusammenhangsindex über die geladenen 16³-Blöcke. Der Cache wird aus dem Besitz des Terrain-Roots befüllt. Der Index berücksichtigt mehrere Komponenten im selben Block, Stützen, offene Grenzen und Materialwechsel. Unveränderte Komponenten liefern Materialläufe und Masseneigenschaften. Die bisherige Stützsuche steht als Vergleichspfad zur Verfügung.
- Die unveränderlichen Materialläufe überqueren die Workergrenze. Nur betroffene statische Kollisionsflächen werden mit identischer Dreiecksreihenfolge neu gepackt. Die native Zulassung prüft Belegung und Form. Der laufende Produktpfad erzeugt für Fragment-Identität und Wiederherstellung weiterhin das kanonische v1-Objekt.
- Während des nativen Umbaus schützt die Transaktion die laufende Physikwelt. Eine bestätigte Änderung bleibt auch beim Verlust der Workerbestätigung oder bei einem Darstellungsfehler erhalten. Die Wiederherstellung verwendet eine vorbereitete Basis, geänderte Sektoren und die zum gehaltenen Tick gehörenden Körperdaten. Die Kollision ist vor dem nächsten Solver-Step abfragbar. Ein zuvor angehaltener Tick behält auch bei Wiederherstellung seinen Rückstand.
- Die Darstellung liest die bestätigte Quelle, erzeugt die aktuellen Flächen samt Material und Ambient Occlusion und veröffentlicht sie in der vorhandenen Three-Renderloop. Ein vorher fragmentierter und inzwischen erneut geschnittener Körper kann durch seine verspätete Grafik nicht mehr zurückkehren. Die Messung für den ersten Submit vergleicht Terrain, sichtbare Sektoren und native Generation.
- Der Wetterpfad liest PlanetaryMacro und WXG mit gebundener Session, Weltrevision und Simulationszeit. Die bestehende Three-Szene übernimmt die bestätigte optische Extinktion und Windrichtung. Die Hestia-Küstenkonfiguration liefert keine kondensierbare Spezies. Die Ray-Komposition akzeptiert einen gebundenen Kontaktpass nur zusammen mit echten Licht- und Oberflächenwerten für denselben Frame.
- Ein isolierter Vergleichsrunner lädt die R05-WASM und verwendet die gepinnten Nexus-Fall- und Stapelszenarien. Numerische CPU-Ergebnisse und der Nexus-Buildabbruch sind in den Belegen getrennt erfasst. Rapier R05 bleibt der aktive Solver.

## Nachvollziehen

Das Repository samt Git-LFS-Inhalten und den zum Commit passenden Abhängigkeiten verwenden. Befehle im Verzeichnis `apps/weltraum-browser` ausführen.

```sh
npm run build
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Im Browser `/?hestiaPrototype=1&hvpScenario=rock-arm` öffnen. Nach „Ready“ zuerst „Stütze anvisieren“, dann „Spielen“ wählen. Bei der Vorschau „64 Stützzellen“ links klicken. Die automatisierte Version benutzt Pointer Lock und einen realen Playwright-Mausklick.

```sh
node tests/performance/cut-publication.mjs http://127.0.0.1:4173
HVP_CUT_PLANNER=oracle node tests/performance/cut-publication.mjs http://127.0.0.1:4173
HVP_CUT_VISUAL=local node tests/performance/cut-publication.mjs http://127.0.0.1:4173
HVP_CUT_PRIORITY=input node tests/performance/cut-publication.mjs http://127.0.0.1:4173
node tests/performance/cut-publication-series.mjs http://127.0.0.1:4173 30 hestia-reference-run-01
node_modules/.bin/vitest run tests/unit/componentIndex tests/unit/hvpLiveSupport.test.ts tests/unit/hvpLiveRenderDelta.test.ts tests/unit/hvpCompactNativeSource.test.ts tests/unit/hvp-terrain-publication-channel.test.ts tests/unit/hvp-terrain-worker-recovery.test.ts
```

Für den tatsächlichen Zielbrowser `CHROMIUM_BIN` auf dessen ausführbare Datei setzen. `HVP_SOFTWARE_RENDERER=1` dient ausschließlich der Cloud-Reproduktion. Die historische Browserkontrolle lief mit Chromium 149 und SwiftShader. Eine CPU-Renderübergabe belegt noch keinen Bildschirmzeitpunkt. Die privaten Kaltstartprüfungen verwenden jeweils einen eigenen Prozess, prüfen die nachgeladene Physik und messen die Ressourcen nach dem Dispose. Der öffentliche Save-Cutover bleibt gesperrt.

## Offene Produktgrenzen

Die formale Abnahme braucht den realen Zielbrowser auf dem Ryzen 9 7950X3D mit RX 7900 XTX. GPU, Treiber, Bildwiederholrate und Browserbuild beim Lauf erfassen. Der Serienrunner bewahrt auch Abstürze, fehlende Bestätigungen und Überschreitungen auf. Das Bildziel benötigt zusätzlich ein Präsentationsereignis. Die Bindung der 16 Sektorhashes belegt die ausgegebene Geometrie.

W1 liefert Wind und optische Extinktion. Für simulierten Regen und Schnee fehlen eine mit dem Klima verbundene kondensierbare Spezies samt Vorrat, ein Phasenmodell und ein Niederschlagsfluss. G1 besitzt die Renderkomposition. Für temporales Upscaling fehlen die vollständigen Frame-Attachments einschließlich Bewegungsvektoren und History. Der R1-Pass verarbeitet passende Lichtdaten, deren vollständiger Lieferant im normalen Frame noch fehlt. Ein integrierter Fotomodus ist offen. N1 hat einen ausführbaren R05-Kontrollpfad. Der gepinnte Nexus-Build bricht beim fehlenden `SourceBindings.json` ab. Im Cloudimage fehlen außerdem Rust und Cargo. FP06 wurde in diesem Kandidaten separat belassen.

## Abnahme

Für den Felsarm müssen 64 Zellen und 300 kg aus dem Schnitt verschwinden und genau 384 Zellen mit 1.722,65625 kg zum dynamischen Besitzer wechseln. In beiden Referenzpfaden müssen die 16 Sektorhashes übereinstimmen. Eigener Export und älterer Export müssen kalt ladbar, erneut schneidbar und freigebbar sein. Die Datei `evidence/regression.json` dokumentiert den breiten Testlauf auf dem angegebenen Tree. Weitere Läufe nennen ihren jeweiligen Quell- oder Buildstand. Die formale Zielgeräteabnahme, physische Bildausgabe, eine qualifizierte öffentliche Save-Migration und die Integration von FP06 liegen außerhalb der ausgeführten Cloud-Nachweise.
