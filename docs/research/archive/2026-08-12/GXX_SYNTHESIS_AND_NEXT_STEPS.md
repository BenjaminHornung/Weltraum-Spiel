# G01–G17 und P01–P05: Intake-Synthese und nächste Schritte

**Stand:** 2026-08-12  
**Status:** `PROPOSED_COORDINATION_PLAN`  
**Grenze:** keine Produktintegration, keine Voxel-Lab-Writefreigabe

## 1. Gesamturteil

Die Berichte sind nicht siebzehn voneinander unabhängige Featurepläne. Sie
konvergieren auf einen gemeinsamen Plattformkern:

```text
stabile IDs + versionierte Dokumente + kanonische Digests
                     ↓
Command → Preview → Validation → Prepare → Approval → Commit Receipt
                     ↓
      atomare Authority-Transaktion / immutable Revision
                     ↓
rebuildbare Projektionen: Editor, Graph, City, System Map, AI Review, Renderer
```

Der wichtigste nächste Architekturbeweis ist daher ein kleiner, renderneutraler
Command-/Transaction-/Receipt-Kern. Die fünf P-Prototypen sind wertvolle UI- und
Contract-Referenzen, aber keine fünf Produktanwendungen und keine Domain-Authority.

## 2. Konsens über alle G-Berichte

1. Genau eine Authority je Zustandsdomäne; Renderer, UI, Worker, KI und Tests
   bleiben Ableitungen oder Auftraggeber.
2. Separate browserbasierte Developer-App; Player Construction bleibt ein
   enger Workspace der Runtime. Beide teilen Domain-, Command-, Validation- und
   Package-Verträge, aber nicht Rechte, Kosten oder Freigaben.
3. Three.js bleibt Referenz- und Presentation-Adapter; kein Enginewechsel und
   kein Three.Object3D als persistierte Wahrheit.
4. Commands sind typisiert, revisioniert, idempotent und atomar; Preview ist
   Copy-on-write; History ist eine Receipt-/Commit-Projektion.
5. KI ist in V1 Proposal-/Preview-/Stage-Autor. Commit bleibt host- und
   menschlich kontrolliert und bindet exakt geprüfte Bytes/Digests.
6. Contentpakete sind in V1 deklarativ und unveränderlich veröffentlicht;
   beliebiges JS/WASM, Last-write-wins und stille Paket-/Generatorupgrades sind
   ausgeschlossen.
7. Simulation-LOD und Render-LOD sind getrennt. Identität, Besitz, Tod,
   Verpflichtungen, Stoff-/Geldmengen und bestätigte Ereignisse bleiben über LOD
   invariant.
8. 0,25 m bleibt der erste normative Voxel-/Assetvertrag. 0,125 m bleibt ein
   lokales Forschungsprofil bis ein Refinementvertrag existiert.
9. Große Systeme entstehen als kleine serielle Gates mit unabhängiger Review-
   und Ownerfreigabe, nicht als monolithische City-/Editor-/Planet-Implementierung.

## 3. Statusgruppen

### Direkt synthesegeeignet

- G08 Economy
- G10 Celestial/System Editor
- G11 AI Authoring Copilot

Diese Berichte liefern konsistente Zielverträge, aber keine direkte
Implementierungsfreigabe.

### Owner-Freeze erforderlich

- G01 Core Loop / MVP-Grenze
- G02 Authoring Platform
- G07 Factions/Law
- G09 Craft Builder
- G13 Content/Mods/Saves
- G14 UX/Modes
- G15 Combat/Mining/Drones
- G17 QA/Automation

### Isolierter Spike erforderlich

- G03 Editor Technology
- G05 Narrative Graph
- G06 NPC Simulation LOD
- G12 Blender→HVOX
- G16 Procedural City Generation

G04 führt ebenfalls zuerst in einen isolierten Road-/Parcel-Spike und danach in
City Slice v1; die aktuelle Agentenausgabe wird erst nach explizitem Abschluss
als final behandelt.

## 4. P-Prototypen

