# Hestia Worldgen, Editor and Authoring Specification

| Feld | Wert |
|---|---|
| Dokument-ID | HESTIA-WEA-SPEC |
| Version | v1.0 |
| Status | Baseline Specification |
| Datum | 2026-08-12 |
| Repository-Stand | GitHub-SHA 15f3550 |
| Sprache | Deutsch |
| Normative Begriffe | MUST, MUST NOT, SHOULD, SHOULD NOT, MAY |
| Statusklassen | ACCEPTED, PROPOSED, OPEN |

## 0. Zweck und Leserführung

Dieses Dokument definiert den technischen Vertrag für prozedurale Hestia-Welten, Städte, Assets, Laufzeit-Authoring, Editor-Operationen, Validierung, Persistenz und reproduzierbare visuelle Evidenz. Es übersetzt die Hestia-Designsprache in Datenmodelle und Betriebsregeln, die Generatoren, Editoren, Importer, Renderer, Simulation, QA und menschliche Freigaben gemeinsam einhalten können.

Die Spezifikation ist absichtlich strenger als eine Ideensammlung. Jede Regel ist mit einer Statusklasse versehen:

- **[ACCEPTED]** ist eine bestätigte Projektentscheidung oder ein bereits verbindlicher Laborvertrag.
- **[PROPOSED]** ist ein präziser, implementierbarer Zielvertrag, der vor Produktverbindlichkeit noch durch Owner-Entscheid, Spike oder Benchmark bestätigt werden muss.
- **[OPEN]** bezeichnet eine ungelöste Produkt-, Architektur- oder Schwellenwertentscheidung. Eine OPEN-Aussage darf nicht stillschweigend als Implementierungsannahme behandelt werden.

Die Schlüsselwörter werden normativ verwendet:

- **MUST** oder **MUST NOT** bezeichnet eine harte Konformitätsbedingung.
- **SHOULD** oder **SHOULD NOT** bezeichnet die bevorzugte Lösung. Abweichungen benötigen dokumentierte Begründung und Evidenz.
- **MAY** bezeichnet eine erlaubte Option, die keine neue Autorität oder inkompatible Nebenwirkung erzeugen darf.

Kapitel 1 bis 6 definieren Autorität und Worldgen. Kapitel 7 bis 10 definieren Städte und Assets. Kapitel 11 bis 16 definieren Editor, Transaktionen, Reproduzierbarkeit und Persistenz. Kapitel 17 bis 20 definieren Validierung, Evidenz, QA und KI-Vorschläge. Kapitel 21 bis 24 definieren Gates, offene Konflikte und Konformität.

## 1. Scope, Authority und Dokumentenrang

### 1.1 Geltungsbereich

**[ACCEPTED]** Diese Spezifikation gilt für:

- Hestia-Planet-, Regions-, Habitat-, Vegetations- und Gewässergenerierung,
- Siedlungs-, Stadt-, Straßen-, Infrastruktur-, Parzellen- und Gebäudegenerierung,
- importierte und intern erzeugte Voxel-Assets,
- Blender-Authoring und die HVOX-Laufzeitrepräsentation,
- Worldgen-, City-, Surface- und Asset-Editoren,
- Vorschau, Validierung, Freigabe, Commit, Undo, Redo und Konfliktauflösung,
- Chunking, Streaming, LOD, Persistenz und reproduzierbare Regeneration,
- Destruktion, Konnektivität und Wiederaufbau,
- visuelle Capture-Verträge, Beweispakete und QA-Gates,
- KI-unterstützte Vorschläge, sofern sie ausschließlich über dieselben validierten Verträge laufen.

**[PROPOSED]** Die Verträge SHOULD unabhängig davon gelten, ob ein Werkzeug als separates Developer-Tool, als In-Game-Editor oder als automatisierter Headless-Runner ausgeführt wird.

**[OPEN]** Welche Werkzeuge im ausgelieferten Player sichtbar sind und welche nur in einem getrennten Developer-Build verfügbar sind, ist eine Produktentscheidung. Sie ändert die Daten- und Transaktionsverträge dieses Dokuments nicht.

### 1.2 Normative Quellen und Vorrang

Diese Spezifikation ist Dokument 02 der Hestia-Designsprachen-Reihe:

1. [01 Hestia Visual Design Language](./01_Hestia_Visual_Design_Language_v1.md) definiert die visuelle Source of Truth, Formensprache, Materialwirkung, Komposition, Negativregeln und bildbezogene Abnahmekriterien.
2. Dieses Dokument 02 definiert technische Erzeugungs-, Daten-, Editor- und QA-Verträge.
3. [03 Hestia Evidence, Conflict and Migration Register](./03_Hestia_Evidence_Conflict_and_Migration_Register_2026-08-12.md) dokumentiert Quellen, Konflikte, Provenienz, Unsicherheiten und offene Entscheidungen.

**[ACCEPTED]** Bei einem Widerspruch über den sichtbaren Stil hat Dokument 01 Vorrang. Bei einem Widerspruch über den Quellenstatus oder eine ungelöste Aussage hat Dokument 03 Vorrang. Dieses Dokument darf keine visuelle Aussage umdeuten, die in Dokument 01 als Source of Truth markiert ist.

**[ACCEPTED]** Die aktuellen Hestia-Konzeptbilder sind die visuelle Source of Truth. Frühere Hinweise auf einen Low-Poly-Look sind überholt.

**[ACCEPTED]** Hestia verwendet als sichtbare Formensprache harte, kleine, quadratische Mikrovoxel. Die Welt MUST blockartig, fein gerastert, reich detailliert und aus diskreten kubischen Elementen aufgebaut erscheinen.

**[ACCEPTED]** Low Poly, Surface Nets, Marching Cubes, Dual Contouring oder vergleichbare geglättete beziehungsweise triangulierte Oberflächen MUST NOT als dominanter Hestia-Look verwendet werden. Solche Verfahren MAY intern für unsichtbare Hilfsrepräsentationen, Navigation, Kollision, Distanzfelder oder Analyse eingesetzt werden, sofern sie die sichtbare Source of Truth nicht verändern.

### 1.3 Auflösungsstatus

| Aussage | Status | Vertrag |
|---|---|---|
| 0,25 m Voxelgröße im bestehenden Laborprofil | ACCEPTED | MUST für reproduzierbare Vergleiche dieses Profils beibehalten werden. |
| 32 x 32 x 32 innere Chunk-Zellen mit 1-Zellen-Halo, also 34 x 34 x 34 Samples | ACCEPTED | MUST im akzeptierten Laborprofil gelten. |
| X-schnellste Speicherordnung, Uint8-Material-IDs, Luft = 0 | ACCEPTED | MUST im akzeptierten Laborprofil gelten. |
| 0,125 m Basisquantum im committed Adaptive-Microvoxel-Authority-Modul | ACCEPTED, scopespezifisch | MUST für dieses Modul und seine Golden Tests erhalten bleiben; beweist keine Produktintegration. |
| 0,125 m als lokales Hero-/Produktprofil | PROPOSED | MAY für Hero-Zonen, Assets oder sichtbare Oberflächenschalen untersucht werden. |
| 0,125 m als universelle Weltauflösung | OPEN | MUST NOT ohne Speicher-, Streaming-, Destruktions- und Browser-Benchmark festgeschrieben werden. |
| Eine einzige universelle Voxelgröße für Planet, Städte und Assets | OPEN | Es existiert noch keine bestätigte Produktentscheidung. |

**[ACCEPTED]** Dokumentation, Tools und UI MUST klar zwischen dem akzeptierten 0,25-m-Laborprofil, dem scopespezifisch akzeptierten 0,125-m-Adaptive-Authority-Vertrag, dem noch vorgeschlagenen 0,125-m-Hero-/Produktprofil und der offenen universellen Produktauflösung unterscheiden.

## 2. Begriffe und konzeptionelles Modell

### 2.1 Kernbegriffe

| Begriff | Definition |
|---|---|
| World Graph | Kanonischer Graph planetarer und regionaler Merkmale, Abhängigkeiten, Seeds, Versionen und Besitzverhältnisse. |
| Voxel Authority | Kanonischer Zustand belegter, leerer oder unbekannter Zellen einschließlich Material, Metadaten und Editionsereignissen. |
| Feature Graph | Kanonischer Graph globaler oder chunkübergreifender Features wie Flüsse, Straßen, Brücken, Tunnel, Küsten, Bahntrassen und Versorgungsachsen. |
| Settlement Domain | Kanonische semantische Siedlungs- und Stadtdaten von Standort bis Gebäudeinstanz. |
| Asset Authority | Kanonische HVOX-Assets, Palette, Materialschlüssel, Anker, Sockets, Lizenzen und Importprovenienz. |
| Simulation Authority | Kanonischer Laufzeitzustand wie Schaden, Konnektivität, Inventare, Energie, Verkehr oder ökologische Dynamik. |
| Editor Session | Isolierte Authoring-Sitzung mit Basisrevision, Preview-Deltas, Locks, Validierung und Approval-Status. |
| Derived Product | Aus kanonischen Daten reproduzierbar erzeugtes Ergebnis, zum Beispiel Render-Mesh, LOD, Kollision, Navigation, Lichtdaten, Vorschaubild oder Suchindex. |
| Recipe | Versionierte, geschlossene, validierbare Beschreibung einer Erzeugungsabsicht. |
| Manifest | Versionierter Ausführungs- und Provenienzvertrag einer konkreten Generierung. |
| Control Skeleton | Vom Menschen gesetzte oder gesperrte Leitstruktur, die prozedurale Erzeugung bindend respektieren muss. |
| Proposal | Noch nicht angewendete, überprüfbare Änderung mit Basisrevision und vollständigem Delta. |
| Prepare | Vorbereitungsphase einer Mutation, in der Ziel, Locks, Auswirkungen, Validierung und Approval ermittelt werden. |
| CAS | Compare-and-Swap auf Basis einer erwarteten Revision oder eines erwarteten Hashes. |
| Unknown | Noch nicht geladener, nicht berechneter oder absichtlich ausgelassener Bereich. Unknown ist kein Air. |
| Air | Kanonisch bekannte leere Zelle. |
| Missing Coverage | Fehlende Abdeckung eines erwarteten Datenprodukts. Sie ist ein Fehlerzustand oder eine explizite Lücke, keine leere Welt. |

### 2.2 Autoritätsregel

**[ACCEPTED]** Für jeden semantischen Zustand MUST genau eine aktive Autorität existieren. Mehrere Darstellungsebenen dürfen denselben Zustand lesen, aber nicht unabhängig kanonisch verändern.

**[ACCEPTED]** Abgeleitete Produkte MUST aus kanonischen Daten und versionierten Parametern reproduzierbar neu erzeugbar sein.

**[ACCEPTED]** Kein Render-Mesh, GLB-Export, Screenshot, LOD-Proxy, Navigationsmesh oder Editor-Cache darf zur stillen zweiten Wahrheit werden.

**[PROPOSED]** Jede kanonische Entität SHOULD folgende Basismetadaten besitzen:

- stabile ID,
- Schema-ID und Schema-Version,
- Owner-Domain,
- Erzeuger und Erzeugerversion,
- Quell- und Parameter-Hashes,
- räumlicher Bezug,
- Basisrevision und aktuelle Revision,
- Provenienzverweise,
- Lock- und Approval-Status,
- Tombstone- oder Gültigkeitszustand.

## 3. Kanonische und abgeleitete Daten

### 3.1 Zuständigkeitstabelle

| Datenklasse | Kanonisch | Abgeleitet | Schreibautorität |
|---|---|---|---|
| Planetare Höhentendenz, Landmasse, Ozeanmaske | World Graph und Terrain-Felder | Render-LOD, Karten, Vorschau | Worldgen |
| Fluss-, Küsten- und Entwässerungstopologie | Feature Graph | Wasser-Mesh, Schaum, Navigation | Hydrologie |
| Voxelbelegung und Material-ID | Voxel Authority | Greedy-Mesh, AO, Kollision | Voxel-World |
| Biome, Habitat und Eignungsfelder | World Graph | Heatmaps, Scatter-Instanzen | Ecology |
| Baum- oder Vegetationsinstanz | Feature Graph oder Asset Instance Store | Renderinstanz, Schattenproxy | Ecology oder Editor |
| Stadtstandort, Distrikt, Straße, Parzelle, Gebäudeabsicht | Settlement Domain | Mesh, Verkehrsgraph-Cache, UI | Settlement |
| Gebäude- und Prop-Geometrie | HVOX Asset Authority plus Placement | GLB, Render-Mesh, Kollision | Asset Pipeline |
| Schaden und Connectivity | Simulation Authority plus Voxel-Deltas | Rigid Bodies, Debris-Mesh | Simulation |
| Editor-Preview | Editor Session | Preview-Mesh, Diff-Overlay | Session |
| Commit-Historie | Event Store oder Revision Store | Timeline, Undo-Index | Transaction Service |
| Visuelles Capture | Evidence Store | Thumbnails, Metriken | QA Runner |

### 3.2 Regeln für Derived Products

**[ACCEPTED]** Ein Derived Product MUST mindestens besitzen:

- sourceRevision oder sourceHash,
- generatorId und generatorVersion,
- parameterHash,
- outputHash,
- coverage oder räumlichen Bereich,
- buildTimestamp als nichtdeterministische Metadaten außerhalb des Inhalts-Hashes,
- staleStatus.

**[ACCEPTED]** Ein abgeleitetes Produkt mit veralteter sourceRevision MUST als stale markiert werden und darf nicht still als aktuell gelten.

**[PROPOSED]** Stale Derived Products MAY kurzfristig für eine responsive Vorschau angezeigt werden, wenn die UI die Veraltung deutlich kennzeichnet und keinen Commit daraus ableitet.

**[ACCEPTED]** Unknown, Pending, Missing Coverage und Air MUST getrennte Zustände sein. Ein Lader, Generator oder Mesher MUST Unknown nicht als Air serialisieren.

### 3.3 Kanonische Mutationsgrenze

**[PROPOSED]** Jede Mutation SHOULD genau eine primäre Owner-Domain adressieren. Domänenübergreifende Änderungen SHOULD als atomarer Multi-Domain-Plan vorbereitet und dann gemeinsam committed werden.

