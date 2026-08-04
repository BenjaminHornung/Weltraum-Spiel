# Hestia Biome Design Foundation V0

Stand: 2026-07-28

Status: Verbindliche Docs-only-Designgrundlage; keine Runtime-Spec und keine
Implementierungsfreigabe

## 1. Zweck und Geltungsbereich

Dieses Dokument übersetzt die neue Hestia-Konzeptbildserie in eine
entscheidungsfähige Designgrundlage für Gelände, Wasser, Vegetation,
Atmosphäre, planetare Aktivitäten und spätere authored Orte. Es ergänzt:

- [Hestia als prozedurale Microvoxelwelt](./hestia-procedural-voxel-world.md),
- [Planetary Exploration Loop](./planetary-exploration-loop.md),
- [Planetary Settlements And Outposts](./planetary-settlements-outposts.md),
- [On-Planet First-Person Mode](./on-planet-first-person-mode.md),
- den
  [Hestia Surface Lab Visual Target](../design-audits/2026-07-14-hestia-surface-lab-visual-target.md)
  und
- den laufenden
  [Surface-Play-Recovery-ExecPlan](../browser-mainline/hestia-first-person-combat-slice-v1-recovery-execplan.md).

Die laufende P0-Recovery für Core-Korrektheit und Performance bleibt
autoritativer als dieses Dokument. Dieses Dokument erlaubt keine zusätzliche
Runtime-, Contract-, Spec- oder Task-Änderung. Es legt auch keine finalen
Biome-IDs, Generatorparameter, Materialkanäle, Wasserphysik, Ressourcen,
Hazards oder Stadtstandorte fest.

Die neue Konzeptserie beschreibt die gewünschte Produkt- und Grafikrichtung.
Sie ist Design-Input, niemals Runtime-Evidence. Akzeptanz kann später nur durch
frische Screenshots und Messwerte aus der realen Browser-Runtime entstehen.

## 2. Referenzaufnahme und beobachtbare Richtung

Die geschützte Referenzablage
`C:\IFI_SourceCode\Temp\WeltraumSpiel\docs\Konzeptart\Hestia` wurde
read-only geprüft. Sie enthält 23 PNG-Dateien mit 18 eindeutigen Bildinhalten.
Die Dateien `15_38_27 (1..2)` und `15_38_28 (3..5)` sind inhaltsgleiche
Duplikate der fünf Motive `15_37_44 (1..3)` und `15_37_45 (4..5)`.

| Referenzgruppe | Eindeutige Motive | Beobachtbarer Designbeitrag |
| --- | ---: | --- |
| Küstenstadt und Stadtlandschaft, `15_37_12` bis `15_37_14` | 5 | Helle biophile Küstenmetropole, klare Skyline, Grün in mehreren Höhenschichten, Wasserfront, Transport- und Industrie-/Raumfahrtinfrastruktur. |
| Stadt-Boards, `15_37_33` und `15_37_34` | 2 | Zusammenhängende Stadtidentität über Innenstadt, Infrastruktur, Mobilität, Parkräume und unterschiedliche Quartiere. |
| Biome-Board, `15_37_39` | 1 | Deutlich unterscheidbare spätere Richtungen für aride, hochgelegene, vulkanische, kristalline und savannenartige Landschaften. |
| Coast/Lush, `15_37_44` und `15_37_45` | 5 | Helle, üppige Hügellandschaft mit Schirmkronen, offenen Grasflächen, Felsstufen, Bächen, Küste und weiter Sicht. |
| Shallow-Water/Coast, `15_38_41` und `15_38_42` | 5 | Türkise Flachwasserzonen, Inseln, sichtbarer Untergrund, bewachsene Ufer, Wurzel-/Riffmotive und klare Wasserwege. |

Die Coast/Lush- und Shallow-Water/Coast-Motive sind die primäre visuelle
Kalibrierung für den nächsten kleinen Hestia-Surface-Slice. Die fünf weiteren
Biome sind Roadmap-Ziele. Die Stadtbilder definieren eine spätere authored
Richtung; sie autorisieren keine prozedurale Stadtgeneration.

Der ältere petrolfarbene Nebelwald aus dem Surface-Lab-Audit bleibt ein
eigenständig gescopter technischer Referenzzustand. Für den normalen
Coast/Lush-Spielbereich ist die neue helle Tagesrichtung maßgeblich. Ob der
dunkle Nebelwald später ein eigenes Biom, Wetter, Tageszeit- oder
Gefahrenprofil wird, bleibt offen.

## 3. Unveränderliche Grenzen des aktuellen Surface-Play-Slice

