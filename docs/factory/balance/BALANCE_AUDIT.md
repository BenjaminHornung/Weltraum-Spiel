# BAL-00 — Ist-Audit, 2026-10-12

Status: **READONLY_AUDIT_COMPLETE; Produktintegration NOT_RUN.** Verbindlicher Default für die laufende Fertigstellung ist **Strategie A: W09-v1 unverändert lassen**. W09–W11 behalten Priorität. Dieses Dokument aktiviert keine Definition, kein Rezept und keinen Save.

## Beobachtungsbasis und Schreibgrenze

Live-Quellensnapshot: `2026-10-12T08:27:11.663555+00:00`, Worktree `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`, Branch `codex/hestia-fp06-play-candidate-2026-10-12`, HEAD `96cced23cd285b57f8a557d01ac9ed8a158c927f`. Beim ersten Read lagen neun vorhandene Source-/Test-Drafts vor; im Mathreceipt sind zusätzlich die zwei autorisierten C1-Drafts `beltReference.ts` und `conveyor.test.ts` sichtbar, insgesamt elf modifizierte Dateien plus vorhandene untracked PLAY-Evidence. Alles wurde erhalten. Autorisierte Integratorarbeit kann diesen Snapshot nachträglich überholen; ein HEAD allein bezeichnet die Draftbytes nicht.

Root-Control: `/workspace/Weltraum-Spiel/.worktrees/fp06-w00-2026-10-11/docs/factory/fp06/play/2026-10-12`. `source-lock.json` wurde mit SHA-256 `e52bf90e84aeafa00fbf1d4efa2354ad8de9c4d53ce7b4f9f9f8593cb9563697`, `write-ownership.json` mit `bd5b0748a3d24204d45e4ef36def641a30a512ce276b185dfa4f43895bf973e9` gelesen. Der eigene Grant `grants/balance-readonly.json`, SHA `60edcf1239d748e1e7830debcc731e2c0a7b4a136b0e829f9bcb16c98a742567`, enthält `productWriteSet: []`; freigegeben sind ausschließlich vier externe Reviewdokumente und reine Mathematik. Kein SourceLock-/WriteLock-/Produktwrite durch BAL.

Die aktuelle Ownership benennt höchstens zwei Implementierungswriter: `/root/play_integrator` und `/root/play_ui`; Art steht HOLD. Integrator besitzt Host/Physics/Save/Contracts/Entry, UI sieben neue isolierte Pfade. Aktuelle Runtime-, Powerpanel-, S1- und C1-Grants sind eigene PLAY-Grants und **kein Balancegrant**. Die gelesenen einzelnen Grantdateien mit SHA stehen im [Mathreceipt](math-receipt.json). BAL-Referenzreader arbeiteten ausschließlich read-only und zählen nicht als Produktwriter.

Der Root-Control-Snapshot nennt W09 `IN_PROGRESS`, Endgate `NOT_RUN`, W10 `BLOCKED_ON_W09`, W11 `BLOCKED_ON_W09_W10`. Er berichtet eine partielle 341-kg-Schwerroute auf Startsite-v2, Digest `ec8ba9b1`; daraus folgt kein vollständiger 16-kg-Kreislauf. Root meldet zusätzlich Lauf 19 mit 5-cm-Abweichung blockiert und lediglich einen berechneten Marginkandidaten ohne Runtimegrant. Diese PLAY-Browserbefunde wurden von BAL weder ausgeführt noch unabhängig visuell geprüft. Der gespeicherte Remote-main-Pin `e40592c113b72a8dc93725187f92cf948e07f44d` ist ausdrücklich **keine Implementierungsbasis**. Frische Remote-/PR-API-Abfrage: NOT_RUN; in dieser Toolliste fehlt eine entsprechende Connector-API. Die Control-Dokumente berichten historische API-Sperre; externe uncommitted Writer bleiben UNKNOWN.

## Vollständig gelesener Handoff und Quellenrang

