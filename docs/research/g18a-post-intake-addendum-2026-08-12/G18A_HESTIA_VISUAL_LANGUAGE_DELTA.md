# G18A Hestia Visual Language Delta

**Status:** `REQUIRES_OWNER_DECISION`  
**Design-Source:** `BenjaminHornung/Weltraum-Spiel@f7828d186f9db52ac92961dbf6446fb10045605f`  
**Auditierter Produktstand der Source:** `BenjaminHornung/Weltraum-Spiel@15f3550bd604856b25d40a7ac700ec4d5106b89e`

## 1. Bindende visuelle Kurzentscheidung

Hestia ist keine Low-Poly-Welt. Hestia ist eine hochdetaillierte, kleinteilig blockartige Voxel- und Microvoxelwelt.

Diese Aussage ist in G18A `Design Target` und visuelle Owner-Source-of-Truth. Sie ist kein pauschaler Claim, dass Produkt-Main dieses Ziel bereits implementiert.

## 2. Supersession

| Frühere oder konkurrierende Aussage | G18A-Status | Zulässige Restnutzung |
|---|---|---|
| glattes Low-Poly-Terrain als Hestia-Ziel | `HISTORICAL/REJECTED` | höchstens Komposition, Mood oder Landmarke nach expliziter Übersetzung |
| Surface Nets als sichtbarer Hestia-Stil | `HISTORICAL/REJECTED` | technische Legacy-Fixture oder unsichtbare Hilfsrepräsentation |
| facettiertes Heightfield | `HISTORICAL/REJECTED` | keine positive Art-Direction-Nutzung |
| grobe Würfel-/Minecraft-Anmutung | `REJECTED` | Anti-Pattern |
| b9, d880, Gate A | `REJECTED/HISTORICAL` | Regression und Negativbeleg |
| aktuelle technische Lab-Captures | `Runtime Evidence` | Meshing, AO, Debug und technische Prüfung, kein Beauty-Pass |

Ein späterer technischer Stand supersediert das Designziel nur durch eine dokumentierte Owner-/Art-Direction-Entscheidung. Performancewerte oder Agentenselbsteinschätzung reichen nicht.

## 3. Nicht verhandelbarer visueller Kern

G18A übernimmt die fünfzehn Pillars der Visual Bible in verdichteter Form:

1. kleine, harte, achsenorientierte Fine-Block-Microvoxels;
2. organische Gesamtform bei klarer blockiger Nahbereichswahrheit;
3. Authoring und Struktur vor Noise;
4. gemeinsame Macro-, Meso- und Micro-Hierarchie;
5. topologisch und räumlich glaubwürdige Hydrologie;
6. Vegetation nach Habitat statt Gleichverteilung;
7. Hestia-Signaturen aus Schirm-/Wurzelbäumen, hellen Terrassen, farbiger Alienflora, transparentem Türkiswasser und geschichteten Inselhorizonten;
8. semantische Materialrollen statt flacher Farbflächen;
9. Licht und AO dienen der Lesbarkeit der Voxel, nicht schwarzen Fugen;
10. hohe Dichte mit Fokus, Rhythmus und Ruheflächen;
11. planetare Weite ohne sichtbare Dioramaplatten;
12. biophile Hard-SF-Zivilisation statt steriler Glas- oder Neonstadt;
13. Funktion erzeugt Form bei Geologie, Infrastruktur, Architektur und Assets;
14. gemeinsame Grammatik bei eigenständigen Biomen, keine Paletten-Swaps als Ersatz;
15. unabhängige menschliche visuelle Freigabe.

## 4. Design- und Technikgrenze

| Aussage | Klasse | Status |
|---|---|---|
| sichtbare harte quadratische Microvoxels | `Design Target` | bindend |
| 0,25 m | `Technical Contract`, benannter Lab-/Assetscope | akzeptiertes Referenzprofil, nicht universell |
| 0,125 m im Adaptive-Microvoxel-Modul | `Runtime Evidence`/scopespezifischer Contract | für diesen Modulscope akzeptiert |
| 0,125 m als Hero-/Produktprofil | `Research Proposal` | Kandidat/Ziel |
| globale 0,125-m-Planetenzelle | `Open` | ausdrücklich nicht entschieden |
| 32³ plus Halo im akzeptierten Labprofil | `Technical Contract`, Lab | scopespezifisch akzeptiert |
| universelle Chunkkante | `Open` | keine Designentscheidung |
| WP04-Palette 0 bis 4 | `Runtime Evidence`, Lab | Testpalette, keine Hestia-Artpalette |
| AO-Darkness 0,60 | `Visual Pending`/Lab | keine allgemeine Hestia-Freigabe |
| GLB | Derived Product | darf nie aktuelle geometrische Voxel-Authority ersetzen |
| HVOX | vorgeschlagene Asset-Authority | Proposal, keine pauschal implementierte Produktwahrheit |

