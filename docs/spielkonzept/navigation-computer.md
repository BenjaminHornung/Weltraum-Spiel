# Spielkonzept: Navigation Computer

Stand: 2026-05-28  
Status: Konzeptbasis fuer Weltraum-Spiel, noch keine finale Implementierung  
Bezug: Dieses Dokument beschreibt den Navigationscomputer als Bruecke zwischen Orbital Simulation, Autopilot, Timewarp, Drohnenmissionen und Spieler-UI.

## 1. Ziel

Der Navigation Computer ist das System, das aus einem Ziel, dem aktuellen Schiffszustand und den bekannten Himmelskoerperdaten eine sinnvolle Route erzeugt. Er soll Raumfahrt spielbar machen, ohne die Physik zu ignorieren.

Leitsatz:

> **Der Navigation Computer plant, erklaert und ueberwacht Flugwege. Der Autopilot fuehrt sie aus. Timewarp beschleunigt nur validierte Segmente.**

Der Spieler soll nicht gezwungen werden, jedes Orbitalmanoever manuell zu berechnen. Trotzdem sollen Delta-v, Treibstoff, Bremswege, Gravitation, Safety-Zonen und Intercepts echte Bedeutung behalten.

## 2. Nicht-Ziele

Diese Datei definiert nicht:

- die konkreten Planeten des Startsystems,
- das vollstaendige UI-Layout,
- die finale Implementierung von Patched Conics,
- Schiffsstats,
- Waffenlogik,
- Drohnenwirtschaft.

Sie definiert die Funktionen und Datenfluesse des Navigationscomputers.

## 3. Hauptaufgaben

Der Navigation Computer hat sechs Hauptaufgaben:

1. Zielauswahl verstehen.
2. Flugroute planen.
3. Route bewerten.
4. Route visualisieren.
5. Autopilot und Timewarp freigeben oder blockieren.
6. Route waehrend des Fluges ueberwachen und neu planen.

## 4. Zieltypen

Moegliche Ziele:

| Zieltyp | Beispiel | Besonderheit |
| --- | --- | --- |
| Himmelskoerper | Hestia, Luma, Tharos | Ziel-SOI, Orbit oder Surface-Zone |
| Orbit | niedriger Hestia-Orbit | Hoehe, Inklination, Richtung |
| Station | Eber Relay | Docking- und Safety-Zone |
| Asteroid | Eber, Kallisto | kleine Gravitation, Mining-Zone |
| Schiff | eigenes Cargo-Schiff | bewegliches Rendezvous-Ziel |
| Drohne | Mining Drone A-17 | bewegliches Rendezvous oder Recall |
| Kartenpunkt | frei gesetzter Waypoint | keine automatische Dockinglogik |
| Mission | Mining-Auftrag, Scout-Route | Ziel wird aus Missionsdaten abgeleitet |

Der Computer muss erkennen, ob ein Ziel statisch, orbital, beweglich oder nur ein symbolischer Missionseintrag ist.

## 5. Eingabedaten

Eine Routenplanung braucht mindestens:

```text
currentAbsoluteState
currentReferenceFrame
shipMassCurrent
fuelMass
thrustCapabilities
rcsCapabilities
targetDescriptor
knownCelestialBodies
knownSafetyBubbles
knownContacts
missionConstraints
```

Zusaetzlich sinnvoll:

- maximale gewuenschte Reisezeit,
- minimaler Fuel-Reservewert,
- erlaubter Risiko-Level,
- ob Timewarp gewuenscht ist,
- ob Docking, Orbit, Flyby oder Landung das Ziel ist,
- ob der Spieler manuell oder per Autopilot fliegen will.

## 6. Routenmodi

Der Navigation Computer soll mehrere Modi kennen.

| Modus | Beschreibung | Nutzung |
| --- | --- | --- |
| Direct Assist | einfache Linie mit Bremswarnung | kurzer lokaler Flug |
| Local Rendezvous | Ziel im selben lokalen Frame | Station, Drohne, Schiff |
| Orbit Transfer | Wechsel zwischen Orbits um denselben Koerper | Hestia-Orbits, Mondorbits |
| Interplanetary Transfer | Flug zwischen Planeten/SOIs | Hestia zu Tharos, Hestia zum Guertel |
| Flyby | Vorbeiflug statt Rendezvous | Scans, Gravity Assist spaeter |
| Docking Approach | finaler sicherer Anflug | Station, Hangar, grosses Schiff |
| Surface Approach | Eintritt/Landung | spaeter fuer Planetenoberflaechen |
| Emergency Return | schnellste sichere Rueckkehr | niedriger Treibstoff, Schaden |

Fuer den ersten Prototyp reichen Direct Assist, Local Rendezvous und ein stark vereinfachter Interplanetary Transfer.

## 7. AutopilotPlan

Der Navigation Computer erzeugt einen `AutopilotPlan`.

