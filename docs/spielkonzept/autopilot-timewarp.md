# Spielkonzept: Autopilot-Timewarp und beschleunigte Navigation

Stand: 2026-05-27  
Status: Konzeptbasis fuer Weltraum-Spiel, noch keine finale Implementierung  
Bezug: `docs/spielkonzept/startsystem.md`, spaetere Navigation zwischen Planeten, Monden, Asteroiden, Basen, Schiffen und Drohnen.

## 1. Ziel des Dokuments

Dieses Dokument beschreibt, wie lange Raumfluege beschleunigt werden koennen, ohne die physikalische Glaubwuerdigkeit des Spiels zu zerstoeren. Es geht nicht um staerkere Triebwerke und nicht um magischen FTL-Antrieb. Das Schiff soll weiterhin mit seinen realen Triebwerken, Massen, Delta-v-Grenzen, Gravitationsquellen und Autopilotplaenen arbeiten. Beschleunigt wird nur die Ausfuehrung der geplanten Flugzeit fuer genau dieses Schiff bzw. diese Drohne.

Wichtigste Grundregel:

> **Timewarp beschleunigt niemals die gesamte Game-Time. Timewarp gilt nur fuer das jeweilige Schiff, die jeweilige Drohne oder einen klar definierten autonomen Flugverband.**

Zweite Grundregel:

> **Die Logik darf nicht server-only sein. Singleplayer und Multiplayer nutzen denselben Warp-Codepfad, aber eine andere Simulationsautoritaet.**

Kurz gesagt:

- Das Universum, andere Spieler, Basen, Planetenrotationen, Wirtschaft, Wetter und normale NPCs laufen in normaler Spielzeit weiter.
- Ein Schiff im Warp bekommt eine objektgebundene beschleunigte Missionszeit.
- Das Schiff fliegt nicht physikalisch schneller; es fuehrt seine reale Flugbahn nur schneller aus.
- Der Geschwindigkeitsvektor des Schiffes bleibt realistisch und wird beim Beenden des Warps nicht mit dem Warp-Faktor multipliziert.
- Timewarp ist jederzeit abbrechbar, solange ein sauberer, validierter Zustandsuebergang moeglich ist.
- Im Singleplayer entscheidet eine lokale Simulationsautoritaet im laufenden Spielprozess.
- Im Multiplayer entscheidet eine Server-/Host-Autoritaet, ob Warp erlaubt ist, wann er endet und ob ein Intercept ausgeloest wird.
- Kein Schiff, keine Drohne und kein PvE-Gegner darf mit 100x-Warp als Kollisionswaffe in einen Spieler, eine Basis oder einen Planeten rasen.

## 2. Designphilosophie

Das System soll einen schmalen Grat treffen:

1. **Reisezeiten duerfen nicht langweilig sein.** Interplanetare Fluege ueber echte Distanzen waeren sonst zu lang fuer normales Gameplay.
2. **Raumfahrt soll weiter real wirken.** Treibstoff, Masse, Bremswege, Gravitation, Transferfenster und Navigation bleiben wichtig.
3. **Warp ist kein Cheat-Speed.** Er komprimiert Wartezeit, aber veraendert nicht die technischen Faehigkeiten eines Schiffes.
4. **Interaktion hat Vorrang.** Sobald andere Spieler, Basen, Stationen, Planeten, grosse Asteroiden, Kampfereignisse oder Intercept-Risiken relevant werden, wird Warp reduziert oder beendet.
5. **Singleplayer darf kein Sonderfall-Hack sein.** Die lokale Singleplayer-Simulation muss dieselben Safety-, Physik- und Exit-Regeln verwenden wie Multiplayer.
6. **Multiplayer braucht Netzwerkautoritaet.** Clients duerfen Timewarp nicht lokal entscheiden, weil sonst Kollisionen, Desync und unfairer PvP-Vorteil entstehen.
7. **Drohnen und Spielerschiffe nutzen dieselbe Logik.** Eine Drohne darf autonom warpen, auch wenn der Besitzer gerade auf einem Planeten steht. Ein Spieler darf in seinem eigenen Schiff warpen, wenn keine Interaktionsgefahr besteht.