## 5. Worldgen- und Authoringfolgen

Die visuelle Source-of-Truth verlangt, ohne damit eine Implementierung zu autorisieren:

- planetare Macro-Form, Hydrologie und authored Control Skeleton vor lokaler Detailfüllung;
- Feature- und Plan-Graphen für grenzüberschreitende Flüsse, Straßen, Städte und Infrastruktur;
- deterministische, versionierte Recipes, Manifeste, Seeds, Hashes und Provenienz;
- genau eine aktive Authority je semantischem Zustand;
- Renderer, GLB, LOD, Collision, Navigation und Captures als Derived Products;
- `Unknown`, `MissingCoverage`, `Pending` und `Air` als getrennte Zustände;
- blocktreue sichtbare LODs ohne Umschaltung in einen glatten Low-Poly-Look;
- Stadtplanung über Site, Constraints, District, RoadGraph, Block, Parcel und BuildingIntent, nicht über Objekt-Scatter;
- Asset- und Generatoränderungen nur mit Source Binding, semantischem Diff und menschlicher Review-Evidence.

Die technische Authoring Spec enthält viele `PROPOSED`- und `OPEN`-Verträge. G18A führt sie nicht als bereits implementiert oder akzeptiert.

## 6. Editor- und KI-Grenzen

Die Hestia-Spezifikation beschreibt als Proposal eine gemeinsame Write-Pipeline aus Command, copy-on-write Preview, Prepare, Approval, Compare-and-Swap und atomarem Commit. Dieser Proposal ist mit X01 abzugleichen und durch D-037 blockiert.

KI darf nach der Visual Language nur schemafähige Proposals erzeugen. Sie darf nicht direkt kanonische Welt-, Stadt-, Asset- oder Simulationsdaten schreiben, keine Locks überschreiben, keine Validatoren unterdrücken und keine eigene Golden Scene freigeben.

## 7. Golden-Scene- und Reviewgrenze

Die Visual Bible definiert zehn Golden-Scene-Familien, darunter Küstental, Archipelmassiv, Wetland Roots, Terraced Coast, Lagoon Channel, Forested Island, Gratia City Core, Eco District, Hestia Spaceport und Biome Transition.

Jede produktionsnahe visuelle Abnahme benötigt mindestens:

- feste Kamera und Viewport;
- gebundene Weltrevision, Manifest, Profil und Renderkonfiguration;
- Beauty-, Eye-Level-, erhöhte, AO-on/off-, Material- und Depth-Ansichten;
- Hard-Fail-Prüfung;
- Vergleich zur richtigen Bildklasse;
- unabhängigen menschlichen Reviewer.

Ein WP04-Lab-Capture ist kein Ersatz für diese Hestia-Golden-Scene-Prüfung.

## 8. Harte visuelle Fails

- dominierende Low-Poly-Facetten oder glattes trianguliertes Heightfield;
- ausgelöschte Microvoxel-Lesbarkeit durch glatte Normalen;
- grobe Hero-Nahblöcke ohne lokale Verfeinerung;
- sichtbare Welt- oder Dioramagrenze;
- opake Cyan-Wasserplatte ohne Tiefe, Substrat und Uferreaktion;
- trockene Flussenden oder unplausible Gewässerschnitte;
- Stab-plus-Kugel-/Würfelbäume;
- zufälliger Pflanzen-Scatter ohne Habitatlogik;
- endlose konzentrische Terrassen;
- flache Einheitsmaterialien;
- dominante schwarze AO-Fugen oder sichtbare LOD-/Chunknähte;
- generische sterile Glas- oder Neonstadt;
- unverbundene Infrastruktur;
- KI-Artefakte oder Fantasieschrift als finale Gestaltung;
- Freigabe ausschließlich durch Metriken oder den erzeugenden Agenten.

## 9. Offene Entscheidungen

| Thema | Status |
|---|---|
| universelles Voxel-zu-Meter-Profil | offen |
| finale Chunk-/Brickkante | offen |
| finale Materialregistry und Paletten | offen |
| finale AO-Stärke | visuell offen |
| Wasser-/Hydrologie-Authority | offen |
| Mixed-LOD-Übergang | Research |
| City authored/prozeduraler Anteil | offen |
| konkrete Startstadt/Faction und First-City-Dichte | offen |
| finale Engine/Rendererentscheidung | offen |
| destruktive Fluids und großskalige Terrainzerstörung | separates Research-Gate |

## 10. G18A-Folge

Alle künftigen G18-Folgeprompts müssen Hestias Fine-Block-Microvoxel-Ziel als Design Target binden, dürfen es aber nicht als Runtime Evidence ausgeben. Technische Proxies bleiben zulässig, wenn sie klar als Proxy markiert sind und die sichtbare Zielgrammatik nicht still ersetzen.

