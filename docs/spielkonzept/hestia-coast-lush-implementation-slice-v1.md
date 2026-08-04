# Hestia Coast/Lush – erster World-Generator-Implementierungsslice v1

## Status und Entscheidung

Dieses Dokument ist der vom Benutzer genehmigte **Coast/Lush-B-
Entscheidungsrecord** für die bestehende Route `/?surfacePlay=1`. D1–D8 sind
geschlossen. Die Genehmigung erlaubt keine vorgezogene Produktmutation:
Implementation beginnt erst nach dem in Abschnitt 12 festgelegten frischen
V3.4-Startgate und Coast-Block-0. Das Dokument ändert weder öffentliche
Contracts noch Physics-, Combat- oder Persistence-Wahrheit.

Der erste Slice baut **keine planetweite Welt**. Er ersetzt innerhalb der
bestehenden, endlichen Surface-Play-Region die derzeit visuell flache
Testanordnung durch eine deterministische Coast/Lush-Komposition:

- eine klar lesbare Abfolge aus trockenem Spawn, Küstenraum, Wasser und
  ansteigendem Land;
- eine helle, wolkige Hestia-Atmosphäre mit Vorder-, Mittel- und Hintergrund;
- geschichtete, aber weiterhin gebundene Vegetation;
- genau die bereits autorisierte strukturelle Umbrella-Tree-Spezies;
- keine Stadt, keine neuen Assets, keine neuen Material- oder Scatter-Semantiken.

Damit ist die botanische Referenznähe dieses v1 bewusst begrenzt: Er darf die
vorhandenen Ground-, Sprout-, Cap- und einzelne Umbrella-Tree-Fakten besser
komponieren, erfüllt aber noch nicht die Arten-, Alters- und Kronenvielfalt der
Konzeptbilder. Eine visuell genaue Umbrella-Tree-Morphologie ist ein eigener,
separat freizugebender voxel-autoritärer Slice und darf nicht durch
Presentation-Scaling vorgetäuscht werden.

Die Umsetzung darf erst starten, wenn die Async-/Multithreading-,
Structural-Fire- und Physics-Liveness-Gates des laufenden
Surface-Play-Recovery-Plans **frisch** grün sind. Insbesondere dürfen
Worldgen- und Präsentationsarbeit die bestehenden Tree-/Terrain-Latenz-,
Long-Task-, Rigid-Body-, Collision- und Boundary-Gates nicht überdecken.

### Genehmigter B-Entscheid D1–D8

| ID | Bindender Entscheid |
| --- | --- |
| D1 | Exakte Coast-Identität, fester Anchor `(64, 8, -32)` und kein Candidate-Fallback gemäß Abschnitt 3. |
| D2 | Exakte Makroprimitive, Masken, Operatoren, Blend-Reihenfolge und BandFloor gemäß Abschnitt 6. |
| D3 | Exakte Warp-/Noise-/Materialformeln und unveränderte fünf Material-IDs gemäß Abschnitt 6. |
| D4 | Ausschließlich `Shore`/`WetDepression`, 2-m-Lattice, 4-neighbor-Topologie und World-owned Wasserhöhen gemäß Abschnitt 8. |
| D5 | Exakte Scatter-Zonen und genau ein unveränderter Structural Umbrella Tree gemäß Abschnitten 7 und 9. |
| D6 | Bytegleicher V1-Pfad, Exact-Eight-Generatorgate, Human-Golden-Gates und S1–S3-Scopes gemäß Abschnitt 12. |
| D7 | R09–R13 primär, R14/R18 nur als Water-/Shore-Crosscheck sowie exakte Coast-Palette, Sky-, Licht- und Water-Profile gemäß Abschnitten 1 und 8. |
| D8 | Gepinnter Acceptance-Host/-Browser/-Graphics-Run; unveränderte V3.4-Frame-/Adoption-/Long-Task-Gates und erst in Block 0 neu abzuleitende Coast-Caps gemäß Abschnitt 13. |

Es gibt innerhalb D1–D8 keine offene Produktentscheidung. Spätere Biome,
City, zusätzliche Baumarten, Mangrove-/Wurzelmorphologie, globale Welt und
Terrain-Fracture bleiben eigene Slices.

## Auditgrundlage und Evidence-Grenze

Geprüfte Grundlagen:

- `docs/spielkonzept/hestia-biome-design-foundation-v0.md`;
- `.agent/PLANS.md`;
- `docs/roadmap/living-master-plan.md`;
- `docs/spielkonzept/hestia-procedural-voxel-world.md`;
- `docs/spielkonzept/on-planet-first-person-mode.md`;
- `docs/browser-mainline/hestia-first-person-combat-slice-v1.md`;
- `docs/browser-mainline/hestia-first-person-combat-slice-v1-recovery-execplan.md`;
- `.devtoolbox/specs/changes/browser-hestia-first-person-combat-slice-v1/tests/manual-play-rejection-analysis-2026-07-27.md`;
- aktueller Dirty-Quellstand der Hestia-Worldgen-, SurfaceWorld-,
  Environment-, Tree-Presentation-, Three-Backend- und Graphics-Settings-Pfade;
- alle 18 eindeutigen Inhalte der 23 PNG-Dateien unter
  `C:\IFI_SourceCode\Temp\WeltraumSpiel\docs\Konzeptart\Hestia`;
- die acht vorhandenen Surface-Play-Screenshots im Worktree, darunter
  `intermediate-sky-2026-07-28.png`,
  `intermediate-tree-shape-2026-07-28.png` und die gespeicherte
  Boundary-/Tree-/Physics-Fehlevidence.

Ein passiver Browser-Readback war in dieser Sitzung nicht erreichbar. Wegen
der ausdrücklichen Vorgabe, keinen Browser-Click und keinen Reload auszulösen,
wurde kein neuer Lauf gestartet. Aussagen zum Current State sind deshalb
bewusst auf die vorhandenen User-Screenshots, den aktuellen Dirty-Quellstand
und die gespeicherten Runtime-/Teardown-Dokumente begrenzt. Insbesondere ist
der bereits im Quellstand vorhandene neue Sky-Shader **noch keine frisch
bestätigte visuelle Evidence**.

`Teardown` ist ausschließlich Referenz für lesbare physische
Voxel-/Destruktionsqualitäten. Dieses Dokument übernimmt weder Assets noch
Trade Dress, Palette, UI oder konkrete Levelgestaltung daraus.

## 1. Reference inventory

Alle Basenames beginnen mit `ChatGPT Image 28. Juli 2026, `. Die
SHA-256-Präfixe dienen der eindeutigen Inhaltszuordnung; die Duplikate wurden
über den vollständigen SHA-256 geprüft.

| ID | Primärdatei | Exakte Duplikatdatei | Format | SHA-256-Präfix | Sichtbarer Inhalt | Rolle |
| --- | --- | --- | --- | --- | --- | --- |
| R01 | `15_37_12 (1).png` | – | 1672×941 | `630BA59BFF03FFF3` | Küstenmetropole an weiter Bucht, biophile Türme, Inseln, heller Wolkenhimmel | City-/Landmark-Referenz, deferred |
| R02 | `15_37_12 (2).png` | – | 1672×941 | `434BB7B4D6F62A08` | dichter grüner Stadtraum mit Platz- und Verkehrsebenen | City-/Landmark-Referenz, deferred |
| R03 | `15_37_13 (3).png` | – | 1672×941 | `B55110645FF2E4E7` | terrassierte Küstenstadt mit Kanälen und Inseln | City-/Landmark-Referenz, deferred |
| R04 | `15_37_14 (4).png` | – | 1672×941 | `EFDE150DEF95F808` | Küstenraumhafen mit Startvehikel und ferner Skyline | Spaceport-/City-Referenz, deferred |
| R05 | `15_37_14 (5).png` | – | 1672×941 | `07A33CCB05E7D2F8` | industrieller Waterfront-/Spaceport-Raum | Spaceport-/City-Referenz, deferred |
| R06 | `15_37_33 (1).png` | – | 1536×1024 | `D90A9C3C35264222` | mehrteilige „Hestia Gaia Prime“-City-Übersicht | City-Vokabular, deferred |
| R07 | `15_37_34 (2).png` | – | 1536×1024 | `3816233B50EA58B5` | mehrteilige futuristische Stadtübersicht | City-Vokabular, deferred |
| R08 | `15_37_39.png` | – | 1536×1024 | `7022D31C51C79CD9` | Board mit aridem, Hochland-/Nadelwald-, Vulkan-, Kristall- und Savannenbiom | spätere Biome, deferred |
| R09 | `15_37_44 (1).png` | `15_38_27 (1).png` | 1672×941 | `8AB48C29F87D268A` | helle grüne Hügel, gestaffelte Schirmkronen, klarer Himmel | Coast/Lush Primärreferenz |
| R10 | `15_37_44 (2).png` | `15_38_27 (2).png` | 1672×941 | `06EBF22CEA9FE366` | dicht bewaldete Insel, türkisfarbenes Meer, helle Felsstufen | Coast/Lush Primärreferenz |
| R11 | `15_37_44 (3).png` | `15_38_28 (3).png` | 1672×941 | `EE03A72D078BD9EC` | gewundener Fluss-/Lagunenraum zwischen bewaldeten Höhen | Coast/Lush Primärreferenz |
| R12 | `15_37_45 (4).png` | `15_38_28 (4).png` | 1672×941 | `81DCB0AFB0040FA4` | offenes Grasland, niedrige Felsstufen, einzelne Umbrella Trees | Coast/Lush Primärreferenz |
| R13 | `15_37_45 (5).png` | `15_38_28 (5).png` | 1672×941 | `2328F9185BD045C0` | helle bewachsene Senke mit Meer und Fernsilhouetten | Coast/Lush Primärreferenz |
| R14 | `15_38_41 (1).png` | – | 1672×941 | `91CE98F904B2F073` | Archipel aus flachen Inseln, hellem Gestein und türkisem Wasser | sekundärer Water-/Shore-Crosscheck |
| R15 | `15_38_41 (2).png` | – | 1672×941 | `156AC9FAA18A87E7` | flache Wetland-Kanäle, wurzelnde Schirmbäume und Ufervegetation | Mangrove-/Wurzelmorphologie deferred; nur Kompositionskontext |
| R16 | `15_38_41 (3).png` | – | 1672×941 | `4EFF5D7BF613C5C6` | gestufte Inselchen, klares Wasser und farblich geschichtete Pflanzen | nichtnormativer Serienkontext |
| R17 | `15_38_42 (4).png` | – | 1672×941 | `21FDA7307C807BCB` | türkisfarbener Flusskorridor zwischen Terrassen und ferner Küste | nichtnormativer Serienkontext |
| R18 | `15_38_42 (5).png` | – | 1672×941 | `3EB1DC89F71EB696` | flache Lagune/Felspools, Inseln, Umbrella Trees und Fernsilhouette | sekundärer Water-/Shore-Crosscheck |

