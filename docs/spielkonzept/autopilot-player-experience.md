# Spielkonzept: Autopilot Player Experience

Stand: 2026-06-14
Status: Player-facing Konzeptbasis fuer Weltraum-Spiel, noch keine finale Implementierung
Bezug: Navigation Computer, Player Map and HUD, Autopilot-Timewarp, lokale Direktfluege, spaetere gravitationsbasierte Routen.

## 1. Ziel

Dieses Dokument definiert, wie sich der Autopilot aus Spielersicht anfuehlen soll. Es beschreibt nicht den finalen Code, keine konkreten Testfaelle, keine Szenen und keine Assets. Es ist ein Erlebnisvertrag: Wenn der Spieler dem Schiff ein Ziel gibt, muss das Spiel klar zeigen, was passieren wird, warum es funktionieren kann oder warum es nicht funktionieren kann.

Leitsatz:

> **Ein guter Autopilot ist schnell, vorhersehbar, lesbar und praezise.**

Der Autopilot soll sich nicht wie ein magischer Zielradius anfuehlen, sondern wie ein kompetenter Navigationsoffizier: Er plant offen, fliegt entschlossen, korrigiert sichtbar und sagt ehrlich Bescheid, wenn Schiff, Treibstoff, RCS, Zeit oder Risiko nicht ausreichen.

## 2. Spielerabsicht

Der typische Ablauf beginnt mit einer klaren Zielauswahl:

1. Der Spieler waehlt einen Zielpunkt auf Karte, HUD, System Map oder Local Map.
2. Das Ziel ist ein praeziser Punkt oder ein klar definierter Zielzustand, nicht nur eine grobe Richtung.
3. Der Navigation Computer berechnet eine Route.
4. Die UI zeigt dem Spieler, was der Autopilot vorhat.
5. Der Spieler akzeptiert, startet, pausiert, ueberschreibt oder verwirft den Plan.

Der Zielpunkt kann frei gesetzt sein, an ein Objekt gebunden sein oder aus einer Mission stammen. Entscheidend ist: Sobald der Spieler einen Punkt als Ziel bestaetigt, schuldet der Autopilot dem Spieler eine praezise Ankunft an genau diesem Punkt oder eine ehrliche Begruendung, warum das nicht moeglich ist.

## 3. Was die UI vor dem Start zeigen muss

Vor dem Start darf der Autopilot nicht nur einen Knopf "Go" anbieten. Der Spieler braucht eine lesbare Vorschau.

Pflichtinformationen:

- geplante Route.
- ETA.
- erwarteter Treibstoffverbrauch.
- verbleibende Treibstoffreserve.
- Risikoabschaetzung.
- erwartete Ankunftsgenauigkeit.
- relevante Hindernisse oder Sicherheitszonen.
- benoetigte Schiffautoritaet fuer Haupttriebwerk, Rotation, Gimbal und RCS.
- Grund, falls der Plan nicht sicher oder nicht ausfuehrbar ist.

Beispiel:

```text
AUTOPILOT PLAN
Target: Map Point A-17
Route: Direct burn, flip, brake, RCS correction
ETA: 00:01:42
Fuel: 3.8% planned, 61% reserve
Risk: Low
Expected arrival accuracy: <= 0.5 m
Authority: OK
```

Wenn der Plan nicht ausfuehrbar ist, muss die UI das klar sagen:

```text
AUTOPILOT BLOCKED
Target: Map Point A-17
Reason: RCS authority insufficient for final correction
Expected miss distance: 7.4 m
Suggested action: reduce mass, repair RCS, choose slower approach, or fly manually
```

## 4. Direktflug im lokalen Raum

Fuer lokale Direktfluege soll der schnellste plausible Weg meistens energisch wirken:

1. Das Schiff richtet sich auf die geplante Beschleunigungsrichtung aus.
2. Es beschleunigt hart.
3. Es dreht oder flippt fuer die Bremsphase.
4. Es bremst entschlossen.
5. Es nutzt praezise RCS-Korrekturen fuer die finale Punktankunft.
6. Es geht erst in Abschluss/Hold, wenn der Zielpunkt wirklich erreicht ist.

