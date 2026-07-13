# Voxel Destruction, Mass, Rotation And Orbit

Stand: 2026-07-13
Status: verbindliche Zielarchitektur, Docs-only, keine Runtime-Implementierung

## 1. Binding Target Decision

Lokale Zerstörung verändert kanonischen Voxel- und Semantic State. Meshes,
Collider, Navigation, BVHs, LODs und sichtbare Bruchflächen werden daraus als
revisionierte Derived Products regeneriert.

Eine lokale Voxelzerstörung verändert **nicht automatisch** Masse,
Gravitationsparameter oder Orbit eines Planeten. Für Himmelskörper bleiben
`CelestialBodyDefinition`, `massKg`, `mu`, Rotation und analytischer Orbit die
Authority des bestehenden
[Celestial Runtime Data Contract](../spielkonzept/celestial-runtime-data-contract.md)
und des [Orbital Simulation Model](../spielkonzept/orbital-simulation-model.md).

Echte Materialtransfers, ausgestoßene Masse und Impulsübertragung werden
langfristig in gesonderten Ledgers bilanziert. Zuerst müssen lokale
`Body Mass Properties` für tatsächlich dynamische oder abtrennbare Körper
belastbar sein; erst danach darf `Rotation/Orbit Coupling` untersucht werden.
Schwellen, Erhaltungstoleranzen, Rollback und Netzwerkauthority bleiben
Research.

## 2. Current Main / Code Foundation

- [Celestial Runtime Data Contract](../spielkonzept/celestial-runtime-data-contract.md)
  trennt physikalische Körperdaten, visuelle Skalierung und
  Oberflächenzugriff über stabile Body-IDs. Masse und `mu` werden validiert,
  nicht aus sichtbarer Geometrie abgeleitet.
- [Orbital Simulation Model](../spielkonzept/orbital-simulation-model.md)
  führt Himmelskörper zunächst analytisch und verlangt Double Precision,
  explizite Referenzframes und gemeinsame Predictorgrundlagen.
- [Coordinate Spaces And Floating Origin](coordinate-spaces-and-floating-origin.md)
  und [Real-Scale World Architecture](real-scale-world-architecture.md)
  erklären lokale Physik als Projektion dauerhafter Zustände. Ein Origin Shift
  ist kein physikalisches Ereignis.
- Der aktuelle Browserpfad besitzt keine in diesen Quellen nachgewiesene
  produktive Voxelzerstörung, Asteroidenfragmentierung oder
  Mass-/Orbitkopplung. Dieses Dokument behauptet keine solche Implementierung.

## 3. Research Evidence

Quellen:

- [Voxel Platform Reference Adoption Matrix v1](../research/voxel-platform-reference-adoption-matrix-v1.md)
- [Voxel Meshing, Destruction, and Asset Audit v1](../research/voxel-meshing-destruction-asset-audit-v1.md)
- [Browser Voxel Runtime Reference Audit v1](../research/browser-voxel-runtime-reference-audit-v1.md)
- [Planet LOD & Streaming Reference Audit v1](../research/planet-lod-streaming-reference-audit-v1.md)

**[Code Evidence]** Die Audits belegen Referenzmuster für kanonische
Voxelkanäle, Dirty-Brick-Remeshing, getrennte Collider-/BVH-Projektionen,
persistierte Deltas und lokale Physikqueries. Sie belegen keine fertige
Hestia-Zerstörungs-, Masseneigenschafts- oder Orbitkopplung.

**[README Claim]** Paper-, Projekt- oder Demobehauptungen zu scharfen
Bruchflächen, CSG, „destructible worlds“ oder physikalischer Genauigkeit werden
nicht als Hestia-Test oder -Benchmark übernommen.

**[Inference]** Das Meshing-Audit ordnet die Abhängigkeiten klar: dauerhafte
lokale Edits und stabile Komponentenbildung kommen vor Masseneigenschaften;
Masseneigenschaften kommen vor Rotation-/Orbitkopplung.

## 4. Authority Layers

Die Zustände bleiben ausdrücklich getrennt:

| Authority | Besitzt | Besitzt nicht |
| --- | --- | --- |
| Celestial Body Authority | Body-ID, katalogisierte/validierte Masse, `mu`, Radius, Rotation, Orbitdefinition und Epoch | lokale Löcher, Gebäudeschaden oder aktuelle Rendermeshes |
| World/Surface Instance Authority | Sites, Entities, Ownership, Semantic State, persistente Terrain-/Strukturdeltas und Revisionen | analytische Body-Bahn aus sichtbarer Geometrie |
| Voxel/Structural Authority | Brickkanäle, Material-, Part-, Joint-, Damage- und Editzustand | GPUressourcen oder automatisch aktualisierte Planet-Ephemeriden |
| Derived Product Pipeline | Mesh, Collider, Nav, BVH, LOD, Far-Field-Schadenproxy | dauerhafte Gameplaywahrheit |
| Future Mass Ledger | Massentransfers, ausgestoßene oder hinzugefügte Masse, lokale Momente und Komponentenwerte | automatische Aktivierung ohne Schwellen-/Authorityvertrag |
| Future Orbital Ledger | autorisierte Impuls-/Drehimpulsereignisse und gekoppelte Bodyzustände | ungeprüfte direkte Ableitung aus einem Render- oder Brickcache |

Die geplante
[World Template, Instance, Online/Offline Transition](world-template-instance-online-offline-transition.md)
besitzt die Lebensdauer und Persistenz der Instance-Deltas. Dieses Dokument
besitzt ihre physikalische Bedeutung und Projektionen.

## 5. Canonical Destruction Transaction

Eine lokale Destruktion wird als explizite, autorisierte Transaktion behandelt:

```text
Validated Destruction Command
  -> canonical Brick and Semantic changes
  -> new Edit and Component Revision
  -> durable Delta or Journal Entry
  -> invalidation of derived products
  -> revision-gated regeneration and atomic publication
```

Der Vertrag umfasst mindestens:

- Command-/Event-ID, Actor und Authorityentscheidung,
- Target Body, World Instance, SurfaceRegion und betroffene Brickschlüssel,
- erwartete Eingangsrevision und atomaren Accept-/Reject-Ausgang,
- Material-, Occupancy-/SDF-, Part-, Joint- und Damageänderungen,
- neue Brick-, Semantic- und Component-Revisionen,
- Provenance, Zeitpunkt/Tick und geordnete Persistenzfolge,
- explizite Invalidierungen für Mesh, Collider, Nav, BVH, LOD und Masscache.

Ein Rendering- oder Meshingfehler darf die akzeptierte kanonische Änderung
nicht rückgängig machen. Umgekehrt darf ein später Workeroutput keine neuere
Änderung überschreiben. Alte sichere Collider-/Proxyprodukte bleiben bis zum
revisionierten Swap aktiv oder Gameplay erhält einen sichtbaren
`projectionPending`-Zustand.

## 6. Derived Products And Update Order

Nach einer akzeptierten Änderung werden Produkte getrennt aktualisiert:

1. Betroffene Bricks und Apron-/Nachbarbereiche dirty markieren.
2. LOD-Ancestors und Übergangsflächen invalidieren.
3. Structural Graph und Komponentenbildung prüfen.
4. Renderprodukt mit Eingaberevision erzeugen.
5. Collider, Navigation und BVH nach ihren eigenen Sicherheitsgates erzeugen.
6. Far-Field- oder authored Proxies asynchron invalidieren beziehungsweise
   mit einem konservativen Schadenstatus versehen.
7. Optional zukünftige Momentensummen im Mass Ledger aktualisieren.

Render-, Collision-, Navigation- und BVH-Produkte dürfen unterschiedliche
Zeitpunkte und Geometrien haben. Sie tragen jedoch dieselbe kanonische
Quellrevision. Sichtbares neues Rendering ist kein Beweis, dass Kollision oder
Persistenz bereit ist.

## 7. Planetary Destruction Boundary

Für Planeten gilt zunächst eine feste physikalische Grenze:

- Lokaler Abtrag, Tunnel, Krater, zerstörte Gebäude und Ressourcenabbau ändern
  lokale World-/Voxel-Deltas.
- `massKg`, `mu`, Body-Rotation und analytischer Orbit des Planeten bleiben
  unverändert, solange kein ausdrücklich spezifizierter Massentransferprozess
  eine relevante Schwelle überschreitet.
- Lokale Massendifferenzen dürfen für Gameplay, Structural Simulation oder
  regionale Lasten genutzt werden, ohne den Bodykatalog zu mutieren.
- Atmosphärische, geologische oder narrative Folgen sind eigene Systeme und
  werden nicht aus einem Mesher abgeleitet.
- Far-Field-Darstellung kann Schaden approximieren, bleibt aber Derived State.

Diese Grenze verhindert, dass ein einzelner abgebauter Brick still den Orbit
eines Planeten ändert oder unterschiedliche Clients aus Cachegeometrie andere
Ephemeriden berechnen.

## 8. Destructible Asteroid Research

Zerstörbare Asteroiden sind ein separates Forschungs- und Produktpaket. Sie
sind nicht lediglich kleine Planeten mit aktivierter lokaler Zerstörung.

Erforderlich sind mindestens:

- körperlokale sparse Brickkoordinaten und stabile Framebindung,
- persistente CSG-/Damage-Deltas,
- Structural-/Connectivity-Graph und deterministische Inselbildung,
- stabile Fragment-/Component-IDs,
- Collider- und BVH-Neubildung,
- Spawn-/Despawn- und Residencyvertrag für freie Fragmente,
- Mass-/COM-/Inertia-Berechnung pro dynamischer Komponente,
- autorisierte Impuls-, Drehimpuls- und Massentransferereignisse,
- Save-/Reload- und später Replikationsevidence.

Bis diese Gates erfüllt sind, bleibt ein zerstörter Asteroid entweder ein
lokal veränderter, kinematisch/analytisch geführter Körper oder ein explizit
geskriptetes Ergebnis. Eine Demo mit Bruchmesh beweist keine dynamische
Massenerhaltung.

## 9. Body Mass Properties

`Body Mass Properties` werden aus kanonischen Material- und
Volumeninformationen berechnet, nicht aus dem aktuellen Rendermesh. Benötigt
werden:

- versionierte strukturelle Materialdichte,
- Solid Fraction oder geeignete Schnittzellenintegration,
- Shellflächen und -dicken sowie analytische Beam-/Rod-Elemente,
- Parttransformationen in einem kanonischen lokalen Frame,
- stabile Komponenten- und Jointzustände,
- inkrementelle Mass-, Schwerpunkt- und Momentensummen je Dirty Brick,
- periodischer vollständiger Referenzabgleich gegen Drift,
- Quellrevision, Algorithmusversion, Toleranz und Ergebnis-Hash.

Die mathematischen Definitionen für Masse, Schwerpunkt und Trägheit werden im
Meshing-Audit referenziert und hier nicht dupliziert. Verbindlich ist die
Reihenfolge:

```text
canonical material and volume state
  -> component connectivity
     -> mass / COM / inertia per component
        -> validated dynamic-body projection
```

Negative oder nicht plausible Ergebnisse, Massenverlust außerhalb Toleranz und
nicht symmetrische Trägheitsergebnisse sind Fehler, kein stiller Fallback.

## 10. Future Mass And Impulse Ledgers

Ein späterer Massentransfer wird als explizites Ereignis bilanziert:

- abgetragene Masse verlässt den Quellkörper nur, wenn sie als Fragment,
  Cargo, Staub-/Ejekta-Reservoir oder anderer definierter Zustand existiert,
- hinzugefügte Masse besitzt Quelle, Ziel, Material und Zeitpunkt,
- Impuls und Drehimpuls tragen Referenzframe und gemeinsame Epoch,
- Transferereignisse sind idempotent, geordnet und rollbackfähig,
- katalogisierte Bodywerte und lokale Instanzwerte werden nicht ohne
  Authorityentscheidung vermischt.