```text
AutopilotPlan
{
    string planId;
    string sourceObjectId;
    TargetDescriptor target;
    PlanMode mode;
    PlanSegment[] segments;
    double totalDeltaV;
    double estimatedFuelUse;
    double estimatedRealTimeSeconds;
    double estimatedMissionTimeSeconds;
    RiskSummary risk;
    ValidationState validation;
}
```

Der Plan ist ein Datenobjekt. Er ist nicht identisch mit dem Autopilot-Controller. Dadurch kann er angezeigt, gespeichert, abgelehnt, ueberarbeitet oder an eine Drohne uebergeben werden.

## 8. Plansegmente

Ein Plan besteht aus Segmenten.

```text
PlanSegment
{
    SegmentType type;
    double startTime;
    double endTime;
    AbsoluteState expectedStartState;
    AbsoluteState expectedEndState;
    double deltaV;
    double fuelUse;
    bool warpEligible;
    string requiredReferenceFrame;
    string[] safetyChecks;
}
```

Segmenttypen:

```text
Align
Burn
Coast
Correction
SOITransition
Brake
Approach
Dock
Hold
Abort
```

Nur bestimmte Segmente duerfen Timewarp nutzen. In der ersten Version: vor allem `Coast` und eventuell lange stabile `Correction`-Wartephasen.

## 9. Routenbewertung

Nicht jede Route ist gut. Der Navigation Computer soll Alternativen bewerten.

Bewertungskriterien:

- Delta-v.
- Treibstoffverbrauch.
- verbleibende Fuel-Reserve.
- Reisezeit.
- Anzahl kritischer Burns.
- Sicherheitsabstand zu Koerpern und Basen.
- Intercept-Risiko.
- Asteroidenfeld-Dichte.
- Kommunikationsreichweite fuer Drohnen.
- Schwierigkeitsgrad fuer manuelles Fliegen.

Moegliche Labels:

```text
Excellent
Safe
FuelTight
Risky
Unsafe
Impossible
```

## 10. Validierung

Ein Plan ist nur nutzbar, wenn er validiert wurde.

Mindestchecks:

- Ziel existiert.
- Aktueller Zustand ist bekannt.
- Referenzframe ist gueltig.
- Schiff hat genug Treibstoff fuer Burn und Bremsung.
- Mindest-Fuel-Reserve bleibt erhalten.
- Route kollidiert nicht mit Planeten, Monden, Stationen oder Safety Bubbles.
- Timewarp-Segmente schneiden keine aktive Interaktionszone.
- Autopilot kann noetige Manoever physikalisch ausfuehren.
- Bei Drohnen: Missionsreichweite und Kommunikations-/Risikoregeln sind erfuellt.

## 11. Delta-v und Fuel Margin

Der Spieler soll verstehen, ob ein Plan knapp oder sicher ist.

Anzeigen:

- benoetigtes Delta-v,
- verfuegbares Delta-v,
- Fuel-Verbrauch,
- Fuel-Reserve nach Ankunft,
- groesster Einzelburn,
- Bremsreserve,
- Notfallreserve.

Regel:

> **Kein Autopilot- oder Warp-Plan darf freigegeben werden, wenn die Bremsreserve fehlt.**

Das verhindert, dass Schiffe nur schnell zum Ziel fliegen und dort nicht mehr abbremsen koennen.

## 12. Timewarp-Freigabe

Der Navigation Computer markiert Segmente als `warpEligible`, aber die Warp Authority entscheidet final.

Ein Segment ist nur warpfaehig, wenn:

- es vorhergesagt stabil ist,
- keine manuelle Eingabe noetig ist,
- keine Docking-/Lande-/Kampfnaehe besteht,
- keine aktive Safety Bubble geschnitten wird,
- keine geplante Interaktion ausgelassen wird,
- der Endzustand sauber in Realzeit ueberfuehrbar ist.

Der Navigation Computer liefert also die fachliche Grundlage, Timewarp selbst liegt beim Warp-System.

## 13. Manuelle Eingriffe

Der Spieler darf Plaene beeinflussen.

Moegliche Eingriffe:

- Ziel wechseln.
- Route neu berechnen.
- Fuel-Reserve erhoehen.
- Risiko-Level senken.
- Timewarp fuer Route verbieten.
- Autopilot nur bis zum naechsten Segment ausfuehren.
- Burn manuell fliegen, aber vom Computer fuehren lassen.
- Abort und Return planen.

Wenn der Spieler manuell stark abweicht, wird der Plan `stale` und muss neu berechnet werden.

## 14. Drohnenintegration

Drohnen nutzen denselben Navigation Computer, aber meist ueber Missionsbefehle.

Beispiel:

```text
Mission: Mine at Eber Belt
Target: asteroid.eber
Required: arrive, survey, mine, return or dock
Risk: avoid player conflict zones
Warp: allowed for coast segments
```