| Aktueller Invariant | Konsequenz für Biome-Arbeit |
| --- | --- |
| `/?surfacePlay=1` bleibt ein begrenzter, deterministischer Testbereich. | Kein globales Planeten- oder Biom-Streaming und keine versteckte Generierung über den Rand hinaus. |
| Die Recovery verwendet eine endliche `64 x 32 x 64 m @ 0.50 m` Region und eine autoritative trockene Traversal Domain. | Coast/Lush wird zunächst innerhalb dieser Region kalibriert; eine unauffällige Grenze ist zulässig. |
| Wasser ist im aktuellen Slice sichtbare Szenerie mit World-owned Shore Boundary, kein Schwimm- oder Unterwassermodus. | Die Referenz darf Flachwasser zeigen, aber die Runtime darf daraus keine unbeschlossene Medium- oder Wasserphysik ableiten. |
| World/Runtime besitzt Gelände, Wasser, Shore, Population, Collision, Revision und Hash. | Three.js, Materialien, Fog, Sky und CSS bleiben Projektionen. |
| Nur Umbrella Trees sind im Recovery-Scope autoritative Structural-Voxelbäume; andere Vegetation ist dekorativ. | Neue Arten oder Vegetationslayer dürfen keine Kollision, Zerstörung oder Ressourcenwahrheit vortäuschen. |
| Baumtreffer, Support-Verlust und Fallbewegung laufen über Combat, Structural Authority und deterministische Physik. | Keine reine Renderanimation als Ersatz für lokalisierte Zerstörung oder Umfallen. |
| Core-Korrektheit, Klicklatenz, Kontakt-Liveness und Randperformance gehen vor Art-Fidelity. | Biome-Implementation beginnt erst, wenn die Recovery-Gates diese Probleme frisch belegen. |
| `window.TestBridge` fehlt auf Surface Play. | Visuelle und spielerische Abnahme erfolgt über reale Controls und normale Runtime-Wege. |
| Die Stadt entsteht später gemeinsam durch Benutzer und Agenten als authored Content. | Keine Stadt, Fake-Skyline oder prozedurale Gebäudeverteilung im aktuellen Slice. |

Diese Grenzen dürfen durch einen Biome-Preset, einen Renderer-Adapter oder ein
Concept-Art-Matching nicht aufgeweicht werden.

## 4. Gemeinsame visuelle Säulen

### 4.1 Heller planetarer Tagesraum

- Klarer blauer Himmel, helle Wolken und eine erkennbare
  Horizont-/Zenit-Trennung ersetzen einfarbige grün-blaue Flächen.
- Sonnenlicht macht Terrainform, Baumkronen, Felsstufen und Wasser lesbar,
  ohne Weißflächen auszubrennen.
- Atmosphärische Tiefenstaffelung trennt Vordergrund, Mittelgrund und Horizont,
  ohne den begehbaren Bereich in dichtem Fog zu verstecken.
- Dunkle Varianten müssen als eigener Zustand erkennbar sein und dürfen nicht
  versehentlich zum Standard werden.

### 4.2 Große, lesbare Landformen

- Hestia liest sich zuerst über Küstenbogen, Hügel, Insel, Plateau, Tal,
  Wasserlauf oder Landmarke, erst danach über Microvoxel-Detail.
- Begehbare Flächen wechseln mit niedrigen Felsstufen, Vegetationsgruppen und
  Blickachsen; sie sind weder eine flache Ebene noch eine kleine steile Insel.
- Ein Bild besitzt Vordergrund, spielbaren Mittelgrund und einen ruhigen
  Fernbereich. Harte Chunkkanten oder Terrainunterseiten sind nie Teil der
  Komposition.

### 4.3 Wasser als räumliche Struktur

- Türkis bis tiefblau abgestufte Wasserflächen zeigen Uferform, Flachwasser,
  Inselabstände und Küstenrichtung.
- Ufer besitzen einen verständlichen Übergang aus trockenem Boden, feuchtem
  Material, flachen Steinen, Pflanzen und Wasser.
- Transparenz, sichtbarer Untergrund und kleine Farbunterschiede dürfen Tiefe
  vermitteln, aber keine unimplementierte Strömungs-, Tiden- oder
  Schwimmwahrheit behaupten.

### 4.4 Biologische Schichtung statt Baumstempel

- Oberer Layer: verbundene, nachvollziehbar verwurzelte Bäume mit klaren
  Silhouetten und mehreren Höhen-/Altersklassen.
- Mittlerer Layer: Sträucher, fächerartige Pflanzen, junge Bäume und
  Ufervegetation in Gruppen.
- Bodenlayer: Gräser, Moose, Blüten- und Riff-/Korallenmotive als sparsame
  Akzente.
- Vegetation rahmt Wege, Wasser und Landmarken, lässt aber Boden, Schusslinien
  und Fluchtwege sichtbar.
- Kein schwebender Stamm, keine abgetrennte Krone, kein regelmäßiger Rasterwald
  und keine durchgehende schwarze Kronendecke.

### 4.5 Facettierte physische Materialität

- Der Browser-Look bleibt eigenständig low-poly/microvoxelbasiert. Die
  Konzeptbilder geben Komposition, Licht, Palette, Dichte und Silhouette vor,
  nicht fotorealistische Pixelgleichheit.
- Fels, trockener Boden, feuchte Strata, biologische Deckschicht und Wasser
  bilden große, zusammenhängende Materialzonen.
- Lokale Zerstörung zeigt Volumen, Schichtung und Bruch nachvollziehbar.
  Zufällige Ein-Zellen-Farbsprenkel oder bloße Würfelstapel sind Anti-Ziele.

### 4.6 Funktionale, authored Zivilisation

