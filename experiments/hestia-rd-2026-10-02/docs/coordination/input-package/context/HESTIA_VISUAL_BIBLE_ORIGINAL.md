# Hestia Visual Design Language

**Dokumenttyp:** Normative Visual Bible  
**Version:** 1.0  
**Status:** Baseline zur Produktionsanwendung, mit explizit markierten offenen Entscheidungen  
**Datum:** 2026-08-12  
**Auditierter GitHub-Stand:** `15f3550bd604856b25d40a7ac700ec4d5106b89e`  
**Geltungsbereich:** Planetare Außenräume, Biome, Vegetation, Wasser, Siedlungen, Gratia City, Industrie, Raumhäfen, Fahrzeuge, Beleuchtung und visuelle Prüfverfahren  
**Zielgruppen:** Art Direction, Environment Art, Technical Art, World Generation, Engine, Tools, Level Design, Concept Art, UI/Editor, QA und externe Content-Produktion

## 1. Zweck und Anwendung

Dieses Dokument legt die verbindliche visuelle Sprache von Hestia fest. Es übersetzt die aktuelle Bild-Source-of-Truth, die auditierten Projektdateien und den technischen Forschungsstand in produktionsfähige Regeln. Es ist kein Moodboard und keine lose Sammlung von Vorlieben. Jede generierte Welt, jedes Asset, jeder Editor und jede manuell gebaute Szene muss sich an den hier definierten Prioritäten, Formen, Materialrollen und Prüfverfahren messen lassen.

Das Dokument beantwortet vier Produktionsfragen:

1. Woran erkennt man Hestia sofort?
2. Welche formalen Regeln müssen Generatoren, Assets und Szenen gemeinsam einhalten?
3. Wie wird die gewünschte hohe visuelle Dichte erreicht, ohne in Rauschen, primitive Blockkunst oder glattes Low-Poly abzurutschen?
4. Wie wird eine visuelle Freigabe reproduzierbar geprüft?

Die zugehörigen Detaildokumente sind:

- [02 Hestia Worldgen Editor Authoring Spec](02_Hestia_Worldgen_Editor_Authoring_Spec_v1.md), Übersetzung der Bildsprache in Generator-, Editor- und Authoringregeln
- [03 Hestia Evidence Conflict and Migration Register](03_Hestia_Evidence_Conflict_and_Migration_Register_2026-08-12.md), vollständiges Bildinventar, Deduplizierung, Quellenklassen, Konflikte und Migrationsentscheidungen

Diese Visual Bible bleibt die normative Zusammenfassung. Dokument 02 präzisiert, wie sie technisch und prozedural umgesetzt werden soll. Dokument 03 belegt, woher eine Aussage stammt und wie Konflikte aufgelöst wurden.

---

## 2. Normative Sprache und Statuslabels

### 2.1 Verbindlichkeitswörter

Die Schlüsselwörter werden in diesem Dokument absichtlich in Großbuchstaben verwendet:

- **MUST:** zwingende Anforderung. Abweichung führt ohne genehmigte Ausnahme zur Ablehnung.
- **MUST NOT:** ausdrücklich verboten.
- **SHOULD:** starke Vorgabe. Abweichung ist nur mit dokumentierter gestalterischer oder technischer Begründung zulässig.
- **SHOULD NOT:** in der Regel zu vermeiden. Eine Ausnahme benötigt einen nachgewiesenen visuellen Vorteil.
- **MAY:** erlaubte Option innerhalb der übrigen Regeln. Keine Verpflichtung.

### 2.2 Evidenz- und Reifestatus

Jede Regel kann zusätzlich einen Status tragen:

- **[BINDEND]:** durch Owner-Entscheidung oder aktuelle Bild-Source-of-Truth festgelegt.
- **[AKZEPTIERT]:** technisch oder visuell in einem abgegrenzten Labor-, Asset- oder Prototypkontext bestätigt.
- **[ZIEL]:** visuell klar gefordert, aber noch nicht in allen Laufzeitkontexten technisch bewiesen.
- **[KANDIDAT]:** begründete Option, die vor globaler Festschreibung getestet werden muss.
- **[RICHTWERT]:** hilfreicher Zahlen- oder Dichtebereich, kein automatisches Pass/Fail.
- **[OFFEN]:** noch nicht entschieden. Darf nicht stillschweigend als finale Regel behandelt werden.
- **[ÜBERHOLT]:** historisch relevant, aber nicht mehr als positive Stilvorgabe gültig.
- **[ABGELEHNT]:** explizites Negativbeispiel.

Wenn Verbindlichkeitswort und Status kollidieren, gilt die engere Aussage. Beispiel: „0,125 m MAY lokal getestet werden [KANDIDAT]“ ist keine globale Produktionsfreigabe.

---

## 3. Authority, Supersession und Konfliktauflösung

### 3.1 Autoritätsreihenfolge

Bei visuellen Widersprüchen gilt folgende Reihenfolge:

1. **Aktuelle, im Auftrag bereitgestellte Konzeptbilder [BINDEND].** Sie sind die gegenwärtige visuelle Source of Truth.
2. **Explizite Owner-Aussagen [BINDEND].** Insbesondere: Hestia ist fein blockartig und voxelbasiert. Low-Poly ist nicht das positive Ziel.
3. **Die sechs bestätigenden `target-*`-Bilder der Hestia-V2-Referenzpakete [ZIEL].** Sie bestätigen Küsten-, Archipel-, Feuchtland-, Vegetations-, Wasser- und Materialrichtung, bleiben aber der aktuellen Owner Source of Truth nachgeordnet.
4. **Aktuelle Projekt-Memory- und Forschungsdokumente [AKZEPTIERT],** soweit sie der aktuellen Source of Truth nicht widersprechen.
5. **Stadt-, Industrie- und Raumhafenbilder [BINDEND für Semantik, ZIEL für Microvoxel-Übersetzung].** Ihr glatter fotorealistischer Renderstil ist nicht bindend.
6. **Ältere Biome- und Landschaftskonzepte [RICHTWERT].** Motiv, Stimmung und Umweltfunktion dürfen übernommen werden, nicht überholte Oberflächenstile.
7. **Prototyp-, Gate-, Benchmark- und Debugbilder [ABGELEHNT oder TECHNISCHE EVIDENZ].** Sie definieren nicht den Zielstil.

### 3.2 Supersession-Regel

- Jede frühere Beschreibung von Hestia als glatte Low-Poly-Welt, Surface-Nets-Look, polygonales Heightfield oder primär dreieckig facettierte Landschaft ist **[ÜBERHOLT]**.
- Diese Begriffe MUST NOT als positives Art-Direction-Ziel verwendet werden.
- Ältere Low-Poly-Bilder MAY weiterhin Makrokomposition, Stimmung, Narration oder Landmarken inspirieren. Ihre Topologie, Facettierung und Materialwirkung MUST NOT übernommen werden.
- „Blockig“ allein genügt nicht. Grobe Minecraft-artige Würfel, Debug-Dioramen und primitive Lollipop-Bäume sind ebenfalls **[ABGELEHNT]**.
- Ein späterer technischer Stand ersetzt eine visuelle Regel nur durch eine dokumentierte Owner-/Art-Direction-Entscheidung. Automatische Agentenbewertung oder gute Performancewerte reichen nicht.

### 3.3 Konfliktprotokoll

Wenn Produktion oder Tooling eine Regel nicht erfüllen kann:

1. Konflikt mit Screenshot, reproduzierbarer Szene und betroffener Regel dokumentieren.
2. Status der technischen Einschränkung angeben.
3. Eine visuell gleichwertige Alternative vorschlagen.
4. Art Direction und technische Eigentümerschaft getrennt entscheiden lassen.
5. Ausnahme, Reichweite und Ablaufdatum dokumentieren.

Eine unbemerkte Vereinfachung ist keine zulässige Ausnahme.

---

## 4. Fünfzehn nicht verhandelbare Pillars

### Pillar 1: Fine block microvoxels

**MUST [BINDEND]:** Die sichtbare Welt besteht im relevanten Nah- und Mittelbereich aus kleinen, achsenorientierten, quadratischen beziehungsweise kubischen Formelementen. Organische Konturen entstehen durch viele feine Stufen. Sichtbare triangulierte Low-Poly-Facetten sind kein Ersatz.

### Pillar 2: Organische Ganzheit, blockige Wahrheit

**MUST [BINDEND]:** Aus der Distanz liest sich die Szene als glaubwürdige Landschaft. Bei Annäherung bleibt die blockige Konstruktion eindeutig. Weder grobe Würfelkunst noch vollständig geglättete Oberflächen erfüllen das Ziel.

### Pillar 3: Authoring vor Noise

**MUST [BINDEND]:** Küsten, Täler, Berge, Wasserscheiden, Flüsse, Höhlen, Landmarken und urbane Achsen besitzen lesbare Ursachen und Hierarchien. Noise MAY modulieren, MUST aber der gestalteten Makrostruktur untergeordnet bleiben.

### Pillar 4: Macro, Meso, Micro

**MUST [BINDEND]:** Jede Hero-Szene weist eine Makrokomposition, meso-strukturelle Formen und mikro-visuelle Details auf. Eine Ebene darf die anderen nicht ersetzen.

