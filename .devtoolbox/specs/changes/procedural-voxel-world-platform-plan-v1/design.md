# Design

## Source Authority

Die vier importierten Research-Audits bleiben die reproduzierbare
Reference-Evidence. Die Adoption Matrix normalisiert nur die Entscheidungen.
Spielkonzept-Dokumente definieren Spielerfahrung und Weltprämissen.
Architektur-Dokumente definieren Daten-, Authority-, Repräsentations- und
Adaptergrenzen. Der Living Master Plan sequenziert noch nicht implementierte
Work Packages, ohne Capability-Status vorwegzunehmen.

Bestehende Dokumente bleiben für bereits definierte Domänen autoritativ, etwa
Koordinatenräume, SurfaceLocalFrame, aktuelle Browser-Mainline, Orbitalmodell,
Persistenz und Surface-Gameplay. Die neuen Dokumente verweisen auf diese
Autoritäten und ersetzen sie nicht durch parallele Begriffe.

## Binding Architecture Direction

- World State und Voxel State sind unabhängig von Three.js; Three.js ist ein
  Renderer-Adapter.
- Astronomische Daten verwenden hierarchische Double-Precision-Frames.
- Die globale Planetenrepräsentation ist nicht vollständig volumetrisch.
- Planetary Macro Data, Surface Tiles und lokale Voxel Bricks sind getrennte
  Repräsentationen; nur das Near Field darf echte volumetrische Microvoxels
  verwenden.
- Terrain und Gebäude dürfen unterschiedliche Mesher verwenden.
- `0.25 m` ist Qualitätsziel, `0.50 m` der definierte Performance-Fallback.
- Authored Hotspots überlagern die prozedurale Basis.
- Dauerhafte Weltzustände bestehen aus Seeds, Versionen, Semantic State und
  Deltas; `WorldTemplate` und `WorldInstance` bleiben getrennt.
- GLB/glTF ist der kanonische Input des Asset-Compilers.
- Große Transferables bilden die Worker Data Plane. RPC darf nur die Control
  Plane vereinfachen. WASM folgt ausschließlich einem Benchmark. Shared Memory
  bleibt optional und braucht eine eigene Deploymentprüfung.
- Grobe Repräsentationen bleiben aktiv, bis feinere bereit sind. Streaming
  berücksichtigt Geschwindigkeit, Route und Deadline.
- Spector.js, Chrome DevTools MCP, stats-gl und MemLab MCP haben getrennte
  Evidence-Rollen.
- Der Spieler startet auf Hestia ohne eigenes Schiff. Das private Heimatsystem
  kann später als Birth Cluster in die gemeinsame Galaxie überführt werden.
  Nur uncommitted oder unobserved Sektoren dürfen Cluster aufnehmen; umliegende
  unentdeckte Systeme bilden vorübergehend einen Puffer. Spätere normale
  Entdeckung durch andere Spieler bleibt möglich.
- Lokale Zerstörung ändert nicht automatisch den Orbit eines Planeten. Echte
  Massentransfers und Impulsübertragung werden langfristig separat bilanziert.

## Research And Adoption Boundary

Jede Referenz erhält genau eine der Kategorien `Adopt as external tool`,
`Prototype behind adapter`, `Study concepts`, `Isolated code reuse candidate`,
`Revisit later` oder `Reject`. Eine Kategorie autorisiert keine Integration.
Source-Reuse-Kandidaten brauchen zusätzlich Lizenz-, Provenance-, Adapter- und
Benchmarkprüfung.

README Claims dürfen sichtbare oder interne Fähigkeiten nicht als verifiziert
darstellen. Code Evidence, Test Evidence, Benchmark Evidence, Observed Demo
Evidence und Inference bleiben getrennt gekennzeichnet.

## Documentation Topology

- `docs/spielkonzept/hestia-procedural-voxel-world.md`: Weltprämisse,
  authored/procedural Composition und Story-Hotspots.
- `docs/spielkonzept/ground-origin-progression-and-first-ship.md`: Start ohne
  Schiff, erste Progression und Handoff in die Raumfahrt.
- `docs/architecture/procedural-voxel-planet-runtime.md`: Repräsentationsstufen,
  Frames, Tile/Brick-Streaming und Handoffs.
- `docs/architecture/voxel-destruction-mass-rotation-orbit.md`: lokale
  Zerstörung, Masseneigenschaften und entkoppelte Orbit-/Rotationsforschung.
- `docs/architecture/voxel-asset-authoring-and-compilation.md`: GLB/glTF-Input,
  Offline-Compiler, Golden Corpus und Mesher-Grenzen.
- `docs/architecture/universe-sector-placement-and-birth-clusters.md`: sichere
  Cluster-Allokation, Story-Normalisierung und Interest Management.
- `docs/architecture/world-template-instance-online-offline-transition.md`:
  Template/Instance, Seeds, Versionen, Semantic State und Deltas.
- `docs/architecture/world-runtime-render-backend-boundary.md`: rendererfreie
  Authority, Three.js-Adapter und Worker Data/Control Plane.
- `docs/architecture/webgl-observability-and-performance-evidence.md`:
  getrennte Capture-, Telemetrie-, Leak- und Browser-Diagnoserollen.

## Git Integration

Jeder Research-Branch muss genau einen erwarteten Commit und ausschließlich
seine Research-Datei plus fünf DevToolbox-Markdown-Artefakte enthalten. Die
Commits werden einzeln cherry-picked. Die neue Planungsarbeit wird anschließend
in logisch getrennten Docs-Commits committed. Force-Push und Merge sind nicht
Teil dieses Changes.

## Verification Strategy

- `git diff --check` und vollständige Diff-/Allowlist-Prüfung.
- Keine Änderungen an Packages, Source, Tests, Assets, Bildern oder Binaries.
- Relative Markdown-Links gegen tatsächlich vorhandene Dateien auflösen.
- Alle Work-Package-IDs global auf Eindeutigkeit und alle Statuswerte gegen das
  vorhandene Master-Plan-Schema prüfen.
- Pflichtbegriffe, Referenzen und Architecture Decisions per deterministischer
  Textprüfung abdecken.
- Runtime-Builds und Tests sind für den Docs-only-Scope nicht anwendbar.
- DevToolbox-Preflights werden nicht umgangen, wenn der Path-Guard den Worktree
  als `unauthorized_path` ablehnt.