- Städte und Infrastruktur sind aus der Ferne an Skyline, Quartieren,
  Verkehrsachsen, Grünräumen, Wasserfront und funktionalen Anlagen erkennbar.
- Diese Ordnung entsteht später durch authored Layouts, nicht durch einen
  generischen Building Scatter.
- Stadt- und Industrieformen müssen ihren Zweck zeigen; Dekoration ersetzt
  keine Landing-, Cargo-, Service-, Faction- oder Story-Semantik.

## 5. Gameplay- und Game-Design-Säulen

1. **Lesbare Entscheidung vor Aktion.** Gelände, Wasser, Vegetation und
   Landmarken zeigen mögliche Wege, Deckung, Risiko und Zielrichtung, bevor
   ein HUD-Text sie erklärt.
2. **Traversal mit Gewicht.** Bodenform, Steigung, Stufen, Wurzeln und
   Shore-Grenzen sind echte World-Fakten. Bewegung bleibt grounded und
   performant.
3. **Werkzeug und Zerstörung greifen lokal.** Ein Cutter-Treffer trifft den
   sichtbaren autoritativen Gegenstand, verändert lokal Material und kann
   Support-Verlust mit echter Physik auslösen.
4. **Offene und dichte Räume wechseln.** Exploration braucht Korridore,
   Aussichtspunkte, Deckung, Rückzugsräume und Landmarken statt gleichmäßiger
   Dichte.
5. **Jeder Ort besitzt einen Zweck.** Spätere Sites verbinden Scan, Ressource,
   Hazard, Combat, Salvage, Cargo, Wissen, Faction oder Rückkehr zum Schiff.
6. **Biome verändern Möglichkeiten, nicht nur Farben.** Spätere Profile
   unterscheiden Terrainform, Sicht, Traversal, Ressourcen und Hazards, sobald
   deren Verträge existieren.
7. **Authored Hero Sites schaffen Erinnerung.** Prozedurale Umgebung liefert
   Variation; kuratierte Orte liefern Identität, Geschichte und präzise
   Spielabläufe.

## 6. Designschema für einen Hestia-Biome-Kit

Das folgende Schema ist eine Design- und Review-Checkliste, kein
TypeScript-Vertrag. Feldnamen, IDs, Versionierung und Runtime-Owner benötigen
vor Implementierung eine eigene Spec.

| Bereich | Designinhalt | Erforderlicher späterer Nachweis |
| --- | --- | --- |
| Identity | Arbeitsname, visuelle Kurzformel, Referenzgruppe, Status, vorgesehene Planetenzone. | Stabiler, versionierter Runtime-Identifier erst nach Spec. |
| Macro Terrain | Küste, Inseln, Plateau, Tal, Höhenklassen, Landmarkenform, begehbare Korridore. | Deterministische Seeds, Bounds, Traversal- und LOD-Evidence. |
| Material Strata | Grundgestein, Boden, feuchte Schicht, biologische Deckung, Akzentmaterial. | Zusammenhängende Klassifikation, Voxelkanäle und visuelle Parität. |
| Water and Shore | Wasserform, Flach-/Tiefenlesbarkeit, trockene Grenze, Shore-Material und Pflanzen. | World-owned Water/Shore Facts; keine Presentation-Authority. |
| Vegetation Layers | Canopy, Unterwuchs, Ground Cover, Dichtewechsel, Höhenklassen und offene Flächen. | Gleicher Seed ergibt gleiche Population; Collision/Destruction nur für autoritative Arten. |
| Atmosphere and Light | Tagesrichtung, Sky, Wolken, Haze/Fog, Schatten- und Kontrastziel. | Ein Surface-Light-Owner, reproduzierbare Kamera- und Viewport-Captures. |
| Landmarks | Natürliche Hero-Formen, Silhouetten, Orientierungspunkte und Sichtbeziehungen. | Stable Site/World Address und unverdeckte Spieleransicht. |
| Traversal and Hazards | Slope-, Step-, Boden-, Sicht- und spätere Umweltgefahren. | Physische/semantische Authority plus verständliche Warnung; nicht aus Materialfarbe abgeleitet. |
| Resources | Kandidaten für Proben, Mineralien, biologische Stoffe oder besondere Funde. | Eigene Resource-/Node-/Depletion-Verträge vor Gameplay. |
| Settlement Exclusion | Bereiche, die frei von prozeduraler Bebauung, großen Pflanzen oder unpassenden Landformen bleiben. | Deterministische Masken und Konfliktdiagnostik. |
| Authored Sockets | Stabile Plätze für spätere Städte, Outposts, Ruinen, Landing Zones, Wege und Story-Hotspots. | Versionierter Hotspot-Deskriptor mit Frame, Maske und Priorität. |
| Acceptance Fixtures | Referenzseed, Kamera, Route, Interaktionen, Viewports und Performanceprobe. | Frische Unit-/E2E-/Screenshot-/Manual-Evidence aus derselben Runtime-Truth. |

## 7. Initiales Profil: Coast/Lush

`Coast/Lush` ist ein Arbeitslabel und keine stabile Runtime-ID.

### 7.1 Visuelle Kurzformel

