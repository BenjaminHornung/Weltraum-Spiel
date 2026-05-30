# Spielkonzept: Persistence and Offline Simulation

Stand: 2026-05-28  
Status: Konzeptbasis fuer Weltraum-Spiel, noch keine finale Implementierung  
Bezug: Dieses Dokument beschreibt, wie Schiffe, Drohnen, Basen, Missionen, Autopilot-Plaene und Timewarp-Zustaende gespeichert, geladen und in nicht aktiven Bereichen fortgeschrieben werden.

## 1. Ziel

Das Spiel soll nicht nur den gerade gerenderten Bereich kennen. Drohnen koennen unterwegs sein, Schiffe koennen auf Autopilot fliegen, Stationen koennen im Asteroidenguertel arbeiten und Missionen koennen weiterlaufen, waehrend der Spieler am Boden, in einem anderen Schiff oder offline ist.

Leitsatz:

> **Alles, was fuer Gameplay relevant ist, braucht einen speicherbaren Datenzustand, der ohne geladene Unity-Szene fortgeschrieben werden kann.**

Persistence ist deshalb nicht nur Savegame. Persistence ist die Grundlage fuer Drohnenmissionen, objektgebundenen Timewarp, spaetere Koop-/Multiplayer-Welten und glaubwuerdige Langstrecken-Navigation.

## 2. Nicht-Ziele

Diese Datei definiert nicht:

- konkrete Datenbanktechnologie,
- finales Dateiformat,
- Cloud-Sync,
- komplette Multiplayer-Persistence,
- Wirtschaftssimulation im Detail,
- konkrete UI-Darstellung.

Sie definiert, welche Zustandsarten es gibt und wie nicht aktive Simulation behandelt werden soll.

## 3. Zustaende im Spiel

Es gibt drei wichtige Simulationszustaende.

| Zustand | Bedeutung | Beispiel |
| --- | --- | --- |
| Active Scene | Objekt ist geladen und normal simuliert. | Spieler fliegt neben Station. |
| Background Simulation | Objekt ist nicht gerendert, wird datenbasiert fortgeschrieben. | Drohne fliegt zum Asteroidengürtel. |
| Dormant State | Objekt ist stabil und muss nur bei Ereignis neu berechnet werden. | Station ohne aktive Mission. |

Ein Objekt darf zwischen diesen Zustaenden wechseln, ohne Daten zu verlieren.

## 4. Persistente Objektarten

Mindestens persistenzrelevant:

- Spielerprofil.
- Spielerschiffe.
- Drohnen.
- Stationen.
- Basen.
- laufende Missionen.
- AutopilotPlaene.
- WarpStates.
- Cargo und Inventar.
- Ressourcen-Knoten.
- entdeckte Karteninformationen.
- Encounter- und Intercept-Ereignisse.
- Schaden, Treibstoff, Energie, Temperatur.

Nicht jedes visuelle Objekt muss gespeichert werden. Kleine dekorative Asteroiden oder Partikeleffekte koennen aus Seeds rekonstruiert werden.

## 5. Savegame-Grundstruktur

Moegliches Datenmodell:

```text
SaveGame
{
    string saveId;
    string gameVersion;
    double universeTimeSeconds;
    PlayerState player;
    CelestialDiscoveryState discoveries;
    ShipState[] ships;
    DroneState[] drones;
    StationState[] stations;
    BaseState[] bases;
    MissionState[] missions;
    EncounterState[] encounters;
    EconomyState economy;
    WorldSeedState seeds;
}
```

Wichtig:

- Definitionsdaten wie Planetenwerte werden nicht komplett ins Savegame kopiert.
- Savegames referenzieren stabile IDs aus dem Datenkatalog.
- Veraenderliche Zustandsdaten werden gespeichert.
- Versionsnummern und Migrationen sind Pflicht.

## 6. AbsoluteState als Kern

Jedes bewegliche Objekt braucht einen speicherbaren `AbsoluteState`.

```text
AbsoluteState
{
    string referenceFrameId;
    double3 positionMeters;
    double3 velocityMetersPerSecond;
    double3 rotationEulerOrQuaternion;
    double3 angularVelocity;
    double epochSeconds;
}
```

Dieser Zustand ist unabhaengig davon, ob ein Unity-GameObject geladen ist.

## 7. ShipState und DroneState

Schiffe und Drohnen speichern aehnliche Daten.

```text
MobileObjectState
{
    string objectId;
    string ownerId;
    string definitionId;
    AbsoluteState absoluteState;
    double currentMassKg;
    double dryMassKg;
    double fuelMassKg;
    CargoState cargo;
    DamageState damage;
    PowerState power;
    AutopilotPlan activePlan;
    WarpState warpState;
    MissionState activeMission;
    SimulationMode simulationMode;
}
```

