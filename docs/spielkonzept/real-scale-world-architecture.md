# Spielkonzept: Real-Scale World Architecture

Stand: 2026-05-28  
Status: Konzeptbasis fuer Weltraum-Spiel, noch keine finale Implementierung  
Bezug: `docs/spielkonzept/startsystem.md` beschreibt, **was** im Aurelia-System existiert. Dieses Dokument beschreibt, **wie** echte Groessen, echte Abstaende und lokale Spielszenen technisch zusammenpassen.

## 1. Ziel

Das Startsystem verwendet reale Planetengroessen, reale Orbitabstaende und physikalisch abgeleitete Gravitation. Eine Unity-Szene kann solche Distanzen nicht naiv als normale `float`-Positionen darstellen. Dieses Dokument legt deshalb eine Architektur fest, bei der echte Daten erhalten bleiben, waehrend Rendering, Physik, UI und lokale Szenen kontrolliert skaliert werden.

Leitsatz:

> **Die Quelldaten bleiben real. Nur Darstellung, Streaming und lokale Physikframes werden angepasst.**

Das Ziel ist nicht, sofort ein perfektes Planetensystem zu bauen. Das Ziel ist, eine technische Richtung zu definieren, die schon mit simplen Meshes funktioniert und spaeter nicht verworfen werden muss.

## 2. Nicht-Ziele

Diese Datei definiert nicht:

- neue Planetenwerte,
- neue Hestia-Biome,
- neue Asteroidenorte,
- konkrete Texturen,
- konkrete Schiffsstats,
- das finale Multiplayer-Netcode-Modell.

Diese Datei definiert nur, wie reale Dimensionen in der Engine organisiert werden.

## 3. Kernproblem

Ein realistisches Sonnensystem hat extreme Groessenunterschiede:

- Schiffe: Meter bis hunderte Meter.
- Stationen: hundert Meter bis Kilometer.
- Asteroiden: Meter bis hunderte Kilometer.
- Planeten: tausende bis zehntausende Kilometer Radius.
- Orbits: Millionen bis Milliarden Kilometer.

Unity-Transforms verwenden normalerweise `float`. Bei sehr grossen Weltpositionen gehen kleine Positionsaenderungen verloren. Ein Schiff kann dann zittern, Kollisionen werden ungenau, Kameras flackern und UI-Marker springen.

Darum braucht das Spiel mehrere Koordinaten- und Darstellungsebenen.

## 4. Architektur in Ebenen

Das Spiel soll nicht eine einzige gigantische Unity-Szene sein. Stattdessen gibt es mehrere Ebenen mit klarer Verantwortung.

| Ebene | Zweck | Typische Einheit | Simulation | Darstellung |
| --- | --- | --- | --- | --- |
| Systemdaten | echte astronomische Daten | m, kg, s, AU | double/long double Konzeptdaten | keine direkte Szene |
| Orbit-/Navigationssimulation | Ephemeriden, Orbits, Flugplanung | m, m/s, s | double precision | Map-Linien, Marker |
| Systemkarte | Planeten, Orbits, Routen | skaliert/logarithmisch | read-only Projektion | stark skaliert |
| Lokaler Raum | Schiff, Station, Asteroid, Orbitnaehe | Unity Units = m oder 10 m | Rigidbody/Custom Physics | echte Nahbereichsproportionen |
| Oberflaechenszene | Planetoberflaeche, Landung, Basis | m | lokale Physik | Terrain/Chunks |
| Innenraum/Docking | Cockpit, Station, Hangar | m | normale Unity-Physik | normale Szene |

Die wichtigste Regel: Jede Ebene weiss, aus welcher echten Datenquelle sie abgeleitet wurde.

## 5. Absolute World Coordinates

Alle Himmelskoerper, Schiffe, Drohnen und Stationen haben eine absolute Position in einem systemweiten Referenzrahmen.

Empfohlenes Konzept:

```text
struct AbsoluteState
{
    BodyFrameId referenceFrame;
    double3 positionMeters;
    double3 velocityMetersPerSecond;
    double epochSeconds;
}
```

Eigenschaften:

- `positionMeters` ist niemals direkt ein Unity-Transform.
- `velocityMetersPerSecond` ist die echte physikalische Geschwindigkeit.
- `epochSeconds` bestimmt, fuer welchen Zeitpunkt der Zustand gilt.
- `referenceFrame` beschreibt, ob die Position z. B. sternzentrisch, planetenzentrisch oder lokal ist.

## 6. Floating Origin