### Pillar 5: Hydrologische Glaubwürdigkeit

**MUST [BINDEND]:** Wasser ist verbunden, besitzt Gefälle, Einzugsgebiet, Tiefe, Uferreaktion und nachvollziehbares Ziel. Flüsse enden nicht trocken. Wasserflächen sind keine opaken Cyan-Rechtecke.

### Pillar 6: Habitat statt Streuung

**MUST [BINDEND]:** Vegetation folgt Feuchte, Boden, Höhe, Exposition, Licht und Störung. Pflanzen bilden Cluster und Übergänge. Gleichmäßige Zufallsstreuung ist unzulässig.

### Pillar 7: Hestia-Silhouetten

**MUST [BINDEND]:** Schirm-/Wurzelbäume, terrassierte Massife, gebrochene helle Küsten, farbige Alienflora, transparente türkisfarbene Gewässer und geschichtete Inselhorizonte bilden die Kernsignatur der üppigen Hestia-Regionen.

### Pillar 8: Materialrollen statt Farbflächen

**MUST [BINDEND]:** Materialien besitzen semantische Rollen, Rauheit, Lichtantwort, Top-/Seitenvariation, AO-Verhalten und gegebenenfalls Nässe. Flache Vertexfarbe allein ist nicht ausreichend.

### Pillar 9: Licht modelliert Voxel

**MUST [BINDEND]:** Gerichtetes Licht, kühler Himmelsfill, Kontaktverschattung und atmosphärische Tiefe machen die Microvoxel lesbar. AO darf nicht zu schwarzen Fugen oder Schmutzrauschen werden.

### Pillar 10: Dichte mit Ruhe

**MUST [BINDEND]:** Szenen sind reich, aber hierarchisch. Heroformen, Cluster, Freiflächen, Wasser und Fernräume bilden einen Rhythmus. Gleichmäßige Überfüllung ist ebenso falsch wie visuelle Leere.

### Pillar 11: Planetare Weite

**MUST [BINDEND]:** Außenräume vermitteln Fortsetzung über den Bildrand, Fernlandmarken und geologische Zusammenhänge. Sichtbare Weltplatten, rechteckige Dioramagrenzen und isolierte Testinseln sind nicht zulässig.

### Pillar 12: Biophile Hard-SF-Zivilisation

**MUST [BINDEND]:** Gratia City verbindet modulare Technik, öffentliche Räume, sichtbare Infrastruktur und integrierte Ökologie. Sie ist weder sterile Glasstadt noch Neon-Cyberpunk-Kulisse.

### Pillar 13: Funktion erzeugt Form

**MUST [BINDEND]:** Gebäude, Fahrzeuge, Raumhäfen, Industrie, Wurzeln und geologische Formen besitzen nachvollziehbare Trag-, Verkehrs-, Stoff- oder Erosionslogik. Dekorative Komplexität ohne Funktion ist unzureichend.

### Pillar 14: Gemeinsame Grammatik, eigenständige Biome

**MUST [BINDEND]:** Alle Biome teilen Microvoxel-, Material- und Kompositionsprinzipien, unterscheiden sich aber durch Geologie, Hydrologie, Vegetationsfamilien, Wetter und Farbgewichtung. Reine Paletten-Swaps sind nicht ausreichend.

### Pillar 15: Menschliche visuelle Freigabe

**MUST [BINDEND]:** Metriken, Benchmarks und Agenteneinschätzungen dürfen Probleme markieren, aber keine ästhetische Freigabe erteilen. Die finale Abnahme benötigt unabhängige menschliche Beurteilung anhand fester Vergleichsansichten.

---

## 5. Bildklassen und zulässige Nutzung

| Klasse | Beispiele | Zulässige Nutzung | Unzulässige Nutzung |
|---|---|---|---|
| A: aktuelle visuelle Source of Truth | Aktuelle 20 Anhänge | Formen, Materialwirkung, Licht, Dichte, Komposition, Voxelcharakter, Stadtsemantik | KI-Artefakte, Fantasieschrift oder physikalische Fehler wörtlich kopieren |
| B: bestätigende Zielbilder | `target-01` bis `target-06` | Golden-Scene-Vergleich, Küste, Wasser, Vegetation, Hero-Komposition | Als einzige erlaubte Biome oder gleichrangig zur aktuellen Owner Source of Truth interpretieren |
| C: Stadt-/Industriesemantik | Gratia-City-, Starport- und Industriebilder | Urbanismus, Infrastruktur, Nutzungen, Maßstab, Silhouette | Glatte fotorealistische Mesh-Oberfläche als Ziel erklären |
| D: sekundäre Biome-Konzepte | Bilder 41 bis 44, Biome-Übersicht | Biome-Vokabular, Wetter, Pflanzenfamilien, Geologie | Grobe Zellen, flache Materialien oder Dioramagrenzen übernehmen |
| E: Mood-/Narrationskonzepte | Bilder 36 und 38 | Atmosphäre, Landmarken, Außenposten, Maßstab | Low-Poly-Topologie und polygonale Facettierung übernehmen |
| F: abgelehnte visuelle Baselines | b9, d880, Gate A, alte Coast-Baselines | Anti-Patterns, Regressionserkennung | Positives Stilziel oder Freigabereferenz |
| G: technische Evidenz | AO-, Greedy-, Wireframe-, Benchmarkbilder | Meshing, AO, Debug, Tool- und Performanceprüfung | Schönheit, Komposition oder Materialqualität bewerten |
| H: UI-/Editorbilder | P01, P04, UI-Mockups | Bedienlogik, Informationsarchitektur | Welt-Art-Direction ableiten |

Das vollständige dateigenaue Inventar, die Deduplizierung und die Quellenklassifizierung stehen in [Dokument 03](03_Hestia_Evidence_Conflict_and_Migration_Register_2026-08-12.md). Die operative Übersetzung für Generatoren und Editoren steht in [Dokument 02](02_Hestia_Worldgen_Editor_Authoring_Spec_v1.md).

---

## 6. Formensprache und Skalierung

### 6.1 Grundform

- Sichtbare Voxeloberflächen MUST harte, achsenorientierte Flächen bewahren.
- Normalen MUST NOT eine glatte polygonale Fläche vortäuschen.
- Kurven SHOULD als feine stufige Kontur erscheinen.
- Große Volumen SHOULD zusammenhängend lesbar bleiben. Mikrovariation darf ihre Silhouette nicht zerfransen.
- Interne, nicht sichtbare Flächen SHOULD entfernt oder zusammengeführt werden, sofern dies die visuelle Wahrheit und Editierbarkeit nicht verletzt.
- Wurzeln, Äste, Kronen, Brücken und Leitungen MUST topologisch verbunden erscheinen.
- Materialgrenzen SHOULD großen lesbaren Flächen folgen, nicht zufälligem Zellrauschen.

### 6.2 Voxel-Skalenprofil

| Maßstab | Status | Normative Aussage |
|---|---|---|
| 0,25 m | **[AKZEPTIERT]** in Labor-/Assetkontexten | 0,25 m MAY als gegenwärtige Basisskala für validierte Assets, lokale Szenen und technische Forschung verwendet werden. Diese Akzeptanz beweist keine einheitliche globale Planetenzellgröße. |
| 0,125 m | **[AKZEPTIERT] im committed Adaptive-Microvoxel-Vertrag; [KANDIDAT] [ZIEL] als Produktprofil** | Der Wert ist für das abgegrenzte adaptive Authority-Modul und dessen Tests technisch festgelegt. Seine Verwendung in lokalen Hero-, Nahbereichs-, Wurzel-, Ufer-, Pflanzen- und sichtbaren Oberflächenschalen SHOULD gegen 0,25 m getestet werden, wenn dieses Profil die Zielbilder nicht erreicht. Produktintegration, Einsatzgebiet, Streaming- und Speicherfolgen sind noch zu validieren. |
| 0,5 m und gröber | **[ABGELEHNT]** als alleinige Hero-Nahauflösung | Gröbere Zellen MAY für verdeckte Volumen, Fern-LOD oder interne Repräsentation verwendet werden. Sie MUST NOT im Hero-Nahbereich die sichtbare Formensprache dominieren. |
| globale einheitliche 0,125-m-Planetenzelle | **[OFFEN]** | Dieses Dokument macht ausdrücklich keinen Claim, dass ein ganzer Planet global mit 0,125 m gespeichert, simuliert oder gestreamt werden muss. |

Ein 1,8-m-Mensch erscheint in einer lokalen 0,125-m-Heroauflösung rechnerisch 14,4, also rund 14 bis 15 Zellen hoch. Bei 0,25 m sind es rechnerisch 7,2, also rund sieben Zellen. Dieser Vergleich dient der wahrgenommenen Detailkontrolle, nicht als globale Engine-Vorgabe.

### 6.3 Macro, Meso, Micro

#### Macro

MUST enthalten:

- Kontinent- oder Inselzusammenhang
- Hauptmassiv, Tal, Küstenbogen oder Stadtcluster
- hydrologische Richtung
- Fernhorizont und mindestens eine klare Landmarke
- primäre Bewegungs- oder Blickachse

#### Meso

MUST enthalten:

