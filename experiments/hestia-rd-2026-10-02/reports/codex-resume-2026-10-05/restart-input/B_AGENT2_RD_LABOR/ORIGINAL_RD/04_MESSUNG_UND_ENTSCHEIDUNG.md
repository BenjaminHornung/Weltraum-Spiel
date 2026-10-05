# Messvertrag, Abnahme und Übergabe

## 1. Was bereits bindend ist und was neu vorgeschlagen wird

Aus dem V3-Checkpoint werden unverändert übernommen: HVP-Quantum 0,125 m; eine native World-Authority im Produkt; CPU 268435456 B; Mesh 134217728 B; 500000 Dreiecke; 300 Draw Calls; Prepare 96 MiB; Output 8 MiB; zwei schwere Jobs; Queue 32; Diagnostikreserve 512 KiB; maximale zusammenhängende Arbeit 8 ms; Slice-p95 4 ms; Input→Applied und Input→Render p95 je 250 ms; echter Body-World-Hold p95 50 ms; keine vorbereitungsbedingten Timerlücken über 20 ms.

Diese Werte sind **keine im Labor bereits gemessenen Erfolge**. Ein Raymarcher lässt sich nicht allein mit Dreiecken bewerten. Dafür müssen Renderziel-/Volumen-/Beschleunigungsdaten, Rays/Traversalbudget, Uploads und Peakkoexistenz zusätzlich erfasst werden. Kein Wechsel des Zählers macht Speicher oder Rechenarbeit kostenlos.

Neue Startziele ausschließlich für den ersten Effektvergleich: kombinierte zusätzliche Mainthread-Effektarbeit p95 höchstens 1 ms/Frame, zusätzliche GPU-Effektarbeit p95 höchstens 2 ms/Frame, zusätzliche CPU-Livedaten höchstens 8 MiB und zusätzliche GPU-Allokationsschätzung höchstens 16 MiB. Diese sind vorgeschlagene Laborallokationen, keine Freigabe zum Überschreiten der bestehenden Gesamtszenencaps. S0/SO-06 frieren sie vor dem ersten Auswahlbenchmark ein; nicht nach einem schlechten Ergebnis erhöhen.

Ziel ist ein stabiler 60-Hz-Playerpfad. rAF-Intervalle sind kein GPU-Timer; ein 16,7-ms-VSync-Plateau beweist nicht, dass zwei Renderer gleich viel GPU-Arbeit benötigen. Auf dem eigentlichen Produkt muss jede spätere Integration sämtliche bestehenden Ziele erneut einhalten.

## 2. Drei verschiedene Laufarten

**Funktion/Diagnose:** einmaliger Smoke, reale Browserfehler, Sourcewechsel, Pause/Dispose. Profiler, Bilder, Traces und zusätzliche Observer erlaubt. Ein n=1-Wert ist keine p95-Abnahme.

**Bild/Bewegung:** feste Kamera, Sonnen-/Materialprofile, exakt vorgegebene Szenariozeiten, normale Spielgeschwindigkeit und identische Auflösung. Einzelbilder plus kurzer Clip für Bewegung, Verdeckung, Regenabschattung und Ghosting. Nicht per geschönter Orbitkamera das Spielerproblem umgehen. Menschliche Bewertung bleibt separat.

**Auswahlbenchmark:** produktionsoptimierter Lab-Build, eigene Origin/Profile, keine gleichzeitige Videoaufnahme/DevTools-Profilierung, keine automatische Fidelity-Anpassung. Ein anderes Gerät, anderer Browser, andere Auflösung oder andere Schattenqualität ist ein anderes Profil.

## 3. Vergleichsmethodik

Zuerst Kontrolle versus jeweils einen Kandidaten, nicht alle möglichen Renderer×Wind×Regen×Lichtkombinationen. Erst die überlebenden Einzeloptionen werden kombiniert.

