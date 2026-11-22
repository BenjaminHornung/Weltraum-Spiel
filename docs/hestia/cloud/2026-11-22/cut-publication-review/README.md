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
