# Spielkonzept: Starter-Sonnensystem

Stand: 2026-05-27  
Status: Konzeptbasis fuer Weltraum-Spiel, noch keine finale Implementierung  
Quelle: Nutzer-Transkript `Optimal Planet and Solar System.docx` als Inspirationsbasis fuer Hestia.

## 1. Ziel des Dokuments

Dieses Dokument legt das erste spielbare Sonnensystem als Konzept- und Datengrundlage fest. Es soll nicht sofort grafisch final umgesetzt werden. Die Koerper sollen physikalisch plausibel und in Realgroesse beschrieben werden, waehrend die erste Unity-Implementierung mit simplen Kugel-Meshes, einfachen Materialien, Orbitlinien und Platzhaltertexturen arbeiten darf.

Kernziele:

- Ein orangefarbener, langlebiger K-Zwerg als ruhiger Zentralstern.
- 7 realistische Planeten mit realen Groessen-, Massen-, Gravitations- und Orbitwerten.
- Nur ein Planet mit Leben: Hestia, eine superhabitable Supererde nach dem Transkript.
- Innere Planeten werden zur Sonne hin heisser; aeussere Planeten werden kalt, gas-/eisreich und mondreich.
- Ein Asteroidenguertel zwischen inneren Felsplaneten und Gasriesen.
- Spaetere Raumstationen auf oder nahe groesseren Asteroiden sind von Anfang an im Konzept vorgesehen.
- Gravitation soll nicht frei erfunden sein, sondern aus Masse bzw. `mu = G * M` abgeleitet werden.

## 2. Physikalische Grundregeln fuer das System

Die Werte in diesem Dokument sind Designwerte, aber sie sollen wie echte astronomische Daten behandelt werden.

- Laengen: Kilometer fuer Planetendurchmesser, AU fuer Orbitabstaende, Meter fuer Physik.
- Masse: Erdmassen fuer Lesbarkeit, Kilogramm bzw. Gravitationsparameter `mu` fuer Simulation.
- Oberflaechengravitation: `g = G * M / R^2`, relativ zu Erde und in m/s² dokumentiert.
- Orbitzeiten: Kepler-nahe Kreisbahnen als Startpunkt. Exzentrizitaet kann spaeter pro Planet leicht erhoeht werden.
- Rendering-Skalierung: Die Welt darf visuell skaliert werden, aber die Quelldaten bleiben real.
- Gameplay-Physik: Schiffe sollen spaeter in lokalen Floating-Origin-Frames fliegen; Orbitkarte und lokale Nahbereiche duerfen unterschiedliche Darstellungsmasstaebe nutzen.

Empfohlene technische Trennung:

- `CelestialBodyDefinition`: echte Daten, Name, Radius, Masse, `mu`, Atmosphaere, Rotation, Orbit.
- `CelestialBodyVisualProfile`: Mesh, Material, Texturen, Wolken, Ringe, Platzhalterfarben.
- `OrbitRuntimeState`: berechnete Position, Geschwindigkeit, Ephemeridenzeit.
- `GravitySource`: Punktmassen-Gravitation auf Basis von `mu`; spaeter Sphere-of-Influence oder N-Body-Option.

## 3. Systemuebersicht

Arbeitstitel des Systems: **Aurelia-System**  
Zentralstern: **Aurelia**, stabiler K-Zwerg / orange dwarf  
Alter: ca. 3 Milliarden Jahre  
Charakter: ruhige galaktische Nachbarschaft, wenig aggressive Strahlung, sehr lange stabile Lebensdauer

Das System ist fuer das Startgebiet gedacht: Der Spieler soll anfangs mit Raumfahrt, Gravitation, Navigation, Asteroiden, Ressourcen und spaeter Stationen vertraut werden. Hestia ist der biologische und visuelle Anker des Systems, aber nicht zwingend der erste Ort, an dem der Spieler landen muss.

## 4. Zentralstern: Aurelia

