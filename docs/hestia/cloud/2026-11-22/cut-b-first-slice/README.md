# Hestia Cut B | Erster Kandidat

Der normale Spielerpfad misst den physischen Mausklick bis zur Bestätigung des Physics-Workers. Dazu werden der echte DOM-Zeitstempel, die zum Auftrag gehörende Antwort auf FinalizeTerrain, der veröffentlichte World-Snapshot und die Native-Generation abgeglichen. Der frühere Marker ab Confirm-Callback bleibt für bestehende Zeitreihen verwendbar. Der Kandidat für den Block-Komponentenindex wird isoliert geprüft. Der Spieler-Cut verwendet in dieser Fassung den bisherigen Planner und die bisherige Grafikvorbereitung.

[Einzelmessungen, Buildbindungen und Spielergebnis](receipt.json)

## Reproduktion

Im Verzeichnis `apps/weltraum-browser` mit den Projektabhängigkeiten und Git-LFS-Ressourcen ausführen.

```sh
npm run build
./node_modules/.bin/vitest run --maxWorkers=1 --reporter=verbose --silent=false tests/unit/componentIndex/terrainComponentIndex.test.ts tests/unit/hvpIndexedRockArmAdmission.test.ts tests/unit/hvpCutTrace.test.ts tests/unit/hvp-terrain-consumer.test.ts tests/unit/hvp-physics.test.ts
npm exec -- vite preview --host 127.0.0.1 --port 4173 --strictPort
```

Bei laufender Vorschau in einem zweiten Terminal aus demselben Verzeichnis:

```sh
node tests/performance/cut-publication.mjs http://127.0.0.1:4173
```

`CHROMIUM_BIN` kann einen installierten Chromium-Browser auswählen. Der Cloud-Versuch verwendete zusätzlich `HVP_SOFTWARE_RENDERER=1`. Der Runner prüft die tatsächliche Korrelation und den Schnitt. Ein funktionaler Exitcode 0 ist auch bei `within10ms: false` möglich. Die Ausgabe enthält die gemessene Frist und den GPU-Renderer. Die separate Present-Messung auf dem Referenzgerät steht aus.

## Interpretation

Die Topologie-Fixture vergleicht vollständige, geordnete Zelllisten und Materialien auf demselben Snapshot. Die warme Wiederholung verwendet die unveränderten Blöcke aus einer vorherigen Planung. Bei jedem der drei warmen Felsarmversuche wurden zwei geänderte Blöcke neu aufgebaut und 384 Ergebniszellen materialisiert. Das kalte Blockbudget kann eine korrekte Suche mit OverBudget beenden. Der Zähler für Typed Arrays erfasst nur diese Arrays. Der separate Recipe-Test prüft den Fragmentdigest, die exakten Colliderboxen, Schwerpunkt und die sechs unabhängigen Trägheitstensorkomponenten gegen die Materialzellen. Er schließt den nativen Solver, Restore und die laufenden Kontakte nicht ein.

Der nächste Vergleich muss den erneuten Aufbau von struktureller Source und Rigid Recipe im tatsächlichen Cut isolieren. Der aktuelle Index liefert Zellen, wodurch diese Arbeit weiter anfällt. Die Cloud-Zeit eines isolierten Recipe-Tests darf nicht zur Browserlatenz addiert werden.