Lokale Szenen verwenden einen Floating Origin. Das bedeutet: Die aktive Spielumgebung bleibt nahe bei `(0,0,0)` in Unity, waehrend die echte absolute Position separat gespeichert wird.

### 6.1 Grundregel

```text
unityLocalPosition = absolutePosition - currentFloatingOriginAbsolutePosition
```

Wenn der Spieler oder die aktive Kamera zu weit vom lokalen Ursprung entfernt ist, wird der Floating Origin verschoben. Alle lokalen Objekte werden relativ neu gesetzt, aber ihre absoluten Zustaende bleiben gleich.

### 6.2 Wann wird verschoben?

Mögliche Startwerte:

| Situation | Origin Shift Threshold |
| --- | ---: |
| Cockpit/Innenraum | 1-5 km |
| Lokaler Raumflug | 10-50 km |
| Asteroidenfeld | 25-100 km |
| Hoher Orbit | 100-500 km |
| Systemkarte | kein normaler Floating Origin, eigene Projektion |

Die Werte sind Balancing-/Technikwerte und muessen spaeter getestet werden.

## 7. Koordinatenframes

Es soll nicht nur einen Weltframe geben. Das Spiel braucht explizite Frames.

| Frame | Verwendung |
| --- | --- |
| `StarBarycentricFrame` | Systemweite Ephemeriden, Planetenorbits, Systemkarte. |
| `PlanetCenteredFrame` | Monde, lokale Orbits, SOI, Zielanflug. |
| `MoonCenteredFrame` | Mondorbit, Landung, lokale Basen. |
| `AsteroidFrame` | Mining, Stationen auf Asteroiden, kleine Gravitation. |
| `ShipLocalFrame` | Innenraum, Cockpit, Docking, lokale Referenz fuer Crew. |
| `SurfaceLocalFrame` | Planetenterain, Landepunkte, Basen, Rover. |

Jedes Objekt soll wissen, in welchem Frame sein aktueller Zustand interpretiert wird. Frame-Wechsel muessen sauber validiert werden.

## 8. Darstellungsmassstab

Das Spiel darf mehrere Massstaebe gleichzeitig nutzen.

### 8.1 Systemkarte

Die Systemkarte soll nicht versuchen, reale Planeten- und Orbitgroessen im selben Massstab darzustellen. Sonst waeren Planeten unsichtbare Pixel und Orbits riesig.

Moegliche Loesung:

- Orbits linear oder leicht logarithmisch skalieren.
- Planeten visuell vergroessern, aber mit Tooltip fuer echte Werte.
- Mondorbits bei Bedarf in separater Detailansicht zeigen.
- Schiffe und Routen als Symbole darstellen, nicht als echte Meshgroessen.

### 8.2 Lokale Raumansicht

Im lokalen Raum sollen Nahbereiche glaubwuerdig sein:

- Schiffsgroesse real.
- Stationen real oder leicht spielbar skaliert.
- Asteroiden real, wenn sie betreten/umflogen werden.
- Planeten am Himmel duerfen impostor-/shaderbasiert sein.

### 8.3 Planetenoberflaeche

Planetenoberflaechen sind lokale Szenen. Der gesamte Planet wird nicht als ein normales Unity-Terrain geladen.

Stufen:

1. Orbit-Impostor.
2. Hochorbit-LOD-Sphere.
3. Atmosphaeren-/Landeanflug-Shell.
4. Lokale Surface-Chunks.
5. Detail-Assets und Gameplayzonen.

## 9. Scene Streaming

Szenen sollen nach Aktivitaet geladen werden.

### 9.1 Aktive Szenen

Aktiv geladen werden nur Bereiche, in denen Interaktion stattfindet:

- Spielerumgebung.
- bemanntes Spielerschiff.
- gerade kontrollierte Drohne.
- Station/Dockingbereich.
- Kampf- oder Intercept-Zone.
- aktive Landestelle.

### 9.2 Nicht aktive Objekte

Nicht aktive Objekte laufen als Datenobjekte weiter:

- Schiffe auf Autopilot.
- Drohnenmissionen.
- entfernte NPCs.
- Planeten, Monde und Asteroiden auf Ephemeriden.
- Stationen ohne aktive Spielernaehe.

Diese Objekte brauchen keine geladenen Meshes, solange keine Interaktion sichtbar ist.

## 10. Naehezonen und LOD

Jeder grosse Koerper bekommt Zonen.

| Zone | Bedeutung | Darstellung |
| --- | --- | --- |
| Deep Space | sehr weit weg | Map-Symbol oder Sternpunkt |
| Far Approach | sichtbar, aber nicht interaktiv | Impostor/LOD-Sphere |
| High Orbit | Navigation und Gravitation relevant | LOD-Sphere, Orbitmarker |
| Low Orbit | Atmosphaere, Oberflaeche, Stationen relevant | hoehere LOD, lokale Zonen |
| Surface | Landung/Boden | Surface-Chunks |