**[PROPOSED]** Der Prepare-Schritt MUST alle betroffenen kanonischen Datensätze, abgeleiteten Invalidierungen, Locks, Approval-Stufen und erwarteten Folgejobs ausweisen.

## 4. Räumliche Skalen und Koordinaten

### 4.1 Macro, Meso, Micro und Nano

| Skala | Zweck | Typische Inhalte | Normativer Hinweis |
|---|---|---|---|
| Macro | Planetare und regionale Lesbarkeit | Kontinente, Inselketten, Ozeane, große Gebirge, Klima, Wasserscheiden, Stadtregionen | MUST zuerst strukturelle Plausibilität herstellen. |
| Meso | Landschafts- und Distriktkomposition | Täler, Plateaus, Flusskorridore, Küstenbuchten, Waldgruppen, Stadtbezirke, Verkehrskorridore | MUST wiedererkennbare Motive und Pfade formen. |
| Micro | Spielraum und Hestia-Formensprache | Stufen, Felskanten, Wurzeln, Kronen, Ufer, Straßenmodule, Fassaden, Props | MUST die harte quadratische Mikrovoxel-Sprache sichtbar tragen. |
| Nano | Material- und Beleuchtungsvariation | Face-Varianten, AO, Nässe, Farbrolle, Emission, kleine Dekoration | MUST NOT eine unabhängige Geometriewahrheit erzeugen. |

**[PROPOSED]** Macro-Entscheidungen SHOULD in kilometer- bis planetarer Größenordnung stabil sein. Meso-Entscheidungen SHOULD auf Regions-, Chunkgruppen- und Distriktebene stabil sein. Micro-Entscheidungen SHOULD an der lokalen Voxel- und Modulauflösung gebunden sein. Nano-Entscheidungen SHOULD überwiegend shader-, palette- oder facebasiert sein.

**[ACCEPTED]** Feine Details dürfen die Silhouette, Entwässerung, Straßentopologie oder begehbare Geometrie höherer Skalen nicht unkontrolliert überschreiben.

### 4.2 Koordinatenräume

**[PROPOSED]** Das System SHOULD folgende explizite Koordinatenräume verwenden:

- Planet Space: doppelte Präzision oder feste planetare Ganzzahlkoordinaten.
- Region Space: lokaler Ursprung für robuste Authoring- und Simulationsoperationen.
- Chunk Space: ganzzahlige Chunk-Koordinaten.
- Voxel Space: ganzzahlige Zellkoordinaten innerhalb eines Profils.
- Asset Local Space: HVOX-lokale ganzzahlige Koordinaten.
- City Local Space: lokaler Stadt- oder Distriktursprung für Planungsgeometrie.
- Render Space: kamera- oder origin-shift-bezogener temporärer Raum.

**[ACCEPTED]** Kanonische IDs und Geometrie MUST NOT von Render-Origin-Shifts abhängen.

**[PROPOSED]** Transformationsketten MUST versioniert und eindeutig sein. Eine Serialisierung SHOULD den Quellraum und Zielraum explizit angeben.

**[PROPOSED]** Rotationen für Voxel-Assets SHOULD auf eine definierte diskrete Menge begrenzt werden, sofern keine verlustfreie Revoxelisierung erfolgt.

**[ACCEPTED]** Freies nichtuniformes Skalieren kanonischer Mikrovoxel-Geometrie MUST NOT stattfinden.

### 4.3 Zell- und Chunkordnung

**[ACCEPTED]** Das akzeptierte Laborprofil verwendet:

- cellSizeMeters = 0.25,
- innerChunkSize = [32, 32, 32],
- haloCells = 1,
- sampleSize = [34, 34, 34],
- materialType = uint8,
- airMaterialId = 0,
- Speicherordnung mit X als schnellster Achse.

**[PROPOSED]** Andere Profile MUST eine eigene profileId, cellSizeMeters, Chunkabmessung, Materialbreite, Halo-Regel und Interoperabilitätsgrenze deklarieren.

**[OPEN]** Ob Planeten-Chunks überall dieselbe innere Zellzahl, dieselbe metrische Zellgröße oder eine hierarchische Profilfamilie verwenden, ist offen.

## 5. IDs, Seeds, Determinismus und Versionen

### 5.1 Stabile Identitäten

**[PROPOSED]** Alle langlebigen Entitäten MUST stabile, nicht positionsabhängig neu nummerierte IDs besitzen. Dies umfasst mindestens:

- worldId,
- bodyId,
- regionId,
- chunkId,
- featureId,
- riverId,
- roadId,
- districtId,
- blockId,
- parcelId,
- buildingId,
- assetId,
- materialKey,
- editorCommandId,
- eventId,
- captureId,
- issueId.

**[PROPOSED]** IDs SHOULD aus einem dokumentierten Namespace, Entitätstyp und einer stabilen Quelle entstehen. Hash-basierte IDs MUST Kollisionsbehandlung und kanonische Eingabeordnung definieren.

**[ACCEPTED]** Eine Änderung der Chunk-Ladefolge, Workeranzahl oder Kameraposition darf stabile Entitäts-IDs nicht verändern.

### 5.2 Seed-Hierarchie

**[PROPOSED]** Seeds SHOULD hierarchisch abgeleitet werden:

1. worldSeed,
2. bodySeed = H(worldSeed, bodyId, bodyGeneratorVersion),
3. regionSeed = H(bodySeed, regionId, regionGeneratorVersion),
4. stageSeed = H(regionSeed, stageId, stageVersion),
5. entitySeed = H(stageSeed, stableEntityId),
6. variationSeed = H(entitySeed, variationChannel).

**[PROPOSED]** H bezeichnet eine festgelegte, plattformübergreifend reproduzierbare Hashfunktion mit kanonischer Bytekodierung. Name, Version und Byteordnung MUST im Manifest stehen.

**[ACCEPTED]** Zufall MUST aus expliziten Seeds stammen. wall clock, frame count, Worker-Timing, Objektadresse, Map-Iterationsreihenfolge, Kamera, Sichtbarkeit und Anfragefolge MUST NOT Seeds beeinflussen.

### 5.3 Deterministische Ausführung

**[PROPOSED]** Ein Generator gilt als deterministisch, wenn identische:

- kanonische Inputs,
- Schema- und Generatorversionen,
- Seeds,
- Profile,
- Locked Controls,
- Plattformvertrag

denselben kanonischen Output-Hash erzeugen.

**[PROPOSED]** Numerisch sensible Kernschritte SHOULD Fixed-Point, Ganzzahlarithmetik oder explizit quantisierte Werte verwenden.

**[PROPOSED]** Ungeordnete Mengen MUST vor hash-, ID- oder outputrelevanter Verarbeitung stabil sortiert werden.

**[PROPOSED]** Parallel ausgeführte Kandidaten MAY in beliebiger Reihenfolge berechnet werden, aber ihre Auswahl und Zusammenführung MUST stabil sortiert und deterministisch sein.

**[PROPOSED]** Jeder Stage-Output MUST einen contentHash und optional einen semanticHash besitzen. Der contentHash umfasst die kanonische Serialisierung. Der semanticHash MAY transportirrelevante Metadaten auslassen.

**[OPEN]** Die verbindliche Hashfunktion und das exakte kanonische Serialisierungsformat sind noch festzulegen.

## 6. Worldgen-Layerordnung und Stage-Verträge

### 6.1 Verbindliche Layerordnung

**[PROPOSED]** Die Worldgen-Pipeline MUST in folgender logischer Ordnung arbeiten:

1. Contract Freeze und Manifestaufbau
2. Planetare Macro-Form und Terrain-Grundfeld
3. Hydrologie und Küsten
4. Authored Control Skeleton und Reservierungen
5. Terrain-Constraints und lokale Formmotive
6. Klima-, Biome-, Habitat- und Eignungsfelder
7. Feature Graph für globale und chunkübergreifende Strukturen
8. Vegetationsökologie und Cluster
9. Siedlungsstandort, Infrastruktur und City Skeleton
10. Distrikte, Straßen, Blöcke und Parzellen
11. Gebäudekits, Landmarken, Props und Asset-Platzierung
12. Voxel-Materialisierung
13. Abgeleitete Produkte, LOD, Kollision, Navigation und Renderdaten
14. Validierung, visuelle Evidenz und menschliche Freigabe
15. Publikation, Persistenz und Laufzeitereignisse

**[PROPOSED]** Ein später Stage MAY einen früheren Stage nur über einen deklarierten Constraint-Rückkanal beeinflussen. Er MUST NOT frühere kanonische Outputs still überschreiben.

**[PROPOSED]** Rückkopplungsschleifen wie Straße zu Terrain oder Stadt zu Hydrologie MUST als begrenzte, versionierte Iteration mit maximaler Iterationszahl und Konvergenzkriterium modelliert werden.

### 6.2 Einheitlicher Stage Contract

Jeder Stage SHOULD mindestens den folgenden Vertrag implementieren:

| Feld | Bedeutung |
|---|---|
| stageId | Stabiler Stage-Name |
| stageVersion | Semantische Generatorversion |
| inputSchema | Erwartete Eingabeschemata |
| outputSchema | Erzeugte Ausgabeschemata |
| inputHashes | Hashes der konkreten Eingaben |
| seed | Expliziter Stage-Seed |
| coverage | Räumlicher und semantischer Bereich |
| authoredLocks | Unveränderbare Kontrollen |
| parameterSet | Kanonisch serialisierte Parameter |
| outputHash | Hash des kanonischen Outputs |
| diagnostics | Strukturierte Warnungen und Fehler |
| provenance | Quellen, Tools, Lizenzen und Reviewer |
| invalidates | Abgeleitete Produkte, die veralten |

**[PROPOSED]** Ein Stage MUST ohne versteckte globale Konfiguration ausführbar sein. Jede outputrelevante Konfiguration MUST im Manifest oder in referenzierten, gehashten Bundles enthalten sein.

### 6.3 Contract Freeze

Vor einer reproduzierbaren Generierung MUST ein WorldgenManifest vorbereitet werden. Der Freeze erfasst:

- Repositorystand und Branch,
- Welt-, Körper- und Regions-ID,
- Schema- und Generatorversionen,
- Seeds und Hashfunktion,
- Auflösungsprofil,
- Palette und Materialregister,
- BiomeRecipe- und CityStyleBundle-Versionen,
- Asset- und Kit-Bundle-Hashes,
- Locked Control Skeleton,
- erwartete Coverage,
- Quality- und Capture-Verträge,
- bekannte OPEN-Abweichungen.

**[ACCEPTED]** Eine Ausführung ohne versionierte Inputs darf als Exploration laufen, aber MUST NOT als reproduzierbarer Baseline-Artefakt veröffentlicht werden.

### 6.4 Macro-Terrain

**[PROPOSED]** Macro-Terrain MUST Land- und Wassermassen, primäre Höhenzüge, Becken, Plateaus, Inselgruppen, Küstenexposition und Wasserscheiden festlegen.

**[PROPOSED]** Macro-Formen SHOULD aus wenigen lesbaren Großmotiven bestehen und nicht aus hochfrequentem, gleichverteiltem Noise.

**[ACCEPTED]** Das Mikrovoxel-Raster ist die sichtbare Sprache, aber Macro-Silhouetten MUST aus Distanz klar und natürlich lesbar bleiben.

**[PROPOSED]** Globale oder planetare Parameter MAY ein Cube-Sphere- oder anderes Face-System verwenden. Die Seam-Regeln, Eckbehandlung, Metrik und Feature-Zuständigkeit MUST dann explizit dokumentiert werden.

**[OPEN]** Die endgültige Planetentopologie und Face-Projektion ist nicht in dieser Spezifikation festgelegt.

## 7. Hydrologie, Biome und Vegetation

### 7.1 Hydrologie als Topologie

**[PROPOSED]** Hydrologie MUST vor Biome-Detail, Vegetationsscatter und Stadtparzellierung berechnet werden.

**[PROPOSED]** Flüsse, Bäche, Seen, Feuchtgebiete, Küsten und Abflüsse MUST als zusammenhängender Feature Graph vorliegen, nicht nur als lokale Textur oder unabhängige Wasserflächen.

Ein RiverFeature SHOULD mindestens enthalten:

- riverId,
- sourceType und sourceFeatureId,
- sinkType und sinkFeatureId,
- geordnete Centerline-Segmente,
- Fließrichtung,
- Einzugsgebiet oder upstreamArea,
- Breiten- und Tiefenprofil,
- Gefälleprofil,
- Ufer- und Überschwemmungszone,
- Material- und Biomewirkung,
- Kreuzungen mit Straßen, Tunneln oder Infrastruktur,
- chunkübergreifende Ownership,
- sourceRevision und outputHash.

**[PROPOSED]** Hydrologische Validierung MUST prüfen:

- jeder gerichtete Kanal besitzt einen gültigen Abfluss oder einen expliziten geschlossenen Sink,
- keine unzulässige bergauf gerichtete Strecke außerhalb definierter Toleranz,
- keine unerklärten Unterbrechungen an Chunk- oder Face-Grenzen,
- konsistente Breiten-, Höhen- und Flussordnungsübergänge,
- eindeutige Zuständigkeit für grenzüberschreitende Features,
- keine Siedlungs- oder Straßenplatzierung in gesperrten Flut- oder Kanalzonen ohne genehmigte Konstruktion.

**[PROPOSED]** Wasseroberflächen und Ufer MUST die harte Mikrovoxel-Sprache der Umgebung respektieren. Eine glatte Wasseroberfläche MAY als Materialfläche eingesetzt werden, darf die blockartige Ufer- und Unterwasserstruktur aber nicht verschleiern.

### 7.2 Biome und Habitat

**[PROPOSED]** Ein Biome ist nicht nur eine Farbpalette. Es MUST eine Kombination aus Terrainmotiven, Hydrologie, Klima, Materialrollen, Vegetationsgrammatik, Dichteverteilung, Landmarken, Siedlungseignung und Negativregeln definieren.

**[PROPOSED]** Biome-Grenzen SHOULD aus kontinuierlichen Eignungs- und Klima-Feldern entstehen, dürfen aber in Mikrovoxel-Materialisierung klare lokale Lesbarkeit besitzen.

**[PROPOSED]** Habitat-Felder SHOULD mindestens Feuchte, Höhe, Exposition, Hangneigung, Bodentyp, Gewässernähe, Störung, Salinität und Siedlungsdruck berücksichtigen, soweit für das Rezept relevant.

