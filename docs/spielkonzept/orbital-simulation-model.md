# Spielkonzept: Orbital Simulation Model

Stand: 2026-05-28  
Status: Konzeptbasis fuer Weltraum-Spiel, noch keine finale Implementierung  
Bezug: `startsystem.md` liefert reale Koerperdaten. Dieses Dokument definiert, wie diese Daten fuer Orbitphysik, Gravitation, Flugplanung und Vorhersagen genutzt werden.

## 1. Ziel

Dieses Dokument beschreibt das physikalische Simulationsmodell fuer Planeten, Monde, Asteroiden, Schiffe und Drohnen. Es soll realistisch genug sein, damit Masse, Gravitation, Orbitabstaende und Geschwindigkeit glaubwuerdig funktionieren, aber pragmatisch genug, damit das Spiel spielbar und implementierbar bleibt.

Leitsatz:

> **Gravitation und Orbitplanung basieren auf echten physikalischen Groessen, aber die Simulation nutzt bewusst vereinfachte, stabile Modelle.**

Das Modell muss folgende Systeme bedienen:

- Autopilot.
- Navigation Computer.
- objektgebundener Timewarp.
- Drohnenmissionen.
- Intercepts.
- Systemkarte.
- lokale Raumphysik.
- spaetere Multiplayer-Autoritaet.

## 2. Nicht-Ziele

Diese Datei legt nicht fest:

- welche Planeten existieren,
- welche Biome Hestia hat,
- welche Ressourcen Asteroiden enthalten,
- wie das HUD aussieht,
- konkrete Waffen- oder Schiffswerte.

Sie definiert nur, wie bewegte Koerper gravitationell und orbital behandelt werden.

## 3. Simulationsstufen

Die Simulation soll nicht sofort mit vollstaendigem N-Body starten. Stattdessen gibt es aufeinander aufbauende Stufen.

| Stufe | Modell | Einsatz |
| --- | --- | --- |
| 0 | statische Platzhalterorbits | visuelle Systemkarte, erster Prototyp |
| 1 | analytische Keplerbahnen fuer Himmelskoerper | Planeten, Monde, grosse Asteroiden |
| 2 | punktmassenbasierte lokale Gravitation | Schiffe, Drohnen, nahe Koerper |
| 3 | Sphere-of-Influence Wechsel | planetare Anfluege, Monde, Asteroiden |
| 4 | Patched Conics | Autopilot und Transferplanung |
| 5 | begrenztes N-Body fuer Spezialfaelle | spaeter, nur wenn noetig |

Die ersten spielbaren Versionen sollen Stufe 1 bis 3 priorisieren.

## 4. Grunddaten

Jeder gravitative Koerper braucht mindestens:

```text
name
radiusMeters
massKg
gravitationalParameterMu
rotationPeriodSeconds
orbitDefinition
referenceFrame
```

Wichtige Regel:

```text
mu = G * mass
```

Fuer die Simulation ist `mu` wichtiger als die Masse selbst. Masse bleibt trotzdem im Datensatz, weil sie fuer UI, Dichte, Lore, Ressourcen und Validierung gebraucht wird.

## 5. Gravitation

Die Basisformel lautet:

```text
acceleration = -normalize(relativePosition) * mu / distance^2
```

Dabei gilt:

- `distance` ist echte Entfernung in Metern.
- `mu` ist der Gravitationsparameter des dominanten Koerpers.
- Rendering-Skalierung darf diese Werte nicht veraendern.
- Lokale Floating-Origin-Verschiebungen duerfen keine physikalische Aenderung erzeugen.

## 6. Dominante Gravitation

Fuer normales Gameplay soll ein Schiff meistens nur von einem dominanten Koerper beeinflusst werden.

Beispiele:

- Im interplanetaren Raum dominiert der Stern.
- In Hestias Naehe dominiert Hestia.
- In Lumas Naehe dominiert Luma.
- In der Naehe eines kleinen Asteroiden kann Gravitation optional vernachlaessigt oder stark vereinfacht werden.

Das reduziert Komplexitaet und macht Autopilot und Timewarp stabiler.

## 7. Sphere of Influence

Jeder Koerper kann eine Sphere of Influence bekommen. Innerhalb dieser Zone wird er fuer lokale Flugplanung dominant.

