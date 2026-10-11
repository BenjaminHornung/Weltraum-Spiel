# W07 Input-/Tick-Diagnose: unabhängiger Source-only Review

**PASS für die enge korrigierte erste Phase ohne Measurementtoggle.** Kein Execution-/Produktgrant, Browser-, Performance-, Cause- oder Paket-PASS. Nur Source-/Hashreads; keine Tests, Builds, Browser-/Native-/Profil-/Verifierjobs oder Produktwrites.

Geprüfter Vorschlag3982B/SHA256 `2974eff1e16d66fdc03fd632ebd58f52aa62b59eaa2c9717a436470608851277`. Aktuelle Runtime: Session `3bd432ac…`, Client `4b8bfe57…`, Worker `776ec49c…`, Locomotion `59957019…`. Basisseal `201394fb8346e8b12c93b0bb5d52c34d180d966a80c884697813b9d224c511d4`; keine geänderten Runtimebytes aus diesem Review.

Read-only Baselinebindung18:10:11.453662UTC: alle30 tatsächlichen Pfade/Bytes stimmen dem Basisseal, null Drift. Das ist keine zukünftige Overlay-Restorereceipt.

## Notwendige enge Korrekturen

1. Erste Phase **normales `/factory.html`**, `hvpMeasure=1` entfernen. DOMevent→Mainpost→ACK plus normale NativeSnapshot-Ticks reichen zum ersten Eingrenzen. CPU-/solverStepfelder **NOT_OBSERVED**, keine erfundene Null. Optional unterstützte Longtasks separat als beobachtete Main-Tasks, nicht gesamte Main-/WorkerCPU. Observer selbst verändert Arbeitslast geringfügig; kein Performancevergleich.
2. ACK-Zeit ist **Mainempfang**, nicht Workerhandler-/Nativeinput-Verbrauchszeit. FactoryInput:Worker78–87 liefert ausschließlich id/rejected; erfolgreiche id-ACK beweist **nicht**, ob `session.factoryInput` angenommen oder aufgrund tatsächlicher Guardlage verworfen wurde. `clock.lastCommand/lastHandlerMs` wird dort nicht aktualisiert; darf nicht als FactoryInput-Executionlabel dienen.
3. Falls danach zwingend gefragt wird, ob beide Intents zwischen tatsächlichen Solversteps lagen: separate zweite diagnostische Phase mit vorhandenem Toggle und expliziter Arbeitslastabweichung. Auch dann sind `timings.steps` **Solverstart/-dauer**, keine vollständigen Tick-/Characterstep-/FactoryInputedgezeiten: Session114 ruft Character.step VOR115 solverStart auf. `origin+step[0]` ist Worker-absoluter Solverstart. Keine exakte Eingangszeit daraus erfinden.

## Sourcekonforme Beobachtung und Closure

NativeTick ist1/60 (`tick.ts:1`), existierender Workerinterval:99–118 ruft privaten `session.advance`; Tick verarbeitet höchstens4Steps und kann SimulationHold setzen. Keine Advance-IPC im tatsächlichen Messageunion. Observer ruft weder advance noch RAF/Render/Play/Input/Worldmethoden auf.

Passive capture-Listener vor Bubblehandlern dürfen nur vorhandene Event-/Pointerlock-/Visibilityfelder lesen; kein preventDefault/Propagation-/Fokuswechsel. Workerwrapper ausschließlich für name=hvp-simulation-owner: unveränderte Konstruktorargs, Original-postMessage inklusive exakter Transferargs per Reflect.apply, **dessen Return/Throw unverändert**. Loggingfehler separat abfangen; Originalcall außerhalb Loggingcatch. Replylistener lässt onmessage/onerror/Daten unverändert; primitive Projektionen, keine Bufferkopie/Retention. Map512/Records4096 begrenzen allein Beobachtung, zählen Dropped/Errors und leiten weiter. Overflow/Observererror macht Diagnose unvollständig, niemals Transport freier.

Vier originale≤30s-Serienfälle: normales Ready/Open/Play, danach125/250/600ms echte CDPgesten mit bestehender allSettled/fresh-finalUp-/Fehler-/Contextabortclosure.600ms ist ausdrücklich einmalige Diagnose, kein Ausbau normaler125ms-Tapgrenze. Gleiche Page/NativeWorld; read-only Projektion erst nach Release. Null Bewegung bleibt erlaubtes Ergebnis, keine vorweggenommene Ursachenfeststellung.

Overlay ausschließlich temporäre E2E/initScript; Originalbytes und88-Artefakte vorab bytegenau archivieren. Im finally Context schließen, Overlay **bytegenau zurücknehmen**, alle30 Basissealpfade/Bytes/Hashes prüfen und Receipt sichern, auch bei Timeout/Abbruch. Keine normale Paketevidence durch diagnostische Wrapper/Globale ersetzen. Tatsächliche Wrapperimplementierung und Ausführung müssen diesen Sourcevorschlag erst noch erfüllen.
