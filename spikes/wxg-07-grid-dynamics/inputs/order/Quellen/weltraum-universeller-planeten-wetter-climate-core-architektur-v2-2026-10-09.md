# Weltraum-Spiel: Universeller Planetary Climate & Weather Core v2

**Stand:** 2026-10-09  
**Status:** `PROPOSED / REQUIRES_SPIKE / NOT IMPLEMENTED`  
**Art:** Architekturergänzung und Nachfolgekonzept zum Bericht `HESTIA_DYNAMISCHES_VOLUMETRISCHES_WETTER_ARCHITEKTURKONZEPT_2026-10-09.md`  
**Geltungsbereich:** beliebige Planeten und Monde, kontinuierliches globales Wetter, prozedurale Geografie, Wetter-/Simulations-LOD, volumetrisches Rendering und spätere lokale Interaktion  
**Repository-Kontext:** `BenjaminHornung/Weltraum-Spiel`, `main@25bc7f5bbd2db6317c42193873eadeaf10a092c5`; HVP-Feature-Referenz `aa2eabd918e03c475a489b412cd18e05f781a0f9` (kein main)  
**Verifikation:** Quellen- und Architekturstudie. Keine Implementierung, Tests, Browserläufe oder Benchmarks in diesem Arbeitsschritt.

## 0. Normative neue Entscheidung

Das ursprüngliche Konzept einer planetaren Makrowetterebene wird hier **verallgemeinert und präzisiert**. Die Kernfunktion ist ein zu beliebiger Simulationszeit und planetenfester Position **eindeutig abfragbares, kohärentes Wetterfeld** für jede unterstützte Himmelskörperdefinition. Eine lokale Darstellung darf nur das vorhandene Feld verfeinern. Spielerstandort, Kamera, Wetterrenderqualität, Chunkresidenz und Aufrufreihenfolge dürfen die Makrowetterwahrheit nicht beeinflussen.

**Ehrliche Modellgrenze:** Ein vollständiges *planetweit abfragbares* Wettermodell ist für ein Browserspiel machbar. Eine hochauflösende, streng naturwissenschaftlich validierte globale Atmosphären-, Ozean-, Wolkenmikrophysik- und CFD-Simulation jedes generierten Planeten in Echtzeit ist nicht realistisch. Geplant sind bewusst verschiedene **explizite Genauigkeitsprofile**, niemals eine versteckte Gleichsetzung von globaler Abdeckung mit einer wissenschaftlichen GCM-Vorhersage.

**Architekturregel:** Genau eine kanonische Wettermodellstrategie je Planet und veröffentlichtem Profil. Der gleiche `PlanetWeatherReadView` konsumiert jede Strategie. Ein späterer Strategie- oder Versionswechsel benötigt explizite Migration, neuen Contentdigest und einen überprüften Übergang.

## 1. Ziele und harte Invarianten

1. Der Planet besitzt einen schon vor dem Besuch festgelegten `CelestialBodyDefinition`- und `MacroGeographyAtlas`-Bezug. Kontinente, Ozeanbecken, grobe Höhenprofile und Wasserreservoire sind unabhängig von lokalen Terrainchunks bekannt.
2. Ein Wetterzustand ist primär eine Funktion aus `bodyId`, Simulationszeit, versioniertem Profil, kanonischem Zustand und bestätigten Ereignissen. Er ist **nicht** eine Funktion aus Kamera, angefordertem Terrain-LOD oder Hardware.
3. Die ganze Oberfläche oder druckbezogene Atmosphäre ist abfragbar, auch wenn keine Szene geladen ist.
4. Regionale Details und 3D-Wolkendichte werden von Makrowetter und lokalen Geodaten abgeleitet. Sie dürfen keine großräumigen Hoch-/Tiefdruckgebiete, Sturmwege oder Niederschlagsarten unabhängig erfinden.
5. Flüge zwischen weit entfernten Orten, Starts in den Orbit und Rückkehr an alte Koordinaten sehen dieselbe zeitlich fortgeschriebene Wetterformation.
6. Unterstützte Kondensate, Aerosole, Phasenübergänge und Atmosphärenregime werden aus Daten plus einer geschlossenen, vertrauenswürdigen Modellregistry gewählt, nicht aus einem universellen `weatherType = rain`.
7. Ein Planet ohne Atmosphäre darf nicht durch einen Default-Himmel Regen oder bodengetragenen Wind erhalten.
8. Gasriesen dürfen nicht zwangsläufig eine feste Landmaske, Landhöhe oder Meereshöhe benötigen; sie verwenden Druckniveaus und ggf. einen Referenzradius statt Bodenhöhe.
9. Kausale Ereignisse (Vulkanasche, Raketenwake, große Explosion, Terraforming) sind versioniert und idempotent. Shader-, Render- und Fluidtexturen bleiben nicht-autoritative Ableitungen.
10. Content- und Wettermodifikationen folgen den im Projekt vorgesehenen Versionierungs-, Provenienz-, Dry-Run-, CAS- und Commitgrenzen.
11. Keine Änderung an laufender HVP Cut V3, an Voxel-/Physics-/Save-Kontrakten oder an `main` durch diesen Architekturbericht.

## 2. Schichten und Verantwortlichkeiten

```text
Celestial / Star System Authority
  BodyId, radius/shape, rotation, orbit/ephemeris, gravity, stars, atmosphere
      |
      v
Macro Geography Source/Atlas  (persistent authored+generated)
  land/ocean mask, bathymetry, macro height, roughness, albedo,
  thermal inertia, volatile reservoirs, drainage catchments, coarse geology
      |
      v
Planet Climate Compiler  (offline / build time / generation time)
  insolation, seasonal normals, heat/moisture patterns, prevailing winds,
  long-term precipitation, source/sink distributions, climate zones
      |
      v
ClimateNormals + Biome / Hydrology Contracts (immutable versioned artifacts)
      |
      v
PlanetWeatherAuthority (one declared strategy per planet)
  weather timeline, pressure/temp/wind/volatile/aerosol fields,
  explicit storm systems, coarse condensate/precipitation, event journal
      |
      +--> PlanetWeatherReadView (body-fixed, any position/time)
      |      +--> flight, navigation, hazard, forecasts, weather map
      |      +--> regional refinement + visual atlas generation
      |
      +--> Regional Weather Refinement (only relevant regions)
              orography, coast, canopy, valley fog, mesoscale storm detail
              |
              +--> Local Fluid Interaction Volumes (only active events)
              |     no full-planet CFD
              |
              +--> Atmosphere / Cloud / Fog / Rain / Lightning Render Ports
                    WebGL2 now, optional WebGPU later
```

`PlanetWeatherAuthority` gehört zur einen fachlichen Weltwahrheit als domänenspezifisches Teilaggregat. Er ist weder ein neuer autonomer Save noch eine zweite Planet- oder Voxelautorität. Celestial- und Makrogeografiedaten bleiben in ihren bestehenden Source-Domänen und werden revisions-/digestgebunden gelesen.

## 3. Planet generieren: Geografie und Klima müssen zusammenpassen

### 3.1 Der richtige Generatorablauf