Aus Spielersicht darf dieser Flug aggressiv sein, solange er kontrolliert und erklaerbar bleibt. Ein schnelles Burn-Flip-Brake-Profil ist gut, wenn die UI vorher zeigt, dass genau dieses Profil geplant ist und welche Genauigkeit am Ende erwartet wird.

Wichtig: Der Autopilot soll nicht nach dem Bremsen ungeordnet zwischen Beschleunigen, Reacquire und Bremsen flattern. Wenn ein Reacquire noetig ist, muss er wie eine geplante Korrektur wirken, nicht wie Panik.

## 5. Hindernisse und Reacquire

Wenn Hindernisse im Weg liegen, darf die Route von der direkten Linie abweichen. Das ist kein Fehler, solange der Spieler versteht, warum.

Moegliche Phasen:

- Direct burn.
- Avoidance planning.
- Avoidance burn.
- Safe corridor coast.
- Reacquire direct path.
- Brake.
- Final RCS correction.
- Hold at exact target point.

Die Route darf um ein Hindernis herumfuehren und danach den Zielpunkt neu anfliegen. Der Autopilot darf aber nicht so tun, als waere eine grobe Naehe zum Ziel ausreichend. Auch mit Avoidance und Reacquire bleibt das Ziel ein exakter Punkt.

Wenn Hindernisvermeidung die geplante Genauigkeit gefaehrdet, muss die UI das vor oder waehrend des Fluges sagen:

```text
ROUTE UPDATED
Reason: obstacle corridor
New phase: Reacquire direct path
ETA change: +00:00:18
Expected arrival accuracy: <= 0.8 m
```

## 6. Zukuenftige Gravitation und Slingshot-Routen

Spaetere Routen mit Gravitation, Orbits, Flybys oder Slingshots duerfen anders aussehen als ein lokaler Bang-Bang-Transfer.

Sie koennen enthalten:

- mehrere Burns.
- Coast-Segmente.
- Kurskorrekturfenster.
- Flybys.
- Gravity assists.
- SOI-Transitions.
- lange Wartezeiten bis zum Transferfenster.
- finale Rendezvous- oder Approach-Segmente.

Diese Routen sind nicht auf eine einzige Beschleunigen-Flip-Bremsen-Sequenz beschraenkt. Wichtig ist nur, dass sie fuer den Spieler nachvollziehbar bleiben: Segmentliste, ETA, Treibstoff, Risiko, Genauigkeit und naechster Schritt muessen sichtbar sein.

## 7. Abschlussbedingung: Punktankunft

Completion bedeutet praezise Punktankunft, nicht vage Radiusankunft.

Der Autopilot darf einen Flug erst als abgeschlossen melden, wenn:

- die Position am Zielpunkt innerhalb der kommunizierten Ankunftsgenauigkeit liegt.
- die Restgeschwindigkeit fuer den Zielzustand akzeptabel ist.
- das Schiff kontrollierbar bleibt.
- keine versteckte Drift den Spieler sofort wieder vom Ziel wegtraegt.
- die UI den Status als erreicht, gehalten oder bewusst manuell uebergeben erklaert.

Ein grosser unsichtbarer Zielradius ist fuer das Spielerlebnis falsch. Er fuehlt sich unzuverlaessig an, besonders bei Docking, Mining, Drohnenrendezvous, engen Hinderniskorridoren und spaeteren Orbitalzielen.

Wenn das Spiel aus technischen Gruenden eine Toleranz braucht, muss sie klein, sichtbar und ehrlich sein:

```text
ARRIVED
Target error: 0.3 m
Relative speed: 0.02 m/s
Status: Holding target point
```

## 8. Unzureichende Schiffautoritaet

Der Autopilot darf Erfolg nicht vortaeuschen, wenn das Schiff die benoetigte Autoritaet nicht hat.

Moegliche Gruende:

- zu wenig Treibstoff.
- zu wenig Haupttriebwerksschub.
- zu wenig RCS-Schub.
- unzureichende Rotationskontrolle.
- zu hohe Masse.
- beschaedigtes Triebwerk.
- beschaedigte RCS-Duesen.
- Ziel liegt hinter einem Hindernis ohne sicheren Korridor.
- Bremsweg reicht nicht.
- geplante Ankunftsgenauigkeit kann nicht erreicht werden.