Phase Q0: Capability-/Correctness-Smoke. Erforderliche Fähigkeiten fehlen → `UNSUPPORTED`; falsche Darstellung oder Sourcebindung → `FAIL`. Kein Benchmark einer unkorrekten Variante als Sieger.

Phase Q1: explorative Messung, drei frische Browsersitzungen. Pro Sitzung gepaarte AB- und BA-Blöcke auf denselben Fixtures und der exakt gleichen 30-Sekunden-Route, zuvor je 10 Sekunden Warmup. Predeclare Reihenfolge, Varianten, Auflösung (1280×720 und 1920×1080 jeweils DPR1), Kamera, Seed, Bewegung und Wetter. Die Zeitangaben sind Messfenster, keine Lieferzeitversprechen.

Phase Q2: Bestätigungsserie für ausgewählte Kandidaten. Kalte Starts: zehn neue Dokumente je Variante und Sitzung, getrennt von drei echten Prozessstarts. Dokumentkalt, Prozesskalt und Treibercachekalt nicht gleichsetzen. Änderungen durch echte Source-Snapshotwechsel: gleiche zwanzig Übergänge je Variante/Sitzung. Keine manuelle Auswahl nur guter Frames. Alle geplanten Fehler/Abbrüche bleiben im Nenner und in Rohdaten.

Frames innerhalb einer Sitzung sind abhängig. Berichte p50/p95/p99/max pro Sitzung und gepaarte Sitzungs-/Blockunterschiede; ein Bootstrap resampelt Sitzungs-/Blöcke, nicht einzelne korrelierte Frames. Drei Sitzungen sind eine schmale Evidenzbasis, kein allgemeines Hardwaregesetz. Werte verschiedener Geräte oder Qualitätsprofile werden nie unbemerkt gepoolt.

Als vorab deklarierter Materialitätsvorschlag gilt: unter etwa 5 % gepaartem Unterschied ohne zusätzliche messbare Entlastung bevorzugt man die einfachere Variante. Ein Enginewechsel braucht zusätzlich belegten Funktions-/Qualitätsvorteil oder grob mindestens 15 % Entlastung im tatsächlich limitierenden Bereich ohne relevante Regression der anderen Bereiche. Diese Auswahlheuristik ist keine absolute Produktregel und kein Beweis globaler Optimalität. Ein GPU-Vorteil bei gleichzeitig höherem Input-Hold ist kein akzeptabler Gesamtsieg.

## 4. Pflichtmessgrößen

- Reale Backend-/Geräteidentität, Browserexecutable/-version, Treiber soweit verfügbar, Stromversorgung/-profil, thermische und konkurrierende Lastzustände.
- Build-/Lock-/Source-/Fixture-/Szenario-/Shader-/Preset-Digests und tatsächliche Renderauflösung/DPR.
- Mainthread-/Workerphasen, zusammenhängende Slices, Timerlücken, rAF-Framezeiten und Fehler.
- GPU-Dauer über vorhandene asynchrone Timermechanismen, andernfalls `UNSUPPORTED`. Disjoint/ungültige Queries verwerfen und mitzählen. Synchrones Readback/Warten separat messen, nicht im normalen Renderloop verstecken.
- Draws/Passes, Dreiecke beziehungsweise Ray-/Voxelarbeit, sichtbare und resident gehaltene Instanzen, Uploadbytes je Frame/Sourcewechsel, Texture-/Bufferallokationen nach Format/Größe/MSAA.
- Startup/Shadercompile, lokale Sourceänderung bis erste zugehörige Submission, stabile Steady-Statekosten, 20 Mount/Dispose- und 100 Source-/Presetwechsel.
- Modellierte Kosten, JS-Heapdiagnose und echte GPU/native Messungen getrennt. Unbekannter Cleanup oder Native-/Treiberanteil ist keine Null.

Im Lab gibt es keinen neu ausgeführten nativen Cut. Ein Ergebnis heißt deshalb `SourceSnapshot→RenderSubmission`, nicht `Input→Applied` oder echter Physik-Hold. Die HVP-Gates gehören weiterhin A0/P06 und werden erst am später integrierten Produkt geprüft.