Inventurergebnis: **23 PNG-Dateien, 18 eindeutige Inhalte, 5 exakte
Duplikate**. R09–R13 bilden den primär normativen visuellen Vertrag dieses
Slices. R14 und R18 dienen ausschließlich als sekundäre Water-/Shore-
Crosschecks und dürfen die Komposition nicht in eine wasserdominierte
Archipelwelt verschieben. R15 ist nur räumlicher Kontext; Mangrove-, Wurzel-
und Wetland-Traversal-Morphologie bleibt deferred. R16/R17 bleiben
nichtnormativer Serienkontext. R01–R07 liefern nur späteres Landmark-/City-
Vokabular; R08 belegt ausschließlich deferred Biome.

Aus R09–R13 abgeleitete und mit R14/R18 ausschließlich für Water/Shore
gegengeprüfte Merkmale:

- helle, warme Fels- und Küstenstufen;
- gesättigte, nicht neonartige grüne Landmassen;
- dunklere feuchte Vegetationszonen;
- türkisfarbene Flachwasser- und klarere Fernwasserwirkung;
- kleine Cyan-, Violett- und warme Akzente nur in der Vegetation;
- heller Himmel, weiße Wolken, atmosphärisch abgeschwächte Fernformen.

Die bindenden D7-Farb-, Water-, Sky-, Cloud-, Fog- und Lichtwerte stehen in
Abschnitt 8. Sie sind reine Presentation-Profile und keine neuen Material-IDs
oder World-Semantiken.

### 1.1 Normativer und sekundärer visueller Vertrag

| Referenz | Bindender Beitrag für v1 | Explizite Grenze |
| --- | --- | --- |
| R09 | helle grüne Hügel, gestaffelte Umbrella-Canopy-Silhouetten, klar getrennte Horizon-/Zenith-Zone | keine neue Baumart oder zweite Structural-Tree-Instanz |
| R10 | zusammenhängende türkisfarbene Küste, bewaldete Inselmasse und helle Felsstufen als drei lesbare Makroflächen | keine Tiefwasser-, Schwimm- oder Insel-Streaming-Wahrheit |
| R11 | gewundener Fluss-/Lagunenraum zwischen gestaffelten Höhen statt einzelner Hex-Pfützen | keine Strömung und kein neues Water-Gameplay |
| R12 | offenes, traversierbares Grasland mit niedrigen Felsstufen und bewusst freien Sichtkorridoren | keine zusätzliche Small-/Hero-Tree-Klasse in v1 |
| R13 | helle bewachsene Senke, lesbare Fernküste und atmosphärisch abgeschwächte Silhouette | keine gebaute Landmarke oder Fake-Skyline |
| R14 (sekundär) | Water-/Shore-Farbe, helle Strata und klare Ground-Trennung gegenprüfen | keine globale Inselwelt; keine Änderung der aus R09–R13 abgeleiteten Gesamtkomposition |
| R15 (Kontext) | nur die räumliche Abfolge aus flachem Wasser, Ufer und dichterer Feuchtvegetation | Mangrove-Wurzeln, wurzelnde Baumform und Wetland-Traversal sind deferred und kein v1-Acceptance-Gate |
| R16/R17 (Kontext) | keine normative v1-Abnahme; nur Serieninventar | keine zusätzliche Palette, Spezies, Wasserform oder Traversal-Truth |
| R18 (sekundär) | Lagunen-/Felspool-Farbe und Water-/Shore-Staffelung gegenprüfen | keine pixelgleiche Pflanzenvielfalt und keine wasserdominierte Archipelkomposition |

Die visuelle Prüfung muss jede Referenz und den zugehörigen Runtime-Capture auf
denselben `1920×1080`-Vergleichsraum bringen. Für ein Referenzbild mit Breite
`Wr` und Höhe `Hr` gilt ohne Stretch, Crop oder Motivverschiebung:

```text
s  = min(1920 / Wr, 1080 / Hr)
ox = (1920 - Wr * s) / 2
oy = (1080 - Hr * s) / 2
```

Das Referenzbild wird mit dem einheitlichen Faktor `s` bei `(ox, oy)` zentriert;
der Runtime-Capture bleibt nativ `1920×1080`. Erst diese beiden gleich großen
Frames werden nebeneinander verglichen. Ein Screenshot ohne den zugehörigen
same-viewport Referenzframe ist keine visuelle Acceptance-Evidence.

## 2. Current-vs-target matrix

| Bereich | Current State/Evidence | Ziel aus R09–R13; R14/R18 sekundär | Konkreter Slice-Entscheid |
| --- | --- | --- | --- |
| Land-/Wasser-Makrogliederung | Die gespeicherten Screenshots zeigen überwiegend eine zusammenhängende hellgrüne Testfläche; vorhandene Wasser-Patches ergeben noch keine lesbare Küstenform. | Meer, Küste, Land, Senke/Höhe und Insel-/Terrassenform sind auf einen Blick unterscheidbar. | Eine neue versionierte Coast/Lush-Generatoridentität erzeugt genau eine zusammenhängende Küsten-/Lagunenform innerhalb der bestehenden Region. |
| Terrain-Silhouette | Horizont und Spielfeld wirken flach; die Grenzen werden als Testfeld statt als Landschaft lesbar. | sanfte Hügel, niedrige Plateaus, Felsstufen und mindestens eine starke natürliche Fernsilhouette | Spawn-Shelf, Coast-Basin, Ridge-Backplate und eine niedrige Fels-/Terrassenfolge werden als deterministische World-Formen gepinnt. |
| Himmel | Vorhandene Screenshots zeigen ein großes blaues Feld mit dünnen Wolkenbändern; der Dirty-Quellstand enthält bereits einen unbestätigten Sky-/Cloud-Shader. | helle Wolkenatmosphäre, klare Horizon-/Zenith-Trennung, atmosphärische Tiefe | Der vorhandene Surface-Environment-Shader bleibt Ausgangspunkt; er wird nicht als fertig behauptet und muss in drei festen Ansichten gegen R09–R13 belegt werden. |
| Fernstaffelung | `Fog(near=110 m, far=320 m)` liegt weit außerhalb der wirksamen Tiefe des 64-m-Slices; Vorder-, Mittel- und Hintergrund verschmelzen. | Vegetation, Ridge und Himmel bilden mindestens drei Tiefenebenen. | Surface-Fog wird presentationsseitig auf den endlichen Slice kalibriert: Start `28 m`, Ende `112 m`; keine World-Wahrheit wird daraus abgeleitet. |
| Terrainmaterial | Aktuelle Profile sind überwiegend dunkel grün/braun/türkis und zeigen wenig helle Küstenstrata. | helle Felsstufen, trockene helle Flächen, dunklere feuchte Zonen und sattes Grün | Die fünf bestehenden Material-IDs bleiben unverändert; nur ihre Hestia-Coast/Lush-Presentation-Profile und Prioritäten werden neu kalibriert. |
| Wasser | Die World besitzt `Shore`-/`WetDepression`-Patches, präsentiert als instanzierte Sechsecke; eine zusammenhängende Wasserfläche ist in der Evidence nicht belegt. | klare, ruhige, zusammenhängende Lagune/Küste mit lesbarer Uferkante | Bestehende World-Patches bleiben Autorität; Presentation rendert daraus maximal zwei optisch zusammenhängende Batches für `Shore` und `WetDepression`, ohne Tiefe oder Strömung zu erfinden. |
| Vegetationsschichtung | Kleine Kegel-/Cap-Scatter und einzelne blockige Bäume; offene Fläche dominiert. | Ground Cover, feuchte Uferzone, Understory, mittlere Schicht und Umbrella-Canopy mit bewusst freien Sichtkorridoren | Nur vorhandene Scatter-Kinds werden zoniert verdichtet; Spawn-/Bewegungskorridor bleibt frei. Neue Arten, Mesh-Assets oder solide Fake-Bäume sind ausgeschlossen. |
| Baummaßstab | Der aktuelle Baum besitzt gemessen etwa `82–88 %` freie Stammhöhe und eine Kronenbreite von nur `0,62–0,86` seiner Gesamthöhe. | Die R09–R13-Schirmbäume lesen sich mit etwa `45–60 %` freier Stammhöhe und einer Kronenbreite von `0,9–1,4` der Gesamthöhe. | v1 darf Material und Lesbarkeit verbessern, aber die belegte Proportionslücke nicht durch Three-/Presentation-Scaling kaschieren. Genaue Referenznähe benötigt einen separat genehmigten voxel-autoritären Morphology-Slice. |
| Gebaute Landmarken | Keine autorisierte Landmark-Assetquelle im Surface-Play-Slice. | R01–R07 und einzelne Fernformen zeigen gebaute Orientierungspunkte. | Keine prozedurale Stadt und kein erfundenes Gebäude. Der erste Slice nutzt nur eine natürliche Ridge-/Fels-Landmarke. |
| Voxel-/Destruktionslesbarkeit | Tree-/Terrain-Evidence zeigt facettierte, aber grobe und teilweise blockige Silhouetten; P0-Latenz/Physik ist offen. | klar lesbare physische Voxelgliederung mit stabiler Silhouette | `Teardown` bleibt Qualitätsreferenz, nicht Assetquelle. Voxelgröße, Structural Authority und Editpfad bleiben unverändert; Coast/Lush darf diese Gates nicht verschlechtern. |

## 3. Scope und deterministische Identität

### 3.1 Unveränderte Slice-Grenzen

- Region: `64 × 32 × 64 m`;
- Voxelgröße: `0,5 m`;
- resident: `16` Bricks (`4 × 1 × 4`);
- Sea Level: `0 m`;
- Test-/Spielroute: exakt `/?surfacePlay=1`;
- TestBridge: auf der Route weiterhin vollständig abwesend;
- keine Streaming-, Planet-, LOD-, City-, Wetter- oder Editor-Erweiterung.