> Helle, biologisch aktive Küstenhügel mit türkisfarbenem Flachwasser,
> gestuften hellen Felsen, Schirmbäumen, offenem Grasland und weiter Sicht.

### 7.2 Macro Terrain

- Breite, überwiegend sanfte Hügel und niedrige Plateaus statt einer einzelnen
  steilen Terraininsel.
- Lagunen, schmale Wasserläufe, Inselgruppen und trockene Verbindungen gliedern
  den Raum.
- Felsstufen und kleine Rücken erzeugen Deckung und Aussicht, ohne den
  Traversal-Korridor zu zerhacken.
- Mindestens eine natürliche Mittelgrund-Landmarke, etwa ein bewachsener
  Felshügel, eine Flusskurve oder ein Inselrücken.
- Der begrenzte Recovery-Bereich zeigt keinen Void, keine Unterseite und keine
  sichtbare Resident-Grenze.

### 7.3 Material- und Wasserfamilie

- Helles warmes Grundgestein mit klaren facettierten Ebenen.
- Sattes, aber nicht neonfarbenes Grün für Boden- und Vegetationsdecke.
- Dunklere, räumlich zusammenhängende Feuchtzonen an Ufern und Rinnen.
- Türkises Flachwasser mit lesbarem Untergrund und tieferem Blau in der Ferne.
- Kleine Cyan-, Violett-, Orange- oder Blütenakzente bleiben begrenzt und
  ersetzen keine Materialschichtung.

### 7.4 Vegetationsaufbau

- Umbrella Trees bilden die charakteristische obere Silhouette. Kleine,
  mittlere und Hero-Exemplare müssen sich in Höhe, Stammproportion,
  Kronenbreite und Verzweigung nachvollziehbar unterscheiden.
- Baumhöhe und Krone skalieren als zusammengehöriger Organismus; lange leere
  Stämme, winzige Kronen oder unverbundene Segmente sind Fehlzustände.
- Dichte Baumgruppen wechseln mit Grasflächen, Fels, Ufer und klaren
  Laufkorridoren.
- Unterwuchs, Gräser, Röhren-/Fächerpflanzen und Blüten-/Riffmotive werden
  später als eigene Layer kalibriert.
- Nur ausdrücklich autoritative Structural-Arten besitzen Collision,
  lokale Zerstörung, Support und Fallphysik.

### 7.5 Atmosphäre und Komposition

- Blauer Himmel, helle Wolken, warme Hauptbeleuchtung und kühle
  Entfernungshaze.
- Wasser, Land und Baumkronen bleiben auch ohne HUD farblich und räumlich
  unterscheidbar.
- Die Reset-Ansicht zeigt freien Boden im Vordergrund, ein spielbares Ziel im
  Mittelgrund und Landschaftstiefe am Horizont.
- Keine Stadt, kein Fake-Outpost und kein prozeduraler Skyline-Ersatz im
  ersten Profil.

### 7.6 Traversal, Combat und Zerstörung

- Laufwege bieten mindestens eine offene Sichtlinie und eine alternative
  Route um Vegetations- oder Felsgruppen.
- Bäume können Deckung und Hindernis sein, dürfen aber Spawn und Randkorridor
  nicht blockieren.
- Ein Structural Tree ist sichtbar voxelbasiert, kollidierbar, lokal
  beschießbar und fällt nach Support-Verlust über Runtime-Physik.
- Terrain-Cuts zeigen lokale Schichtung, ohne bei jeder Aktion die Region neu
  zu materialisieren.
- Schüsse und Bewegungen bleiben am Rand, an Bäumen und nach Revisionwechseln
  reaktionsfähig.

### 7.7 Spätere Ressourcen und Gefahren

Mögliche Designkandidaten sind biologische Proben, mineralische Uferadern,
Flachwasserpflanzen, rutschige Feuchtzonen und schützenswerte Habitate. Keiner
dieser Kandidaten ist im aktuellen Slice eine Gameplay- oder Contract-Zusage.

### 7.8 Authored-Socket-Vorbereitung

Spätere Orte brauchen trockene, nachvollziehbare Terrassen, eine
SurfaceLocalFrame-Adresse, Approach-/Landing-Freiraum und eine
Settlement-Exclusion-Maske. Der aktuelle Slice reserviert oder bebaut keinen
konkreten Stadtstandort.

## 8. Fünf spätere Biome-Profile

Alle Namen sind Arbeitslabels. Jedes Profil benötigt eine eigene
Spec-/Performance-/Acceptance-Phase, bevor es Runtime-Content wird.