| Eigenschaft | Wert | Designgrund |
| --- | ---: | --- |
| Sterntyp | K4V / orange dwarf | Langlebig, stabiler als viele rote Zwerge, weniger kurzlebig als sonnenaehnliche G-Sterne |
| Masse | 0.78 Sonnenmassen | Erlaubt kompakteres, aber plausibles Planetensystem |
| Radius | 0.75 Sonnenradien | Kleiner als die Sonne, sichtbar orange und ruhig |
| Leuchtkraft | 0.36 Sonnenleuchtkraefte | Hestia liegt bei 0.60 AU ungefaehr bei Erd-Sonnenfluss |
| Effektive Temperatur | ca. 5000 K | Warmes orange-goldenes Licht |
| Alter | 3.0 Milliarden Jahre | Genug Zeit fuer komplexe Evolution auf Hestia |
| Erwartete stabile Hauptreihenzeit | mehrere zehn Milliarden Jahre | Das System ist nicht kurz vor dem Ende |
| Gravitationsparameter `mu` | ca. `1.035e20 m³/s²` | Fuer Orbitberechnung |

Visueller Stil:

- Sternfarbe: warmes Orange/Gold, nicht rot.
- Licht auf Hestia: weicher und waermer als Sonnenlicht.
- Pflanzen auf Hestia tendieren zu dunklen Gruen-, Blaugruen-, Violett- und fast schwarzen Toenen, weil sie mehr Licht einfangen sollen.

## 5. Planetenliste in Realgroesse

Alle Radien und Massen sind Konzeptwerte. Die Oberflaechengravitation ist daraus abgeleitet.

| # | Name | Orbit | Jahr | Radius | Durchmesser | Masse | `mu` | Oberflaechen-g | Sonnenfluss | Kurzprofil |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| I | Korus | 0.16 AU | 26 Tage | 2,421 km | 4,842 km | 0.055 M_E | `2.19e13` | 0.38 g / 3.74 m/s² | 14.06 x Erde | Metallreicher Glutplanet, Merkur-Analog |
| II | Pyra | 0.31 AU | 71 Tage | 6,052 km | 12,105 km | 0.82 M_E | `3.27e14` | 0.91 g / 8.91 m/s² | 3.75 x Erde | Heisser Treibhaus-Felsplanet, Venus-Analog |
| III | Hestia | 0.60 AU | 192 Tage | 8,282 km | 16,565 km | 2.03 M_E | `8.09e14` | 1.20 g / 11.78 m/s² | 1.00 x Erde | Superhabitable Supererde, einziger Lebensplanet |
| IV | Tharos | 0.95 AU | 383 Tage | 3,695 km | 7,390 km | 0.12 M_E | `4.78e13` | 0.36 g / 3.50 m/s² | 0.40 x Erde | Kalter, trockener Felsplanet, Mars-Analog |
| V | Aureon | 3.00 AU | 5.9 Jahre | 68,807 km | 137,614 km | 210 M_E | `8.37e16` | 1.80 g / 17.66 m/s² | 0.04 x Erde | Gasriese mit grossem Mondsystem |
| VI | Nereion | 6.40 AU | 18.3 Jahre | 25,484 km | 50,968 km | 15 M_E | `5.98e15` | 0.94 g / 9.19 m/s² | 0.009 x Erde | Eisriese |
| VII | Umbra | 11.50 AU | 44.2 Jahre | 22,298 km | 44,597 km | 9 M_E | `3.59e15` | 0.73 g / 7.20 m/s² | 0.003 x Erde | Aeusserer Eisriese/Sub-Neptun |

`M_E` = Erdmasse. `mu` ist in m³/s² angegeben.

## 6. Planet III: Hestia, der Starter-Lebensplanet

Hestia ist der wichtigste Planet des Startsystems und die direkte Ausarbeitung des Transkript-Konzepts. Sie ist kein zweites Earth-like-Klischee, sondern eine ueberfruchtbare, laute, feuchte, dunkelvegetative Archipel-Supererde.

