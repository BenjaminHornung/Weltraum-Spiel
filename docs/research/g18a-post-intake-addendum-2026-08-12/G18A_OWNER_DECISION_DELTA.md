# G18A Owner Decision Delta

**Status:** `REQUIRES_OWNER_DECISION`  
**X02-Basis:** `BenjaminHornung/Weltraum-Spiel@53a78b3465075f52bcaa44df1a48bdb2f28cbc7a`  
**Wichtige Grenze:** X02 ist ein Freeze- und Patch-Vorschlag. Der Patch ist nicht als angewandt belegt.

## 1. Statussemantik

G18A übernimmt die X02-Statussemantik exakt:

| Status | Bedeutung |
|---|---|
| `ACCEPT` | Entscheidung war in der Quellenlage bereits ausdrücklich akzeptiert |
| `REJECT` | eine akzeptierte Regel oder die X02-Resolution schließt die Option aus; bei neu vorgeschlagenem Logeintrag bleibt die Anwendung separat nachzuweisen |
| `DEFER` | keine Ownerentscheidung; sicherer Default ist keine Produktfreigabe und keine Schreibautorität |
| `SPIKE_FIRST` | ein begrenzter isolierter Spike ist vor einer Entscheidung nötig; keine Produktfreigabe |

Empfehlungen, Research-Baselines und gut ausgearbeitete Schemas werden nicht automatisch `ACCEPT`.

## 2. Belegte akzeptierte Anker

| ID | Akzeptierter Kern | G18A-Auswirkung |
|---|---|---|
| D-001 | Browser-/Chromium-first, harte Blockvoxels, CPU-Zustand als Authority | Renderer und UI bleiben abgeleitet; keine Low-Poly-Hauptdarstellung |
| D-004 | Benchmarkprotokoll und Provenienzpflicht | Timing-HUDs bleiben Diagnostik; C08 bleibt eigenständiges Gate |
| D-005 | serielle BR-/WP-Reihenfolge | keine Parallelfreigabe abhängiger Write-Pakete |
| D-010 | keine Lab-zu-Produkt-Integration vor WP12 | WP04-Reife bleibt Lab-Wahrheit |
| D-012 | 0,25 m als V1-Referenzprofil; 0,125 m nur lokale Research-/scopespezifische Evidenz | keine universelle Produktauflösung behaupten |
| D-013 | Lizenz- und Provenienzmanifest, kein Kopieren unlizenzierter Inhalte | P02- und P05-Grenzen sind harte Adoptionsbedingungen |
| D-022 | menschliche visuelle Prüfung für Art Direction | keine automatische Hestia-Freigabe durch Metriken oder Agenten |

## 3. X02-Patchstatus D-024 bis D-048

Die folgende Tabelle gibt die X02-Disposition wieder. Sie dokumentiert keine Anwendung des Patchs.