## 5. Korrektheits-/Robustheitsmatrix

Für jeden Effekt: aus, an, Grenzwerte, Pause/Seek/Reset, Kamerasprung, Originshift, fehlende Capability, stale/late Quelle, fehlende Coverage, Resize/DPR, Dispose während Aufbau, wiederholtes Mounten.

Zusätzlich Wind/Foliage: unveränderte Holzzellen, Mass-/Owner-/Supportbindung, nicht deformierte Kollisionsquelle, entfernte Dekorteile bleiben in jedem Animationsframe/LOD entfernt, korrekt mitbewegte Schatten und konservative dynamische Bounds. Keine Neuverteilung der Seed-/Phasenidentität durch Kamerabewegung oder GPU-Instanzkompaktierung.

Zusätzlich Wetter: trockenes Dachinnere, doppelte Dachhöhe, Höhlenöffnung, schräger Regen, Offscreen-Abschattung, Dachloch nach Revision, bewegter geschützter Körper und zuvor nasse gedrehte Oberfläche. Neue freigelegte Fläche bekommt definierte Vorgeschichte, nicht zufällig den alten Texelwert. Exposition/Feuchte dürfen keine Kollision oder Reibung ändern, solange diese nur kosmetisch erforscht werden.

Zusätzlich Renderer/Kamera: Tiefe und Schatten passen zur sichtbaren Geometrie, Low-Poly-/SDF-Glättung kein stiller Ersatz, Ausblendung ist keine zerstörte/gezielt durchschießbare Wand. CPU-Picking auf kanonischen Daten darf durch Camera-cutout nicht verändert werden. Neue Öffnung verwirft unpassende zeitliche Beleuchtungshistorie.

Zusätzlich Tools: Preset Export→Import→Export stabil; ungültiger/übergroßer Input erzeugt null Änderung; keine beliebigen Scripts/URL-Lader; Cancel/Undo wirkt nur auf Labor-Draft. Tastatur, fokussierte Inputs, Escape und Narrow-Viewport funktionieren.

## 6. Ergebnislabels und Abschluss

`IMPLEMENTED`, `TESTED_LOCAL`, `BROWSER_VERIFIED`, `MEASURED_PROFILE`, `VISUAL_OWNER_ACCEPTED`, `ADOPT_CANDIDATE`, `DEFER`, `REJECT`, `UNSUPPORTED`, `NOT_RUN` werden einzeln vergeben. Kein zusammenfassendes Grün darf offene Dimensionen verstecken.

`ADOPT_CANDIDATE` erfordert sinnvollen Nutzen, korrekte Lebenszyklen, geklärte Herkunft, vertretbare Gesamtbudgets und eine konkrete Integrationsnaht. Menschlich unbewertete Bilder bleiben `VISUAL_OWNER_PENDING`. Ein Testdouble ist keine echte World und ein Video kein Speicherbeweis.

`ADOPTION_QUEUE.md` enthält je Kandidat: Nutzerwirkung, konkrete RD-Commit-/Modulreferenz, vorhandene und fehlende Nachweise, kleinste Produkt-Zieldateien nach erneuter Quellprüfung, benötigte Schema-/Shader-/Save-Migrationen, Konflikt mit A0/P01–P06, Rollback, erwartete Gesamtkosten und notwendiger Review. **Nur A0 nach separater Freigabe integriert.** Keine heimliche Kopie aus dem Lab direkt nach main.

## 7. Nicht warten bis alles perfekt ist

Sobald ein geprüftes kleines Tool oder ein konkreter Kandidat vorliegt, liefere seinen Startbefehl und sein Preview. RD-33 Schnee und die optionale zweite Raymarch-Beschleunigung dürfen einen nützlichen Wind-/Regenslice nicht blockieren. Maximal eine hypothesengeleitete Nachbesserungsrunde pro unterlegenem Kandidaten; danach Ergebnis und nächste echte Entscheidung statt Endlosschleife.
