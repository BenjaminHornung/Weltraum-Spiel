# Spielkonzept: Player Map and HUD

Stand: 2026-05-28  
Status: Konzeptbasis fuer Weltraum-Spiel, noch keine finale Implementierung  
Bezug: Dieses Dokument beschreibt, wie Systemkarte, Orbitkarte, Navigation Computer, Autopilot, Drohnenstatus, Timewarp und Encounters fuer den Spieler sichtbar und bedienbar werden.

## 1. Ziel

Die Karte und das HUD sollen echte Raumfahrt lesbar machen. Der Spieler soll verstehen, wo er ist, wohin er fliegt, warum ein Plan funktioniert oder nicht funktioniert, wann ein Burn kommt, ob Timewarp erlaubt ist und was Drohnen gerade tun.

Leitsatz:

> **Die UI zeigt nicht nur Zahlen. Sie erklaert den Zustand des Fluges und macht Risiken rechtzeitig sichtbar.**

Dieses Dokument ist keine finale UI-Grafik. Es definiert Informationsarchitektur, Modi, Warnungen und Bedienlogik.

## 2. Nicht-Ziele

Diese Datei definiert nicht:

- finale Screenlayouts,
- konkrete Farben,
- Icon-Assets,
- Texturen,
- Controller-Keybinds im Detail,
- komplette UX fuer jedes Schiffssystem.

Sie beschreibt, welche Informationen wann gebraucht werden.

## 3. UI-Ebenen

Das Spiel braucht mehrere UI-Ebenen.

| Ebene | Zweck | Beispiel |
| --- | --- | --- |
| Cockpit HUD | unmittelbares Fliegen | Geschwindigkeit, Ziel, Marker, Warnungen |
| Navigation Panel | Route planen und pruefen | Delta-v, ETA, Segmente, Fuel |
| System Map | Systemweite Orientierung | Planeten, Orbits, Drohnen, Routen |
| Local Map | Umgebung um Schiff/Station | Docking, Kontakte, Asteroiden |
| Drone Console | Remote-Missionen | Mission, Status, ETA, Risiken |
| Alert Feed | Ereignisse | Intercept, Warp Exit, Fuel Low |
| Debug Overlay | Entwicklung | Frames, absolute Position, Predictor-Daten |

Nicht alles muss gleichzeitig sichtbar sein. Die UI muss priorisieren.

## 4. Cockpit HUD

Das Cockpit HUD ist fuer unmittelbare Steuerung.

Pflichtinformationen:

- aktuelles Ziel.
- Distanz zum Ziel.
- relative Geschwindigkeit.
- aktuelle Geschwindigkeit im Frame.
- prograde/retrograde Marker.
- Zielmarker.
- Fuel.
- RCS/SAS/Autopilot-Status.
- naechster Autopilot-Schritt.
- Warnungen.

Beispielanzeige:

```text
TARGET: Luma Transfer Node
DIST: 42,300 km
REL V: 184 m/s
NEXT: Coast, correction in 00:12:40
FUEL: 72%
AUTOPILOT: Monitoring
WARP: Available 50x
```

## 5. Navigation Panel

Das Navigation Panel ist die Arbeitsflaeche fuer Routenplanung.

Anzeigen:

- Zieltyp und Zielname.
- Planmodus.
- Segmentliste.
- benoetigtes Delta-v.
- verfuegbares Delta-v.
- Fuel-Verbrauch.
- Fuel-Reserve.
- ETA in Realzeit.
- Missionszeit.
- Warp-faehige Segmente.
- Risiken.
- Planstatus.

Moegliche Aktionen:

```text
Select Target
Calculate Route
Accept Plan
Start Autopilot
Enable Warp
Abort Plan
Recalculate
Set Fuel Reserve
Set Risk Policy
```

Wichtig: `Accept Plan` ist nicht automatisch `Start Autopilot`. Der Spieler soll verstehen, ob er nur plant oder das Schiff wirklich ausfuehren laesst.

## 6. System Map

Die System Map zeigt das Aurelia-System auf abstrahierter Skala.

Sie zeigt:

- Aurelia.
- Planetenorbits.
- Planetenpositionen.
- Mondsysteme bei Auswahl.
- Asteroidenguertel-Zonen.
- eigene Schiffe und Drohnen.
- bekannte Stationen.
- geplante Routen.
- Intercept-/Gefahrenbereiche.
- Safety Bubbles als abstrahierte Zonen.

Regel:

> **Die Systemkarte darf visuell skalieren, muss aber echte Werte klar als Daten anzeigen.**

Beispiel Tooltip:

```text
Hestia
Orbit: 0.60 AU
Radius: 8,282 km
Mass: 2.03 M_E
Surface g: 1.20 g
Atmosphere: 1.45 bar
Moons: 4
```

## 7. Local Map

Die Local Map zeigt die unmittelbare Umgebung.

Nutzung:

- Docking.
- Stationen.
- Asteroiden.
- lokale Kontakte.
- Minenfelder/Gefahren.
- Approach Gates.
- Intercept Zone.
- lokale Routenpunkte.

Im Gegensatz zur System Map arbeitet die Local Map naeher an echter lokaler Geometrie. Trotzdem koennen Icons und Marker vergroessert sein.

## 8. Route Preview

Routen muessen visuell nachvollziehbar sein.

Elemente:

- aktuelle Position.
- geplante Bahnlinie.
- Burn-Marker.
- Coast-Segmente.
- Correction-Marker.
- Brake-Marker.
- SOI-Wechsel.
- Warp-faehige Segmente.
- Safety-Exit-Punkte.
- erwarteter Ankunftspunkt.

Segmentfarben und Symbole werden spaeter festgelegt. Wichtig ist die inhaltliche Trennung:

```text
Burn != Coast != Warp != Brake != Docking
```

## 9. Timewarp UI

Timewarp braucht klare Rueckmeldung.

Anzeigen:

- aktueller Warp-Faktor.
- warum Warp erlaubt ist.
- warum Warp nicht erlaubt ist.
- naechster geplanter Warp-Exit.
- naechste Validierung.
- ob Warp objektgebunden ist.
- ob Spieler, Drohne oder anderes Schiff betroffen ist.

Beispiel:

```text
WARP 100x
Object: Drone M-04
Segment: Interplanetary Coast
Exit In: 03:12 real time
Reason: Mid-course correction
Safety: Clear corridor
```

Warnungen:

```text
WARP DENIED: NO VALID PLAN
WARP DENIED: BRAKE RESERVE MISSING
WARP REDUCED: TARGET SOI APPROACH
WARP EXIT: PLAYER PROXIMITY
WARP EXIT: POSSIBLE INTERCEPT
WARP EXIT: STATION SAFETY
```

## 10. Drohnenkonsole

Drohnen brauchen eine eigene Uebersicht.

Listenansicht:

- Name/ID.
- Rolle.
- Mission.
- Ziel.
- Status.
- Realzeit-ETA.
- Warp-Faktor.
- Fuel.
- Cargo.
- Schaden.
- Risiko.

Detailansicht:

- Missionsschritte.
- aktueller AutopilotPlan.
- Route Preview.
- Kontaktstatus.
- Risk Policy.
- Return Policy.
- letzte Events.
- manuelle Aktionen.

Aktionen:

```text
Recall
Hold Position
Recalculate Route
Abort Mission
Allow Warp
Disallow Warp
Set Risk Policy
Take Manual Control
```

## 11. Alert Feed

Der Alert Feed informiert ueber Ereignisse, ohne den Spieler mit permanenten Zahlen zu ueberladen.

Beispiele:

```text
Drone M-04: Mission complete
Drone S-01: Unknown contact detected
Ship: Fuel reserve below planned margin
Autopilot: Plan stale, recalculation required
Warp exited: Station safety zone
Intercept warning: possible contact in 90 seconds
```

Alert Severity:

```text
Info
Notice
Warning
Critical
ActionRequired
```

Regel:

- Info darf verschwinden.
- Warning muss sichtbar bleiben, bis Zustand geklaert ist.
- ActionRequired braucht eine klare Spieleraktion.

## 12. Warnchips

Kurze Warnchips koennen im HUD auftauchen.

Moegliche Chips:

```text
NO TARGET
PLAN STALE
NO VALID ROUTE
FUEL LOW
BRAKE RESERVE MISSING
COLLISION RISK
SAFETY BUBBLE
INTERCEPT WINDOW
WARP BLOCKED
WARP ACTIVE
DRONE NEEDS ATTENTION
CONTACT LOST
```

Die Warnchips sollen nicht nur Debug sein. Sie sind fuer Spielbarkeit wichtig.

## 13. Zielauswahl

Zielauswahl muss ueber mehrere Wege funktionieren.

Quellen:

- Objekt im HUD markieren.
- Objekt in System Map anklicken.
- Drohne/Schiff aus Liste waehlen.
- Missionseintrag auswaehlen.
- Station aus Kontaktliste waehlen.
- freien Waypoint setzen.

Nach Zielauswahl erzeugt die UI keinen Flug direkt. Sie uebergibt an Navigation Computer:

```text
TargetDescriptor
```

Danach wird Route berechnet oder die UI zeigt, warum keine Route moeglich ist.

