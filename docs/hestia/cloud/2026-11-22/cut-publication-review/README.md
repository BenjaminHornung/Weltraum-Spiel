# Hestia · Cut-Veröffentlichung im Browser

## Vergleichsstände

Der veröffentlichte A0-Ausgangspunkt ist `1e29cef8f8239b5867ef7d9ac72a181e5fd295f0`. Der frühere Sammelbranch steht auf `78a7ce6c7ded01049c5c9925c31615f6a0461d24`. Die sieben Reviewcommits ab A0 enden bei `7611881c5a77b58ca3fabe41af5b527ab13bc3d5`. Ihr gemeinsamer Tree `c5b3697961ca0c5036acf6005bea4c3950f4ef09` ist bytegleich mit dem Sammelbranch. Die Aufteilung trennt Wetter, Grafik und Rays, Nexus, Strukturindex, Physik, Integration und frühere Nachweise.

Für den ersten Produktvergleich wurde der Tree `fdf337ab996f5e8c72c7ddafc8cf9b4017523f99` auf GitHub als `0bfd2f417d4eb71ff262525e68c38c5496c3d209` veröffentlicht. Er enthält die exakte Vorbereitung der statischen Kollisionsflächen, die gemeinsame kompakte Fragmentidentität sowie die experimentelle Auswahl des Solver-Threads. Der reguläre Pfad verwendet den Worker. Beide Varianten binden dieselbe R05-WASM mit SHA-256 `f26e8ca898782fc1d903971bfa5c71a4b92bd7ed4c32df05e677faee9e18d0bb`.

Die folgende integrierte Testbasis hat den Tree `3576d657e4e3fc713793d458a8e84cc743a02356`, auf GitHub veröffentlicht als `5744c8c3a8534ccf6fa26a2420202851bac51eaf`. Hier werden die häufigen kleinen Terrain-Cuts mit einer Anfrage bearbeitet, die Aufnahme eines Treffers auf ein bewegtes Fragment von der Archivmaterialisierung getrennt und unveränderte Rendererzustände wiederverwendet. Der Vergleich wurde vor weiteren Korrekturen eingefroren.

## Ausgeführte Cloudmessungen

| Umfang | Worker | Hauptthread |
|---|---:|---:|
| Leerer Rundweg, p95 aus je 512 Proben | 0,705 ms | 0,005 ms |
| Kleiner warmer nativer Solver-Step, p95 aus je 1.024 Proben | 0,175 ms | 0,155 ms |
| Derselbe Step einschließlich Zustellung, p95 | 3,655 ms | 0,190 ms |
| Zwei native Fixture-Cuts | 22,995 und 61,920 ms | 13,985 und 4,575 ms |
| Vollständiger Spielerklick im ersten Produktvergleich | 180,9 und 1.925,4 ms | Zweimal SimulationHold vor dem Klick |

Die 17,97 ms aus der älteren Node-Einzelprobe sind keine Untergrenze der Workerarchitektur. Die Arbeit auf dem Hauptthread konkurriert in der laufenden Szene mit dem Rendering. Im Startdiagnoselauf verbrauchten zwei Rendercallbacks gemeinsam 135,6 ms eines 176,5-ms-Intervalls. Beim Mausklick befand sich der Avatar bereits in der Inspektionsansicht. Keiner der Vergleichsläufe stammt vom Referenz-PC.

Der Full-Game-Lauf auf dem weiteren kombinierten Tree mit Ein-Auftrags-Pfad und aktualisiertem Rendering bestätigte den Cut nach 535,4 ms. Beobachtet wurden der Eingabehandler, eine Workerzustellung und eine Bestätigung. Es wurden exakt 64 Zellen gelöscht, 384 Zellen mit 1.722,65625 kg wechselten zum Fragment. Der erste nachweislich zur Revision passende Render-Submit lag bei 2.285,8 ms nach der Eingabe. Davon lagen 1.119,2 ms zwischen dem Ende der Freigabe alter Meshes und dem Submit. Der Screenshot zeigt einen anschließenden SimulationHold. Die angezeigte Bildschirmzeit und die freie Spielbarkeit des Folgeschnitts sind gesonderte Kriterien.

Der private Save- und Kaltstartlauf prüfte ein neu erzeugtes sowie ein früher exportiertes Artefakt. In beiden Fällen folgten ein weiterer Schnitt, eine erneute Speicherung und ein Dispose mit null verbleibenden Workerthreads. Im privaten Recut blieben nach Entfernen von 1,171875 kg genau 148,828125 kg übrig. Alle 72 Vergleichsfälle des Komponentenindex ergaben das erwartete Fragmentergebnis der bestehenden Referenzimplementierung.

## Grenzen des eingefrorenen Kandidaten

Bei verlorenem Ack konnte der isolierte Native-Test den ursprünglichen Cut am gesicherten Basistick wiederholen. Der unabhängige Review wies nach, dass dabei bereits weitergelaufene native Ticks verloren gehen können. Der Test mit einer geworfenen Ausnahme im Root-Callback deckte eine wirklich ersetzte Root nur unvollständig ab. Die Wiederherstellung einer veröffentlichten Revision und die erneute Zustellung desselben Auftrags benötigen einen verbindlichen Nachweis auf einem korrigierten Tree. Aus den erfolgreichen normalen Drei-Stufen-Läufen folgt keine Produktfreigabe.