- Terrassen, Klippen, Uferschelfe, Rinnen und Plateaus
- Baumgruppen, Lichtungen und Vegetationszonen
- Buchten, Engstellen, kleine Inseln oder Wasserfälle
- städtisch: Quartiere, Sockel, Plätze, Transitachsen und Grünzüge

#### Micro

SHOULD enthalten:

- Schichtkanten, Gesteinsbruch, Moos- und Nasszonen
- Wurzeln, Äste, Ranken und Pflanzencluster
- Ufersubstrat und Unterwasserstufen
- Materialvariation mit kontrollierter Frequenz
- städtisch: Fassadenmodule, Öffnungen, Geländer, Technik, Beschilderungsflächen und Wartungselemente

Mikrodetail MUST der Form dienen. Eine detailreiche, aber makro-unlesbare Szene fällt durch.

---

## 7. Terrain und Geologie

### 7.1 Planetare Formfindung

- Gelände MUST zuerst als zusammenhängendes geographisches System konzipiert werden.
- Küsten, Becken, Gebirge, Täler, Flüsse, geologische Provinzen und Hotspots SHOULD als Feature-Graph oder vergleichbare authored Struktur vorliegen.
- Noise MAY Oberflächen und Übergänge variieren, MUST NOT alleinige Quelle für Küste, Bergkette, Fluss oder Höhle sein.
- Lokale 3D-Volumen SHOULD für Höhlen, Überhänge, Bögen, Wurzeln und massive Unterspülungen verwendet werden.
- Der Übergang von planetarem Makrorelief zu lokaler Voxeloberfläche MUST nachvollziehbar sein und keine sichtbaren Repräsentationsbrüche erzeugen.

### 7.2 Küsten- und Kalksteinsprache

Die aktuelle üppige Küsten-Source-of-Truth verlangt:

- warmes, helles Kalkstein-/Sandsteinspektrum ohne final festgeschriebene Hexwerte
- horizontale Sediment- und Terrassenlesbarkeit
- vertikale Abbruchflächen und lokale Überhangnasen
- unregelmäßige gebrochene Küstenkanten
- Gras-/Moosauflage auf horizontalen Oberseiten
- dunklere feuchte Zone am Wasser
- sichtbare Fortsetzung der Geologie unter Wasser
- Pflanzen- und Erosionsnischen

Klippen MUST eine lesbare Oberkante, Wand, Fußzone und Einbettung besitzen. Perfekt konzentrische Konturringe, endlose parallele Stufen oder eine gleichmäßig elfenbeinfarbene Hochzeitstorte sind **[ABGELEHNT]**.

### 7.3 Formbibliothek für Geologie

Production SHOULD mindestens folgende Familien führen:

- Kalkstein, gerade Front
- Kalkstein, konkave Bucht
- Kalkstein, konvexe Nase
- terrassierter Hang
- gebrochener Uferschelf
- einzelner Felsturm
- Tafelberg-/Mesa-Schulter
- Überhang und Unterspülung
- Bachrinne und Wasserfalllippe
- dunkler Nassfelsfuß
- Vulkanbasaltstufe
- Sturmklippenkanal
- Kristallaufbruch
- trockene Canyonwand

Jede Familie SHOULD mehrere Silhouetten, Materialrollen, Neigungs- beziehungsweise Richtungsvarianten und Anschlussregeln besitzen.

---

## 8. Hydrologie und Ufersysteme

### 8.1 Hydrologische Struktur

- Weltgeneratoren MUST Ozean, Einzugsgebiete, Abflussrichtung, Seen, Überlaufpunkte, Flussordnung, Breite, Tiefe und Feuchtzonen explizit repräsentieren.
- Flüsse MUST eine Quelle oder einen plausiblen Zufluss und ein Ziel besitzen.
- Seen MUST hydrologisch erklärt sein.
- Wasser SHOULD Gelände erodieren und Ufer, Sediment, Vegetation und Materialfeuchte beeinflussen.
- Flussbreite, Tiefe und Uferform SHOULD mit Einzugsgebiet und Gefälle variieren.
- Übergänge zu Feuchtgebiet, Lagune, Delta, Riff oder Meer SHOULD biome- und geologieabhängig sein.

### 8.2 Visuelle Wassergrammatik

- Flachwasser MUST transparent genug sein, um Substrat und Unterwasserterrassen zu lesen.
- Wasser SHOULD von hellem Aqua/Türkis im Flachbereich zu dunklerem Cyan, Teal und Blau in der Tiefe übergehen.
- Die Oberfläche SHOULD leichte Wellennormalen, Fresnel und gerichtete Sonnenreflexe besitzen.
- Nasse Gesteins- und Sandzonen MUST an der Wasserlinie erkennbar sein.
- Schaum MAY an Wasserfällen, Stromschnellen, Brandungs- oder Hinderniskanten auftreten, SHOULD aber nicht als durchgehende weiße Kontur verwendet werden.
- Caustics MAY im klaren Flachwasser verwendet werden, sofern sie die Voxelstruktur nicht überdecken.
- Die Wasseroberfläche MAY physikalisch glatt wirken. Ufer, Boden, Stufen und Interaktion MUST blockig bleiben.

### 8.3 Uferstempel

Ein Uferstempel SHOULD kombinieren:

- gebrochene Landkante
- Sand- oder Feinsedimenttasche
- Kalk-/Felsstufe
- dunkle Nasszone
- flache Unterwasserplattform
- Pflanzenanker, Wurzel oder Schilfzone
- mindestens eine unregelmäßige konkave oder konvexe Abweichung

Gerade rechteckige Ufer, opake Wasserplatten und trockene Flussenden sind Hard Fails.

---

## 9. Vegetation und ökologische Verteilung

### 9.1 Signaturbaum: Schirm-/Wurzelbaum

Der Schirm-/Wurzelbaum ist eine zentrale Hestia-Silhouette.

Ein Heroexemplar MUST:

- einen unregelmäßig verjüngten und gerichteten Stamm besitzen
- einen glaubwürdigen Lastpfad von Wurzeln über Stamm zu Ästen zeigen
- mindestens mehrere sichtbare Hauptäste besitzen
- eine breite, flache, asymmetrische Krone aus mehreren Lappen bilden
- eine durchbrochene Silhouette und lokale Ausleger besitzen
- materiallich zwischen Wurzel, Stamm, Ast, Blattmasse und gegebenenfalls Moos unterscheiden
- topologisch verbunden sein

Ein Hero-Wurzelbaum SHOULD als Richtwert mindestens vier lesbare Stützwurzeln und vier bis acht Hauptäste besitzen. Ranken MAY abhängig von Feuchte, Alter und Exposition auftreten.

MUST NOT:

- dünner Zylinder- oder Stabstamm plus Kugelkrone
- Würfelkrone aus einem Block
- perfekte radiale Symmetrie
- identische Wurzelwinkel
- schwebende Kronenteile ohne sichtbare Verbindung

### 9.2 Baumfamilien

Für jede dominierende Art SHOULD es Varianten geben für:

- jung, mittel, alt und beschädigt
- trocken, feucht und überflutet
- windgeschützt und windexponiert
- Hang, Ebene, Ufer und Felsnische
- Einzelbaum, Clusterbaum und Randbaum
- lebend, abgestorben und teils gebrochen

Die Variation SHOULD Silhouette und Struktur verändern, nicht nur Skalierung und Farbe.

### 9.3 Boden- und Akzentflora

Die Source of Truth zeigt wiederkehrende Akzentfamilien:

- cyan-/türkisfarbene Sukkulenten, Korallen- oder Spießformen
- orange-/rostfarbene Schilf-, Blüten- oder Spierformen
- violette-/magentafarbene Blüten-, Moos- und Polstergruppen
- hellgrüne Bodendecker und kleine Kronenbüsche
- dunklere vertikale Feuchtpflanzen

Pflanzen MUST als ökologische Cluster auftreten. Ein Cluster SHOULD einen dichten Kern, auslaufende Ränder, unterschiedliche Höhen und gerichtete Asymmetrie aufweisen.

### 9.4 Habitatregeln

- Schilf, Stützwurzeln und hohe Feuchtpflanzen SHOULD an Wasser, Schlamm und Überflutungszonen gebunden sein.
- Moos SHOULD schattige, feuchte Kanten und Nord-/Leeseiten bevorzugen, soweit Klima und Planetparameter dies unterstützen.
- Sukkulenten und farbige Akzentpflanzen SHOULD in lesbaren Nischen und Ensembles wachsen.
- Bäume SHOULD tragfähige Plateaus, Terrassen, Kämme, Uferinseln und Lichtungen besetzen.
- Exponierter Fels SHOULD geringere, gerichtete Vegetationsdichte besitzen.
- Offene Wiesen MUST durch Mikrorelief, niedrige Pflanzen, kleine Steine, Farbcluster und Schattenvariation belebt bleiben.

Gleichmäßige Zufallsstreuung, farbiges Konfetti und einzelne bunte Stäbe sind **[ABGELEHNT]**.

---

## 10. Biome-Sprache

### 10.1 Gemeinsamer Biomevertrag

Jedes Biom MUST definieren:

1. Makrorelief und geologische Provinz
2. Wasserhaushalt und typische Gewässerform
3. Boden- und Materialfamilien
4. mindestens eine dominante Pflanzensilhouette
5. zwei bis vier unterstützende Flora-Clusterfamilien
6. Wetter-, Sichtweiten- und Lichtcharakter
7. Störungsregime wie Sturm, Feuer, Vulkanismus, Überschwemmung oder Trockenheit
8. Landmarken- und Navigationssprache
9. saisonale oder dynamische Varianten, falls relevant
10. klare Übergangsregeln zu angrenzenden Biomen

### 10.2 Biome-Profile

#### Küste und Lagune

- Inselketten, Buchten, Kanäle, helle Terrassen, klare Unterwasserstufen
- Schirmbäume, farbige Uferflora und vereinzelte Riff-/Sukkulentenformen
- helle warme Sonne, hohe Klarheit, Aqua- bis Tiefblauverlauf
- SHOULD als primäre Golden-Scene-Familie dienen

#### Feuchtgebiet und Sporenmoor

- verzweigte Flachwasserarme, niedrige Inseln und langsam bewegtes Wasser
- große Stützwurzeln, Schilf, Pilz-/Sporenformen und feuchte Bodendecker
- lokale Nebelschleier, starke Reflexe und dunklere Nassmaterialien
- MAY biolumineszente Akzente tragen, aber SHOULD tagsüber nicht von Neon dominiert werden

#### Savanne und Plateau

- offene Ebenen, Tafelberge, flache Rinnen und verstreute Felsrücken
- lichte Schirmbaumgruppen, trockenere Gräser, Sukkulenten und Farbinseln
- warmes, etwas härteres Licht und hohe Fernsicht
- große Ruheflächen MUST weiterhin Mikrodetail und Habitatlogik besitzen

#### Hochlandwald

- bewaldete Hänge, Bäche, Felsschultern und Lichtungen
- kühlere Baum- und Farnfamilien, dichtere Cluster, lokale Nadel-/Hochlandformen
- mehr Dunst, feuchte Schatten und stärkere Höhenstaffelung

#### Nebelbruchwald

- geschützte Rinnen, verwachsene Felsinseln, nasse Senken und Wasserfälle
- große Wurzelbäume, Ranken, Moos und feuchte Alienflora
- tealfarbener Nebel und verkürzte Fernsicht
- Nebel MUST die Silhouette unterstützen, nicht die gesamte Materiallesbarkeit auslöschen

#### Xerische Wüstenebene und Salzsteppe

- seltenes, räumlich begrenztes Insel-, Regenschatten-, Vulkan- oder Salzprofil, keine kontinentale Großwüste und kein global dominantes Hestia-Biom
- warme Mesas, trockene Täler, Felsnadeln, Sedimentfelder und hydrologisch erklärte Oasen oder Restfeuchte
- Kakteen-, Sukkulenten- und trockenheitsangepasste Baumfamilien
- klare Materialtrennung zwischen Sand, Fels, Salz und Oasenfeuchte
- MUST NOT als leere beige Heightfield-Fläche oder wasserferne Endloswüste umgesetzt werden

#### Vulkanlandschaft

- Caldera, Basaltterrassen, Lavakanäle, Asche und geothermische Öffnungen
- dunkle Gesteine, Lavaorange, Dampf und sparsame hitzeresistente Flora
- thermische und atmosphärische Effekte SHOULD räumlich an Quellen gebunden sein

#### Kristallfeld

- offene Felder, Bruchzonen und gerichtete Kristallcluster als Landmarken
- Cyan-, Blau- und Violettfamilien mit geologischer Orientierung
- Glanz und Emission MAY verwendet werden, MUST aber Form und Material nicht ersetzen

#### Sturmklippen

- dunklere Küstenstufen, ausgeschnittene Kanäle, hohe Sprüh- und Windbelastung
- windgerichtete Nadel-/Polsterflora und niedrigere Kronen
- kühlere Palette, dynamischer Wolkenzug und Gischt

#### Riffterrassen

- ausgedehnte Flachwasserschelfe, Lagunen, Riffkanten und lebende Unterwasserfelder
- Fächer-, Korallen-, Schilf- und Wasserpflanzenfamilien
- starke Unterwasserfarbigkeit bei weiterhin lesbarem Substrat

### 10.3 Biome-Kontrast

Biome MUST sich durch mindestens drei der folgenden fünf Achsen sichtbar unterscheiden:

- Makrogeologie
- Wasserform
- Pflanzensilhouette
- Materialfamilie
- Wetter und Sichtweite

Ein bloßer Farbtausch derselben Terrassenlandschaft ist kein eigenes Biom.

---

## 11. Materialien, Rauheit und Oberflächenreaktion

### 11.1 Semantische Materialfamilien

Die Produktion SHOULD mindestens folgende Rollen führen:

- helles warmes Kalkgestein
- poröser Sand/Strand
- dunkler Nassfels
- Gras und Moos
- Erde, Schlamm und Sediment
- Rinde, Holz und Totholz
- Blätter/Kronenmasse
- cyanfarbene Akzentflora
- orangefarbene Akzentflora
- violette Akzentflora
- klares Flach- und Tiefenwasser
- Vulkanbasalt, Asche und Lava
- Kristall
- städtischer Beton-/Keramikverbund
- dunkles Metall und Fassadenrahmen
- Glas
- technische Leucht-, Informations- und Sicherheitsmaterialien

### 11.2 Materialanforderungen

Jede wichtige Familie MUST definieren:

- Albedo- beziehungsweise Palettenbereich
- Rauheitsbereich
- Normal- oder kontrollierte Mikrodetailantwort
- AO-Verhalten
- Top-/Seiten-/Unterseitenvariation, wo relevant
- Nasszustand, wo relevant
- zulässige deterministische Farbvariation
- verbotene Flecken- und Rauschmuster

Dieses Dokument schreibt bewusst keine finalen Hex-Paletten fest. Die Konzeptbilder liefern relative Farbrollen und Beziehungen, aber keine kalibrierten Produktionswerte. Eine finale Farbtafel bleibt eine offene Art-Direction-Entscheidung.

### 11.3 Rauheitslogik

- Trockener Kalk und Sand SHOULD überwiegend matt bis seidenmatt reagieren.
- Nassfels und nasse Erde SHOULD dunkler und glatter sein, ohne spiegelnden Kunststofflook.
- Blätter MAY gerichtete Glanzantwort besitzen, SHOULD aber nicht wie lackierte Platten wirken.
- Rinde und poröse Materialien SHOULD rauer als Metall, Wasser oder Glas sein.
- Stadtmetall MAY zwischen gebürstet, lackiert und oxidiert variieren.
- Glas MUST transparent beziehungsweise reflektiv lesbar bleiben, ohne die Microvoxel-Fassadenstruktur zu verschlucken.

### 11.4 Kontrollierte Variation

- Variation SHOULD großflächige Materialzonen unterstützen.
- Einzelzellen-Mosaik ohne Formbezug MUST NOT verwendet werden.
- Oberseiten MAY heller, trockener oder stärker bewachsen sein als Seitenflächen.
- Nässe MUST hydrologisch erklärbar sein.
- Schmutz und Alterung SHOULD sich an Fugen, Wasserwegen, Nutzung und Exposition orientieren.

---

## 12. Ambient Occlusion, Schatten und Lesbarkeit

- AO MUST aus Geometrie beziehungsweise Belegung abgeleitet und räumlich plausibel sein.
- AO SHOULD Voxelvertiefungen, Wurzelkontakte, Terrassen, Fassadenfugen und Materialübergänge lesbar machen.
- AO MUST NOT als gebackener schwarzer Rand auf jeder Zelle erscheinen.
- Kleine konkave Bereiche SHOULD dunkler sein als offene Flächen, ohne Details zu verschlucken.
- Chunk- oder LOD-Nähte MUST AO-kontinuierlich erscheinen.
- Diagonal- beziehungsweise Greedy-Triangulierung MUST keine sichtbaren Shading-Flips erzeugen.
- Beauty-Captures SHOULD zusätzlich mit AO aus und an geprüft werden, um Material- und Geometriefehler zu trennen.

Zu starke schwarze Fugen erzeugen Miniaturmodell-, Comic- oder Schmutzoptik und sind ein Hard Fail, wenn sie die Materialfarben dominieren.

---

## 13. Licht, Himmel, Wetter und Tageszeit

### 13.1 Primärer Tageszustand

Die Golden Scenes verwenden einen klaren, optimistischen Tageszustand:

- warmer gerichteter Sonnen-Key
- kühler Himmelsfill
- klare Kontakt- und Formschatten
- helles Zenith und leicht wärmerer Horizont
- atmosphärische Blauverschiebung in der Ferne
- mehrere glaubwürdige Cumulusgruppen
- sichtbare Sonnenreflexe und Transparenz im Wasser

Dieser Zustand SHOULD die primäre visuelle Vergleichsbasis für Material, Vegetation und Küste bilden.

### 13.2 Himmel