### 3.2 Zwei erlaubte, atomare interne Identitäten

Die bestehende V1-Ausgabe darf nicht still verändert werden. Seed-Ableitung,
Generation Key, Worker-Request/-Result, Voxel Authority und Brick Cache
akzeptieren genau die folgenden vollständigen Tupel. Ein Mischpaar wird vor
Seed-Ableitung fail-closed abgewiesen.

| Feld | bestehender V1-Pfad | Coast/Lush B |
| --- | --- | --- |
| Preset-ID | `hestia.nebelwald-archipelago.preview.v1` | `hestia.coast-lush.surface-play.preview.v1` |
| Generator-Version | `hestia.microvoxel.generator.v1` | `hestia.microvoxel.generator.coast-lush.v1` |
| Seed-Namespace | `hestia.seed.v1` | `hestia.seed.coast-lush.v1` |
| Root-/Route-Seed | `hestia-surface-play-v1` | `hestia-surface-play-coast-lush-v1` |
| Surface-Frame-ID | `frame:surface_hestia_surface_play_v1` | `frame:surface_hestia_surface_play_v1` |
| Region-ID | `region:hestia.surface-play.v1` | `region:hestia.surface-play.coast-lush.v1` |
| Fixture-ID | bestehendes Surface-Play-v1-Fixture | `hestia.surface-play.coast-lush.fixture.v1` |
| Presentation-Policy-ID | `hestia-surface-presentation.v1` | `hestia-surface-presentation.coast-lush.v1` |

Der Coast-Pfad behält bewusst denselben Surface Frame: Das Koordinatensystem
ändert sich nicht. Preset-ID, Generator-Version und Seed-Namespace sind dagegen
eine atomare Auswahl und werden gemeinsam in Seed-Tupel, Generation Key,
Worker-Request/-Result, Authority-Identität und Cache-Key gebunden. Region-,
Voxel-, World- und Presentation-Hashes ändern sich für das neue Fixture
erwartungsgemäß. Es gibt keine Save-Migration.

Die Coast-Domain-Seeds werden ausschließlich so abgeleitet:

```text
FNV1a32(
  "hestia.seed.coast-lush.v1\0"
  + rootSeed + "\0"
  + bodyId + "\0"
  + surfaceFrameId + "\0"
  + presetId + "\0"
  + generatorVersion + "\0"
  + domain
)
```

`regionId`, Brickkoordinate und Voxelgröße gehören weiterhin in den Generation
Key, nicht in den Domain Seed; benachbarte Regionen und die zulässigen
Voxelgrößen müssen dasselbe kontinuierliche Feld abtasten.

### 3.3 Fester Coast-Anchor und Footprint

- Der einzige Coast-Candidate liegt bei World-XZ `(64, -32)`.
- Seine Ground-Höhe muss exakt `8 m` sein; der Anchor ist damit
  `(64, 8, -32)`. Andernfalls endet die Auswahl typed/fail-closed als
  `NoAdmissibleLandFootprint`.
- Es gibt keinen 81-Candidate-Fallback, keine Translation und keinen Retry.
- Das Vertical Band bleibt exakt `[0, 32) m`.
- Die Brick Bounds bleiben `x:[2,6)`, `y:[0,1)`, `z:[-4,0)`, also exakt
  `4 × 1 × 4 = 16` Bricks.
- Im Shelf-/Corridor-Core ist die Breakup-Amplitude exakt null; deshalb kann
  der Anchor nicht nachträglich von `8 m` abweichen.

## 4. Deterministische World Truth vs Presentation

| Fakt | Owner/Autorität | Presentation darf | Presentation darf nicht |
| --- | --- | --- | --- |
| Generator-ID, Version, Seed | Hestia Worldgen/Preset | als Evidence protokollieren | still umdeuten oder alte Version überschreiben |
| Density, Surface-Höhe, Material-ID | Hestia Generator und Voxel Authority | meshen, beleuchten, farblich profilieren | Höhen, Kollision oder Materialsemantik aus Pixeln/Three-Objekten ableiten |
| Sea Level `0 m` | Hestia Preset/SurfaceWorld | Wasserfläche an der publizierten Höhe darstellen | Wasserhöhe kameraabhängig verschieben |
| Dry Cells, Traversal, Spawn, Boundary | `hestiaSurfaceWorld.ts` | als Boden, Ufer und natürliche Barriere projizieren | begehbare Zellen, Clearance oder Collision erfinden |
| Shore-/Wet-Depression-Patches | `world.environment.waterPatches` | zu kohärenten Renderbatches gruppieren | Deep Water, Strömung oder Schwimmbarkeit behaupten |
| Decorative Scatter | `world.environment.decorativePopulation` | Instanzen, LOD und render-only Density anwenden | solide Collision, Ressourcen oder Interaktion vortäuschen |
| Structural Umbrella Tree | World Encounter + Structural/Tree Runtime | autoritative Snapshots rendern | Position, Scale, Fallzustand oder Destruktion aus Three.js zurückschreiben |
| Himmel, Wolken, Fog, Licht | Surface Environment Presentation | rein visuell projizieren | Wetter-, Tageszeit- oder Hazard-Truth behaupten |
| natürliche Landmarke | Generator-Density/Material | Silhouette und atmosphärische Tiefe zeigen | ein Gebäude oder authored POI ohne World-Fakt vortäuschen |

World- und Presentation-Hashes bleiben getrennt. Eine Änderung an
Himmel/Licht/Fog darf keinen World-Hash ändern; eine Änderung an
Density/Material/Scatter muss die zuständige World-/Voxel-/Presentation-
Signatur reproduzierbar ändern.

## 5. Sea-Level, Spawn und Dry-Boundary

### 5.1 Bindende Regeln

- Sea Level bleibt exakt `0 m`.
- Jede als Dry zugelassene Surface-Zelle hält mindestens `1 m` vertikale
  Wasserfreiheit.
- Spawn-Slope bleibt `≤ 12°`; allgemein zugelassene Surface-Slope `≤ 50°`.
- Der maximale Höhenunterschied benachbarter `0,5-m`-Zellen bleibt `≤ 0,4 m`.
- Die zugelassene zusammenhängende Dry-Komponente bleibt mindestens
  `32 × 32 m`.
- V1/default behält mindestens `12 m` geodätische Distanz zur Dry-Perimeterkante.
  Coast/Lush B verwendet ausschließlich die benannte Preview-Policy
  `hestia.surface-world-admission.coast-lush-preview.v1` mit exakt `8,5 m`.
  Die Policy ist auf den festen Coast-Anchor begrenzt: die genehmigte
  Komposition liefert im aktuellen Generator dort `8,778174593... m`, also
  `0,278174593... m`
  Reserve. Sie ändert weder den globalen V1-Wert noch Post-Edit-Revalidation.
- Der bestehende resident inset von `8 m` bleibt unverändert.
- Der klare Bewegungskorridor bleibt mindestens `4,5 m` breit, `18 m` vor
  und `6 m` hinter dem Anchor; dort liegen weder Wasser- noch
  Decorative-Population-Fakten.
- Der Structural Tree bleibt mindestens `6 m` vom Spawn entfernt und darf die
  Spawn-Capsule nicht schneiden.

### 5.2 Küstenanordnung

Der Generator wählt genau eine kanonische Komposition relativ zum
World-Anchor:

1. ein trockenes, weitgehend ebenes Spawn-Shelf um den Anchor;
2. einen vom Spawn sichtbaren, aber nicht in den klaren Bewegungskorridor
   ragenden Shore-/Lagunenraum;
3. einen trockenen, begehbaren Overlook zwischen Spawn und Shore;
4. eine gegenüberliegende Ridge-/Terrassenkante als natürliche
   Mid-/Background-Landmarke;
5. einen trockenen Rückweg ohne Sprung-, Snap- oder Velocity-Zero-Shortcut.

Die Dry-Boundary bleibt Runtime-owned. Ihre sichtbare Tarnung entsteht nur aus
autoritativen Terrainformen:

- auf der Wasserseite durch Shore/Wasser;
- auf der Landseite durch ansteigendes, nicht traversierbares Gestein und
  Vegetationsdichte;
- an keiner Stelle durch eine unsichtbare Presentation-Wand, ein sichtbares
  Void oder per-Tick-Nachgenerierung.

Wiederholtes Drücken gegen jede der vier Grenzen darf weder Worldgen, Remesh
noch Collider-Rebuild auslösen.

## 6. Terrain-Makroformen

Der Coast/Lush-Slice verwendet die bestehenden deterministischen Noise-Domains
(`macro-elevation`, `island-ridge`, `rock-breakup`, Domain Warp,
`wet-depressions`, Biological) unter der neuen Generator-Version. Neue
Seed-Domains sind für v1 nicht erforderlich.

Die Dichtefunktion wird von „gleichförmige Platte plus Mikrovariation“ auf
folgende geordnete Makrokomposition kalibriert:

| Form | Deterministische Anforderung | Sichtbare Aufgabe |
| --- | --- | --- |
| Spawn-Shelf | Dry, spawnfähig, durch bestehende Slope-/Step-Regeln zugelassen | ruhiger Vordergrund und klare erste Laufrichtung |
| Coast Basin | zusammenhängende Zone mit `Shore`- und optional `WetDepression`-Fakten; keine isolierte Hex-Pfützenlesbarkeit | Meer-/Küsten-Makrogliederung |
| Overlook/Low Terrace | trockene Verbindung mit gültiger Capsule-Clearance | sichtbarer Übergang von Gras/Fels zu Wasser |
| Ridge Backplate | Crest mindestens `4 m` über der medianen Spawn-Surface und mindestens `12 m` horizontal vom Spawn entfernt | markante natürliche Fernsilhouette |
| Rock Steps | niedrige, zusammenhängende helle Strata; keine zufälligen Einzelzacken | Referenznähe zu R10/R12; R14 prüft nur Water-/Shore-Strata sekundär gegen |
| Wet Fold | dunklere Senke an Shore/Wetland, außerhalb des Spawn-Korridors | Referenznähe zu R11; R15-Mangroveform bleibt deferred |

Harte Akzeptanz:

- keine über mehr als die halbe Bildbreite gerade, flache Terrain-Horizontlinie
  in einem der drei festen Viewpoints;
