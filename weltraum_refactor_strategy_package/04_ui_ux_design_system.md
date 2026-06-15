# 04 - UI/UX Design System für Weltraum-Spiel

## Grundsatz

Die UI soll nicht mehr wie ein Debug-Prototyp wirken. Sie muss dem Spieler
sagen:

```text
Wo bin ich?
Was ist mein aktiver Modus?
Was ist mein nächstes sinnvolles Ziel?
Warum ist eine Aktion erlaubt oder blockiert?
Welche Information ist jetzt wirklich wichtig?
```

## UI-Kategorien

Für jedes UI-Element wird entschieden, welche Kategorie passt:

```text
Non-diegetic
  Klassische HUD-/Menü-Overlays. Gut für Lesbarkeit und Accessibility.

Diegetic
  UI existiert in der Welt, z.B. Cockpit-Displays, Terminal, Scannergerät.

Spatial
  Marker und Labels direkt im Raum: Ziel, Route, Gefahr, Ressource, Outpost.

Meta
  UI ist Overlay, passt aber zur Fantasie: Helm-HUD, Schiff-Computer, Suit-HUD.
```

Weltraum sollte bewusst mischen:

```text
Space flight:
  Meta/Non-diegetic HUD + Spatial target markers.

Navigation Computer:
  Meta panel + System Map.

Surface first-person:
  Suit-HUD als Meta + Spatial scanner highlights.

Outpost/Terminal:
  Diegetic oder Meta Terminal UI.

Debug:
  Separat, niemals die einzige Spieleroberfläche.
```

## Informationshierarchie

```text
Ebene 0 - Immer sichtbar
  Aktiver Modus, kritische Warnung, Reticle/Focus, minimaler Ship/Suit Status.

Ebene 1 - Kontext sichtbar
  Navigation, Combat, Cargo, Surface Interaction, Builder Validation.

Ebene 2 - Geöffnetes Panel
  Details, Listen, Planner, Map, Inventory, Settings.

Ebene 3 - Debug
  Raw values, plan revision, candidate score, profiler, legacy diagnostics.
```

## Space Flight HUD

### Minimal sichtbar

```text
- Aktiver Modus: ShipFlight / Navigation / Combat / Builder / Surface
- Geschwindigkeit relativ zu Ziel/Frame
- Throttle
- Fuel
- RCS/SAS Status
- Zielname + Distanz, falls Ziel aktiv
- Autopilot State, falls aktiv/geplant/blockiert
- Warnchips: Fuel, Authority, Obstacle, Unsafe Target, No Brake Reserve
```

### Nicht permanent sichtbar

```text
- komplette Raw-Plan-Daten
- lange Debug-Listen
- alle Waffenwerte
- alle Cargo-Werte
- sämtliche Keybinds
```

### Center View freihalten

Die zentrale Sichtachse ist bei Space Flight kritisch: Schiff, Ziel, Prograde/
Retrograde, Hindernisse, Projektile, Route. Permanente UI gehört an Ränder,
nur Reticle/Marker dürfen in die Mitte.

## Radar / Minimap

Die Minimap ist nicht die Systemkarte. Sie ist ein lokales Situationsinstrument.

### Zeigt

```text
- eigenes Schiff im Zentrum oder stabiler Orientierung
- Zielrichtung
- Route-Korridor lokal
- nahe Hindernisse
- Asteroiden/Bauwerke/Stationen
- Gegner/Freunde, wenn bekannt
- Scale-Ringe
- Höhe/Relativgeschwindigkeit nur bei Bedarf
```

### Regeln

```text
- klare Orientierung: ship-forward oder north/system-up, aber sichtbar beschriftet
- klare Scale: z.B. 250m / 1km / 5km
- Filter: All, Nav, Combat, Cargo, Hazards
- nie Debug-Minimap als Player-Minimap tarnen
- nicht zu viele Icons; Cluster oder Filter verwenden
```

## Große 3D-Systemkarte

Die Systemkarte ist für Planung, nicht für Mikromanagement während Flight.

### Kernfunktionen

