# W07 öffentliches CDP-Keyboard: Source-only Preflight

**Enger Driverkandidat technisch zulässig; kein Browser-/Paket-PASS.** Keine Jobs oder Produktwrites. Playwright1.61.1 `coreBundle.js` SHA256 `6be5c2ea035554e9b184b1dbc7aa5e7f1fb428dd1b5c202022858dcfae9bee27`; tatsächlich gelesene E2E `561beee4c9c444deca9e3ccf49cf907dc55f9a3f3676790d61b507151e5cd33e`.

## Tatsächlicher öffentlicher Pfad

`context.newCDPSession(page)` (Client:60925; Server:38176) attachiert einen Protokollclient an **denselben Page-Target**, keinen neuen Game-/RapierWorld. `CDPSession.send:56144`→Dispatcher:51496→SDK:34642→CRSession:34574 sendet Chromiumprotokoll und wartet dessen Antwort.

`CDPSession.send`-Metainfo:4225 enthält weder input/snapshot/pause/slowMo. Dieser Pfad ruft **nicht** Page.keyboard.apiDown/apiUp/`onBeforeInputAction` auf. Tracing:24949ff verlangt ausdrücklich metainfo.snapshot; dessen Page-Inputsnapshotawaits werden damit vermieden. Allgemeine SDK-/Trace-Aufzeichnung bleibt aktiv, kein Traceabschalten nötig.

`Input.dispatchKeyEvent` ist genau der von installiertem Chromium-RawKeyboard:35376/35392 benutzte Browserinput. Gleiche WASD-Payload führt normalen browsererzeugten Tastaturinput zu, keinen Script-`dispatchEvent`, eval-/Native-/Authoritypoke. Tatsächlicher DOMtrusted-/Native-Eventzeitverlauf wurde hier nicht beobachtet.

## Sourcegebundene WASD-Payload

Ohne gehaltene Modifier (bestehende normale Gehphase), für d/KeyD/68:

```js
down = {type:"keyDown", modifiers:0, windowsVirtualKeyCode:68,
  code:"KeyD", commands:[], key:"d", text:"d", unmodifiedText:"d",
  autoRepeat:false, location:0, isKeypad:false};
up = {type:"keyUp", modifiers:0, key:"d",
  windowsVirtualKeyCode:68, code:"KeyD", location:0};
```

Entsprechend a/KeyA/65, s/KeyS/83, w/KeyW/87; Layout:20305/20318–20320, Text/Locationbildung:20412ff. Ausschließlich dieser CDP-Methodenname; keine Mischung mit gleichzeitig gehaltenem Page.keyboard-WASD. Playwrights eigene pressedKeys-Liste wird durch direkten CDP nicht aktualisiert; vollständig abgeschlossene Releases sind daher erforderlich.

## Kleinste Gesture und Closure

Ein öffentlicher CDPSession für bestehende Page; Down senden, externen Node-Timer mit unverändertem25…125ms nominal starten, daraus Up senden **vor Down-ACK**. Beide Promises sofort behandeln/allSettled; danach unbedingt **frisches finales Up** im finally senden/abwarten. Erst danach Native-read/stabilityoracle/nächster Tap. Fehler bewahren/aggregieren; kein erneutes Down, Catch-up oder Runtimepending-/Clockchange.

Bei finalem Releasefehler sofort Fallabbruch/Contextclose, keine weiteren Reads/Taps; vorhandenes afterAll bleibt Sicherheitsnetz. Original30s, ≤8X/≤16Z, Sourcefenster/Reach/grounded/60Hz, normale Trace-/Screenshotgates bleiben. Session beim regulären Teardown detachieren beziehungsweise Context schließen; keine Fehler verschlucken.

Request-/ACK-Zeiten sind Driverdaten. Trotz vermiedener Inputsnapshots bleiben Protokoll-/Browser-/Workerscheduling und tatsächliche Pulsdauer unbekannt; source-seitiger Dispatch beweist keine exakte Weglänge.86-ACKbündelung/zeroMoves belegen die vermutete Ursache nicht; sie sind auch nicht allein ein Floatproblem.

Optional EIN Trace-off-Lauf mit identischen Sources/Orakeln/CLIgrenzen könnte Traceeinfluss eingrenzen. Er ist vor diesem sourcebegründeten CDP-Versuch nicht erforderlich; Trace-off verändert Arbeitslast und beweist allein keine bestimmte Hookursache. Hier nicht ausgeführt und kein Gateersatz.