```text
A. PlanetaryDefinition: Größe, Form, Rotation, Gravitation, Sterne, Atmosphärenparameter
B. MacroGeographySource: tektonische Kontinente, Meere, Höhenzüge,
   Schelf, globale Reservoirs, Einzugsgebiete, grobe Küsten- und Talverläufe
C. ClimateCompiler: Langzeittemperatur, Strahlungsbilanz, Zirkulationsmuster,
   Quellen/Senken des jeweils vorhandenen kondensierbaren Stoffs
D. BiomeAndHydrologyCompiler: klimaverträgliche Biome,
   große Fluss-/Seeeinzugsgebiete und Abflussmengen, Eiskappen
E. Optional begrenzte Rückkopplung: Albedo, Eis, Vegetation, geänderte Reservoirs
F. Freeze: gemeinsames Manifest der semantischen Source- und Compiler-Digests
G. Surface/Terrain/Vegetation Generator: Materialisierung erst bei Anfrage,
   aus dem gefrorenen Atlas + Klimanormalwerten + konkretem Wetter + Edits
```

**Wichtige Kausalitätsregel:** Ein finales Biom kann nicht alleiniger Input des Klimagenerators sein, weil Biome ihrerseits Klimaauswirkungen und Niederschlag widerspiegeln. Schon vor Schritt C können authored Biome-Wünsche bzw. Vegetationsfähigkeitsmasken vorliegen; der **kanonische finalisierte Biomkatalog** entsteht erst nach Klimakompilierung. Große Flusskorridore/Drainagegeometrie dürfen in B vorbereitet sein, die tatsächliche Wasserführung wird in D aus Klima und Reservoiren abgeleitet.

### 3.2 Grobes, dauerhaftes `MacroGeographyAtlasV1`

- `planetId`, `gridScheme`, `gridResolution`, `terrainGeneratorDigest`, `geographyDigest`
- `landFraction`, `openLiquidFraction`, `landSurfaceClass`, `coastDistanceKm`
- `meanElevationM`, `min/maxElevationM`, `slope/orographicGradient`, `macroRoughness`
- `waterDepthM`, `largeReservoirId`, `catchmentId`, `drainageDirection`
- `albedo`, `heatCapacity`, `thermalInertia`, `soilPermeability`, `surfaceMoistureCapacity`
- `volatileInventoryRefs` statt implizit stets Wasser
- `geologicalHeatFlux` und ausgewählte technische/biologische Emissionen als deklarierte Quellen
- `coverageStatus` und `sourceRevision` pro Makrokachel

Makroatlas-Auflösung und Terrainvoxel-Auflösung sind ausdrücklich entkoppelt. Die Makrokachel soll im ersten Spike größenordnungsmäßig viele Kilometer bis hunderte Kilometer repräsentieren, nicht 0,25-m-Voxel. Das Raster darf für einen Erdmaßstab mit 6*48² Startzellen erprobt werden; die tatsächliche Zellgröße hängt vom Planetenradius ab.

Kleine Seen, Bäche, Strände, Höhlen und lokale Senken werden bei Bedarf aus einer räumlich adressierten Generatorfunktion materialisiert. Ihre lokalen Wettereinflüsse entstehen aus lokalen Derived-Surface-Inputs. Ein Terrain-Chunk darf kein neues Meer oder globales Klimasystem aus einem unabhängigen Seed erfinden.

### 3.3 Was geschieht bei Terrain-Zerstörung?

- Baum gefällt: Schatten/Windschutz/Bodennässe im lokalen Modell können sich ändern; kein neues globales Tiefdruckgebiet.
- Felswand entfernt: regionale Obstacle-/Orographieprojektion aktualisieren; lokale Strömung im aktiven Fluidbereich darf reagieren.
- Damm, Staudamm oder Waldrodung in großer Fläche: explizites regionales Land-/Hydrology-Change-Event, Auswirkungen an definiertem Wetter-/Hydrologietick.
- Terraforming, großflächige Vulkaneruption: explizite planetare Emissions-/Albedo-/Atmosphärenänderung und bewusster Übergang des Klimaprofils. Keine stille automatische Neukompilierung aller alten Biome im Hintergrund.

Ändert sich der lokale Boden, bleiben globale Wetterautorität, Terrainautorität und ihre Zuständigkeiten eindeutig. Ein lokales Wetterderivedprodukt wird nur bei passender Voxel-, Geografie- und Wetterrevision adoptiert.

## 4. Physik-Komposition statt fest verdrahteter Planetentypen

**Planetentypen sind Autoren-Presets, keine Simulationstyp-Switches.** Ein Planet bezieht ein exakt versioniertes Modellprofil aus den unten genannten Bausteinen:

| Modul | Eingabe / Entscheidung | Beispiele |
|---|---|---|
| `RadiativeForcingModel` | Sterne, Ephemeriden, Spektren, Albedo, Wolken/Aerosole | ein Stern, Doppelstern, Sonnenfinsternis |
| `AtmosphericColumnModel` | Gasmischung, Gravitation, Druck, Schichtung, spezifische Wärme | dünne Marsluft, dichte Venusatmosphäre |
| `CirculationModel` | Radius, Rotation, Coriolis, Heizungsgradient, Topografie | Erdzirkulation, gebundene Rotation, Gasriesen-Jets |
| `CondensibleSpeciesModel[]` | Sättigungsfunktion, Verdampfung, Kondensation, Gefrieren | H2O, CH4, CO2 als registrierte Stoffmodelle |
| `CloudMicrophysicsPolicy` | Kondensat-/Aerosolschwellen, Wolkenschichten, konvektiver Auftrieb | Cumulus, Eiswolken, Schwefelsäure-Aerosole |
| `SurfaceExchangeModel` | Wärme-/Stofffluss, Bodenrauigkeit, Flüssigkeitsreservoire | Ozeanverdunstung, trockener Sand, Eis-Sublimation |
| `AerosolTransportModel` | Staub, Vulkanasche, Sulfataerosole | Marsstaubsturm, vulkanische Wolke |
| `PrecipitationModel[]` | Partikelart, Fallgeschwindigkeit, Phasenbedingungen | Wasserregen, Methanregen, Schneefall, Eispartikel |
| `ElectroStormPolicy` | Ionisierung/Ladung, konvektive Stormpotential-Proxies | Blitzentladung in Gewitterwolken |
| `PlanetWeatherStrategy` | kanonischer Zeitevolutionsmodus | analytisch/ereignisbasiert oder gridgebundene Dynamik |

Nicht jede beliebige Modulkombination ist physikalisch sinnvoll. Ein geschlossenes `CompatibilityProfile` prüft Validität, unterstützte Temperatur-/Druckbereiche, Stoffdatenverfügbarkeit, Unit-Kompatibilität und numerische Stabilität. Scheiternde Kombinationen sind `Unsupported`, nicht Erdwetter-Fallback.

**Modding:** Authoring-Pakete wählen nur freigegebene Registry-IDs und Datenparameter. Beliebiger aus einem Content-Paket geladener JS/WGSL-Code widerspricht dem vorgeschlagenen G13-Content-Sicherheitskonzept und ist nicht Bestandteil von v2.

## 5. Grundprofile nach physikalischem Regime

