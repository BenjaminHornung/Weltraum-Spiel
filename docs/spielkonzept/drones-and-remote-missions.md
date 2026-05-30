# Spielkonzept: Drones and Remote Missions

Stand: 2026-05-28  
Status: Konzeptbasis fuer Weltraum-Spiel, noch keine finale Implementierung  
Bezug: Dieses Dokument beschreibt Drohnen und autonome Schiffe als eigene Gameplay-Schicht. Es baut auf Navigation Computer, Autopilot-Timewarp, Orbital Simulation und Persistence auf.

## 1. Ziel

Drohnen sollen im Spiel echte autonome Akteure sein, nicht nur kosmetische Begleiter. Ein Spieler kann auf einem Planeten, in einer Station oder in einem Schiff sein, waehrend Drohnen an anderen Orten fliegen, scannen, abbauen, transportieren, patrouillieren oder zurueckkehren.

Leitsatz:

> **Drohnen sind fernsteuerbare oder autonome Schiffe mit eigenen Missionsplaenen, eigenem Zustand, eigener Navigation und denselben physikalischen Regeln wie Spielerschiffe.**

Das System muss im Singleplayer funktionieren und spaeter in Multiplayer/Koop uebertragbar bleiben.

## 2. Nicht-Ziele

Diese Datei definiert nicht:

- die Rohstoffwirtschaft im Detail,
- konkrete Drohnenmodelle,
- finale KI-Kampfentscheidungen,
- komplette Basisautomatisierung,
- konkrete UI-Layouts.

Sie definiert, welche Missions- und Zustandslogik Drohnen brauchen.

## 3. Drohnenrollen

Startrollen:

| Rolle | Zweck | Typische Missionen |
| --- | --- | --- |
| Scout Drone | Erkundung und Kartierung | Scan, Flyby, Survey, Beacon setzen |
| Mining Drone | Rohstoffabbau | Asteroid anfliegen, abbauen, Cargo zurueckbringen |
| Cargo Drone | Transport | Material zwischen Basis, Station und Schiff bewegen |
| Relay Drone | Kommunikation/Navigation | Relaispunkt halten, Signalreichweite erweitern |
| Repair Drone | Wartung | Schiff/Station reparieren, Treibstoff bringen |
| Defense Drone | Schutz | Patrouille, Abfangen, Eskorte |
| Construction Drone | Aufbau | spaeter Station/Basis-Module bauen |

Nicht jede Rolle muss anfangs implementiert werden. Fuer den Prototyp reichen Scout, Mining und Cargo als Zielbild.

## 4. Drohne als Schiff

Eine Drohne nutzt dieselbe physikalische Basis wie ein Schiff.

Sie besitzt:

```text
DroneState
{
    string droneId;
    string ownerId;
    AbsoluteState absoluteState;
    string currentReferenceFrame;
    double currentMassKg;
    double fuelMassKg;
    CargoState cargo;
    DamageState damage;
    PowerState power;
    AutopilotPlan currentPlan;
    RemoteMission currentMission;
    WarpState warpState;
}
```

Wichtig:

- Drohnen verwenden echte Position und Geschwindigkeit.
- Drohnen nutzen den Navigation Computer fuer Routen.
- Drohnen duerfen Timewarp nur fuer validierte Segmente nutzen.
- Drohnen koennen interceptet werden.
- Drohnen koennen Schaden nehmen und Missionen abbrechen.

## 5. RemoteMission

Eine Drohne fuehrt nicht nur eine Route aus, sondern eine Mission.

```text
RemoteMission
{
    string missionId;
    MissionType type;
    string ownerId;
    TargetDescriptor primaryTarget;
    MissionStep[] steps;
    MissionPriority priority;
    MissionRiskPolicy riskPolicy;
    MissionReturnPolicy returnPolicy;
    MissionStatus status;
}
```

Missiontypen:

```text
Scout
Survey
Mine
Transport
Patrol
Escort
Repair
Refuel
ReturnHome
HoldPosition
Dock
```

## 6. Missionsschritte

Eine Mission besteht aus Schritten.

```text
MissionStep
{
    StepType type;
    TargetDescriptor target;
    AutopilotPlan plan;
    StepStatus status;
    double progress;
    string[] requiredCapabilities;
}
```

Beispiele:

### Mining-Mission

```text
1. Undock
2. NavigateTo asteroid.eber
3. SurveyResourceNode
4. MineUntil cargoFull or timeLimit
5. NavigateTo station.eber_relay
6. Dock
7. UnloadCargo
```

### Scout-Mission

```text
1. NavigateTo waypoint
2. ScanArea
3. TransmitMapData
4. ContinueTo next waypoint
5. ReturnIf fuelReserveLow
```

