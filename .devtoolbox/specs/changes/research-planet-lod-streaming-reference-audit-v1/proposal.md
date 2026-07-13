# Proposal: Planet LOD Streaming Reference Audit v1

## Ziel

Aktuelle externe Planet-, Geospatial-, LOD-, Streaming- und Reference-Frame-Implementierungen werden an reproduzierbar gepinnten Commits untersucht. Das Ergebnis ist eine belastbare Architekturentscheidung für kontinuierliche Reise von lokaler Microvoxel-Oberfläche bis Orbit, Systemraum und einem anderen Planeten.

## Scope

- Research und Dokumentation ausschließlich in `docs/research/planet-lod-streaming-reference-audit-v1.md`.
- Audit der im Auftrag benannten Projekte, Cosmonium, offizieller Hello-Games-Vorträge und kleiner Three.js-Visual-References.
- Pro Quelle: URL, Commit/Datum/Ref, Lizenzpfad, Source-Pfade sowie Build-, Test-, Demo- und Browserstatus.
- Klassifikation jeder tragenden Aussage nach Evidenzart und Bewertung nach dem vorgegebenen Bewertungsmodell.

## Nicht-Ziele

- Keine Runtime-, Asset-, App-, Package-, CI-, Test- oder Roadmap-Änderung.
- Kein Engineport und keine Library-Integration.
- Keine externen Dateien oder Browser-Captures im Repository.

## Ergebnis

Ein priorisierter Architekturvorschlag mit Representation Ladder, Planet Shell, Surface Region, Streaming, Readiness, Culling, Frames, Near/Far-Strategie, Atmosphere/Cloud-Adapter, Adoption Matrix, drei Spikes und expliziter Trennung von visueller und simulativer Kontinuität.
