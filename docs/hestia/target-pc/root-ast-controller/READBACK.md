# R04 kritischer Root-Controller – Source-Readback

**Status:** `SOURCE_ONLY_PREPARED_NO_R04_AUTHORITY`. Quellenstand 22.10.2026: keine R04-Frage, kein Grant, keine Runtime-Control-Datei und kein Outputordner wurden erzeugt.

## Ablauf

1. Die Preload-Zelle startet den adaptierten vollständigen Read-only-Gate und prüft Controller, Template, Verifier, Runner, Cache, sechs feste Inputs sowie beide unveränderlichen R03-SPENT-Belege (13 Sourcepins) und verlangt sechs abwesende R04-Controlpfade, vier abwesende R01–R04-Evidenzroots, aktuellen HEAD, G01, M5 und einen idle A0 mit vollständigen letzten Turnmetadaten.
2. Sie liest Controller und Cache jeweils genau einmal, hasht exakt diese Bytes und speichert ausschließlich SHA-gebundenen serialisierbaren Controllertext und vorbereiteten Cache in `store`; keine Funktion wird gespeichert. Post-reply prüft ein fest eingebetteter ASCII-SHA-256 beide Rohtexte rein im V8 vor jedem externen Call und vor T0; die bekannte `abc`-SHA dient als Selbstprüfung. Nicht-ASCII wird abgewiesen.
3. Nach einer späteren neuen tatsächlichen R04-Antwort kompiliert der eine post-reply Root-Exec ausschließlich den gecachten Controllertext.
4. Der Controller validiert neue Question-ID/Token, erfasst T0 einmal, schreibt Initial-Consumption sofort, sendet genau einmal an denselben A0, bindet echten Turn/Owner/CWD/HEAD und veröffentlicht Task → Approval → Consumption → Ready.
5. Vor Dispatch und Ready-Publish wird die ursprüngliche T0-Frist erneut geprüft; der atomare Move prüft T0+90 s und App-Ende zusätzlich im PowerShell-Host. Ready ist der letzte Zulassungseffekt. Danach wird derselbe Turn nur beobachtet; kein zweites Send und kein neuer Turn.
6. Abschluss bedeutet erst PASS nach finalem `read_thread` mit endlichen Start-/End-/Dauerdaten sowie vollständigem Readback von Receipt, A0-Result und fünf Control-Dateien. Alle sieben Readbackzeilen brauchen positive Bytezahl, 64-stelligen SHA-256 und Rohtext; die fünf Controls müssen außerdem bytegenau zum zuvor gepinnten Rohtext passen. Das A0-Result muss auch fünf M5-Copies, acht abwesende M5-Slots und `g01Accepted: true` bestätigen.

Uhren: Root `T0+15 min`; Binding/Ready `<T0+90 s`; A0 `min(actual startedAt*1000+10 min, RootEnd)`; Recorder startet nur mit vollen 60 s Restbudget und behält 48/60-s-Stopwatch. STOP beim ersten Fehler, Retry 0.

Die sechs Inputhashes umfassen zwei aktuelle Produkttexte, deren zwei Vorhertexte, Checker und Recorder. Nur vier Produkttexte werden mit dem TypeScript-Parsermodul im selben Nodeprozess geparst. Produktimporte, Produktmethoden, Unit-Tests, Builds und semantische Typprüfung bleiben gesperrt.

R03 bleibt SPENT: Initial 887 Bytes / `599a312e…6ab67`, Stop 1.773 Bytes / `684820da…09623`, Call `call_cf1f33842b8b4ec0ab389519c038342b` und R03-Token autorisieren R04 nicht.

## Sourceprüfungen

- `R04_CONTROLLER.js` und beide Exec-Fences kompiliert mit reinem V8 `new Function`.
- `R04_A0_RUN_ONCE.ps1` und `R04_VERIFY_PREPARATION.ps1`: PowerShell-Parser 0 Fehler.
- `R04_TEMPLATE.json`: JSON parsebar; Runner-/SPENT-Bindungen vorhanden.
- Pure-V8-Simulation mit ausschließlich Fake-Tools: fehlender/gestörter Cache ohne Effekte; nicht aufrufartige und bereits verwendete Question-IDs ohne Effekte; fremder Poll-Host, fehlender neuer Cursor und ein nicht abgeschlossener letzter G01-Turn ohne Ready; fremder Host beim Closeout ohne PASS; fehlender Evidenzhash, geänderter Control-Rohtext trotz gleicher Metadaten und fehlende M5-/G01-Resultate ohne PASS; gültiger Pfad genau ein Send und `ready-publish` als letzter Zulassungseffekt.
- Tatsächlicher post-reply Entry-Guard mit Throw-on-access-Fake-Tools: fehlende/alte R03-Antwort sowie gekürzter Controller oder Payload erzeugen null externe Calls.
- Der qualifizierte vorhandene Ownerstatus darf exakt `idle` oder `notLoaded` sein; letzter Turn muss weiterhin der bekannte abgeschlossene G01-Turn mit endlichen Metadaten sein.

## Grenzen

Node, AST, Checker, Recorder, PowerShell-Runner, Compiler, Tests, Build, Browser, M5, Physik, GPU, Save und Installation: `NOT_RUN`. Root darf diese Source nicht als neue Freigabe oder als Produkt-/Runtime-Nachweis behandeln.