- keine sichtbare Resident-Y-Cap-Fläche;
- kein traversierbarer Cliff-/Void-Ausgang;
- kein Surface-Nets-Loch, Non-Finite-Vertex oder Brick-Seam;
- identische Inputs erzeugen identische Density-, Material-, Scatter-,
  World- und Presentation-Hashes.

### 6.1 Koordinaten, Masken und Operatoren

Lokale Koordinaten relativ zum festen Anchor sind:

```text
u = x - 64
v = -32 - z
```

`+v` zeigt beim Spawn-Yaw `π` nach vorn. Für gewarpte Naturformen gelten
`px = u + WarpX` und `pz = v - WarpZ`. Shelf, Corridor und Overlook bleiben
ungewarpt. `segmentDistance` ist die euklidische Distanz zum auf `[0,1]`
geklemmten Segmentprojektionspunkt. Jede Maske verwendet exakt:

```text
t = clamp((distance - core) / (outer - core), 0, 1)
smoothstep(core, outer, distance) = t*t*(3 - 2*t)
mask(distance, core, outer) = 1 - smoothstep(core, outer, distance)
lerp(a, b, m) = a*(1-m) + b*m
```

| Maske | Geometrie in lokalen Koordinaten | Core/Outer | Operator |
| --- | --- | --- | --- |
| `MShelf` | Zentrum `(0, 0)` | `8/13 m` | `H = lerp(H, 8, MShelf)` |
| `MCorridor` | Segment `(0, -6) → (0, 18)` | `2.25/3.75 m` | `H = lerp(H, 8 - 0.10*clamp(v - 6, 0, 12), MCorridor)` |
| `MBasin` | Segment `(21, -17) → (21, 17)` auf `(px, pz)` | `2/20 m` | `H = lerp(H, -0.50, MBasin)` |
| `MOverlook` | Zentrum `(10, 5)` | `2/9 m` | `H = H + 2.50*MOverlook` |
| `MRidgeNorth` | Segment `(-20, 27) → (10, 27)` auf `(px, pz)` | `3/10 m` | Bestandteil von `MRidge` |
| `MRidgeWest` | Segment `(-28, -22) → (-28, 27)` auf `(px, pz)` | `2/8 m` | Bestandteil von `MRidge` |
| `MRidgeSouth` | Segment `(-22, -28) → (20, -28)` auf `(px, pz)` | `2/8 m` | Bestandteil von `MRidge` |
| `MStepOuter` | Zentrum `(-13, 2)` auf `(px, pz)` | `8.5/10 m` | `H = H + 0.35*MStepOuter` |
| `MStepMiddle` | dasselbe Zentrum | `5.5/7 m` | `H = H + 0.35*MStepMiddle` |
| `MStepInner` | dasselbe Zentrum | `2.5/4 m` | `H = H + 0.35*MStepInner` |
| `MWetFold` | Segment `(7, 14) → (14, -8)` auf `(px, pz)` | `1.5/4 m` | `H = H - 1.10*MWetFold` |

`MRidge = max(MRidgeNorth, MRidgeWest, MRidgeSouth)` und sein Operator ist
`H = H + 6.25*MRidge`.

### 6.2 Exakte Warp-/Noise-Felder

Alle `fbm2`-/`fbm3`-Aufrufe behalten Lacunarity `2`, Gain `0,5` und die
bestehende normalisierte Amplitudensumme.

```text
WarpX = 1.25 * fbm2(domain-warp-x, x/32, z/32, 2)
WarpZ = 1.25 * fbm2(domain-warp-z, x/32, z/32, 2)

Nmacro = fbm2(macro-elevation, (x+WarpX)/24, (z+WarpZ)/24, 3)
Nridge = 2*ridgedFbm2(island-ridge, (x+WarpX)/14, (z+WarpZ)/14, 2) - 1
Nwet   = 0.5 + 0.5*valueNoise2(wet-depressions, (x+WarpX)/12, (z+WarpZ)/12)
Nbio   = 0.5 + 0.5*fbm2(material-biological, (x+WarpX)/8, (z+WarpZ)/8, 3)

Hbase = 6.25 + 0.30*Nmacro + 0.20*Nridge
Nbreakup = fbm3(rock-breakup, (x+WarpX)/4, y/4, (z+WarpZ)/4, 2)
```

### 6.3 Bindende Blend-Reihenfolge und BandFloor

Die Operatoren laufen ausschließlich in dieser Reihenfolge:

```text
Hbase
→ Basin
→ WetFold
→ Overlook
→ StepOuter
→ StepMiddle
→ StepInner
→ Ridge
→ Shelf
→ Corridor
→ BandFloor
→ density-only breakup
```

Der BandFloor hält das 16-Brick-Band tatsächlich renderbar und verhindert,
dass analytische Water-Facts Boden unterhalb des Mesh-Bands behaupten:

```text
Hshape = max(0, HafterCorridor)
Abreakup =
  0.10
  * clamp(Hshape / 0.10, 0, 1)
  * (1 - max(MShelf, MCorridor))

density = fround(y - Hshape + Abreakup*Nbreakup)
```

Es gibt keine weitere Zwischenrundung. `fround` erfolgt genau an der finalen
Density-Grenze. Im Shelf-/Corridor-Core ist `Abreakup=0`; im Basin kann
Breakup die bei `0 m` gekappte Terrainfläche nicht wieder unter das
Vertical Band drücken.

### 6.4 Exakte Materialpriorität

Die fünf vorhandenen Material-IDs bleiben unverändert und werden in dieser
Reihenfolge klassifiziert:

1. `ShallowWaterBoundary`, wenn `abs(y) <= 0.50` und
   `abs(density) <= 0.75`.
2. `SolidRock`, wenn `surfaceHeight-y >= 1.50` oder `MRidge >= 0.55` oder
   `max(MStepOuter,MStepMiddle,MStepInner) >= 0.35`.
3. `WetSoil`, wenn `abs(density) <= 1.00` und mindestens eine Bedingung gilt:
   `MWetFold >= 0.35`; `Nwet >= 0.62`; oder
   `MBasin >= 0.60 && surfaceHeight <= 2.00`.
4. `DenseBiologicalSurface`, wenn `abs(density) <= 1.00` und
   `Nbio >= 0.56`.
5. Sonst `MossCover`.

Water → Rock → Wet → Biological → Moss ist bindend. Eine sechste Material-ID
oder Presentation-basierte Re-Klassifikation ist verboten.

## 7. Coast/Lush vegetation stratification

Die Schichtung wird mit den vorhandenen Fakten erreicht, nicht mit neuen
Arten oder Assets:

| Schicht | World-Fakt | Verteilung | Presentation |
| --- | --- | --- | --- |
| Ground | bestehende Material-IDs `wet_soil`, `moss_crust`, `dense_biological_mat` | trockene, feuchte und biologisch dichte Zonen aus den vorhandenen Feldern | facettierte, source-kalibrierte Materialprofile |
| Shore Edge | `Shore`-/`WetDepression`-Fakten plus Ground-Material | gebündelt entlang der Coast-Basin, nicht im Clear Corridor | niedrig, dicht und dunkler als das trockene Shelf |
| Understory | `cyan_luminous_sprout` | kleine Gruppen in feuchten und biologisch dichten Zellen | vorhandene prozedurale Geometrie; keine Solid-/Collision-Behauptung |
| Accent/Mid Layer | `cyan_luminous_cap` | seltener als Sprouts, in asymmetrischen Clustern | vorhandene prozedurale Geometrie; Akzent statt flächiger Cyan-Teppich |
| Canopy Landmark | genau ein `hestia.umbrella-tree.v1` | bestehende World-owned Encounter-Platzierung außerhalb des Spawn-Corridors | Structural Snapshot, kein render-only Baum |

Der Scatter-Generator behält `2 m` Spacing, deterministischen Jitter, Scale und
Sortierung. Der Slice darf Accept-/Kind-Schwellen unter der neuen
Generator-Version neu kalibrieren, aber weder `HestiaScatterKind` erweitern
noch `black_trunk` als dekorativen Fake-Baum ausgeben.

Bindend bleiben Jitter `±0,70 m`, Yaw `[0,2π)`, Scale `[0,80,1,35)` und die
kanonische Sortierung `z → x → ASCII-ID`. Zonen werden in Tabellenreihenfolge
ausgewertet; `kindRoll < Sprout-Schwelle` erzeugt `cyan_luminous_sprout`,
sonst `cyan_luminous_cap`:

| Zone | Erste passende Bedingung | Accept | Sprout-Schwelle |
| --- | --- | ---: | ---: |
| Excluded | Ground `<1 m`, Spawn-Radius `<=4 m` oder Clear Corridor | `0` | – |
| Overlook | `MOverlook >= 0,50` | `0,08` | `0,80` |
| Wet Edge | `MWetFold >= 0,35` oder (`MBasin >= 0,58` und `Hshape <= 2,25`) | `0,62` | `0,94` |
| Rock/Ridge | Step-Max `>=0,35` oder `MRidge >=0,55` | `0,14` | `0,72` |
| Lush | `Nbio >= 0,56` | `0,54` | `0,84` |
| Open Shelf | übrige trockene Fläche | `0,24` | `0,80` |

Coast-Scatter-IDs verwenden exakt
`hestia.scatter.coast-lush.v1:<scatterAcceptSeedHex>:<anchorX>:<anchorZ>`.
`black_trunk` besitzt im Coast-Profil keine Kind-Range. Kein Scatter-Fakt darf
Spawn, Clear Corridor, einen Water-Fakt oder eine nicht trockene Zelle
überlappen.

Maximal entstehen im `64 × 64 m` Footprint aus dem `2-m`-Raster jeweils
`1.024` geprüfte Water- bzw. Scatter-Zellen. Presentation bleibt instanziert
und erzeugt keine Object3D-pro-Fakt-Kaskade.

Bewusst noch nicht vollständig erfüllt ist die mehrstufige Baumkronenschicht
aus R09–R13. Die fehlende botanische Vielfalt ist eine bekannte
Acceptance-Grenze dieses v1, kein durch Farbe oder Scatter-Dichte schließbares
Detail. Weitere World-owned Structural-Tree-Platzierungen, Größenklassen,
Spezies und R15-Mangroveformen benötigen eigene Runtime-, Collision-,
Destruction- und Performance-Freigaben.

