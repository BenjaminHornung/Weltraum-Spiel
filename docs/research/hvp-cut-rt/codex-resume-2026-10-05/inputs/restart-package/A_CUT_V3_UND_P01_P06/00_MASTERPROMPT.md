# A: Cut RT V3 und P01–P06 vollständig weiterführen

## Auftrag und Rolle

Du bist der neue Codex-Implementierungsowner für den ursprünglichen Cut-RT-V3-Auftrag einschließlich der verbliebenen P01–P06-Arbeit. Der bisherige A0 und der bisherige „Agent 1“ haben denselben WIP-Checkpoint geliefert. Starte **keine zwei konkurrierenden Integratoren**. Übernimm A0s Implementierungsrolle selbst; der frühere Agent-1-Anteil wird als Fortschritts-/Reviewabdeckung in diesem Auftrag erhalten. Ein separater Agent 1 darf nur nach Paket Q lesen/reviewen.

Das Ergebnis ist das fertige, nachgewiesene V3-Feature mit realer Body- und Terrainzerstörung, Zellzugriff, Save/ColdLoad/Recut, Lifecycle, unveränderten Ressourcen-/Zeitgrenzen und abschließendem Planner-Review-Paket. Nicht bloß neue Foundation-Generatoren, weitere Teil-Handoffs oder laufende Tests liefern.

## Verifizierter Anker

Repository `BenjaminHornung/Weltraum-Spiel`.
Featurebranch `feature/hvp-cut-rt-v3-completion-2026-09-23`.
Geprüfter Checkpoint `0bfd1e67117d0dd6184e592e9a2a1b8b9f58241a`.
Parent dieses 57-Dateien-WIP: `85c2c4c338718c76f51bff175bae09674aceae9a`.
Neuer Arbeitsbranch `codex/resume-hvp-cut-v3-2026-10-05` direkt vom Checkpoint. Main `25bc7f5bbd2db6317c42193873eadeaf10a092c5` ist NICHT die richtige Resume-Basis.

## Zuerst vollständig lesen

1. [BETRIEB.md](BETRIEB.md), [01_RESTPLAN.md](01_RESTPLAN.md), [02_ABNAHME_UND_SCOPE.md](02_ABNAHME_UND_SCOPE.md), [03_P01_P06_ABDECKUNG.md](03_P01_P06_ABDECKUNG.md).
2. Im exakten Checkpoint `docs/research/hvp-cut-rt/V3-AUTONOMOUS-COMPLETION-20261003-EXECPLAN.md`, insbesondere den neuesten Fortschritt und Definition of Done, nicht nur frühe PASS-Zeilen.
3. `.agent/PLANS.md`, `AGENTS.md`, die tatsächlich vorhandenen P00–P07-/V3-Dokumente unter `docs/research/hvp-cut-rt/` und `docs/research/hvp-parallel-2026-10-02/`.
4. Die unveränderten ursprünglichen P01–P06-Prompts unter [ORIGINAL_P01_P06/README_PARALLELPLAN.md](ORIGINAL_P01_P06/README_PARALLELPLAN.md). Ihre alte Startbasis/Orchestratorstruktur wird durch diesen Wiederanlauf ersetzt; fachliche Tests und Nichtziele bleiben.
5. Den Originalauftrag `HESTIA_V3_GESAMTAUFTRAG_2026-09-23_1_.md` sowie `A0-B1-INTEGRATION-NEXT-PLAN-20261003-01.md` aus dem lokal vorhandenen ursprünglichen Input-/Evidencebereich auffinden und direkt lesen. Diese beiden Originalbytes waren in der Web-Prüfung nicht verfügbar; das wird in [04_QUELLENLUECKEN.md](04_QUELLENLUECKEN.md) ausdrücklich dokumentiert. Nicht 1188 vermeintliche Originalzeilen rekonstruieren.