- Der Himmel MUST einen glaubwürdigen Gradient, Sonnenrichtung und atmosphärische Tiefe besitzen.
- Wolken MAY blockig aufgebaut sein, MUST aber als volumetrische beziehungsweise gestaffelte Cumulusgruppen gelesen werden.
- Einzelne riesige weiße Quaderwolken sind **[ABGELEHNT]**.
- Der Himmel SHOULD die Szene rahmen, nicht mangels Inhalt mehr als die Hälfte des Bildes belegen.

### 13.3 Wetterfamilien

MAY umfassen:

- klarer Küstentag
- warmer Dunst
- Nebelbruchwald
- Tropenregen
- Sturmklippenwetter
- vulkanischer Asche-/Dampfzustand
- Morgen- und Abendlicht
- Nacht mit gezielten biologischen und urbanen Lichtquellen

Jede Wettervariante MUST eine nachvollziehbare Wirkung auf Sichtweite, Nässe, Wasser, Pflanzenbewegung und Lichtfarbe haben.

### 13.4 Licht-Anti-Patterns

- leerer, unbeleuchteter Gradienthimmel
- vollständig schwarze Schatten
- Bloom, der Formen und Zellkanten überstrahlt
- Nebel als Kaschierung fehlender Inhalte
- gleichmäßiges Frontlicht ohne Volumenmodellierung
- Neonlicht als Ersatz für Material- und Formqualität

---

## 14. Komposition und Kamera

### 14.1 Drei Tiefenebenen

Hero- und Marketingansichten MUST mindestens drei Tiefenebenen besitzen:

1. Vordergrundrahmen durch Baum, Wurzel, Klippe, Flora, Ufer oder Architektur
2. Mittelgrund mit Kanal, Inselgruppe, Tal, Platz oder Transitachse
3. Hintergrund mit Massiv, Inselkette, Bergen, Stadtcluster oder offenem Horizont

### 14.2 Blickführung

Bevorzugte Elemente:

- S-förmiger Wasserkanal
- mäandrierender Fluss
- gestaffelte Inselkette
- diagonale Terrassenkante
- Straße, Bahn oder Skywalk
- seitlich versetzte Hero-Landmarke
- Durchblick zwischen Klippen oder Gebäuden

### 14.3 Kamerafamilien

Production MUST Szenen in mehreren Kamerakontexten prüfen:

- **Eye-Level Hero:** niedrige bis menschliche Höhe, sichtbare Voxel- und Habitatqualität
- **Traversal:** echte Spielkamera mit Bewegungskorridor und Interaktionsdistanz
- **Elevated Vista:** Landschafts- oder Stadtzusammenhang, aber keine reine Satellitensicht
- **Top/Planning:** Hydrologie, Biome, Quartiere und Generatorstruktur
- **Asset Turntable:** Front, Seite, Rückseite, Dreiviertel, Top und Kontaktfläche

### 14.4 Kompositions-Anti-Patterns

- Heroobjekt exakt in der Mitte ohne Gegenrhythmus
- keine Vordergrundebene
- horizontale Schichten ohne Blickführung
- leerer Himmel als Füllfläche
- zufällige Verteilung ohne Fokalpunkt
- sichtbare Weltgrenze
- extreme Tiefenschärfe, die nur eine Miniatur vortäuscht
- Kamera steckt in Wand, Boden, Baum oder Schüssel

---

## 15. Gratia City

### 15.1 Stadtidentität

Gratia City ist eine große, dichte, küstengebundene, biophile Hard-SF-Metropole. Sie MUST zugleich fortschrittlich, bewohnt, öffentlich und infrastrukturell glaubwürdig wirken.

Sie ist:

- vertikal und horizontal geschichtet
- modular, aber nicht repetitiv
- dicht, aber durch Plätze, Wasser und Grün belüftet
- technisch sichtbar, aber nicht steril
- nachhaltig als räumliches System, nicht als aufgeklebte Pflanzenfassade
- eng mit Küste, Inseln, Bergen, Kanälen und Raumfahrt verbunden

### 15.2 Skyline und Quartiere

- Skyline MUST unterschiedliche Höhen, Dichten und Cluster besitzen.
- Hohe, schlanke Türme SHOULD mit mittleren und niedrigen Sockel-/Quartiersstrukturen verbunden sein.
- Landmarken SHOULD Verkehrsknoten, Civic-Funktion, Forschung oder Raumfahrtbezug ausdrücken.
- Wohn-, Markt-, Campus-, Industrie-, Hafen- und Starportquartiere MUST visuell unterscheidbar sein.
- Untere Ebenen MUST bewohnt und zugänglich wirken, nicht bloß Technikpodium für Türme.
- Stadtteile SHOULD topografisch und hydrologisch reagieren.

### 15.3 Architektursprache

Bevorzugt:

- modulare kubische Baukörper
- gestaffelte Terrassen
- asymmetrische Turmgruppen
- kräftige Sockel und technische Kerne
- Loggien, Einschnitte und echte Öffnungen
- Brücken, Skywalks und vertikale Schächte
- Dachgärten, Wasserbecken und öffentliche Terrassen
- sichtbare Wartungs- und Versorgungsebenen

Materialrollen:

- helle Beton-/Keramikverbunde
- anthrazitfarbene Trag- und Fassadenrahmen
- Glas
- gedämpfte Metalle
- Vegetationsgrün
- Cyan für Information, Energie und Navigation
- Gelb/Orange für Logistik, Warnung und Wartung

Diese Angaben sind relative Rollen. Finale Farbwerte bleiben offen.

### 15.4 Microvoxel-Übersetzung

- Fassaden MUST aus echten Modulen und feinen blockigen Konturen entstehen.
- Fenster, Türen und Loggien SHOULD echte Tiefe besitzen.
- Balkone, Skywalks und Geländer MUST tragfähig und verbunden wirken.
- Vegetation MUST in nachvollziehbaren Beeten, Trögen, Terrassen und Bodenräumen sitzen.
- Raketen, Tanks, Züge und Fahrzeuge MAY rundlich gelesen werden, müssen aber feine Voxelkonturen bewahren.
- Glatte Meshfassaden und aufgemalte Öffnungen sind nicht ausreichend.

### 15.5 Transit

Gratia City SHOULD ein mehrstufiges Netz besitzen:

- Fußgänger- und Platzebene
- Straßen- und Serviceverkehr
- Bahn, Tram oder Monorail
- erhöhte Transitachsen und Brücken
- vertikale Aufzüge und Knoten
- Wasserverkehr
- planetare Flug- und Landezonen
- Verbindung zum orbitalen Raumhafen

Jede Trasse MUST zu sichtbaren Zielen führen und sich in Quartiere integrieren. Dekorative Schienen oder Skybridges ohne funktionale Anschlüsse sind unzulässig.

### 15.6 Grün und Wasser in der Stadt

- Grün MUST strukturell integriert sein.
- Dach- und Terrassengärten SHOULD unterschiedliche Nutzungs- und Pflegegrade zeigen.
- Bäume MUST ausreichenden Wurzelraum besitzen.
- Wasserbecken, Kanäle und Recyclinganlagen SHOULD zur Topografie und Entwässerung passen.
- Biodiversität SHOULD zwischen formellen Parks, produktiven Gärten, Straßenbäumen und wilderen Korridoren variieren.
- Eine gleichmäßige grüne Decke auf jeder Kante ist nicht glaubwürdig.

### 15.7 Öffentliche Räume

Die Stadt MUST Räume für Menschen zeigen:

- Marktplätze
- Parks und Gartenhöfe
- Uferpromenaden
- Transitforen
- Sport- und Kulturflächen
- öffentliche Terrassen
- Schulen, Forschung und Civic-Gebäude
- Blickbezüge zu Wasser, Bergen und Raumfahrt

Maßstab wird durch Personen, Möblierung, Schatten, Zugänge und Verkehrsbewegung vermittelt. Generische leere Plazas sind nicht ausreichend.

### 15.8 Stadt-Anti-Patterns

- identische Glastürme im Raster
- Neon-Cyberpunk als Hauptidentität
- Vegetation als zufälliger Fassadenteppich
- ausschließlich Hochhäuser ohne Quartiere
- glatte Low-Poly- oder Fotoreal-Meshoberflächen ohne Voxelübersetzung
- unverbundene Verkehrsebenen
- Fantasieschrift als festgeschriebene Lore
- fliegende Fahrzeuge ohne Korridore, Knoten oder Sicherheitslogik

---

## 16. Industrie und Raumhafen

### 16.1 Systemische Lesbarkeit

Ein Raumhafen MUST als verbundenes System erkennbar sein:

- Rakete oder Raumschiff
- Start- beziehungsweise Serviceturm
- Montage-/Integrationshalle
- Tanks und Druckbehälter
- Rohrleitungen und Energieversorgung
- Sicherheits- und Sperrzonen
- Bahn- und Straßenanschluss
- Hafen-/Containerlogistik
- Wartungs- und Rettungsfahrzeuge
- Kontroll-, Crew- und Servicegebäude

### 16.2 Formensprache