Der Wechsel zwischen Zonen muss fuer Autopilot, Timewarp und UI explizit erkennbar sein.

## 11. Gravitation und Real-Scale

Rendering-Skalierung darf Gravitation nicht veraendern. Gravitation verwendet echte Werte:

```text
a = mu / r^2
```

Dabei ist `r` die echte Entfernung in Metern, nicht die skaliert dargestellte Unity-Distanz.

Fuer lokale Raumphysik gibt es zwei Optionen:

1. Gravitation als Kraft im lokalen Unity-Frame anwenden.
2. Schiffszustand ausserhalb von Rigidbody berechnen und Rigidbody nur fuer lokale Interaktion nutzen.

Langfristig ist Option 2 robuster fuer Orbitphysik. Fuer den ersten Prototyp kann Option 1 reichen, solange Distanzen klein und Frames klar sind.

## 12. Timewarp-Kompatibilitaet

Objektgebundener Timewarp braucht dieselbe Architektur.

- Das warpendende Objekt muss einen absoluten Zustand haben.
- Es darf nicht nur als Unity-Transform existieren.
- Warp integriert absolute Position, Geschwindigkeit, Treibstoff und Planstatus.
- Wenn Warp endet, wird aus dem absoluten Zustand eine lokale Szene erzeugt oder aktualisiert.
- Safety Bubbles werden in echten Metern berechnet, nicht in visuellen Map-Einheiten.

## 13. Singleplayer und Multiplayer

Die Architektur muss fuer beide Modi passen.

### 13.1 Singleplayer

- Lokaler Prozess ist autoritativ.
- Floating Origin und Streaming duerfen direkt lokal entschieden werden.
- Entfernte Objekte koennen aggressiver abstrahiert werden.
- Trotzdem muessen absolute Zustaende deterministisch bleiben.

### 13.2 Multiplayer

- Server/Host ist fuer absolute Zustaende autoritativ.
- Clients rendern lokale Projektionen.
- Floating Origin ist clientlokal.
- Server muss keine Unity-Szene in echter Groesse haben.
- Interaktionen werden in echten Koordinaten und echten Safety-Zonen entschieden.

## 14. Erster Prototyp

Minimal sinnvolle Umsetzung:

1. `AbsoluteState` fuer Schiff, Planeten und Drohnen einfuehren.
2. Lokaler Floating-Origin-Manager fuer aktive Szene.
3. Systemkarte mit skalierten Orbitlinien und echten Tooltip-Werten.
4. Planetenspheres als visuelle Platzhalter.
5. Eine lokale Orbit-/Space-Szene um Hestia.
6. Ein Frame-Wechsel: Systemkarte -> Hestia-Nahbereich.
7. Debug-Anzeige fuer absolute Position, lokalen Origin, Frame und Distanz zum Hauptkoerper.

## 15. Validierungschecks

Fruehe Tests:

- Ein Schiff kann 1 Mio. km absolute Distanz haben, ohne lokales Jitter.
- Floating-Origin-Shift veraendert absolute Position und Geschwindigkeit nicht.
- Planetenskalierung in der Map veraendert Gravitation nicht.
- UI zeigt echte und visuelle Distanzen getrennt an.
- Warp-Exit erzeugt eine lokale Szene am korrekten absoluten Zustand.
- Speichern und Laden rekonstruiert denselben Frame.

## 16. Offene Fragen

- Wird die Systemkarte linear, logarithmisch oder hybrid skaliert?
- Sollen lokale Raumzonen immer kugelfoermig sein oder entlang von Orbits gestreckt werden?
- Wie viele aktive lokale Szenen duerfen gleichzeitig existieren?
- Wie frueh brauchen wir echte Surface-Chunks?
- Soll der Spieler nahtlos von Orbit zu Oberflaeche wechseln oder per Ladeuebergang?

## 17. Kurzfazit

Das Spiel soll reale astronomische Daten behalten, aber nicht versuchen, das gesamte Sonnensystem als eine normale Unity-Szene abzubilden. Absolute double-precision Zustaende, lokale Floating-Origin-Szenen, klare Frames, skalierte Systemkarten und explizite Streaming-Zonen bilden die Grundlage. Dadurch koennen Startsystem, Orbitphysik, Autopilot, Drohnen, Timewarp und spaeter Multiplayer auf derselben technischen Basis aufbauen.