Für Planeten kann ein Schwellenmodell dauerhaft lokale Deltas führen, ohne
astronomische Parameter zu aktualisieren. Die konkrete Schwelle ist Research
und muss physikalische Relevanz, Gameplaywert, numerische Stabilität und
Netzwerk-/Savekosten gemeinsam begründen.

## 11. Rotation / Orbit Coupling

Rotation-/Orbitkopplung ist erst zulässig, wenn folgende Vorbedingungen
nachgewiesen sind:

1. persistente, deterministische lokale Zerstörung,
2. stabile Fragment- und Komponenten-IDs,
3. validierte Mass-/COM-/Inertia-Werte,
4. explizite Massentransfer- und Impulsereignisse,
5. kompatible Double-Precision-Frames und gemeinsame Zeitbasis,
6. Erhaltungs-, Toleranz-, Rollback- und Replikationsregeln,
7. Konsistenz mit dem bestehenden Orbital Predictor.

Die Kopplung darf keine zweite Orbitintegration neben dem
[Orbital Simulation Model](../spielkonzept/orbital-simulation-model.md)
eröffnen. Sie liefert validierte Eingangsdeltas an dessen Authority oder einen
später ausdrücklich spezifizierten Body-Dynamics-Service.

## 12. Persistence, Replay And Rollback

Persistiert werden kanonische Commands/Deltas und periodische revisionierte
Checkpoints. Ein Save enthält keine alleinige Mesh-, Collider- oder
RigidBody-Wahrheit.

Replay muss beweisen:

- gleiche Basisversion plus geordnete Deltas erzeugt gleiche Brick- und
  Component-Hashes,
- abgeleitete Produkte können verworfen und neu erzeugt werden,
- ein abgebrochener Save verliert keine bereits bestätigte Änderung,
- unbekannte Schema-/Material-/Compiler-Versionen schlagen sichtbar fehl,
- Rollback stellt kanonischen Zustand und alle Authorityrevisionen gemeinsam
  wieder her,
- Mass-/Impulsereignisse werden weder doppelt angewendet noch still verloren.

Ein vollständig bidirektionaler Offline-/Online-Merge bleibt außerhalb dieser
Freigabe und benötigt einen eigenen Konfliktvertrag.

## 13. Required Invariants

- Lokale Voxelzerstörung ändert ohne autorisierten Ledger-Eintrag weder
  planetare Masse noch `mu`, Rotation oder Orbit.
- Mesh, Collider, Nav und BVH sind regenerierbar und nennen ihre Quellrevision.
- Ein Fragment besitzt erst nach stabiler Komponentenbildung eine eigene
  dynamische Masseneigenschaft.
- Materialmasse kann nicht gleichzeitig als abgetragen, als Cargo und noch im
  Quellkörper bilanziert sein.
- Frame- oder Floating-Origin-Wechsel erzeugen keinen Impuls.
- Mass-/COM-/Inertia-Berechnung kommt vor Rotation-/Orbitkopplung.
- Planet- und Asteroidenregeln werden nicht still vereinheitlicht.

## 14. Open Benchmarks / Product Questions

- Dirty-Brick-, Remesh-, Collider- und Save-Amplifikation pro Editklasse.
- Wahl und Determinismus des Bruchflächen-Meshers.
- Connectivity-, Split- und Thin-Feature-Regeln für Gebäude und Asteroiden.
- Toleranzen und Rebuildschwellen für BVH, Collider und Massmomente.
- Ab wann ein lokaler Massentransfer astronomisch oder nur lokal relevant ist.
- Repräsentation von Ejekta, Staub, Fragmenten und zurückgewonnenem Cargo.
- Impuls-/Drehimpulserhaltung über Fragmentierung und Framewechsel.
- Autorität, Konfliktbehandlung und Rollback in späterem Onlinebetrieb.
- Kopplungsgrenze zu analytischen Keplerbahnen, SOI und Predictor.

Diese Fragen bleiben Research. Es gibt keine Freigabe für automatisch
veränderliche Planetenorbits oder vollständig dynamische zerstörbare Körper.