## 3. Begriffe

| Begriff | Bedeutung |
| --- | --- |
| Autopilot-Plan | Eine vorab berechnete Flugsequenz aus Ausrichten, Burn, Coast, Kurskorrektur, Bremsen und Final Approach. |
| Warp-Faktor | Multiplikator fuer die lokale Missionszeit des warpenden Objekts, z. B. 5x, 20x oder 100x. |
| Lokale Missionszeit | Die Zeit, die nur fuer das warpendende Schiff schneller ablaeuft. Globale Spielzeit bleibt unveraendert. |
| Realzeit-Zustand | Normal simulierter Zustand eines Schiffes: Position, Geschwindigkeit, Rotation, Treibstoff, Temperatur, Schaden, Cargo. |
| Warp-Zustand | Beschleunigte, autorisierte Simulation eines Schiffes entlang eines validierten Plans. |
| Simulationsautoritaet | System, das Warp erlaubt, reduziert, beendet und den finalen Realzeit-Zustand bestimmt. Im Singleplayer lokal, im Multiplayer Server/Host. |
| Safety Bubble | Sicherheitsbereich um Spieler, Basen, Planeten, Monde, Stationen, aktive Kampfzonen und Intercept-Punkte. |
| Intercept | Geplanter oder zufaellig entstehender Schnittpunkt, an dem ein anderes Schiff oder eine Drohne ein warpendes Objekt abfangen kann. |

## 4. Kernmodell: Objektgebundener Timewarp

Timewarp ist kein globaler Spielmodus. Jedes Schiff kann separat in einen beschleunigten Zustand wechseln.

### 4.1 Was normal weiterlaeuft

Folgende Dinge bleiben immer in normaler Spielzeit:

- Spieler zu Fuss oder in Fahrzeugen auf Planeten.
- Andere Schiffe, die nicht im Warp sind.
- Andere Drohnen, die nicht im Warp sind.
- Basen, Stationen, Dockingbereiche und Hangars.
- Planeten, Monde, Asteroiden und ihre Ephemeriden.
- Kommunikation, Kampf, Handel und Weltzustand.

### 4.2 Was fuer ein warpendes Schiff beschleunigt wird

Nur das warpendende Objekt bekommt eine beschleunigte lokale Missionszeit:

- Autopilot-Ausfuehrung.
- Coast-Phasen.
- geplante Kurskorrekturen.
- geplante Burn-Zeiten.
- Treibstoffverbrauch waehrend geplanter Burns.
- Batterieverbrauch, Waerme, Lebenserhaltung und Verschleiss, soweit sie fuer dieses Schiff relevant sind.
- Reise-ETA und Missionslogs.

Beispiel:

- Der Spieler steht auf Hestia am Boden.
- Eine Bergbaudrohne startet Richtung Asteroidenguertel.
- Die Welt auf Hestia laeuft normal weiter.
- Nur die Drohne fuehrt ihren Autopilot-Plan mit z. B. 50x lokaler Missionszeit aus.
- Wenn die Drohne in die Naehe eines anderen Spielers, einer Basis oder eines massiven Koerpers kommt, verlaesst sie den Warp und wird wieder normal simuliert.

## 5. Autopilot-Plan als Voraussetzung

Warp darf nur starten, wenn der Autopilot einen gueltigen Plan hat.

Ein Warp-faehiger Plan braucht mindestens:

1. Startzustand: Position, Geschwindigkeit, Masse, Treibstoff, aktueller Orbit/Einflussbereich.
2. Zielzustand: Zielorbit, Zielkoerper, Rendezvous-Punkt, Station, Asteroid oder Transferpfad.
3. Burn-Sequenz: geplante Beschleunigungs- und Bremsmanoever.
4. Coast-Segmente: lange passive Flugphasen.
5. Kurskorrekturfenster: geplante kleine Anpassungen.
6. Abbruchpunkte: sichere Zustaende, in denen Warp beendet werden kann.
7. Safety-Prognose: Pruefung gegen Planeten, Monde, Basen, Asteroidenfelder, Spieler, bekannte Schiffe und Intercept-Korridore.

Ohne Plan gibt es keinen Warp. Ein Spieler kann also nicht einfach frei in eine Richtung schauen, 100x aktivieren und wie ein Projektil durchs System schiessen.

## 6. Vorberechnung und Ausfuehrung

Der Autopilot berechnet vor dem Warp eine Flugbahn. Diese Flugbahn ist keine starre Teleport-Linie, sondern eine physikalische Prognose.

### 6.1 Vorberechnung

Vor dem Start prueft die zustaendige Simulationsautoritaet:

- Reicht der Treibstoff fuer geplanten Burn und Bremsung?
- Ist das Schiff strukturell und thermisch warpfaehig?
- Gibt es eine sichere Mindestdistanz zu Planeten, Monden, Basen und aktiven Spielern?
- Schneidet die Bahn eine Atmosphaere, Kollisionshuelle oder Sperrzone?
- Gibt es bekannte Intercept-Moeglichkeiten durch andere Spieler oder aktive Drohnen?
- Gibt es eine geplante Bremse vor dem Ziel?
- Gibt es sichere Exit-Punkte vor jeder kritischen Zone?

Im Singleplayer ist diese Autoritaet ein lokaler Manager im Spielprozess. Im Multiplayer ist sie der Server oder Host. Die Prueflogik soll trotzdem dieselbe bleiben.

### 6.2 Ausfuehrung

Wenn Warp aktiv ist:

- Die Simulationsautoritaet integriert das Schiff mit `deltaTime * warpFactor` oder entlang eines vorvalidierten Bahnsegments.
- Die physikalischen Groessen bleiben real: Position, Geschwindigkeit, Beschleunigung, Treibstoff und Masse werden korrekt fortgeschrieben.
- Fuer grosse Zeitschritte muss Substepping oder analytische Bahnfortschreibung genutzt werden, damit Gravitation, Burns und Kollisionen nicht uebersprungen werden.
- Im Singleplayer kann der lokale Client den Zustand direkt simulieren, muss aber dieselben Validierungsregeln anwenden.
- Im Multiplayer zeigt der Client die Bewegung beschleunigt an, darf den Zustand aber nicht autoritativ bestimmen.
- Bei jedem Segmentende wird der Plan neu validiert.

### 6.3 Kein Velocity-Multiplikator

Der Warp-Faktor multipliziert nicht die Schiffsgeschwindigkeit. Er multipliziert nur die Simulationszeit fuer dieses Objekt.

Falsch:

```text
velocity = velocity * 100
```

Richtig:

```text
shipLocalDeltaTime = gameDeltaTime * warpFactor
integrateShipPhysics(shipLocalDeltaTime)
```

Beim Warp-Abbruch bleibt das Schiff exakt in seinem aktuellen realistischen Zustand:

- aktuelle Position,
- aktuelle echte Geschwindigkeit,
- aktuelle echte Rotation,
- verbleibender Treibstoff,
- aktuelle Temperatur,
- aktueller Schaden,
- aktuelle Cargo.

## 7. Warp-Faktoren

Warp-Faktoren sollten dynamisch erlaubt werden, nicht pauschal.

| Situation | Maximaler Faktor | Grund |
| --- | ---: | --- |
| Direkt nahe Planet, Mond, Station oder Basis | 1x | Normale Interaktion und Kollisionsgefahr |
| Niedriger Orbit / Landeanflug / Docking | 1x | Zu viele Naehe- und Bremsereignisse |
| Hoher Orbit ohne aktive Naehekontakte | 5x-10x | Kontrollierter, aber noch reaktiver Bereich |
| Interplanetare Coast-Phase im leeren Raum | 50x-200x | Hauptnutzen des Systems |
| Unbemannte Drohne weit ausserhalb aktiver Spielerzonen | 100x-500x | Starke Abstraktion moeglich, solange keine Interaktion droht |
| Offline-/Map-only-Simulation fuer sehr entfernte Drohnen | optional hoeher | Nur wenn keine Echtzeit-Interaktion moeglich ist |

