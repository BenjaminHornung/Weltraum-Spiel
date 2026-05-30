# Spielkonzept: Encounters and Interception

Stand: 2026-05-28  
Status: Konzeptbasis fuer Weltraum-Spiel, noch keine finale Implementierung  
Bezug: Dieses Dokument beschreibt Begegnungen, Abfangmanöver, Warp-Abbrueche und faire Interaktionsfenster zwischen Spielern, Drohnen, PvE-Schiffen, Basen und Stationen.

## 1. Ziel

Encounters und Interceptions beantworten eine zentrale Frage: Wann treffen sich zwei Objekte im riesigen Raum ueberhaupt so, dass Gameplay entsteht?

Das System muss verhindern, dass Timewarp, Drohnenautonomie oder grosse Distanzen Interaktion unmoeglich machen. Gleichzeitig darf Interception kein magischer Knopf sein, der physikalische Reichweiten, Delta-v, Sensoren und Zeit ignoriert.

Leitsatz:

> **Eine Begegnung entsteht nur, wenn Position, Zeit, Sensorik, Delta-v und Sicherheitsregeln eine plausible Interaktion erlauben.**

Dieses Dokument definiert nicht die Waffenmechanik. Es definiert, wie Objekte in normale Realzeit-Interaktion gezwungen werden, bevor Kampf, Scan, Docking, Flucht oder Kommunikation passieren kann.

## 2. Nicht-Ziele

Diese Datei definiert nicht:

- konkrete Waffenwerte,
- Schadensmodell,
- Schiffsklassen,
- PvE-Fraktions-KI im Detail,
- Loot- oder Belohnungssystem,
- komplette Netcode-Implementierung.

Sie definiert Begegnungslogik, Intercept-Bedingungen und Warp-Exit-Regeln.

## 3. Begegnungstypen

| Typ | Beschreibung | Beispiel |
| --- | --- | --- |
| Passive Encounter | Objekte kommen zufaellig oder geplant in Naehe. | Spieler sieht eine Drohne im Orbit. |
| Planned Rendezvous | Beide Seiten wollen sich treffen. | Spieler dockt an Cargo-Drohne an. |
| Pursuit Intercept | Ein Objekt jagt ein anderes. | PvE-Pirat faengt Mining-Drohne ab. |
| Defensive Intercept | Verteidiger stellt Eindringling. | Basisdrohnen stoppen unbekanntes Schiff. |
| Scan Encounter | Sensorreichweite reicht fuer Kontakt. | Scout entdeckt fremdes Schiff. |
| Safety Encounter | Warp muss wegen Naehe zu Spieler/Basis enden. | Drohne naehert sich bewohnter Station. |
| Hazard Encounter | Raumumgebung erzwingt Reaktion. | Asteroidenfeld, Atmosphaere, Gravitation. |

Nicht jede Begegnung fuehrt zu Kampf. Viele Begegnungen erzeugen nur UI-Kontakt, Warnung, Scan, Funk, Docking oder Ausweichmanöver.

## 4. Grundmodell

Eine Begegnung braucht mindestens:

```text
EncounterCandidate
{
    string subjectId;
    string targetId;
    EncounterType type;
    double predictedTimeSeconds;
    double predictedDistanceMeters;
    double relativeVelocityMetersPerSecond;
    double confidence;
    EncounterRisk risk;
}
```

Der Kandidat ist zunaechst nur eine Vorhersage. Erst nach Validierung wird daraus ein aktives Encounter Event.

## 5. Intercept-Voraussetzungen

Ein Intercept ist nur gueltig, wenn der Abfangende das Ziel realistisch erreichen kann.

Pflichtbedingungen:

- Zielposition oder Zielroute ist bekannt oder ausreichend vorhersagbar.
- Abfangobjekt hat genug Delta-v.
- Abfangobjekt kann den Intercept-Punkt zeitlich erreichen.
- Sensorik oder Aufklaerung liefert plausiblen Kontakt.
- Route schneidet keine verbotenen Safety-Zonen.
- Beide Objekte koennen vor Interaktion auf Realzeit gebracht werden.
- Intercept passiert nicht erst bei Kollisionsdistanz.

Nicht erlaubt:

- Instant-Interdiction ohne physikalischen Weg.
- Warp-Ramming.
- Gegner spawnt direkt neben Spieler ohne Vorwarnlogik.
- Drohne wird im Hintergrund zerstoert, ohne dass ein plausibles Encounter Event erzeugt wurde.

## 6. Sensorik und Wissen

Ein Objekt kann nur intercepten, was es kennt oder vorhersagen kann.

Kontaktquellen:

- aktive Sensoren,
- passive Signatur,
- bekannte Flugroute,
- Drohnen-/Stationen-Netzwerk,
- Relay-Daten,
- Missionsinformationen,
- visuelle Naehe,
- vorheriger Kontakt.

Startmodell fuer Prototyp:

- Kontakte in einem grossen Debug-Sensorradius sind bekannt.
- Spielernahe Objekte sind immer bekannt.
- Stationen und eigene Drohnen sind bekannt.
- Unbekannte PvE-Kontakte koennen als vereinfachte Encounter-Kandidaten erscheinen.

Spaeter kann Sensorik differenziert werden:

- aktive Radarreichweite,
- thermische Signatur,
- Funkemission,
- Stealth/Low Power,
- Relay-Abdeckung,
- Kommunikationsverzoegerung.

## 7. Intercept Solver

Der `InterceptSolver` prueft, ob ein Objekt ein anderes erreichen kann.

Eingaben:

```text
interceptorState
targetPredictedPath
interceptorDeltaVAvailable
interceptorThrustProfile
sensorConfidence
riskPolicy
safetyBubbles
```

Ausgabe:

```text
InterceptSolution
{
    bool possible;
    double interceptTimeSeconds;
    double interceptDistanceMeters;
    double requiredDeltaV;
    double fuelMargin;
    double exitWarpBeforeSeconds;
    string reason;
}
```

Fuer den ersten Prototyp reicht ein vereinfachter Solver:

- Zielroute wird als Segmentfolge angenommen.
- Interceptor erreicht einen Punkt, wenn Zeit und vereinfachte Beschleunigung reichen.
- Delta-v wird konservativ geschaetzt.
- Bei Unsicherheit wird kein harter Intercept erzeugt, sondern nur eine Warnung.

## 8. Warp-Exit bei Begegnungen

Timewarp darf nie bis zur eigentlichen Interaktion laufen. Warp endet vorher.

Grundregel:

```text
warpExitDistance > interactionDistance + stoppingSafetyMargin
```

Beispielwerte:

| Begegnung | Exit-Distanz | Begründung |
| --- | ---: | --- |
| Spieler-Schiff gegen Spieler-Schiff | 500-2,000 km | Reaktionszeit und Fairness |
| Spieler gegen Drohne | 100-1,000 km | Drohne soll sichtbar/abfangbar sein |
| PvE gegen Spieler | 500-5,000 km | Warnung und Reaktionsspielraum |
| Station/Basis | 1,000-10,000 km | Docking- und Sicherheitszone |
| Planet/Atmosphaere | deutlich vor Atmosphaere | kein Warp in Landephase |
| Asteroidenfeld | zonenabhaengig | Kollisions- und Navigationsrisiko |

Die genauen Werte sind Balancing. Die Regel ist wichtiger als die Zahl.

## 9. Fairness-Regeln

Fairness ist nicht nur Multiplayer relevant. Auch Singleplayer braucht nachvollziehbare Ereignisse.

Regeln:

- Spieler muss relevante Warnungen bekommen, bevor echte Gefahr entsteht.
- Gegner duerfen nicht direkt in Waffenreichweite spawnen, ausser es ist eine bewusst gescriptete Szene.
- Warp darf nicht als Schutzschild dienen.
- Warp darf nicht als Waffe dienen.
- Drohnen duerfen nicht heimlich durch Spielerraum teleportieren.
- PvE darf keine besseren Physikregeln nutzen als Spieler.
- Bei unklarer Prognose wird Warp beendet statt Risiko zu verstecken.

## 10. Encounter-Zustandsmaschine

```text
None
  -> CandidateDetected
  -> Validating
  -> WarningIssued
  -> WarpExitScheduled
  -> RealTimeEncounter
  -> Resolved
  -> Escaped
  -> LostContact
```

Bedeutung:

- `CandidateDetected`: eine moegliche Begegnung wurde erkannt.
- `Validating`: Sensorik, Delta-v und Safety werden geprueft.
- `WarningIssued`: Spieler oder Drohnenbesitzer wird informiert.
- `WarpExitScheduled`: Warp wird reduziert oder beendet.
- `RealTimeEncounter`: beide Seiten sind normal simulierbar.
- `Resolved`: Docking, Kampf, Scan, Flucht oder Ignorieren abgeschlossen.
- `Escaped`: Ziel konnte physikalisch entkommen.
- `LostContact`: Sensorik reicht nicht mehr.

## 11. Encounter Actions

Wenn ein Encounter aktiv ist, koennen Systeme reagieren.

Moegliche Aktionen:

```text
Ignore
Track
Scan
Hail
Dock
Escort
Intercept
Evade
Attack
Retreat
RequestPlayerInput
ReturnHome
```

Welche Aktionen erlaubt sind, haengt ab von:

- Beziehung/Faction.
- Besitzer.
- Missionsziel.
- Waffenstatus.
- Safety-Zone.
- Fuel-Reserve.
- Schaden.
- Kommunikationsstatus.

## 12. Drohnen und Encounters

Drohnen muessen Encounters ueber ihre Risk Policy behandeln.

Beispiele:

- Mining-Drohne entdeckt unbekannten Kontakt: Warp reduzieren, Besitzer warnen.
- Defense-Drohne entdeckt Eindringling: Intercept pruefen, dann Realzeit-Encounter erzeugen.
- Cargo-Drohne wird verfolgt: Fluchtpfad berechnen, ReturnHome oder Escort anfordern.
- Scout-Drohne verliert Kontakt: markiert letzte Position und fliegt sicheren Orbit an.

