# W07 DOM-/Layout-Quellenprüfung

**SOURCE_ONLY; Ursache offen.** Run94 meldet `renderFrame` Median 0,6 ms (60 Aufrufe/66,6 ms), Dispatch120 435,2 ms und Main-Longtasks 141–202 ms außerhalb des Backends. Daraus folgt weder eine GPU-Ursache noch ein bewiesener Layoutverursacher. Keine Ausführungsjobs oder Produktänderungen; Referenzen unter `apps/weltraum-browser/src/`.

`hvp/hvpBootstrap.ts:2306,2310–2318,2324` schreibt pro RAF Tool, Residency, Neighbor, vollständigen Physics-Snapshot, Clock und Structure als Body-Datasets und ruft `hud.updatePhysics()` auf. `2290–2295` ergänzt alle 60 Frames Renderdiagnostik. Größen sind zustandsabhängig; eine tatsächlich riesige DOM-/JSON-Last wurde hier nicht gemessen. Datasetattribute allein zeigen keine erzwungene Layoutberechnung.

`hvp/hvpHud.ts:239–288` arbeitet auch bei unverändertem Snapshot: `updateSave():232–236` ersetzt Text/Dataset und setzt Buttonzustände; Tool/View/Neighbor/Pause/Physics/Mode werden wiederholt über `textContent` ersetzt. Neighbor `246,248`, Tool `242,272–276` und Physics `279,282,288` werden teilweise mehrfach per `+=` zusammengesetzt. Das sind DOM-Schreibkandidaten. `textContent`-Reads erzwingen selbst keinen Layoutread. `252–256` setzt `hidden`, Reticle-`left/top/background` pro Frame; Prozentpositionen können Style-/Layout-/Paintarbeit vorbereiten. Feedback `258,260,265` vermeidet bereits identische Textwrites.

`factory/factoryEntry.ts:46–55,65–66` projiziert über Host- und Sessionabonnement, daher bei Tickfortschritt möglicherweise zweimal. Clockdataset/Statustext/Buttons werden auch ohne sichtbare Änderung geschrieben. `updateBuild():28–32` begrenzt ausführliche Constructiondataset-/Textwrites bereits über einen Schlüssel; vorherige Fakt-/Vorschaureads bleiben vorhanden.

In diesen RAF-/HUD-/Entry-/Playerinput-/Cameraquellen fand ich keinen `getBoundingClientRect`, `offset*`, `clientWidth/Height`, `getComputedStyle` oder `innerText` im untersuchten Pfad. **Keine belegte synchrone Forced-Layout-Schleife.** HUD und Werkstatt haben feste Position und begrenzte Breite (`hvpHud.ts:110–140`, `factoryEntry.ts:15`), aber textabhängige Höhe. `style.css:1–11,37–40` setzt Viewportgrößen/Overflow; keine HVP-/Factorydataset-Selektoren oder `:has()` gefunden. CSS-Umfang allein beweist keine Kosten.

Falls Timeline DOM-/Stylearbeit auswählt: gleiche Darstellung ohne redundante Writes; Guards müssen Pause/Hold/Recovery, Savephase, Cargo-Reach/Open, Perspektive/Aim/UIvisibility, Epoch/Dispose auch bei gleichem Tick berücksichtigen. Fach-REDs: unveränderte Darstellung ohne Textnode-/Attributmutation; gleicher Tick mit Hold/Save/Cargoänderung aktualisiert; Cutfeedback und Aim bleiben sichtbar korrekt. Clock/Physicsdataset weiterhin tatsächliche Projektion, keine neue Authority.

Gelesene Bytes: Bootstrap `ab5ec227…`, HUD `2e89c73b…`, Entry `ad7f1bb5…`, CSS `83100be9…`; alle nach Reads gehasht. Timeline bleibt ausstehend.
