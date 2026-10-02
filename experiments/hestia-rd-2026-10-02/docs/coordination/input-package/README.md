# Hestia: Living-World-R&D und Tooling

**Stand:** 02.10.2026. **Lieferumfang dieses Archivs:** recherchierter Ausführungsplan, Orchestratorprompts, 25 Arbeitskarten, Quellenregister und unveränderte ausgewählte Kontextquellen. Es enthält noch keinen implementierten Laborrenderer, Wettereffekt oder Benchmarknachweis.

## Start

Das ganze Archiv in einen nur diesem Forschungsprogramm gehörenden Arbeitsbereich entpacken. Einer frischen, implementierungsfähigen Agentensession `00_START_HAUPTORCHESTRATOR.md` als Auftrag geben. Der Hauptorchestrator verteilt die sechs fachlichen Stränge und die einzelnen Implementierungen. Die Unteraufträge nicht zusätzlich unabhängig mit umfassenden Schreibrechten starten.

Dieses Programm heißt **RD**. Es ersetzt weder den laufenden Cut-RT-V3-Auftrag noch das bestehende P01–P06-Paket. Es schreibt keine bestehende Produktdatei. Es liefert eine separat startbare Laboranwendung, schmale Entwicklerwerkzeuge, vergleichbare Experimente und später übernehmbare Kandidaten.

## Lesereihenfolge

1. [Hauptauftrag](00_START_HAUPTORCHESTRATOR.md)
2. [Ziel, Entscheidungen und Isolation](01_PROGRAMM_UND_ISOLATION.md)
3. [Quellen, Reddit und Aussagegrenzen](02_QUELLEN_UND_REDDIT.md)
4. [Kleine Laborverträge und Fixtures](03_LAB_VERTRAEGE_UND_FIXTURES.md)
5. [Messung, Abnahme und Übernahme](04_MESSUNG_UND_ENTSCHEIDUNG.md)
6. [Ausführungs-DAG](05_TASKBOARD.json), danach der zugeteilte Unterauftrag in `orchestrators/` und die Arbeitskarte in `tasks/`.

## Erwartetes nutzbares Ergebnis

Eine lokale Browser-Galerie, in der derselbe Hestia-Ausschnitt und kleine Gegenbeispiele mit unterschiedlichen Renderern, Wind-, Foliage-, Regen-, Nässe- und Kameraoptionen laufen. Dazu kommen ein Foliage-/Habitat-Presetworkbench, ein Wetter-/Szenario-Scrubber und ein Asset-/Attachment-Inspector. Jede Empfehlung bindet lauffähigen Code, Eingaben, Bilder beziehungsweise Clips und Messbedingungen. Ein Ergebnis darf ausdrücklich lauten: aktuelle Lösung behalten.

## Grenzen

Kein Enginewechsel im Spiel, keine Produktintegration, kein öffentlicher Upload, keine automatische Art-Abnahme. Alle numerischen neuen Laborbudgets sind Planungsvorgaben, keine bereits erreichten Werte. Geerbte HVP-Grenzen werden nicht gelockert. Reddit-Videos wurden in dieser Planungsrunde nicht zuverlässig abgespielt; entsprechende Mediennachweise sind Arbeit für RD-01.
