# WorldTemplate, WorldInstance und Online-/Offline-Übergang

Stand: 2026-07-13
Status: Verbindliche Docs-only-Planungsgrundlage, keine Runtime-Implementierung

## 1. Zweck und bestehende Authorities

Dieses Dokument trennt rekonstruierbare Weltdefinitionen von veränderlichen
Weltinstanzen und beschreibt die sichere Planungsgrenze zwischen privater
Offline-/Solo-Welt und späterer gemeinsamer Online-Welt.

Es spezialisiert, ersetzt aber nicht:

- [Persistence and Offline Simulation](../spielkonzept/persistence-and-offline-simulation.md)
  für Save-/Background-Grundregeln,
- [Background Simulation Boundaries](./background-simulation-boundaries.md)
  für Active/Background/Dormant-Verhalten,
- [Celestial Runtime Data Contract](../spielkonzept/celestial-runtime-data-contract.md)
  für Himmelskörperdefinitionen und stabile Body-IDs,
- [Coordinate Spaces And Floating Origin](./coordinate-spaces-and-floating-origin.md)
  für Positionen, Geschwindigkeiten und Frames,
- [Universe Sector Placement und BirthCluster](./universe-sector-placement-and-birth-clusters.md)
  für die spätere galaktische Platzierung.

## 2. Verbindliche Zielentscheidungen

- Ein `WorldTemplate` ist eine unveränderliche, versionierte Definition einer
  rekonstruierbaren Weltbasis.
- Eine `WorldInstance` ist der veränderliche, autoritative Zustand einer
  konkreten Spielwelt auf Basis genau einer Template-/Versionsbindung.
- Persistente Weltinformation besteht aus Seeds, Versionen, Semantic State und
  Deltas sowie den stabilen IDs und Zeit-/Framebindungen, die diese Daten
  interpretierbar machen.
- Three.js-Objekte, Meshes, Collider, Navigation-Produkte, GPU-Buffer,
  Worker-Caches und LOD-Produkte sind abgeleitet und werden nicht als World
  Truth gespeichert.
- Eine private Offline-/Solo-`WorldInstance` darf später über einen validierten,
  importartigen Übergang als `BirthCluster` in eine gemeinsame Welt überführt
  werden.
- Dieser Übergang darf zunächst einseitig sein. Änderungen nach dem Import
  werden nicht automatisch zwischen privater und gemeinsamer Instanz
  synchronisiert.
- Vollständig bidirektionaler Offline-/Online-Merge bleibt Research.
- Fehlende Versionen, unbekannte IDs, Migrationslücken, Delta-Konflikte oder
  Allokationskonflikte führen fail closed zum Abbruch; Daten werden nicht still
  verworfen oder geraten.

## 3. WorldTemplate

Ein `WorldTemplate` beschreibt die reproduzierbare Ausgangswelt. Es enthält
oder referenziert mindestens:

```text
WorldTemplateId
TemplateSchemaVersion
ContentVersion
GeneratorIdsAndVersions
CompilerIdsAndVersions
CanonicalSeeds
CelestialDefinitionRefs
MaterialAndBiomeDefinitionRefs
AuthoredHotspotDescriptors
CompatibilityAndMigrationMetadata
CanonicalTemplateHash
```

Regeln:

- Veröffentlichte Template-Versionen werden nicht in place verändert.
- Eine fachliche Änderung erzeugt eine neue Version und gegebenenfalls eine
  explizite Migration.
- Anzeigenamen sind keine Identität.
- Hestia- oder Celestial-Fakten werden referenziert, nicht in konkurrierenden
  Tabellen dupliziert.
- Authored Hotspots sind versionierte Overlays der Basis, keine gespeicherten
  Three.js-Szenen.
- Seeds allein genügen nicht: Algorithmus-, Schema-, Generator- und
  Compiler-Versionen gehören zur Reproduzierbarkeit.

## 4. WorldInstance

Eine `WorldInstance` bindet eine konkrete Welt an ein Template und hält alle
veränderlichen Entscheidungen:

```text
WorldInstanceId
WorldTemplateIdAndVersion
InstanceSchemaVersion
AuthorityModeAndRevision
UniverseTimeOrEpoch
EffectiveSeedManifest
SemanticState
Deltas
MigrationHistory
OptionalGalaxyPlacementBinding
CanonicalInstanceRevision
```

### 4.1 Semantic State

`Semantic State` umfasst bedeutungstragenden Zustand, beispielsweise:

- Spieler- und Ownership-Zustand,
- Discovery und Knowledge,
- Story-, Mission- und Progressionszustand,
- Outpost-, Faction- und Servicezustand,
- Entity-, Ship-, Drone- und Cargozustand,
- Depletion, Damage und zerstörte/gesicherte Sites,
- Background Jobs und relevante World Events.