### 6.1 Physische Basisdaten

| Eigenschaft | Wert |
| --- | ---: |
| Typ | Superhabitable Supererde |
| Radius | 1.30 Erdradien / 8,282 km |
| Durchmesser | 16,565 km |
| Masse | 2.03 Erdmassen / ca. `1.21e25 kg` |
| Oberflaechengravitation | 1.20 g / 11.78 m/s² |
| Fluchtgeschwindigkeit | ca. 14.0 km/s |
| Orbit um Aurelia | 0.60 AU |
| Jahr | ca. 192 Erdtage |
| Tageslaenge | 36 Erdstunden |
| Lokale Tage pro Hestia-Jahr | ca. 128 |
| Achsneigung | 10° als Startwert |
| Atmosphaerendruck | ca. 1.45 bar |
| Durchschnittstemperatur | ca. Erde + 5 °C, aber durch Feuchtigkeit gepuffert |
| Magnetfeld | stark, stabil, durch grossen metallischen Kern |
| Plattentektonik | aktiv, viele kleine Platten |
| Ozeantiefe | meist 100-200 m auf riesigen Schelfmeeren |

### 6.2 Orbit, Klima und Jahreszeiten

Hestia liegt so, dass sie ungefaehr so viel Sternenergie bekommt wie die Erde von der Sonne. Die zusaetzliche Waerme entsteht vor allem durch die dichtere Atmosphaere, mehr Treibhausgase, viel Wasserdampf und sehr aktive Ozean-/Wolkenkreisläufe.

Designregeln:

- Keine globalen Eisregionen als dominante Biome.
- Keine echten Grosswuesten: Land ist stark zerschnitten, immer nahe an Salz- oder Suesswasser.
- Jahreszeiten sollen mild sein, aber fuer Migration, Brutzeiten, Sturmzeiten und evolutionaeren Druck reichen.
- Tropische und subtropische Bedingungen dominieren fast den gesamten Planeten.
- Stuerme sind haeufig, weil flache Ozeane schneller Energie aufnehmen und abgeben.
- Feuerkatastrophen bleiben selten global zerstoererisch, weil Luftfeuchte und Regen sehr hoch sind.

### 6.3 Geologie und Landformen

Hestia besitzt viele fragmentierte Kontinentalplatten. Dadurch entstehen keine riesigen Megakontinente, sondern:

- einige Dutzend kleine bis mittelgrosse Kontinente,
- Millionen Inseln aller Groessen,
- sehr lange Inselboegen,
- sehr viele Vulkan- und Gebirgsketten,
- unzaehlige Kuesten, Lagunen, Fjord-/Riffsysteme und Brackwasserzonen,
- Hochplateaus mit feuchten Nebelwaeldern und Pilz-/Flechtenwaeldern,
- kaum trockene Binnenraeume, weil jedes Landgebiet nahe an Wasser liegt.

Wichtig fuer Level- und Planetendesign:

- Die Karte soll nicht wie Erde mit ein paar grossen Kontinenten aussehen.
- Von Orbit aus sieht Hestia wie ein blaugruener, wolkenreicher Splitterplanet aus: sehr viel Kuestenlinie, Inselketten, flache Meere, Riffe.
- Der Planet darf auf den ersten Blick paradiesisch wirken, soll aber fremd, ueberwuchert und biologisch aggressiv sein.

### 6.4 Ozeane

Hestias Ozeane sind nicht extrem tief wie die irdischen Tiefsee-Becken. Der groesste Teil liegt im sonnenbeschienenen Bereich.

Ozeanregeln:

- Wasserbedeckung: hoch, aber nicht komplett; Zielbereich 65-72 %.
- Durchschnittliche Tiefe: deutlich geringer als Erde.
- Dominierende Tiefe: 100-200 m Schelfmeer.
- Tiefsee: selten, in tektonischen Graben- und Subduktionszonen.
- Fast der gesamte Meeresboden kann Photosynthese oder vergleichbare Licht-Oekologie tragen.
- Korallen-/Riffstrukturen koennen kilometerhoch wirken, sollen aber geologisch und biologisch als lebende Megacity-Riffe konzipiert sein.
- Kelp-, Algen- und Schwammwaelder sind riesige marine Waelder, nicht nur Deko.

Visuelle Signatur:

- Flache tuerkis-blaue Meere.
- Dunkle Riffadern und helle Sand-/Kalkplateaus.
- Riesige lebende Riffstaedte, die aus dem Orbit als Muster sichtbar sein koennen.
- Viele Kuestenlinien und Inselringe.

### 6.5 Atmosphaere und Himmel

Hestia hat eine deutlich dichtere Atmosphaere als die Erde.

Startwerte:

| Gas / Faktor | Konzeptwert |
| --- | ---: |
| Gesamtdruck | 1.45 bar |
| Stickstoff/inerte Gase | ca. 68-70 % |
| Sauerstoff | ca. 27 % |
| CO2 | deutlich hoeher als Erde, Startwert 800-1200 ppm |
| Wasserdampf | hoch und regional stark schwankend |
| Wolkenbedeckung | hoch, mehrschichtig |

Designfolgen:

- Flug ist fuer Tiere energetisch guenstiger als auf der Erde.
- Viele voneinander unabhaengige Tierlinien entwickeln Flug, Gleiten, Schweben oder luftbasierte Lebensweisen.
- Laute Akustik: dichtere Luft traegt Schall besser; Hestia ist kein stiller Planet.
- Tiere koennen mit Richtungstaeuschung, Schallmaskierung, Echojagd und lautem Balz-/Warnverhalten arbeiten.
- Fuer Menschen/Spieler ist Hestia ohne Ausruestung nicht automatisch angenehm: hoher Druck, hoher Sauerstoffanteil, fremde Biochemie, Allergene/Sporen und extreme biologische Aktivitaet sind Risiken.

### 6.6 Biosphaere

Hestia ist der einzige natuerlich belebte Planet im Startsystem. Die Biosphaere soll sich nicht wie ein einzelnes Biom anfuehlen, sondern wie ein Planet, auf dem fast jede Oberflaeche besiedelt ist.

Leitideen:

- Biomasse und Biodiversitaet liegen weit ueber Erde.
- Kein einzelnes dominantes Pflanzenmodell: baumartige, pilzartige, korallenartige und moos-/flechtenartige Linien koexistieren.
- Viele Pflanzen sind dunkel, fast schwarzgruen, blaugruen, violett oder rotbraun.
- Inselisolation erzeugt viele lokale Spezialarten.
- Grosse Insekten-/Arthropoden-Analoge sind plausibel, weil mehr Sauerstoff und dichterer Luftdruck vorhanden sind.
- Fliegende Makrofauna ist eine Hauptsignatur: Schwarmtiere, Skywhales, gleitende Raeuber, segelnde Pflanzen-Sporentraeger.
- Die Ozeane sind nicht Hintergrund, sondern der groesste aktive Lebensraum.

Beispiel-Biome fuer spaetere Inhalte:

1. **Dunkelwald-Inselboegen**: sehr dichter, fast schwarzer Bewuchs, laute Fauna, feuchte Luft.
2. **Riff-Megacities**: lebende marine Gebilde, Labyrinth aus Riffen, Schwammkuppeln, Algenbruecken.
3. **Nebelhochplateaus**: Pilz-/Flechtenwaelder, gepanzerte Kleinraeuber, dauerhafte Wolkendecken.
4. **Sturmkuesten**: starke Gezeiten, fliegende Aasfresser, amphibische Jäger.
5. **Skywhale-Routen**: atmosphaerische Wanderkorridore grosser fliegender Tiere.
6. **Cacti-Forest-Analoge**: keine trockenen Wuesten, sondern salzige, windige Inseln mit nadelschiessenden Pflanzenraeubern.