Der Main- und Worker-Vergleich für den Referenz-PC lässt sich nach dem Build mit einem einzelnen Befehl ausführen. Die Messung umfasst Warteschlangenzeit und alle fehlgeschlagenen Läufe. [Referenzlauf](REFERENCE.md)

## Wiederherstellung nach dem Worker-Commit

Der nachfolgende Core mit Tree `f1990da4b00fa4199b580ea942327ce65ff508fa` legt nach der exakten nativen Query-Veröffentlichung einen zweiten, vorwärts rekonstruierbaren Zustand ab. Diese Hinterlegung definiert den Commit. Geht anschließend die Bestätigung verloren, verwendet die Wiederherstellung R+1. Eine doppelte Zustellung desselben gebundenen Auftrags liefert dessen Ergebnis erneut. Eine zwischenzeitlich ersetzte Root wird vor Überschreiben geschützt. Eine ausbleibende verifizierte Quelle führt zum ausgewiesenen RecoveryHold.

Während der Bestätigung kann die native Physikuhr anhalten. Das bestätigte reguläre Read/Input-Kommando fährt sie unmittelbar wieder an. Für den Standardpfad ergeben sich drei Stufen bis zum abfragbaren Ack, vier bis zum Eingang der Solverfreigabe im Worker und fünf bis zu dessen Rückmeldung auf dem Hauptthread. Den ersten tatsächlichen Solverstep protokolliert der Runner gesondert. Im instrumentierten einzelnen Cloudlauf lagen Ack, Freigabe und erster Step bei 551,6, 551,7 und 581,2 ms ab DOM-Eingabe. Die bestätigte Geometrie ging bei 4.952,4 ms an den Renderer. Der integrierte Tree wird separat gegen A0 geprüft. [Messung der Aktivierung](evidence/forward-activation.json)

## Abhängigkeit von der Weltgröße

Im selben nativen Felsarm-Fall wurden 168 zugelassene Schnitte und 42 korrekte Budgetablehnungen geprüft. Bei 16 dynamischen Körpern stieg der Median für den Neuaufbau der Querystruktur von 0,030 ms bei acht auf 4,377 ms bei 4.063 statischen Collidern. Bei 31 dynamischen Körpern und 4.063 statischen Collidern betrug der Median des gemessenen nativen Pfads 15,307 ms. Die Zahl enthält die synchron gemessenen nativen Abschnitte und die geprüften Kopieroperationen. Sie schließt die Eingabe, die Übertragung und das Rendering aus. Ein neues Zell- oder Colliderlimit für das Produkt wurde daraus nicht abgeleitet. [Native Messreihe](evidence/native-world-occupancy.json)

## Felsarm im eingefrorenen Core

Der veröffentlichte Produktcommit ist `b9fef65a7dc4f08c24da6183af9a7982ff6f5607`. Ein echter Mausklick im regulären Spiel ohne Messmodus ergab nach 377,2 ms einen konsistenten HUD-Eintrag und Physikzustand für Revision 1. Mit eingeschaltetem Messmodus betrug diese Zeit in einer weiteren Einzelprobe 141,7 ms. Beide Spieleraktionen entfernten 64 Zellen und 300 kg. Das laufende Fragment enthielt 384 Zellen und 1.722,65625 kg. Die beobachtete HUD-Zeit schließt die Zustellung der bestätigten Revision an die Oberfläche ein. [Normaler Spielerlauf](evidence/frozen-normal-hud.json)

Im ABBA-Versuch auf genau diesem Core erreichte einer von zwei Workerläufen den Abschluss. Vom Eingabezeitstempel bis zur Hauptthread-Bestätigung vergingen 275,5 ms, bis zum ersten nachfolgenden Solverstep 297,8 ms und bis zum ersten vollständigen Render-Submit 2.180,9 ms. Zwischen Bestätigung und Submit lagen neun beobachtete Framegrenzen. Der andere Worker-Versuch meldete einen Browserabsturz während des Starts. Beide Hauptthread-Versuche erreichten nach der Eingabe das 40-s-Limit für das Spielerergebnis. Der Serienprozess beendete sich mit Exitcode 1. Bei diesem Stichprobenumfang lässt sich kein belastbarer p95-Vergleich für die beiden Platzierungen ableiten. [Alle vier Spielversuche](evidence/frozen-game-series.json)

Die private Speicherung sowie die beiden Kaltstarts mit anschließendem Schnitt bestanden auch auf diesem Produktcommit. Die Prozesse hinterließen jeweils null Workerthreads. Für diese Nachweise bleiben die privaten Slots und die bestehende öffentliche Savesperre maßgeblich. [Private Save- und ColdLoad-Ergebnisse](evidence/frozen-private-cold.json)

Im abgeschlossenen Worker-Versuch vergingen 107,3 ms allein zwischen DOM-Zeitstempel und Eintritt in die Eingabefunktion. Nach weiteren 31,8 ms schickte der Hauptthread den Befehl. Rund 9,9 ms später veröffentlichte der Worker die native Revision. Bis zur bestätigten Abfragbarkeit auf dem Hauptthread vergingen anschließend nochmals rund 126,5 ms. Nach der Freigabe der alten Meshes dauerte es weitere 1.432,7 ms bis zur bestätigten Renderübergabe. Alle Angaben bezeichnen verstrichene Zeit dieser Einzelprobe. Die beteiligten Browser- und OS-Aufgaben lassen sich aus diesen Markierungen allein nicht identifizieren. [Zeitachse desselben Mausklicks](evidence/frozen-click-timeline.json)