Die konkreten Subschemas bleiben bei ihren Domain-Ownern. `WorldInstance`
erfindet keine zweite Mission-, Cargo-, Orbit- oder Faction-Logik.

### 4.2 Deltas

`Deltas` sind kompakte, versionierte Änderungen gegenüber der deterministischen
Templatebasis, beispielsweise:

- sparse `VoxelBrick`-Edits,
- lokale Zerstörung oder Aufbau,
- Terrain-/Materialänderungen,
- Ressourcendepletion,
- Zustandsänderungen an authored Hotspots,
- explizite Entity- oder Komponentenänderungen.

Ein Delta braucht stabile Zielidentität, Basis-/Vorherrevision, eigene Revision,
Schema-/Generatorbezug und eine definierte Reihenfolge. Fehlende Nachbardaten,
Rendererresultate oder Cache-Eviction dürfen nicht als „Luft“, Löschung oder
neues Delta persistiert werden.

## 5. Was nicht gespeichert wird

Nicht zur persistenten Authority gehören:

- Three.js-Scenegraph und `Object3D`-Identitäten,
- sichtbare Mesh- oder Materialinstanzen,
- generierte Terrain-/Gebäude-Meshes,
- WebGL-/WebGPU-Buffer und GPU-Ressourcen,
- aktuelle `SurfaceTile`-/LOD-Caches,
- Worker-Transferbuffer oder Shared-Memory-Layouts,
- temporäre Collider-/Navigation-Produkte,
- Screenshots, Captures und Debug-Overlays,
- die aktuelle Floating-Origin-Projektion.

Diese Produkte werden aus Template, Instance, Frame und Revision neu erzeugt.

## 6. Lokale Offline-/Solo-Authority

In einer privaten Offline-/Solo-`WorldInstance` ist der lokale Prozess für die
Instanz autoritativ. Das bedeutet nicht, dass spätere Online-Regeln umgangen
werden dürfen:

- Stable IDs, Versionen und Migrationen werden von Anfang an verwendet.
- Background Simulation verwendet dieselben Domain-Regeln wie aktive
  Simulation.
- Save/Load hält effektive Seeds, Versionen, Semantic State und Deltas zusammen.
- Unbekannte Future-Versionen werden abgelehnt, nicht tolerant umgedeutet.
- Lokale Renderer- oder Cachezustände werden nie zur Authority erhoben.

Reale Offline-Zeit und ihre Caps bleiben der bestehenden
[Persistence and Offline Simulation](../spielkonzept/persistence-and-offline-simulation.md)
beziehungsweise einem späteren Offline-Time-Policy-Paket vorbehalten.

## 7. Geplanter importartiger Online-Übergang

Ein zunächst sicher planbarer Übergang ist ein versionierter Import, kein
laufender Zweiwege-Sync:

1. Die private Instanz erzeugt einen konsistenten Snapshot an einer festen
   Instance-Revision.
2. Template-, Schema-, Generator-, Compiler- und Domainversionen werden gegen
   die Zielplattform validiert.
3. Alle Stable IDs, Referenzen, Frames, Seeds, Semantic-State-Segmente und
   Deltas werden vollständig geprüft.
4. Notwendige Migrationen laufen in einer nachvollziehbaren Reihenfolge und
   erzeugen ein Protokoll.
5. `Story Normalization` erzeugt einen expliziten Plan für private und
   gemeinsame Kontinuität.
6. `Birth Cluster Allocation` reserviert fail closed eine zulässige
   Galaxy-Platzierung.
7. Der Zielserver beziehungsweise Host erzeugt eine neue autoritative
   Online-`WorldInstance` oder registriert den geprüften Import als neue
   Authority-Revision.
8. Erst nach vollständigem Commit wird das `BirthCluster` veröffentlicht.

Die private Quelle darf lokal erhalten bleiben, aber spätere Änderungen an ihr
werden nicht automatisch in die Online-Instanz gemergt. UI und Metadaten müssen
diese Fork-Grenze sichtbar machen.

## 8. Migrationen, IDs und Konflikte

Eine Migration muss deterministisch, versioniert und wiederholbar prüfbar sein.
Sie darf:

- bekannte alte Schemas in eine unterstützte Version überführen,
- explizite ID-Remappings anwenden,
- Deltas gegen eine neue Basis transformieren, wenn dafür eine belegte Regel
  existiert,
- einen Import mit strukturiertem Grund ablehnen.

Sie darf nicht:

- unbekannte Felder oder Deltas still löschen,
- IDs aus Anzeigenamen neu erzeugen,
- fehlende Definitionen durch Rendererassets ersetzen,
- Konflikte per „letzter Schreibzug gewinnt“ lösen, solange kein fachlicher
  Domainvertrag dies ausdrücklich erlaubt,
- einen teilweise migrierten Zustand veröffentlichen.

Fail-closed-Abbruchgründe umfassen mindestens:

- unbekannte oder nicht unterstützte Future-Version,
- fehlende Template-/Definition-/Entity-ID,
- Hash- oder Revisionsabweichung,
- Delta gegen falsche Basisrevision,
- widersprüchliche Ownership-/Storyzustände,
- nicht auflösbare globale ID-Kollision,
- fehlgeschlagene `BirthCluster`-Allokation.

## 9. Vollständig bidirektionaler Merge bleibt Research

Ein echter Zweiwege-Merge müsste gleichzeitig semantische Domainkonflikte,
Voxel-Deltas, Storyfortschritt, Ownership, Zeit, Economy, Discovery, Entity-Leben
und globale Platzierung auflösen. Ein generischer Dateimerge oder
Last-Write-Wins ist dafür nicht ausreichend.

Bis ein eigener Research-Auftrag belastbare Regeln und Evidence liefert, gilt:

- kein automatischer Online-zu-Offline-Rückmerge,
- kein automatischer Offline-zu-Online-Nachmerge nach dem Import,
- keine Marketing- oder UI-Aussage, die nahtlose Bidirektionalität verspricht,
- Konflikte bleiben sichtbar und blockieren den Merge.

## 10. Aktuelle Foundation auf main

Resource- und Ship-Builder-Domänen besitzen stabile IDs und kanonische
Serialisierung. Absolute/local Frames, World Snapshots und Chunk-/Residency-
Grundlagen sind vorhanden. Der Browser-Persistence-Core besitzt außerdem ein
striktes `SaveGameEnvelopeV1`, stabile Persistence-Identitäten, versionierte
Definitionsreferenzen, persistente Domain Events und eine generische Migration
Registry. Diese Verträge sind noch nicht mit Browser Storage, Save/Load UI,
automatischer Zeitfortschreibung oder der spielbaren Runtime verbunden.

Nicht vorhanden sind `WorldTemplate`- und `WorldInstance`-Schemas,
persistente Voxel-Deltas, produktive World-/Voxel-Migrationen,
Offline-/Online-Import und Server-Authority. Der aktuelle Status steht im
[Living Master Plan](../roadmap/living-master-plan.md). Die
[Persistence-/Universe-Time-/Event-Core-Evidence](../browser-mainline/persistence-universe-time-event-core-v1.md)
belegt nur die generischen Contracts, nicht die hier geplante
WorldTemplate-/WorldInstance-Persistence.

Die
[Browser Mainline Architecture](../browser-mainline/browser-architecture.md)
belegt die rendererunabhängige Truth-Grenze, nicht die hier geplante
Persistence- oder Merge-Fähigkeit.

## 11. Research-Unterstützung

- Der
  [Browser Voxel Runtime Reference Audit](../research/browser-voxel-runtime-reference-audit-v1.md)
  unterstützt deterministische Basis plus persistierte Deltas sowie eine eigene
  Authority-/Persistence-Grenze.
- Der
  [Planet LOD & Streaming Reference Audit](../research/planet-lod-streaming-reference-audit-v1.md)
  verlangt Seed, Algorithmusversion, Parameter und Editjournal für
  rekonstruierbare Planetenregionen.
- Der
  [Voxel Meshing, Destruction and Asset Audit](../research/voxel-meshing-destruction-asset-audit-v1.md)
  unterstützt Base-Hash, sparse Edits, Provenance und getrennte abgeleitete
  Produkte.

Keiner dieser Audits beweist einen sicheren Online-/Offline-Merge. Externe
Persistence- oder Networking-Patterns werden nicht als beschlossen behandelt.

## 12. Spätere Evidence

- identisches Template plus identische Seeds/Versionen erzeugt dieselbe
  adressierte Basis,
- Save/Load rekonstruiert Semantic State und Deltas ohne Rendercache,
- unbekannte Versionen und fehlende IDs scheitern strukturiert,
- Migrationen sind deterministisch und verändern ihre Quelle nicht,
- ein fehlgeschlagener Import erzeugt keine teilweise Online-Instanz,
- erfolgreicher Import erhält Stable IDs und protokolliert jedes Remapping,
- Offline-Änderungen nach Import erscheinen nicht still in der Online-Instanz,
- Three.js- und Workerzustand beeinflussen keinen persistenten Hash.

## 13. Offene Entscheidungen

- konkrete kanonische Serialisierungs- und Speichertechnologie,
- Snapshot-, Journal-, Checkpoint- und Delta-Kompaktionsstrategie,
- Paketierung und Signatur eines importierbaren Instance-Snapshots,
- globale ID-Kollisions- und Remapping-Policy,
- genaue Story-Normalisierung,
- Umgang mit der privaten Instanz nach erfolgreichem Import,
- Server-/Host-Authority- und Deploymentmodell,
- vollständig bidirektionaler Offline-/Online-Merge.

Die letzte Fähigkeit bleibt ausdrücklich Research und ist kein impliziter Teil
des geplanten einseitigen Imports.