Konkrete Werte sind Balancing-Zahlen. Wichtig ist das Prinzip: Je naeher ein Schiff an Interaktion kommt, desto kleiner wird der erlaubte Faktor.

## 8. Safety Bubbles und automatische Warp-Abbrueche

Warp endet automatisch, wenn ein relevantes Ereignis in Reichweite oder Prognosereichweite kommt.

### 8.1 Harte Abbruchgruende

Warp muss sofort enden bei:

- Eintritt in eine Atmosphaeren- oder Landezone.
- Naehe zu einem Planeten, Mond oder grossen Asteroiden unterhalb der definierten Mindesthoehe.
- Naehe zu einer Spielerbasis, Station, Dockingzone oder Hangarzone.
- Naehe zu einem anderen Spieler oder dessen bemanntem Schiff.
- Naehe zu einer aktiven Drohne, wenn Interaktion realistisch moeglich ist.
- Waffenlock, Scanlock, Interdict-/Intercept-Ereignis oder Kollisionsprognose.
- Autopilot-Plan wird ungueltig: zu wenig Treibstoff, falscher Kurs, unerwartete Masseaenderung, Schaden, Steuerverlust.
- Desync, widerspruechliche Zustandsdaten oder fehlende sichere Prognose.

### 8.2 Weiche Reduktionsgruende

Warp kann stufenweise reduziert werden bei:

- Annaeherung an geplante Kurskorrektur.
- Annaeherung an Bremsburn.
- Eintritt in eine dichtere Asteroidenregion.
- wachsender Navigationsunsicherheit.
- Zielkoerper wird gravitationell dominant.
- Sensoren melden unbekannte Kontakte in weiter Entfernung.

Beispielsequenz:

```text
200x Interplanetary Coast
50x  Zielkoerper kommt in Prognosereichweite
10x  hoher Zielorbit / Kurskorrektur
1x   Final Approach, Docking, Landeanflug oder Spielerinteraktion
```

## 9. Autoritaetsmodell fuer Singleplayer und Multiplayer

Die Warp-Logik soll ueber eine gemeinsame Schnittstelle laufen, nicht ueber getrennte Sonderloesungen.

```text
IWarpAuthority
  - LocalWarpAuthority        // Singleplayer
  - HostWarpAuthority         // Koop/Listen-Server optional
  - ServerWarpAuthority       // Dedicated Multiplayer
```

### 9.1 Singleplayer

Im Singleplayer gibt es keinen externen Server, aber es braucht trotzdem eine klare Autoritaet. Diese Rolle uebernimmt `LocalWarpAuthority`.

Sie entscheidet lokal:

- ob Warp gestartet werden darf,
- welcher Faktor erlaubt ist,
- wann Warp reduziert wird,
- wann Warp endet,
- ob ein PvE-/Drohnen-Intercept-Fenster entsteht,
- welcher Zustand beim Exit gilt.

Wichtig: Singleplayer darf grosszuegiger rechnen, aber nicht andere Regeln verwenden. Ein Savegame, eine Replay-Funktion oder ein spaeterer Wechsel zu Koop/Multiplayer sollen nicht daran scheitern, dass Singleplayer physikalisch andere Pfade erzeugt.

### 9.2 Multiplayer

Multiplayer ist der schwierigste Teil des Systems. Die wichtigste Regel lautet:

> **Warp ist erlaubt, solange kein anderer Spieler dadurch eine faire Interaktionsmoeglichkeit verliert oder in Kollisionsgefahr gebracht wird.**