| Profil | Visuelle Identität | Mögliche spätere Gameplay-Sprache | Noch nicht beschlossen |
| --- | --- | --- | --- |
| Arid Basin | Helle Sand-/Steinflächen, erodierte Rücken, Salz- oder Trockenbecken, sehr sparsame robuste Vegetation und große Fernsicht. | Hitze, Staub, offene Exposition, seltene geschützte Senken. | Klimaursache, Ressourcen, Hazardwerte, Wasserzyklus. |
| Conifer Highland | Kühles Hochland, dunkle Nadel-/Turmvegetation, Felsgipfel, Seen, Täler und gestaffelte Nebelbänder. | Steigung, Sichtwechsel, Sturm/Kälte, enge Pässe und Aussichtspunkte. | Baumarten, Schnee/Eis, Traction, Höhenverteilung. |
| Volcanic Reach | Schwarzer Basalt, Ascheflächen, rote/orange thermische Akzente, Caldera-/Lavakanäle und hitzerobuste Inselvegetation. | Hitze, toxische Zonen, instabiler Boden und energiereiche Funde. | Aktive Lava-/Gas-Simulation, Damage, Materialverhalten. |
| Crystal Wilds | Dunkler Fels mit blauen, violetten oder cyanfarbenen Kristallformen, sparsamer Flora und klaren Hero-Silhouetten. | Scanneranomalie, wertvolle Proben, Sicht-/Energie- oder Strahlungsrisiko. | Leuchten, Ressourcenwert, physische Eigenschaften, Schutzstatus. |
| Savanna Plateau | Goldgrüne Grasflächen, breite Plateaus, einzelne Schirmbaumgruppen, Felstürme und saisonal wirkende Wasserstellen. | Lange Sichtlinien, schnelle Traversal-Routen, Schutz/Deckung an Bauminseln und Wasserpunkten. | Feuer/Wetter, Tierwelt, Saisonalität, Ressourcenschleife. |

Biome-Übergänge, planetare Verteilung, Wetterkopplung und globale
Klima-/Geologiefelder bleiben Teil der späteren planetaren Runtime und werden
nicht in einem Surface-Play-Preset erfunden.

## 9. Authored-City-Grenze

Die Stadt wird später vom Benutzer und von Agenten gemeinsam als versionierter
authored Content erstellt. Die bevorzugte Richtung ist eine eigene
Creative-/City-Builder-Oberfläche, damit nicht jede Platzierung als Produktcode
implementiert werden muss. Die Konzeptbilder definieren dabei:

- eine helle, biophile Küstenstadt,
- eine markante, aber funktional gegliederte Skyline,
- grüne Terrassen, Parks und Wasserbezüge,
- sichtbare Verkehrs- und Versorgungsachsen,
- getrennte Wohn-/Zentrums-, Industrie-, Hafen- und
  Raumfahrtinfrastrukturbereiche sowie
- eine lesbare Beziehung zwischen Stadt, Küste und Fernlandschaft.

Bewusst authored und vom Menschen bestätigt bleiben mindestens:

- Stadtgrundriss, Skyline und Quartiersgrenzen,
- Hero-Gebäude, Raumhafen, Industrieanlagen und Story-Orte,
- Straßen, Transit, Parks, Plätze, Uferkanten und Sichtachsen,
- Landing-/Cargo-/Service-Flows, Faction- und Story-Semantik,
- Innenräume und jede einzigartige Gameplay-Sequenz.

Die prozedurale Welt darf später nur vorbereiten:

- stabile Oberflächenadresse und SurfaceLocalFrame,
- geologische Terrainbasis,
- versionierte Exclusion-/Blend-Masken,
- authored Sockets und Approach-/Landing-Freiraum,
- Übergänge in umgebende Biome sowie
- deterministische Konfliktdiagnostik.

Ein Editor darf dafür deterministische Straßen-, Parzellen-, Wiederholungs-,
Vegetations- und Gebäudevarianten vorschlagen. Solche Vorschläge sind
halbprozedurale Preview-Hilfen, keine World Truth. Erst eine explizite
Human-Accept-Aktion schreibt das Ergebnis mit Seed, Tool-Version und Provenance
in ein versioniertes authored-world overlay.

Die normale Runtime darf keine Gebäudeverteilung, Straße, Stadtgrenze oder
Storyfunktion improvisieren und als authored Stadt ausgeben. Mesh,
Three.js-Hierarchie, Editor-Selektion und DOM-Zustand werden nie zur Stadt-
oder World-Authority.

## 10. Gemeinsamer Authoring-Workflow

1. **Referenz klassifizieren.** Quelle, Rechte, Status, Zielbiom und
   beobachtbare Merkmale dokumentieren; Referenzbilder nicht als Runtime-Asset
   oder Evidence übernehmen.
2. **Biome-Brief freigeben.** Visuelle Kurzformel, Macro Terrain,
   Materialstrata, Vegetationslayer, Wasser, Atmosphäre, Gameplay-Funktion,
   Anti-Ziele und offene Entscheidungen festhalten.
3. **Deterministisches Graybox erzeugen.** Ein kleiner Seed-/Kamera-Fixture
   beweist Terrainform, trockene Traversal Domain, Shore und Randverhalten ohne
   Art-Polish.
4. **Material- und Lichtpass.** Große Zonen, Sky, Wolken/Haze, Wasser- und
   Shore-Lesbarkeit in Three.js als reine Projektion kalibrieren.
5. **Vegetationskit aufbauen.** Structural-Arten getrennt von dekorativen
   Layern authoren; Height Classes, Rooting, Collision, Destruction und
   Population unabhängig prüfen.