Archiv: `HESTIA_FACTORY_BALANCE_5ER_RATEN_CODEX_HANDOFF_2026-10-12`, ZIP-SHA `631c93c5a60803de79fc643345d285ad193e9d4cab6b1120a69c61dd08fa9b75`. README, 01, 02–05, Fixture, vollständiges Python-Skript, Manifest, SHA256SUMS und Smoke wurden gelesen. Frischer eigener Check: **15/15 SHA256SUMS PASS**, Exit 0. Das ursprüngliche Verpackungs-Smoke ist historische Evidence; der separat ausgeführte Mathematiklauf steht im Testbericht.

Die vollständigen historischen Referenzen wurden arbeitsteilig und chunkweise gelesen, einschließlich erneut gelesener truncierter Teilbereiche:

| Referenz unter `references/` | Lückenlose Deckung | SHA-256 | Reader |
| --- | --- | --- | --- |
| `HESTIA_FP01_EINSTIEG_ENERGIE_DETAILPLAN_2026-10-10.md` | 1–2004 | `ec3e605de2c6a4877c2ff0afae244b3215e7bf8bb267feef4c466b546477080c` | `references_readonly` |
| `HESTIA_FP02_PRODUKTIONSKETTEN_GEBAEUDE_LAYOUTS_DETAILPLAN_2026-10-10.md` | 1–1643 | `5c4f068edba3d0c89e77b0d3a40734d4ee1a672c39f3885cbfef31430d942f39` | `fp02_reference_readonly` |
| `HESTIA_FP06_PROTOTYPEN_TECHNISCHE_INTEGRATION_IMPLEMENTIERUNGSPAKETE_2026-10-10.md` | 1–2790 | `501bf5d80ee6dec9627e48ea27c271b3f964d21cde61ce9410be7eb77fa182ea` | `references_readonly` |
| `HESTIA_FP06_SPIELBARER_PROTOTYP_REVIEW_FOLGEAUFTRAG_2026-10-12.md` | 1–476 | `c7dc0493b67ab7637360973c7de18c4fc5c9b832ab2c3191d14bf285763c0152` | `fp02_reference_readonly` |
| `package-status-current.md` | 1–60 | `807187fc6a0f1d1f3eae5b205aea890f8f2d77222c7c302f74838b01a991fb15` | `fp02_reference_readonly` |

FP01 deckt 1–213, 214–260, 261–500, 501–750, 751–1100, 1101–1450, 1451–1750, 1751–2004 ab; FP06 1–350, 351–650, 651–1000, 1001–1350, 1351–1700, 1701–2050, 2051–2400, 2401–2700, 2701–2790. FP02: 1–300, 301–600, 601–800, 801–1000, 1001–1200, 1201–1400, 1401–1643; 451–480 nachgelesen. Review: 1–200, 201–400, 401–476. Status: 1–30, 31–40, 41–60. Alle Archivstatus bleiben historisch; die identischen Originalplanhashes ändern keine aktuellen Contracts.

`AGENTS.md`, README, `docs/current-mainline-state.md`, FP06-Baseline/Decisions und aktuelle PLAY-Control-Dateien wurden direkt gelesen. Der allgemeine Mainline-Status ist ausdrücklich ein Snapshot vom 2026-09-06 auf `15f3550…`; seine damalige HVP-/Save-Abwesenheit darf aktuelle Factory-Drafts nicht überschreiben. FP06 ist die relevante Implementierungsspec; die neue Balance-Vorgabe ist ein ergänzender Designvertrag.

## Tatsächlicher Rezeptkatalog und exakte Nennraten

Alle Zahlen folgen `batch × 60000 / durationMs` als `Fraction`, ohne Rundung. Massengüter verwenden 1 mg; Komponenten ganze Stücke. Leistung meint aktive Prozesslast, Energie ausschließlich Prozessarbeit pro Batch. **Nominal ist bei Versorgung/freiem Ausgang/vollelektrischer Zuweisung; tatsächliche Bedien-/Transport-/Pausezeit ist zusätzlich.**

`C` bezeichnet `apps/weltraum-browser/src/factory/catalog/fp02Catalog.ts`, Version `fp02-factory-catalog-v1`. Alle sieben Rezeptdefinitionen besitzen `version: 1`; der Runtime-Katalogdigest wurde ohne Runtimeausführung **nicht beobachtet**. Die folgenden Rezeptdigests wurden aus den vollständigen statisch gelesenen Definitionen unabhängig kanonisch/FNV-1a berechnet; sie sind keine Browser-Receipts. FNV ist die tatsächliche bestehende Signatursemantik, kein SHA-256-Sicherheitsbeweis. SHA-256 der Dateien steht weiter unten und im Receipt.