| Profilvorlage | Kanonisches Medium | Wesentliche Dynamik | Zulässige Phänomene / Sonderfall |
|---|---|---|---|
| `terrestrial-humid` | Atmosphäre + Wasserspeicher | Feuchte/Temperatur/Druck/Wind/Fronten | Regen, Schnee, Nebel, Gewitter |
| `terrestrial-arid` | trockene Atmosphäre + lose Partikel | Wärmezirkulation, Aerosolaufnahme/Transport | Staub-/Sandstürme, kaum Wasserregen |
| `cryogenic-volatile` | dünne oder dichte kalte Atmosphäre + Frost | Sublimation, saisonale Gaskondensation | CO2-/N2-Reif, Eispartikel, atmosphärischer Kollaps nach Stoffdaten |
| `methane-cycle` | N2-dominiert, Methanreservoire | CH4-Verdampfung und -Kondensation | Methanregen, Nebel, organischer Dunst |
| `dense-acid-haze` | dichte Gasatmosphäre + Sulfat-/Säureaerosole | starke Strahlungsabsorption und vertikale Winde | mehrlagige Säurewolken, Dunst; Säureregen nicht automatisch Bodenregen |
| `gas-giant-jets` | dichte Fluidschichten ohne festen Boden | zonale Jetstreams, mehrstufige Wolkenschichten, innere Wärme | langlebige Vortizes, Sturmbänder, kondensierbare Stoffe nach Profil |
| `tidally-locked` | beliebige passende Gasatmosphäre | feste Tag/Nachtheizung, Terminatorgradienten | dauerhafte Windsysteme abhängig von Rotation/Transport |
| `airless` | keine Atmosphäre | keine atmosphärische Dynamik | keine Wolken, bodentragender Wind oder Niederschlag; ballistische Staub-/Auswurfevents andere Domäne |

Reale Analogien: NASA-ROCKE-3D 2.0 unterstützt stark variierende terrestrische GCM-Parameter; Titan hat einen Methankreislauf; Mars hat ein dynamisches Staubsystem; Jupiter besitzt zonale Jets, Wolkenschichten und langlebige Stürme. Diese Analogien beweisen keine exakte Plausibilität fiktiver Planetenparameter.

Bei Gasriesen werden die vertikalen Koordinaten beispielsweise als Druckebenen (hPa/Pa) relativ zu einem benannten Referenzradius geführt, nicht als `surfaceAltitude` über Land. Bei unter Wasser liegenden Welten benötigt die eigentliche Wassersimulation einen separaten Ocean/Hydrology-Port, der Energie-/Wärmeaustausch mit der Atmosphäre koppelt, nicht die Wolkendichteautorität.

## 6. Klima kompiliert, Wetter simuliert

### 6.1 ClimateNormals als einmaliges, versioniertes Produkt

Der `ClimateCompiler` kann aus Physikprofil + Makrogeografie ein **Klimanormalfeld** berechnen:

- mittlere Temperatur und jährliche/diurnale Schwankungsbreite;
- typische Bodenwind- und Höhenwindvektoren;
- Druckniveaus, relative/absolute Feuchte und kondensierbare Stoffvorräte;
- häufige Bewölkungs-/Niederschlagszonen und deren Saisonabhängigkeit;
- zyklische Sturmwahrscheinlichkeit und bevorzugte Sturmzüge;
- dauerhaft vorhandene atmosphärische Wellen, Jetbands und vulkanische/dust Quellen;
- Eis-/Schneegrundprofil und Wasser-/Wärmefluss mit Ozeanen bzw. Reservoiren;
- Gültigkeits-/Unsicherheitsangaben des verwendeten Compilers.

Für wichtige authored Hero-Planeten kann optional ein realer GCM-Compiler **außerhalb der Browserlaufzeit** Klimatabellen erzeugen, die anschließend in Hestia-eigene geschlossene Contentpakete konvertiert werden. ROCKE-3D oder ExoPlaSim sind Vergleichs- und möglicherweise Bake-Kandidaten, keine Browser-Runtime-Abhängigkeiten. ExoPlaSim ist GPL-lizenziert; Nutzung, Verteilung und Datenlizenzen erfordern eine eigene Complianceprüfung. NASA ROCKE-3D-Datensätze besitzen ebenso zu prüfende Provenienz.

Für beliebig prozedural generierte Planeten genügt zunächst ein schneller eigener **empirisch/physikalisch motivierter** Klima-Compiler. Er darf unbekannte Physik nicht als wissenschaftlich simuliert bezeichnen. Später können die gleichen Outputschemata mit hochwertigen gebackenen Klimadaten gefüllt werden.

### 6.2 Klimaperiode ist nicht Wetterspeicher

Ein Klimanormalfeld kann typischerweise 12 saisonale Bins plus lokale Tageslichtfunktion enthalten. Das ist eine *Start-/Forcinggröße*, keine Wetterzeitreihe. Zur Laufzeit entstehen voranschreitende Fronten, Wolken und Stürme aus einer eigenen Meteorologiewahrheit.

## 7. Globale Wetterstrategie: zwei präzise Betriebsarten

### 7.1 A: `AnalyticSynopticV1` für viele/inaktive Planeten

**Zweck:** Zu einer beliebigen Weltzeit überall ein kohärentes, veränderliches Wetter erhalten, ohne Millionen vergangene Simulationsschritte aufzuholen.

- Langfristiger klimatologischer Forcing-Snapshot plus deterministisch erzeugte, räumlich große meteorologische Moden.
- Drucksysteme, Fronten, Vortexobjekte, Aerosolwellen und Sturmereignisse besitzen stabile IDs, Entstehungszeit, Lebensspanne, Bahn- und Intensitätsfunktionen.
- Ein Zeitfenster wird durch Counter-Based-Seed aus `planetId`, Modellversion, Klimaquelle und diskretem Epoch-Index reproduziert.
- Fronten leben ausdrücklich über Epoch-Grenzen hinaus; zeitliche Gewichtsfunktionen bilden sanfte, räumlich kohärente Übergänge. Keine stündliche Neuauswürfelung der Wolken.
- Großräumige Wind-/Feuchtefelder werden aus den Ereignissen, Klimanormalen und versionierten analytischen Transportfunktionen gesampelt.
- Überlagerung darf keine negative Luftmasse oder negative Stoffmengen erzeugen; eine begrenzte Bilanz-/Restfehlerprüfung dokumentiert das Näherungsmodell.

**Genauigkeit:** global deterministisch und plausibel, aber kein konservativer vollnumerischer GCM. Wetter ist trotzdem ein echtes räumlich/zeitlich kohärentes Weltmodell und keine Kameratextur. Für viele Planetentypen wird es das v1-Standardprofil.

### 7.2 B: `CoarseGridDynamicsV1` für wichtige, langfristig bespielte Planeten

**Zweck:** Auf einem dauerhaften globalen 2D/2.5D/3D-Grobraster grobe Atmosphärendynamik und Feuchte-/Aerosoltransport mit expliziten Zeitschritten modellieren.

- 6 Cube-Sphere-Faces, beispielsweise 32², 48² oder 64² Zellen pro Face als Spike-Matrix.
- wenige Höhen- oder Druckbänder, etwa 3-6 als Designhypothese; Startfall 4;
- dynamische Variablen: Druck, Temperatur/enthaltene Wärme, horizontaler Wind, Feuchte/Speziesanteile, Aerosole, Kondensat, Niederschlagsreservoir;
- globale Energiestrahlung, planetare Rotation, großräumige Temperaturschichtung, Ozean-/Bodenfluss und orografische Prozesse;
- finite-volume-orientierte, flächenbilanzierte Advektion und explizite Quellen/Senken; kleines gemeinsames Zeitschrittprotokoll mit CFL-/Stabilitätsprüfung;
- kilometerkleine Gewitterzellen sind **subgrid-parameterisiert** und werden im Regionalmodell verfeinert, nicht vom globalen Grobraster aufgelöst;
- stabile Face-Nachbarschaft, Zellschnittflächen und korrekte Wind-Vektorbasis beim Facewechsel;
- zulässige Vereinfachung, falls quantifiziert: hydrostatische oder quasi-geostrophische Modellfamilie; keine implizite Behauptung vollständiger Navier-Stokes-Lösung.