Die UI soll klar zwischen Warnung, Risiko und Blocker unterscheiden:

```text
WARNING
Fuel reserve after arrival: 4%
Plan can run, but emergency margin is low
```

```text
BLOCKED
Main engine can reach target, but RCS cannot perform final point correction
Autopilot cannot guarantee exact arrival
```

Spieler sollen dadurch lernen, welche Schiffsteile fuer gute Navigation wichtig sind. Ein langsames, schweres, schlecht gewartetes Schiff darf schlechte Autopilot-Optionen haben, aber das Spiel muss das offen erklaeren.

## 9. Manual Override

Der Spieler bleibt immer Autoritaet ueber das eigene Schiff.

Grundregeln:

- Jede manuelle Steuerung muss den Autopilot sichtbar pausieren, ueberstimmen oder in einen Assist-Modus wechseln.
- Der Autopilot darf nicht heimlich gegen klare Spielereingaben arbeiten.
- Nach einem Override muss die UI sagen, ob der alte Plan noch gueltig ist.
- Wenn der Spieler den Kurs stark veraendert, muss der Plan neu berechnet oder verworfen werden.
- Ein Not-Abbruch muss jederzeit moeglich sein, solange das Schiff physikalisch reagieren kann.
- Nach manuellem Eingriff darf der Autopilot erst wieder praezise Ziele versprechen, wenn ein neuer validierter Plan existiert.

Beispielzustaende:

```text
AUTOPILOT PAUSED
Reason: manual translation input
Plan status: recoverable
Action: release controls to resume or recalculate route
```

```text
AUTOPILOT DISENGAGED
Reason: manual burn changed trajectory
Plan status: invalid
Action: calculate new route
```

Manual override soll sich fair anfuehlen: Der Spieler darf eingreifen, ohne gegen das System zu kaempfen. Gleichzeitig soll klar sein, wann der Autopilot dadurch seine urspruengliche Garantie verliert.

## 10. Was guter Autopilot fuer Gameplay bedeutet

Ein guter Autopilot macht Raumfahrt nicht trivial. Er macht sie spielbar.

Er ist schnell:

- Er nutzt Schiffskapazitaeten entschlossen.
- Er vermeidet unnoetiges Bummeln.
- Er waehlt fuer einfache lokale Direktfluege oft harte Beschleunigung, Flip, Bremsung und RCS-Feinkorrektur.

Er ist vorhersehbar:

- Der Spieler sieht vor dem Start, was passieren wird.
- Phasenwechsel sind nachvollziehbar.
- ETA, Fuel und Risiko veraendern sich sichtbar, wenn die Route neu geplant wird.

Er ist lesbar:

- Die UI zeigt Route, naechsten Schritt und Grund fuer Warnungen.
- Hindernisvermeidung und Reacquire wirken geplant.
- Fehler werden als Ursachen erklaert, nicht als diffuse Autopilot-Laune.

Er ist praezise:

- Zielpunkte bedeuten Zielpunkte.
- Completion ist genaue Ankunft, nicht grobe Naehe.
- RCS-Korrektur ist ein sichtbarer Teil der Qualitaet, nicht ein versteckter Nachgedanke.

Der Autopilot soll Vertrauen aufbauen. Wenn er startet, soll der Spieler denken: "Ich weiss, was das Schiff vorhat." Wenn er blockiert, soll der Spieler denken: "Ich weiss, was meinem Schiff fehlt." Wenn er ankommt, soll der Spieler sehen: "Das war genau der Punkt, den ich gewaehlt habe."

## 11. Nicht-Ziele dieses Dokuments

Diese Datei definiert nicht:

- konkrete Controller- oder Tastaturbelegung.
- exakte UI-Farben.
- konkrete Toleranzwerte fuer alle Zieltypen.
- finale Physikimplementierung.
- konkrete Unity-Komponenten.
- PlayMode- oder EditMode-Testfaelle.
- Szenenaufbau oder Asset-Anforderungen.

Sie definiert die Spielerperspektive, gegen die spaetere Implementierung, UI und Tests bewertet werden koennen.