```text
- Planeten/Mond/Stationen/Asteroiden/Factions/Outposts
- Zielauswahl
- Route Preview
- Fastest/Fuel Saver/Balanced Vergleich
- Fuel/ETA/Brake Reserve
- Risiko-/Legal-/Authority-Warnungen
- Zeitvorschau für geplante Route
- Layer/Filter
- Suche und Markerlisten
```

### Autopilot Planner UI

```text
Panel: Route Candidate
  Candidate name
  ETA
  Fuel used
  Fuel reserve after brake
  Risk
  Clearance
  Warnings
  Why selected

Panel: Execution
  PlanHash
  Segment
  Time to next segment
  Arrival Envelope
  Abort/Cancel
  No silent replan indicator

Panel: Failure
  Reason
  Player action
  Replan button
  Target edit button
```

## First-Person Surface UI

### Minimal Suit HUD

```text
- Health / suit integrity
- Oxygen / energy
- Temperature / radiation / pressure hazard
- Compass/local frame
- Ship beacon
- Objective
- Scanner reticle
- Tool status
```

### Surface Interaction Prompt

```text
Name
Aktion
Distanz
Benötigtes Tool
Owner/Faction, wenn bekannt
Legal/Risk status
Cargo/Mass effect, falls relevant
```

Beispiel:

```text
Iron-Silicate Vein
Action: Mine
Tool: Cutter Tier 1
Owner: unclaimed
Risk: dust, low
```

## Settings und Keybinds

### Settings-Struktur

```text
Settings
  Controls
    Ship Flight
    Navigation/Map
    Surface First Person
    Builder
    Drone
    UI/Menu
    Debug
  Graphics
    Resolution
    Display mode
    Quality
    Render scale
    VSync
    FPS cap
    FOV / camera shake
  Audio
    Master
    Music
    SFX
    UI
  Gameplay
    Autopilot default mode
    HUD detail preset
    Measurement units
    Hold-to-confirm dangerous actions
  Accessibility
    Text scale
    Contrast
    Reticle scale
    Motion/camera shake
    Colorblind-safe markers
```

### Keybind-Regeln

```text
- Eine Taste darf je nach Top-Level-Mode anders wirken, aber nie heimlich.
- Textfelder und modale Panels blockieren Flight-/Surface-Axes.
- Rebinding UI zeigt Konflikte nach Mode getrennt.
- Debug-Bindings sind in Debug-Abschnitt, nicht in Player Help.
```

## Umsetzung in Unity

Kurzfristig:

```text
- vorhandenes uGUI nicht abrupt löschen
- neue ViewModels/Presenter einführen
- UI-Logik aus Gameplay-Systemen entfernen
- Debug-IMGUI als Diagnostics-only markieren
```

Mittelfristig:

```text
- UI Toolkit für neue komplexe Panels prüfen: Settings, System Map, Builder,
  Navigation Planner.
- Runtime-HUD kann uGUI bleiben, solange ViewModel-Grenzen sauber sind.
- Nicht uGUI/UI Toolkit/IMGUI wild mischen; wenn gemischt, dann über klare Adapter.
```

## AI-Agent-Regeln für UI

```text
- Keine generischen Glas-Karten-/Gradient-Dashboards.
- Keine Unicode-Icon-Suppe.
- Keine neue UI ohne Flow oder Wireframe.
- Eine UI-Änderung pro Task.
- Screenshot-Matrix für 16:9, 16:10, 4:3, Ultrawide.
- Debug UI und Player UI getrennt halten.
- Jeder Panel muss einen Owner haben: welches System liefert Wahrheit?
```

## UI-Evidence

```text
tests/screenshots/
  shipflight-basic-1280x720.png
  shipflight-autopilot-active-1280x720.png
  navigation-plan-ready-1280x720.png
  navigation-fuel-insufficient-1280x720.png
  system-map-target-select-1280x720.png
  surface-suit-hud-1280x720.png
  settings-keybind-conflict-1280x720.png
```

Akzeptanz:

```text
- keine Überlappungen
- kritischer Fokusbereich frei
- Texte lesbar
- Modus sichtbar
- nächste Aktion sichtbar
- blockierte Aktion erklärt
```