**Zeit:** 10, 30 oder 60 In-Game-Minuten je Makroschritt sind lediglich Testprofile. Die zulässige Zeitstufe muss aus Zellabstand, Windgeschwindigkeit, Advektionsverfahren und numerischer Stabilität abgeleitet werden. Keines dieser Profile wird allein aufgrund des Zahlenwertes als stabil beschlossen.

**Wesentlich:** Eine gittergebundene dynamische Welt lässt sich bei großem Zeitsprung nicht kostenlos exakt rekonstruieren. Für diese Strategie sind Checkpoints plus **identischer Replay-Algorithmus** erforderlich. Ein Wechsel zu einem billigeren AnalyticSynoptic bei Dormanz würde das Ergebnis verändern und ist ohne expliziten Modellübergang **verboten**.

### 7.3 Zwei Strategien, eine Wahrheit pro Planet

Ein Planet bindet exakt `modelStrategyId + strategyVersion + inputDigest` in seinem Climate-/Weather-Manifest. Es gibt keine versteckte Aufwertung durch Spielerannäherung. Der schnelle und der teure Algorithmus sind zwei veröffentlichte *Planetenprofile*, nicht zwei unterschiedliche Wetterwahrheiten, zwischen denen Kameras wechseln.

Das heißt: Wenn ein Hestia-Hero-Planet `CoarseGridDynamicsV1` nutzt, muss ein alter Save die korrekte Gridversion und ihre Zeitlinie behalten. Ein zuvor nie betretenes System kann `AnalyticSynopticV1` erhalten. Späterer Upgrade-Wunsch benötigt einen expliziten Authoring-/Save-Migrationsschnitt, der fachlich überprüft wird.

## 8. Welche Simulation läuft, wenn niemand auf dem Planeten ist?

Die korrekte Lösung ist **nicht**, inaktive Planeten einfach einzufrieren oder bei jedem Betreten neu zu würfeln.

| Fall | Wetterwahrheit | Berechnung |
|---|---|---|
| Planet niemals besucht, Strategie A | analytisch indexierbar für Tick T | nur benötigte Zeit-/Raumfenster aus Seed und Climatology ableiten |
| Inaktiver Planet, Strategie A | dieselbe Funktion plus persistente Ereignisse | keine fortlaufende Tickschleife nötig |
| Aktiver Planet, Strategie A | dieselbe Funktion | lokale Region-/Renderprodukte promotieren; Makrowetter bleibt unverändert |
| Planet mit Strategie B, normal aktiv | globaler Gridzustand zu diskreten Ticks | budgetierte Workerupdates unabhängig von Kamera |
| Planet mit Strategie B, inaktiv | letzter Checkpoint plus bestätigte Eventfolge | beim Zugriff deterministisch bis benötigten Tick replayen; vorher `Pending` statt falschem Wetter ausgeben |
| Planet mit Strategie B, extrem langer Zeitsprung | genau dieselbe Berechnungssemantik | vorherig geplanter Precompute/Checkpoint oder budgetierter asynchroner Catch-up; kein unbestätigter Zeitsprung |

**Unvereinbare Wünsche explizit:** `B` gleichzeitig streng konservativ, vollständig deterministisch, ohne gespeicherte Zukunft, sofort zu beliebig ferner Zeit rekonstruierbar und praktisch kostenlos zu machen, ist nicht allgemein möglich. KISS-Strategie für v1: `A` für prozedurale Breite, `B` nur nach erfolgreichem Catch-up-/Memory-/Determinismus-Spike für einen oder wenige Hero-Planeten.

Für Gameplay und Playwright gilt: wenn eine kanonische Wetterabfrage aufgrund des Catch-ups nicht bereit ist, `Pending/Unavailable` ausgeben und die anfragende sicherheitsrelevante Aktion nicht mit erfundenem Defaultwetter freigeben.

## 9. Räumliche Abdeckung und Wetter-LOD

| LOD | Träger | Existiert global? | Aktualisierung | Autorität |
|---|---|---:|---|---|
| W0 `ClimateNormals` | body + sehr grobes Raster, saisonale Funktionen | Ja | bei Generation/Versionierung | immutable Klima-Content |
| W1 `SynopticWeather` | globales Cube-Sphere-Feld oder analytische Zeitfunktion | Ja, abfragbar | analytisch oder feste Wetterschritte | kanonische Wetterautorität |
| W2 `MesoWeather` | lokale/regional abgeleitete 2D-/2.5D-Kacheln | nur relevante Regionen | langsamer, adaptiv, wettergebunden | derived / optional kontrollierter Regionalresolver |
| W3 `Cloud/Fog Volume` | 3D-Sample/Atlas, Wolken- und Nebelvolumen | nur sichtbar oder zur Interaktion nötig | render-/fieldabhängig | derived, niemals Wetterquelle |
| W4 `Fluid Interaction` | lokale 3D-Velocity-/Temperature-/Condensate-Gitter | nur Ereignisse | subsecond fixed step | zunächst derived; Gameplay nur über spezifizierten CPU-Resolver |
| W5 `Particles/Lighting` | GPU Partikel, Blitz, Schatten, Atmosphärenstreuung | nur gerendert | Frame | rein visuell |

**Wichtig:** Simulation-LOD und Render-LOD nicht gleichsetzen. Die Wetterfront existiert W1-weit, selbst wenn W3/W4 nirgends geladen sind. Bei Anflug können vor dem Spieler W2 und W3 aus bestehenden W1-Feldern erzeugt werden, ohne die Wetterlage oder deren Seed zu ändern.

## 10. W1-Raster und planare/planetare Vektorinterpolation

- Das Cube-Sphere-Raster lässt sich mit dem vorhandenen Planet-/Tile-Adresskonzept verbinden, darf aber nicht an Terrain-LOD gebunden werden.
- ID: `(bodyId, face, gridLevel, x, y, pressureBand)` als stabiler kanonischer Schlüssel.
- Jede Zelle besitzt eine feste Fläche in m² und eine korrekte lokale Tangentialbasis. Massentransport wird aus **Flüssen über Zellgrenzen**, nicht aus Renderpixeln abgeleitet.
- Windvektoren werden beim Übergang zwischen Cube-Faces in einen gemeinsamen Frame transformiert. `u/v`-Komponenten dürfen nicht unrotiert über Faces kopiert werden.
- Interpolation mit gültigen Nachbarzellen/Seam-Halos; Werte werden weder an Facegrenzen geklemmt noch als leere Luft behandelt.
- Höhen- und Druckschichten verwenden das für den Planetentyp registrierte Koordinatenprofil; keine `elevationM`-Pflicht für Gasriesen.
- Auf 64² pro Face ergeben sich 24.576 horizontale Zellen. Bei 4 vertikalen Schichten und acht Float32-Kanälen sind das etwa 3 MiB Rohdaten pro Snapshot, also etwa 6 MiB für zwei Snapshots. Nicht enthalten: Bounds, Revisionen, temporäre Solverfelder, Sturmobjekte, Klimamaps, Terrain, GPU und Texturen.
- Hestias etwa 145.000 Pa Oberflächendruck ist ein bestehender Celestial-Definition-Input; Standardwerte für H2O-Sättigung, Gasdichte oder Wolkenhöhe müssen aus validiertem Atmosphärenprofil kommen, nicht aus Erd-Defaults.

Die Auflösung ist eine *Betriebsentscheidung nach Messung*. NOAA FV3 zeigt die grundsätzliche Eignung von Cube-Sphere- und Finite-Volume-Transport, aber ein 6*64²-Spielraster löst keine lokalen Konvektionen explizit auf.

