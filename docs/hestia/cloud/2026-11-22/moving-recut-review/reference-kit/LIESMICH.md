# Hestia auf dem Referenz-PC messen

Dieses Paket enthält den in `manifest.json` bezeichneten Produktionsbuild, die originalen Messprogramme des Spiels und das im Manifest bezeichnete Playwright-Paket. Zum Ausführen genügen eine installierte Node.js-Version ab 22 und Chrome. Die für das Spiel benötigten Dateien sind enthalten.

1. ZIP vollständig in einen neuen Ordner entpacken.
2. Auf dem Ryzen 9 7950X3D mit RX 7900 XTX eine normale Desktopsitzung verwenden.
3. `Messen.cmd` öffnen. Die Serie erzeugt 30 echte Klickversuche je Solverplatzierung in wechselnder Reihenfolge. Das Fenster meldet den Exitcode. Alle Einzelversuche und die Geräteeigenschaften liegen in einem neuen Ergebnisordner neben dem Programm.

Für eine kürzere Funktionsprobe in PowerShell `node run.mjs serie 1` ausführen. Für zwei aufeinanderfolgende Spielerklicks auf den fallenden Felsarm `node run.mjs folgeschnitt` ausführen. Dieser zusätzliche Funktionslauf verwendet die unveränderte headless-Spielerprobe und beurteilt keine Anzeigelatenz. Mit `node run.mjs pruefen` lassen sich die Dateien ohne Browserstart prüfen.

Bei einer abweichenden Chrome-Installation vor dem Start `CHROMIUM_BIN` setzen. Der Serienlauf prüft den von WebGL gemeldeten GPU-Namen auf „7900 XTX“. Treiber, CPU, RAM und Bildwiederholrate werden separat erfasst. Ein vollständiger Render-Submit ist der letzte automatisch erfasste Bildpunkt. Für die tatsächliche Anzeigezeit sind Präsentationsdaten des Geräts erforderlich. Die Messung und die Ergebnisdateien bleiben auf dem Rechner.
