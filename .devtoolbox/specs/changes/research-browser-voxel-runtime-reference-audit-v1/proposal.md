# research-browser-voxel-runtime-reference-audit-v1

## Why

Weltraum-Spiel braucht fuer die geplante browserbasierte, persistente,
zerstoerbare und spaeter serverauthoritative Voxelwelt belastbare
Architekturvorbilder. Eine fremde Engine als neue Gesamtbasis wuerde jedoch die
bestehende Browser-Mainline, ihre Daten-/Rendergrenzen und ihre eigene
Game-/World-Authority unterlaufen.

## What Changes

- Audit von Voxelize, Divine Voxel Engine, AresRPG Engine/World und Veloren an
  festgehaltenen Commit-SHAs.
- Klassifizierte Source-, Test-, Benchmark- und Demo-Evidence statt
  Marketingaussagen.
- Vergleich von Worker-Topologien, Data Plane und Control Plane,
  Client/Server-Authority, Persistence, Mesher-Sharing, Renderer-Kopplung und
  lokaler Voxelphysik.
- Klare Adopt/Prototype/Study/Reuse/Revisit/Reject-Urteile sowie maximal drei
  spaetere Spikes.

## Scope

- `docs/research/browser-voxel-runtime-reference-audit-v1.md`
- Die fuenf Artefakte dieses DevToolbox-Changes.
- Read-only-Untersuchung externer Klone unter `C:\tmp`.
- Temporaere Browser-Screenshots ausserhalb des Repositories, falls eine
  lauffaehige Browserdemo existiert.

## Non-Goals

- Keine Runtime-, Asset-, App-, Package-, Test- oder bestehende Doku-Aenderung.
- Keine Uebernahme oder Integration einer fremden Engine.
- Keine Builds oder Installationen mit ungeprueften package scripts oder
  `build.rs`-Skripten.
- Keine Aussage ueber eine vollstaendige planetare Voxelwelt ohne passende
  Evidence.