| Rezept, Quelle, statisch abgeleiteter v1-Digest | Exakter Batch | Takt / Leistung / Energie | Nennraten bei 100 % | Tatsächliche Freigabe und Konflikt |
| --- | --- | --- | --- | --- |
| REC-01-CUT, `C:74`, `fnv1a:cc0cefe6` | 8 kg Stahl → 7,5 kg Halbzeug + 0,5 kg Verschnitt | 30 s; 1,2 kW; 36.000 J = 1/100 kWh | 16 → 15 + 1 kg/min | Electric first-dry-loop; Input16/Rest1 und Leistung1,2 widersprechen bevorzugtem Raster; v1 geschützt |
| REC-02-PROFILE, `C:76`, `fnv1a:a3dc3ad4` | 7,5 kg Halbzeug → 7 kg Profile + 0,5 kg Verschnitt | 40 s; 2 kW; 80.000 J = 1/45 kWh | 45/4 → 21/2 + 3/4 kg/min = 11,25 → 10,5 + 0,75 | Electric first-dry-loop; alle drei Flüsse außerhalb Hauptflussraster |
| REC-03-SHEET, `C:78`, `fnv1a:03dfab3f` | 7,5 kg Halbzeug → 7 kg Blech + 0,5 kg Verschnitt | 40 s; 2 kW; 80.000 J = 1/45 kWh | 45/4 → 21/2 + 3/4 kg/min | Alternative desselben B07; ein vorhandener Former macht nicht beide gleichzeitig |
| REC-04-CRUSH, `C:80`, `fnv1a:4feb34f8` | 20 kg Gestein → 20 kg Schottermix einschließlich Feinanteil | 20 s; 3 kW; 60.000 J = 1/60 kWh | 60 → 60 kg/min | `planned`, im Dry-Loop nicht admitted; Gestein/Schotter `unbound-v1` ohne Resources-Volumenprofil. Zahlen bereits passend, kein Implementierungsnachweis |
| REC-05-BRACE, `C:82`, `fnv1a:3531c19d` | 4 kg Profile + 2 kg Blech → 1 Stütze à 5,8 kg + 0,2 kg Verschnitt | Manual: Dauer `null`, 0 W Fabriknetz, 0 J Fabriknetz | **Keine zeitgebundene Hand-Nennrate** | Manual first-dry-loop in B05; Auslegen/aktives Montieren/Abschließen sind explizite Commands. Körperarbeit ist kein behaupteter elektrischer Verbrauch |
| REC-05-BRACE, gleiche Definition, anderer Prozess | gleicher Batch | Electric `planned`: 30 s; 4 kW; 120.000 J = 1/30 kWh | 8 Profile + 4 Blech → 58/5 Stützenmasse + 2/5 Verschnitt kg/min; 2 Stützen/min | Nicht admitted. Neue Spezifikation darf 5,8-kg-v1-Stütze nicht zu 5 kg umdeuten |
| REC-06-DRIVE, `C:84`, `fnv1a:17f4ac83` | 3 kg Profile + 1 Harness à 0,8 kg + 1 vorhandener Kern à 2 kg + 1 Controller à 0,2 kg → 1 Modul à 6 kg | 60 s; 4 kW; 240.000 J = 1/15 kWh | 3 + 4/5 + 2 + 1/5 → 6 kg/min; je 1 Harness/Kern/Controller/Modul pro min | `planned`, nicht admitted; Spezialbaugruppe, keine Motorvermehrung. Als seltenes Item legitime dokumentierte Ausnahme |
| REC-07-BELT, `C:86`, `fnv1a:4e0ea579` | 2 kg Profile + 1 kg Blech + 2 kg Elastomer → 1 passives 1-m-Modul à 5 kg | 90 s Manual; 0 W Fabriknetz; 0 J | theoretisch 4/3 + 2/3 + 4/3 → 10/3 kg/min; 2/3 Module/min | Prozess im Katalog first-dry-loop, aber `recipeAdmission.ts:140` lässt Manual nur REC-05/B05 zu: aktuell **nicht admitted**. Keine aktive Serienfertigungsrate behaupten |