6. **Gameplay-Routen testen.** Spawn, Aussicht, Ziel, Deckung, Alternativweg,
   Terrain Cut, Tree Cut/Fall, Randkontakt und Rückweg real spielen.
7. **Sockets und Exclusions prüfen.** Authored Orte erhalten stabile Adressen,
   Freiräume, Masks und Konfliktdiagnostik, aber noch keinen unbeschlossenen
   Content.
8. **Evidence erstellen.** Gleicher Seed/Kamera/Runtime-State für Messung und
   Screenshot; Konzeptbilder bleiben nur danebenliegende Referenz.
9. **Human Art Review.** Der Benutzer bestätigt Look, Komposition,
   Spielbarkeit und Stadt-/Biome-Richtung. Ein grüner Test ersetzt diese
   Entscheidung nicht.

Für die spätere Stadt liefert der Benutzer Layout-, Silhouetten- und
Platzierungsentscheidungen. Agenten können Graybox-Varianten, Datenpflege,
Compiler-/Validation-Tools, Performanceprüfungen und wiederholbare
Browser-Evidence übernehmen. Jede Stadtiteration bleibt ein versionierter
authored Hotspot.

Der geplante Editor soll mindestens Asset-/Gebäudepalette, Auswahl und
Transform-Gizmos, Grid-/Socket-Snapping, Ebenen, Duplizieren/Löschen,
Undo/Redo, Biome-/Exclusion-Masken, Preview, Konfliktvalidierung und
deterministischen Export bereitstellen. Creative-Kommandos bleiben vollständig
von Surface Play getrennt.

## 11. Deterministische Test- und Visual-Acceptance-Checkliste

### 11.1 Authority und Determinismus

- [ ] Gleicher Seed, gleiche Version und gleiche Eingaben erzeugen gleiche
      Macro-, Material-, Population- und authored-Socket-Fakten.
- [ ] Ein geänderter Seed verändert Geometrie/Population, hält aber die
      freigegebene visuelle Grammatik ein.
- [ ] Water, Shore, Traversal, Population, Structural Edits und Physics stammen
      aus ihren Runtime-/Domain-Ownern.
- [ ] Renderer, Fog, Sky, CSS und HUD verändern keine World- oder
      Gameplay-Truth.
- [ ] Authored Masks/Sockets überlagern eine stabile Basis, ohne den Seed
      stillschweigend umzudeuten.

### 11.2 Reale Spielbarkeit

- [ ] Spawn, Vorwärts-/Seitwärtsbewegung, Sprint, Sprung und Ruhe auf Slope
      werden mit realen Controls geprüft.
- [ ] Der Spieler erreicht keinen Void, kein unerlaubtes Wasser und keinen
      ungeschützten Resident-Rand.
- [ ] Randkontakt, Tree Contact und Authority-Wechsel bleiben tick- und
      frame-stabil.
- [ ] Terrain- und Structural-Treffer reagieren prompt, treffen das nächste
      autoritative Ziel und publizieren typed Resultate.
- [ ] Structural Tree Cut, Support-Verlust, Fall, Collision und Rest stimmen
      visuell mit denselben Runtime-Snapshots überein.
- [ ] Spätere Hazard-/Resource-Behauptungen existieren nur mit eigenen
      Domain-Verträgen und nachvollziehbarer Spielerwarnung.

### 11.3 Visuelle Prüfung

- [ ] Sky besitzt erkennbare Horizon-/Zenit-Trennung, Wolken-/Haze-Struktur und
      eine plausible helle Tagesrichtung.
- [ ] Vordergrund, spielbarer Mittelgrund und Horizont sind gleichzeitig
      lesbar.
- [ ] Terrain zeigt große Formen und zusammenhängende Materialstrata statt
      Rauschen oder eine kleine steile Insel.
- [ ] Wasser, trockener Boden, feuchtes Ufer und Vegetation sind ohne HUD
      unterscheidbar.
- [ ] Baumhöhe, Stamm, Äste, Krone und Rooting bilden plausible, verbundene
      Silhouetten in mehreren Klassen.
- [ ] Vegetation lässt Bodenöffnungen, Landmarke, Ziel, Schusslinie und
      Traversal-Alternativen sichtbar.
- [ ] Kein Screenshot zeigt Chunkkante, Void, Terrainunterseite,
      Unterwasser-Vollbildzustand, schwebende Vegetation oder Fake-Skyline.
- [ ] Die Viewports `1920x1080`, `1440x900`, `1024x768`, `1920x800`,
      `2000x993` und `1712x1011` werden mit dokumentierter Kamera und
      Runtime-State geprüft.

### 11.4 Performance und Evidence

- [ ] Messbare Budgets für Generation, Adoption, Collision, Structural Cut,
      Physics, Frame Time und Speicher werden vor Skalierung festgelegt.
- [ ] Wiederholter Randkontakt löst keine Generation-, Remesh- oder
      Delegate-Rebuild-Schleife aus.
- [ ] Browser-Mainthread blockiert weder bei Terrain Cut noch bei Tree Cut für
      Sekunden.
- [ ] E2E-Screenshots stammen aus der live laufenden normalen
      `surfacePlay=1`-Route; `window.TestBridge` bleibt abwesend.