- **P01** ist die stärkste gemeinsame Shell- und Transaction-UX-Referenz.
- **P02** bestätigt den Ansatz „headless Mission-Contract/Compiler + Graphprojektion“.
- **P03** liefert wertvolle Road-/Parcel-/Validation-Verträge, besitzt aber eine
  dokumentierte visuelle Evidence-Lücke.
- **P04** ist eine gute read-only Systemkartenprojektion, keine Orbit-Simulation.
- **P05** ist die stärkste Approval-/Receipt-UX-Referenz, aber noch ohne echte
  Digests, CAS, Rollen oder Authority.

## 5. Priorisierte Queue

### Jetzt, solange WP04 noch im Fix-Loop ist

1. Keine weitere Schreibarbeit im Voxel-Lab starten.
2. G03 und G04 sauber abschließen; aktuelle Heads/Dateien ausdrücklich als final
   bestätigen.
3. P01–P05 in einem nicht gemergten GitHub-Archivzweig persistieren.
4. Read-only P06 Prototype Intake/Adoption Audit ausführen.
5. Read-only X01 Common Contract Vocabulary/Crosswalk ausführen.
6. Kritische Ownerfragen vorbereiten, aber noch keinen Produktcode starten.

### Sobald G03 und G04 final sind

7. G18 Master-Synthese starten. WP04 darf parallel weiterlaufen, weil G18
   read-only bleibt und unakzeptierte WP04-Ergebnisse nicht als Produktwahrheit
   behandelt.
8. G18 muss GDD, Plattformarchitektur, Command Contract, Dependency Graph,
   Vertical-Slice-Roadmap, Tool Decision Log, Ownerentscheidungen und zehn kleine
   Folgeprompts erzeugen.

### Nach G18 und Owner-Freeze

9. Erster Write-Spike: isolierter Editor Command/Transaction Core, nicht im
   Produktrepo und nicht im Voxel-Lab.
10. Danach seriell:
    - Mission Graph Contract/Compiler mit P02-Projektion;
    - Road Graph/Parcel Stability mit P03-Projektion;
    - Celestial Frame/Epoch/State-Vector Math mit P04-Projektion;
    - Stage/Seal/Approval/CAS Sandbox mit P05-Projektion.
11. Erst nach diesen Gates Produkt-Integrationsentscheidungen treffen.

### Separater Voxelpfad

```text
WP04 Fix
→ unabhängiger Re-Review
→ visuelles Owner-Gate
→ ACCEPT
→ --ff-only Integration
→ C08 BR-Crosswalk
→ BR-01 → BR-02 → BR-03 → BR-04
→ WP05
```

G18 und C08 sind verschiedene Synthesen: G18 ordnet Spiel/Editor/Content; C08
harmonisiert ausschließlich den Benchmarkpfad des Voxel-Labs.

## 6. P0-Ownerentscheidungen für den nächsten Freeze

1. MVP endet vorerst nach G01 VS-03 in einer begrenzten Hestia-Region.
2. Separate Developer-App und schlanker Player-Construction-Workspace werden
   als Zielgrenze akzeptiert.
3. V1-KI benötigt für jeden Commit explizite Human Approval; kein Auto-Commit.
4. Content/Mods bleiben in V1 data-only; kein JS/WASM.
5. 0,25 m ist v1-Standard; 0,125 m bleibt Research.
6. G03-Hybrid-Eigenbau wird akzeptiert; PlayCanvas/Three Editor/Blender bleiben
   Referenzen beziehungsweise externe Werkzeuge, nicht Authority.
7. Lab-Lizenz, Contributionpolitik und Rechtekette werden vor öffentlicher
   Wiederverwendung entschieden.
8. Erstes isoliertes Write-Ziel ist ein eigener Editor-Core-Spike.

## 7. No-Go bis zur Synthese

- kein Zusammenkopieren der fünf P-Prototypen;
- kein direkter Produktmerge eines Scratch-Prototyps;
- keine zweite Domain- oder Voxel-Authority im Editor;
- keine KI-Selbstfreigabe;
- kein freies Script-/Mod-System;
- kein City-/NPC-/Economy-Monolith;
- kein neuer Voxel-Lab-Writer vor WP04-Integration;
- keine Performancebehauptung aus Prototype- oder HUD-Timings.
