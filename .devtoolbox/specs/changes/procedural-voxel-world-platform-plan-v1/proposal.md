# procedural-voxel-world-platform-plan-v1

## Why

Die vier abgeschlossenen Reference-Audits liefern belastbare, aber getrennte
Erkenntnisse zu Browser-Voxelruntimes, planetarem LOD/Streaming,
Voxel-Meshing/Zerstörung/Asset-Pipelines und WebGL-Observability. Ohne eine
gemeinsame Planungsautorität würden Hestia, Ground Origin, authored Hotspots,
Birth Cluster, Persistence und der Three.js-Adapter in konkurrierenden
Einzeldokumenten weiterentwickelt.

## What Changes

- Die vier Research-Commits werden nach SHA- und Allowlist-Prüfung unverändert
  auf einem aktuellen `origin/main`-Worktree integriert.
- Eine Adoption Matrix ordnet jede untersuchte Referenz genau einer erlaubten
  Nutzungskategorie zu und trennt README Claims von Code-, Test-, Benchmark-
  und beobachteter Browser-Evidence.
- Zwei Spielkonzept-Dokumente definieren Hestia als prozedurale
  Low-Poly-Microvoxelwelt sowie Ground Origin und das erste Schiff.
- Sieben Architektur-Dokumente definieren planetare Repräsentationen,
  Streaming, Zerstörung, Asset-Compilation, Birth Cluster,
  WorldTemplate/WorldInstance, Renderer-Grenzen und Observability.
- Der Living Master Plan erhält nur neue, kollisionsfreie Work Packages mit
  gültigen Planungsstatus und dem geprüften `origin/main`-SHA.

## Scope

- Ausschließlich die im Auftrag genannten Markdown-Dokumente.
- Dieser DevToolbox-Change einschließlich ExecPlan und Testprotokoll.
- Kontrollierte Git-Integration, Docs-Verifikation, logisch getrennte Commits,
  Push und Draft-PR gegen `main`.

## Non-Goals

- Keine Runtime-, Package-, Source-, Scene-, Asset-, Test- oder Buildänderung.
- Keine Auswahl einer fremden Engine oder Bibliothek als Produktbasis.
- Keine Übernahme fremder Sourcefragmente, Lizenztexte, Binary Captures oder
  Bilder.
- Kein vollständig bidirektionaler Offline-/Online-Merge und keine
  automatische Orbitänderung durch lokale Voxelzerstörung.
- Kein Merge des Pull Requests.
