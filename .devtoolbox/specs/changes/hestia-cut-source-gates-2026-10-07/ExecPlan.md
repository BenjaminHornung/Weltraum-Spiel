# ExecPlan: Hestia Cut Source Gates A/B/C

## Ziel
Den eingefügten Nutzerauftrag vom 2026-10-07 als drei endliche Experimente ausführen. Jedes Gate endet mit behalten, verwerfen oder einem konkreten externen Blocker. Ein Pilot ist keine A-CUT-V3-Abnahme.

## Kontext
Isolierter Worktree, Branch feature/hestia-cut-core-experiments-2026-10-07, Checkpoint aa2eabd918e03c475a489b412cd18e05f781a0f9. Die versiegelte Vorgänger-Spec und ihr ZIP bleiben unverändert. Das ursprüngliche Goal ist vom Nutzer pausiert.

## Nicht-Ziele
Kein Engine-/Renderer-Neubau, keine Produktübernahme, kein Save-Schemawechsel, keine neue Dependency. Keine 42/1400-Serie ohne aussichtsreichen vollständigen Kandidaten. Keine automatische Commit-/Push-Aktion.

## Architekturentscheidung
Physics Worker bleibt Native- und Moving-Source-Owner. Renderer projiziert. Öffentliches Import/Load/Persistence validiert unverändert. Wiederverwendung benötigt echte Issuance und vollständig unveränderliche Source-Daten; zugängliche mutable TypedArrays und shallow freeze genügen nicht. Entfernte Durchläufe, Besitznachweis und erhaltene Identitäten stehen in design-moving-owned.md; REVIEW.md dokumentiert die finale private ownedGraphs-Zulassung.

## Implementierungsphasen
1. A: bestehenden Probe mit tatsächlichem Vite-Produktionsbundle bedienen, unveränderten Reference-/Direct-Pfad vergleichen. Poolstart separat; Owner-Steps und explizite Task-Wartezeit getrennt. Zehn Vergleichspaare mit wechselnder Reihenfolge. First Terrain ist cold; Moving folgt mit bereits laufendem Pool. Profile separat; unbeobachtete GC bleibt unbestimmt.
2. B: ein Moving-Owner-Kandidat entfernt allgemeine Source-Rekonstruktion/Metadatenprüfung/rekursives Freezen bekannter Daten. Reale Cuts, native Installation, Render-Submission, nächster Recut, Save/ColdLoad und Fehler/Lifecycle prüfen. Gleiche gebaute Arbeitslast gegen A; endliche zehn Paare.
3. C: nur bei aussichtsreichem B den Terrain-Support an persistente Owner-Daten anschließen und Live-Persistence-Rundreise entfernen. Erste und wiederholte Cuts aus derselben Source prüfen; Simulation weiter bedienen. Private Render-Admission bleibt eine eigene spätere Variante.

## Tests und Evidence
Bestehende Vitest-/Playwright-Probes, gepinnte Node22/Chromium151, 1280x720, DPR1, AC und exklusives Gerätefenster. Source-/Build-Dateihashes vor/nach jedem Lauf, alle Fehlversuche behalten, eindeutige Outputs. Programme nur unter C:\IFI_SourceCode. Native-, Source-, Massen-, Collider-, Save-/Lifecycle-Evidence und Cut-Messungen getrennt.

## Risiken
Private Issuance darf keine externen Inputs aufnehmen; keine veränderbaren Aliasse. Hashes und gespeicherte Identitäten bleiben kanonisch. Quelle/Build bleibt im Messfenster fest. Sampling ist keine exakte CPU-Uhr.

## Rollback / Safe Stop
Sessiongebundene experimentelle Auswahl; Standard bleibt Reference. Kein destruktives Git. Ein negativer Befund verwirft genau den Kandidaten und erfüllt nicht das alte Goal. Externe Blocker mit Stand und exakt notwendiger Entscheidung sichern.

## Fortschrittslog
- [x] Nutzerauftrag und externe Prüfung gelesen; Checkpoint/Branch und pausiertes Goal geprüft.
- [x] Gate A gemessen und entschieden: 20 gebaute Vergleichssequenzen; historische 741 ms nicht reproduziert/kausal erklärt.
- [x] Gate B implementiert, funktional geprüft, gemessen und entschieden: Moving-Median 222.25 ms, p95 233.90 ms; experimentell behalten.
- [x] Gate C ausgeführt und entschieden: cold 457.05 ms/p95 628 ms, warm 154.40 ms/p95 185.10 ms; Source behalten, vollständige 250-ms-Übernahme verworfen.
- [x] Nachprüfbares Paket und endliche Entscheidung geliefert: 3100 Payload-Dateien geprüft, falscher Manifestanker abgewiesen; PACKAGE-CHECK.json und FINAL-CLOSURE.json neben dem unveränderten ZIP. Dieser Checkbox-Abschluss erfolgte nach der Archivversiegelung.

## Definition of Done
Frische Evidence für ausgeführte Gates, entfernte Arbeit und Tradeoffs, gebundene Rohdaten und überprüftes Paket. B1/B2/B3/P01-P06 bleiben offen, solange die ursprünglichen Abnahmegates fehlen.