## 11. Vom globalen Wetter zur konkreten sichtbaren Wolke

Eine kanonische Wolke kann über großräumige thermodynamische Felder + regionale Kondensatverteilung + stabile 3D-Mikrostruktur rekonstruiert werden:

```text
p = bodyFixedPoint                   // NICHT camera relative
T, q, wind, pressure, condensate = W1.sample(p, tick)
Tlocal, qlocal, windlocal = W2.refine(p, W1, localGeo, tick)
baseCloud = registeredCondensateModel(Tlocal, qlocal, pressure, altitude)
shape = deterministic3DField(p, cloudRegionId, tick, windlocal)
interactiveDelta = W4.localPerturbation(p, tick) // event-bound or cosmetic
rhoCloud = conservativeDensity(baseCloud, shape, interactiveDelta)
```

**Massenregel:** Noise erzeugt nur optische Struktur innerhalb der vom Wetter bereitgestellten Kondensatverteilung. Keine positiven Cloud-Density-Zellen außerhalb plausibler Kondensat-/Cloud-Mask, nur weil Shader-Noise dort größer als ein Schwellwert ist. Positive Störungen benötigen eine reale/profilierte Quelle oder lokale Umverteilung.

**Sturmidentität:** Sturm-ID und synoptische Position sind W1. In W2 bekommt er mehr Details, in W3 eine echte 3D-Wolke. Bei Blick vom Orbit sieht man dieselbe W1-Sturmstruktur statt einer zweiten unabhängigen Overlay-Animation. Wolkenänderungen bei Annäherung sind nur Formverfeinerung, nicht Änderung des Wetterereignisses.

## 12. Surface-to-Orbit- und Langstreckenflugkontinuität

Beispiel `body=hestia`, Flug von Küstenkoordinate A über 800 km nach B:

1. W1 besitzt ein Gebiet mit `pressureLowId`, `frontId`, `stormId`, Zeit-/Positionsmetadaten und Wind-/Feuchtefeld.
2. Beim Start wird W2 für den Korridor A geladen, W3 zeigt die zum W1-Storm passende Wolkenschicht.
3. Der Flight/Navigation-Controller fragt Wind und Turbulenz über den read-only Wetterport ab; soweit Aero nicht existiert, bleiben diese Werte Diagnose/Presentation und erzeugen keine magischen Forces.
4. Streaming lädt W2/W3 entlang des Flugkorridors vor. Die Felder werden anhand stabiler Körperkoordinaten und Wettertick identisch gesampelt.
5. Beim Übergang von A nach B lädt der Renderer neues Mesh und Wolken-GPU-Material, **nicht** ein neues Wetter.
6. Beim Durchflug einer Wolke wird W4 für Raketenjet/Schockereignisse aktiviert. Es modifiziert lokal die abgeleitete 3D-Dichte und kann über definierte Events begrenzte längerlebige Störungen halten.
7. Im Orbit zeigt der globale Wolkenrenderpass dieselbe Sturm-ID mit zeitlich passender 3D-/2D-Darstellung. Keine separate Planetenkugel mit willkürlich scrollendem Wolkenbild.
8. Rückkehr nach A zur späteren Simulationszeit zeigt die fortgeschrittene Wetterfront. Rückkehr per Save/Replay zu einem früheren Tick reproduziert deren damalige kanonische Lage.

**Caching:** Regional-/Wolkenprodukte tragen `{ bodyId, weatherRevision, weatherTick, macroGeographyDigest, terrainSourceRevision, cloudAlgorithmDigest, renderFrameId }`. Ein Produkt mit geänderter Authority/Epoch/Digest wird nicht adoptiert. Preload beeinflusst niemals RNG-Sequenzen der Welt.

## 13. Lokale Wetterrefinements

- Orographischer Niederschlag: Bewegung des Makrowinds gegen Hang-/Gebirgskorridor, Höhengefälle und Kondensationsprofil, bounded Regionalmodul.
- Küstennebel: Luftfeuchte, Meerestemperatur, Taupunkt-Abstand, Tageszeit, lokale Kaltluftsenken und Wind.
- Stadtwärmeinseln: semantische City-/Materialdaten plus geringer, versionierter lokaler Wärmefluss; kein zweiter landesweiter Klimakern.
- Wind an Wurzeln, Felswänden, Gebäuden: Obstacle-Projektionen aus validierten Voxels/Objektcaps, bei unbekannten Nachbarn `UnknownCoverage` statt Air.
- Gewitterzellverfeinerung: W1 liefert Instabilitäts-/Storm-Region. W2 bestimmt eine deterministische Subgrid-Struktur mit stabilen storm-local Seeds und geeigneter räumlicher Korrelation.
- Lokale Quell-/Senkeneffekte: Kühlanlagen, Lagerfeuer, Industrie, Vulkanaschen, Raketenabgase aus gültigen Domain-Events. Kleinteilige VFX bleiben abgeleitet, spielrelevante Effekte benötigen Eventresolver.

Lokale Bildqualität kann je nach Wetter-QoS abfallen. Die W1-Wetterwahrheit ist dabei exakt unverändert.

## 14. Volumetrische Physik bleibt lokale Zuständigkeit

Die vorherige F0-F3-Einteilung bleibt gültig:

- `F0`: Bewegung der regionalen 3D-Noise-/Wolkenmuster unter Wind.
- `F1`: räumliche, aber nicht numerisch hydrodynamische Verdrängung entlang einer Flugbahn.
- `F2`: begrenzter 3D-Fluid-/Kondensat-Solver mit Dichte, Geschwindigkeit, Temperatur und Hindernissen.
- `F3`: echte kompressible Schockfluiddynamik separat als künftiger Forschungspfad.

F2-Volumen werden **in die global gültige Wetterlage initialisiert**. Advektionsrandbedingungen stammen aus dem W1/W2-Wind, nicht aus einer isolierten Box mit Wind Null. Hindernisse stammen aus validierten Voxel-/Craft-Projektionen. Physisch relevante langanhaltende Quellereignisse werden als `LocalAtmosphericDisturbanceEvent` gespeichert; GPU-Fluidfelder müssen nicht persistiert werden, sofern das Ereignis-Replay den akzeptierten visuellen/Gameplayvertrag reproduziert. Falls exakt fortgesetzte Strömungszustände gameplayrelevant werden, benötigt der Solver einen separaten autoritativen Checkpoint-/Determinismus-Vertrag.

## 15. Typed Contract Sketch v2