Die hier aufgeführten Restschritte und Grenzen sind ausführbar. Eine fehlende Originalquelle blockiert nur davon abhängige ungeklärte Fachentscheidungen; sichere Recovery, aktuelle Fehlerreproduktion und Privacyprüfung dürfen weiterlaufen. Vollständigen Originalvertragsabschluss nur behaupten, wenn auch dessen Abdeckung tatsächlich geprüft wurde.

## Tatsächlicher Ausgangsstatus

Der Commit ist ausdrücklich INCOMPLETE. Neuere Structural/Terrain-Timeouts, unvollständige Owner65- und Reporter/Bootstrap-Läufe sowie unabhängiger Rebind sind offen. Teilstdout „51 Reporter-Tests“ ist kein Gesamt-PASS. Ein zusätzlicher CDP-Befund betrifft die vollständige Speicherung von `SystemInfo.getInfo`, einschließlich möglichem `commandLine`.

Vorbereitete Owner-/Mesh-/Adaptive-/Structural-Pfade sind nicht gleichbedeutend mit aktivierter End-to-End-Integration. P01/P03 teilweise übernommen; P02 erfolglosen Optimierungscode nicht wiederherstellen. TD-Referenz/Consumer existiert bereits. Aktuelle Quellen statt alter berichteter Zahlen prüfen.

## Vorgehen

Arbeite die Gates A00–A08 aus 01_RESTPLAN ab. Beginne mit Wiederherstellung und einer bounded unabhängigen Prüfung der tatsächlichen F1-/Runner-Korrekturen. Danach Privacy-Grenze und Ursache der aktuellen Tests klären. Nicht sofort die 1400er-Serie starten.

Du darfst innerhalb des ursprünglichen V3-Auftrags selbst implementieren und erforderliche direkte Reviewer frisch beauftragen. Alte Anweisungen „nur dieselbe gestörte Session“, „an Parent zurück und stoppen“ oder „nicht selbst implementieren“ sind für diese neue A0-Rolle ersetzt. Das erteilt keine Befugnis zum Ändern der fachlichen Grenzen.

## Unverrückbare Architektur

Genau ein nativer Rapier-World-Owner und genau ein tatsächlich zurückbehaltener Plan je Schnitt. Compiler erzeugt Meshes aus der gebundenen Child-Projektion, keinen zweiten fachlichen Schnittplan. Geometry-Admission wird gegen genau diesen Ownerplan bewiesen. Pose, Impuls und Drehimpuls erst an der richtigen nativen Stage binden. Stale Reply, Reset, Dispose, Restore und Incarnation müssen Ablehnung/Freigabe korrekt durchlaufen. Atomare Publikation und sticky RecoveryHold erhalten.

Rapier bleibt `0.12.0`. Kein Renderer-/Wetter-/Assetcompilerimport. Kein Saveformat-/öffentlicher Hashwechsel, kein gröberes Voxel-/Colliderprofil, keine abgesenkte Qualität, keine größeren Timeouts/Caps.

## Fertig bedeutet

B1 Body, B2 Terrain und B3 Zugriff produktiv verdrahtet und geprüft; P01–P06 jeweils ehrliches Endergebnis; nötige vollständige Tests/Builds und echte Spiel-/Recovery-/Lifecycleprüfungen bestanden; gültige 42 Qualifikationsversuche vor 1400 Messversuchen auf gebundenem Kandidaten; unabhängiger finaler Review; verifizierte sichere Screenshots/Rohdaten/Manifest und neuer dedizierter Git-Stand.

Zulässiges erfolgreiches Endlabel: `TECHNICAL_COMPLETE_OWNER_VISUAL_PENDING`. Menschliches ART-Urteil und Main-Merge bleiben Benni vorbehalten. Bei echter Blockade `BLOCKED` mit reproduzierbarem Hindernis und gesichertem Restplan, nicht künstlicher V3-PASS.

Beginne jetzt mit A00. Keine neue Architektur-Roadmap statt Ausführung.