`recipeAdmission.ts:135` pinnt Rezept- und Device-Version plus Digest, `:139` Capability/Availability, `:140` die tatsächliche Allowlist. `productionStep.ts:73` definiert `fp06-constant-cold-process-v1`, 100.000 µs Intervalle und `manual-brace-sequence-v1`; `:287` vergleicht aktive vollständige Rezept-/Prozess-/Installationsbytes. Der Katalogloader (`C:157`) akzeptiert genau die vollständigen frozen-v1-Bytes; `contracts.ts:28,56,80,119` ist auf Version1 spezialisiert. Ein neuer Rezeptdatensatz allein wäre heute kein additiv zugelassenes v2-Profil.

## Ratio- und W09-Bilanz

| Verbindung / Fall | Exakte Rechnung | Konsequenz |
| --- | --- | --- |
| CUT → beliebiger einzelner Former | 15 / (45/4) = 4/3 Verbraucher pro Lieferant | Minimales Materialgleichgewicht **3 CUT : 4 Former**. Bei 1:1 wachsen Halbzeugpuffer nominal um 15/4 = 3,75 kg/min; CUT müsste im langfristig bestandsneutralen Verlauf 75 % produktive Auslastung erreichen. Dies ist keine vorhandene Takt-UI |
| Profilformer → geplante Auto-Montage | 21/2 gegen 8 kg/min | **16 Profilformer : 21 Montagen** |
| Blechformer → geplante Auto-Montage | 21/2 gegen 4 kg/min | **8 Blechformer : 21 Montagen** |
| Gesamte geplante Auto-Kette | 9 CUT : 8 Profilformer : 4 Blechformer : 21 Montagen | Materialgleichgewicht; weit über Starterfracht/Ownerpool/Band-/Powergrenzen. Kein sinnvolles Early-Game-Layout |
| W09 diskreter Erstnachweis | 2 CUT + 1 PROFILE + 1 SHEET + 1 Hand-BRACE | **16 = 5,8 + 3 + 5 + 2,2 kg**; exact integer mg. Prozessarbeit **232.000 J**, Band-/Zusatzenergie separat. Dieser diskrete Fall verlangt keine stationäre Ratio |

1:1-CUT/Former ist für den endlichen ersten Ablauf bedienbar und kann korrekt über Puffer/WAIT pausieren. Ein ratiofreundlicher neuer Contentpfad behebt spätere Planbarkeit, ohne den aktuellen Gameplaynachweis neu zu definieren.

## Mengen, Cargo, Band, Power, UI und Persistence