## 7. Autonomiegrade

Drohnen sollen unterschiedliche Autonomiegrade erlauben.

| Grad | Beschreibung |
| --- | --- |
| Manual Remote | Spieler steuert direkt, solange Verbindung/Ansicht aktiv ist. |
| Assisted | Spieler gibt Ziel, Drohne nutzt Navigation Computer. |
| Mission Autonomy | Spieler gibt Mission, Drohne plant Schritte selbst. |
| Fleet Autonomy | mehrere Drohnen koordinieren Ziele, Relais und Cargo. |

Fuer den Anfang reicht `Assisted` und eine einfache `Mission Autonomy`.

## 8. Spielerposition und Drohnenaktivitaet

Der Spieler kann gleichzeitig an einem anderen Ort sein.

Beispiele:

- Spieler steht auf Hestia, Drohne fliegt zum Asteroidenguertel.
- Spieler sitzt in einem Schiff, Cargo-Drohne dockt an einer Station an.
- Spieler ist in einem Hangar, Scout-Drohne sendet neue Kartendaten.
- Spieler kontrolliert ein Schiff, Defense-Drohne patrouilliert im lokalen Raum.

Regel:

> **Die Spielerumgebung laeuft in normaler Zeit weiter. Drohnen erhalten nur fuer ihre eigene Missionssimulation objektgebundenen Warp.**

## 9. Drohnen-Timewarp

Drohnen sind ein Hauptanwendungsfall fuer objektgebundenen Timewarp.

Eine Drohne darf warpen, wenn:

- sie einen validierten AutopilotPlan hat,
- ihr aktueller Missionsschritt warpfaehig ist,
- keine Safety Bubble geschnitten wird,
- kein Intercept-Fenster aktiv ist,
- genuegend Fuel- und Bremsreserve vorhanden ist,
- der Zustand beim Exit sauber rekonstruiert werden kann.

Der Besitzer sieht nicht die Welt schneller. Er sieht nur Statusdaten, ETA und Ereignisse.

## 10. Kommunikation und Kontaktverlust

Drohnen sollen nicht allwissend sein. Kommunikation kann spaeter eine Rolle spielen.

Startmodell:

- Im Prototyp: sofortige Statuskommunikation im ganzen Startsystem.
- Spaeter: Reichweite, Relais, Verzögerung und Funkabschattung.

Moegliche Kontaktzustaende:

```text
Connected
Delayed
WeakSignal
RelayOnly
LostContact
AutonomousFallback
```

Bei Kontaktverlust arbeitet die Drohne nach ihrer `MissionRiskPolicy` weiter.

## 11. Risk Policy

Jede Mission bekommt eine Risikoregel.

```text
MissionRiskPolicy
{
    bool allowWarp;
    bool allowCombat;
    bool allowUnknownContacts;
    double minimumFuelReserveFraction;
    double maximumDamageBeforeAbort;
    RiskResponse unknownContactResponse;
    RiskResponse interceptResponse;
}
```

Moegliche Antworten:

```text
Ignore
ReduceWarp
ExitWarp
HoldPosition
ReturnHome
RequestPlayerInput
Evade
```

## 12. Return Policy

Drohnen muessen wissen, wann sie zurueckkehren.

Rueckkehrgruende:

- Fuel Reserve Low.
- Cargo Full.
- Mission Complete.
- Damage Too High.
- Contact Lost.
- Owner Recall.
- Hostile Contact.
- Autopilot Plan Invalid.
- Timewarp Not Allowed.

Return-Ziele:

- Besitzer-Schiff.
- letzte Station.
- definierte Basis.
- sicherer Orbit.
- naechster Relaypunkt.

## 13. Drohnenstatus fuer UI

Der Spieler braucht klare Kurzinfos.

Pflichtanzeigen:

- Drohnenname/ID.
- Mission.
- aktueller Schritt.
- Ziel.
- Realzeit-ETA.
- Missionszeit-ETA.
- Warp-Faktor.
- Fuel-Reserve.
- Cargo-Fuellstand.
- Schaden.
- Verbindungsstatus.
- Risiko/Warnung.

Beispiel:

```text
Drone M-04
Mission: Mine Eber Belt
Step: Transfer Coast
Warp: 100x
Real ETA: 04:20
Fuel Reserve: 31%
Cargo: empty
Risk: clear corridor
```

## 14. Missionsqueue

Drohnen sollten mehrere Auftraege hintereinander ausfuehren koennen.

```text
MissionQueue
{
    string droneId;
    RemoteMission[] queuedMissions;
    MissionQueueMode mode;
}
```

Queue-Modi:

```text
Sequential
RepeatUntilFull
RepeatUntilFuelLow
PatrolLoop
ManualConfirmEachStep
```

Fuer den Prototyp reicht `Sequential`.

## 15. Intercepts und Gefahren

Drohnen duerfen nicht unverwundbar werden, nur weil sie fern vom Spieler operieren.

Gefahren:

- PvE-Schiffe.
- andere Spieler.
- Verteidigungsdrohnen.
- Station Safety Zones.
- Asteroidenfeld-Dichte.
- zu niedriger Fuel-Reserve.
- Atmosphaeren- oder Gravitationsfehler.

Bei realistischem Intercept:

1. Drohne verlaesst Warp.
2. Intercept-Zone wird aktiv simuliert.
3. Besitzer erhaelt Alarm.
4. Drohne folgt Risk Policy.
5. Spieler kann spaeter manuell uebernehmen oder neue Befehle senden.

## 16. Singleplayer-Verhalten

Im Singleplayer uebernimmt `LocalWarpAuthority` die Drohnenvalidierung.

Besonderheiten:

- Drohnen koennen in nicht geladenen Bereichen datenbasiert weiterlaufen.
- PvE-Intercepts koennen als Ereignis aus Predictor und Risk Policy entstehen.
- Bei kritischem Ereignis kann eine lokale Encounter-Szene geladen werden.
- Kein externer Server ist noetig, aber die Logik soll dieselbe Schnittstelle nutzen.

## 17. Multiplayer-Verhalten

Im Multiplayer muss der Server oder Host autoritativ entscheiden.

Regeln:

- Drohnenpositionen und Missionszustaende sind serverautoritativ.
- Clients duerfen Befehle senden, aber nicht Ergebnispositionen setzen.
- Drohnen-Timewarp muss gegen Spieler-Safety-Bubbles geprueft werden.
- Spieler koennen fremde Drohnen entdecken und intercepten.
- Drohnen duerfen nicht durch Spielerzonen warpen.

## 18. Persistence

Drohnenmissionen muessen speicherbar sein.

Zu speichern:

- Drohnenzustand.
- aktuelle Mission.
- Missionsqueue.
- aktueller AutopilotPlan.
- WarpState.
- Fuel, Cargo, Schaden, Power.
- letzter bekannter Kontakt.
- naechstes geplantes Ereignis.

Beim Laden muss entschieden werden, ob die Drohne direkt weiterlaeuft, ob Ereignisse nachsimuliert werden oder ob ein sicherer Replan noetig ist.

## 19. Erste Prototyp-Stufe

Minimaler Scope:

1. Eine Scout-Drohne als datengetriebenes Objekt.
2. Eine Zielmission: fliege zu einem Asteroiden-Waypoint und kehre zurueck.
3. Navigation Computer erzeugt AutopilotPlan.
4. Drohne kann Coast-Segment mit objektgebundenem Warp ausfuehren.
5. UI zeigt ETA, Warp, Fuel und Status.
6. Safety Bubble um Spieler und Zielstation.
7. Bei Risiko: Warp-Exit und MissionStatus `NeedsAttention`.
8. Save/Load des Drohnenzustands.

## 20. Tests

Fruehe Tests:

- Drohne fliegt weiter, waehrend Spieler am Boden steht.
- Drohne nutzt Warp, ohne globale Zeit zu beschleunigen.
- Drohne verlaesst Warp bei Safety Bubble.
- Drohne verliert durch Burn Treibstoff.
- Drohne kann Mission abbrechen und ReturnHome planen.
- Save/Load rekonstruiert Mission und ETA.
- Intercept-Ereignis setzt Status auf `NeedsAttention`.

## 21. Offene Fragen

- Wie viele Drohnen darf ein Spieler frueh besitzen?
- Sollen Drohnen teuer und wichtig oder billig und verbrauchbar sein?
- Wie viel Autonomie ist spielerisch gut, ohne dass der Spieler nichts mehr tun muss?
- Wie realistisch sollen Kommunikationsverzoegerungen werden?
- Darf eine Drohne bei Kontaktverlust weiter minen?
- Wie stark soll PvE Drohnen jagen?

## 22. Kurzfazit

Drohnen sind autonome Schiffe mit eigenen Missionen, Plaenen, Zustaenden und Risiken. Sie nutzen dieselbe Physik, denselben Navigation Computer und denselben objektgebundenen Timewarp wie Spielerschiffe. Der Spieler kann an einem anderen Ort bleiben, waehrend Drohnen datenbasiert weiterarbeiten. Kritisch ist, dass Drohnen nicht unangreifbar oder magisch werden: Intercepts, Safety Bubbles, Fuel, Schaden und Persistence muessen von Anfang an mitgedacht werden.