Naive Formel als Startpunkt:

```text
SOI = semiMajorAxis * (bodyMass / parentMass)^(2/5)
```

Regeln:

- SOI wird aus echten Daten berechnet oder im Datensatz bewusst ueberschrieben.
- SOI-Wechsel sind explizite Ereignisse.
- Beim SOI-Wechsel wird Position und Geschwindigkeit in den neuen Referenzframe transformiert.
- Der Autopilot muss SOI-Wechsel als Segmente kennen.
- Timewarp muss vor SOI-Wechseln reduzieren oder neu validieren.

## 8. Keplerbahnen fuer Himmelskoerper

Planeten, Monde und grosse Asteroiden sollen zunaechst analytisch bewegt werden. Das bedeutet: Ihre Position wird aus Orbitparametern und Zeit berechnet, nicht durch instabile Frame-zu-Frame-Integration.

Minimal benoetigte Orbitparameter:

```text
parentBodyId
semiMajorAxisMeters
eccentricity
inclinationDegrees
longitudeOfAscendingNodeDegrees
argumentOfPeriapsisDegrees
meanAnomalyAtEpochDegrees
epochSeconds
```

Fuer den ersten Prototyp darf gelten:

- Exzentrizitaet = 0 fuer fast kreisfoermige Bahnen.
- Inklination = 0 fuer einfache Planare Orbits.
- Monde bekommen eigene Bahnen um ihren Planeten.
- Asteroiden koennen gruppenweise vereinfacht werden.

## 9. Schiffe und Drohnen

Schiffe und Drohnen sind keine reinen Keplerkoerper, weil sie aktiv beschleunigen.

Sie brauchen:

```text
absoluteState
currentReferenceFrame
massCurrentKg
fuelMassKg
thrustCapabilities
autopilotPlan
warpState
```

Die Bewegungsintegration muss mindestens erfassen:

- Gravitation.
- Haupttriebwerk-Beschleunigung.
- RCS-Korrekturen.
- Masseaenderung durch Treibstoffverbrauch.
- geplante Burns.
- Bremsmanoever.

## 10. Integration von Schiffszustaenden

Fuer normale Realzeitphysik:

```text
velocity += acceleration * dt
position += velocity * dt
```

Fuer groessere Zeitschritte, etwa Timewarp, reicht einfache Euler-Integration nicht. Der Predictor muss stattdessen eine robustere Methode verwenden.

Empfohlene Stufen:

1. Semi-implicit Euler fuer lokale Realzeit-Prototypen.
2. Runge-Kutta oder Velocity Verlet fuer laengere Vorhersagen.
3. Analytische Keplerfortschreibung fuer Coast-Segmente.
4. Segmentierte Integration fuer Burns und SOI-Wechsel.

## 11. Autopilot- und Predictor-Konsistenz

Autopilot, Trajectory Preview und Timewarp duerfen nicht drei verschiedene Physikmodelle verwenden.

Pflicht:

- Ein gemeinsamer `TrajectoryPredictor` berechnet Prognosen.
- Der Autopilot nutzt den Predictor fuer Planung.
- Timewarp nutzt denselben Predictor fuer Segmentvalidierung.
- Die Map nutzt dieselben Routenpunkte fuer Anzeige.
- Intercept Solver nutzt dieselbe Positionsvorhersage.

Sonst entstehen Bugs, bei denen die Route im HUD korrekt aussieht, der Autopilot aber woanders hinfliegt.

## 12. Patched Conics

Patched Conics sind das bevorzugte Modell fuer interplanetare Flugplanung.

Ablauf:

1. Start in aktuellem SOI.
2. Burn in Transferbahn.
3. Coast im Parent-Frame, meist sternzentrisch.
4. Eintritt in Ziel-SOI.
5. Korrektur oder Bremsburn.
6. Zielorbit, Rendezvous oder Approach.

Das ist deutlich einfacher als echtes N-Body, aber fuer gameplaynahe Raumfahrt plausibel.

## 13. N-Body nur als Spezialfall

Vollstaendiges N-Body ist teuer, schwieriger deterministisch zu halten und fuer Spieler oft schwer planbar.

