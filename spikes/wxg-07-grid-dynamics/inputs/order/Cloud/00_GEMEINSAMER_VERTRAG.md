# Gemeinsamer Vertrag für einzelne Codex-Cloud-Spikes

## Arbeitsweise

Du bist **ein Implementierer für genau die übergebene Karte**, kein Orchestrator. Implementiere die beschriebenen Versuche und Tests; nur ein Bericht reicht nicht. Kein Spawn von Paseo-Unteragenten. Ein direkter lesender Review ist erlaubt, wenn verfügbar; keine simulierte Unabhängigkeit.

Feste Produkt-Lesebasis: `17b1db4201a28e7b607c30707bdc2b75e3484a10` in `BenjaminHornung/Weltraum-Spiel`. Lies `AGENTS.md` und relevante Repoverträge. Verifiziere SHA, gewählten Workspace und sauberen Anfangszustand. Falls ein anderer bereitgestellter Task-Branch schon eigene Arbeit enthält, sichere und identifiziere sie; nicht resetten oder fremden Branch löschen. Nicht still von aktuellem main statt diesem Featurecheckpoint arbeiten.

Die sechs Konzeptquellen sind Input. `REG` liefert ihre Korrekturen; `01_PRUEFUNG_UND_ENTSCHEIDUNG.md` dieses Pakets ergänzt die ausdrücklich benannten Konflikte und die neue Reihenfolge. Frühere R&D-Implementierungen zuerst lesen und wiederverwenden, wenn fachlich passend. Ein älterer Screenshot oder Plan ist keine neue Implementierung.

## Explizite Cloud-Scope-Ausnahme

Die alten lokalen Windows-Pfade gelten für lokale Ausführung. Dieser zugewiesene Spike darf im vom Codex-Cloud-Task bereitgestellten Linux-/Cloud-Workspace ausgeführt werden. Das ist keine Erlaubnis zum Zugriff auf den Laptop, private C:-Dateien oder andere Repositories.

Du schreibst nur die in deiner Karte genannten neuen Spikepfade und den eigenen `.devtoolbox/specs/changes/<id>-2026-10-09/`-Ordner. Produktcode und Produkt-Package/Lockfile bleiben read-only. Keine Änderung am A0-Branch, an `main` oder globaler Agentenkonfiguration. Ein benötigter geänderter Produktadapter wird zunächst in einer gebundenen eigenen Snapshotkopie oder als Patchkandidat im eigenen Spike implementiert. Kopier-/Importmanifest nennt Original-SHA und jeden geänderten Port. Unveränderte Kontrollquellen werden nicht durch stubs ersetzt.

Abhängigkeiten dürfen im **eigenen Spikepaket** technisch begründet gepinnt und installiert werden. Vor dem ersten neuen Testlauf Paketversion, Registryintegrität, Lizenz und tatsächliche Exporte prüfen. Nicht produktive node_modules umstellen. Lockdateien der Spikes sind kein späteres Produkt-Upgrade.

## Minimaler Ablauf

1. Basis, ältere Resultate, konkreten Scope und eine Hypothese erfassen. Maximal eine Kontrolle und zwei sachlich begründete Alternativen je Unterfrage. Keine allgemeine Frameworkentwicklung.
2. Bestehenden Kontrollfall ausführen. Neue Regression/Oracle zuerst fehlend oder fehlschlagend nachweisen, dann minimal implementieren.
3. Echte Parser-/WASM-/Worker-/Browserausführung benutzen, soweit die Frage das verlangt. Mocks nur als klar bezeichnete zusätzliche Unittests.
4. Test-/Build-/Fixturecode einfrieren; Ergebnisse an SHA bzw. vollständigen Dirty-Tree-Digest, Lock-, WASM-/Shader- und Inputdigests binden.
5. Relevante negative Fälle ausführen, Diff-Scope prüfen, Review und fachliche Entscheidung schreiben.
6. `HANDOFF.md`, maschinenlesbares Receipt und exakte Repro-Kommandos für einen lokalen Runner liefern. Kein wartender endloser Untertask für nicht verfügbare Hardware.

## Ergebnisstatus in getrennten Feldern

- Implementierung: COMPLETE / PARTIAL / BLOCKED.
- Code-/Oracleverifikation: PASS / FAIL / NOT_RUN / UNSUPPORTED.
- Umgebungsnachweis: CLOUD_FUNCTIONAL, CLOUD_DIAGNOSTIC, REFERENCE_DEVICE, CROSS_DEVICE.
- Empfehlung: CANDIDATE / NO_ADOPTION / REQUIRES_DECISION.
- Produktintegration: immer NO für einen Cloud-Spike.

`CLOUD_READY_LOCAL_PENDING` ist ein legitimer Handoff nach vollständig ausgeführten Cloudpflichten, kein Produkt-PASS. Ein wegen fehlender GPU abgebrochener Codebuild ist dagegen nicht COMPLETE. Schließe alle unabhängig ausführbaren Teile ab und benenne die exakte fehlende Prüfung.

## Beweise und Messung

Keine ms-/FPS-Ziele des HVP-Referenzlaptops in einer beliebigen Cloud-VM als Abnahme verwenden. CPU-/WASMzeiten dort sind ebenfalls nur Diagnose. Headless oder Software-GPU kann Funktionen nachweisen, aber keine Arc-/Radeon-/NVIDIA-Performance.

Actual backend/adapter, Browser-Binärversion, Node/Rust/Toolchain, Auflösung/DPR, Fixture, Queryparameter, Count und Runreihenfolge erfassen. Keine leeren oder nullartigen Sensoren als 0 ausgeben. Keine `--single-process`-Browserläufe als normalen Multiprozess-Pfad qualifizieren. Produktionsbytes via preview für Browser-Pilots, nie Vite-dev als Produktbenchmark etikettieren.

Bei Fallback/Unavailable endet der betreffende Nachweis explizit; ein WebGL-Fallback ist kein WebGPU-Compute-PASS. Use-time bytebindings und richtige Material-/Sourcecoverage zählen ebenso wie Importerfolg.

## Git / Sicherheit

Scope gegen den festen Start-SHA und aktuelle Arbeit prüfen, inklusive staged/unstaged/untracked; Git-/Parserfehler fail-closed. Keine vorhandenen Rohfehler überschreiben. Keine Tokens, Commandline-Secrets, private Pfade/Umgebungsdumps oder automatische Desktoplogs veröffentlichen.

Kein Main-Merge, kein Force-Push. Liefere Taskdiff oder Commit-/Patchartefakt. Bestehende echte Commit-/Plannotator-/Publikationsfreigaben nicht fingieren. Ist lokale Reviewoberfläche in Cloud nicht verfügbar, einen exakten reviewbaren Diff plus Gründe exportieren; kein künstlicher PASS und kein endloses Warten. Die Produktübernahme macht ausschließlich A0 nach dem Entscheidungs-Gate.

## Pflichtdateien im Spike

`README.md` (Hypothese, Versionen, Start), tatsächlich ausführbarer Code und fokussierte Tests, `REPORT.md` (Ergebnis samt Einschränkungen), `HANDOFF.md` (Einstieg und Restnachweise), `receipt.json`, ein kleines Reproskript. Größere Dumps nur soweit für Reproduktion nötig; keine zweite 100-MB-Kopie jeder Suite. Historische Artefakte per Digest referenzieren, fehlende Bytes als fehlend markieren.