Im Multiplayer entscheidet `ServerWarpAuthority` oder ein Host:

- ob Warp gestartet werden darf,
- welcher Faktor erlaubt ist,
- wann Warp reduziert wird,
- wann Warp endet,
- ob ein Intercept-Fenster entsteht,
- welcher Zustand beim Exit gilt.

Clients duerfen nur anfragen:

```text
RequestWarp(shipId, desiredFactor, autopilotPlanId)
```

Die Autoritaet antwortet z. B.:

```text
WarpApproved(factor=50, reason="Clear interplanetary corridor")
WarpDenied(reason="Player safety bubble ahead")
WarpReduced(factor=10, reason="Approaching target SOI")
WarpExited(reason="Possible intercept by player ship")
```

### 9.3 Gemeinsamer Codepfad

Singleplayer und Multiplayer sollen dieselben Kernklassen verwenden:

- `AutopilotPlan`
- `TrajectoryPredictor`
- `SafetyBubbleRegistry`
- `InterceptSolver`
- `WarpController`
- `IWarpAuthority`

Der Unterschied liegt nur darin, wer autoritativ entscheidet:

| Modus | Autoritaet | Client darf Zustand bestimmen? | Safety-Regeln |
| --- | --- | --- | --- |
| Singleplayer | lokaler Spielprozess | ja, weil lokal autoritativ | identisch |
| Koop/Host | Host/Listen-Server | nur Host | identisch |
| Dedicated Multiplayer | Server | nein | identisch, strenger bei Spielern |

### 9.4 Spieler in verschiedenen Rollen

Das System muss drei Grundsituationen koennen:

1. **Spieler ist im Schiff.**  
   Der Spieler erlebt die Reise beschleunigt. UI, Sterne, Orbitkarte und Autopilot laufen schneller, aber alle externen Interaktionen beenden Warp.

2. **Spieler ist am Boden, Drohne fliegt.**  
   Die Drohne darf separat warpen. Der Spieler bleibt in normaler Planetenszene. Drohnenstatus, ETA und Ereignisse werden ueber UI/Comms angezeigt.

3. **Spieler kontrolliert mehrere autonome Schiffe.**  
   Jedes Schiff hat eigenen Warp-Zustand. Ein Schiff im Warp beeinflusst nicht die Zeit anderer Schiffe.

### 9.5 Kein globaler Timewarp im Multiplayer

Globaler Timewarp ist im Multiplayer verboten, weil er alle Spieler zwingen wuerde, dieselbe Zeitbeschleunigung zu erleben. Das passt nicht zu Basenbau, Bodenspiel, Docking, Handel, Kampf und Drohnensteuerung.

Im Singleplayer kann ein zusaetzlicher globaler Komfort-Timewarp spaeter optional diskutiert werden, aber fuer dieses System ist er nicht die Basis. Die Basis bleibt objektgebundener Warp, damit Drohnen, Schiffe und spaeter Koop/Multiplayer konsistent bleiben.

Erlaubt ist nur:

- objektgebundener Warp,
- autorisierte lokale Missionszeit,
- geplante Autopilot-Ausfuehrung,
- sofortiger Rueckfall in Realzeit bei Interaktionsgefahr.

## 10. Intercepts durch Spieler, Drohnen und PvE-Gegner

Interception soll moeglich bleiben. Ein warpendes Schiff darf nicht unangreifbar werden.

### 10.1 Grundidee

Wenn ein anderes Schiff oder eine Drohne eine realistische Abfangbahn hat, wird ein Intercept-Ereignis erzeugt. Beide Seiten verlassen rechtzeitig den Warp, bevor echte Interaktion stattfindet.

Ablauf:

1. Schiff A ist im Warp auf Autopilot-Kurs.
2. Schiff B, Drohne B oder PvE-Gegner B berechnet eine moegliche Abfangbahn.
3. Die Simulationsautoritaet prueft, ob die Abfangbahn realistisch ist: Delta-v, Zeit, Sensorreichweite, Zielprognose, Treibstoff.
4. Wenn ja, wird ein Intercept-Fenster gesetzt.
5. Schiff A wird vor dem Intercept aus Warp geholt.
6. Schiff B wird ebenfalls auf Realzeit gezwungen, falls es im Warp war.
7. Beide sind danach in normaler Physik und koennen manuell, per Autopilot oder im Kampf weiteragieren.

### 10.2 Keine Instant-Interdiction ohne Physik

Ein Intercept darf kein magischer Knopf sein. Das abfangende Objekt muss wirklich in der Lage sein, in die Naehe zu kommen.

Voraussetzungen:

- Ziel wurde entdeckt oder die Route ist bekannt/erraten.
- Abfangschiff hat genug Delta-v.
- Abfangschiff kann den Intercept-Punkt zeitlich erreichen.
- Sensor-/Kommunikationsverzoegerung und Zielunsicherheit koennen spaeter dazukommen.
- Die Simulationsautoritaet kann eine plausible Begegnung in Realzeit herstellen.

### 10.3 Intercept-Sicherheitsradius

Warp endet nicht erst bei Kollisionsdistanz. Er endet deutlich frueher.

Beispielwerte als Konzept:

| Situation | Warp-Exit-Distanz |
| --- | ---: |
| Spieler-Schiff gegen Spieler-Schiff | 500-2,000 km |
| Drohne gegen Spieler-Schiff | 100-1,000 km |
| PvE-Gegner gegen Spieler | 500-5,000 km |
| Basis-/Stationsnaehe | 1,000-10,000 km |
| Planet SOI / hoher Orbit | planetenabhaengig, deutlich vor Atmosphaere |

Die Werte sollen gross genug sein, damit kein Objekt aus Warp direkt in ein anderes Objekt hineinfaellt.

## 11. Kollisionen und Schaden

Waehrend Warp duerfen keine direkten Kollisionen mit aktiven Spielern, Basen oder bemannten Schiffen aufgeloest werden. Stattdessen muss Warp vorher enden.

Regeln:

- Kollisionsprognose hat Prioritaet vor Komfort.
- Ein Warp-Schiff darf niemals durch eine aktive Multiplayer-Interaktionszone tunneln.
- Continuous Collision Detection allein reicht bei hohen Warp-Faktoren nicht; die Simulationsautoritaet braucht Bahnsegment-Pruefungen.
- Bei unklarer Prognose wird Warp vorsichtshalber beendet.
- Rammen im Warp ist nicht erlaubt. Wer rammen will, muss in Realzeit nahe genug kommen.

Im Singleplayer gelten diese Regeln ebenfalls fuer Planeten, Basen, Stationen, Drohnen, PvE-Gegner und eigene Schiffe. Es soll keine Situation geben, in der ein lokaler Timewarp durch Objekte tunnelt und danach einen kaputten Spielzustand erzeugt.

## 12. Drohnen und unbemannte Schiffe

Drohnen sind ein Hauptgrund fuer objektgebundenen Warp.

### 12.1 Drohnen duerfen autonom warpen

Eine Drohne darf warpen, wenn:

- sie einen validen Autopilot-Plan hat,
- sie nicht in einer Safety Bubble startet,
- sie nicht in eine Safety Bubble eintritt,
- keine realistische Interaktion bevorsteht,
- die Simulationsautoritaet den Pfad validieren kann.

### 12.2 Drohnenstatus fuer den Besitzer

Der Besitzer sieht nicht die ganze Spielzeit schneller, sondern bekommt Statusdaten:

- aktuelle Mission,
- ETA in Realzeit,
- lokale Missionszeit der Drohne,
- Warp-Faktor,
- Treibstoffprognose,
- naechster Burn,
- Risiken,
- automatische Warp-Exit-Gruende.

Beispiel:

```text
Drone A-17
Mission: Transfer to Eber Belt
State: Warp Coast 100x
Real ETA: 04:20
Drone Mission Time Remaining: 18 days
Next Event: Mid-course correction in 90 seconds real time
Risk: Clear corridor
```

### 12.3 Drohnen duerfen nicht unverwundbar sein

Wenn eine Drohne durch von Spielern kontrollierten Raum fliegt, soll sie abfangbar sein. Warp endet vor Interaktion. Danach gelten normale Sensor-, Kampf-, Flucht- und Autopilotregeln.

Im Singleplayer bedeutet das: Auch PvE-Fraktionen und eigene Verteidigungsdrohnen koennen ein Intercept-Fenster ausloesen, wenn sie physikalisch dazu in der Lage sind.

## 13. PvE und KI-Gegner

PvE-Gegner muessen dieselben Regeln befolgen wie Spieler und Drohnen.

- KI-Schiffe koennen warpen, wenn sie eine plausible Route haben.
- KI-Schiffe koennen Spieler oder Drohnen intercepten, wenn Delta-v und Position passen.
- KI-Schiffe duerfen nicht im Warp in Spieler hineinrammen.
- KI-Schiffe werden vor Kampfkontakt auf Realzeit gezwungen.
- Schwierigkeit entsteht durch bessere Planung, Sensorik und Flottenkoordination, nicht durch Regelbruch.

## 14. Technische Architektur

### 14.1 Komponenten

Empfohlene spaetere Komponenten:

| Komponente | Aufgabe |
| --- | --- |
| `AutopilotPlan` | Datenmodell fuer Route, Segmente, Burns, Exit-Punkte und Safety-Pruefungen. |
| `WarpController` | Verwaltet Warp-Zustand, Faktor, Start/Stop, lokale Missionszeit und Autoritaetsfreigabe. |
| `TrajectoryPredictor` | Berechnet Position, Geschwindigkeit und Risiken entlang der Route. |
| `SafetyBubbleRegistry` | Kennt Spieler, Basen, Stationen, Planeten, Monde, aktive Kampfzonen und Sperrzonen. |
| `InterceptSolver` | Prueft, ob andere Objekte realistisch in die Route eingreifen koennen. |
| `IWarpAuthority` | Gemeinsame Schnittstelle fuer Singleplayer, Host und Server. |
| `LocalWarpAuthority` | Singleplayer-Implementierung im lokalen Spielprozess. |
| `ServerWarpAuthority` | Multiplayer-Implementierung mit Netzwerkautoritaet und Reconciliation. |
| `WarpTelemetry` | UI-/Debugdaten: Faktor, ETA, naechster Exit, Grund fuer Reduktion, Risiko. |

### 14.2 Zustandsmaschine

```text
Idle
  -> Planning
  -> AwaitingAuthorityApproval
  -> WarpActive
  -> WarpReducing
  -> WarpExitPending
  -> RealTimeControl
  -> ReplanRequired
```

Wichtige Zustaende:

- `Planning`: Autopilot baut Route.
- `AwaitingAuthorityApproval`: WarpController fragt lokale oder Netzwerk-Autoritaet.
- `WarpActive`: objektgebundene beschleunigte Simulation.
- `WarpReducing`: Faktor wird wegen Naehe/Risiko reduziert.
- `WarpExitPending`: sauberer Rueckfall an definiertem Zustand.
- `RealTimeControl`: normale Physik und normale Interaktion.
- `ReplanRequired`: Warp wurde beendet, weil Plan ungueltig ist.

### 14.3 Daten, die beim Exit konsistent sein muessen

Beim Warp-Exit muss die Autoritaet einen vollstaendigen Realzeit-Zustand liefern:

- Weltposition oder lokaler Referenzframe,
- Geschwindigkeit relativ zum aktuellen gravitativen Frame,
- Rotation und Angular Velocity,
- Masse und Treibstoff,
- aktive Systeme,
- Temperatur/Heat,
- Schaden,
- Cargo,
- Autopilot-Restplan,
- letzter sicherer Segmentstatus.

