# Capability: Planet LOD Streaming Reference Audit

## Requirements

### Reproduzierbare externe Evidenz

Das Research-Dokument SHALL für jedes untersuchte externe Projekt kanonische URL, exakten Commit-SHA, Commit-Datum, Branch oder Tag, Lizenz und Lizenzpfad, untersuchte Source-Pfade, Buildstatus, Teststatus, Demostatus, Browserstatus und bekannte Einschränkungen nennen.

### Evidenzklassifikation

Tragende Aussagen SHALL als README Claim, Code Evidence, Test Evidence, Benchmark Evidence, Observed Demo Evidence oder Inference klassifiziert werden. Marketingbegriffe SHALL ohne passende Evidenz nicht als erwiesene Eigenschaften erscheinen.

### Pflichtaudits

Das Dokument SHALL die verlangten Detailpunkte für 3DTilesRendererJS, Cesium, OpenSpace, neural-planetoid, Godot Cuberact Planet, PlanetTech/OpenWorlds, ClaudeCitizen und Takram behandeln sowie Cosmonium und die beiden offiziellen Hello-Games-Vorträge einordnen.

### Architekturantwort

Das Dokument SHALL eine umsetzbare Antwort für Repräsentation, Tile-/Chunk-Identität, LOD, Koordinatenframes, Predictive/High-Speed-Streaming, Parent/Child-Readiness, Horizon Culling, dynamische Near/Far-Strategie und Atmosphere/Cloud-Adapter liefern.

### Entscheidungsausgabe

Das Dokument SHALL eine Library Adoption Matrix nach dem vorgegebenen Bewertungsmodell, drei priorisierte technische Spikes und eine klare Trennung zwischen Visual Continuity und Simulation Continuity enthalten.

### Repository-Allowlist

Der Change SHALL ausschließlich `docs/research/planet-lod-streaming-reference-audit-v1.md` und Dateien unter `.devtoolbox/specs/changes/research-planet-lod-streaming-reference-audit-v1/` ändern. Externe Dateien, Assets, Binaries, Captures und Lockfiles SHALL NOT in das Repository gelangen.