```ts
// Vorschlag, noch KEINE im Repository implementierte API.
type ExactRef = Readonly<{ id: string; schemaVersion: number; digest: `sha256:${string}` }>;
type TickUs = string;  // kanonische Dezimalzahl, auf der Wire-API kein JS-BigInt

interface PlanetWeatherProfileV2 {
  readonly schema: "weltraum.planet-weather-profile/v2";
  readonly bodyId: string;
  readonly bodyFrameId: string;
  readonly celestialDefinition: ExactRef;
  readonly macroGeography: ExactRef | null; // null nur, falls Modell keinen Boden braucht
  readonly climateNormals: ExactRef;
  readonly atmosphereMaterialRegistry: ExactRef;
  readonly circulationModel: ExactRef;
  readonly radiationModel: ExactRef;
  readonly surfaceExchangeModel: ExactRef | null;
  readonly condensibleSpecies: readonly ExactRef[];
  readonly aerosolModels: readonly ExactRef[];
  readonly cloudProfiles: readonly ExactRef[];
  readonly precipitationModels: readonly ExactRef[];
  readonly thunderModel: ExactRef | null;
  readonly weatherStrategy: {
    readonly id: "analytic-synoptic-v1" | "coarse-grid-dynamics-v1";
    readonly version: number;
    readonly exactImplementationDigest: `sha256:${string}`;
    readonly grid?: {
      readonly scheme: "cube-sphere";
      readonly faceResolution: number;
      readonly verticalCoordinateId: string;
      readonly verticalLevels: readonly number[];
    };
  };
  readonly validityProfile: ExactRef;
  readonly contentDigest: `sha256:${string}`;
}

interface PlanetWeatherQueryV2 {
  readonly bodyId: string;
  readonly frameId: string;   // typically BODY_FIXED
  readonly bodyFixedPositionM: readonly [number, number, number];
  readonly atTickUs: TickUs;
  readonly requiredAccuracy: "macro" | "regional" | "interacting";
}

type WeatherResultV2 =
  | { readonly status: "Known"; readonly snapshot: WeatherSampleV2;
      readonly modelId: string; readonly modelDigest: string;
      readonly validAtTickUs: TickUs; readonly supportRadiusM: number;
      readonly sourceRevision: string; readonly accuracy: string; }
  | { readonly status: "Pending"; readonly dependency: string }
  | { readonly status: "Unsupported" | "UnknownCoverage";
      readonly reasonCode: string };

interface WeatherSampleV2 {
  readonly temperatureK: number;
  readonly pressurePa: number;
  readonly windBodyFixedMps: readonly [number, number, number];
  readonly extinctionPerM: number;
  readonly condensates: readonly { speciesId: string; massMixingRatio: number }[];
  readonly aerosols: readonly { speciesId: string; massMixingRatio: number }[];
  readonly precipitation: readonly {
    speciesId: string; phase: "liquid" | "solid";
    massFluxKgPerM2S: number;
  }[];
  readonly stormIds: readonly string[];
}
```

Der `PlanetWeatherReadView` muss quantisierte Interpolation, deterministisches Fehlerverhalten, Entropie-/Energie-/Massenprüfungen gemäß Modellprofil sowie stabile Results liefern. `supportRadiusM` kennzeichnet die tatsächlich verfügbare Granularität; es ist ausdrücklich kein Beweis metergenauer Meteorologie.

### 15.1 Zustands- und Checkpoint-Vertrag

```ts
interface WeatherEpochBindingV2 {
  readonly bodyId: string;
  readonly atmosphereEpoch: string;
  readonly weatherStrategyId: string;
  readonly strategyImplementationDigest: `sha256:${string}`;
  readonly profileDigest: `sha256:${string}`;
  readonly climateNormalsDigest: `sha256:${string}`;
  readonly macroGeographyDigest: `sha256:${string}` | null;
  readonly currentWeatherTickUs: TickUs;
  readonly authorityRevision: string;
  readonly eventCursor: string;
  readonly checkpointDigest: `sha256:${string}` | null;
}
```

Bei `AnalyticSynoptic` muss nicht für jede Stunde ein vollständiger Gridcheckpoint persistiert werden; der kanonische Profile-/Epoch-/Eventzustand reicht. Bei `CoarseGridDynamics` sind vollständige, prüfbare Gridcheckpoints und exaktes Replay der akzeptierten Zustandsübergänge erforderlich. Kein Modellwechsel durch alleinigen UI-Presetwechsel.

## 16. Time Step, Persistenz und Multiplayer

- **UniverseTime ist Autorität.** Wetterticks sind aus ihr definierte ganze Tickintervalle, nie aus `Date.now` oder rAF.
- `advanceWeather(bodyId, fromTick, toTick, boundEvents)` ist nur in der gittergebundenen Strategie mutierend. Die analytische Strategie kann für den gleichen Tick ihre Zustandsfunktion auswerten.
- Ereignisse sind geordnet nach `(simTick, priorityClass, sourceEntityId, commandId)` und idempotent.
- Relevante Globalstürme erhalten stabile IDs und Position-/Lifecycle-Ereignisse. Spawn wird nicht von lokalem Renderwetter entschieden.
- `replay(full)` und `replay(checkpoint+tail)` müssen gleiche kanonische Bytes liefern, soweit dieselbe veröffentlichte Implementierung benutzt wird.
- Worker-Ergebnisse tragen `authorityEpoch`, `sourceRevision`, `snapshotDigest`, `modelDigest`, `requestId` und `weatherTick`; stale results werden verworfen.
- Ein zukünftiger Multiplayer-Server besitzt die kanonische Wettersimulation. Clients dürfen lokale Wolken-/Fluidbilder berechnen, aber keinen Einfluss auf globale Sturmentwicklung vortäuschen.
- Physische Windkräfte auf ein Schiff benötigen den fachlichen Aero-/Flight-Resolver. Ein zusätzlicher Shaderwind ändert keine Geschwindigkeit.

## 17. Performance und Speicher, noch ungemessene Spike-Hypothesen

| Konfiguration | Überschlägiger Umfang | Priorität |
|---|---:|---|
| Cube-Sphere 6*32², 4 Levels, 8 Float32-Kanäle | ca. 0,75 MiB roher Grid-Snapshot | analytische oder sehr grobe Dynamik |
| Cube-Sphere 6*48², 4 Levels, 8 Float32-Kanäle | ca. 1,69 MiB roher Grid-Snapshot | mittleres Forschungsgitter |
| Cube-Sphere 6*64², 4 Levels, 8 Float32-Kanäle | ca. 3 MiB roher Grid-Snapshot | höheres Forschungsgitter |
| Zwei 64²-Zeitstände | ca. 6 MiB nur der Feldkanäle | Interpolation / Ping-Pong |
| `LocalFluid 64³` mit mehreren RGBA-Feldern | mehrere MiB bis zweistellig MiB, je Format | nur aktives Interaktionsvolumen |

Nicht enthalten: Solver-Workspace, Ghost-Zellen, Flächengewichte, U/V-Grenzflussarrays, Eventobjekte, ClimateNormals, GPU-Atlas, Rendertargets, Retention und JS-Overheads. Ein repräsentativer HVP-GPU-/CPU-Benchmark muss die **gesamte** Pipeline samt Terrain, Vegetation, Meshing, Schatten, Physik und Fluid umfassen. Keine FPS-Zahlen ohne Rohsamples und festes Hardware-/Browserprofil.

**KISS-Grundsatz:** Liegt ein entferntes, nie besuchtes System vollständig außerhalb jeder Mission oder Spielerinteraktion, braucht es keine residenten Gridbuffer. Es muss aber über seine kanonische Strategie jederzeit dieselbe Wetterlage am gleichen Tick liefern können.

## 18. Gameplay und Vorhersage

`sampleWeather` liest die fachliche Weltwahrheit. `WeatherForecast` ist eine davon **getrennte abgeleitete, unvollständige Wissenssicht** des Spielers. Sensoren, Satelliten, Wetterstationen, Sichtbarkeit, Messunsicherheit und Vorhersagehorizont bestimmen, welche Information der Spieler erhält. Ein Wetterradar darf nicht alle Blitze und zukünftige Stürme als omniscient truth anzeigen, nur weil die Simulation sie intern kennt.

Missionen, Drohnen und Schiffe sollen dieselben read-only Wetterwerte benutzen. Gefahren wirken nur, wenn zuständige Simulationen Windlast, Niederschlagswirkung, Sichttrübung oder Strahlung tatsächlich implementieren. Bis dahin meldet UI `VisualOnly`/`GameplayUnavailable` statt vorgetäuschter Physikkorrektheit.