- Raketen SHOULD schlank, vertikal und technisch geschichtet sein.
- Gantries MUST funktionale Plattformen, Zugänge, Leitungen und Abstände zeigen.
- Tankfarmen SHOULD wiederholte Familien besitzen, aber durch Größe, Inhalt, Wartung und Anschluss variieren.
- Rohre MUST Quellen und Ziele besitzen.
- Montagehallen MUST dem Fahrzeugmaßstab entsprechen.
- Sicherheitsabstände, Zufahrten und Serviceflächen MUST räumlich plausibel sein.
- Küstenraumhafen, Industrie, Hafen und Stadt SHOULD als zusammenhängendes Logistiksystem gelesen werden.

### 16.3 Fahrzeuge

Fahrzeugformen SHOULD funktionsgeführt sein:

- Frachter mit Laderaum, Antrieb und Landestruktur
- Shuttle mit Passagierzugang und kompakterem Volumen
- Servicefahrzeuge mit Kabine, Chassis und Werkzeug-/Nutzbereich
- Züge als horizontale Maßstabs- und Logistikträger
- Schiffe und Fähren als Verbindung der Inselwelt

Spielzeugproportionen, zufällige Greebles und Technik ohne Zweck sind zu vermeiden.

---

## 17. Außenposten und kleine Siedlungen

### 17.1 Rolle

Außenposten verbinden Zivilisation, Exploration und Biom. Sie SHOULD kleiner, funktionaler und stärker auf den Standort reagierend sein als Gratia City.

### 17.2 Grundbausteine

Ein Außenposten MAY enthalten:

- Lande- oder Anlegepunkt
- Habitat- und Arbeitsmodule
- Energie-, Wasser- und Kommunikationssystem
- Lager und Fahrzeugwartung
- Forschungs- oder Extraktionsfunktion
- Schutz vor lokalem Wetter
- klaren Bewegungsring und Notfallroute

### 17.3 Biome-Integration

- Feuchtland-Außenposten SHOULD erhöht, verankert und wasserverträglich sein.
- Sturmklippen-Außenposten SHOULD niedrige, windgeschützte Silhouetten und robuste Verankerung besitzen.
- Vulkan-Außenposten MUST thermische Distanz und Schutz berücksichtigen.
- Wüsten-Außenposten SHOULD Schatten, Staubschutz und Wasserlogik zeigen.
- Hochland- und Nebelposten SHOULD Sicht-, Kommunikations- und Hangrisiken räumlich lösen.

Ein Außenposten MUST das Biom berühren und beeinflussen, darf aber nicht wie ein generisches Modulset auf beliebigem Terrain stehen.

---

## 18. Assetfamilien und Produktionsstandard

### 18.1 Family Sheet

Jede Assetfamilie MUST dokumentieren:

- reale und konzeptuelle Referenzen
- Maße in Metern und relevante Zellskala
- zwei bis vier oder mehr unterscheidbare Silhouetten
- erlaubte Materialrollen
- verbotene Formen
- Variationsachsen
- Kontakt- und Stützlogik
- Pivot, Anker und Anschlussstellen
- LOD-/Volumenstrategie
- Einsatzbiome und Habitatregeln
- Prüfansichten

### 18.2 Mindestfamilien

#### Geologie

- Klippenfronten
- Terrassen
- Ufer
- Felsblöcke
- Überhänge
- Rinnen
- Höhlen-/Bogenmodule
- Vulkan-/Kristallvarianten

#### Vegetation

- Hero-Wurzelbäume
- Küsten-Schirmbäume
- Hochlandbäume
- Büsche und Bodendecker
- Feuchtschilf
- cyan-, orange- und violettfarbene Akzentcluster
- Ranken, Moos und Totholz

#### Stadt

- Sockel- und Quartiersmodule
- Wohnen, Handel, Civic, Forschung und Industrie
- Fassadenraster und Öffnungen
- Brücken, Skywalks und Transitstationen
- Dach- und Terrassengärten
- Straßen-, Platz- und Ufermodule
- Service- und Energieelemente

#### Raumfahrt

- Raketen-/Schiffsfamilien
- Gantries
- Tanks
- Rohrnetze
- Montagehallen
- Landeplattformen
- Servicefahrzeuge
- Warn- und Sicherheitsmodule

### 18.3 Asset-Prüfcaptures

MUST umfassen:

- Front
- Seite
- Rückseite
- Dreiviertel
- Top
- Kontaktfläche beziehungsweise Einbettung
- Silhouettenpass
- Material-ID-Pass
- Tiefen-/Normalenpass, wenn technisch relevant
- Connectivity-/Anchor-Ansicht für strukturelle Assets

Ein Beauty-Render allein genügt nicht.

---

## 19. Do und Don't

### 19.1 Do

- DO: große Formen zuerst gestalten und Noise erst danach einsetzen.
- DO: feine Blockstufen sichtbar halten.
- DO: Hydrologie als verbundenes Netz behandeln.
- DO: Vegetation nach Habitat clustern.
- DO: Bäume mit Wurzel-, Stamm-, Ast- und Kronenlogik bauen.
- DO: helle trockene, dunkle nasse und bewachsene Materialrollen trennen.
- DO: Vordergrund, Mittelgrund und Hintergrund aufbauen.
- DO: offene Wasser- und Wiesenflächen als Ruhe nutzen.
- DO: Stadtinfrastruktur funktional verbinden.
- DO: Assets mit menschlichem und technischem Maßstab prüfen.
- DO: feste Kameras und Golden-Scene-Vergleiche nutzen.
- DO: Performance als Guardrail nach visueller Zielerfüllung messen.

### 19.2 Don't

- DON'T: Low-Poly als positive Stilbeschreibung verwenden.
- DON'T: glatte triangulierte Heightfields als Hauptoberfläche einsetzen.
- DON'T: grobe Minecraft-Blöcke mit Microvoxels verwechseln.
- DON'T: endlose konzentrische Terrassen erzeugen.
- DON'T: opake Cyan-Wasserplatten verwenden.
- DON'T: Bäume aus Stäben und Kugeln bauen.
- DON'T: Pflanzen zufällig als farbige Einzelstäbe streuen.
- DON'T: leere beige Ebenen als Biom ausgeben.
- DON'T: Bloom, Nebel oder AO zum Verdecken fehlender Formqualität nutzen.
- DON'T: sichtbare Weltplatten oder Dioramagrenzen zeigen.
- DON'T: generische Glasstadt oder Neon-Cyberpunk als Gratia City ausgeben.
- DON'T: Metriken oder Selbstbewertung als finale Art-Freigabe verwenden.

---

## 20. Prompt-Schablonen

Prompts sind Produktionshilfen. Sie ersetzen keine Art-Direction-Abnahme. Jede Schablone enthält positive Zielmerkmale und explizite Ausschlüsse.

### 20.1 Landschaftskonzept, allgemeine Schablone

```text
Erzeuge eine Hestia-[BIOM]-Szene als fein aufgelöste Microvoxelwelt. Alle festen Formen bestehen aus kleinen, klar blockartigen, achsenorientierten Voxeln. Aus der Distanz wirkt die Landschaft organisch, im Nahbereich bleiben die feinen quadratischen Stufen sichtbar.

Makrokomposition: [HAUPTLANDMARKE], [TAL/INSELKETTE/KÜSTENBOGEN], zusammenhängende Hydrologie und planetare Fortsetzung über den Bildrand.
Mittelgrund: [S-KANAL/FLUSS/LAGUNE/LIGHTUNG], gebrochene Terrassen, mehrere Vegetationscluster und eine klare Bewegungsroute.
Vordergrund: [WURZELBAUM/KLIPPE/UFER/FLORA] als Rahmen.
Materialien: semantisch getrennte trockene Felsen, nasse Ufer, Boden, Vegetation und transparentes Wasser mit Rauheits- und Lichtunterschieden.
Licht: warmer Sonnen-Key, kühler Himmelsfill, klare Kontaktverschattung, atmosphärische Fernstaffelung und glaubwürdige blockige Cumulusgruppen.
Vegetation: habitatgebundene, asymmetrische Schirm-/Wurzelbäume und geclusterte cyan-, orange- und violettfarbene Alienflora.

Vermeide glattes Low-Poly, triangulierte Heightfields, grobe Minecraft-Blöcke, konzentrische Hochzeitstorten-Terrassen, Kugelbäume, zufällige Pflanzenstäbe, opakes Cyan-Wasser, sichtbare Weltgrenzen, leeren Himmel, übermäßigen Bloom und schwarze AO-Fugen.
```

### 20.2 Hero-Küsten-/Lagunen-Szene

```text
Hestia Hero-Küste als fein blockige Microvoxel-Szene, menschliche Augenhöhe. Zwei asymmetrische helle Kalkstein-Landmassen bilden einen S-förmigen transparenten türkisfarbenen Flachwasserkanal. Unterwasserterrassen und dunklere Nasszonen sind sichtbar. Ein großer Wurzel-/Schirmbaum rahmt rechts, ein zweiter links oder im Vordergrund. Mehrere kleinere Schirmbäume, gebrochene Uferstempel und dichte, habitatgebundene cyan-, orange- und violettfarbene Pflanzencluster führen in die Tiefe. Hintergrund mit Inselmassiv und gestaffeltem Ozeanhorizont. Warme Sonne, kühler Himmelsfill, weiche atmosphärische Tiefe und mehrere Cumulusgruppen.

Keine Low-Poly-Facetten, keine glatten Heightfields, keine Lollipop-Bäume, keine opake Wasserplatte, keine sichtbare Dioramakante, keine gleichförmigen Konturringe.
```