**[ACCEPTED]** Gleichmäßiger Zufalls-Scatter über die gesamte Fläche MUST NOT die primäre Vegetationsmethode sein.

### 7.3 Vegetationsökologie

**[PROPOSED]** Vegetation MUST aus Archetypen und Clustern erzeugt werden. Ein VegetationArchetype SHOULD enthalten:

- stableArchetypeId,
- HVOX-Asset oder prozedurale Grammatik,
- Größen- und Altersklassen,
- Kronenprofil,
- Stamm- und Wurzelanker,
- belegtes Volumen,
- Habitatkurven,
- Nachbarschafts- und Ausschlussregeln,
- Clusterrolle,
- saisonale oder funktionale Varianten,
- LOD- und Destruktionsprofil.

**[PROPOSED]** VegetationCluster SHOULD Kern, Begleitarten, Rand, Lichtung, Dichtegradient, Mindestabstände und Korridore definieren.

**[PROPOSED]** Die Platzierung MUST deterministisch aus Eignungsfeldern, stabilen Kandidaten und Seeds erfolgen. Sie MUST unabhängig von Kamera, Sichtbarkeit und Chunk-Ladefolge sein.

**[PROPOSED]** Große Hestia-Bäume SHOULD als lesbare Archetypen mit breiten, blockig abgestuften Kronen, hängenden Elementen, sichtbaren Stämmen und Wurzelmotiven modelliert werden. Die genaue visuelle Ausprägung richtet sich nach Dokument 01.

### 7.4 Beispiel: BiomeRecipe

Das folgende YAML ist ein Referenzformat. Feldnamen und Enum-Werte sind **[PROPOSED]**. Die visuelle Absicht ist an Dokument 01 gebunden.

~~~yaml
schema: hestia.worldgen/BiomeRecipe
schemaVersion: 1
recipeId: biome.hestia.coastal_luminous_savanna
displayName: Coastal Luminous Savanna
status: proposed

authority:
  ownerDomain: ecology
  sourceDocument: 01_Hestia_Visual_Design_Language_v1.md
  sourceCommit: 15f3550

compatibility:
  worldgenApi: 1
  materialRegistry: hestia.palette.core.v1
  voxelProfiles:
    accepted:
      - lab-025m-v1
    candidates:
      - local-0125m-hero-v0

seeds:
  derivation: hestia-seed-v1
  namespace: biome.coastal_luminous_savanna

macro:
  climateBands:
    temperature: [0.65, 0.92]
    precipitation: [0.35, 0.82]
  elevationNormalized: [0.00, 0.68]
  coastalDistanceMeters: [0, 12000]
  forbiddenTerrainTags:
    - permanent_ice
    - deep_volcanic_ash

meso:
  terrainMotifs:
    - id: stepped_limestone_mesa
      weight: 0.28
      slopeRangeDegrees: [8, 62]
    - id: open_green_basin
      weight: 0.32
      slopeRangeDegrees: [0, 18]
    - id: braided_freshwater_corridor
      weight: 0.22
    - id: turquoise_coastal_shelf
      weight: 0.18
  connectivity:
    habitatCorridorMinWidthMeters: 24
    clearingNetwork: true

hydrology:
  requiresDrainageGraph: true
  allowedWaterFeatures:
    - ocean
    - lagoon
    - river
    - spring
    - wetland
  riparianInfluenceMeters: [12, 160]
  floodplainPolicy: protect
  shoreline:
    form: stepped_microvoxel
    shallowWaterPaletteRole: water.shallow.turquoise
    deepWaterPaletteRole: water.deep.blue

materials:
  paletteBundle: hestia.palette.coastal-savanna.v1
  roleBindings:
    exposedRock: rock.limestone.warm
    shadedRock: rock.limestone.cool
    soil: soil.green-brown
    drySoil: soil.sand-light
    grass: flora.grass.luminous-green
    wetEdge: flora.wet-edge.teal
  faceVariation:
    method: deterministic_palette_variant
    maxLocalContrast: owner-defined

vegetation:
  placementModel: habitat_cluster_v1
  archetypes:
    - archetypeId: tree.umbrella.canopy-a
      role: dominant_canopy
      densityBand: [0.10, 0.34]
      habitat:
        moisture: [0.28, 0.78]
        slopeDegrees: [0, 28]
      cluster:
        radiusMeters: [14, 46]
        members: [1, 7]
        clearingProbability: 0.24
    - archetypeId: plant.teal-spire.a
      role: chromatic_accent
      densityBand: [0.04, 0.18]
      habitat:
        moisture: [0.45, 1.00]
    - archetypeId: flower.purple-cluster.a
      role: secondary_accent
      densityBand: [0.02, 0.12]
  exclusion:
    roadClearanceMeters: 3
    authoredReservationPolicy: hard

settlementSuitability:
  baseScore: 0.48
  prefer:
    - gentle_slope
    - freshwater_access
    - sheltered_coast
  avoid:
    - active_channel
    - protected_wetland
    - unstable_cliff

visualContract:
  formLanguage: hard_square_microvoxels
  forbiddenLooks:
    - low_poly
    - surface_nets
    - marching_cubes
    - dual_contouring_visible_surface
    - smooth_terrain_proxy_as_dominant_look
  referenceSet:
    - hestia-current-concept-source-of-truth
  capturePresetIds:
    - biome-wide-day-v1
    - biome-ground-day-v1
    - biome-water-edge-day-v1

lod:
  silhouettePolicy: stepped_block_preserving
  materialRolePreservation: true
  proxyMayBecomeSmooth: false

validation:
  requiredChecks:
    - hydrology.connected
    - biome.coverage
    - vegetation.anchor_valid
    - vegetation.no_authored_overlap
    - visual.no_smooth_dominant_surface

provenance:
  createdBy: project-research
  createdAt: 2026-08-12
  sourceHashes: {}
  approval:
    state: pending
    reviewerIds: []
~~~

### 7.5 Recipe-Validierung

**[PROPOSED]** BiomeRecipe-Schemata SHOULD geschlossen sein. Unbekannte Felder MUST einen Schemafehler auslösen, sofern sie nicht in einem expliziten extension-Namespace liegen.

**[PROPOSED]** Jede referenzierte Materialrolle, Asset-ID, Capture-Preset-ID und Validator-ID MUST auflösbar sein.

**[PROPOSED]** Ein Rezept ohne sourceDocument, sourceCommit, voxelProfiles und visualContract MUST NOT als publishable gelten.

## 8. Authored Control Skeleton

### 8.1 Zweck

Das Authored Control Skeleton stellt menschliche Absicht über prozedurale Füllung. Es enthält keine beliebigen Renderdetails, sondern langlebige Leitstrukturen und Reservierungen.

**[PROPOSED]** Ein Control Skeleton MAY enthalten:

- geschützte Küstenlinie oder Flussachse,
- Landmarkenstandort und Sichtkorridor,
- Stadtgrenze und Wachstumsgrenze,
- Distriktanker,
- Hauptstraße, Bahn-, Transit- oder Versorgungskorridor,
- Brücken- und Tunnelportal,
- Raumhafen- oder Industrieareal,
- Naturreservat und No-Build-Zone,
- Höhenband, Terrassenkante oder maximale Hangänderung,
- verpflichtende öffentliche Plätze und Grünachsen,
- gesperrte Bestandsgebäude oder importierte Assets,
- Capture-relevante Hero-Komposition.

### 8.2 Reservation Contract

Jede Reservation SHOULD enthalten:

- reservationId,
- ownerId,
- sourceType,
- geometry und coordinateSpace,
- reservationKind,
- priority,
- hard oder soft,
- allowedOperations,
- excludedEntityTypes,
- verticalRange,
- startRevision und optional endRevision,
- reason,
- provenance,
- approvalState.

**[PROPOSED]** Hard Reservations MUST von Generatoren respektiert werden. Soft Reservations MAY bei klar dokumentierter Kostenfunktion verletzt werden, müssen dann aber ein Issue erzeugen.

**[PROPOSED]** Ein Generator MUST Locked Controls unverändert in seinen Output übernehmen oder mit einem harten Fehler abbrechen. Er darf sie nicht still verschieben.

**[PROPOSED]** Generatoren SHOULD den Abstand zu Control-Elementen als Kostenfeld statt als nachträglichen Reparaturschritt berücksichtigen.

### 8.3 Änderungsregeln

**[PROPOSED]** Änderungen an einem Control Skeleton sind eigenständige Editor-Commands mit Preview, Auswirkungsanalyse und Approval.

**[PROPOSED]** Eine Control-Änderung MUST alle abhängigen Worldgen- und Settlement-Stages invalidieren, aber vorhandene player-authored oder simulation-authored Deltas schützen.

**[OPEN]** Wie weit eine Control-Änderung bereits publizierte Stadt- und Simulationszustände automatisch migrieren darf, ist offen.

## 9. Stadt- und Siedlungsgenerierung

### 9.1 Grundprinzip

**[PROPOSED]** Stadtgenerierung MUST semantik-first und constraints-first arbeiten. Gebäude dürfen nicht als unabhängiger Objekt-Scatter auf freier Fläche entstehen.

**[PROPOSED]** Die kanonische Reihenfolge lautet:

1. CitySite
2. TerrainConstraintField
3. AuthoredReservation und City Control Skeleton
4. DistrictIntent
5. RoadGraph und InfrastructureGraph
6. Block und Parcel
7. DistrictPlan und DevelopmentEnvelope
8. BuildingIntent und BuildingInstance
9. ServiceGraph, Mobility und Public Space
10. ApprovedCityPlan
11. Voxel-Materialisierung und Derived Products

### 9.2 CitySiteV1

CitySiteV1 SHOULD mindestens enthalten:

- cityId,
- worldId, bodyId und regionId,
- lokale Koordinatenbasis,
- Site-Grenze,
- Terrain- und Hydrologie-Referenzen,
- klimatische und biome Eignung,
- Ressourcen- und Infrastrukturanschlüsse,
- Wachstumsgrenzen,
- Gefahrenzonen,
- geschützte Natur- und Kulturzonen,
- sourceRevision und provenance.

**[PROPOSED]** Ein Standort MUST vor Distrikt- oder Straßengenerierung auf Hang, Hochwasser, Küstenerosion, geologische Sperren, bestehende Features und Anschlussfähigkeit validiert werden.

### 9.3 TerrainConstraintField

Das TerrainConstraintField SHOULD folgende Felder oder äquivalente Funktionen bereitstellen:

- elevation,
- slope,
- curvature,
- cutFillCost,
- buildability,
- hydrologyExclusion,
- protectedHabitat,
- foundationSuitability,
- visibilityImportance,
- authoredLockDistance,
- infrastructureAccess,
- hazard.

**[PROPOSED]** Straßen, Parzellen und Gebäude MUST dieselbe versionierte Constraint-Basis referenzieren. Separate, divergierende lokale Kopien sind nicht zulässig.

### 9.4 DistrictIntentV1

DistrictIntentV1 SHOULD enthalten:

- districtId und cityId,
- stable archetypeId,
- boundary oder targetInfluence,
- population und use mix,
- densityBand und heightBand,
- publicSpaceTargets,
- mobilityModeTargets,
- greenCoverageTargets,
- infrastructureDemand,
- skylineRole,
- landmarkRelationship,
- styleBundleId,
- authoredLocks,
- growthPhase,
- approvalState.

**[PROPOSED]** Distriktgrenzen MAY weich generiert werden, müssen vor Publikation jedoch eine deterministische kanonische Geometrie besitzen.

### 9.5 RoadGraph

Ein RoadGraph MUST als Graph und nicht nur als Mesh vorliegen. Jeder Knoten und jede Kante SHOULD enthalten:

- stabile ID,
- roadClass,
- geordnete Referenzlinie,
- vertikales Profil,
- Querschnittsprofil,
- Fahr-, Geh-, Rad-, Grün- und Servicebänder,
- Anschlussregeln,
- Vorfahrt oder Hierarchie,
- Brücken-, Tunnel- oder Stützwandtyp,
- maximale Neigung und Krümmung,
- Clearance-Envelope,
- Parcel-Frontage-Relevanz,
- ownerDistrict und sourceRevision.

**[PROPOSED]** Straßen MUST topologisch verbunden, geometrisch valide und semantisch klassifiziert sein.

**[PROPOSED]** Sackgassen, unverbundene Inseln und Gradientenüberschreitungen dürfen nur vorkommen, wenn sie durch Straßentyp oder authored exception erlaubt sind.

### 9.6 InfrastructureGraph

**[PROPOSED]** Energie, Wasser, Abwasser, Daten, Transit, Güter und gegebenenfalls Luft- oder Raumverkehr SHOULD als explizite Graphen modelliert werden.

**[PROPOSED]** Eine visuell sichtbare Infrastruktur MUST mit ihrer semantischen Verbindung übereinstimmen. Dekorative Rohre, Schienen oder Leitungen dürfen keine falsche Funktionsaussage erzeugen.

### 9.7 Blocks und Parcels

BlockV1 SHOULD enthalten:

- blockId,
- boundary,
- begrenzende roadEdgeIds,
- buildableMask,
- publicSpaceMask,
- terrainProfile,
- districtId,
- subdivisionSeed,
- sourceRevision.

ParcelV1 SHOULD enthalten:

- parcelId,
- parentBlockId,
- polygon oder rasterisierte kanonische Fläche,
- frontageEdgeIds,
- accessPoints,
- buildableEnvelope,
- heightBand,
- useIntent,
- serviceConnections,
- protectedCells,
- lineage.

**[PROPOSED]** Parcel-Lineage MUST bei Split, Merge oder Resubdivision nachvollziehbar bleiben.

**[PROPOSED]** Jede bebaubare Parzelle MUST einen gültigen Zugang und eine gültige Frontage oder dokumentierte Sondererschließung besitzen.

### 9.8 BuildingIntent und BuildingInstance

BuildingIntent SHOULD enthalten:

- buildingId,
- parcelId,
- archetypeId,
- useMix,
- capacityTargets,
- footprintEnvelope,
- heightEnvelope,
- frontageRules,
- accessRules,
- structuralGridIntent,
- facadeGrammar,
- roofGrammar,
- vegetationIntegration,
- utilityDemand,
- landmarkRole,
- styleBundleId.