## 19. Editor, Klima-Authoring und Datenpakete

**Planet Editor:**

- Planet und Sternsystem wählen; Druckprofil, Atmosphärenstoffmix, Kondensatspezies, Rotation, Sternbedingungen prüfen.
- MacroGeography-Atlas als Ansicht/Map: Land-/Wasseranteil, Höhe, Wasserreservoir, Quelle/Senke, Variationen und Seed.
- ClimateNormals-Compiler starten, Probleme/Unsicherheiten und Biome-/Reservoirkonflikte prüfen.
- Wettermodellstrategie samt Version und Profilgebundenheit auswählen.
- Animierten Wetterzeit-Scrubber mit Windvektoren, Temperatur, Feuchte, Niederschlag und Sturm-ID visualisieren.
- Probeprofile `Hestia`, `DustPlanet`, `CryoMethane`, `GasGiant`, `TidallyLocked`, `Airless` validieren.
- Optional authored Storm-Scenario als kanonische Änderung nur über Authoring Gateway und menschliche Freigabe.
- Keine Shaderuniform, Kamerapose, Playwright-Screenshot oder Scene-Object3D als World Authority speichern.

**Content-Pakete:** Source, Canonical, Derived, Provenance und Lizenzinformationen separat; exakt versionierte Material-/Klima-/Wetterstrategien und Shader-/Bake-Derivate. Keine stillen Änderungen laufender Welt-Saves beim Bearbeiten eines Planetenprofils.

## 20. Tests: deterministisches und visuelles Acceptance-Gate

### 20.1 Korrektheit

1. **W-DET-01:** gleicher Planet, gleiche Zeit, gleiche Seeds und Events: identischer W1-Hash, unabhängig von Camera-/Chunkloadreihenfolge.
2. **W-DET-02:** A -> B -> A per Flug und direkter Query liefert bei gleichem Tick identische Makrowetterwerte.
3. **W-DET-03:** Reload, Worker-Reordering, Originshift und QualityPreset ändern W1 niemals.
4. **W-DET-04:** fehlende Face-Nachbarn oder veraltete Revisionen ergeben `UnknownCoverage` / Reject, nicht still Luft und nicht Regen `0`.
5. **W-TIME-01:** Strategie A, Query zu T und später wieder zu T: exakt gleiche W1-Bytes trotz beliebig langer zwischenliegender Simulationszeit.
6. **W-TIME-02:** Strategie B, Full Replay vs Checkpoint+Tail: identische Gridbytes; der Vergleich wird mit drei verschieden langen Time-Catch-ups wiederholt.
7. **W-TIME-03:** `CoarseGridDynamics` darf bei langem Catch-up kein Analytic-Ersatzmodell heimlich veröffentlichen.
8. **W-PHYS-01:** Windvektoren an Cube-Face-Nähten korrekt transformiert; kein künstliches Störungsband.
9. **W-PHYS-02:** positive Druck-/Temperatur-/Stoffbereiche, bilanzierte Intercell-Flüsse und quantifizierte Sources/Sinks, keine negativen Kondensate.
10. **W-GEO-01:** ClimateNormals, Biome- und Hydrology-Outputs bleiben aus manifestgebundenen Eingaben reproduzierbar; lokale Chunk-Aufrufreihenfolge egal.
11. **W-GEO-02:** lokaler Voxel-Edit invalidiert lokale Strömungs-/Exposure-Projektion, ohne Macroclimate unnötig zu mutieren.
12. **W-PLANET-01:** Airless ergibt bei jedem Ort/Tick `NoAtmosphere`, ohne Rain/Fog/Wind.
13. **W-PLANET-02:** Titananalog liefert Methan-Kondensat/Niederschlag nur bei passenden Profileinstellungen, niemals implizites Wasser.
14. **W-PLANET-03:** Gasriesen-Profil validiert Druckniveaus ohne Bodengeometrie.
15. **W-PLANET-04:** gezeitengebundener Planet zeigt dauerhaftes Tag/Nacht-Heizungsgefälle ohne tägliches Kameraklima-Neuwürfeln.
16. **W-CONT-01:** Surface -> Wolken -> Orbit: gleiche stabile Sturm-ID, zusammenhängender Wolkenkörper und keine Pop-in-bedingte Meteorologieänderung.
17. **W-CONT-02:** Raketenwake/Schock verändert nur lokale Felder und erlaubte Ereignisse; kein rückwärtiger Schreibpfad aus Rendertexture in Makrowetter.
18. **W-SAVE-01:** Save pinned Digests, Wiederherstellung, Event-Idempotenz, beschädigter Checkpoint fail-closed.
19. **W-PERF-01:** Rohsamples für CPU-Ticks, Workerzeiten, Renderpasszeiten, Residency, GPU-Memory, Catch-up, Downloads, GC und Peak Heap.
20. **W-ART-01:** menschliche Sichtabnahme für Hestia sowie vier exotische Testplaneten. Bildqualität ist ein eigenes Gate, kein Ersatz für meteorologische Oracles.

### 20.2 Teststrecke: ein fliegender Spieler

Fixierte Seed-/Body-/Zeit-/Wetterprofile. Eine Sturmfront zieht über ein Meer zu einem Gebirge, während eine Rakete 800 km zurücklegt und durch eine lokale Cumulusschicht steigt. Telemetrie und Screenshots in A, B, innerhalb der Wolke, oberhalb der Wolke und Orbit; dieselben Messungen nach Save/Load und nach einem Origin Shift. Die Sturm-ID und W1-Quellhashes müssen sich zwischen Live-, Flug- und Kartenansicht auf denselben Simtick zurückführen lassen.

## 21. Umsetzungspakete ohne Cut-V3-Schreibkonflikt

| Paket | Code-/Researchscope | Exit Gate | Abhängigkeit |
|---|---|---|---|
| WXG-00 | gemeinsames Wetter-Vokabular, Zeitticks, Frames, Berechtigungen, Registry | Schema- und Source-Digest-Goldens | keine Productwrites |
| WXG-01 | `MacroGeographyAtlasV1` plus semantische Auflösung geologischer Quellen | Land/Ozean/Höhen-/Hydro-Determinismus | WXG-00 |
| WXG-02 | `ClimateNormalsCompiler` + 6 feste Planetenfixtureprofile | repro Klimakarten, keine undefinierten Stoffmodelle | WXG-00/01 |
| WXG-03 | `AnalyticSynopticV1` mit Storm/Front IDs, Zeit-/Raumqueries | A-B-A, Reisekohärenz, Tick-independence | WXG-02 |
| WXG-04 | `WeatherReadView` + `MesoWeather` + Streaming/Sourcebindung | gleiches W1 in Replay, Vorabfetch, regionalem Cache | WXG-03 |
| WXG-05 | Render-Port, Low/HDR Clouds/Fog/Orbit | visuelle Evidence und GPU-Budget | WXG-04 + v1-Renderpaket |
| WXG-06 | lokale F1/F2-Wake/Fluid/Volumen in separater Sandbox | Quellenbilanz, W1-Authoritätsgrenze, GPU/CPU-Spike | WXG-04/05 |
| WXG-07 | `CoarseGridDynamicsV1` als gesonderter Forschungs-Bakeoff für Hero-Planeten | Face-Seams, Stabilität, Catch-up und Replay | WXG-03; kein sofortiger Default |
| WXG-08 | Authoring-Workspace, Versionierung, optischer und fachlicher Stressvergleich | Owner-Gate, Lizenz/G13/QA, HVP-Integrationsfreigabe | vorherige Gates |