| ID | Thema, verkürzt | X02-Status | G18A-Folge |
|---|---|---|---|
| D-024 | MVP-Scope | `DEFER` | kein stiller MVP-Freeze |
| D-025 | Survival-/Bedürfnis-Scope | `DEFER` | keine Gameplayannahme als Architekturinput |
| D-026 | First-City-Zeitpunkt | `DEFER` | City- und Progressionprompts bleiben owner-blocked |
| D-027 | Orbit-/Raumfahrtzeitpunkt | `DEFER` | P04-Mockwerte sind keine Produktentscheidung |
| D-028 | Combat-Scope | `DEFER` | keine implizite Combat-Authority |
| D-029 | Singleplayer-/Multiplayergrenze | `DEFER` | Kollaboration, Persistenz und Locking bleiben offen |
| D-030 | Developer-App-Topologie | `SPIKE_FIRST` | isolierte Topologieprüfung, keine Produktintegration |
| D-031 | Player Construction | `DEFER` | keine Player-Build-Rechte ableiten |
| D-032 | gemeinsamer Kernel | `SPIKE_FIRST` | nur nach Prerequisites und D-037; keine Vorabfreigabe |
| D-033 | privilegierte direkte KI-Mutation | `REJECT` im X02-Patchvorschlag | G18A behandelt die Route als ausgeschlossen; neue Log-ID/Anwendung bleibt Owneraufgabe |
| D-034 | menschliches Approval für jeden KI-Commit | `DEFER` | sicherer Default: kein KI-Autocommit |
| D-035 | Data-only Mods | `DEFER` | kein Mod-Scope akzeptiert |
| D-036 | G03 Hybrid Build | `SPIKE_FIRST` | nur isoliert und nach D-037 |
| D-037 | Ziel-Repo/Pfad, Basis-SHA, Scope, sole Write Owner | `DEFER` | harter Write-Blocker |
| D-038 | normativer Craft-Frame | `DEFER` | explizite Frame-IDs und getesteter `CraftFrameAdapter`; keine stille +X/+Z- oder Handedness-Umdeutung |
| D-039 | `CraftBlueprintV2` | `DEFER` | nur mit verlustfreiem V1-Migrator; `ShipBlueprintV1` bleibt Migrationsquelle; keine zweite Craft-Authority |
| D-040 | Tactical Pause im lokalen Singleplayer | `DEFER` | kein Pause-Oracle oder Zeitbalanceclaim; Planpause bleibt nur Default, kein Freeze |
| D-041 | Drone Lost Link | `DEFER` | nur deterministischer Safe-Hold/Return-Default; keine neue Zielwahl, Eskalation oder bewaffnete Autonomie |
| D-042 | NPC-/City-Größen | `SPIKE_FIRST` | zuerst 64 persistent/16 `FULL` als Harness messen; 80 bis 250/16 bis 48 ist separater ungemessener City-Scope, keine Produktzusage |
| D-043 | wall-clock-basierte Offlinefortschreibung | `DEFER` | Default aus; kein harter Offlineverlust; späterer Catch-up nur event-/grenzenbasiert nach Entscheid |
| D-044 | Contribution Governance | `DEFER` | keine externen Contributions oder Codeextraktion bis Lizenz, Rechteinhaberschaft und DCO/CLA/geschlossen entschieden sind |
| D-045 | reale H2-/H3-Geräte | `DEFER` | keine Hardcaps oder Performanceversprechen ohne Hardware-, Browser-, OS-, Fixture- und Capturevertrag |
| D-046 | WebGL2 als H3-Fallback | `DEFER` | WebGL2-Pfad erhalten; keine H3-spezifische Backend- oder Leistungsbehauptung |
| D-047 | Save-Supportfenster | `DEFER` | exakte Locksets und Original-Save erhalten; keine stille Substitution; öffentliches Supportfenster offen |
| D-048 | fehlende, digestabweichende oder rechtsunklare Packages | `DEFER` | fail-closed Quarantäne, nicht ausführen oder still ersetzen; repariertes Release braucht neue Version und Digest |

Für die vollständigen Optionen, Defaults, Quellenzeilen und Entry Gates bleibt die X02-Langfassung die maßgebliche Quelle.

## 4. D-037 als harte Schreibsperre

Vor jedem ersten Editor- oder Command-Kernel-Write müssen alle fünf Felder ausdrücklich akzeptiert sein:

| Pflichtfeld | Aktueller Zustand |
|---|---|
| Ziel-Repository | nicht akzeptiert |
| Zielpfad oder abgegrenzter Package-Scope | nicht akzeptiert |
| exakte Basis-SHA | nicht akzeptiert |
| genauer Write-Scope und erlaubte Dateien | nicht akzeptiert |
| alleiniger Write-Owner | nicht akzeptiert |

Zusätzlich muss D-037 selbst auf `ACCEPT` gesetzt oder durch einen ausdrücklich akzeptierten, mindestens gleich strengen Entscheid ersetzt werden. `DEFER` und `SPIKE_FIRST` autorisieren keinen Write.

## 5. Entscheidungsreihenfolge

1. D-037 entscheiden.
2. X01-G06/G15/G16-Varianten entscheiden.
3. Package Ownership und Import Direction akzeptieren oder revidieren.
4. D-032/D-036 nur als enge Spikes konkretisieren.
5. Storyboard-Sequenzdomäne separat entscheiden.
6. Erst danach einen einzelnen Write-Agenten für exakt ein Repository und ein Arbeitspaket autorisieren.

## 6. Nicht vorgenommen

- kein Status wurde aufgrund einer Empfehlung auf `ACCEPT` angehoben;
- X02 wurde nicht als angewandter Decision Log dargestellt;
- keine neue Produktentscheidung wurde aus Prototypen oder Visual Research abgeleitet;
- keine Repository-, Pfad- oder Write-Owner-Auswahl wurde erfunden;
- kein Folgeprompt wurde ausgeführt.

## 7. Ergebnis

Die größte verbleibende Blockade ist nicht technische Unklarheit, sondern fehlende explizite Ownerautorität. D-037 bleibt der erste harte Gate-Entscheid.