- [ ] Konzeptbilder und alte grüne Tests werden nie als erfolgreiche
      Spielabnahme verwendet.
- [ ] Der Benutzer führt nach automatisierten Gates einen echten manuellen
      Spieltest durch und gibt die visuelle Richtung ausdrücklich frei.

## 12. Gestufter Implementierungsbacklog

Die Stufen sind Reihenfolge und Vorbereitung, keine Freigabe. Jede
Runtime-Stufe benötigt vorab eine passende Spec/ExecPlan-Erweiterung.

### Stufe 0 — Laufende P0-Recovery abschließen

Ziel: A/D, Klicklatenz, Tree-Contact-Liveness, Randperformance, Structural
Physics, Energy, HUD und bestehende Regressionen mit echten Browser-Gates
stabilisieren.

Wahrscheinliche Bereiche:

- `apps/weltraum-browser/src/surface-play/**`
- `apps/weltraum-browser/src/voxel/structural/**`
- `apps/weltraum-browser/tests/unit/**`
- `apps/weltraum-browser/tests/e2e/hestia-first-person-combat-slice.spec.ts`

Safe stop: keine Biome-Erweiterung bei offenem Core-/Performance-Blocker.

### Stufe 1 — Coast/Lush-Presentation kalibrieren

Ziel: heller Sky, Tiefenstaffelung, Material-/Wasserlesbarkeit,
Baum-Höhenklassen und plausible Population im bestehenden begrenzten Slice.

Wahrscheinliche Bereiche:

- `apps/weltraum-browser/src/surface-play/environment/hestiaSurfaceEnvironment.ts`
- `apps/weltraum-browser/src/surface-play/environment/hestiaSurfacePresentation.ts`
- `apps/weltraum-browser/src/surface-play/environment/hestiaStructuralTreePresentation.ts`
- `apps/weltraum-browser/src/surface-play/vegetation/**`
- `apps/weltraum-browser/src/surface-play/world/hestiaSurfaceWorld.ts`
- zugehörige Unit-/E2E-/Screenshot-Evidence

Authority-Gate: Presentation konsumiert nur World-/Structural-Snapshots.

### Stufe 2 — Biome-Kit-Vertrag spezifizieren

Ziel: Identity/Version, Macro Terrain, Materialstrata, Water/Shore,
Vegetationslayer, Atmosphärenprofil, Landmarks, Hazards, Resources,
Exclusions, authored Sockets und Acceptance Fixtures als eigener Vertrag.

Wahrscheinliche Bereiche:

- `.devtoolbox/specs/changes/<approved-hestia-biome-change>/`
- `docs/architecture/procedural-voxel-planet-runtime.md`
- `docs/spielkonzept/hestia-procedural-voxel-world.md`
- bestehende Hestia-Generatorpfade unter
  `apps/weltraum-browser/src/world-generation/hestia/`

Safe stop: keine stabilen IDs oder neuen Voxel-/Materialkanäle ohne
Contract-Review.

### Stufe 3 — Deterministische Coast/Lush-World-Fakten

Ziel: Macro Terrain, Strata, Shore und Population aus einem freigegebenen
Profil erzeugen und durch dieselben Collision-/Traversal-/Render-Handoffs
führen.

Wahrscheinliche Bereiche:

- `apps/weltraum-browser/src/world-generation/hestia/preset.ts`
- `apps/weltraum-browser/src/world-generation/hestia/densityGenerator.ts`
- `apps/weltraum-browser/src/world-generation/hestia/materialClassifier.ts`
- `apps/weltraum-browser/src/world-generation/hestia/scatterGenerator.ts`
- `apps/weltraum-browser/src/world-generation/hestia/seed.ts`
- `apps/weltraum-browser/src/surface-play/world/**`
- `apps/weltraum-browser/src/voxel/**`

Evidence-Gate: Seed-, Bounds-, Shore-, Traversal-, Population- und
Representation-Tests plus realer Browserlauf.

### Stufe 4 — Ein kleiner Biome-Gameplay-Loop

Ziel: genau ein freigegebener Resource-/Hazard-/Discovery-Zusammenhang, der in
Scanner, Werkzeug, Cargo/Wissen und spätere Rückkehr zum Schiff einzahlt.

Wahrscheinliche Bereiche erst nach eigenen Verträgen:

- `apps/weltraum-browser/src/surface-play/**`
- `apps/weltraum-browser/src/resources/**`
- Runtime-Cargo-, Scanner-, Interaction- und Persistence-Owner
- Player-HUD als reine Snapshot-Projektion

Safe stop: kein Fake-Node, Fake-Cargo oder farblich abgeleiteter Hazard.

### Stufe 5 — Fünf weitere Profile einzeln ausbauen

Ziel: Arid Basin, Conifer Highland, Volcanic Reach, Crystal Wilds und Savanna
Plateau jeweils als eigener kleiner, messbarer Content-Slice.

Jedes Profil braucht:

- eigenes freigegebenes Design-Brief,
- deterministische Golden Seeds,
- eigene Traversal-/Hazard-/Resource-Entscheidungen,
- Performance- und Screenshot-Matrix sowie
- Human Art Review vor dem nächsten Profil.

