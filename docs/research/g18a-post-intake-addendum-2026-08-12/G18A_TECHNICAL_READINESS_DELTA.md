# G18A Technical Readiness Delta

**Status:** `REQUIRES_OWNER_DECISION`  
**Voxel-Lab-Head:** `c64aeef1f51dd0ed2d8431411cf3ba1e84195b9d`  
**Produkt-Main-Boundary:** `BenjaminHornung/Weltraum-Spiel@15f3550bd604856b25d40a7ac700ec4d5106b89e`

## 1. Kernkorrektur gegenüber G18

G18 behandelte WP04 noch als nicht integrierten technischen Blocker. Dieser Satz ist für den aktuellen Lab-Stand superseded.

| Gegenstand | G18-Historie | G18A-Stand |
|---|---|---|
| akzeptierter Lab-Head | `d95992df05952ac4be6221ca1809c1c9e3c0ac9d` | `c64aeef1f51dd0ed2d8431411cf3ba1e84195b9d` |
| WP04 | blockiert beziehungsweise noch zu prüfen | `ACCEPTED_AND_INTEGRATED` im Voxel-Lab |
| Commit | WP03-Basis | `#VOXEL-LAB-004 Complete WP04 visual evidence contract` |
| Produktintegration | nicht erfolgt | weiterhin nicht erfolgt und vor WP12 gesperrt |
| Benchmark-Synthese | nachgelagert | C08 bleibt separates Gate |

## 2. Readiness nach Evidenzklasse

| Gegenstand | Klasse | Status | Zulässiger Claim |
|---|---|---|---|
| WP04 Block-AO, Palette-v1, AO-kompatibles Greedy Meshing und Visual-Evidence-Vertrag | `Runtime Evidence`, Lab | `ACCEPTED_AND_INTEGRATED` | Der benannte Lab-Commit enthält den integrierten WP04-Vertrag. |
| WP04 als Hestia-Artpass | nicht belegt | `NOT_ESTABLISHED` | Lab-Evidence beweist keine Parität zur Hestia Visual Language. |
| Produkt-Main | `Runtime Evidence`, Produkt | fixiert bei `15f3550...` | Nur committed Produktfunktionen dieses Stands dürfen als implementiert gelten. |
| Lab-Kernel in Produkt-Main | Produktintegration | `BLOCKED_UNTIL_WP12` | Keine Integration vor WP12 und expliziter Entscheidung. |
| C08 Benchmark-Synthese | separates Research-/Gate-Artefakt | `SEPARATE_GATE` | Nicht in G18A hineinziehen, nicht aus WP04 ableiten. |
| X01 Shared Contracts | `Research Proposal` | `REQUIRES_OWNER_DECISION` | kein verbindlicher Kernelvertrag |
| Storyboard-Sequenzsystem | `Research Proposal` | `BLOCKED_BY_PREREQUISITES` | keine Main-Implementierung |
| Hestia Authoring Spec | gemischt: accepted scope labels plus Proposal/Open | `NOT_PRODUCT_IMPLEMENTATION` | Design- und technische Zielverträge, kein pauschaler Runtimeclaim |

## 3. Was WP04 nun belegt

Der commitgebundene WP04-Stand belegt im Voxel-Lab einen vollständigen technischen Evidence-Vertrag für den abgegrenzten Lab-Scope. Dazu gehören unter anderem AO-on/off-Captures, deterministische Vergleichsquellen, ROI-Verträge, vier AO-Debugklassen, materialbewusste Coverage, Diagonal- und Byte-Invarianten sowie explizit als Diagnostik markierte Timingwerte.

G18A übernimmt keine einzelnen Performancezahlen als Benchmarkresultat. Der Commit selbst klassifiziert Timing als diagnostisch, nicht als Benchmark-Gate.

## 4. Was WP04 nicht belegt

- keine planetare Streaming- oder Persistenzreife;
- keine Produktintegration;
- keine finale Engineentscheidung;
- keine Hestia-Golden-Scene-Parität;
- keine finale Hestia-Materialpalette;
- keine universelle Voxelgröße;
- keine Destruktions-, Physik- oder Hydrologieintegration;
- keine Berechtigung, C08 zu überspringen;
- keine Änderung der Lizenz- oder Contributionentscheidung des Repositories.

## 5. Serielle Gates

| Gate | Voraussetzung | Status in G18A |
|---|---|---|
| WP04 Lab Technical | integrierter Commit und akzeptierte Evidence | geschlossen bei `c64aeef...` |
| C08 Benchmark Synthesis | eigener Scope, Methodik, Rohsamples und Ownerpolicy | separat, nicht durch G18A geschlossen |
| WP12 Integration Boundary | akzeptierte Vorstufen plus explizite Integrationsentscheidung | offen |
| Produktintegration | WP12, Rechte, Ziel-Main-SHA, Owner und Integrationsplan | gesperrt |
| Editor-/Command-Kernel-Write | D-037 plus X01-/Owner-Prerequisites | gesperrt |

## 6. Mainline-Wahrheitsgrenze

Branch-Artefakte G18, P06, X01, X02, Storyboard und Hestia Visual Language sind Dokumentations- und Researchstände auf eigenen Branches. Sie werden nicht als in `Weltraum-Spiel@15f3550...` implementiert dargestellt.

Zulässige Formulierungen:

- „X01 schlägt vor ...“
- „X02 führt im Patchvorschlag den Status ...“
- „Der Storyboard-Bericht definiert als Proposal ...“
- „Die Hestia Visual Language setzt das Designziel ...“
- „WP04 ist im Voxel-Lab bei `c64aeef...` akzeptiert und integriert ...“

Unzulässige Formulierungen:

- „Main verwendet bereits X01-Pakete.“
- „Das Produkt besitzt bereits SequenceDocumentV1.“
- „WP04 beweist die visuelle Hestia-Zielqualität.“
- „C08 ist durch WP04 erledigt.“
- „Die Hestia Authoring Spec ist vollständig implementiert.“

## 7. Ergebnis

Die technische Lab-Reife ist gegenüber G18 klar gestiegen. Die Produktreife hat dadurch nicht automatisch denselben Sprung gemacht. Der nächste erlaubte Schritt ist Owner- und Gate-Klärung, nicht Integration.