BuildingInstance SHOULD ergänzen:

- kitBundleHash,
- konkrete Module und Varianten,
- quantisierte Transforms,
- HVOX-Assetreferenzen,
- Materialbindungen,
- Eingänge und Sockets,
- Kollisions- und Navigationsreferenzen,
- DamageBinding,
- outputHash.

**[PROPOSED]** Gebäude MUST ihre Parzellenhülle, Straßen-Clearance, authored locks, Mindestzugang und Stilgrammatik einhalten.

### 9.9 ApprovedCityPlan

**[PROPOSED]** ApprovedCityPlan ist die Freigabegrenze zwischen generierter Planung und kanonischer Publikation. Er MUST enthalten:

- Manifest- und Input-Hashes,
- alle Entitäts-IDs und Schema-Versionen,
- vollständige Validierungsergebnisse,
- visuelle Capture-Referenzen,
- Approval-Level und Reviewer,
- akzeptierte Ausnahmen,
- erwartete Materialisierungs-Coverage,
- Publish-Revision.

**[PROPOSED]** Ohne ApprovedCityPlan darf eine Stadt als Preview oder Sandbox existieren, aber MUST NOT in die kanonische Weltpublikation übernommen werden.

### 9.10 Beispiel: CityStyleBundle

Das folgende YAML ist ein **[PROPOSED]** Referenzformat.

~~~yaml
schema: hestia.city/CityStyleBundle
schemaVersion: 1
bundleId: example:citystyle:hestia:gratia-coastal-v1
displayName: Gratia Coastal Metropolis
status: proposed
source:
  visualLanguage: 01_Hestia_Visual_Design_Language_v1.md
  evidenceRegister: 03_Hestia_Evidence_Conflict_and_Migration_Register_2026-08-12.md
  repositoryCommit: 15f3550

visualIdentity:
  formLanguage: hard_square_microvoxels
  era: 2200-2400
  principles:
    - optimistic_future
    - dense_nature_integration
    - readable_infrastructure
    - layered_public_realm
    - coastal_topographic_fit
  forbiddenLooks:
    - generic_low_poly
    - visible_surface_nets
    - smooth_featureless_megastructures
    - random_building_scatter
    - neon_cyberpunk_overload

districtArchetypes:
  - id: district.vertical_green_core
    densityBand: [0.72, 0.96]
    heightBandMeters: [36, 260]
    skylineRole: primary
    publicSpace:
      plazaFrequency: high
      greenTerraceCoverage: [0.22, 0.48]
  - id: district.terraced_residential
    densityBand: [0.38, 0.70]
    heightBandMeters: [12, 84]
    skylineRole: transition
  - id: district.clean_industry_spaceport
    densityBand: [0.20, 0.62]
    heightBandMeters: [8, 160]
    skylineRole: landmark_punctuated

streetGrammar:
  hierarchy:
    - class: transit_spine
      moduleId: street.transit-spine.v1
      minConnectivity: arterial
    - class: green_avenue
      moduleId: street.green-avenue.v1
    - class: local_shared
      moduleId: street.local-shared.v1
  requirements:
    continuousPedestrianNetwork: true
    continuousTransitNetwork: owner-defined
    treeAndWaterIntegration: true

buildingGrammar:
  kitBundleId: kit.gratia-architecture-v1
  massing:
    baseTypes:
      - stepped_tower
      - terraced_midrise
      - courtyard_block
      - infrastructure_hall
    repetitionControl:
      maxIdenticalAdjacency: owner-defined
      requireSilhouetteVariation: true
  facades:
    structuralReadability: true
    plantedDepthLayers: [2, 5]
    emissiveAccentRole: restrained_wayfinding
  roofs:
    greenRoofPreferred: true
    serviceEquipmentMustBeIntegrated: true

materials:
  paletteBundle: hestia.palette.gratia-city-v1
  roles:
    primaryStructure: architecture.light-mineral
    secondaryStructure: architecture.dark-metal
    glazing: architecture.cool-glass
    vegetation: flora.city-lush
    wayfinding: ui.cyan-restrained
    industrialSafety: accent.warm-yellow

infrastructure:
  transitModes:
    - pedestrian
    - bicycle
    - autonomous_road
    - rail
    - elevated_transit
    - water
  requiredReadableSystems:
    - mobility
    - water_management
    - energy
    - logistics

landmarks:
  allowed:
    - orbital_launch_tower
    - civic_vertical_garden
    - coastal_transit_hub
    - clean_industry_assembly_hall
  separationRule: skyline_role_and_view_corridor

vegetation:
  integrationMode: structural
  minimumRoles:
    - street_canopy
    - roof_garden
    - facade_planting
    - civic_park
    - water_edge_habitat
  noDecorativeStickerVegetation: true

validation:
  required:
    - city.road_graph_connected
    - city.parcel_access_valid
    - city.building_envelope_valid
    - city.public_space_targets
    - city.visual_style_contract
    - city.no_forbidden_look

approval:
  state: pending
  requiredLevel: A3
~~~

## 10. Asset-, Blender-, GLB- und HVOX-Vertrag

### 10.1 Autoritätsfluss

**[PROPOSED]** Der verbindliche Assetfluss lautet:

Blender oder andere Quellformate -> SourceScene Adapter -> normalisierte SourceScene -> HVOX Compiler -> HVOX plus Asset Manifest -> Derived GLB, Render-Mesh, Collision und Preview.

**[ACCEPTED]** Blender-Dateien und GLB-Dateien sind Authoring- oder Austauschquellen, nicht die Laufzeitautorität der Voxelwelt.

**[PROPOSED]** HVOX SHOULD die kanonische Laufzeit- und Importrepräsentation für voxelisierte Assets sein.

**[ACCEPTED]** Ein aus HVOX erzeugtes GLB ist ein Derived Product. Änderungen am GLB MUST NOT ohne expliziten Reimport und Neucompilierung die HVOX-Autorität überschreiben.

### 10.2 SourceScene

Eine normalisierte SourceScene SHOULD enthalten:

- sourceFileId und sourceHash,
- sourceFormat und Adapterversion,
- Nodes mit stabilen Pfaden,
- Meshes und primitive Gruppen,
- Materialslots und stabile Materialschlüssel,
- lokale und globale Transformationsmatrizen,
- Einheiten und Achsenkonvention,
- benannte Collections,
- Sockets, Anchors und Marker,
- Ausschluss- und Voxelisierungstags,
- Lizenz- und Urhebermetadaten.

**[PROPOSED]** Der Adapter MUST deterministisch sein. Gleiche Quelldatei, gleiche Adapterversion und gleiche Importoptionen müssen denselben SourceScene-Hash erzeugen.

### 10.3 Blender-Authoringregeln

**[PROPOSED]** Blender-Autoren SHOULD:

- metrische Einheiten oder klar deklarierte Umrechnung verwenden,
- Objekttransforms vor Export konsistent behandeln,
- Materialslots stabil benennen,
- Hestia-Materialrollen statt beliebiger Texturpfade referenzieren,
- Sockets und Anchors mit definierten Präfixen versehen,
- negative Skalierung und nichtuniforme Skalierung vermeiden,
- überlappende oder nichtmanifold Geometrie vor Voxelisierung kennzeichnen oder reparieren,
- visuelle Dekoration von funktionalen Kollisions- und Socketdaten trennen,
- Asset-Ursprung, Vorwärtsrichtung und Bodenanker explizit setzen.

**[PROPOSED]** Automatische Reparaturen MUST im AssetImportRecord protokolliert werden. Stille Reparaturen sind nicht zulässig.

### 10.4 HVOX-Paket

Ein HVOX-Paket SHOULD mindestens enthalten:

- magic und formatVersion,
- assetId und assetVersion,
- gridProfile,
- bounds und origin,
- dimensions in Zellen,
- palette oder MaterialKey-Tabelle,
- komprimierte Voxelbelegung,
- optionale Face- oder Variantendaten,
- Anchors und Sockets,
- Kollisions- und Connectivity-Metadaten,
- LOD-Referenzen,
- sourceHash und compilerHash,
- contentHash,
- Lizenz und Provenienz.

**[PROPOSED]** Materialreferenzen MUST über stabile MaterialKeys erfolgen. Lokale kompakte IDs MAY im Paket verwendet werden, benötigen aber eine eindeutige Mapping-Tabelle.

**[ACCEPTED]** Air ist Material-ID 0 im akzeptierten Laborprofil. Andere Profile MUST die Air-Semantik explizit und kompatibel deklarieren.

**[PROPOSED]** HVOX-Decoder MUST Bounds, Dimensionen, Materialreferenzen, Kompressionsblöcke, Hashes und Schema-Version validieren, bevor Daten kanonisch übernommen werden.

### 10.5 Voxelisierung

**[PROPOSED]** Voxelisierung MUST folgende Optionen versioniert festhalten:

- targetProfile,
- occupancyRule,
- surfaceThickness,
- solidFillRule,
- materialMapping,
- normal oder face quantization,
- anchorQuantization,
- transformBake,
- repairPolicy,
- hollowInteriorPolicy,
- thinFeaturePolicy.

**[PROPOSED]** Dünne Features unterhalb der Zielauflösung MUST nicht zufällig verschwinden. Der Compiler muss sie entweder nach deklarierter Regel erhalten, verstärken, ersetzen oder als Issue melden.

**[ACCEPTED]** Sichtbare Assetgeometrie MUST die harte quadratische Mikrovoxel-Sprache erhalten. Ein geglättetes Re-Meshing als primärer sichtbarer Output ist unzulässig.

### 10.6 Beispiel: AssetImportRecord

~~~json
{
  "schema": "hestia.asset/AssetImportRecord",
  "schemaVersion": 1,
  "recordId": "asset-import:2026-08-12:habitat-tree-umbrella-a:001",
  "status": "proposed",
  "assetId": "tree.umbrella.canopy-a",
  "source": {
    "format": "blend",
    "fileName": "umbrella_canopy_a.blend",
    "contentHash": "sha256:SOURCE_HASH",
    "repository": "project-repository",
    "commit": "15f3550",
    "licenseId": "project-owned",
    "authorIds": ["author:unknown"]
  },
  "adapter": {
    "id": "blender-source-scene",
    "version": "1.0.0",
    "optionsHash": "sha256:ADAPTER_OPTIONS_HASH",
    "sourceSceneHash": "sha256:SOURCE_SCENE_HASH"
  },
  "compiler": {
    "id": "hvox-compiler",
    "version": "1.0.0-proposed",
    "targetProfile": "lab-025m-v1",
    "options": {
      "occupancyRule": "conservative-surface-plus-solid-fill",
      "thinFeaturePolicy": "report-and-preserve-if-semantic",
      "materialMappingBundle": "hestia.palette.vegetation.v1",
      "anchorQuantization": "target-grid"
    },
    "optionsHash": "sha256:COMPILER_OPTIONS_HASH"
  },
  "transformContract": {
    "sourceUnits": "meter",
    "sourceUpAxis": "Z",
    "sourceForwardAxis": "-Y",
    "targetUnits": "voxel-cell",
    "nonUniformScale": false,
    "negativeScale": false,
    "bakedTransformHash": "sha256:TRANSFORM_HASH"
  },
  "materials": [
    {
      "sourceSlot": "bark_primary",
      "materialKey": "flora.wood.warm-dark"
    },
    {
      "sourceSlot": "canopy_primary",
      "materialKey": "flora.canopy.luminous-green"
    }
  ],
  "anchors": [
    {
      "anchorId": "root.primary",
      "kind": "world-placement",
      "positionCells": [64, 64, 0],
      "orientation": "axis-aligned"
    }
  ],
  "repairs": [],
  "validation": {
    "state": "pass",
    "issueIds": [],
    "validatorBundleHash": "sha256:VALIDATOR_HASH"
  },
  "outputs": {
    "hvoxHash": "sha256:HVOX_HASH",
    "manifestHash": "sha256:ASSET_MANIFEST_HASH",
    "derivedGlbHash": "sha256:GLB_HASH",
    "previewCaptureIds": ["capture:asset-tree-umbrella-a:day"]
  },
  "approval": {
    "requiredLevel": "A2",
    "state": "pending",
    "reviewerIds": []
  }
}
~~~

### 10.7 Importabnahme

**[PROPOSED]** Ein Assetimport MUST scheitern bei:

- fehlender oder inkompatibler Schema-Version,
- nicht auflösbarem MaterialKey,
- Hashfehler,
- ungültigen Bounds,
- ungültiger Dimension oder Datenlänge,
- unbekannter Lizenz,
- doppelter stabiler Asset-ID ohne explizite Versionierung,
- nicht quantisierbarem Pflichtanker,
- sichtbarer Ausgabe, die den verbotenen geglätteten Stil erzwingt.

**[PROPOSED]** Warnungen MAY für reparierbare Thin Features, hohe Voxelzahl, fehlende optionale LODs oder ungewöhnliche Pivotpositionen erzeugt werden. Ein Apply benötigt je nach Schweregrad explizite Bestätigung.

## 11. Editor-Architektur und Operationsmodell

### 11.1 Modus- und Oberflächenvertrag

**[PROPOSED]** Die Authoring-Plattform SHOULD dieselben kanonischen Datenverträge in unterschiedlichen fachlichen Modi darstellen:

| Modus | Primäre Autorität | Typische Werkzeuge |
|---|---|---|
| World | World Graph, Voxel Authority | Terrain, Hydrologie, Biome, Vegetation, Region, Chunk |
| Surface | Voxel Authority, Feature Graph | Material, Sculpt, Gewässerkante, Vegetationscluster, lokale Features |
| City | Settlement Domain | Site, Distrikt, Straße, Block, Parzelle, Gebäude, Infrastruktur |
| Asset | Asset Authority | Import, HVOX, Palette, Anchors, Sockets, LOD |
| Simulation | Simulation Authority | Schaden, Connectivity, Versorgung, Verkehr, Wiederaufbau |
| Evidence | Evidence Store | Capture, Diff, Metrik, Approval, Export |

**[PROPOSED]** Ein Modus darf die Sicht, Werkzeuge und Validatoren verändern, aber nicht die Bedeutung derselben kanonischen Entität.

**[PROPOSED]** Die Oberfläche SHOULD persistent folgende Bereiche anbieten:

- Viewport mit Render-, Debug- und Diff-Layern,
- Outliner oder Domain Tree,
- Inspector für kanonische und abgeleitete Felder,
- Tool Shelf für aktuelle Operation,
- Validation Panel und Issue Browser,
- History und Revision Timeline,
- Proposal, Preview, Prepare und Approval Status,
- Provenance und Source Inspector,
- Capture und Evidence Panel.

**[ACCEPTED]** Abgeleitete Ansichten MUST sichtbar als abgeleitet gekennzeichnet sein, wenn eine Verwechslung mit kanonischen Daten möglich ist.

### 11.2 Command Envelope

**[PROPOSED]** Jede schreibende Operation MUST als serialisierbarer EditorCommand vorliegen:

~~~json
{
  "schema": "hestia.editor/EditorCommand",
  "schemaVersion": 1,
  "commandId": "cmd:uuid",
  "sessionId": "session:uuid",
  "actorId": "user:stable-id",
  "toolId": "city.road.move-control-point",
  "toolVersion": "1.0.0",
  "ownerDomain": "settlement",
  "targetIds": ["road:gratia:main-004"],
  "coverage": {
    "coordinateSpace": "city-local",
    "bounds": [[0, 0, -20], [420, 180, 120]]
  },
  "baseRevision": "rev:city:00000421",
  "expectedTargetHashes": {
    "road:gratia:main-004": "sha256:BEFORE_HASH"
  },
  "parameters": {},
  "seed": "seed:explicit-if-stochastic",
  "authoredLocksObserved": [],
  "approvalIntent": "A2",
  "provenance": {
    "source": "human",
    "repositoryCommit": "15f3550"
  }
}
~~~

**[PROPOSED]** Das Command Envelope MUST alle outputrelevanten Parameter enthalten. Versteckter UI-State darf den kanonischen Output nicht beeinflussen.

**[PROPOSED]** Commands SHOULD fachlich sein, zum Beispiel MoveRoadControlPoint oder PaintBiomeConstraint, nicht nur rohe Zellwrites. Der Commit darf zusätzlich exakte Deltas speichern.

### 11.3 Operationstypen

Die Plattform SHOULD mindestens folgende Operationstypen unterstützen:

- Create, Update, Delete und Restore kanonischer Entitäten,
- Paint oder Erase diskreter Voxel- und Constraint-Werte,
- Set, Clear, Lock und Unlock von Parametern,
- Transform quantisierter Assets,
- Split und Merge von Region, Block oder Parcel,
- Regenerate Stage oder Regenerate Coverage,
- Adopt Proposal,
- Import, Reimport und Migrate Asset,
- Apply Recipe oder Style Bundle,
- Approve, Reject und Request Changes,
- Revert Commit und Reapply Commit,
- Resolve Conflict,
- Capture Evidence.

**[PROPOSED]** Bulk-Operationen MUST eine explizite Coverage, Zielmenge, maximale Wirkung und abbrechbare Prepare-Phase besitzen.

### 11.4 Tool-State-Maschine

**[PROPOSED]** Ein schreibendes Werkzeug SHOULD die Zustände Idle, Armed, Previewing, Preparing, AwaitingApproval, Committing, Committed, Rejected, Conflicted und Failed besitzen.

**[PROPOSED]** Ein Wechsel des Modus oder Dokuments während Previewing MUST eine explizite Entscheidung Apply, Keep Draft oder Discard verlangen.

**[PROPOSED]** Ein Fehler darf einen halbfertigen kanonischen Zustand nicht zurücklassen.

## 12. Copy-on-Write Preview, Prepare, Approval und Commit

### 12.1 Copy-on-Write Preview

**[PROPOSED]** Preview MUST in einem Copy-on-Write Overlay der Editor Session ausgeführt werden. Kanonische Daten bleiben unverändert.

Das Overlay SHOULD enthalten:

- baseRevision,
- Sparse-Deltas oder fachliche Proposal-Entitäten,
- betroffene Chunks, Features und Settlement-Objekte,
- beforeHash und previewHash,
- invalidierte Derived Products,
- Preview-Validatorergebnisse,
- geschätzte Kosten und Coverage,
- temporäre Renderprodukte,
- Ablauf- oder Stale-Status.

**[PROPOSED]** Preview-Reads MUST Overlay vor Basisdaten auflösen. Nicht überdeckte Werte kommen aus der festgehaltenen Basisrevision.

**[PROPOSED]** Ein Preview MUST verworfen werden können, ohne kanonische Writes, Event-Store-Einträge oder fremde Locks zu hinterlassen.

### 12.2 Prepare

**[PROPOSED]** Prepare MUST vor jedem Commit:

1. Schema und Command validieren.
2. Targets und Coverage vollständig auflösen.
3. expectedTargetHashes gegen aktuellen Zustand prüfen.
4. Domain- und Chunk-Locks planen.
5. authored locks und protected deltas prüfen.
6. vollständige before- und after-Deltas materialisieren.
7. Derived Invalidations bestimmen.
8. Pflichtvalidatoren ausführen.
9. Approval-Level berechnen.
10. deterministischen commitCandidateHash erzeugen.

Prepare erzeugt ein PreparedChangeSet:

~~~json
{
  "schema": "hestia.editor/PreparedChangeSet",
  "schemaVersion": 1,
  "prepareId": "prepare:uuid",
  "commandId": "cmd:uuid",
  "baseRevision": "rev:0001",
  "observedRevision": "rev:0001",
  "commitCandidateHash": "sha256:CANDIDATE",
  "locks": [],
  "beforeDeltasHash": "sha256:BEFORE",
  "afterDeltasHash": "sha256:AFTER",
  "invalidations": [],
  "issues": [],
  "requiredApproval": "A2",
  "expiresAt": "policy-defined"
}
~~~

**[PROPOSED]** PreparedChangeSet ist unveränderlich. Jede Parameteränderung erfordert neues Prepare und neuen Hash.

### 12.3 Approval-Level

**[PROPOSED]** Die Plattform SHOULD folgende Level verwenden:

| Level | Bedeutung | Beispiel |
|---|---|---|
| A0 | Keine kanonische Mutation | Navigation, Debugansicht, Capture ohne State-Write |
| A1 | Lokale, leicht reversible Änderung | einzelne Materialzelle, lokale Prop-Platzierung |
| A2 | Mehrere Entitäten oder Chunks | Vegetationscluster, Straßenkontrollpunkt, Asset-Reimport |
| A3 | Strukturelle Region- oder Stadtänderung | Hydrologie, District Replan, Kit-Migration |
| A4 | Veröffentlichte Weltbasis, Schema oder irreversible Migration | Worldgen Baseline, Palette-Remap, Formatmigration |

**[PROPOSED]** Das erforderliche Level wird aus Operationstyp, Coverage, Domain, Publikationsstatus, Fehlerausnahmen und Migrationswirkung bestimmt. Die UI darf es nicht herabsetzen.

**[PROPOSED]** A3 und A4 SHOULD menschliche Reviewer und Evidence-Captures verlangen. Die genaue Rollenmatrix ist **[OPEN]**.

### 12.4 CAS und atomarer Commit

**[PROPOSED]** Commit MUST Compare-and-Swap verwenden:

- aktuelle Revision entspricht observedRevision,
- target hashes entsprechen expectedTargetHashes,
- PreparedChangeSet ist nicht abgelaufen,
- Locks sind gültig,
- Approval deckt requiredApproval,
- keine neue harte Validierungsverletzung liegt vor.

**[PROPOSED]** Der Commit MUST atomar:

1. alle kanonischen Deltas schreiben,
2. neue Revision erzeugen,
3. Event und Provenienz speichern,
4. Derived Products als stale markieren,
5. Locks freigeben,
6. Folgejobs enqueuen.

**[PROPOSED]** Schlägt ein Teil vor Sichtbarkeit der neuen Revision fehl, MUST die gesamte Transaktion unsichtbar bleiben. Schlägt ein Folgejob nach Commit fehl, bleibt der kanonische Commit gültig, aber sein Derived Status wird failed oder pending.

**[PROPOSED]** Ein CommitResult MUST newRevision, eventId, committedHash, invalidations, pendingJobs und Issue-Änderungen zurückgeben.

### 12.5 Locking

**[PROPOSED]** Locks SHOULD feingranular nach Domain, Entität und räumlicher Coverage sein.

**[PROPOSED]** Locks MUST Owner, Session, Acquire-Zeit, Lease, Basisrevision und Zweck dokumentieren.

**[PROPOSED]** Abgelaufene Locks dürfen keinen Commit autorisieren.

**[OPEN]** Ob kollaborative Sessions pessimistische Locks, optimistische CAS-Konflikte oder eine hybride Strategie verwenden, ist offen.

## 13. Undo, Redo, Revert und Konfliktauflösung

### 13.1 Drei Ebenen

**[PROPOSED]** Es sind drei Ebenen zu unterscheiden:

1. Preview Undo und Redo innerhalb eines COW-Overlays.
2. Session Undo und Redo für noch nicht publizierte lineare Commits.
3. Published Revert und Reapply als neue append-only Commits.

**[ACCEPTED]** Publizierte Historie MUST NOT durch Umschreiben oder Löschen früherer Commits rückgängig gemacht werden.

### 13.2 Exakte Deltas

**[PROPOSED]** Jeder Commit MUST ausreichende before- und after-Informationen für eine fachlich korrekte Inversion speichern. Ein Seed allein genügt nicht.

**[PROPOSED]** Für große Worldgen-Änderungen MAY die Inversion aus gehashten Snapshots, Sparse-Deltas und reproduzierbaren Stage-Outputs bestehen. Ihre Verfügbarkeit MUST vor Commit geprüft sein.

### 13.3 Konfliktprüfung

Für jedes betroffene Feld oder Segment werden betrachtet:

- B = Wert vor dem zu revertierenden Commit,
- A = Wert nach dem Commit,
- C = aktueller Wert.

**[PROPOSED]** Automatisches Revert ist sicher, wenn C gleich A ist. Dann darf A zu B zurückgeführt werden.

**[PROPOSED]** Wenn C weder A noch B entspricht, liegt ein Konflikt vor. Das System MUST ihn nicht still überschreiben.

**[PROPOSED]** Konflikte SHOULD pro Domain auflösbar sein:

- Keep Current,
- Restore Before,
- Apply After,
- Merge Fachregel,
- Split Coverage,
- Regenerate Candidate,
- Cancel Revert.

### 13.4 Strukturkonflikte

**[PROPOSED]** Für Graphen und Parzellen MUST Konfliktauflösung stabile IDs und Lineage berücksichtigen. Geometrische Nähe allein genügt nicht.

**[PROPOSED]** Wenn eine Straße nach dem Zielcommit gesplittet wurde, muss ein Revert entweder die Nachfolger über Lineage abbilden oder zur manuellen Auflösung eskalieren.

**[PROPOSED]** Wenn Player- oder Simulation-Deltas betroffen sind, MUST ein Worldgen-Revert standardmäßig diese Deltas schützen.

**[OPEN]** Ob unveröffentlichte Sessions strikt linear oder als Branch- beziehungsweise DAG-Modell geführt werden, ist offen.

### 13.5 Revert-Provenienz

**[PROPOSED]** Ein RevertCommit MUST targetEventId, conflictResolution, Reviewer, beforeHash, afterHash und reason enthalten.

## 14. WorldgenManifest und Provenienz

### 14.1 Provenienzpflicht

**[PROPOSED]** Jeder publishable Worldgen-, City-, Asset- und Capture-Artefakt MUST Provenienz besitzen:

- repository und commit,
- sourceDocumentIds,
- input asset hashes,
- recipe und bundle hashes,
- schema versions,
- generator und tool versions,
- seed hierarchy,
- platform profile,
- author und actor,
- license information,
- approvals und exceptions,
- output content hashes.

**[PROPOSED]** Zeitstempel dürfen in Provenienz enthalten sein, MUST aber aus deterministischen Inhalts-Hashes ausgeschlossen werden, sofern sie nicht selbst fachlicher Input sind.

### 14.2 Beispiel: WorldgenManifest

~~~json
{
  "schema": "hestia.worldgen/WorldgenManifest",
  "schemaVersion": 1,
  "manifestId": "example:worldgen:hestia:region-a:baseline-001",
  "status": "proposed",
  "repository": {
    "url": "project-repository",
    "commit": "15f3550",
    "dirty": false
  },
  "world": {
    "worldId": "world:hestia",
    "bodyId": "body:hestia",
    "regionIds": ["example:region:hestia:a"],
    "coordinateContract": "hestia-coordinates-v1"
  },
  "determinism": {
    "contractVersion": 1,
    "worldSeed": "0xA98D1F00",
    "hashAlgorithm": "OPEN",
    "canonicalSerialization": "OPEN",
    "numericPolicy": "fixed-or-quantized-v1",
    "stableOrdering": true
  },
  "voxelProfile": {
    "profileId": "lab-025m-v1",
    "status": "accepted",
    "cellSizeMeters": 0.25,
    "innerChunkSize": [32, 32, 32],
    "haloCells": 1,
    "sampleSize": [34, 34, 34],
    "materialType": "uint8",
    "airMaterialId": 0,
    "memoryOrder": "x-fastest"
  },
  "localCandidateProfiles": [
    {
      "profileId": "local-0125m-hero-v0",
      "status": "proposed",
      "scope": "explicit-hero-coverage-only"
    }
  ],
  "inputs": {
    "biomeRecipes": [
      {
        "id": "biome.hestia.coastal_luminous_savanna",
        "hash": "sha256:BIOME"
      }
    ],
    "cityStyleBundles": [
      {
        "id": "example:citystyle:hestia:gratia-coastal-v1",
        "hash": "sha256:CITY_STYLE"
      }
    ],
    "materialRegistryHash": "sha256:MATERIALS",
    "assetBundleHashes": ["sha256:ASSET_BUNDLE"],
    "controlSkeletonHash": "sha256:CONTROLS"
  },
  "stages": [
    {
      "stageId": "macro-terrain",
      "stageVersion": "1.0.0-proposed",
      "seed": "derived:macro-terrain",
      "inputHash": "sha256:INPUT",
      "outputHash": "sha256:OUTPUT",
      "coverage": "example:region:hestia:a"
    }
  ],
  "visualContract": {
    "formLanguage": "hard-square-microvoxels",
    "forbiddenDominantLooks": [
      "low-poly",
      "surface-nets",
      "marching-cubes",
      "dual-contouring",
      "smooth-terrain-proxy"
    ],
    "visualLanguageDocument": "01_Hestia_Visual_Design_Language_v1.md",
    "evidenceRegister": "03_Hestia_Evidence_Conflict_and_Migration_Register_2026-08-12.md"
  },
  "validation": {
    "validatorBundleHash": "sha256:VALIDATORS",
    "requiredSuites": [
      "worldgen-correctness",
      "city-correctness",
      "streaming-seams",
      "visual-captures"
    ],
    "resultHash": "sha256:RESULTS"
  },
  "approval": {
    "requiredLevel": "A4",
    "state": "pending",
    "reviewerIds": [],
    "acceptedExceptions": []
  }
}
~~~