| Bereich | Tatsächliche Definition / Quelle | Auditbefund |
| --- | --- | --- |
| Material | `material/quantity.ts:17,28,49`; `contracts.ts:5`; `C:27` | sichere positive ganze Mengen; mg, mm, piece; BigInt-Produkte und exakte Dezimalzulassung. Nicht quantisierbare Limits werden abgewiesen. Keine 5er-Bestandsrundung |
| Itemmassen | `C:33–63` | Halbzeug/Profile/Blech/Verschnitt 1 mg pro Einheit, Stütze5.800.000 mg/Stück, Modul6.000.000, passives Band5.000.000; Feldkabel250 mg/mm. Verpackungsenvelopes sind keine Dichten |
| Cargo | `C:129–142,214–230`; `tests/fixtures/factory/fp02Fixtures.ts:1` | C01–C28 einmalig: **2.984.400.000 mg = 2984,4 kg**, **12.450.000.000 mm³ = 12,45 m³**. 96 kg Stahl, 80 Profile, 60 Blech, 16 Elastomer, 24 passive Bandmeter, 4 Bandantriebe, 40 m Kabel; keine neue Fracht aus Balance |
| Physische Skalen | `catalog/sourceLock.ts:21`; `C:148`; `hvpCoastSource.ts:21,25,65` | `hvp-authored-coast-v5`, Terrain125 mm, Kalkstein2400 kg/m³ mit `prototype-tuning-unapproved`; Bau250 mm. Eine125-mm-Zelle ergibt4,6875 kg, acht37,5 kg. Keine Geologie-/Miningfreigabe |
| Puffer / BOM | `C:113–127` | B06 Input16/Output22,5/Verschnitt6 kg; B07 Input15/Output21/Verschnitt6; B08 Input40/Output60; B09 storage200 kg plus Volumengates. B06/B07/B08 massenerhaltende BOM208/341/499 kg; Chassis180/300/450 kg bleiben ganze einzigartige Teile |
| Bandkatalog | `C:151` | `fp02-conveyor-reference-v1`:750 mm/s, max10 kg/Paket,25 W/aktivem m,1-m-Module,max12 m Referenzlinie,1 kg/s nominaler Kredit |
| Bandruntime | `conveyor/beltReference.ts:10,166–168,229`; `dryFactorySlice.ts:88,198` | `fp06-one-packet-belt-v1`: eine Paketposition,100-ms-Step,75 mm/Step,100.000 mg Kredit/versorgtem Step,initial0,max10.000.000 mg; aktuelle Dry-Linie4 m/100 W. Neue Injektion bewegt sich erst im nächsten Tick |
| Band-Servicegrenze | gleiche Quellen, reine Math | 4-m-Fahrt geometrisch16/3 s; diskret54 Bewegungsticks=5,4 s, plus eigener Injektionstick. Ohne Blockade maximal ein5-kg-Paket/5,5 s = **600/11 kg/min**, unter60. Ein7,5-kg-Paket/7,5 s kann den60er Kredit langfristig bedienen; voller Ausgang oder fehlende Port-/Powerzulassung reduziert dies. Ein10-kg-Paket braucht initial10 s Kredit, dann mindestens5,4 s Fahrt. Keine sofortige60-kg/min-Garantie |
| Prozess-/Power-Step | `power/factoryPower.ts:68`; `dryFactorySlice.ts:180` | all-or-nothing100 ms; `fp01-factory-power-policy-v1`, `fp06-factory-power-v1`; tatsächliche mW/mJ-Energie rationale `n/d`, kein Unterversorgungsfortschritt |
| Akku | `factoryPower.ts:70–73`; `C:230` | Kapazität14,4 MJ, Start12,96 MJ, Produktionsreserve3,6 MJ, Hardwarefloor0,72 MJ;8 kW Lade-/Entladelimit; η=19/20 je Richtung,500 W Restartheadroom über2 s; gespeicherte Quanten mit Nenner380.000.000; keine externen Leitungs-/Standbyverluste in dieser expliziten V1-Policy |
| Quellen | `power/sourceAdapter.ts:15,64,94`; `dryFactorySlice.ts:116` | fixed-net-observation-v1, `WX-FAV-01` als bestätigte fixture mit1,8 kW/Wind und0,8 kW/PV. Dry-Aufruf verwendet **observation:null**: aktuelle Quellangebote0/unsupported statt erfundener20-kW-Erzeugung. Batterie nur nach bezahlter bestätigter Installation |
| Layout | `C:195–212` | ReferenzlastA3500 W, B6600 W einschließlich100-W-Steueranteil; Referenzkabel13/17 m. Aktuelle dynamische Dry-Requests führen konkrete aktive Maschinen/Bänder; deklarierter Layouttotal ist keine gemessene Live-Leistung. Historischer späterer Kabelkandidat19,75 m darf nicht mit13 m vermischt werden |
| UI | `ui/machinePanel.ts:57–75`; `hostPort.ts`; `factorySession.ts:315` | aktuelle Maschine zeigt Status, bestätigte Arbeit, zugeteilte W und exakte Pufferbestände; keine dedizierten nominal/actual Materialraten, kein Ratio-Rechner. Auswahl bindet Version/Digest, keine Anzeige-Ratenautorität |
| UI-Präzision | `ui/cargoPanel.ts:14`; `power/powerReadView.ts:15`; `factorySession.ts:315` | kg/m-Anzeige erhält ganzzahlige Einheiten exakt. PowerReadView bietet rationales potential/actual; öffentliche Sessionprojektion nutzt JS-number und teils Integerdivision. Für zukünftige Anzeige müssen Präzision/Messfenster/Approximation benannt werden; keine Bilanzwerte daraus zurückschreiben |
| WIP / Commands | `productionStep.ts:13–55,287,301,362`; `material/reservations.ts:174,198,217,278`; `dryFactorySlice.ts:234,264,291` | Job pinnt recipeRef+vollständige recipe/process/install Bytes, bezahlte mJ, Reservation, Command- und Replay-Receipts; material/factory `prepare→commit`, atomare adopt/CAS und exaktes NoOp. Materialausgaben tragen Produktionsherkunft; Digest allein ersetzt vollständige Bytes nicht |
| Fresh lineage | `factorySession.ts:271,410`; `machinePanel.ts:12–20`; `reservations.ts:217` | UI prüft vorhandene `factory.production`-Herkunft für Handteile; Ledger erhält versionierte sourceLots. V2-Kompatibilität muss auch echte Quelle, Rezeptoutputs, Menge, Parent-/Commandidentität prüfen; `freshProduction`-Boolean allein ist kein Migrationsbeweis |
| Save | `hestia-prototype/persistence/gameCheckpoint.ts:18–32,59`; `saveStore.ts:6–24,34` | geschlossene `hvp-game-checkpoint-v1`, `hvp-world-checkpoint-v1`, HVPslotnamespace, SaveEnvelope schema1 und `hestia-playable-v1`;16-MiB-Transport/64-MiB-Decode. Keine Factoryfelder darin; Factory-Checkpoint-/Savecodec im beobachteten Factory-Slice nicht vorhanden. W10 ist offen; kein funktionierender combined Save behauptet |