## 8. Sky, atmosphere, lighting und water

### 8.1 D7-Materialpalette

Die fünf World-Material-IDs bleiben unverändert. sRGB ist der Review-Token;
die Presentation verwendet die angegebenen linearen Werte.

| Rolle | sRGB | Linear RGB | Alpha |
| --- | --- | --- | ---: |
| Moss / `MossCover` | `#6E9F45` | `(0,155926, 0,346704, 0,059511)` | `1,00` |
| Dense / `DenseBiologicalSurface` | `#2F6038` | `(0,028426, 0,116971, 0,039546)` | `1,00` |
| Wet / `WetSoil` | `#4E5D3E` | `(0,076185, 0,109462, 0,048172)` | `1,00` |
| Shallow / `ShallowWaterBoundary` | `#69B8AE` | `(0,141263, 0,479320, 0,423268)` | `1,00` |
| Rock / `SolidRock` | `#A89B72` | `(0,391572, 0,327778, 0,168269)` | `1,00` |
| Shore-Strata-Tint | `#CBBF94` | `(0,597202, 0,520996, 0,296138)` | `1,00` |
| Water-Basis | `#4CC6C2` | `(0,072272, 0,564712, 0,539479)` | profilabhängig |
| Water-Depth-Tint | `#1C7884` | `(0,011612, 0,187821, 0,230740)` | nur Tint |

Shore-Strata sind ausschließlich eine Presentation-Modulation vorhandener
`SolidRock`-/`ShallowWaterBoundary`-Grenzen, keine sechste Material-ID und
keine Height-/Collision-Mutation.

### 8.2 Himmel, Wolken und Fog

- Ein Surface-owned Shader bleibt alleiniger Himmel-Owner.
- Horizon ist `#C5EAF4`, linear `(0,558340,0,822786,0,904661)`; Zenith ist
  `#4B9FD8`, linear `(0,070360,0,346704,0,686685)`.
- Der Gradient ist exakt `smoothstep(0.10, 0.88, skyHeight)`.
- Die Sonne ist `#FFF0C2`, linear `(1,000000,0,871367,0,539479)`, mit
  normalisierter Richtung `(-0,359407,0,838617,0,409325)` und Elevation
  `56,994°`. Disc/Halo verwenden Exponenten `256/18` und Gewichte
  `0,75/0,07`.
- Wolkenfarbe ist `#F7FAF4`, linear `(0,930111,0,955973,0,904661)`. Die
  bestehende Surface-Noise-Projektion verwendet vier Oktaven, Startgewicht
  `0,55`, Gewichtsfaktor `0,48`, Frequenzfaktor `2,03`, Basisscale `1,30`,
  Threshold `smoothstep(0,56,0,72,noise)`, unteres Höhenband `0,02→0,24`,
  oberes Höhenband `0,68→0,92` und finalen Cloud-Mix `0,80`.
- Es gibt kein Time-Uniform und keine Wetter-/Wind-Wahrheit.
- Linearer Fog ist `#A8CFD8`, linear
  `(0,391572,0,623960,0,686685)`, `near=28 m`, `far=112 m`.
- Die ehemalige flache grün/cyan wirkende Background-/Underwater-Lesbarkeit
  ist in allen drei Viewpoints ein harter Reject.

### 8.3 Licht

- `surfacePlayPresentation.ts` behält den Three-Backend-Modus
  `lightingMode: "None"`.
- `hestiaSurfaceEnvironment.ts` bleibt alleiniger Owner von Hemisphere-,
  Ambient-, Key- und Rim-Licht.
- Hemisphere: `#DDF4FF/#8F9B6F`, Intensität `1,80`.
- Ambient: `#A7CAD2`, Intensität `0,35`.
- Key: `#FFE7B3`, Intensität `3,00`, Position `(-28,42,17)`.
- Rim: `#A6D9F5`, Intensität `0,55`, Position `(27,15,-31)`.
- Es gibt keine zweite generische Three-Lichtkette und keine neuen Shadow-Maps.

### 8.4 World-Wasser, Topologie und zwei Renderbatches

World-Facts entstehen auf dem bestehenden half-open `2-m`-Raster mit maximal
`1.024` Kandidaten und Scale `1,16`:

```text
Shore = MBasin >= 0.60 && groundHeight <= 0.25
WetDepression =
  !Shore
  && MWetFold >= 0.55
  && Nwet >= 0.58
  && groundHeight < 1.00

Shore.y = 0.055
WetDepression.y = groundHeight + 0.045
```

Kein Water-Fakt liegt im Clear Corridor oder auf einem `dryCellKey`.
Topologie wird ausschließlich über 4-neighbor-Nachbarschaft auf diesem Raster
bewertet: Es gibt exakt eine `Shore`-Komponente, die mindestens einen Patch im
östlichsten residenten Brick `x=5` besitzt, und höchstens eine zusätzliche
`WetDepression`-Komponente. Presentation darf getrennte World-Komponenten
nicht zu einer behaupteten World-Komponente verschmelzen.

Presentation verwendet exakt zwei `THREE.MeshStandardMaterial`-Batches:

| Profil | Alpha | Roughness | Metalness | Depth-Tint-Mix |
| --- | ---: | ---: | ---: | ---: |
| `Shore` | `0,52` | `0,30` | `0` | `0,12` |
| `WetDepression` | `0,58` | `0,38` | `0` | `0,28` |

Beide Batches verwenden `transparent=true`, `depthWrite=false`,
`depthTest=true`, `FrontSide`, keine Transmission, Refraction, Flow-, Wave-
oder Normalanimation. Die Farbe wird komponentenweise im linearen RGB-Raum
berechnet: `waterColor = WaterBasis*(1-tint) + WaterDepthTint*tint`.

Wasserhöhe kommt ausschließlich aus den publizierten World-Fakten. Farbe oder
scheinbare Tiefe begründen weder Deep Ocean noch Strömung, Schwimmen,
Collision, Hazard oder Sichtweitenmechanik. Shoreline, Ground Mesh und
Collision müssen dieselbe World-Höhe abbilden. Maximal zwei Water- und zwei
Scatter-`InstancedMesh`-Batches ergeben höchstens vier zusätzliche
Environment-Batches; Sky bleibt genau ein separater fixer Draw.

## 9. Tree scale und species

Der bindende Structural Tree bleibt:

| Feld | Entscheidung |
| --- | --- |
| Species-ID | `hestia.umbrella-tree.v1` |
| Fixture/Instance | bestehende Surface-Play-Umbrella-Fixture |
| Structural Level | `4` |
| Base Quantum | `0,125 m` |
| Größenklasse | `Medium` |
| Trunk Height | deterministisch `5,4–6,6 m` |
| Primär-/Sekundäräste | bestehender Graph `5 + 5` |
| Canopy Lobes | bestehende `4` |
| Anzahl im Runtime-Slice | exakt `1` |

Die Coast-Platzierung behält Species
`hestia.umbrella-tree.v1`, Instance
`hestia.surface-play.umbrella.phase2` und Seed
`hestia.surface-play.umbrella.phase2-seed`. Ihr World-XZ ist exakt
`(58,-42)`, also `(-6,+10)` relativ zum Anchor. Daraus folgen
`rootQuantum.x=464` und `rootQuantum.z=-336` bei `0,125 m` Base Quantum.
Die Coast-Y-Position wird **nicht** als alter V1-Golden `72` übernommen:

```text
rootQuantum.y = floor(groundHeight(58, -42) / 0.125)
```

Der konkrete Coast-Y-Wert und alle daraus abgeleiteten Tree-/Graph-/Object-
Hashes werden erst im Human-Golden-Gate gepinnt. Nur der unveränderte alte
V1-Pfad behält seinen bisherigen `{464,72,-336}`-Golden.

Presentation darf Root, Wood und Canopy source-näher kalibrieren, aber weder
Graph noch Scale verändern. Der Baum muss in Spawn Overview und Ridge Lookback
als zusammenhängende Schirmbaum-Silhouette lesbar sein; schwebende Kronen,
unverbundene Äste oder ein maßstabsloser Blockstamm sind Rejects.

Für die Proportionsprüfung gelten ausschließlich voxel-autoritär kompilierte
Bounds:

```text
Ht   = graph.trunkHeightMeters
Htot = ymax(all occupied tree cells) - ymin(all occupied tree cells)
F    = ymin(canopy occupied cells) - ymin(all occupied tree cells)
C    = max(xmax - xmin, zmax - zmin) over all occupied tree cells
D    = ymax(canopy occupied cells) - ymin(canopy occupied cells)
freeTrunkRatio = F / Htot
crownWidthRatio = C / Htot
crownDepthRatio = D / Htot
```

Der aktuelle Source-/Compilerpfad besitzt `Ht = 5,4–6,6 m`,
`Htot = 1,14–1,22 × Ht`, `freeTrunkRatio = 0,82–0,88`,
`crownWidthRatio = 0,62–0,86` und nur `0,07–0,09` Kronentiefe bei vier
Loben. Die sichtbaren Referenzsilhouetten liegen bei etwa `0,45–0,60` freier
Stammhöhe, `0,9–1,4` Kronenbreite und `0,18–0,30` Kronentiefe mit `2–5`
breiten, unregelmäßigen Loben. Diese Bereiche sind Designmessungen, keine
stillen v1-Generatorparameter.

Stop Rule: Soll der Baum die Referenzproportionen tatsächlich erreichen, muss
ein eigener Slice `hestiaUmbrellaTree.ts` als Graph-/Morphologie-Owner und
`surfaceTreeAuthority.ts` als voxel-autoritären Compiler ändern und alle
Collision-, Damage-, Support-, Mass-, Fall- und Hash-Gates neu schließen.
`hestiaStructuralTreePresentation.ts` darf die Lücke weder durch Scale noch
durch zusätzliche Rendergeometrie schließen.

`Small`, weitere `Medium` und `Hero` Trees sowie zusätzliche Spezies bleiben
deferred. Die aktuelle Runtime verlangt ausdrücklich genau eine Structural
Umbrella Tree Placement; eine Erweiterung wäre ein eigener
World-/Runtime-/Collision-/Performance-Contract-Slice.

## 10. Exakte Owner-Module und Dateien