Keine planetweite Verteilung oder Übergangsgeneration wird aus diesen
Einzelslices abgeleitet.

### Stufe 6 — Authored-City-Pipeline und erster Hotspot

Ziel: Benutzer und Agenten erstellen gemeinsam einen versionierten,
editorunterstützten Küstenstadt-Hotspot auf vorbereiteter Hestia-Basis.

Wahrscheinliche Bereiche:

- lizenzklare Quellen und Exporte unter `art/`,
- Hotspot-/WorldTemplate-/WorldInstance-Verträge,
- eine separate Creative-/City-Builder-Oberfläche ohne Surface-Play-Cheats,
- diff-freundliches authored-world overlay mit deterministischem
  Command-/Undo-/Redo-Verlauf,
- modulare Building Kits mit stabilen IDs, Varianten, Footprints, Sockets,
  Clearance, Terrain-Fit und Representation-/Collision-/Destruction-Metadaten,
- Straßen-, Parzellen-, District- und Biome-/Exclusion-Layer,
- agentische/halbprozedurale Preview-Vorschläge mit explizitem Human Accept,
- späterer GLB-to-Voxel-/Golden-Corpus-Pfad,
- authored Mask-/Socket-/Conflict-Validation,
- eigene City-Spec, Evidence und manuelle Layoutfreigabe.

Safe stop: keine autonome Laufzeit-Stadtgeneration, keine still akzeptierten
Editor-Vorschläge und kein Mesh als World Truth.

### Stufe 7 — Planetare Verteilung und Streaming

Ziel: freigegebene Biome, authored Hotspots und lokale Edits über
SurfaceTile/SurfaceRegion/Representation-Handoffs planetar skalieren.

Voraussetzungen:

- SurfaceLocalFrame und Target Handoff,
- Planet Tile Scheduler und lückenfreier Parent-Fallback,
- Persistence für Seeds, Versionen, Semantic State und Deltas,
- gemessene CPU-/GPU-/Worker-/Memory-Budgets.

Diese Stufe liegt ausdrücklich außerhalb des aktuellen Combat-Recovery-Slice.

## 13. Offene Entscheidungen

- Finale Namen, Anzahl, stabile IDs und Versionierung der Biome-Profile.
- Rolle des dunklen Nebelwalds: eigenes Biom, Wetter, Tageszeit oder Hazard.
- Globale Klima-/Geologie-Verteilung und Regeln für Biomübergänge.
- Exakte Materialpalette, Voxelkanäle, Auflösung und Representation-Ladder pro
  Entfernung.
- Wasserhöhe, Tiefe, Transparenz, Wellen, Strömung, Tide und spätere
  Schwimm-/Wading-Regeln.
- Finale Umbrella-Tree-Arten, Höhenklassen, Altersvariation und Verhältnis
  autoritativer zu dekorativer Vegetation.
- Ressourcen, Hazards, Schutzstatus und Faction-Konflikte je Biom.
- Sky-/Wolkenmodell und Tages-/Wetterkopplung.
- Gemessene Budgets für Generierung, Streaming, Collision, Destruction,
  Physics, Rendering und Speicherung.
- Position, Maßstab, Storyrolle, Quartiere und erste Gameplay-Schleife der
  authored Küstenstadt.
- Format und Toolchain für Stadt-/Hotspot-Authoring, Exclusion Masks, Sockets
  und GLB-to-Voxel-Artefakte.
- MVP-Grenze des Creative-/City-Builders, Bedienmodell, Auswahl-/Transform- und
  Undo-/Redo-Semantik sowie Trennung von Editor-, Runtime- und Player-Edits.
- Schema, Migration und Hashing des authored-world overlays sowie Regeln für
  parallele Benutzer-/Agenten-Änderungen.
- Building-Kit-Metadaten, Straßen-/Parzellenmodell, Hero-Locks und Grenzen
  halbprozeduraler Vorschläge.
- Lizenz- und Provenance-Regeln für alle späteren Art-/Audio-/Asset-Quellen.

Keine dieser Fragen darf still durch Three.js-, Asset-, Generator- oder
Library-Defaults entschieden werden.

## 14. Definition of Ready für die erste Biome-Implementation

Die Coast/Lush-Implementierung darf erst als eigener Scope beginnen, wenn:

1. die laufende Surface-Play-Recovery ihre Core- und Performance-Gates frisch
   bestanden hat;
2. der Benutzer das Coast/Lush-Design-Brief und seine Anti-Ziele bestätigt;
3. World-/Presentation-Owner, Datenfelder und unveränderte Contracts explizit
   benannt sind;
4. ein Golden Seed, Reset-Kamera, reale Inputroute, Viewport-Matrix und
   Performanceprobe feststehen;
5. Tree-, Terrain-, Water-/Shore- und Edge-Regressionsfälle vor der Mutation
   vorhanden sind;
6. Concept Art nur Referenz bleibt und fresh Browser Evidence als
   Acceptance-Grundlage vorgesehen ist; und
7. Stadt, Multi-Biome, planetare Verteilung und Streaming ausdrücklich
   außerhalb dieses ersten Scopes bleiben.
