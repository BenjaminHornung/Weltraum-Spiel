# Felsarm auf dem Referenz-PC

Zielgerät ist der Ryzen 9 7950X3D mit RX 7900 XTX. Der Lauf startet eine lokale Vorschau des gebauten Spiels und öffnet Chrome mit sichtbarem Fenster. Er benötigt eine aktive Desktopsitzung. Der Auswertungsordner muss neu sein. Git LFS muss die zum Checkout gehörenden Dateien bereitgestellt haben.

In PowerShell ab Repositorywurzel ausführen.

```powershell
Set-Location apps/weltraum-browser
npm ci
if ($LASTEXITCODE -ne 0) { throw "npm ci fehlgeschlagen" }
npm run build
if ($LASTEXITCODE -ne 0) { throw "Build fehlgeschlagen" }
$env:CHROMIUM_BIN = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
$env:HVP_REFERENCE_GPU = "7900 XTX"
node tests/performance/cut-reference.mjs hestia-reference-01 30
```

Der Runner protokolliert Git-Stand, getrackte Arbeitskopieänderungen, Build-Dateihashes, CPU, RAM sowie unter Windows Grafiktreiber und aktuelle Bildwiederholrate. Jede erfolgreiche Probe enthält die Browserkennung und den von WebGL gemeldeten Renderer. Die 30 Paare liefern je 30 Klicks pro Platzierung, abwechselnd Worker/Hauptthread und Hauptthread/Worker. Ein Hold vor der Eingabe bleibt als Fehlversuch enthalten. Ausfälle stehen in `series/summary.json` und in den zugehörigen Laufprotokollen.

Das 10-ms-Fenster beginnt am DOM-Zeitstempel des angenommenen Mausklicks. Es endet mit dem Eingang der Bestätigung der veröffentlichten und abfragbaren Physikrevision im Hauptthread. Zu jedem Lauf gehören der Zeitwert, die Anzahl der Aufgabenübergänge, die Solverzeiten und die Frameintervalle. Der Runner erfasst zusätzlich die tatsächliche Freigabe des Solvers für die nächste Simulation und den ersten beobachteten Solverstep. Ein früher Ack bei weiterhin wartendem Solver genügt dem strikten Spielbarkeitskriterium nicht. Die Zusammenfassung weist p95 sowie die Anzahl der Einzelüberschreitungen getrennt aus. Die Kriterien für den Vergleich sind p95 ≤ 10 ms, höchstens drei beobachtete Stufen, Solver-p95 ≤ 4 ms und Frameintervalle p95 ≤ 20 ms sowie p99 ≤ 33,34 ms. Der automatische Exitcode verwendet das strikte Einzelklickziel und die gepoolten rohen Frame- und Solverzeiten jeder Platzierung. Die Felder unter `byPlacement` erhalten die Ergebnisse je Solverplatzierung. Fehlende Daten, fehlgeschlagene Spielversuche und ein abweichender GPU-Name lassen die jeweilige Prüfung scheitern.

Für das Bildziel zählen die bestätigte Geometrie und ihr erster Frame. Der Renderer meldet seine Übergabe mit Revision und Digest. Ein physisch angezeigter Frame innerhalb von zwei Bildintervallen braucht zusätzlich Präsentationsdaten des Zielsystems. Das Diagnoseprofil `HVP_CUT_CHROME_TRACE` ist für separate Durchläufe vorgesehen. Die Traceaufnahme selbst verändert die gemessene Last.