| Owner | Exakte Datei | Spätere Implementierungsaufgabe |
| --- | --- | --- |
| Preset/Version | `apps/weltraum-browser/src/world-generation/hestia/preset.ts` | neue Coast/Lush-ID und Generator-Version ergänzen; alte Identität unverändert lassen |
| Density/Makroform | `apps/weltraum-browser/src/world-generation/hestia/densityGenerator.ts` | Spawn-Shelf, Coast Basin, Ridge und Wet Fold unter neuer Version kalibrieren |
| Materialklassifikation | `apps/weltraum-browser/src/world-generation/hestia/materialClassifier.ts` | bestehende fünf Material-IDs auf trockene/feuchte/rockige Strata abstimmen |
| Scatter | `apps/weltraum-browser/src/world-generation/hestia/scatterGenerator.ts` | bestehende Kinds deterministisch zonieren; keine neuen Kinds |
| Seed-Domains | `apps/weltraum-browser/src/world-generation/hestia/seed.ts` | nur bestehende Domains verwenden und deren Stabilität testen |
| Generator Exports | `apps/weltraum-browser/src/world-generation/hestia/index.ts` | beide bekannten Identitäten explizit exportieren; kein Default-Aliaswechsel |
| Worker Identity | `apps/weltraum-browser/src/workers/protocol.ts`, `streamingWorker.ts` | genau zwei erlaubte Preset-/Generator-/Namespace-Tupel, Mischpaare fail-closed |
| Brick Cache | `apps/weltraum-browser/src/streaming/voxelBrickCache.ts` | vollständige Coast-Identität im Generation-/Cache-Key binden |
| Surface-Play-Generatorwahl | `apps/weltraum-browser/src/surface-play/surfacePlayConfig.ts` | Route auf neue Preset-/Generator-/Seed-Identität binden |
| Voxel Edit Authority | `apps/weltraum-browser/src/surface-play/voxel-edit/authority.ts` | Coast-Tupel akzeptieren, Generatoridentität vollständig validieren |
| Ground Probe | `apps/weltraum-browser/src/surface-play/world/hestiaSurfaceGroundProbe.ts` | identische Coast-Formeln/Identität ohne Presentation-Rückschluss abtasten |
| World/Spawn/Dry/Environment Facts | `apps/weltraum-browser/src/surface-play/world/hestiaSurfaceWorld.ts` | vorhandene Regeln beibehalten; neue Komposition auswählen und pinnen |
| Materialprojektion | `apps/weltraum-browser/src/surface-play/environment/hestiaSurfacePresentation.ts` | source-kalibrierte Profile und Presentation-Signatur |
| Sky/Licht/Wasser/Decor | `apps/weltraum-browser/src/surface-play/environment/hestiaSurfaceEnvironment.ts` | Atmosphäre, Fog, zwei Wasserbatches und instanziertes Scatter rendern |
| Structural Tree Morphology Source | `apps/weltraum-browser/src/surface-play/vegetation/hestiaUmbrellaTree.ts` | in v1 unverändert; nur ein separat genehmigter Morphology-Slice darf Graph, Stamm-/Kronenproportion oder Größenklassen ändern |
| Structural Tree Voxel Compiler | `apps/weltraum-browser/src/surface-play/vegetation/surfaceTreeAuthority.ts` | in v1 unverändert; kompiliert die Source-Morphologie als Structural Authority |
| Structural Tree Render | `apps/weltraum-browser/src/surface-play/environment/hestiaStructuralTreePresentation.ts` | ausschließlich Material-/Silhouettenprojektion; keine Scale-/State-Autorität |
| Integration | `apps/weltraum-browser/src/surface-play/surfacePlayPresentation.ts` | bestehende Owner-Reihenfolge und `lightingMode: "None"` sichern |
| World Units | `apps/weltraum-browser/tests/unit/hestiaSurfaceWorld.test.ts` | Komposition, Dry-/Spawn-/Boundary-Fakten und deterministische Wiederholung |
| Generator Units | `apps/weltraum-browser/tests/unit/hestiaDensityGenerator.test.ts`, `hestiaSeedDeterminism.test.ts`, `hestiaScatterGenerator.test.ts` | neue Identität, Density-/Material-/Scatter-Goldens, alte Identität unverändert |
| Presentation Units | `apps/weltraum-browser/tests/unit/hestiaSurfacePresentation.test.ts` | World-/Presentation-Trennung, Profile, Water-/Scatter-Bounds |
| Tree Units | `apps/weltraum-browser/tests/unit/hestiaUmbrellaTreeAuthority.test.ts`, `hestiaStructuralTreePresentation.test.ts` | bestehende Medium-/Graph-/Hash-Gates unverändert |
| Real Browser/Evidence | `apps/weltraum-browser/tests/e2e/hestia-first-person-combat-slice.spec.ts` | drei Viewpoints auf normaler Route, Browser-Health und Performance |
| Real-Input Driver | `apps/weltraum-browser/tests/e2e/support/surfacePlayDriver.ts` | vorhandene Mouse-/Keyboard-/Screenshot-/Frame-Probes wiederverwenden |

Nicht zu ändern sind für diesen Slice:

- `apps/weltraum-browser/src/surface-play/contracts/index.ts`;
- öffentliche Surface-Play-/Structural-/Collision-/Combat-Verträge;
- Graphics-Settings-Schema und Presets;
- Package-/Lockfiles und E2E-Gruppenmitgliedschaft;
- Specs, Tasks und bestehende Evidence-Dateien.

## 11. Contract-Auswirkung

### 11.1 Keine öffentliche Contract-Änderung

Der Slice benötigt keine neuen Felder, Unions, Commands, Events, Snapshots oder
Failure Codes. Insbesondere bleiben unverändert:

- `HestiaSurfaceWorld`-Shape;
- Dry-/Traversal-/Shore-Fakten;
- `HestiaScatterKind`;
- Material-Semantik-IDs;
- Structural Tree-/Body-/Collision-Verträge;
- Surface-Player-/Combat-/HUD-Verträge;
- Graphics Preferences V2.

### 11.2 Absichtliche interne Behavior-/Hash-Auswirkung

Die neue Preset-/Generator-/Seed-Kombination erzeugt neue deterministische
Density-, Material-, Scatter-, Region-, Voxel- und Presentation-Hashes. Diese
Änderung ist kein Schemawechsel, muss aber in Goldens und Evidence explizit
sichtbar sein. Unter gleicher Identität bleibt jede Ausgabe bytegleich.

### 11.3 Fail-closed-Gate

Vor Freigabe muss folgender Contract-Diff leer bleiben:

```powershell
git diff --exit-code -- apps/weltraum-browser/src/surface-play/contracts/index.ts
```

## 12. Staged implementation blocks

### 12.0 Bindende Prioritätsreihenfolge

1. Dieser korrigierte B-Entscheidungsrecord ist genehmigt; das allein startet
   noch keine Codeänderung.
2. Die V3.4 Async-/Structural-Fire-/Rigid-Body-/Physics-/Performance-Gates
   werden auf dem aktuellen Quellstand frisch grün.
3. Coast-Block 0 pinnt Current-Baseline, Metric-Semantik, Host und Viewpoints.
4. S1 implementiert ausschließlich versionierte Generator Truth.
5. Zwei getrennte Node-22-Prozesse erzeugen Coast-Kandidaten; ein Mensch
   genehmigt erst danach die exakten Generator-Goldens.
6. S2 integriert Identität, Worker/Cache, Authority, Ground Probe und World
   Facts. Er startet erst, wenn überlappende V3.4-Worker-/Authority-Owner frei
   und grün sind.
7. Ein Mensch genehmigt Anchor, Bounds, Water, Scatter, Tree und World-Goldens.
8. S3 implementiert ausschließlich Presentation und vorhandene Browser-
   Evidence-Harness-Anpassungen.
9. Chrome vergleicht die drei festen Runtime-Captures gegen R09–R13; R14/R18
   bleiben sekundäre Water-/Shore-Crosschecks.

Kein späterer Punkt darf einen roten früheren Punkt durch bessere Screenshots
verdecken. Coast-Evidence darf nie als Begründung eines grünen Core-Gates
dienen. Die gemessene Baumproportionslücke bleibt ein separater, späterer
voxel-autoritärer Morphology-Slice.

### 12.1 Exakte S1–S3-Write-Scopes

**S1 — Generator Truth**

Schreibbar:

```text
apps/weltraum-browser/src/world-generation/hestia/coastLushProfile.ts
apps/weltraum-browser/src/world-generation/hestia/densityGenerator.ts
apps/weltraum-browser/src/world-generation/hestia/index.ts
apps/weltraum-browser/src/world-generation/hestia/materialClassifier.ts
apps/weltraum-browser/src/world-generation/hestia/preset.ts
apps/weltraum-browser/src/world-generation/hestia/scatterGenerator.ts
apps/weltraum-browser/src/world-generation/hestia/seed.ts
apps/weltraum-browser/tests/unit/hestiaDensityGenerator.test.ts
apps/weltraum-browser/tests/unit/hestiaScatterGenerator.test.ts
apps/weltraum-browser/tests/unit/hestiaSeedDeterminism.test.ts
```

Das Generatorinventar enthält danach exakt acht Module: die sieben genannten
Produktdateien plus unverändertes `noise.ts`. Der vorhandene AST-/Dependency-
Scan bleibt gleich streng. Stop bei irgendeinem V1-Byte-/Hash-/Scatter-Drift,
bei einem neunten Modul oder vor Human-Golden-Approval.

**S2 — Identity, Authority und World Facts**

Schreibbar:

```text
apps/weltraum-browser/src/world-generation/hestia/preset.ts
apps/weltraum-browser/src/world-generation/hestia/seed.ts
apps/weltraum-browser/src/world-generation/hestia/densityGenerator.ts
apps/weltraum-browser/src/world-generation/hestia/index.ts
apps/weltraum-browser/src/workers/protocol.ts
apps/weltraum-browser/src/workers/streamingWorker.ts
apps/weltraum-browser/src/streaming/voxelBrickCache.ts
apps/weltraum-browser/src/surface-play/surfacePlayConfig.ts
apps/weltraum-browser/src/surface-play/voxel-edit/authority.ts
apps/weltraum-browser/src/surface-play/world/hestiaSurfaceGroundProbe.ts
apps/weltraum-browser/src/surface-play/world/hestiaSurfaceWorld.ts
apps/weltraum-browser/tests/unit/hestiaSurfaceGroundProbe.test.ts
apps/weltraum-browser/tests/unit/hestiaSurfaceWorld.test.ts
apps/weltraum-browser/tests/unit/hestiaSurfaceWorldCompatibility.test.ts
apps/weltraum-browser/tests/unit/surfacePlayShoreBoundary.test.ts
apps/weltraum-browser/tests/unit/surfaceVoxelEdit.test.ts
apps/weltraum-browser/tests/unit/voxelWorkerProtocol.test.ts
```