### 20.3 Gratia City

```text
Gratia City auf Hestia, eine dichte biophile Hard-SF-Küstenmetropole in feiner Microvoxel-Bauweise. Vertikal geschichtete, asymmetrische Turmcluster wachsen aus belebten gemischt genutzten Sockelquartieren. Modulare helle Beton-/Keramikkörper, dunkle Trag- und Fassadenrahmen, Glas, echte Loggien, Dachgärten und öffentliche Terrassen. Bodenebene mit Markt, Park, Wasserbecken und Menschen. Verbundene Bahn-, Straßen-, Fußgänger-, Skywalk- und Wasserverkehrsebenen führen zu sichtbaren Knoten. Küste, Berge und Inseln bleiben Teil der Stadtkomposition. Cyan dient Information und Navigation, Gelb/Orange Logistik und Sicherheit. Klare Tagesbeleuchtung und atmosphärische Tiefe.

Alle Architektur- und Fahrzeugkonturen sind fein blockig. Vermeide glatte fotorealistische Meshes, generische Glastürme, sterile leere Plazas, Neon-Cyberpunk, zufällige Fassadenbegrünung, unverbundene Skybridges und unlesbare Fantasieschrift.
```

### 20.4 Raumhafen

```text
Hestia-Küstenraumhafen als funktionslesbarer Hard-SF-Komplex in feiner Microvoxel-Formensprache. Schlanke voxelkonturierte Rakete, Startgantry mit Plattformen und Leitungen, große Montagehalle, logisch verbundene Tankfarm, Rohrleitungen, Sicherheitszonen, Bahn, Straße, Hafenlogistik, Wartungs- und Rettungsfahrzeuge. Stadt-Skyline und Ozean im Hintergrund zeigen den regionalen Zusammenhang. Helle technische Materialien, dunkle Rahmen, gelb/orange Sicherheitsmarkierungen und kontrollierte Cyan-Informationselemente. Warmer klarer Tag mit kühlem Himmelsfill.

Keine Spielzeugproportionen, keine zufälligen Greebles, keine Rohre ohne Quelle oder Ziel, keine glatten Low-Poly-Raketen, keine unplausible Verdichtung im Startbereich.
```

### 20.5 Negative Prompt-Kernliste

```text
low-poly target style, smooth triangulated terrain, surface-nets visual style, coarse Minecraft blocks, voxel diorama edge, flat vertex colors, beige empty heightfield, concentric contour rings, lollipop trees, sphere canopy, cube canopy, random colored rods, opaque cyan water plane, empty gradient sky, giant white block cloud, crushed black AO, excessive bloom, generic neon cyberpunk city, disconnected roads or pipes, toy spacecraft proportions
```

Der Begriff „low-poly“ erscheint hier ausschließlich als negativer Ausschluss.

---

## 21. Golden Scenes

Golden Scenes sind feste Vergleichsszenen mit kontrollierter Kamera, Sonne, Wetter, Renderpfad und Inhalt. Sie dienen visueller Regression, nicht nur Marketing.

### GS-01 Coastal Valley

**Bezug:** `target-01-coastal-valley.png` und aktuelle offene Küsten-/Savannenbilder  
**Prüft:** offene Dichte, helle Geologie, Baumverteilung, Fernsicht, Küstenhorizont  
**MUST:** offene Wiesenfläche, mehrere Höhenstufen, Schirmbaumhierarchie, farbige Flora, Wasser- oder Küstenbezug, keine visuelle Leere

### GS-02 Archipelago Mountain

**Bezug:** `target-02-archipelago-mountain.png`  
**Prüft:** planetare Weite, Inselhierarchie, Unterwasserterrassen, zentrales Massiv  
**MUST:** Hauptinsel, Nebeninseln, mehrere Tiefenebenen, klare Schelfzonen, asymmetrische Silhouette

### GS-03 Wetland Roots

**Bezug:** `target-03-wetland-roots.png`  
**Prüft:** First-Person-Qualität, Stützwurzeln, Wassertransparenz, Pflanzencluster  
**MUST:** verbundener Hero-Wurzelbaum, sichtbare Flachwassergeometrie, Schilf-/Akzentcluster, keine schwebenden Pflanzenteile

### GS-04 Terraced Coast

**Bezug:** `target-04-terraced-coast.png`  
**Prüft:** Klippenmodule, Wasserfälle, Terrassenrhythmus, hohe biologische Dichte  
**MUST:** gebrochene Schichten, mehrere Pools, Wasserhöhenwechsel, kontrollierte Dichte und Ferninseln

### GS-05 Lagoon Channel

**Bezug:** `target-05-lagoon-channel.png`  
**Prüft:** S-Kanal, Uferübergang, Augenhöhe, Blickführung  
**MUST:** Kanal führt zum Meer, Vordergrundrahmen, Unterwasserstufen, gebrochene Ufer und klare Nasszonen

### GS-06 Forested Island

**Bezug:** `target-06-forested-island.png`  
**Prüft:** Vegetationsdichte auf Massiv, Baumgrößen, Küsten-/Bergübergang  
**MUST:** zentrale Massivhierarchie, mehrere Kronenebenen, sichtbare Geologie unter Vegetation, umlaufende Küste

### GS-07 Gratia City Core

**Bezug:** aktuelle Stadtbilder und `Hestia - Futuristische Grossstadt`  
**Prüft:** Skyline, gemischte Sockel, öffentlicher Raum, mehrstufiger Transit, Grünintegration  
**MUST:** mindestens drei Gebäudehöhenklassen, belebte Bodenebene, verbundene Transitachsen, öffentlicher Platz und Küsten-/Bergkontext

### GS-08 Gratia Eco District

**Bezug:** niedrige Inselstadt mit Kanälen, Campus, Sport und Terrassenwohnen  
**Prüft:** geringe bis mittlere Dichte, Wasserintegration, Alltag und Biodiversität  
**MUST:** unterschiedliche öffentliche und private Grünräume, Kanal-/Entwässerungslogik, Bahn-/Fußverbindung, keine homogene grüne Decke

### GS-09 Hestia Spaceport

**Bezug:** aktuelle Raketen- und Industrieansichten  
**Prüft:** Maßstab, funktionale Zonierung, Microvoxel-Fahrzeugkonturen und Logistik  
**MUST:** Rakete, Gantry, Halle, Tanks, Rohrnetz, Bahn/Straße, Servicefahrzeuge und glaubwürdige Sicherheitsräume

### GS-10 Biome Transition

**Bezug:** Biome-Übersicht und sekundäre Biome-Bilder  
**Prüft:** Übergang statt harter Palettenkante  
**MUST:** graduelle Änderung von Geologie, Bodenfeuchte, Pflanzensilhouette und Wetterwirkung über einen zusammenhängenden Raum

### Capture-Vertrag

Jede Golden Scene MUST mindestens erfassen:

- feste Beauty-Kamera
- Eye-Level-Ansicht
- erhöhte Übersicht
- AO an und aus
- Material-/Albedopass
- Tiefenansicht
- Nahaufnahme mit Maßstabsfigur
- Performance- und LOD-Ansicht, separat von der Beauty-Abnahme

---

## 22. QA-Scorecard

### 22.1 Bewertungsverfahren

Eine Szene wird in zehn Kategorien mit je 0 bis 5 Punkten bewertet. Maximalwert: 50.

| Wert | Bedeutung |
|---:|---|
| 0 | fehlt oder widerspricht der Source of Truth vollständig |
| 1 | rudimentär, deutlich falsch oder nur technisch vorhanden |
| 2 | erkennbarer Ansatz, aber große visuelle Defizite |
| 3 | produktionsbrauchbar mit klaren Nacharbeiten |
| 4 | erfüllt die Zielrichtung überzeugend |
| 5 | Golden-Scene-Niveau, stärkt die Hestia-Identität |

### 22.2 Kategorien

| Kategorie | Gewichtete Prüfidee | 0-Punkt-Beispiel | 5-Punkt-Merkmale |
|---|---|---|---|
| 1. Microvoxel-Formtreue | Blockstruktur, Zellmaßstab, harte Konturen | glattes Low-Poly | organische Gesamtform, klar feine Blockwahrheit im Nahbereich |
| 2. Makrokomposition | Landmarke, Blickführung, planetare Fortsetzung | isolierte Platte | klare Hierarchie, starke Fernform, Fortsetzung über Bildrand |
| 3. Meso-/Mikrodetail | Terrassen, Ufer, Wurzeln, Materialübergänge | Noise oder Leere | gestaffelte authored Formen und kontrolliertes Detail |
| 4. Geologie | Schichtung, Erosion, Materialrollen | konzentrische Beige-Ringe | glaubwürdige Schichten, Brüche, Top/Wand/Fuß und regionale Identität |
| 5. Hydrologie | Verbindung, Tiefe, Ufer und Substrat | Cyan-Platte | zusammenhängender Lauf, Tiefengradient, Nasszone, sichtbarer Boden |
| 6. Vegetation/Ökologie | Silhouette, Cluster und Habitat | Lollipop-Bäume | verbundene Wurzelbäume, Arten-/Altersvarianz, habitatgebundene Cluster |
| 7. Materialien/Licht | Rauheit, AO, Schatten, Atmosphäre | flache Farbe | klare Materialantwort, lesbare Zellen, ausgewogene AO- und Ferntiefe |
| 8. Dichte/Lesbarkeit | Rhythmus, Fokus und Ruheflächen | leer oder gleichmäßig voll | hohe lokale Dichte, klare Heroformen und lesbare Freiräume |
| 9. Funktion/Narration | Ortslogik, Nutzung, Bewegung | zufällige Dekoration | Umwelt oder Infrastruktur erzählt nachvollziehbare Prozesse |
| 10. Source-of-Truth-Parität | Gesamtwirkung relativ zu Golden Scene | anderer Stil | sofort als Hestia erkennbar, Motiv und Qualitätsniveau stimmen |

