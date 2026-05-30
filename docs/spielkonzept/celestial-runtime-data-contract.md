# Spielkonzept: Celestial Runtime Data Contract

Stand: 2026-05-28  
Status: Konzeptbasis fuer Weltraum-Spiel, noch keine finale Implementierung  
Bezug: `startsystem.md` definiert die Himmelskoerper. Dieses Dokument definiert den Datenvertrag, mit dem diese Koerper in Simulation, Rendering, UI, Savegame und Tools verwendet werden.

## 1. Ziel

Dieses Dokument beschreibt, welche Daten ein Stern, Planet, Mond, Asteroid oder eine Station im Spiel mindestens besitzen muss. Es geht nicht darum, neue Inhalte zu erfinden, sondern darum, die im Startsystem definierten Werte sauber in Runtime-Daten zu ueberfuehren.

Leitsatz:

> **Astronomische Quelldaten, visuelle Darstellung, lokale Physik und Gameplay-Zugriff werden getrennt gespeichert, aber ueber stabile IDs verbunden.**

Das verhindert, dass physikalische Werte spaeter in Prefabs, Materialien, UI-Texten und Autopilot-Code auseinanderlaufen.

## 2. Nicht-Ziele

Diese Datei beschreibt nicht:

- neue Planeten oder Monde,
- neue Biome,
- konkrete Materialien oder Texturen,
- das finale JSON-/ScriptableObject-Format im Detail,
- konkrete UI-Layouts.

Sie legt fest, welche Datenfelder und Validierungsregeln gebraucht werden.

## 3. Kernobjekte

Die Runtime sollte Himmelskoerper nicht als einzelne MonoBehaviour-Klasse behandeln. Besser ist ein Satz von Datenobjekten.

| Datenobjekt | Aufgabe |
| --- | --- |
| `CelestialBodyDefinition` | Physikalische und semantische Basisdaten. |
| `OrbitDefinition` | Bahn um einen Parent-Koerper. |
| `RotationDefinition` | Tageslaenge, Achsneigung, Rotationsrichtung. |
| `AtmosphereDefinition` | Druck, Zusammensetzung, Hoehe, Gameplay-Gefahren. |
| `GravityDefinition` | `mu`, SOI, Oberflaechengravitation, Validierungswerte. |
| `VisualScaleProfile` | Darstellungsgroesse je Ansichtsebene. |
| `SurfaceAccessProfile` | Ob und wie Koerper betreten, gelandet oder betreten werden koennen. |
| `ResourceProfile` | Grobe Rohstoff- und Scan-Daten. |
| `GameplayAccessProfile` | Docking, Basen, Missionen, Interaktion. |

Nicht jeder Koerper braucht jedes Profil. Ein Gasriese braucht z. B. keine normale Surface-Landing-Definition, aber sehr wohl Atmosphaere, Gravitation und Orbit.

## 4. Stabile IDs

Jeder Koerper braucht eine stabile ID, die nie von Anzeigenamen abhaengt.

Beispiel:

```text
star.aurelia
planet.korus
planet.hestia
moon.hestia.luma
asteroid.eber
station.eber_relay
```

Regeln:

- IDs sind lowercase und ASCII.
- Anzeigenamen duerfen spaeter lokalisiert oder geaendert werden.
- Savegames speichern IDs, nicht Anzeigenamen.
- Routen, Missionen, Drohnen und Basen referenzieren IDs.
- IDs duerfen nach Release nicht ohne Migration geaendert werden.

## 5. CelestialBodyDefinition

Minimaler Datenvertrag:

```text
CelestialBodyDefinition
{
    string id;
    string displayName;
    CelestialBodyType type;
    string parentBodyId;

    double radiusMeters;
    double massKg;
    double gravitationalParameterMu;
    double meanDensityKgPerM3;

    OrbitDefinition orbit;
    RotationDefinition rotation;
    GravityDefinition gravity;
    AtmosphereDefinition atmosphere;
    VisualScaleProfile visualScale;
    SurfaceAccessProfile surfaceAccess;
    ResourceProfile resources;
    GameplayAccessProfile gameplay;
}
```

Pflichtfelder:

- `id`
- `displayName`
- `type`
- `radiusMeters`
- `massKg` oder `gravitationalParameterMu`
- `gravity`
- `visualScale`

Optional, aber fuer die meisten Koerper sinnvoll:

- `orbit`
- `rotation`
- `atmosphere`
- `surfaceAccess`
- `resources`
- `gameplay`

## 6. CelestialBodyType

Startwerte:

```text
Star
RockyPlanet
SuperEarth
GasGiant
IceGiant
Moon
Asteroid
Comet
Station
ArtificialStructure
```

`Station` ist absichtlich kein natuerlicher Himmelskoerper, darf aber im selben Referenzsystem existieren. Eine Station hat keine planetare Gravitation, kann aber Orbit, Safety Bubble, Docking und UI-Marker besitzen.

## 7. OrbitDefinition

```text
OrbitDefinition
{
    string parentBodyId;
    double semiMajorAxisMeters;
    double eccentricity;
    double inclinationDegrees;
    double longitudeOfAscendingNodeDegrees;
    double argumentOfPeriapsisDegrees;
    double meanAnomalyAtEpochDegrees;
    double epochSeconds;
    bool isAnalytical;
}
```

Regeln:

- `semiMajorAxisMeters > 0`, wenn ein Parent existiert.
- `eccentricity >= 0` und fuer stabile Planeten zunaechst nahe 0.
- `parentBodyId` muss existieren.
- Planeten haben als Parent den Stern.
- Monde haben als Parent ihren Planeten.
- Stationen koennen Parent Planet, Mond, Asteroid oder Stern haben.

## 8. RotationDefinition

```text
RotationDefinition
{
    double rotationPeriodSeconds;
    double axialTiltDegrees;
    bool retrograde;
    double primeMeridianAtEpochDegrees;
}
```

Wird benoetigt fuer:

- Tag-/Nachtzyklus.
- Oberflaechenpositionen.
- Landepunkte.
- Sonnenstand.
- Atmosphaeren- und Wettermodelle.
- spaetere Basisplatzierung.

## 9. GravityDefinition

```text
GravityDefinition
{
    double mu;
    double surfaceGravityMetersPerSecondSquared;
    double escapeVelocityMetersPerSecond;
    double sphereOfInfluenceMeters;
    bool canBeDominantGravitySource;
}
```

Validierung:

- `mu` muss zu `massKg` passen, wenn beide gesetzt sind.
- Oberflaechengravitation muss plausibel aus `mu / radius^2` ableitbar sein.
- `sphereOfInfluenceMeters` darf berechnet oder ueberschrieben werden.
- Kleine Asteroiden koennen `canBeDominantGravitySource = false` haben, wenn ihre Gravitation fuer Gameplay ignoriert wird.

## 10. AtmosphereDefinition

```text
AtmosphereDefinition
{
    bool hasAtmosphere;
    double surfacePressurePa;
    double scaleHeightMeters;
    double atmosphereOuterRadiusMeters;
    GasMixture gases;
    AtmosphereHazardFlags hazards;
}
```

Start-Hazards:

```text
None
HighPressure
LowPressure
Toxic
Corrosive
HighOxygen
Radiation
Storms
ThermalExtreme
```

Die Atmosphaere ist fuer Rendering, Aerobraking, Landung, Survival-Gefahren und Sound relevant.

## 11. VisualScaleProfile

Physikalische Daten duerfen nicht durch Darstellungsgroessen ersetzt werden. Deshalb braucht jeder Koerper ein eigenes Visual-Profil.

```text
VisualScaleProfile
{
    double mapRadiusScale;
    double localSpaceRadiusScale;
    double impostorRadiusScale;
    bool exaggerateInSystemMap;
    string materialProfileId;
    string iconId;
}
```

Beispiel:

- In der Systemkarte kann Hestia visuell groesser erscheinen, damit sie sichtbar bleibt.
- In der lokalen Orbitansicht kann Hestia als Shader-Sphere oder Impostor erscheinen.
- Physik nutzt trotzdem `radiusMeters`.

## 12. SurfaceAccessProfile

```text
SurfaceAccessProfile
{
    bool canLand;
    bool hasGeneratedSurface;
    bool hasPlayableSurface;
    bool requiresSpecialProtection;
    double safeLowOrbitAltitudeMeters;
    double atmosphereEntryAltitudeMeters;
    SurfaceTransitionMode transitionMode;
}
```

`SurfaceTransitionMode`:

```text
None
OrbitOnly
LoadingTransition
SeamlessTransitionPrototype
DockingOnly
```

Startempfehlung:

- Hestia: spaeter playable, anfangs OrbitOnly oder LoadingTransition.
- Pyra: keine normale Landung, nur Spezialmissionen.
- Gasriesen: keine Oberflaechenlandung.
- Asteroiden: lokale begeh-/umfliegbare Szenen.

## 13. ResourceProfile

```text
ResourceProfile
{
    string[] resourceTags;
    double scanDifficulty;
    bool supportsMining;
    bool supportsAtmosphericHarvesting;
    bool supportsSurfaceCollection;
}
```

Diese Datei definiert keine Wirtschaft. Sie stellt nur sicher, dass Himmelskoerper spaeter Ressourcen referenzieren koennen, ohne das Startsystem-Dokument zu veraendern.

## 14. GameplayAccessProfile

```text
GameplayAccessProfile
{
    bool canHostStations;
    bool canHostBases;
    bool canHostMissions;
    double defaultSafetyBubbleMeters;
    string[] allowedMissionTypes;
}
```

Wichtig fuer:

- Timewarp-Abbrueche.
- Autopilot-Ziele.
- Drohnenmissionen.
- Intercepts.
- Docking.
- Map-Filter.

## 15. Datenquelle: ScriptableObject oder JSON

Beide Wege sind moeglich.

### 15.1 ScriptableObjects

Vorteile:

- bequem im Unity Editor.
- direkte Referenzen auf Materialien, Icons und Prefabs.
- gut fuer Designer.

Nachteile:

- schwieriger extern zu validieren.
- Merge-Konflikte koennen unuebersichtlich sein.
- Datenexport fuer Server/Tools braucht Zusatzlogik.

### 15.2 JSON/YAML

Vorteile:

- gut versionierbar.
- leicht fuer Server, Tests und Tools nutzbar.
- Validierung ausserhalb Unity moeglich.

Nachteile:

- Editor-Workflow weniger bequem.
- Assetreferenzen brauchen IDs.

### 15.3 Empfehlung

Langfristig: **kanonische Daten als JSON/YAML, Unity-Import als ScriptableObjects.**

So kann der gleiche Datensatz fuer Singleplayer, Server, Tests, Tools und Unity-Editor genutzt werden.

## 16. Validierungsregeln

Pflichtchecks:

- ID eindeutig.
- Parent existiert.
- Radius > 0.
- Masse > 0 oder `mu > 0`.
- Wenn Masse und `mu` gesetzt sind: Abweichung unter definierter Toleranz.
- Orbitdaten plausibel.
- SurfaceAccess passt zum BodyType.
- AtmosphereOuterRadius groesser als Radius, wenn Atmosphaere existiert.
- Safety Bubble nicht negativ.
- Visual-Profil vorhanden.

## 17. Savegame-Kompatibilitaet

Savegames speichern nicht die gesamte Definition, sondern:

- Body-ID.
- lokale Instanzen wie Basen, Stationen, entdeckte Ressourcen.
- Spielerfortschritt.
- veraenderliche Zustandsdaten.

Wenn eine Definition aktualisiert wird, muss das Savegame weiterhin ueber ID und Migration funktionieren.

## 18. Erster Prototyp

Minimaler Scope:

1. JSON- oder ScriptableObject-Datensatz fuer Aurelia, Hestia, Luma und einen Asteroiden.
2. Validierung von Radius, Masse und `mu`.
3. Systemkarte liest aus Definitionsdaten.
4. GravitySource liest `mu` aus Definition.
5. Visual-Sphere liest Radius und VisualScale getrennt.
6. Debugfenster zeigt echte Werte und visuelle Werte.

## 19. Offene Fragen

- Wollen wir zuerst JSON oder ScriptableObjects als kanonische Quelle?
- Wie streng soll die `mu`-Validierung sein?
- Werden Materialprofile ebenfalls datengetrieben?
- Wann werden Ressourcenprofile konkretisiert?
- Wie behandeln wir kuenstliche Stationen im gleichen Katalog wie Planeten?

## 20. Kurzfazit

Das Celestial Runtime Data Contract Dokument trennt echte physikalische Daten, visuelle Darstellung, Oberflaechenzugriff, Ressourcen und Gameplay-Funktionen. Jeder Koerper bekommt eine stabile ID und klar validierte Daten. Dadurch koennen Startsystem, Orbitphysik, UI, Autopilot, Drohnen, Timewarp und Savegames dieselbe Datenbasis nutzen, ohne Werte mehrfach und widerspruechlich zu speichern.