### 6.7 Monde von Hestia

Hestia besitzt vier kleine Monde in grober 1:2:4:8-Bahnresonanz. Sie stabilisieren Achse und Gezeitenrhythmus, ohne als einzelner riesiger Mond die Himmelsoptik zu dominieren.

Hestias Hill-Radius bei 0.60 AU liegt grob bei 1.24 Mio. km. Die aeusserste Mondbahn bleibt mit 400,000 km deutlich innerhalb eines plausiblen stabilen Bereichs.

| Mond | Bahnradius ab Hestia-Zentrum | Umlaufzeit | Radius | Masse | Rolle |
| --- | ---: | ---: | ---: | ---: | --- |
| Luma | 100,000 km | 2.56 Erdtage | 650 km | 0.049 Mondmassen | Groesster Mond, staerkste Gezeitenkomponente |
| Sela | 158,700 km | 5.11 Erdtage | 430 km | 0.013 Mondmassen | Resonanzpartner, auffaellige Perle am Himmel |
| Nixia | 252,000 km | 10.23 Erdtage | 300 km | 0.004 Mondmassen | Kleiner heller Mond, lange Schatten-/Finsterniszyklen |
| Oru | 400,000 km | 20.45 Erdtage | 210 km | 0.0013 Mondmassen | Aussenmond, schwache aber sichtbare Gezeitenmodulation |

Visuelle Vorgabe:

- Die Monde sollen nachts wie eine Kette heller Perlen erscheinen, wenn sie zufaellig nahe beieinander stehen.
- Nicht jeder Mond muss rund und glatt wirken; kleine Monde duerfen unregelmaessig sein.
- Finsternisse koennen als seltene Ereignisse und spaetere Gameplay-/Questmomente genutzt werden.

Stabilitaetsnotiz:

- Die Werte sind plausibel fuer ein Konzept, aber die exakte Langzeitstabilitaet der Vier-Mond-Resonanz sollte spaeter mit einer einfachen Orbital-Simulation getestet werden.

## 7. Die anderen Planeten

### 7.1 Korus, Planet I

Korus ist der innerste Planet. Er ist klein, metallreich, trocken und stark bestrahlt.

- Rolle: fruehes Navigations-/Scanobjekt, spaeter Hochtemperatur-Bergbau.
- Atmosphaere: praktisch keine, nur Exosphäre.
- Oberflaeche: dunkle Basalt- und Metallfelder, Krater, extreme Tag-/Nacht-Kontraste.
- Temperatur: sehr heisse Tagseite, sehr kalte Nachtseite moeglich.
- Gameplay: riskante, kurze Transfers; Solarkraft sehr stark; Landung spaeter nur mit Hitzeschutz.

### 7.2 Pyra, Planet II

Pyra ist ein Venus-artiger Treibhausplanet.

- Rolle: warnendes Gegenbild zu Hestia: fast Erdgroesse, aber unbewohnbar.
- Atmosphaere: dichter CO2-/Schwefel-Wolkendruck, extrem korrosiv.
- Oberflaeche: vulkanische Ebenen, Lavakanäle, tektonische Narben.
- Gravitation: nahe Erde, aber Umwelt extrem lebensfeindlich.
- Gameplay: Orbit- und Atmosphaerensonden, spaeter Spezialressourcen in oberen Wolkenschichten.

### 7.3 Tharos, Planet IV

Tharos ist ein kalter, kleiner, trockener Felsplanet.

- Rolle: Mars-Analog fuer Aussenposten, Eisabbau, alte Einschlagsbecken.
- Atmosphaere: duenn, CO2-/Staub-dominiert.
- Oberflaeche: rote/braune Ebenen, gefrorene Pole, Canyons, alte Flussbetten.
- Ressourcen: Wassereis, CO2, Metalle, Regolith.
- Gameplay: erste realistische Kolonie-/Outpost-Option ausserhalb von Asteroiden.