Der Computer erzeugt daraus einen oder mehrere Plaene:

1. Transfer zum Ziel.
2. Approach/Orbit um Ziel.
3. Mining-Position.
4. Rueckflug oder Weiterflug.

## 15. Intercept-Unterstuetzung

Der Navigation Computer muss Intercepts nicht komplett selbst loesen, aber er muss Daten liefern:

- vorhergesagte Route,
- ETA an Punkten,
- Geschwindigkeit entlang der Route,
- Safety-Bubbles,
- Sensor-/Kontaktstatus,
- moegliche Exit-Punkte.

Der `InterceptSolver` kann diese Daten nutzen, um faire Begegnungen und Warp-Abbrueche zu erzeugen.

## 16. UI-Ausgaben

Der Navigation Computer liefert strukturierte UI-Daten.

Anzeigen:

- aktuelles Ziel,
- Distanz,
- relative Geschwindigkeit,
- naechstes Manoever,
- Burn-Dauer,
- ETA in Realzeit,
- Missionszeit,
- Delta-v gebraucht/verfuegbar,
- Fuel-Margin,
- Planstatus,
- Warnungen.

Warnungen:

```text
NO_TARGET
NO_VALID_ROUTE
FUEL_INSUFFICIENT
BRAKE_RESERVE_MISSING
COLLISION_RISK
SAFETY_BUBBLE_AHEAD
INTERCEPT_WINDOW
PLAN_STALE
WARP_NOT_ALLOWED
```

## 17. Zustandsmaschine

```text
Idle
  -> TargetSelected
  -> Planning
  -> PlanReady
  -> PlanRejected
  -> AwaitingAutopilot
  -> Executing
  -> Monitoring
  -> Replanning
  -> Complete
  -> Aborted
```

Wichtig:

- `Planning` darf mehrere Kandidaten erzeugen.
- `PlanReady` bedeutet nicht automatisch Autopilot.
- `Executing` kann ohne Timewarp stattfinden.
- `Monitoring` prueft staendig Abweichungen.
- `Replanning` muss sicher und schnell moeglich sein.

## 18. Fehlerfaelle

Typische Fehler:

- Ziel ist nicht mehr erreichbar.
- Ziel bewegt sich unerwartet.
- Schiff hat Treibstoff verloren.
- Masse hat sich durch Cargo geaendert.
- Drohne wurde beschaedigt.
- Safety Bubble taucht auf.
- PvE- oder Spieler-Intercept entsteht.
- Planet/SOI-Wechsel war anders als prognostiziert.

Der Computer soll nicht einfach abschalten, sondern eine konkrete Handlung anbieten:

- `Hold position`
- `Recalculate`
- `Abort to safe orbit`
- `Return to origin`
- `Exit warp`
- `Manual control required`

## 19. Erste Prototyp-Stufe

Minimaler Scope:

1. Zielauswahl fuer Hestia-Orbit, Luma und einen Asteroiden.
2. Einfache Direct-/Coast-Route mit Distanz, ETA und Bremswarnung.
3. Plansegmente als Datenmodell.
4. Fuel- und Delta-v-Schaetzung vereinfacht.
5. Route Preview als Debug-Linie.
6. Autopilot akzeptiert nur `PlanReady`.
7. Timewarp akzeptiert nur `warpEligible` Coast-Segmente.
8. Warnungen im Debug-HUD.

## 20. Tests

Fruehe Tests:

- Ohne Ziel kein Plan.
- Ziel mit unzureichendem Treibstoff wird abgelehnt.
- Bremsreserve fehlt, Plan wird nicht fuer Autopilot/Warp freigegeben.
- Manuelle Abweichung setzt Plan auf `stale`.
- Timewarp wird nur fuer erlaubte Segmente freigegeben.
- Route Preview und Autopilot nutzen dieselben Punkte.

## 21. Offene Fragen

- Wie viel orbitales Detail soll der Spieler sehen?
- Soll der Computer automatisch Transferfenster vorschlagen?
- Wie streng sind Fuel-Reserve-Regeln fuer Drohnen?
- Darf ein Spieler riskante Plaene bewusst akzeptieren?
- Welche Warnungen sind im normalen HUD sichtbar und welche nur im Debug?

## 22. Kurzfazit

Der Navigation Computer ist das zentrale Planungssystem fuer Raumfluege. Er erzeugt aus echten Koerperdaten, aktuellem Schiffszustand und Zielvorgaben einen validierten AutopilotPlan. Er bewertet Delta-v, Treibstoff, Risiken und Timewarp-Faehigkeit, ohne selbst die Physikregeln zu brechen. Autopilot, Drohnen, Timewarp, Intercepts und UI muessen auf diesen Plan zugreifen, damit das Spiel trotz echter Distanzen bedienbar bleibt.
