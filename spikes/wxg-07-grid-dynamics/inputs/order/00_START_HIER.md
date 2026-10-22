# Hestia: Cloud-first-Spikes und gezieltes Programm-Amendment
Stand 2026-10-09. Planungs-/Prüfpaket, keine hier ausgeführten Produktimplementierungen oder Spielbenchmarks.

## Sofortentscheidung

Nicht das ganze Drei-Phasen-Programm abbrechen. A0 beendet zuerst eigene laufende Native-Operationen sicher, sichert WIP und schließt die beiden bekannten Cleanup-/Coexistence-Nachweise. Danach solverneutrale Arbeit fortsetzen, aber Solver-/Colliderentscheidung **vor** weiterer darstellungsabhängiger Collisionoptimierung, S1/S2-Persistenzschnitt und großer Abschlussqualifikation treffen. M5 wird damit in seiner Entscheidungsfunktion vorgezogen, nicht aus dem Gesamtauftrag gelöscht.

Neue Arbeit wird überwiegend in einzeln gestarteten Codex-Cloud-Tasks implementiert. Kein neuer Haupt-/Unterorchestratorbaum. Lokal bleibt A0 der einzige Integrator und ein serieller Runner übernimmt Hardwareprüfungen.

## Benutzung

1. A0 erhält `A0/00_AENDERUNGSAUFTRAG.md` samt `A0/01_GOAL.txt`. Der Änderungsauftrag wird durch explizite Übergabe als neuer Auftrag übernommen; dieses Archiv hat hier keine Session pausiert und kein Repository verändert.
2. Für jeden gewünschten Cloud-Task eine frische Aufgabe am festen Quellstand `17b1db4201a28e7b607c30707bdc2b75e3484a10` verwenden. `Cloud/00_GEMEINSAMER_VERTRAG.md` und genau eine Datei aus `Auftraege/` bilden den Auftrag. Die zugehörigen Originalquellen und eingefrorenen Vorgängerlieferungen müssen in dieser Umgebung lesbar sein.
3. Cloud-Vorbereitung nach `Cloud/01_UMGEBUNG_UND_UEBERGABE.md`. Volltext-Goals stehen in `Goals/`; sie sind normale Auftragsziele, kein Versprechen, dass die Cloudoberfläche `/goal` als CLI-Befehl versteht.
4. Ergebnisse mit Source-/Dependencybindung nach `Lokal/00_REFERENZ_RUNNER.md` übernehmen. Ein Cloud-Task wartet nicht endlos auf den Laptop: Code, lokale Run-Kommandos, Resttests und Status abliefern.
5. Erst A0 entscheidet anhand der Übergabegates über den Produkt-Cutover. Keine Spike-Session schreibt in A0s Worktree.

## Empfohlener Start

Parallel zuerst PHY-01, PHY-02 (Primitive/Geometrie-Teil), GFX-01-02, PLT-01-02 und RT-01. Das sind fünf getrennte Cloud-Tasks. CEL-01-WXG-00 kann nach dem numerischen Vertragsentwurf hinzukommen. Die weiteren Karten sind vollständig beschrieben, starten aber erst mit ihren benötigten Eingaben. Die Zahl fünf ist eine Koordinationsempfehlung, kein ermitteltes Konto-/Quota-Limit.

## Leitdokumente

- [Prüfung und Neupriorisierung](01_PRUEFUNG_UND_ENTSCHEIDUNG.md)
- [A0-Amendment](A0/00_AENDERUNGSAUFTRAG.md)
- [Cloud-/Lokal-Matrix und Reihenfolge](02_CLOUD_LOKAL_UND_WELLEN.md)
- [Gemeinsame Integrationsnähte](03_SCHNITTSTELLEN_UND_UEBERNAHME.md)
- [Abdeckung der neuen Registry und der alten Phasen](04_ABDECKUNG_UND_SUPERSESSION.md)
- [Quellen und Verifikationsgrenzen](05_QUELLEN_UND_PRUEFGRENZEN.md)
- `TASKS.json`: taskbezogene Schreibgrenzen, Voraussetzungen und Zuordnung.

Die sechs Originalkonzepte und drei relevante Vorarbeiten sind unverändert beigefügt. Maßgeblich bleibt: beobachteter Code ist Ist-Stand, Konzept ist Vorschlag, dieses Amendment ist eine ausdrücklich zu übernehmende neue Reihenfolge. Ältere Rohfehler und abgelehnte Kandidaten bleiben erhalten.