`SimulationMode`:

```text
ActiveScene
Background
Dormant
NeedsReplan
NeedsPlayerAttention
Destroyed
```

## 8. AutopilotPlan persistence

Ein AutopilotPlan muss speicherbar sein, weil Reisen ueber lange Zeitraeume laufen koennen.

Zu speichern:

- Plan-ID.
- Startzeit.
- Ziel.
- Segmente.
- erwartete Start-/Endzustaende.
- Delta-v und Fuel-Schaetzung.
- Safety-Checks.
- Warp-faehige Segmente.
- letzter validierter Segmentindex.
- ob der Plan stale ist.

Beim Laden wird der Plan nicht blind fortgesetzt. Er wird validiert.

## 9. WarpState persistence

Objektgebundener Warp ist ein Zustand, kein visueller Effekt.

```text
WarpState
{
    bool isWarping;
    double warpFactor;
    string authorityMode;
    string activePlanId;
    int activeSegmentIndex;
    double localMissionTimeSeconds;
    double lastValidationUniverseTimeSeconds;
    string lastExitReason;
}
```

Beim Speichern muss klar sein:

- auf welchem Segment das Objekt war,
- wie viel lokale Missionszeit vergangen ist,
- wann der naechste Safety-Check faellig ist,
- ob der Zustand sicher fortgesetzt werden kann.

## 10. Background Simulation

Nicht aktive Objekte werden nicht mit normaler Unity-Physik simuliert. Sie werden datenbasiert fortgeschrieben.

Moegliche Fortschreibungen:

| Typ | Methode |
| --- | --- |
| analytischer Orbit | Position aus Ephemeridenzeit berechnen |
| Autopilot-Coast | Predictor entlang Segment |
| geplanter Burn | Segmentintegration mit Fuel-Verbrauch |
| MissionStep | Fortschritt nach Zeit und Bedingungen |
| Station | Produktions-/Wartungsstatus nach Tick |
| Encounter | Kandidaten pruefen und Ereignis setzen |

Regel:

> **Background Simulation darf vereinfachen, aber keine anderen Spielregeln verwenden.**

## 11. Offline-Fortschreibung

Singleplayer-Savegames koennen geladen werden, nachdem reale Zeit vergangen ist. Es muss entschieden werden, ob Offline-Zeit im Spiel zaehlt.

Optionen:

| Option | Beschreibung | Bewertung |
| --- | --- | --- |
| Keine Offline-Zeit | Beim Laden geht es exakt weiter. | einfach, fair, wenig Simulation |
| Begrenzte Offline-Zeit | z. B. max. 1 Stunde wird fortgeschrieben. | kontrollierbar |
| Volle Offline-Zeit | reale Zeit wird komplett nachsimuliert. | riskant und schwer balancierbar |
| Nur geplante Missionen | nur sichere Missionen laufen weiter. | sinnvoll fuer Drohnen |

Empfehlung fuer den Anfang:

- Singleplayer: keine automatische reale Offline-Zeit, ausser explizit gewollt.
- Innerhalb einer laufenden Spielsitzung: Background Simulation aktiv.
- Spaeter optional: geplante Drohnenmissionen koennen begrenzt offline fortschreiten.

## 12. Event Queue

Background Simulation soll Ereignisse erzeugen, statt alles sofort auszuspielen.

```text
WorldEvent
{
    string eventId;
    double universeTimeSeconds;
    EventType type;
    string[] involvedObjectIds;
    EventSeverity severity;
    string summary;
    bool requiresPlayerAttention;
}
```

Beispiele:

```text
DroneArrived
FuelReserveLow
WarpExited
InterceptDetected
MissionComplete
CargoFull
ContactLost
StationProductionComplete
```

Der Spieler bekommt Ereignisse ueber UI/Comms, nicht ueber chaotische Hintergrundzustandsaenderungen.

## 13. Laden eines Savegames

Beim Laden:

1. Definitionskatalog laden.
2. Savegame-Version pruefen.
3. IDs gegen Katalog validieren.
4. AbsoluteStates rekonstruieren.
5. aktive Plaene validieren.
6. Background-Objekte klassifizieren.
7. kritische Events rekonstruieren.
8. aktive Szene fuer Spielerposition laden.
9. lokale GameObjects aus Daten erzeugen.

Kein Objekt soll beim Laden nur deshalb verloren gehen, weil seine Szene nicht geladen war.

## 14. Revalidation beim Laden

Plaene und WarpStates werden neu validiert.

Pruefen:

- Existiert Ziel noch?
- Stimmen Parent-/Reference-Frames?
- Hat Objekt noch genug Fuel?
- Ist Safety-Zone jetzt blockiert?
- Ist aktives Segment noch plausibel?
- Ist Encounter/Intercept offen?
- Muss Warp beendet werden?

Wenn unklar: `NeedsReplan` oder `NeedsPlayerAttention`, nicht stillschweigend fortsetzen.

## 15. Singleplayer

Im Singleplayer ist der lokale Prozess autoritativ.

Regeln:

- Savegame kann alle Daten direkt enthalten.
- Background Simulation laeuft lokal.
- Drohnen und Schiffe werden datenbasiert fortgeschrieben.
- Beim Wechsel in aktive Naehe werden GameObjects aus gespeicherten Zustaenden erzeugt.
- Alle Regeln bleiben kompatibel mit `IWarpAuthority` und `LocalWarpAuthority`.

## 16. Multiplayer und Koop

Fuer spaeter:

- Server/Host besitzt persistenten Weltzustand.
- Clients halten nur lokale Projektionen.
- Drohnenmissionen laufen serverseitig.
- Offline-Spieler duerfen keine unfairen Vorteile bekommen.
- Save/Load ist eher Weltpersistenz als einzelnes Savegame.
- Migrationen muessen serverseitig kontrolliert werden.

Dieses Dokument priorisiert trotzdem Singleplayer, weil es zuerst funktionieren muss.

## 17. Konflikte und Aufloesung

Beispiele fuer Konflikte:

- Drohne sollte ankommen, aber Zielstation wurde zerstoert.
- Schiff war im Warp, aber neuer Encounter wurde erzeugt.
- Cargo-Ziel ist voll.
- Asteroid wurde bereits abgebaut.
- Besitzer ist nicht erreichbar.

Loesungsprinzip:

1. Sicherheit vor Komfort.
2. Kein unsichtbarer Schaden ohne Event.
3. Bei unklarer Lage Mission pausieren.
4. Spieler informieren.
5. Replan anbieten.

## 18. Datenreduktion

Nicht alles muss detailliert gespeichert werden.

Speichern:

- bedeutende Objekte.
- Spielerbesitz.
- aktive Missionen.
- entdeckte Orte.
- veraenderte Ressourcen.
- Gefahrenereignisse.

Rekonstruieren:

- dekorative Asteroiden aus Seed.
- Hintergrundsterne.
- nicht interaktive Partikel.
- triviale UI-Marker.

## 19. Erste Prototyp-Stufe

Minimaler Scope:

1. Savegame speichert ein Spielerschiff und eine Drohne.
2. Beide haben AbsoluteState, Fuel, Cargo, Mission und optional Plan.
3. Drohne kann in Background Simulation weiterfliegen, waehrend Spieler in anderer Szene ist.
4. GameObjects werden aus Daten erzeugt, wenn Drohne aktiv betrachtet wird.
5. WarpState wird gespeichert und beim Laden validiert.
6. Event Queue erzeugt `MissionComplete` und `WarpExited`.
7. Bei ungueltigem Plan wird `NeedsReplan` gesetzt.

## 20. Tests

Fruehe Tests:

- Speichern/Laden erhaelt absolute Position und Geschwindigkeit.
- Drohne bleibt nach Szenenwechsel erhalten.
- Background-Mission erzeugt korrekte ETA.
- WarpState wird nach Laden nicht blind fortgesetzt.
- Ungueltiger Zielkoerper erzeugt NeedsReplan.
- Event Queue zeigt MissionComplete.
- Floating-Origin-Shift veraendert gespeicherte absolute Daten nicht.

## 21. Offene Fragen

- Wird Offline-Zeit im Singleplayer ueberhaupt simuliert?
- Wie viele Background-Objekte duerfen gleichzeitig aktiv sein?
- Wie detailliert wird Stationsproduktion gespeichert?
- Wie werden Savegame-Migrationen organisiert?
- Wann wird aus Background Simulation eine aktive Encounter-Szene?
- Wie viel Risiko darf eine Drohne im Hintergrund eingehen?

## 22. Kurzfazit

Persistence und Offline Simulation sorgen dafuer, dass die Welt nicht nur aus der gerade geladenen Unity-Szene besteht. Schiffe, Drohnen, Missionen, Plaene, WarpStates und Ereignisse werden als Daten gespeichert und bei Bedarf fortgeschrieben. Singleplayer funktioniert lokal, Multiplayer kann spaeter dieselbe Struktur serverseitig nutzen. Entscheidend ist, dass Background Simulation dieselben Regeln verwendet wie aktive Simulation und bei Unsicherheit sichere Replan-/Attention-Zustaende erzeugt.