Stop bei Mischidentität, Anchor-Fallback, anderer Brickzahl, Dry-/Slope-/Step-
oder Corridor-Fehler, falscher Water-Komponentenzahl, zweitem Structural Tree,
V1-Drift oder wenn ein öffentlicher Contract nötig würde.

**S3 — Presentation und Chrome-Acceptance**

Schreibbar:

```text
apps/weltraum-browser/src/surface-play/environment/hestiaSurfacePresentation.ts
apps/weltraum-browser/src/surface-play/environment/hestiaSurfaceEnvironment.ts
apps/weltraum-browser/src/surface-play/surfacePlayPresentation.ts
apps/weltraum-browser/tests/unit/hestiaSurfacePresentation.test.ts
apps/weltraum-browser/tests/unit/surfacePlayEnvironment.test.ts
apps/weltraum-browser/tests/unit/surfacePlayPresentation.test.ts
apps/weltraum-browser/tests/e2e/hestia-first-person-combat-slice.spec.ts
apps/weltraum-browser/tests/e2e/support/surfacePlayDriver.ts
```

Stop bei World-/Collision-/Persistence-Hashänderung durch Presentation, mehr
als vier Environment-Instanced-Batches plus Sky, erfundener Water-/Vegetation-
Truth, rotem Frame-/Health-Gate oder wenn visuelle Verbesserung nur aus Farbe
oder Fog statt aus der genehmigten World-Makroform entsteht.

In keinem Slice schreibbar sind `surface-play/contracts/index.ts`, Combat,
Physics, Persistence, HUD, Settings-Schema, Package-/Lockfiles oder ein neuer
E2E-Gruppeneintrag.

### Block 0 – Startgate und Baseline

Start nur, wenn:

- die aktiven Async-/Structural-Fire-/Physics-/Performance-Gates grün sind;
- ein eigener Spec-/ExecPlan die Umsetzung freigibt;
- der aktuelle Seed-/Hash-/Screenshot-Baselinezustand gespeichert ist;
- die drei Viewpoints mit der bestehenden Szene reproduzierbar erreichbar sind;
- der gepinnte Host Chrome, WebGL/ANGLE, `High`, FOV `50°`, effektive DPR `1`
  und `1920×1080` aus der laufenden Runtime zurückliest;
- jede frische Baseline-Metrik ID, Einheit, Aggregation (`wall`, `sum`, `max`,
  `p95`), Start-/End-Mark, Samplezahl, Seed, Quellstand und Viewpoint bindet.

Stop Rule: Bei rotem Tree-/Terrain-/Boundary-/Physics-Gate keine
Worldgen-/Presentation-Änderung beginnen.

### Block 1 – Versionierte Worldgen-Makroform

1. alte Preset-/Generator-Goldens pinnen;
2. neue Coast/Lush-Identität ergänzen;
3. Spawn-Shelf, Coast Basin, Ridge und Wet Fold in `densityGenerator.ts`
   implementieren;
4. Materialklassifikation mit unveränderten IDs kalibrieren;
5. deterministische Units und Hash-Goldens schließen.

Stop Rule: Keine Presentation-Arbeit, solange Dry-/Spawn-/Density-/Material-
Goldens rot sind.

### Block 2 – SurfaceWorld-Komposition

1. neue Generatoridentität in `surfacePlayConfig.ts` wählen;
2. World-Candidate, Vertical Band, Dry Component und Spawn neu ableiten;
3. Shore-/Wet-Depression-Fakten und Clear Corridor prüfen;
4. genau eine vorhandene Structural-Tree-Platzierung beibehalten;
5. alle vier Boundary-Liveness-Units schließen.

Stop Rule: Jede sichtbare Küstenform, die Dry/Collision/Spawn nur
presentationsseitig vortäuscht, wird verworfen.

### Block 3 – Terrain, water und atmosphere presentation

1. fünf bestehende Materialprofile gegen R09–R13 kalibrieren; R14/R18 prüfen
   ausschließlich Water-/Shore-Wirkung sekundär gegen;
2. Water Patches zu maximal zwei kohärenten Instanced Batches projizieren;
3. Sky-/Cloud-Shader, Fog `28–112 m` und bestehende Lichtkette abstimmen;
4. keine Shadow-Maps, neuen Assets oder Palette ohne Referenzvergleich;
5. Spawn Overview und Coast Overlook als erste visuelle Gates schließen.

Stop Rule: Wenn eine Änderung World Truth aus Three.js ableitet oder
Performance-/Health-Gates verletzt, zurück auf den letzten grünen Block.

### Block 4 – Vegetationsschichtung und Tree Presentation

1. vorhandene Sprout-/Cap-Fakten zoniert verteilen;
2. Spawn-/Movement-Corridor und Shore-Overlook freihalten;
3. vorhandenen Medium-Umbrella-Tree ohne Scale-/Graph-Änderung kalibrieren;
4. Ridge Lookback und Tree-Silhouette schließen.

Stop Rule: Kein dekorativer Solid Tree, keine zweite Structural-Tree-Instanz
und keine neue Spezies in v1.

### Block 5 – Fresh Gates und Evidence

1. Units, Build und fokussiertes Surface-Play-E2E frisch ausführen;
2. drei feste Screenshots mit Runtime-/World-/Camera-Fakten speichern;
3. R09–R13 mit dem jeweiligen Current Capture im gemeinsamen `1920×1080`-
   Vergleichsraum nebeneinander prüfen; R14/R18 bleiben sekundäre Water-/
   Shore-Crosschecks und R15 bleibt deferred;
4. Browser Health, Frame-/Long-Task- und bestehende Action-Latenz-Gates
   auswerten;
5. erst danach Spec-/Task-Completion-Preflight.

## 13. Unit-, E2E- und Performance-Budgets

### 13.1 Unit-Gates

- alte Preset-/Generator-Version: alle bisherigen Goldens unverändert,
  einschließlich canonical V1 brick `contentHash = fnv1a64:12d868170450df55`;
- neue Version: gleicher Seed erzeugt identische Density-, Material-, Scatter-,
  World-, Region-, Voxel- und Presentation-Hashes;
- anderer Seed ändert mindestens einen World-Fakt, aber keine Contract-Shape;
- Sea Level exakt `0 m`;
- `16` residente Bricks und Voxelgröße `0,5 m`;
- Dry Clearance `≥ 1 m`;
- Spawn-Slope `≤ 12°`, Surface-Slope `≤ 50°`,
  Neighbor-Step `≤ 0,4 m`;
- Dry-Komponente mindestens `32 × 32 m`; V1 Spawn-Perimeter `≥ 12 m`, Coast B
  Preview-Perimeter `≥ 8,5 m` unter der benannten Coast-Policy,
  Inset `8 m`;
- Clear Corridor `4,5 m × 24 m` ohne Water-/Decor-Fakten;
- genau ein Structural Tree, Abstand zum Spawn `≥ 6 m`;
- Tree Species/Graph/Trunk Height `5,4–6,6 m` unverändert;
- Water-/Scatter-Iteration maximal je `1.024` Rasterkandidaten;
- keine Non-Finite-Samples, ungültigen Surface-Nets-Artefakte oder Brick-Seams.

### 13.2 E2E-Gates

Auf `/?surfacePlay=1` bei `1920×1080`, installiertem Chrome und ohne
`window.TestBridge`:

- Route erreicht `data-surface-play-state="ready"`;
- Browser Health enthält keine Console-, Page-, Request- oder HTTP-Fehler;
- alle drei Viewpoints werden ausschließlich mit dem vorhandenen
  `SurfacePlayDriver` über reale Maus-/Tastaturinputs erreicht;
- World-/Player-/Camera-Fakten werden nur über den bestehenden read-only
  Snapshot-Probe protokolliert;
- jede Aufnahme bindet Seed, Generator-Version, Region-/Voxel-Hash,
  Anchor, Sea Level, Playerposition, Yaw/Pitch, Dry-/Water-/Scatter-Anzahl und
  Structural-Tree-Root;
- vier Boundary-Replays bleiben live, ohne Generation-, Remesh- oder
  Collision-Churn;
- vorhandene Terrain-/Tree-/Crater-/Fall-Replays bleiben grün.

### 13.3 Performance-Budgets

Der normative Acceptance-Host für dieses Ticket ist fest gepinnt; er beweist
keine Portabilität auf schwächere Hardware:

| Fakt | Bindender Wert |
| --- | --- |
| CPU/RAM | Intel Core Ultra 7 255H, `16` logische Prozessoren, `32 GiB` |
| GPU/WebGL | Intel Arc Pro 140T GPU, `16 GB`, WebGL2 über ANGLE D3D11 |
| OS | Windows 10 Enterprise `25H2`, Build `26200.8893` |
| Chrome | `150.0.7871.187`, SHA-256 `115A87374083A409EB4B3D0204CBAEA8A0E27EEB264CB0B9D3E4C19C378F54D1` |
| Graphics | `High`, Render Scale `1`, FOV `50°`, effektive DPR `1`, `1920×1080`, Tone Mapping `None`, Exposure `1`, Decor Density `1`, AA an, effektive Shadows aus |

Die früheren Werte `11.597 ms` Cold route-to-ready, `21.297 ms`
aggregierte Worker-Generation, `1.559 ms` aggregiertes Meshing, `328 ms`
aggregierter Upload sowie `126.714` Vertices, `42.238` Triangles und
`3.294.549` Meshbytes sind **nur historische Kandidatenobergrenzen**. Sie
sind wegen nicht vollständig gepinnter Messsemantik keine Coast-Acceptance-
Gates. Block 0 misst auf obigem Host fünf Cold Runs frisch, trennt Wall Time
von summierter Worker-/Meshing-/Upload-Zeit und pinnt erst danach je Metrik
`ceil(freshBaselineMax * 1.10)` samt vollständiger Provenienz. Bis dahin darf
kein stale Wert einen Build akzeptieren oder ablehnen.