WXG-00 bis WXG-03 und ein isolierter WXG-05-Shader-Bakeoff sind nach festen Vertragsgrenzen parallelisierbar. Keine gemeinsamen Schreibpfade mit V3 Cut, Physik, Voxelkern oder Save. HVP-Integration erst an einem expliziten Merge-/Acceptance-Gate.

## 22. Offene Entscheidungen vor einer Implementierung

1. Soll Hestia selbst initial `AnalyticSynopticV1` nutzen, oder soll `CoarseGridDynamicsV1` als erster Hero-Planet bewusst zusätzlich erforscht werden? Empfehlung: `AnalyticSynoptic` für erstes spielbares Wetter, Grid-Bakeoff parallel.
2. Welche Planetentypen sollen die erste **supported** Runtime-Suite bilden? Empfehlung: Hestia, Airless, DustPlanet und MethanePlanet; GasGiant zunächst Snapshot-/Renderer-Spike ohne Gameplay-Aerodynamik.
3. Sollen hochqualitative Klimanormalwerte für Story-/Hero-Planeten mit externem GCM vorab erstellt werden? Empfehlung: später, nach erster eigener ClimateNormals-Fixture.
4. Wie viele gleichzeitige Planetensimulationen und welcher Simulationszeitbeschleunigungsbereich gelten als produktive Budgets? Ohne Angaben nur parametrisiertes Spiketarget.
5. Werden lokale Strömungen spielmechanisch autoritativ, oder bleiben sie VFX, während ein kleiner CPU-Resolver Wind/Sicht/Gefahr entscheidet? Empfehlung: zweite Option bis vollständiger deterministischer F2-Nachweis.
6. Welche Fremdlizenzen dürfen für externe Compiler/Renderer in Build bzw. Runtime akzeptiert werden? ExoPlaSim laut Projekttext GPL; NOAA FV3-Lizenz und ROCKE-3D separat anhand exakter Version prüfen.
7. Welche Daten aus großen Terrainänderungen sollen langfristig ins Klima zurückwirken? Empfehlung: regionale Landnutzungs-/Hydrologieereignisse, globales Terraforming als gesonderter Change-/Recompile-Vertrag.

## 23. Bewertung / technische Entscheidung

**Kompakter universeller Klimakern + vollständige grobe Wetterabdeckung + bedarfsgesteuerte Regional-/Volumendetails** ist für das Browserprojekt angemessen.

Das Risiko liegt nicht darin, Wolkenschichten zu zeichnen. Es liegt in uneinheitlicher Wetterwahrheit: wechselnde Wetterseeds bei Bewegung, unabhängigen Planetencaches, falsch skalierten Atmosphären, erdgebundenen Stoffannahmen, unkontrolliertem Offscreen-Catch-up und nicht reproduzierbarer Versionierung. Die in dieser Ergänzung beschriebenen Verträge behandeln diese Risiken direkt.

**Empfohlene Priorität:** W-DET-01 bis W-CONT-01 vor teurer Fluidästhetik beweisen. Sobald der Planet durchgängig dieselbe Wetterfront besitzt, können Wolkenphysik und WebGPU-Rendering unabhängig davon schrittweise realistischer werden.

## 24. Quellen und Vorarbeiten

### Verifizierte externe Fach- und Implementierungsquellen

1. NOAA GFDL, [FV3 Finite-Volume Cubed-Sphere Dynamical Core](https://www.gfdl.noaa.gov/fv3/): konservativer Transport, Cubed Sphere, hydrostatische/nichthydrostatische Modellfamilie, Grid-Nesting.
2. NOAA GFDL, [FV3 Grids und Edge Handling](https://www.gfdl.noaa.gov/fv3/fv3-grids/): Facegrenzen, Transport und Cube-Sphere-Ableitungen.
3. NASA GISS, [ROCKE-3D 2.0 (2025)](https://www.giss.nasa.gov/pubs/abs/ts02400q.html): generalisierte GCM-Parameter für felsige Planeten und veränderliche Atmosphären-/Ozeanprofile.
4. [ROCKE-3D 2.0 Publikation](https://gmd.copernicus.org/articles/18/5825/2025/): Referenz für wissenschaftliche Genauigkeit und eingeschränkten Konfigurationsbereich von Strahlungsmodellen.
5. [ExoPlaSim](https://github.com/alphaparrot/ExoPlaSim): exoplanetärer terrestrischer GCM mit Python-/Fortran-Toolchain und GPL-Hinweis; potenzieller externer Bake-Kandidat, keine Runtime-Library.
6. NASA Science, [Titan Facts](https://science.nasa.gov/saturn/moons/titan/facts/): CH4-Kreislauf, Methanregen und Kohlenwasserstoffgewässer.
7. NASA Science, [Jupiter Facts](https://science.nasa.gov/jupiter/jupiter-facts/): zonale Winde, Wolkenlagen und langlebige Wirbel.
8. NASA, [Dust Cycle auf Mars](https://www.nasa.gov/general/dust-cycle/): aerosolbasierte meteorologische Rückkopplung.
9. NASA Science, [Venus Facts](https://science.nasa.gov/venus/venus-facts/): dichte CO2-Atmosphäre, Schwefelsäurewolken.
10. NASA Science, [Pluto Facts](https://science.nasa.gov/dwarf-planets/pluto/facts/): saisonale Sublimation/Kondensation und dünne Atmosphären.
11. NASA Science, [Gas Giants](https://science.nasa.gov/exoplanets/gas-giant/): keine verpflichtende harte Oberfläche.
12. ECMWF, [Building a data-driven Earth system model (2026)](https://www.ecmwf.int/en/newsletter/187/earth-system-science/building-data-driven-earth-system-model-ecmwf): klimatisch und meteorologisch relevante Atmosphären-/Ozean-/Boden-/Eis-Kopplung.

### Projektbezogene Grundlagen

- Vorgängerbericht `HESTIA_DYNAMISCHES_VOLUMETRISCHES_WETTER_ARCHITEKTURKONZEPT_2026-10-09.md`, insb. Rendering, F0-F3 Fluidphysik, Cloud-Render-Port, Bildkomposition und Benchmarkplan. Die vorliegende v2 ersetzt seine allein auf Hestia ausgerichteten Profilschwerpunkte und konkretisiert die zuvor nur grob definierte PlanetWeatherAuthority.
- `apps/weltraum-browser/src/celestial/types.ts` + `starterSystem.ts` als existente Definition von Atmosphäre, Druck und Hazardflags.
- `apps/weltraum-browser/src/spatial/*` und die Planet-Floating-Origin-Verträge.
- `docs/research/planet-lod-streaming-reference-audit-v1.md`, insbesondere §10 Atmosphere/Cloud Adapter.
- `apps/weltraum-browser/src/hestia-prototype/presentation/visualEffects.ts` für den bestehenden HVP-Sky-/Shadow-Renderer.
- G10 Planet/System Editor, G13 Content Data/Versioning, G16 Procedural Settlement, G17 Editor QA und G02 Unified Authoring als **Proposals**, keine automatisch akzeptierten Laufzeitfeatures.

---

**Finaler Status:** `ARCHITECTURE_PROPOSED`, `ENGINE_UNCHANGED`, `GLOBAL_WEATHER_STRATEGY_REQUIRES_SPIKE`, `NO_PRODUCT_CODE_CHANGED`.