Der Original-FP06 bindet Combined-Save/W10 in §13.12 beziehungsweise Zeilen1184–1242, WIP-Halb-CUT18.000 J in1223, CAS-/Quotafehler1227 und keine Budgeterhöhung1242. Ein Balancevorschlag darf diese bislang offenen Leistungen nicht als bereits implementiert behandeln.

## Datei-SHA und Beobachtungszeit

Alle folgenden Hashes wurden im Snapshot 08:27:11Z direkt aus den Live-Dateibytes erhoben. `sourceInventory` enthält relative Pfade unter dem expliziten `worktree` des Mathreceipts, Bytes und jeweilige Dateimtime; diese Tabelle kürzt ausschließlich den gemeinsamen Prefix `apps/weltraum-browser/src/` ab. Datei-SHA ist nicht Runtime-State-/Catalogdigest. Der Abschlussvergleich um 08:43:55Z sah den autorisierten neuen HEAD `393670fccd4789b562d31b721f15d02457420935`; 14 geschützte Vertrags-/Save-/Goldenpfade waren weiterhin bytegleich mit diesem Quellensnapshot und neuem HEAD. Die übrigen aktiven Writerpfade werden dadurch nicht eingefroren.

| Quelle | SHA-256 |
| --- | --- |
| `factory/contracts.ts` | `6cf50991a61acb0ff6453e7507f000f51cd3d8be8094f2a978735094c6ea1527` |
| `factory/catalog/fp02Catalog.ts` | `e746f2408314511a9e82315734fc78993b13ddc2627216b72dc0aa2c35d73fd3` |
| `factory/catalog/sourceLock.ts` | `a91d9a8ccacc03dde29de4992ba81404aed5c342f8c326986eb026f81658600a` |
| `factory/material/quantity.ts` | `ba29fc004b20d9bb0cd6e41f39f2b28acf036e0e395f50421f42ccf5d8721328` |
| `factory/material/reservations.ts` | `4f5c1d17db3c5167dc42b23e0ab6b0a63f3a9b441684bc5140c367dd7d4d483e` |
| `factory/production/recipeAdmission.ts` | `c77eeaa220cbb491c51356533bdd8f1e6d221f67e9406b458d4a6c06ebac4102` |
| `factory/production/productionStep.ts` | `f74397051a7b2da13d6d183ccf573cb633cb932e915e1ebaf6bf6a50da29c449` |
| `factory/power/factoryPower.ts` | `70ddfe44c9a81c6355262bed928ee4d72b410b4b0db2a6c6bf08a36ec71b2825` |
| `factory/power/sourceAdapter.ts` | `3c4886c67b79475783f287e93edcb8412db5a26f1156624c70283416fbeb5d9b` |
| `factory/power/powerReadView.ts` | `0921116600c4a50ba0b6bdcf8f46a2368d9d3ac0717e9cfcb6cd564d298d727a` |
| `factory/session/dryFactorySlice.ts` | `2122581f9075c53db0441002b650d6a6c2cb9eddd0c858f1b0078d58c3746a4a` |
| `factory/session/factorySession.ts` | `ea8d8cdee5ea1826a9b00f0dd7d2d7cbfc4408cdeb7cb2e3f880893ea86a448a` |
| `factory/session/hostPort.ts` | `107601ff938da6eee3f1db1159f8c55961a2517551b186fc0a8bbc01f8f7525a` |
| `factory/conveyor/beltReference.ts` | `d48015f53b5c9e991e3c6e792e35b8ca238eb56006c79c01e1780125236fdcf9` |
| `factory/conveyor/beltPorts.ts` | `54c2bdd48838f869db887d72b19f4169487070ba194e301340b12179f6a7cfa9` |
| `factory/ui/machinePanel.ts` | `9905cc0d9bd04ee2dc15903b03fca2399e4fa95fdf828ed6853787f97a19c2e7` |
| `factory/ui/cargoPanel.ts` | `f899ffb7d5f062272c8f7693325981f9e789f3aec28716941a0522731d0356e5` |
| `factory/ui/powerPanel.ts` | `2ffe21ca555fdd9f60d06997fd2a42a3c4775319ec7768e45aaeb161529a7f15` |
| `factory/fixtures/startSite.ts` | `faead62d37493fcdfa98c000003e2ffd125408ddd6212e9b3bb69dd0fe05f168` |
| `factory/fixtures/cargoSite.ts` | `1ff5b11c5ceb027755015c8db305acc85d7dbe1db8e3ac2e68fca983f89a17e7` |
| `hvp/hvpCoastSource.ts` | `2f3fd41bea2edb1756f1b7933ac0243ee98c1e742bb4c6fe26b6756f70b09408` |
| `hestia-prototype/persistence/gameCheckpoint.ts` | `71335a3b25493145e7abb12f02fe6a31f46f7861d9da65b3d741ffef4dde990f` |
| `hestia-prototype/persistence/saveStore.ts` | `3bc2e7c043b21f491b53082929652f7da3940dfe64003b92182c9435806094c7` |