## 15. UI/Spielergefuehl

Timewarp soll sich nicht wie ein Ladebildschirm oder Teleport anfuehlen.

Moegliche UI-Elemente:

- Warp-Faktor-Anzeige: `Warp 50x`.
- Klare ETA: Realzeit und Missionszeit getrennt anzeigen.
- Autopilot-Segmente: `Burn`, `Coast`, `Correction`, `Brake`, `Approach`.
- Warnchips: `PLAYER PROXIMITY`, `BASE SAFETY`, `INTERCEPT WINDOW`, `PLAN INVALID`, `FUEL MARGIN LOW`.
- Button: `Abort Warp`.
- Automatische Ansage beim Exit: `Warp ended: possible intercept`, `Warp ended: approaching Hestia SOI`, `Warp ended: station safety zone`.

Wichtig: Wenn der Spieler auf einem Planeten steht und eine Drohne warpt, darf die Umgebung nicht schneller werden. Nur die Drohnen-UI zeigt beschleunigte Mission.

## 16. Erste Prototyp-Stufe

Fuer den Anfang reicht ein stark vereinfachtes Modell:

1. Nur Autopilot-Coast-Segmente duerfen warpen.
2. Keine Warp-Nutzung bei Docking, Landung, Atmosphaere oder niedrigem Orbit.
3. Harte Safety Bubble um Spieler, Zielstationen, Planeten und grosse Asteroiden.
4. `IWarpAuthority` wird von Anfang an eingefuehrt.
5. Im Singleplayer wird zuerst `LocalWarpAuthority` implementiert.
6. Im Multiplayer kann spaeter `ServerWarpAuthority` dieselbe Schnittstelle uebernehmen.
7. Die Simulationsautoritaet prueft alle 1-2 Sekunden Realzeit den naechsten Bahnabschnitt.
8. Beim Risiko sofortiger Exit auf 1x.
9. Drohnen bekommen dieselbe Logik wie Spielerschiffe.
10. Intercept-Prototyp zuerst nur als vorhergesagte Naehe zu einem anderen Schiff, spaeter mit echtem Delta-v-Solver.

## 17. Offene Designfragen

- Welche maximalen Warp-Faktoren fuehlen sich im Startsystem gut an?
- Wie gross muessen Safety Bubbles sein, damit Intercepts fair bleiben, ohne Reisen zu oft zu unterbrechen?
- Soll der Besitzer einer Drohne Warp manuell abbrechen koennen, auch wenn er weit entfernt am Boden ist?
- Wie stark sollen Sensorreichweite und Zielunsicherheit Intercepts beeinflussen?
- Sollen Drohnen im Offline-/nicht sichtbaren Zustand hoeher warpen duerfen als bemannte Schiffe?
- Wie werden Kommunikationsverzoegerungen zwischen Planeten spaeter behandelt?
- Wird Warp in Lore als Bordcomputer-Zeitkompression erklaert oder bleibt es rein als Gameplay-Komfortsystem sichtbar?
- Soll ein optionaler globaler Singleplayer-Komfort-Timewarp spaeter existieren, oder bleibt alles strikt objektgebunden?

## 18. Kurzfazit

Das geplante Navigationssystem nutzt als Basis keinen globalen Timewarp. Stattdessen bekommt jedes Schiff oder jede Drohne einen eigenen autorisierten Warp-Zustand. Der Autopilot plant eine physikalisch gueltige Route, und nur die lokale Missionszeit dieses Objekts wird beschleunigt. Im Singleplayer uebernimmt eine lokale `LocalWarpAuthority` diese Entscheidungen, im Multiplayer eine Server-/Host-Autoritaet. Sobald Interaktion relevant wird, endet Warp automatisch. Dadurch bleiben lange Distanzen spielbar, waehrend Realismus, Multiplayer-Fairness, Intercepts, Kollisionen und physikalische Zustandskontinuitaet erhalten bleiben.
