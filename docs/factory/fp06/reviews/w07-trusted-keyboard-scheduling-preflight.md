# W07 ordinary trusted Keyboard: Source-only Driverpreflight

**Kandidat technisch zulässig mit enger Release-Ergänzung; kein Browser-/Paket-PASS.** Keine Jobs, Tests, Browser-/Nativeprozesse oder Produktwrites. Nur installierte Playwright-Keyboard-/Protocolkette und aktuelle E2E gelesen.

Bytebindung SHA256: E2E `a194175366d0ab8c553bfe1c325f4c0437e332ab98e5b5586db4816aed74dd9d`; installierter coreBundle `6be5c2ea035554e9b184b1dbc7aa5e7f1fb428dd1b5c202022858dcfae9bee27`.

Playwright **1.61.1**, `node_modules/playwright-core/lib/coreBundle.js`: Client:59498–59512 bildet down/up/press auf normale öffentliche Keyboardkanäle ab. Server `press:20519–20545` wartet zuerst Down einschließlich Raw-ACK, anschließend nominale delay und dann Up. Chromium:35376/35392 sendet echte `Input.dispatchKeyEvent`, keinen DOMdispatch/hook. Daher ist der zusätzliche ACK-Abstand im bestehenden `factory-placement.spec.ts:49–51` **sourceplausibel**. Die tatsächlich beobachtete83-Bewegung beweist weder DOMgap noch diese Ursache; keine solche Behauptung.

## Ordnung und kleinster sicherer Kandidat

`const down=page.keyboard.down(key)`; separat externen Node-Timer mit bestehendem25…125ms-hold starten und daraus `page.keyboard.up(key)` aufrufen, bevor Down-ACK abgewartet wird. Beide Requests verwenden dieselbe Page/Connection; Client:62174–62199 sendet vor Warten auf eigene Antwort. Keine API-Abhängigkeit zwingt den zweiten Request, auf den ersten ACK zu warten.

**Requestreihenfolge beweist jedoch keine allgemeine DOM-/CDP-Reihenfolge.** Dispatcher:18357ff bearbeitet Requests asynchron; apiDown/apiUp:20458/20481 awaiten je eigene Instrumentation. Vorhandene Tracehooks:24975ff können Input-Snapshotawaits enthalten. Für die konkret laufende Sitzung wurde deren Ordering/Dauer nicht beobachtet.

Darum reicht der vorgeschlagene `try await Promise.all([down,up]); finally await up` **nicht** als vollständige Closure: das zweite await wartet lediglich den gleichen Up-Request. Ein verzögertes Down nach bereits abgeschlossenem Up bliebe unneutralisiert. Außerdem kehrt Promise.all beim ersten Fehler zurück, während der andere Request noch laufen kann.

Minimum: beide Requests **settlen lassen**, beispielsweise allSettled mit sofort gebundenen Errorhandlern; danach im finally **neues normales `page.keyboard.up(key)` senden und abwarten**, auch auf Erfolg. Erst anschließend Native-read/stabilityoracle oder nächste Gesture. Gesammelte Fehler anschließend unverändert weiterwerfen. Keine Wiederholung des Down und kein Catch-up. Timer und Fehlerpfade dürfen keine unhandled Rejection oder spätere Gesture außerhalb des Falls hinterlassen.

## Fehler und Grenzen

Geht der abschließende Release verloren oder schlägt fehl: Fall abbrechen, keine weiteren Reads/Taps; bestehenden Context schließen und Fehler bewahren. Context-afterAll ist endgültiges Sicherheitsnetz, kein Beweis erfolgter Keyup. Ursprüngliche30s-Fallgrenze bleibt; keine größere Deadline, Queue oder Runtimepending-Cap.

Bestehende nominale25…125ms/≤8X-/≤16Z-Gesten, unveränderte Sourcefenster, normale Pointerlock-/Native60Hz-/Reach-/Stopassertions beibehalten. Runner-Issue-/ACK-Zeiten sind nur Drivertelemetrie, keine DOM- oder Native-Eventzeiten. Parallelrequests können tatsächlichen Puls verkürzen oder überspringen; Erfolg und präzise Weglänge bleiben echte Browserorakel. Kein Runtime-/Owner-/Terrain-/World-/Inputlatchgrant entsteht.