Darum gilt:

- Kein allgemeines N-Body als Standardmodell.
- N-Body nur fuer Spezialereignisse oder spaetere Simulationsmodi.
- Planeten und Monde bleiben analytisch stabil.
- Schiffe nutzen dominante Gravitation plus explizite Stoerungen nur bei Bedarf.

Moegliche spaetere Spezialfaelle:

- enge Mehrmondresonanzen testen,
- Asteroiden in instabilen Resonanzen,
- wissenschaftlicher Simulationsmodus,
- Scripted Events.

## 14. Kollisions- und Gefahrenerkennung

Bei grossen Distanzen darf nicht nur der aktuelle Frame geprueft werden. Der Predictor muss Bahnsegmente gegen Gefahren pruefen.

Zu pruefen:

- Planetenkollisionsradius plus Atmosphaere.
- Mond- und Asteroidenradius plus Sicherheitszone.
- Basen- und Stationen-Safety-Bubbles.
- aktive Spielernaehe.
- Intercept-Fenster.
- dichte Asteroidenfeldzonen.

Fuer Timewarp ist Segmentpruefung Pflicht, weil Objekte sonst durch Gefahren tunneln koennen.

## 15. Numerische Genauigkeit

Regeln:

- Absolute Positionen in double precision.
- Zeiten in double precision Sekunden oder fixem Tick-Format.
- Unity-Transforms nur lokale Darstellung.
- Kein Speichern wichtiger Physikzustaende nur in `float`.
- Debug-UI muss absolute und lokale Werte getrennt anzeigen.

## 16. Determinismus

Singleplayer und Multiplayer sollen denselben Kern verwenden. Deshalb muss die Simulation so deterministisch wie praktikabel sein.

Empfehlungen:

- Feste Simulationsschritte fuer Vorhersage.
- Keine zufaelligen Korrekturen ohne Seed.
- Alle Warp- und Autopilot-Segmente mit Startzeit und Endzeit speichern.
- Kritische Ergebnisse durch Validierung pruefen, nicht nur Vertrauen in Clientdaten.

## 17. Erster Prototyp

Minimaler Scope:

1. Aurelia, Hestia und Hestia-Monde analytisch bewegen.
2. Ein Schiff im Hestia-Frame mit lokaler Gravitation fliegen lassen.
3. Ein einfacher Coast-Predictor fuer Orbitvorschau.
4. Debug-Linie fuer vorhergesagte Flugbahn.
5. SOI-Event nur prototypisch zwischen Stern und Hestia.
6. Safety-Pruefung gegen Planetenkollisionsradius.
7. Timewarp nur auf Coast-Segmenten, die vom Predictor als sicher markiert wurden.

## 18. Tests

Fruehe Tests:

- Kreisorbit bleibt fuer mehrere Umlaeufe stabil genug.
- Floating-Origin-Wechsel aendert Orbit nicht.
- Timewarp-Coast endet auf derselben Bahn wie Realzeitintegration innerhalb akzeptabler Toleranz.
- SOI-Wechsel erhaelt Energie/Velocity plausibel.
- Autopilot-Route und Map-Route verwenden identische Punkte.
- Kollision mit Planet wird vor Warp-Start erkannt.

## 19. Offene Fragen

- Welche Integrationsmethode verwenden wir fuer den ersten spielbaren Orbit-Prototyp?
- Wie genau muss Orbitvorhersage sein, bevor Autopilot freigeschaltet wird?
- Wann fuehren wir Patched Conics ein?
- Wie gross duerfen Toleranzen zwischen Prognose und echter Simulation sein?
- Wollen wir Transferfenster sichtbar machen oder zunaechst nur direkte Routen anbieten?

## 20. Kurzfazit

Das Orbitalmodell soll bewusst stufenweise wachsen. Himmelskoerper bewegen sich zunaechst analytisch auf stabilen Keplerbahnen. Schiffe und Drohnen werden in echten physikalischen Zustaenden gefuehrt, aber meist in einem dominanten Gravitationsframe. Autopilot, Timewarp, Intercepts und UI muessen denselben Predictor nutzen. So entsteht ein System, das glaubwuerdig wirkt, ohne an vollstaendigem N-Body zu scheitern.