Für Stadt- oder Raumhafenszenen wird Kategorie 9 zusätzlich anhand von Urbanismus, Transit, Versorgung, öffentlichem Raum und Logistik bewertet. Für Naturwelten liegt der Schwerpunkt auf Ökologie, Geologie und Hydrologie.

### 22.3 Freigabeschwellen

- **45 bis 50:** Golden Candidate. MAY nach unabhängiger visueller Prüfung zur Golden Scene werden.
- **40 bis 44:** Release Candidate. SHOULD nur geringe lokale Korrekturen benötigen.
- **35 bis 39:** Conditional Pass. MUST mit dokumentierter Fixliste nachgearbeitet werden.
- **30 bis 34:** Fail. Wesentliche Art-Direction-Lücke.
- **unter 30:** Fundamental Fail. Szene oder Generatoransatz neu ausrichten.

Zusatzbedingungen:

- Keine Kategorie darf unter 3 liegen, um Release Candidate zu sein.
- Kategorien 1, 4, 5, 6 und 10 MUST mindestens 4 erreichen, wenn sie für die Szene relevant sind.
- Ein Hard Fail überschreibt jede Punktzahl.
- Die Bewertung MUST durch mindestens eine Person erfolgen, die die Szene nicht selbst erzeugt hat.

### 22.4 Hard Fails

1. Low-Poly-Facetten oder glattes trianguliertes Heightfield dominieren die sichtbare Hauptoberfläche.
2. Glatte Normalen löschen die Microvoxel-Lesbarkeit im Nahbereich aus.
3. Grobe 0,5- bis 1-m-Blöcke dominieren Heroobjekte ohne lokale Verfeinerung.
4. Sichtbare rechteckige Welt- oder Dioramagrenze.
5. Opake cyanfarbene Wasserplatte ohne Tiefe, Substrat und Uferreaktion.
6. Fluss endet trocken oder Wasser schneidet unplausibel durch Gelände.
7. Hauptbäume bestehen aus Stab plus Kugel-/Würfelkrone.
8. Vegetation ist überwiegend zufällige Gleichverteilung oder farbiges Stabkonfetti.
9. Gelände besteht überwiegend aus endlosen konzentrischen Terrassen.
10. Materialien sind im Wesentlichen flache Einheitsfarben ohne semantische Oberflächenreaktion.
11. AO erzeugt dominante schwarze Fugen oder sichtbare Chunk-/LOD-Nähte.
12. Szene besitzt weder klare Landmarke noch drei Tiefenebenen.
13. Kamera steckt in Geometrie oder zeigt einen unbeabsichtigten leeren/abgeschnittenen Raum.
14. Gratia City ist eine generische sterile Glas- oder Neonstadt ohne öffentliche und infrastrukturelle Logik.
15. Raumhafen besitzt unverbundene Rohre, Trassen oder unplausible Sicherheits- und Logistikräume.
16. KI-Artefakte oder Fantasieschrift werden als finale Gestaltung übernommen.
17. Visuelle Freigabe beruht ausschließlich auf Metriken, Benchmark oder Selbsteinschätzung des erzeugenden Agenten.

### 22.5 Review-Reihenfolge

1. Silhouette ohne Material
2. Maßstab mit Mensch, Fahrzeug und Baum
3. First-Person-Microvoxel-Lesbarkeit
4. Makro-/Meso-Komposition
5. Geologie
6. Hydrologie
7. Vegetation und Habitat
8. Materialien ohne Bloom und Nebel
9. Licht und AO an/aus
10. Golden-Scene-Parität
11. LOD-/Streaming-Übergänge
12. Performance als Guardrail
13. unabhängige Art-Direction-Abnahme

---

## 23. Offene Entscheidungen

Die folgenden Punkte sind absichtlich nicht als final entschieden dargestellt:

| Thema | Status | Benötigte Entscheidung oder Evidenz |
|---|---|---|
| Globale Planetenzellgröße | **[OFFEN]** | Streaming-, Speicher-, Editier- und Persistenzmodell über mehrere Maßstäbe validieren |
| Lokale 0,125-m-Oberflächenschale | **[KANDIDAT] [ZIEL]** | Vergleich mit 0,25 m in GS-03 und GS-05, inklusive Speicher, Meshing und Editierkosten |
| Fern-LOD-Darstellung | **[OFFEN]** | Volumencoarsening, Impostor-/Clusterstrategie und Silhouettenkontinuität festlegen, ohne glattes Low-Poly als sichtbares Stilziel |
| Finale Materialpalette und Hexwerte | **[OFFEN]** | kalibrierte Art-Direction-Tafel unter festem Tonemapping erstellen |
| Tonemapper, Belichtung und Farbraum | **[OFFEN]** | Golden-Scene-Capturevertrag technisch fixieren |
| Wassertechnik | **[OFFEN]** | Transparenz, Tiefe, Caustics, Wellen, Interaktion und voxelbasierte Uferkopplung benchmarken |
| Atmosphären- und Wolkenlösung | **[OFFEN]** | blockige visuelle Sprache mit Performance und Wetterdynamik abgleichen |
| Vegetationsanimation | **[OFFEN]** | Wind, Baumkronen, Schilf und LOD-Verhalten definieren, ohne die Blockstruktur zu verformen |
| Biome-Übergangsbreiten | **[OFFEN]** | ökologische und spielerische Regeln pro Biom-Paar spezifizieren |
| Unterwasser-Art-Direction | **[OFFEN]** | Sichtweite, Farbabsorption, Riffdichte, Caustics und Interaktion als eigene Golden Scene definieren |
| Nacht- und Emissionsbudget | **[OFFEN]** | urbane und biologische Lichtquellen definieren, ohne Neon-Dominanz |
| Stadtmodulmaß und Gebäuderaster | **[OFFEN]** | menschlichen Maßstab, Microvoxelauflösung, Interiorfähigkeit und Generatoranschlüsse gemeinsam festlegen |
| Fahrzeugauflösung und Voxelisierung | **[OFFEN]** | Silhouettenziel für Mensch, Bodenfahrzeug, Zug, Shuttle, Frachter und Rakete definieren |
| Destruktionszustände von Assets | **[OFFEN]** | visuelle Bruchflächen, Materialinneres, Connectivity und LOD koppeln |
| Farb-/Formidentität weiterer Planeten | **[OFFEN]** | Hestia-Signatur gegen universelle Weltraum-Projektgrammatik abgrenzen |

Offene Entscheidungen dürfen prototypisiert werden. Sie MUST in Captures und Berichten als offen oder experimentell gekennzeichnet bleiben.

---

## 24. Produktionsübergabe

Für jedes neue Biom, Assetpaket, Generator-Feature oder Stadtquartier ist folgende Übergabe erforderlich:

1. verwendete Bildklasse und konkrete Referenzen
2. normative Regeln dieses Dokuments
3. gewählte Zellskalen und deren Status
4. Material- und Habitatrollen
5. feste Prüfszene und Kamera
6. Golden-Scene-Zuordnung
7. Scorecard mit Kommentar pro Kategorie
8. Liste vorhandener Hard-Fail-Prüfungen
9. offene technische oder visuelle Abweichungen
10. unabhängiger Reviewer und Entscheidungsdatum

Ohne diese Angaben ist ein Ergebnis ein Experiment, kein freigegebener Produktionsbaustein.

---

## 25. Kompakte Definition der Hestia-Designsprache

Hestia MUST wie eine große, zusammenhängende und ökologisch reiche Welt wirken, deren natürliche und gebaute Formen aus kleinen blockartigen Voxeln bestehen. Ihre Landschaften verbinden authored planetare Makroformen mit terrassierter Geologie, logischer Hydrologie, transparentem türkisfarbenem Wasser, asymmetrischen Schirm-/Wurzelbäumen, habitatgebundenen farbigen Pflanzenclustern, materialorientierter Lichtreaktion und starker atmosphärischer Tiefe. Ihre Zivilisation übersetzt dieselbe feine Blockwahrheit in eine biophile Hard-SF-Architektur mit gemischten Quartieren, öffentlichen Räumen, sichtbarer Versorgung, verbundenem Transit und funktionslesbarer Raumfahrtindustrie.

Die Welt ist nicht Low-Poly. Sie ist nicht grob. Sie ist nicht glatt. Sie ist fein blockig, reich, lesbar, systemisch und unverwechselbar Hestia.