## 14. Informationsdichte

Das Spiel darf nicht alles immer anzeigen.

Vorgeschlagene Modi:

| Modus | Sichtbarkeit |
| --- | --- |
| Basic | Ziel, Distanz, Speed, Fuel, wichtige Warnungen |
| Navigation | Route, Segmente, Delta-v, ETA, Warp |
| Drone Ops | Drohnenliste, Missionen, Remote Alerts |
| Combat/Encounter | Kontakte, Intercept, Waffen-/Fluchthinweise |
| Debug | Frames, absolute Koordinaten, Predictor, Safety Checks |

Der Spieler soll zwischen Modi wechseln koennen, ohne wichtige Warnungen zu verlieren.

## 15. Realwerte vs visuelle Werte

Da Systemkarte und lokale Szene skaliert werden koennen, muss die UI klar trennen.

Beispiele:

```text
Real Distance: 89,700,000 km
Map Scale Distance: 320 map units
Local Frame: HestiaCentered
Visual Radius Scale: 40x in map
```

Diese Anzeige ist vor allem Debug/Advanced. Aber intern muss die Trennung immer existieren.

## 16. Singleplayer und Multiplayer

### Singleplayer

- UI liest von lokaler Simulationsautoritaet.
- Drohnenereignisse werden lokal erzeugt.
- Karte kann pausierbare Detailansichten erlauben, falls spaeter gewuenscht.
- Objektgebundener Warp bleibt Basis.

### Multiplayer

- UI zeigt nur server-/hostbestaetigte Zustaende.
- Warp- und Encounter-Warnungen muessen autoritativ bestaetigt sein.
- Spieler duerfen keine versteckten fremden Objekte sehen, die Sensorik nicht entdeckt hat.
- Karteninformationen koennen unvollstaendig oder veraltet sein.

## 17. Barriere fuer neue Spieler

Echte Raumfahrt kann ueberfordern. Die UI muss deshalb erklaerend sein.

Hilfen:

- einfache Labels statt nur Fachbegriffe.
- Tooltips fuer Delta-v, SOI, Warp, Brake Reserve.
- klare Gruende fuer Ablehnung.
- empfohlene Aktion anzeigen.
- Debugdaten standardmaessig ausblenden.

Beispiel:

```text
Route blocked: Brake reserve missing.
Your ship can reach the target, but cannot slow down safely.
Suggested action: refuel or choose a closer target.
```

## 18. Erste Prototyp-Stufe

Minimaler Scope:

1. Basic HUD zeigt Ziel, Distanz, relative Geschwindigkeit, Fuel, Autopilotstatus.
2. Navigation Panel zeigt einfachen Plan mit Segmenten.
3. System Map zeigt Aurelia, Hestia, einen Mond, einen Asteroiden und eine Route.
4. Route Preview als Linie mit Burn-/Coast-Marker.
5. Timewarp UI zeigt Faktor, Objekt, Segment und Exit-Grund.
6. Drohnenkonsole zeigt eine aktive Drohne mit Mission und ETA.
7. Alert Feed zeigt Warp Exit, Mission Complete und Intercept Warning.
8. Debug Overlay zeigt Frame, AbsoluteState und Floating Origin.

## 19. Tests

Fruehe Tests:

- Zielauswahl erzeugt TargetDescriptor.
- Route Preview und AutopilotPlan haben gleiche Segmente.
- Warp-Status zeigt objektgebundenes Ziel korrekt an.
- Drohne im Warp beschleunigt nicht die Spielerumgebung.
- Alert Feed zeigt Safety Bubble Exit.
- Basic HUD bleibt lesbar, auch wenn Debugdaten aktiv sind.
- UI zeigt echten Wert und Map-Skala nicht als denselben Wert.

## 20. Offene Fragen

- Wie stark soll die System Map stilisiert sein?
- Gibt es eine 3D-Orbitkarte oder zunaechst eine 2D-Projektion?
- Welche Warnungen sind immer sichtbar?
- Wie viele Drohnen passen sinnvoll in die Drohnenliste?
- Soll der Spieler Routen manuell mit Maneuver Nodes bearbeiten koennen?
- Wie stark sollen Tooltips und Tutorials integriert werden?

## 21. Kurzfazit

Player Map und HUD machen die komplexen Systeme des Spiels bedienbar. Die UI muss echte Werte, skalierte Darstellung, AutopilotPlaene, Timewarp-Zustaende, Drohnenmissionen und Encounter-Warnungen klar trennen und verstaendlich anzeigen. Sie ist kein dekoratives Overlay, sondern die Schnittstelle, mit der Spieler realistische Raumfahrt kontrollieren koennen.
