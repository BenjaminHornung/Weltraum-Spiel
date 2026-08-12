# P01–P05 Prototype Intake Review

**Datum:** 2026-08-12  
**Status:** `PROPOSED_INTAKE`, keine Produktintegration

## P01 – Editor Shell

**Erhalten:** Hierarchy, Inspector, Asset Browser, Layers, Issues, Command
History, Preview → Validate → Commit, monotone Revisionen und kompensierendes
Undo/Redo. Der Prototyp ist die stärkste visuelle Referenz für G02/G14/G17.

**Nicht übernehmen:** Mock-Domain als Produktvertrag, Renderer-/UI-Zustand als
Authority oder lokale History als späteren kollaborativen Vertrag.

**Nächstes Gate:** Headless Command-/Transaction-Core mit denselben sichtbaren
UX-Zuständen, aber ohne React-/Three-Abhängigkeit in der Domain.

## P02 – Mission Graph

**Erhalten:** typisierte Knoten/Ports, Reachability, Cardinality, Cycle-Warnung,
deterministischer Compile ohne Layout/Selection/Runner-State und sichtbarer
Stepper. Der Prototyp stützt G05s Empfehlung „eigener Contract-/Compilerkern +
React Flow als Projektion“.

**Nicht übernehmen:** Mock-Conditions/-Effects als World Authority oder den
simulierten Runner als echte Mission Runtime.

**Nächstes Gate:** Contract-Roundtrip und Effect-Plan/Receipt-Simulator gegen
synthetischen revisionsgebundenen WorldStateReadView.

## P03 – Settlement Editor

**Erhalten:** Road-Draft, semantisches Snapping, Junctions, Parcel-Ableitung,
Zonierung, Gebäudevorschau, begründete Placement-Validation, Save/Load und
Commandanzeige. Die Findings identifizieren stabile Parcel-IDs,
Road-Graph-Topologie und Terrain-/Assetrevisionen als die echten Risiken.

**Evidenzgrenze:** Die Delivery Note dokumentiert, dass die Agent-Browseransicht
fremde parallele Sites zeigte; deshalb wurden keine echten P03-Screenshots als
Beweis behauptet. Das Paket ist Code-/Contract-Evidence, noch kein visuell
abgenommener Prototyp.

**Nächstes Gate:** unabhängiger lokaler Build-/Browsercapture und danach enger
Road-Graph-/Parcel-Stability-Spike; keine Produktintegration.

## P04 – Star-System-Map

**Erhalten:** stabile Objektselektion über 2D/3D, Systemzeit-Scrubbing,
Overlaykombination, Route Preview und expliziter Surface-Site-Handoff-Stub.
Der Prototyp ist eine gute visuelle Projektion von G10, aber keine
Orbitalmechanik.

**Nicht übernehmen:** Fixture-Orbits, Risiko-/ETA-Werte oder SVG-/Canvasdaten als
Simulation Authority.

**Nächstes Gate:** mathematischer Frame-/Epoch-/State-Vector-Spike mit derselben
UI als read-only Projektion.

## P05 – AI Transaction UX

**Erhalten:** klarer Ablauf Instruction → Plan → Dry-run → Issues → Fix → Diff →
Owner Approval → Commit Receipt → Compensating Undo. Der Flow entspricht G11s
Sicherheitsarchitektur und ist als Review-UX wertvoll.

**Evidenzgrenze:** keine echte KI, keine JCS-/SHA-256-Bindung, keine CAS-Prüfung,
keine authentifizierte Rolle und laut Paketnotiz keine exportierten
Screenshotdateien wegen EROFS.

**Nächstes Gate:** synthetischer, authority-freier Stage/Seal/Approval-Simulator
mit echten kanonischen Digests und Fault-Injection; weiterhin ohne
Produkt-Commitrechte.

## Gemeinsames Ergebnis

Die fünf Prototypen sollten nicht zu fünf Produktapps werden. Sie sind
Projektionen eines gemeinsamen Kerns:

```text
Stable IDs + Versioned Documents
        ↓
Command / Preview / Validation / Receipt
        ↓
Domain-spezifische Projektionen
Editor Shell · Mission Graph · Settlement · System Map · AI Review
```

Der nächste produktive Architekturbeweis ist deshalb **nicht** das Zusammenbauen
der fünf UIs, sondern ein kleiner renderneutraler Command-/Transaction-/Receipt-
Kern, gegen den P01 und P05 als erste Projektionen laufen. P02, P03 und P04
bleiben danach getrennte Domainspikes.