### 7.4 Aureon, Planet V

Aureon ist der grosse Gasriese des Startsystems.

- Rolle: aeusserer visueller Anker, Mondsystem, Gravitationsschleuder, spaetere High-Risk-Zone.
- Zusammensetzung: Wasserstoff/Helium, Wolkenbaender, Sturmsysteme.
- Monde: viele kleine Monde plus 3-5 groessere Galilei-Analoge fuer spaetere Erweiterungen.
- Ringe: optional schwacher Staub-/Eisring.
- Gameplay: Gravity assists, Treibstoff-/Gasernte spaeter, starke Strahlungszonen.

### 7.5 Nereion, Planet VI

Nereion ist ein Eisriese mit kaltem Blaugruen-Look.

- Rolle: spaeteres Mid-/Late-Game-Ziel, Methan-/Ammoniakressourcen.
- Zusammensetzung: Wasser, Ammoniak, Methan, Wasserstoff/Helium-Huelle.
- Monde: mehrere eisige Koerper; einer kann einen unterirdischen Ozean besitzen, aber kein sichtbares Oberflaechenleben.
- Gameplay: lange Transfers, schwaches Sonnenlicht, starke Abhaengigkeit von Kernenergie oder grossen Speichern.

### 7.6 Umbra, Planet VII

Umbra ist ein dunkler aeusserer Eisriese/Sub-Neptun.

- Rolle: Rand des Startsystems, geheimnisvolle Langstreckennavigation.
- Licht: fast dunkel, Aurelia nur noch sehr helles Sternlicht.
- Atmosphaere: kalte Methan-/Wasserstoffhuelle, dunkle Wolken.
- Monde: kleine, eisige, unregelmaessige Koerper.
- Gameplay: spaeter Forschung, seltene Isotope, tiefe Raumstationen.

## 8. Asteroidenguertel und spaetere Stationen

Der Hauptguertel liegt zwischen Tharos und Aureon.

| Zone | Abstand | Beschreibung |
| --- | ---: | --- |
| Innerer Guertel | 1.20-1.40 AU | steinige S-Typ-Asteroiden, mehr Metall, hoeherer Sonnenfluss |
| Hauptguertel | 1.40-1.70 AU | gemischte C-/S-Typ-Asteroiden, guter Start fuer Bergbau |
| Aeusserer Guertel | 1.70-2.10 AU | dunkle C-Typ-Koerper, Eis-/Kohlenstoffanteile steigen |

Grosse benannte Asteroiden als spaetere Orte:

| Asteroid | Orbit | Durchmesser | Masse | Verwendung |
| --- | ---: | ---: | ---: | --- |
| Eber | 1.32 AU | 780 km | `5.0e20 kg` | groesster Guertelkoerper, spaetere Station/Shipyard |
| Kallisto | 1.48 AU | 520 km | `1.6e20 kg` | Rohstoffknoten, Raffinerien |
| Minoa | 1.67 AU | 310 km | `4.0e19 kg` | Aussenposten, Forschung, Treibstoffdepot |

Stationen spaeter:

- **Eber Relay**: grosse Station in niedriger Umlaufbahn um Eber oder direkt in eine Kraterstadt eingebaut.
- **Kallisto Foundry**: industrielle Raffinerie fuer Metalle und Keramik.
- **Minoa Listening Post**: Forschung, Navigation, Deep-Space-Kommunikation.

Fuer den Prototyp reichen einfache unregelmaessige Meshes, graue/braune Materialien, Orbitmarker und Docking-Platzhalter.

## 9. Gravitations- und Orbit-Design

### 9.1 Minimalmodell fuer den Anfang

Fuer die erste spielbare Version reicht:

- Stern als dominante Zentralmasse.
- Planeten bewegen sich auf vordefinierten Keplerbahnen.
- Spieler-/Schiffphysik nutzt lokale Gravitation der naechsten dominanten Masse.
- Asteroiden koennen anfangs statisch oder auf einfachen Bahnen laufen.
- Atmosphaerenbremsung wird pro Planet spaeter separat aktiviert.

### 9.2 Spaeteres Modell

Spaeter sollten folgende Ebenen dazukommen:

1. Sphere-of-Influence pro Planet und Mond.
2. Patched-Conics fuer Flugplanung.
3. Optional vereinfachtes N-Body nur fuer spezielle Situationen.
4. Orbit-Prognose im HUD/Navcomputer.
5. Transferfenster zwischen Hestia, Tharos, Guertel und Aureon.

### 9.3 Gameplay-Skalierung

Die Konzeptdaten bleiben real, aber die Darstellung kann skaliert werden:

- Lokaler Flug: 1 Unity Unit = 1 m oder 10 m, je nach Szene.
- Orbitkarte: eigener Massstab, z. B. 1 Unity Unit = 1,000 km oder logarithmische Anzeige.
- Planetenoberflaeche: separate lokale Szenen/Chunks.
- Floating Origin ist Pflicht, sobald echte Abstaende verwendet werden.
- Visuelle Planeten in der Orbitkarte duerfen vergroessert dargestellt werden, solange die echten Werte in Tooltips/Simulation erhalten bleiben.

## 10. Erste Unity-Umsetzung mit simplen Meshes

Dieses Dokument verlangt keine sofortigen finalen Assets. Startumsetzung:

1. Aurelia als emissive Sphere mit warmem Licht.
2. 7 Planetenkugeln mit einfachem Material:
   - Korus: dunkelgrau/metallisch, heisse Risse optional.
   - Pyra: gelb-weisse Wolkenkugel.
   - Hestia: blaugruen, viele helle Kuesten/Riffmuster, dunkle Landmassen, Wolkenlayer.
   - Tharos: rostrot/braun mit hellen Polkappen.
   - Aureon: Gasstreifen, optional schwacher Ring.
   - Nereion: blaugruen, weich.
   - Umbra: dunkelblau/violett, sehr schwach beleuchtet.
3. Orbitlinien fuer alle Planeten.
4. Hestia mit vier kleinen Mondkugeln und einfachen Bahnen.
5. Asteroidenguertel als viele simple Rock-Mesh-Instanzen oder Punkte/Impostors.
6. Daten in ScriptableObjects oder JSON, nicht hart im Code.
7. Gravitation aus `mu`, nicht aus beliebigen Unity-Werten.

## 11. Offene Designfragen

- Finaler Name des Systems: `Aurelia-System` ist Arbeitsname.
- Sollen Hestias intelligente Spezies schon im Starter-System sichtbar sein oder erst als Spaetgame-/Lore-Element?
- Wie gefaehrlich ist Hestias Biosphaere fuer Spieler: nur Lore, echte Survival-Mechaniken oder spaeter Expedition-Gameplay?
- Wie stark wird Planetengravity im normalen Weltraumflug simuliert, ohne das Arcade-/Prototyp-Handling zu zerstoeren?
- Welche Ressourcen braucht der Asteroidenguertel fuer das erste Wirtschaftssystem?
- Muss die Vier-Mond-Resonanz physikalisch simuliert werden oder reicht eine stabile Kepler-Animation?

## 12. Kurzfazit

Das Startsystem soll realistisch genug sein, damit Orbitabstaende, Massen und Gravitation glaubwuerdig wirken, aber spielbar genug, damit die erste Implementierung mit simplen Meshes und klaren Datenstrukturen starten kann. Hestia ist der einzige Lebensplanet und der visuelle Star des Systems: groesser als die Erde, dichter, feuchter, lauter, waermer, von Inseln, Riffen, flachen Ozeanen, dunkler Vegetation und vier kleinen Monden gepraegt. Die restlichen Planeten geben dem System Kontrast, Progression und spaetere Reiseziele.