### 14.3 Provenienzketten

**[PROPOSED]** Provenienz MUST transitiv abfragbar sein: von sichtbarem Capture zu Renderprodukt, kanonischer Revision, Generatorstage, Recipe, Asset, Quellfile, Commit und Approval.

**[PROPOSED]** Der Issue Browser SHOULD für jede betroffene Entität einen Provenance Inspector öffnen können.

## 15. LOD, Streaming und Persistenz

### 15.1 Chunkzustände

**[PROPOSED]** Ein Chunk SHOULD folgende Zustände unterscheiden:

- Absent,
- Requested,
- Loading,
- Generating,
- CanonicalReady,
- DerivedPending,
- Visible,
- Stale,
- Failed,
- Evicting.

**[ACCEPTED]** Nicht geladene Chunks sind Unknown, nicht Air.

**[PROPOSED]** Jede Chunkantwort MUST chunkId, profileId, coverage, canonicalRevision, contentHash und neighborDependencyVersion enthalten.

### 15.2 Nahtvertrag

**[PROPOSED]** Generatoren MUST chunkgrenzenunabhängig arbeiten. Identische globale Koordinaten müssen unabhängig von Anfragefolge denselben Zustand liefern.

**[PROPOSED]** Halo-Samples MUST aus derselben kanonischen Funktion oder derselben Neighbor-Revision stammen wie innere Zellen.

**[PROPOSED]** Grenzfeatures wie Flüsse, Straßen und Gebäude MUST global oder regionweit geplant und lokal materialisiert werden. Doppelte lokale Erzeugung ohne gemeinsame Feature-ID ist unzulässig.

**[PROPOSED]** Seam-QA MUST Face, Kante, Ecke, LOD-Übergang, Rebase und Evict-Reload abdecken.

### 15.3 LOD-Formensprache

**[ACCEPTED]** LOD darf den sichtbaren Hestia-Look nicht in eine geglättete Low-Poly-Landschaft verwandeln.

**[PROPOSED]** Sichtbare LODs SHOULD:

- blockige Silhouetten bewahren,
- Materialrollen und große Farbfelder bewahren,
- Stufen und Terrassen hierarchisch zusammenfassen,
- Vegetation zu blockigen Kronenclustern aggregieren,
- Straßen, Flüsse und Küsten als stabile Features erhalten,
- bei Wechseln Dither, Overlap oder andere nichtformverändernde Übergänge verwenden.

**[PROPOSED]** Power-of-two-Aggregation MAY verwendet werden, sofern Achsen, Materialdominanz, Occupancy-Regel und Feature-Erhaltung deterministisch definiert sind.

**[PROPOSED]** Smooth Triangle Proxies MAY nur außerhalb der sichtbaren Source-of-Truth-Darstellung verwendet werden, etwa für Kollision oder weit entfernte analytische Occlusion.

### 15.4 Persistenzmodell

**[PROPOSED]** Persistenz SHOULD aus vier Schichten bestehen:

1. versionierte Generatorbasis,
2. kanonische veröffentlichte Snapshots oder Checkpoints,
3. append-only Authoring- und Simulationsevents,
4. rebuildbare Derived Caches.

**[PROPOSED]** Der aktuelle Zustand ergibt sich aus kompatibler Basis plus geordneten Events bis zu einer Revision.

**[PROPOSED]** Checkpoints MUST die letzte enthaltene Event-ID, Basismanifest-Hash, Schema-Version, Coverage und Content-Hash speichern.

**[PROPOSED]** Ein Regenerate MUST bestehende Authoring-, Player- und Simulation-Deltas nach Policy rebasen, schützen oder als Konflikt melden. Es darf sie nicht still verwerfen.

**[OPEN]** Langzeitmigration zwischen stark unterschiedlichen Generatorversionen und die maximal unterstützte Event-Tiefe sind offen.

### 15.5 Budgetvertrag

**[PROPOSED]** Streamingprofile SHOULD Budgets für CPU-Zeit, GPU-Zeit, Arbeitsspeicher, GPU-Speicher, Bandbreite, Anzahl sichtbarer Chunks, Derived Build Queue und maximale Stale-Dauer definieren.

**[OPEN]** Produktbudgets und Zielgeräte sind noch nicht vollständig festgeschrieben. Das akzeptierte 0,25-m-Laborprofil ist kein automatischer Beweis für planetare Produktionsbudgets.

## 16. Destruktion, Konnektivität und Wiederaufbau

### 16.1 Connectivity Authority

**[PROPOSED]** Strukturelle Konnektivität MUST auf kanonischer Voxelbelegung, Face-6-Nachbarschaft und expliziten Anchors basieren.

**[PROPOSED]** Assetinterne Connectivity SHOULD in Asset Local Space berechnet und über World Anchors mit der Umgebung verbunden werden.

**[ACCEPTED]** Ein physischer Body pro Voxel MUST NOT verwendet werden.

**[PROPOSED]** Verbundene Komponenten werden nur bei Bedarf als aggregierte dynamische Bodies materialisiert.

### 16.2 Unknown-Grenzen

**[PROPOSED]** Eine Komponente, die einen Unknown- oder ungeladenen Rand berührt, darf nicht automatisch als frei schwebend abgelöst werden.

**[PROPOSED]** Der Status SHOULD Supported, Unsupported, PendingBoundary oder AnchoredUnknown lauten.

### 16.3 Atomarer Transfer

**[PROPOSED]** Der Transfer einer abgetrennten Komponente in Physiksimulation MUST atomar sein:

1. betroffene Voxel und Nachbarn locken,
2. Komponenten- und Anchorstatus prüfen,
3. kanonisches Remove-Delta vorbereiten,
4. Object-Local Voxelpayload und Bodytransform erzeugen,
5. Commit von Removal plus Spawn-Event,
6. Derived Mesh und Kollision aktualisieren.

**[PROPOSED]** Ein Fehler darf weder duplizierte noch verlorene Materie erzeugen.

### 16.4 DamageBinding

Gebäude und Infrastruktur SHOULD DamageBinding besitzen:

- semanticEntityId,
- voxelCoverage,
- structuralAnchorIds,
- criticalComponentIds,
- serviceGraphBindings,
- damageState,
- repairPolicy,
- rebuildEligibility,
- provenance.

**[PROPOSED]** Schaden MUST semantische Folgen wie unpassierbare Straße, ausgefallene Versorgung oder unbewohnbares Gebäude korrekt propagieren.

### 16.5 Wiederaufbau

**[PROPOSED]** Wiederaufbau MAY aus ursprünglichem BuildingIntent und KitBundle erfolgen, muss aber aktuelle Player-Edits, geänderte Infrastruktur, Materialverfügbarkeit und Damage Events berücksichtigen.

**[PROPOSED]** Automatischer Wiederaufbau MUST eine Preview und Konfliktanalyse erzeugen.

**[OPEN]** Welche Schäden dauerhaft, spielmechanisch reparierbar oder bei Worldgen-Migration rücksetzbar sind, ist eine Game-Design-Entscheidung.

## 17. Validierung und Issue Browser

### 17.1 Validator Registry

**[PROPOSED]** Validatoren MUST registriert und versioniert sein:

- validatorId,
- version,
- ownerDomain,
- supportedSchemaVersions,
- severityPolicy,
- deterministic flag,
- inputs,
- output issue schema,
- quickFixCommands,
- suppressionPolicy.

**[PROPOSED]** Ein Validator darf keine kanonischen Daten verändern. Quick Fixes sind normale EditorCommands.

### 17.2 Issue Schema

Ein Issue SHOULD enthalten:

~~~json
{
  "schema": "hestia.validation/Issue",
  "schemaVersion": 1,
  "issueId": "issue:stable-key",
  "stableKey": "validator-id:entity-id:subpath",
  "validatorId": "city.parcel_access_valid",
  "validatorVersion": "1.0.0",
  "severity": "error",
  "ownerDomain": "settlement",
  "entityIds": ["parcel:gratia:0042"],
  "coverage": {},
  "messageKey": "parcel.no_valid_access",
  "parameters": {},
  "evidenceRefs": [],
  "quickFixCommandTemplates": [],
  "firstSeenRevision": "rev:100",
  "lastSeenRevision": "rev:104",
  "state": "open",
  "suppressible": false
}
~~~

**[PROPOSED]** stableKey MUST über erneute Validierung stabil bleiben, solange dasselbe Problem an derselben semantischen Stelle besteht.

### 17.3 Severity und Sperrwirkung

| Severity | Bedeutung | Commitwirkung |
|---|---|---|
| info | Hinweis ohne Abnahmeauswirkung | Commit erlaubt |
| warning | Abweichung mit Reviewbedarf | je nach Approval erlaubt |
| error | Kontraktverletzung | Commit oder Publish gesperrt |
| fatal | beschädigte Autorität, Hash-, Schema- oder Sicherheitsverletzung | Operation sofort abbrechen |

**[PROPOSED]** Hashfehler, unbekannte Lizenz, verlorene Player-Deltas, doppelte stabile IDs, nicht auflösbare Pflichtmaterialien und fehlende atomare Transaktionsgarantie MUST nicht suppressible sein.

### 17.4 Issue Browser

**[PROPOSED]** Der Issue Browser SHOULD:

- nach Domain, Severity, Stage, Revision, Owner, Region und Status filtern,
- Issue im Viewport fokussieren,
- betroffene Entitäten und Provenienz zeigen,
- before, preview und current vergleichen,
- verwandte Issues gruppieren,
- Quick Fix als Preview starten,
- Suppressiongrund und Reviewer erfassen,
- Capture oder Log als Evidenz anhängen,
- Export als JSON und Markdown unterstützen.

**[PROPOSED]** Eine Suppression MUST scope, reason, author, reviewer, expiry oder targetVersion und Issue-Fingerprint speichern.

## 18. Capture- und Evidence-Vertrag

### 18.1 Reproduzierbares Capture

**[PROPOSED]** Ein visueller Vergleich ist nur belastbar, wenn Kamera, Projektion, Viewport, DPR, Renderbackend, Beleuchtung, Tageszeit, Weltrevision, Seeds, Profile, LOD und UI-Overlay vertraglich festgehalten sind.

**[PROPOSED]** Captures MUST rohe Bilder, Metadaten und Hashes getrennt speichern.

**[PROPOSED]** Visuelle Freigabe MUST maschinelle Checks und menschliche Beurteilung nach Dokument 01 kombinieren. Automatische Pixelmetrik allein darf keine Stilfreigabe erteilen.

### 18.2 Beispiel: VisualCaptureContract

~~~json
{
  "schema": "hestia.evidence/VisualCaptureContract",
  "schemaVersion": 1,
  "captureContractId": "capture-contract:biome-wide-day-v1",
  "status": "proposed",
  "sourceOfTruth": {
    "visualLanguage": "01_Hestia_Visual_Design_Language_v1.md",
    "evidenceRegister": "03_Hestia_Evidence_Conflict_and_Migration_Register_2026-08-12.md",
    "repositoryCommit": "15f3550"
  },
  "world": {
    "worldId": "world:hestia",
    "revision": "rev:EXACT",
    "manifestHash": "sha256:WORLDGEN_MANIFEST",
    "regionId": "example:region:hestia:a",
    "voxelProfileId": "lab-025m-v1"
  },
  "camera": {
    "coordinateSpace": "region-local",
    "position": [1200.0, 680.0, 420.0],
    "target": [0.0, 0.0, 80.0],
    "up": [0.0, 0.0, 1.0],
    "projection": "perspective",
    "verticalFovDegrees": 48.0,
    "nearMeters": 0.25,
    "farMeters": 80000.0,
    "viewMatrixHash": "sha256:VIEW",
    "projectionMatrixHash": "sha256:PROJECTION"
  },
  "viewport": {
    "cssWidth": 1680,
    "cssHeight": 945,
    "devicePixelRatio": 1,
    "outputWidth": 1680,
    "outputHeight": 945
  },
  "render": {
    "browser": "pinned-by-runner",
    "browserVersion": "pinned-by-runner",
    "backend": "webgpu",
    "adapterFingerprint": "recorded",
    "rendererVersion": "pinned",
    "lodPolicy": "capture-fixed-v1",
    "dynamicResolution": false,
    "temporalJitter": false,
    "exposure": "fixed",
    "toneMapping": "fixed-preset-v1"
  },
  "environment": {
    "timeOfDay": "10:30:00",
    "weatherPreset": "clear-cumulus-v1",
    "sunDirection": [0.44, -0.61, 0.66],
    "cloudSeed": "0x0032AF",
    "windTime": 0.0
  },
  "layers": {
    "canonicalWorld": true,
    "previewOverlay": false,
    "debug": false,
    "ui": false
  },
  "warmup": {
    "requiredCoverage": "frustum-plus-margin",
    "waitForCanonical": true,
    "waitForDerived": true,
    "maxPendingJobs": 0,
    "fixedFramesAfterReady": 8
  },
  "outputs": {
    "colorPng": true,
    "depth": true,
    "materialId": true,
    "entityId": true,
    "chunkId": true,
    "metadataJson": true
  },
  "regionsOfInterest": [
    {
      "id": "primary-terrain-silhouette",
      "normalizedRect": [0.0, 0.0, 1.0, 0.62]
    }
  ],
  "evaluation": {
    "machineChecks": [
      "capture.metadata_complete",
      "capture.no_missing_coverage",
      "capture.no_smooth_dominant_surface"
    ],
    "humanRubricId": "hestia-visual-language-v1",
    "requiredApproval": "A3"
  }
}
~~~

### 18.3 Beweispaket