Drohnen sollen nicht automatisch kaempfen, wenn ihre Mission das nicht vorsieht.

## 13. PvE-Encounters

PvE-Gegner nutzen dieselben Encounter-Regeln.

Schwierigkeit entsteht durch:

- bessere Sensorik,
- bessere Planung,
- Flottenkoordination,
- Hinterhalt in plausiblen Zonen,
- mehrere Intercept-Versuche,
- Ressourcen- und Fuel-Management.

Nicht durch:

- Teleport,
- ignorierte Gravitation,
- Warp-Ramming,
- Instant-Kills aus nicht geladener Simulation.

## 14. Singleplayer

Im Singleplayer kann das Spiel Encounter im Hintergrund planen.

Beispiel:

1. Drohne fliegt im Timewarp zum Asteroidengürtel.
2. LocalWarpAuthority erkennt PvE-Kontakt mit moeglichem Intercept.
3. EncounterCandidate wird erstellt.
4. Spieler bekommt Meldung: `Drone M-04: Unknown contact on intercept course`.
5. Drohnenwarp endet vor Begegnung.
6. Eine lokale Encounter-Szene kann geladen oder datenbasiert weitergefuehrt werden.

Wichtig: Auch Singleplayer-Ereignisse muessen physikalisch plausibel wirken.

## 15. Multiplayer

Im Multiplayer ist der Server/Host fuer Encounters autoritativ.

Regeln:

- Server prueft Intercepts.
- Server erzwingt Warp-Exit.
- Clients erhalten Encounter-Warnungen.
- Begegnungszonen werden rechtzeitig synchronisiert.
- Spieler duerfen durch Warp keine Interaktionsfenster ueberspringen.
- Fremde Drohnen koennen entdeckt und verfolgt werden.

## 16. Kollisionen

Encounter ist nicht gleich Kollision. Kollisionen sind der letzte physische Fall und sollen nicht durch Warp entstehen.

Regeln:

- Bei Kollisionsprognose: Warp sofort beenden.
- Bei hoher Relativgeschwindigkeit: Warnung und Ausweichoption.
- Rammen nur in Realzeit und innerhalb normaler Physik.
- Nicht geladene Drohnen kollidieren nicht einfach unsichtbar mit Spielern.
- Stationen und Basen haben grosse Schutz- und Dockingzonen.

## 17. UI und Warnungen

Warnungen sollten klar und kurz sein.

Beispiele:

```text
CONTACT DETECTED
POSSIBLE INTERCEPT
WARP EXIT: PLAYER PROXIMITY
WARP EXIT: STATION SAFETY
DRONE UNDER THREAT
INTERCEPT SOLUTION FOUND
TARGET LOST
CONTACT ENTERING SENSOR RANGE
```

Der Spieler sollte sehen:

- wer betroffen ist,
- wann Begegnung stattfindet,
- ungefaehre Distanz,
- Risiko,
- verfuegbare Aktionen.

## 18. Erste Prototyp-Stufe

Minimaler Scope:

1. EncounterCandidate bei Naehe zwischen zwei Schiffen/Drohnen.
2. Warp-Exit bei prognostizierter Naehe.
3. Debug-Sensorradius.
4. Einfache Intercept-Pruefung mit Distanz/Zeit/Delta-v-Schaetzung.
5. Warnung im HUD oder Debug-Panel.
6. Drohnenstatus `NeedsAttention` bei gefaehrlichem Encounter.
7. PvE-Dummy kann Drohne abfangen, aber nicht teleportieren.

## 19. Tests

Fruehe Tests:

- Zwei Schiffe im Warp verlassen Warp vor Begegnung.
- Drohne wird bei Spielernaehe auf Realzeit gezwungen.
- PvE-Intercept ohne genug Delta-v wird abgelehnt.
- Station Safety Bubble beendet Warp.
- Encounter-Warnung erscheint vor Realzeit-Interaktion.
- Kollision im Warp ist nicht moeglich.

## 20. Offene Fragen

- Welche Sensorradien fuehlen sich gut an?
- Wie viel Vorwarnzeit braucht der Spieler?
- Sollen PvE-Intercepts in nicht geladenen Bereichen automatisch ausgespielt oder erst bei Spielerentscheidung geladen werden?
- Wie stark duerfen Drohnen selbst ausweichen?
- Darf ein Spieler fremde Drohnen passiv verfolgen, ohne sofort Intercept zu erzwingen?

## 21. Kurzfazit

Encounters und Interception sorgen dafuer, dass grosse Distanzen und Timewarp nicht zu isolierten, unangreifbaren Objekten fuehren. Jede Begegnung muss aus Sensorik, Route, Delta-v, Zeit und Safety-Regeln plausibel entstehen. Warp endet immer vor echter Interaktion. Dadurch bleiben Drohnen, PvE, Spieler und Basen erreichbar, ohne Realismus und Fairness zu opfern.
