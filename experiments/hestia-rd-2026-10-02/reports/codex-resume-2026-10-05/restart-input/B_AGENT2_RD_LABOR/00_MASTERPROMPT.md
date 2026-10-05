# B / Agent 2: vorhandenes Hestia-R&D-Labor fertigstellen

Du bist ein neuer implementierungsfähiger Codex-Owner. Du führst das bereits teilweise implementierte Programm fort, statt weitere Unterorchestratoren zu planen. Die fachlichen SO-01–SO-06-Grenzen bleiben Lesestruktur, aber werden nicht wieder als rekursive Paseo-Agentenpyramide gestartet.

## Anker und Isolation

Repo `BenjaminHornung/Weltraum-Spiel`. Veröffentlichtes Labor `16a5d29a5cddea372abae139da618aa000a058be` auf `feature/hestia-rd-2026-10-02`. Neuer Resume-Branch `codex/resume-hestia-rd-2026-10-05`.

**Labor-Resume-SHA und Produkt-Read-SHA sind verschieden.** Produktfixtures bleiben auf `b3c6523a94cd050f5a9a22dc27f4777fcc03363e` gebunden. Kein stilles Reexportieren gegen den neuen Cut-Head. Kein Produktcode, kein Save und keine A0-Datei ändern.

Einziger getrackter Schreibroot: `experiments/hestia-rd-2026-10-02/**`. Rohdaten in separatem zugelassenem Evidencebereich, niemals echte Spielstände. Root-Dependencies/Gitattributes/Pluginsettings read-only. Bestehende Guard-/Shared-Contract-Regeln bleiben, außer explizit dokumentierter neuer Ausführungsorganisation und REN12-Nachprüfung.

## Lesen

[BETRIEB.md](BETRIEB.md), [01_RESTPLAN.md](01_RESTPLAN.md), [02_ORACLE_KORREKTUR.md](02_ORACLE_KORREKTUR.md), [03_ABSCHLUSS.md](03_ABSCHLUSS.md).
Das vollständige ursprüngliche 25-Karten-Paket liegt in [ORIGINAL_RD/README.md](ORIGINAL_RD/README.md), inklusive 23 Kernkarten, 2 optionaler Karten, Mess-/Fixtureverträgen und ursprünglichem Konzeptkontext.

Im Checkpoint zusätzlich aktuelle `reports/RD-*/`-Phasenberichte, `docs/coordination/`, Source, Tests, Registrierung und Buildkonfiguration lesen. `HEAD-HANDOFF.md` und das ursprüngliche `RUN.json` enthalten auch frühe historische Zustände; nicht als neuesten Gesamtstatus auslegen. Die PHASE2-/Repairberichte und tatsächliche Gitbindung entscheiden.

## Ausgangsstand

Neun Kernkarten haben laut aktueller Übergabe Implementierungen: RD00–03, RD10–13, RD40. Mehrere sind nur teilweise qualifiziert. Vierzehn weitere Kernkarten sind noch umzusetzen: RD14, RD15, RD20, RD21, RD23, RD30, RD31, RD32, RD41, RD42, RD43, RD50, RD51, RD52.

RD11 original 8/9 ist FAIL der negativen Bildempfindlichkeit. Zusätzliche 2/2-F01-Fälle machen daraus keinen 10/11-PASS. RD12 12/16 ergänzende Nativeprüfungen sind Teilerfolg, native Buffer/Depth weiter unbewiesen. RD13 39/39 CPU und Build sind kein Native-PASS. RD13 kann lokal noch unveröffentlichtes Fortschrittsmaterial besitzen: zuerst sichern, prüfen, übernehmen, nicht neu beginnen.

## Priorität

Nicht erst jeden Renderer vollständig polieren. Erhalte die Implementierungen, repariere die konkrete Bildprüfung und vervollständige die gekoppelte Wind/Regen/Attachment-Strecke **zuerst am vorhandenen Three/WebGL-Kontrollpfad**. Beende anschließend die verbleibenden Vergleichs-/Werkzeug-/Gesamtprüfungen. Kein Rendererwechsel im Spiel wird durch diesen Auftrag freigegeben.

Die verpflichtenden Originalfälle und Werkzeuge bleiben erhalten. Ein schlecht geeigneter Babylon-/WebGPU-/Ray-Kandidat darf mit belastbarer REJECT/DEFER-Empfehlung enden. Fehlende Wind-/Regen-/Werkzeugimplementierungen sind kein valides Forschungsergebnis.

## Neue ausdrückliche Korrekturbefugnis

Der Hauptowner darf die nachgewiesene REN12-Oraclegeneration und ihre Test-/ROI-/Capturedateien im Labor mit einem begründeten, versionierten Nachfolgeorakel korrigieren. Originale Belege/Schwellen/negative Bilder unverändert archivieren. Keine Grenzwertanhebung, um das fehlerhafte Bild schönzurechnen. Details in 02_ORACLE_KORREKTUR. Diese enge Ergänzung beendet die bisherige Sackgasse „bekannt falsches Orakel, aber niemand darf es ändern“.

Der Hauptowner besitzt geteilte Laborregistrierung, Contracts und Konfiguration. Eng erforderliche Änderungen darf er selbst implementieren, nach source-bound Tests und unabhängiger Prüfung an den relevanten Grenzen. Keine neue Frameworkabstraktion.

## Fertig

Alle 23 Kernkarten haben echte überprüfte Endergebnisse; ein gemeinsamer startbarer Labflow zeigt Wind, Regenabschattung, Nässe, Material/Licht, Verdeckung und korrekt gebundene Dekoration über Source-/Owner-/LOD-Wechsel. Eine Galerie plus drei getrennte Viewports ersetzt das nicht. Werkbank, Wetter-Tuner und Assetinspektor sind benutzbar und verwenden dieselben Module wie die Experimente.

Reproduzierbares finales Plannerpaket mit Runs, Quellen, Rohdaten, Screenshots/Clips, Known Limitations, Mess-/Übernahmematrix und kleinstmöglichen späteren Produktübernahmekarten. `PRODUCT_INTEGRATED=false`; Art-Freigabe menschlich. RD22/RD33 bleiben ausdrücklich optional.

Beginne mit B00, dann arbeite die freien Aufgaben nach dem bestehenden Abhängigkeitsgraphen ab. Kein Abschluss bei „nächster Agent wurde gestartet“.
