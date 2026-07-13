# ExecPlan: Procedural Voxel World Platform Planning V1

## Ziel

Aus vier allowlist-geprüften Research-Audits entsteht auf aktuellem
`origin/main` eine widerspruchsfreie, Docs-only-Planungsautorität für Hestia,
Ground Origin, planetare Voxelrepräsentationen, authored Hotspots,
WorldTemplate/WorldInstance, Birth Cluster, Persistence, Three.js-Grenzen,
Zerstörung und Performance-Evidence.

## Kontext

- Basis: `origin/main` bei `c780656c29ff4e5794be9ba58d6b78396a5826d5`.
- Research-Commits: `a8973415`, `02a86ada`, `eacf46f3`, `eebe79a3`.
- Zielbranch: `docs/procedural-voxel-world-platform-plan-v1`.
- Relevante bestehende Autoritäten: Current Prototype State, Planning
  Consistency Audit, Coordinate/Surface Frames, Real Scale World, Browser
  Mainline, Orbitalmodell, Persistence und Living Master Plan.
- DevToolbox blockiert den isolierten Worktree derzeit mit
  `unauthorized_path`; Preflights werden nicht umgangen.

## Nicht-Ziele

- Keine Runtime-Implementierung, Packages, Source, Tests, Assets, Bilder,
  Captures oder externen Dateien.
- Keine fremde Engine als neue Basis und keine ungeprüfte Source-Wiederverwendung.
- Kein PR-Merge und kein Force-Push.

## Architekturentscheidung

Die verbindlichen Grenzen stehen in `design.md`. Welt- und Voxelzustand sind
rendererunabhängig; Planetary Macro Data, Surface Tiles und lokale Voxel Bricks
sind getrennt; authored Content überlagert die prozedurale Basis; Persistenz
speichert Seeds, Versionen, Semantic State und Deltas; Three.js bleibt Adapter.

## Implementierungsphasen

1. Remote-Provenance, Allowlisten und Main-SHA prüfen; Worktree isolieren.
2. Vier Research-Commits einzeln übernehmen und unverändert halten.
3. Existing-Docs- und Research-Synthese erstellen; Adoption Matrix schreiben.
4. Spielkonzept- und Architektur-Dokumente entlang klarer Authority-Grenzen
   schreiben und relativ verlinken.
5. Master-Plan-Schema/IDs prüfen und nur neue geplante Work Packages ergänzen.
6. Deterministische Docs-Verifikation, unabhängiges Review und Evidence-Update.
7. Logisch getrennte Commits, aktueller Main-Abgleich, Push und Draft-PR.

## Tests und Evidence

- Git-SHA-, Commitzahl- und Name-Status-Evidence für alle Research-Refs.
- `git diff --check`.
- Scope-Check gegen Docs/DevToolbox-Markdown-Allowlist und verbotene
  Package/Source/Test/Binary/Image-Endungen.
- Link-Auflösung für relative Markdown-Links.
- Eindeutigkeitsprüfung aller Work-Package-IDs und Schema-Prüfung der Statuswerte.
- Pflichtreferenz- und Architekturentscheidungs-Scan.
- Manueller Diff-Review auf README-Overclaims, Lizenztext-/Sourcekopien und
  unzulässige Bibliotheksentscheidungen.
- Keine Runtime-Tests; Status `NOT APPLICABLE`.

## Risiken

- Bestehende Dokumente können gleichlautende Begriffe mit anderer Authority
  verwenden.
- Research-Kategorien können irrtümlich als Integrationsentscheidung gelesen
  werden.
- Der große Living Master Plan kann ID- oder Statuskollisionen verbergen.
- Ein fehlender historischer LFS-Blob kann normale Git-Status-/Checkout-Aufrufe
  stören; LFS-Filter werden für Docs-Git-Operationen explizit deaktiviert.
- Der DevToolbox-Path-Guard kann formale Task-Completion verhindern.

## Rollback / Safe Stop

Bei unbekannten Branch-Dateien, Source/Binary/Image-Änderungen, ungeklärter
Produktentscheidung, ID-Kollision, unzulässigem Status oder abweichendem
`origin/main` wird gestoppt. Research-Commits werden nicht verändert; neue Docs
bleiben in getrennten Commits und werden nicht force-gepusht.

## Fortschrittslog

- [x] Remote-Refs, SHAs, Allowlisten und Basis geprüft.
- [x] Isolierten Worktree erstellt und vier Research-Commits übernommen.
- [ ] Research und bestehende Dokumente reconciliieren.
- [ ] Ziel-Dokumente und Adoption Matrix erstellen.
- [ ] Living Master Plan ergänzen.
- [ ] Evidence, Review, Commits, Push und Draft-PR abschließen.

## Definition of Done

Alle geforderten Markdown-Dokumente sind vorhanden, widerspruchsfrei verlinkt
und enthalten die verbindlichen Architekturentscheidungen. Der Master Plan hat
den geprüften Main-SHA, eindeutige IDs und gültige nicht-abgeschlossene Status.
Der Diff ist Docs-only, frei von Images/Binaries/Source/Packages, `git diff
--check` und Link-/ID-/Statusprüfungen sind frisch erfolgreich, der Branch ist
ohne Force-Push veröffentlicht und ein Draft-PR gegen `main` existiert. Der PR
wird erst nach aktuellem Main-Abgleich, Docs-Review und erfolgreicher CI
gemergt.