Vererbte harte Budgets:

- Tree Structural Preflight pro gepinntem Hit `≤ 80 ms`;
- Immediate Feedback p95 `≤ 50 ms`;
- Worker Authority p95 `≤ 150 ms`;
- Real-Input click-to-visible adopted Structural Revision p95 `≤ 250 ms`;
- Main Validation/Commit p95 `≤ 4 ms`, max `≤ 8 ms`;
- Whole-Frame p50/p95/p99 `≤ 16,7/22/33,3 ms`;
- kein Browser Long Task `> 100 ms`;
- kein Stall `≥ 1.000 ms`;
- null stale/cancelled Adoption;
- Regiongröße, Brickzahl, Voxelgröße und Structural-Tree-Anzahl wachsen nicht.

Coast/Lush-spezifische Gates:

- maximal vier instanzierte Environment-Batches zusätzlich zum Terrain:
  `Shore`, `WetDepression` und die zwei vorhandenen Scatter-Gruppen; keine
  Object3D-pro-Fakt-Kaskade;
- Warm-Browser-Messung je Viewpoint über mindestens `2.000 ms`, protokolliert
  mit Framezeit `mean/p50/p95/max` und Long Tasks;
- p95 und max dürfen gegenüber der unmittelbar vor Block 1 aufgenommenen
  gleichen Viewpoint-/Hardware-/Graphics-Baseline nicht um mehr als `10 %`
  steigen;
- die vererbten absoluten Whole-Frame-Gates bleiben bindend; neue Coast-
  Cold-/Generation-/Geometry-Caps entstehen ausschließlich aus Block 0.

## 14. Drei feste Screenshot-Viewpoints und visuelle Acceptance

Alle Viewpoints werden bei `1920×1080` auf der normalen Route aufgenommen.
Die Testprobe darf World-/Camera-Fakten lesen, aber Position oder Kamera nicht
setzen. Bewegung und Blicksteuerung erfolgen ausschließlich über reale
Maus-/Tastaturinputs; Yaw/Pitch und Zielposition werden mit Toleranz
nachgeregelt.

Die Capture-Projektion ist für alle drei Gates fest: vertikales FOV `50°`,
Aspect `16:9`, Viewport `1920×1080`. Ohne eine zukünftige Generatoridentität
werden keine absoluten XYZ-Koordinaten erfunden. Für eine autoritative
Surface-Zelle `cell`, einen Eye-Punkt `E` und ein World-owned Blickziel `T`
gelten:

```text
eye(cell) = (cell.x, cell.groundHeight + 1.62, cell.z)
yaw(E,T) = atan2(T.x - E.x, T.z - E.z)
pitch(E,T) = atan2(T.y - E.y, hypot(T.x - E.x, T.z - E.z))
```

`cell.x` und `cell.z` sind die autoritativen Zellmittelpunkte in Metern;
`cell.groundHeight` ist die World-owned Surface-Höhe. Für die nichtleere,
kanonisch sortierte Menge `S` aller World-owned `Shore`-Positionen gilt:

```text
shoreCentroid = (1 / |S|) * sum(position(s) for s in S)
```

Fehlt `S`, ist das Coast/Lush-Fixture ungültig und der Capture stoppt; die
Presentation darf keinen Ersatzpunkt erzeugen.

### V1 – `coast-lush-spawn-overview`

- Eye: `eye(anchorCenter)`, also Anchor-Mittelpunkt plus `1,62 m` Eye-Höhe;
- Yaw: initial `π ± 0,01 rad`;
- Pitch: `0 ± 0,02 rad`;
- Zustand: Idle/Grounded, keine Edit-/Combat-Aktion.

Acceptance:

- trockenes Spawn-Shelf im Vordergrund;
- klarer freier Bewegungskorridor;
- Medium-Umbrella-Tree als verbundene Midground-Silhouette;
- mindestens eine Ridge-/Terrassenform hinter dem Vordergrund;
- heller Horizon-/Zenith-Verlauf und erkennbare Wolken;
- keine flache Terrainkante über mehr als die halbe Bildbreite.

Primärvergleich: R09, R12 und R13.

### V2 – `coast-lush-shore-overlook`

- Zielzelle: `argmin(distanceXZ(cell, shoreCentroid), gridZ, gridX)` über alle
  traversierbaren Dry-Zellen mit mindestens `1 m` Water Clearance;
- Eye: `eye(Zielzelle)`;
- Positionstoleranz: `≤ 0,75 m`;
- Blickziel: `shoreCentroid`; Sollwinkel ausschließlich über `yaw(E,T)` und
  `pitch(E,T)`, Toleranz je `≤ 0,03 rad`;
- Anreise: realer Walk vom Spawn, kein Snap.

Acceptance:

- eine zusammenhängende türkisfarbene Wasser-/Küstenform;
- sichtbare helle Fels-/Shore-Strata zwischen Dry Land und Wasser;
- keine Hex-Checkerboard-Lücken oder schwebenden Patches;
- Vordergrund-Ufer, mittlere Wasserfläche und Ridge/Fernhorizont sind getrennt;
- Dry-/Collision-Evidence stimmt mit der sichtbaren Uferkante überein.

Primärvergleich: R10 und R11. R14 ist ausschließlich sekundärer Water-/Shore-
Crosscheck.

### V3 – `coast-lush-ridge-lookback`

- Zielzelle: `argmin(-cell.groundHeight, gridZ, gridX)` über alle
  traversierbaren Dry-Zellen mit mindestens `8 m` horizontalem Abstand zum
  Spawn;
- Eye: `eye(Zielzelle)`;
- Positionstoleranz: `≤ 0,75 m`;
- Blickziel: `(spawnAnchorCenter + shoreCentroid) / 2`; Sollwinkel
  ausschließlich über `yaw(E,T)` und `pitch(E,T)`, Toleranz je `≤ 0,03 rad`;
- Anreise: realer Walk, Boundary bleibt aktiv und live.

Acceptance:

- Ground Cover/Understory im Vordergrund;
- Structural Tree und Coast/Spawn als lesbarer Mittelgrund;
- helle Atmosphäre und abgeschwächte Ridge-/Insel-Silhouette im Hintergrund;
- die endliche Spielfeldgrenze liest sich als Wasser, Fels oder Vegetation,
  nicht als Void/Wand/Testplatte;
- kein City-/Building-Silhouetten-Fake.

Primärvergleich: R11 und R13. R18 ist ausschließlich sekundärer Water-/Shore-
Crosscheck; R15 bleibt als Mangrove-/Wetland-Morphologie deferred.

### Gemeinsamer visueller Reject

Der Slice ist nicht akzeptiert, wenn nur Farbe oder Fog geändert wurden, aber
die Makroform flach bleibt; wenn neue Assets/Paletten ohne Referenzbeleg
auftauchen; wenn Wasser/Vegetation Gameplay-Truth erfinden; wenn der
Structural Tree unverbunden oder maßstabslos wirkt; oder wenn eine Aufnahme
P0-Physics-/Boundary-/Health-Fehlevidence enthält.

## 15. Deferred: biomes, city, landmark assets und editor

Ausdrücklich nicht Teil dieses Slices:

- planetweite Terrain-/Biome-Verteilung, Streaming, LOD und Millionen Sites;
- aride, Hochland-/Nadelwald-, Vulkan-, Kristall- und Savannenbiome aus R08;
- City, Spaceport, Straßen, Kanäle, Bridges und modulare Gebäude aus R01–R07;
- prozedurale Stadtgenerierung;
- authored gebaute Landmarken ohne freigegebene Assetquelle;
- Hestia Authoring-/City-Builder-/Biome-Editor;
- zusätzliche Structural Trees, Größenklassen oder Spezies;
- R15-Mangrove-/Wurzelmorphologie und Wetland-Traversal;
- Änderungen an voxel-autoritärer Umbrella-Tree-Morphologie;
- Deep Water, Schwimmen, Strömung, Wetter, Tageszeit, Hazards und Wildlife;
- Änderungen an Physics, Combat, Structural Destruction, HUD oder Settings;
- `0,25 m`-Qualitätsziel, globale Welt oder Planet-Handoff.

## 16. Offene Produktfragen

Keine der folgenden Fragen blockiert Blocks 0–3; sie blockieren nur spätere
Ausbaustufen:

1. Wie dunkel muss Hestias kanonische Vegetation gegenüber der hellen
   Coast/Lush-Basis sein, damit Living-Master-Plan („dunkle Vegetation,
   Nebelwald“) und R09–R13 zusammenpassen?
2. Welches lizenzklare, authored Asset ist die erste gebaute Nicht-City-
   Landmarke? Bis zur Freigabe bleibt die Landmarke natürlich.
3. Soll der separat zu genehmigende voxel-autoritäre Morphology-Slice zunächst
   nur die gemessenen Medium-Umbrella-Proportionen korrigieren oder gemeinsam
   mit Small-/Hero-Größen und weiteren Instanzen spezifiziert werden? Jede
   Variante benötigt neue Runtime-/Collision-/Destruction-/Performance-Gates.
4. Welche zusätzliche schwächere Zielhardware soll nach diesem hostgebundenen
   Ticket als Portabilitätsgate eingeführt werden?

## 17. Definition of Ready und Done

Ready:

- Async-/Structural-Fire-/Physics-/Performance-Gates grün;
- Spec-/ExecPlan-Freigabe für die oben genannten Owner-Dateien;
- alte und neue Generatoridentität samt Goldens gepinnt;
- Viewpoint-Erreichbarkeit auf normaler Route bewiesen;
- Zielhardware/Browser für die relative Performance-Baseline protokolliert.

Done:

- Blocks 1–5 in Reihenfolge grün;
- keine öffentliche Contract-, Package- oder Lockfile-Änderung;
- alte Generatorausgabe unverändert, neue Ausgabe deterministisch;
- drei feste Screenshots samt World-/Camera-/Performance-Evidence;
- same-viewport Current/Target-Vergleich gegen R09–R13 mit konkreten sichtbaren
  Abweichungen geschlossen; R14/R18 sind sekundäre Water-/Shore-Crosschecks,
  R15 bleibt als deferred ausgewiesen;
- keine falsche Behauptung über City, zusätzliche Biome, Vegetationsarten,
  globale Welt oder Editor;
- frische Tests, Build, E2E, `git diff --check` und Completion Preflight.