## BAL-00-Ergebnis

Die wesentlichen Konflikte sind echte Batch-/Taktwerte und fehlende stationäre Maschinenrelationen, keine bloßen Anzeigeprobleme. CRUSH60, Starterband-Kredit60 und Hauptlastschritte2/3/4 kW passen bereits. Manual-/Spezialbaugruppen und reale Verschnittmassen erhalten dokumentierte Ausnahmen. W09-v1 bleibt bis seinem vollständigen Nachweis und getrennten Migrationsgrant unverändert; die neue Richtung wird im separaten, inaktiven V2-Vorschlag konkret.


## Root-Nachtrag zum laufenden Prototyp

Diese Analyse bleibt an ihren dokumentierten Snapshot gebunden. Seitdem wurden Source-Partial `393670fccd4789b562d31b721f15d02457420935`, UI-Import `3e4acefc18a543e27fbfd97378d6a6929f194b8f` und Art-Renderimport `0dd5cdb6400aac5df3f0fe7937a6d612d8a76bd6` separat übernommen. UI ist nach technischem Review HOLD; Integrator und Art sind die zwei aktuellen Implementierungswriter. Die Balancinganalyse hat keine Produktpfade geändert.

Die ursprünglich verkürzt gemeldeten 5 cm im Routentest wurden anhand der Rohdaten auf **7.081 mm** präzisiert. Der Owner hat inzwischen ausschließlich den exakten zusätzlichen V3-Randkandidaten freigegeben; seine Runtimeprüfung und der vollständige Batteriequerweg bleiben offen. W09-Endgate, W10 und W11 sind damit nicht bestanden. Diese Terrain-/UI-/C1-Arbeiten verändern die geschützten Rezeptzahlen und die 16-kg-Abnahme nicht.

Strategie A bleibt der Arbeitsdefault dieser Analyse; vorgeschlagene V2-Recipes/BOM/Registry/Save-Migration bleiben inaktiv und benötigen eigene spätere Gates.