**[PROPOSED]** Ein Evidence Package SHOULD enthalten:

- VisualCaptureContract,
- Capture-Metadaten,
- Farb-, Tiefen-, Material-, Entity- und Chunkbilder,
- WorldgenManifest-Hash,
- Browser- und GPU-Fingerprint,
- Validatorresultate,
- Bildhashes,
- Vergleichsbasis,
- ROI-Diffs,
- menschliche Rubrik und Reviewerentscheidung,
- bekannte Abweichungen.

**[PROPOSED]** Ein Capture mit fehlender Coverage, Pending Derived Products oder nicht fixierter Kamera MUST als invalid gelten.

## 19. Exakte QA-Matrizen

### 19.1 Worldgen- und Determinismusmatrix

| ID | Test | Eingabe | Erwartung | Gate |
|---|---|---|---|---|
| WG-001 | Repeat Build | identisches Manifest, 3 Läufe | identischer kanonischer Output-Hash | MUST PASS |
| WG-002 | Chunk Order | Vorwärts-, Rückwärts- und Zufallsreihenfolge | identische Chunk-Hashes und Feature-IDs | MUST PASS |
| WG-003 | Worker Count | 1, 2, 4 und Zielmaximum | identischer kanonischer Output | MUST PASS |
| WG-004 | Camera Independence | verschiedene Kamerapfade | identische kanonische Daten | MUST PASS |
| WG-005 | Seam Face | alle Nachbarflächen | identische Grenzsamples und Materialrollen | MUST PASS |
| WG-006 | Seam Edge | dreifache Nachbarschaft | keine Lücke, Duplikation oder Feature-Unterbrechung | MUST PASS |
| WG-007 | Seam Corner | maximale Mehrfachgrenze | identische Ownership und Samples | MUST PASS |
| WG-008 | Unknown Semantics | ungeladener Nachbar | Unknown wird nicht Air | MUST PASS |
| WG-009 | Hydrology Topology | vollständige Region | alle Kanäle besitzen gültige Quelle und Senke | MUST PASS |
| WG-010 | Hydrology Grade | alle Flusssegmente | keine unzulässige Bergaufkante | MUST PASS |
| WG-011 | Biome Coverage | erwartete Region | keine unbeabsichtigte Lücke oder Mehrfachautorität | MUST PASS |
| WG-012 | Vegetation Anchors | alle Instanzen | gültige Wurzel, Boden und Reservation | MUST PASS |
| WG-013 | Authored Lock | Locked Controls plus Regeneration | kein Locked Control verändert | MUST PASS |
| WG-014 | Profile Declaration | alle Chunks und Assets | profileId und Zellgröße vorhanden | MUST PASS |
| WG-015 | Forbidden Look | repräsentative Captures | kein dominanter Low-Poly- oder Smooth-Surface-Look | HUMAN + MUST PASS |

### 19.2 Stadtmatrix

| ID | Test | Erwartung | Gate |
|---|---|---|---|
| CITY-001 | Stable IDs | Regeneration ohne Inputänderung behält IDs | MUST PASS |
| CITY-002 | Road Connectivity | alle Pflichtkorridore im Graph verbunden | MUST PASS |
| CITY-003 | Road Geometry | keine unzulässige Selbstkreuzung, Neigung oder Krümmung | MUST PASS |
| CITY-004 | Hydrology Conflict | kein ungeklärter Bau in Kanal oder Floodplain | MUST PASS |
| CITY-005 | Parcel Access | jede bebaubare Parzelle hat gültigen Zugang | MUST PASS |
| CITY-006 | Parcel Lineage | Split und Merge vollständig nachvollziehbar | MUST PASS |
| CITY-007 | Envelope | Gebäude bleibt in DevelopmentEnvelope und Clearance | MUST PASS |
| CITY-008 | Entry Reachability | Pflichtzugänge von öffentlichem Netz erreichbar | MUST PASS |
| CITY-009 | Service Binding | Pflichtversorgung semantisch verbunden | MUST PASS |
| CITY-010 | Reservation | Hard Reservations unverletzt | MUST PASS |
| CITY-011 | District Targets | Dichte, Höhe, Grün und Public Space ausgewiesen | OWNER THRESHOLD |
| CITY-012 | Style Bundle | Material-, Kit- und Formregeln erfüllt | MUST PASS |
| CITY-013 | Skyline | Landmarkenrollen und Sichtkorridore bestätigt | HUMAN + MUST PASS |
| CITY-014 | Repetition | keine unfreigegebene Musterwiederholung | OWNER THRESHOLD |
| CITY-015 | Approval | ApprovedCityPlan vorhanden und aktuell | MUST PASS |

### 19.3 Assetmatrix

| ID | Test | Erwartung | Gate |
|---|---|---|---|
| ASSET-001 | Source Hash | Quelldatei stimmt mit Record überein | MUST PASS |
| ASSET-002 | Adapter Determinism | identische SourceScene-Hashes | MUST PASS |
| ASSET-003 | Compiler Determinism | identische HVOX-Hashes | MUST PASS |
| ASSET-004 | Materials | alle MaterialKeys auflösbar | MUST PASS |
| ASSET-005 | Air | Air-Semantik profilkonform | MUST PASS |
| ASSET-006 | Anchors | Pflichtanker vorhanden und quantisiert | MUST PASS |
| ASSET-007 | Bounds | Daten liegen innerhalb deklarierter Bounds | MUST PASS |
| ASSET-008 | Dimensions | Payloadlänge und Dimension konsistent | MUST PASS |
| ASSET-009 | License | Lizenz und Autorprovenienz vorhanden | MUST PASS |
| ASSET-010 | Transform | keine unzulässige nichtuniforme Skalierung | MUST PASS |
| ASSET-011 | Thin Features | Verlust gemeldet oder regelkonform behandelt | MUST PASS |
| ASSET-012 | Derived GLB | source HVOX hash korrekt referenziert | MUST PASS |
| ASSET-013 | Visual Form | harte quadratische Mikrovoxel sichtbar | HUMAN + MUST PASS |
| ASSET-014 | LOD | Silhouette und Materialrollen bleiben erhalten | MUST PASS |
| ASSET-015 | Damage Binding | Connectivity und Anchors gültig, falls zerstörbar | MUST PASS |

### 19.4 Editor- und Transaktionsmatrix

| ID | Test | Erwartung | Gate |
|---|---|---|---|
| EDT-001 | Preview Isolation | keine kanonische Mutation vor Commit | MUST PASS |
| EDT-002 | Discard | Preview vollständig verwerfbar | MUST PASS |
| EDT-003 | Prepare Completeness | before, after, locks, issues, approval vollständig | MUST PASS |
| EDT-004 | CAS Success | unveränderte Basis committed atomar | MUST PASS |
| EDT-005 | CAS Conflict | veränderte Basis führt zu Conflict, keinem Overwrite | MUST PASS |
| EDT-006 | Mid-Commit Failure | kein sichtbarer Teilzustand | MUST PASS |
| EDT-007 | Derived Failure | Commit bleibt gültig, Derived Status failed | MUST PASS |
| EDT-008 | Lock Expiry | abgelaufener Lock kann nicht committen | MUST PASS |
| EDT-009 | Undo Preview | exakte Wiederherstellung im Overlay | MUST PASS |
| EDT-010 | Published Revert | neuer append-only Commit | MUST PASS |
| EDT-011 | Revert Conflict | spätere Änderung wird nicht still überschrieben | MUST PASS |
| EDT-012 | Redo | Reapply nutzt neue CAS-Prüfung | MUST PASS |
| EDT-013 | Command Replay | gleiche Basis plus Command erzeugt gleichen Kandidathash | MUST PASS |
| EDT-014 | Provenance | Actor, Tool, Version, Revision und Hash vorhanden | MUST PASS |
| EDT-015 | Quick Fix | nur über normales Command und Preview | MUST PASS |
| EDT-016 | AI Proposal | kein direkter kanonischer Write | MUST PASS |
| EDT-017 | Mode Switch | Draft wird nicht still verloren oder angewendet | MUST PASS |
| EDT-018 | Bulk Bounds | Operation überschreitet deklarierte Coverage nicht | MUST PASS |

### 19.5 Streaming-, LOD- und Persistenzmatrix

| ID | Test | Erwartung | Gate |
|---|---|---|---|
| STR-001 | Evict Reload | identischer kanonischer Chunkhash | MUST PASS |
| STR-002 | Rebase | Origin Shift verändert keine IDs oder Geometrie | MUST PASS |
| STR-003 | LOD Transition | keine Lücke, Feature-Unterbrechung oder Smooth-Look-Umschaltung | MUST PASS |
| STR-004 | Stale Derived | sichtbar gekennzeichnet, kein falscher Publish | MUST PASS |
| STR-005 | Event Replay | Checkpoint plus Events reproduziert Revision | MUST PASS |
| STR-006 | Protected Delta | Regeneration erhält Player- und Authoring-Deltas | MUST PASS |
| STR-007 | Feature Ownership | grenzübergreifendes Feature genau einmal kanonisch | MUST PASS |
| STR-008 | Missing Coverage | als Fehler oder explizite Lücke, nie Air | MUST PASS |
| STR-009 | Budget | Profilwerte erfasst, Grenzüberschreitung als Issue | OWNER THRESHOLD |
| STR-010 | Migration | Schema- und Generatorwechsel erzeugt Bericht | MUST PASS |

### 19.6 Destruktionsmatrix

| ID | Test | Erwartung | Gate |
|---|---|---|---|
| DST-001 | Face-6 Connectivity | Referenzfälle korrekt segmentiert | MUST PASS |
| DST-002 | Anchor Support | geankerte Struktur bleibt supported | MUST PASS |
| DST-003 | Unknown Boundary | keine falsche Ablösung | MUST PASS |
| DST-004 | Atomic Transfer | keine Duplikation oder Materialverluste | MUST PASS |
| DST-005 | Object Local | dynamische Payload behält Material und Connectivity | MUST PASS |
| DST-006 | Service Propagation | Schaden aktualisiert semantische Dienste | MUST PASS |
| DST-007 | Save Reload | Damage State identisch | MUST PASS |
| DST-008 | Rebuild Preview | Wiederaufbau zeigt Konflikte vor Apply | MUST PASS |
| DST-009 | No Body per Voxel | Laufzeitarchitektur aggregiert Komponenten | MUST PASS |
| DST-010 | Reattach | definierte Rückübernahme atomar | MUST PASS |

### 19.7 Capture- und Visual-QA-Matrix

| ID | Test | Erwartung | Gate |
|---|---|---|---|
| VIS-001 | Contract Completeness | alle Pflichtmetadaten vorhanden | MUST PASS |
| VIS-002 | Fixed Camera | Matrixhash stimmt | MUST PASS |
| VIS-003 | Fixed Viewport | CSS, DPR und Output stimmen | MUST PASS |
| VIS-004 | Ready State | keine Pending Jobs oder Missing Coverage | MUST PASS |
| VIS-005 | Buffer Set | Farb-, Depth-, Material-, Entity- und Chunkausgabe vorhanden | MUST PASS |
| VIS-006 | Baseline Match | richtige Weltrevision und Manifesthash | MUST PASS |
| VIS-007 | Form Language | harte quadratische Mikrovoxel als dominanter Look | HUMAN + MUST PASS |
| VIS-008 | Forbidden Look | kein Low Poly, Surface Nets, sichtbares Marching Cubes oder Dual Contouring | HUMAN + MUST PASS |
| VIS-009 | Macro Readability | Landform, Stadtstruktur und Pfade klar lesbar | HUMAN + MUST PASS |
| VIS-010 | Meso Rhythm | Cluster, Freiräume, Distrikte und Wasser sinnvoll komponiert | HUMAN + MUST PASS |
| VIS-011 | Micro Richness | fein gerasterte Details ohne visuellen Brei | HUMAN + MUST PASS |
| VIS-012 | Palette Roles | Material- und Akzentrollen nach Dokument 01 | HUMAN + MUST PASS |
| VIS-013 | LOD Visual | kein Stilbruch bei Distanzwechsel | HUMAN + MUST PASS |
| VIS-014 | Evidence Hash | Bild und Metadatenhash verifiziert | MUST PASS |
| VIS-015 | Reviewer Record | Rubrik, Entscheidung und Reviewer gespeichert | MUST PASS |

### 19.8 Abnahmeregel

**[PROPOSED]** Eine Baseline darf nur veröffentlicht werden, wenn alle MUST-PASS-Tests des betroffenen Scopes bestanden sind, keine fatalen oder nicht suppressible Errors offen sind, alle Owner-Thresholds explizit festgelegt oder als nicht anwendbar begründet sind und erforderliche menschliche Freigaben vorliegen.

## 20. KI-gestützte Vorschläge

### 20.1 Grundgrenze

**[PROPOSED]** KI darf Vorschläge erzeugen, aber MUST NOT direkt kanonische Welt-, Stadt-, Asset- oder Simulationsdaten schreiben.

**[PROPOSED]** Jeder KI-Output MUST:

- ein geschlossenes, versioniertes Schema erfüllen,
- Proposal-Status besitzen,
- Basisrevision und Scope nennen,
- nur bekannte oder explizit neu vorgeschlagene IDs verwenden,
- Locks und Reservations als read-only respektieren,
- Parameter, Annahmen und Unsicherheiten ausweisen,
- deterministisch compilebar oder vollständig materialisiert sein,
- durch dieselben Validatoren wie menschliche Änderungen laufen,
- als COW Preview sichtbar sein,
- menschliches Apply und erforderliches Approval erhalten.

### 20.2 Verbotene KI-Aktionen

KI MUST NOT:

- Hard Reservations überschreiben,
- unbekannte Material-, Asset- oder Validator-IDs erfinden und anwenden,
- einen fehlgeschlagenen Validator unterdrücken,
- Provenienz oder Lizenzangaben erfinden,
- Player- oder Simulation-Deltas verwerfen,
- Approval-Level reduzieren,
- die visuelle Source of Truth von Dokument 01 umdeuten,
- Low Poly oder geglättete Surface-Nets als Hestia-Look vorschlagen,
- Capture-Baselines ohne menschliche Rubrik freigeben.

### 20.3 Proposal-Pipeline

**[PROPOSED]** Der Ablauf lautet:

1. Kontext und Scope einfrieren.
2. KI erzeugt schema-valides Proposal.
3. Compiler löst Referenzen und erzeugt Kandidat.
4. Validatoren prüfen Kandidat.
5. Editor zeigt Diff, Unsicherheiten und Provenienz.
6. Mensch ändert, verwirft oder bestätigt.
7. Prepare berechnet exaktes ChangeSet.
8. Approval und CAS gelten unverändert.
9. Atomarer Commit speichert KI-Provenienz.

**[PROPOSED]** KI-Provenienz SHOULD Modell-ID, Modellversion, Prompt- oder Instruction-Hash, Tool-IDs, Quellreferenzen und menschliche Bearbeitung erfassen, soweit Datenschutz und Produktpolitik dies erlauben.

**[OPEN]** Welche KI-Modelle, lokalen oder externen Dienste verwendet werden und welche Daten sie sehen dürfen, ist nicht Teil dieser Spezifikation.

## 21. Implementierungsgates

### Gate G0: Begriffe und Autorität

**Ziel:** Eine Wahrheit pro Domain.

**MUST:**

- Owner-Domains und kanonische Datensätze benannt,
- Unknown, Air, Missing Coverage und Pending getrennt,
- Derived Product Header implementiert,
- Statuslabels ACCEPTED, PROPOSED, OPEN in Spezifikationen verwendet.

### Gate G1: Profil und deterministischer Chunkkern

**MUST:**

- akzeptiertes 0,25-m-Laborprofil exakt implementiert,
- 32³ Innenzellen, 34³ Samples, X-fast, Uint8, Air 0,
- stabile IDs, Seeds und Sortierung,
- Chunk Order, Worker Count und Repeat Build Tests grün.

**MUST NOT:** 0,125 m als universeller Standard deklarieren.

### Gate G2: World Graph, Hydrologie und Recipes

**MUST:**

- Stage Contract und WorldgenManifest,
- Hydrology Feature Graph,
- BiomeRecipe-Validierung,
- Authored Control Skeleton,
- Seam- und Coverage-QA.

### Gate G3: HVOX Asset Pipeline

**MUST:**

- SourceScene Adapter,
- deterministischer HVOX Compiler,
- MaterialKey Registry,
- AssetImportRecord,
- Lizenz-, Hash-, Bounds- und Anchor-Validierung,
- GLB nur als Derived Product.

### Gate G4: Editor Preview und Transaction Core

**MUST:**

- EditorCommand,
- COW Preview,
- Prepare,
- Approval-Berechnung,
- CAS,
- atomarer Commit,
- exakte Deltas,
- Issue Browser.

### Gate G5: Undo, Revert und Provenienz

**MUST:**

- Preview Undo,
- Published Revert als neuer Commit,
- before-after-current Konfliktprüfung,
- Event- und Revision-Provenienz,
- protected delta policy.

### Gate G6: Settlement Domain

**MUST:**

- CitySite, DistrictIntent, RoadGraph, Block, Parcel, BuildingIntent,
- Lineage und stabile IDs,
- ApprovedCityPlan,
- CityStyleBundle,
- Stadt-QA-Matrix.

### Gate G7: Streaming, LOD und Persistenz

**MUST:**

- Chunkzustände und Revisionen,
- feature ownership,
- blockbewahrendes sichtbares LOD,
- Checkpoint plus Event Replay,
- Rebase, Evict und Missing Coverage Tests.

### Gate G8: Destruktion

**MUST:**

- Face-6 Connectivity,
- Anchors und Unknown-Grenzen,
- atomarer Transfer,
- DamageBinding,
- Save-Reload- und Rebuild-Tests,
- keine Physik-Body-pro-Voxel-Architektur.

### Gate G9: Evidence und Visual Approval

**MUST:**

- VisualCaptureContract,
- reproduzierbarer Runner,
- Buffer- und Metadatenpaket,
- Rubrik aus Dokument 01,
- Evidence-Verknüpfung mit Manifest, Revision und Commit.

### Gate G10: KI-Proposals

**MUST:**

- nur schema-valides Proposal,
- kein direkter Write,
- vollständige Preview-, Validator-, Approval-, CAS- und Commit-Pipeline,
- KI-Provenienz.

**[PROPOSED]** Ein späteres Gate darf nicht durch Mockdaten als abgeschlossen gelten, wenn sein vorheriges Autoritäts- oder Transaktionsgate fehlt.

## 22. Offene Konflikte und Entscheidungsbedarf

| ID | Thema | Status | Aktueller Vertrag | Erforderliche Entscheidung oder Evidenz |
|---|---|---|---|---|
| OPEN-001 | Universelle Voxelgröße | OPEN | 0,25 m ist akzeptiertes Laborprofil; 0,125 m ist scopespezifisch im Adaptive-Authority-Modul akzeptiert, als Hero-/Produktprofil aber nur Kandidat | Planet-, Browser-, Destruktions- und Speicherbenchmark |
| OPEN-002 | Planetentopologie | OPEN | Face-System muss expliziten Seamvertrag haben | Cube-Sphere oder Alternative auswählen |
| OPEN-003 | Hashfunktion | OPEN | deterministische, versionierte Hashfunktion erforderlich | Algorithmus und Bytekodierung festlegen |
| OPEN-004 | Kanonische Serialisierung | OPEN | stabile Feld- und Mengenordnung erforderlich | Format und Normalisierung festlegen |
| OPEN-005 | Session-Historie | OPEN | Published append-only ist gesetzt | linear oder Branch-DAG für Drafts |
| OPEN-006 | Kollaboratives Locking | OPEN | CAS ist Pflicht | pessimistisch, optimistisch oder hybrid |
| OPEN-007 | Approval-Rollen | OPEN | A0 bis A4 vorgeschlagen | Rollen, Reviewerzahl und Trennung festlegen |
| OPEN-008 | Zielgeräte und Budgets | OPEN | Profile müssen Budgets deklarieren | Browser-, GPU-, RAM- und Bandbreitenziele |
| OPEN-009 | Planetare Migration | OPEN | Events und Checkpoints müssen versioniert sein | Supportfenster und Migrationsstrategie |
| OPEN-010 | Generator-Rückkopplung | OPEN | nur begrenzte versionierte Iteration | Iterationsgrenzen pro Stage |
| OPEN-011 | Stadt-Owner-Schwellen | OPEN | Dichte-, Wiederholungs- und Freiraumwerte nicht erfunden | Art-, Game- und Systems-Owner setzen Werte |
| OPEN-012 | Sichtbare Wasserrepräsentation | OPEN | Ufer blockig, Wasser darf Materialfläche sein | Nah-, Mittel- und Fernprofil festlegen |
| OPEN-013 | HVOX-Endformat | PROPOSED | Paketfelder und Autoritätsrolle definiert | Codec-, Kompressions- und Versionierungsspezifikation |
| OPEN-014 | Material-ID-Breite Produktion | OPEN | Uint8 nur akzeptiertes Laborprofil | Palette- und Streamingbenchmark |
| OPEN-015 | Destruktionspersistenz | OPEN | Events schützen Schaden | Game-Design-Policy für Reset und Reparatur |
| OPEN-016 | KI-Datengrenzen | OPEN | KI nur Proposal | Modelle, Datenschutz, Netzwerk und Logging |
| OPEN-017 | Editor-Auslieferung | OPEN | Datenvertrag unabhängig | separates Tool, In-Game oder Hybrid |
| OPEN-018 | 0,125-m-Interop | OPEN | Adaptive-Authority-Vertrag akzeptiert, produktweiter Übergang noch offen | Übergang, Anchors, LOD und Materialisierung |

**[ACCEPTED]** Kein OPEN-Punkt darf durch Implementierungsbequemlichkeit still geschlossen werden. Jede Schließung benötigt Decision Record, Evidenz, Datum, Owner und betroffene Versionsänderung.

## 23. Konformitätscheckliste

Ein System ist zu dieser Spezifikation nur konform, wenn:

- [ ] die aktuelle visuelle Source of Truth aus Dokument 01 verwendet wird,
- [ ] der sichtbare Look aus harten quadratischen Mikrovoxeln besteht,
- [ ] Low Poly, Surface Nets, Marching Cubes und Dual Contouring nicht als dominanter Look auftreten,
- [ ] 0,25 m korrekt als akzeptiertes Laborprofil gekennzeichnet ist,
- [ ] 0,125 m korrekt als scopespezifisch akzeptierter Adaptive-Authority-Wert und zugleich nur vorgeschlagenes Hero-/Produktprofil, nicht als universeller Standard, gekennzeichnet ist,
- [ ] die universelle Voxelgröße als OPEN behandelt wird,
- [ ] kanonische und abgeleitete Daten getrennt sind,
- [ ] jede Domain genau eine aktive Autorität besitzt,
- [ ] Worldgen-Stages versionierte Inputs, Seeds und Outputs besitzen,
- [ ] Hydrologie vor Biome-Detail, Vegetation und Stadtparzellierung liegt,
- [ ] Authored Controls und Locks bindend respektiert werden,
- [ ] Städte über Site, Constraints, Distrikte, Straßen, Blöcke, Parzellen und Gebäude entstehen,
- [ ] HVOX Autorität und GLB Derived Product ist,
- [ ] jeder Write über Command, COW Preview, Prepare, Approval, CAS und atomaren Commit läuft,
- [ ] Undo und Revert Konflikte erkennen,
- [ ] Chunkanfragefolge und Workerzahl den Output nicht ändern,
- [ ] IDs, Seeds, Koordinaten und Hashes explizit sind,
- [ ] Provenienz bis zu Quellen und Approvals zurückverfolgbar ist,
- [ ] sichtbares LOD die blockige Formensprache bewahrt,
- [ ] Persistenz Basis, Events, Checkpoints und Derived Caches trennt,
- [ ] Destruktion Unknown-Grenzen und atomaren Transfer respektiert,
- [ ] Validatoren keine direkten Writes ausführen,
- [ ] Issues stabile Schlüssel und Provenienz besitzen,
- [ ] Captures Kamera, Revision, Renderer, Profile und Hashes fixieren,
- [ ] alle relevanten MUST-PASS-QA-Tests grün sind,
- [ ] KI ausschließlich Vorschläge erzeugt,
- [ ] OPEN-Entscheidungen nicht als bestätigte Produktverträge dargestellt werden.

## 24. Änderungs- und Versionspolitik

**[PROPOSED]** Änderungen an dieser Spezifikation SHOULD nach SemVer behandelt werden:

- Patch: Klarstellung ohne Vertragsänderung,
- Minor: rückwärtskompatible neue Felder, Validatoren oder optionale Stages,
- Major: Änderung von Autorität, Pipelineordnung, Schema, Determinismus, Auflösung oder Transaktionssemantik.

**[PROPOSED]** Jede Änderung MUST:

- Decision Record oder Issue referenzieren,
- Statusänderung ACCEPTED, PROPOSED oder OPEN benennen,
- betroffene Schemata und Migrationen ausweisen,
- QA-Auswirkungen nennen,
- Dokument 01 und Dokument 03 auf Konflikte prüfen,
- GitHub-Commit und Datum erfassen.

**[ACCEPTED]** Eine Änderung, die den Hestia-Look von harten quadratischen Mikrovoxeln zu Low Poly oder einer geglätteten sichtbaren Oberfläche umdeutet, ist keine normale technische Revision. Sie wäre ein expliziter Bruch mit der aktuellen visuellen Source of Truth und benötigt eine neue, vom Owner bestätigte visuelle Baseline.

## Anhang A: Kurzreferenz der Autoritätskette

| Absicht | Kanonischer Plan | Materialisierung | Abgeleitete Ausgabe |
|---|---|---|---|
| Planet und Region | World Graph | Voxel Authority | LOD, Render, Kollision |
| Fluss und Küste | Feature Graph | Voxel und Wasserzustand | Wasser-Render, Navigation |
| Biome und Vegetation | Recipe plus Habitatfelder plus Featureinstanzen | Voxel und HVOX-Placements | Renderinstanzen, Schatten |
| Stadt | Settlement Domain | Voxel plus HVOX-Placements | Mesh, Verkehrscache, UI |
| Asset | Asset Manifest plus HVOX | Placement in Voxelwelt | GLB, Render-Mesh, Collision |
| Schaden | Simulation Authority plus Deltas | Voxelremove und dynamische Komponente | Debris-Mesh, Effekte |
| Editorvorschlag | Editor Session COW | atomarer Commit | aktualisierte Derived Products |
| Evidenz | Capture Contract plus Revision | deterministischer Capturelauf | Bilder, Metriken, Review |

## Anhang B: Minimale Publish-Artefakte

Eine veröffentlichte Worldgen- oder Stadtbaseline SHOULD mindestens enthalten:

1. WorldgenManifest,
2. alle referenzierten Recipe- und Style-Bundle-Hashes,
3. Control-Skeleton-Hash,
4. kanonische Snapshot- oder Event-Revision,
5. Validatorbundle und Ergebnisbericht,
6. erforderliche HVOX-Assetmanifeste,
7. VisualCaptureContracts und Evidence Packages,
8. ApprovedCityPlan, falls Stadt-Coverage enthalten ist,
9. offene Ausnahmen mit Owner und Ablaufdatum,
10. GitHub-Commit, hier 15f3550 für Version 1.0 dieses Dokuments.

## Anhang C: Normative Zusammenfassung

Hestia ist technisch nur dann Hestia, wenn der gesamte Authoringpfad dieselbe visuelle und semantische Wahrheit bewahrt. Die sichtbare Welt besteht aus harten quadratischen Mikrovoxeln. Generatoren arbeiten in stabiler Layerordnung, respektieren menschliche Controls und erzeugen reproduzierbare, versionierte Daten. Städte entstehen aus Graphen, Constraints, Distrikten, Parzellen und Kits, nicht aus zufälligem Objekt-Scatter. HVOX ist die vorgeschlagene Voxel-Assetautorität, GLB ein Derived Product. Jeder Editorwrite läuft durch Copy-on-Write Preview, Prepare, Approval, Compare-and-Swap und atomaren Commit. Undo, Revert, Streaming, LOD, Destruktion und KI-Vorschläge dürfen keine zweite Wahrheit und keinen stillen Datenverlust erzeugen. QA verbindet exakte maschinelle Verträge mit menschlicher Abnahme nach Dokument 01 und dokumentierter Evidenz nach Dokument 03.
