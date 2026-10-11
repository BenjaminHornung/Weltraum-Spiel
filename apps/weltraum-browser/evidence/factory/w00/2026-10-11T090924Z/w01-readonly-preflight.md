# FP06 W01 Preflight – read-only Vertrags- und Orakelvorbereitung

Stand: 2026-10-11. Verantwortlich: `/root/w00_architecture` (reale delegierte Analyse). Produktbasis während der Leseprüfung: `e40592c113b72a8dc93725187f92cf948e07f44d`. Kein Produktcode, Testcode, Branch, Worktree oder Commit erzeugt. Dieses Dokument liegt ausdrücklich außerhalb der Produktworktrees. Es behauptet keinen ausgeführten Fachtest und keine Ownerfreigabe.

**Gate:** Die konkrete W01-Quellen-/Mengenfreigabe wurde dem Nutzer vom Orchestrator vorgelegt; Antwort bei Erstellung ausstehend. Alle folgenden neuen API-/Mappingnamen sind technische Vorschläge für einen nach Freigabe gefreezten Vertrag. FP02-Zahlen bleiben Quellen-Fixtures; weder deren Vorlage noch diese Analyse setzt einen Status auf ACCEPTED. D05/D06/D07/D11 werden hier nicht vorweggenommen.

## Gelesene Quellen und tatsächliche Verträge

- FP02 §§4–10 vollständig: `01_PLANUNG_VERBINDLICHE_QUELLEN/HESTIA_FP02_PRODUKTIONSKETTEN_GEBAEUDE_LAYOUTS_DETAILPLAN_2026-10-10.md`, SHA-256 frisch geprüft: `5c4f068edba3d0c89e77b0d3a40734d4ee1a672c39f3885cbfef31430d942f39`.
- FP06 §5.3, §7.1–7.4, W01-Paketkarte (§12.3), W02-Verbrauchervertrag. FP03 §1.2 und FP04 §1.2 enthalten unveränderte Fixture-Crosschecks.
- Aktuelle Browserpfade: `src/resources/{ids,types,categories,catalog,serialization,containers,transfer,capacityMath}.ts`, `src/hvp/hvpCoastSource.ts`, `src/hestia-prototype/physics/tick.ts`.
- In FP06 bezeichnete vier W01-Fälle: FP06-T005–T008. Keine existierende ore_iron_silicate-Definition als Stahl neu etikettieren.

## Kleiner vorgeschlagener öffentlicher Vertrag

| Bestandteil | Minimaler Inhalt / Schnittstelle | Grenze |
|---|---|---|
| `FactoryCatalog` | Unveränderliche Item-, Recipe-, Device-/BOM-, Port-/Frame- und SourceRefs; vorhandener `ResourceCatalog` für validierte ResourceDefinition-Daten | Kein Runtimeinventar, kein verborgenes mutable Register |
| `loadFactoryCatalog(input: unknown): FactoryCatalog` | Form-/Einheits-/ID-/Version-/Digestprüfung vor Nutzung; eindeutige IDs, vollständige Referenzen, geschlossene Rezeptmassen, rekursiv unveränderliche Daten | Keine Welt-, Inventar-, Speicher- oder Rendereränderung |
| `createFp02Fixture(name: "cargo" \| "layout-a" \| "layout-b"): FactoryFixture` | Reproduzierbare endliche Cargoquelle und deklarative Layout-/BOM-/Portdaten | Layoutdaten sind keine bereits installierten Maschinen; Layout B liefert keinen kostenlosen Rock-Lot und kein ausgeführtes Mining |
| `FactoryItemRef` | Quell-ID, explizite Resources-ID, Definitionversion und Digest, Form, Mengenbasis, Massengewicht, Volumenprofil bzw. dessen ehrlicher Quellenstatus | Anzeigename/Farbe/Renderobjekt sind keine Identität |
| `FactoryRecipe` | ID/version/digest; capability; unveränderliche Inputs, Produkte und Verschnitt; Prozessart; Dauer-/Arbeitsprofil; Werkzeuganforderung | Handmontage nicht als elektrische Produktion buchen; spätere Rezepte definieren, nicht implizit freischalten |
| `FactorySourceRef` | Dokumentname und SHA-256; Quellabschnitt/Tabellen-ID; Sourceprofil und Digest; `fixture`/Tuningprovenienz | FNV-Resource-Signatur nicht als kryptografische Quellenhashprüfung ausgeben |
| `FactoryPort` / `FactoryFrame` | Lokale metrische bzw. mm-Koordinaten, Rolle, normalisierte Ausrichtung, Matingmaß, Kapazität, explizite east/north/height-Abbildung | Kein stilles Achsentauschen; Placementraster getrennt vom Terrainquellprofil |
| `FactoryBinding` / Commands | FP06 §5.3: sessionId/epoch/hostTick/factoryRevision/terrainRevision/catalogDigest/sourceProfileDigest; Committed/NoOp/Rejected/RecoveryHold | Gemeinsame Namen einmalig. Kein zweiter WorldState/Inventory-Typ; keine implementierte Tickrate ohne D05 |

Die FP06-ClockBinding-Kandidaten `universeTick = 2 * hostTick`, `factoryStep pro 6 Hostticks` dürfen erst mit dem entsprechenden Zeitgate verbindlich werden. W01 kann den Datenrahmen anlegen und den unbestätigten Faktor ausdrücklich als spätere Bindingpolicy behandeln; es implementiert keinen eigenen Timer.

## Resources-Kompatibilität und Quantisierung

| Tatsächlicher Vertrag | W01-Folgerung und sinnvoller fachlicher Fall |
|---|---|
| `resources/ids.ts`: Resource-, Category-, Catalog-, Stack-IDs müssen `/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/` erfüllen | Dotted FP02-IDs, `C01`, `REC-01-CUT`, `IN-STEEL` sind Quell-IDs. Explizite gespeicherte bijektive Mappingtabelle verwenden; unbekannte IDs oder Kollisionsmapping ablehnen. Nicht bei jedem Lookup Zeichen spontan ersetzen |
| `types.ts`: quantities sind `number`; Definitionmasse und -volumen sind kg/m³ je Resource-Einheit | Mengenbasis explizit deklarieren. Vorschlag: Bulk-Resources quantity in sicheren ganzen mg; Stückassets quantity in ganzen Stück; Kabel ggf. sichere ganze mm. Keine Number-kg-Multiplikation mit anschließender Rundung als Validierung |
| `catalog.ts:157`: Discrete/Sealed nur sichere positive ganze quantities; Sealed quantity max.1 und sealed=true | Für serialisierte Geräte jeweils eigener Stückstack mit quantity=1. Eine Discrete-Menge 4 ist nicht automatisch in vier identitätsbewahrende Einzelgeräte teilbar |
| `transfer.ts:738`: Discrete-Split eines bestehenden Stacks wird bei Teilmenge abgelehnt; Sealed ebenso | C01/C02/C08/C09/C14/C15/C16/C17/C23 von Anfang an pro Einzelinstanz expandieren. Vorschlag: 74 Stückinstanzen + 4 Bulk-Lose + 1 Kabel-Los = 79 Anfangsstacks, aber weiterhin genau 28 Frachtpositionen |
| `containers.ts`: kanonische immutable Snapshots mit Revision und initialContents; `transferResource` gibt neue Source-/Targetkandidaten zurück | Kein zweiter Gesamtmengen-Ledger. W01-Fixture darf echte Snapshotdaten herstellen; fachliche Reservierung/Prepare/Commit erst W02 |
| `transfer.ts:305`: Metadata einschließlich extensions entscheidet Zusammenführbarkeit | Provenienz, Definitionref, Quell-Cargo-ID und serialisierte Instanz-ID in JSON-fähigen namespaced extensions erhalten. Absichtliche Lospartitionen müssen eindeutige Kind-IDs behalten |
| `types.ts:128`: extension keys müssen namespaced sein, beispielsweise `factory.source` | SourceIDs/Quanten-/Profilreferenzen unter validierten extensions, nicht beliebige neue Top-level-Resourcefelder; Werte JSON-kompatibel, keine BigInts/Maps/DOMobjekte |
| `serialization.ts`: Resource-signature ist FNV1a über kanonisches JSON; Arrayreihenfolge bleibt erhalten | Deterministische Sortierung und reproduzierbare Inhalte ausdrücklich festlegen. SHA-256 für Dokument- und Quellenbytes separat führen |
| `capacityMath.ts`: 16*EPSILON-Toleranz bei kg/m³-Kapazitätsgrenzen | Keine Behauptung integerexakter Kapazität aus dieser Funktion. W02 muss genaue Eintritts-/Kapazitätszulassung vor dem Resources-Aufruf ergänzen; Core-Toleranzen hier nicht umschreiben |

**Zahlenvorschlag:** sichere integer mg/mm/mm³ innerhalb des JS-safe-integer-Bereichs und reject bei Überlauf; persistente größere Werte nur per klarer IntDecimal-/rationaler Profilregel, nicht durch unbemerktes Floatwachstum. Die kleine W01-Fracht passt: Masse `2_984_400_000 mg`, gepacktes Volumen `12_450_000_000 mm³`. Vorschlag Bulk-Masseneinheit 1 mg bedeutet `massPerUnitKg=0.000001` an der vorhandenen Resources-Grenze; die exakte Masse bleibt an der Factory-Zulassung aus derselben Resourcequantity ableitbar.

**Offene Volumenbindung ausdrücklich sichtbar:** FP02-Volumen ist gepacktes Frachtvolumen einschließlich Gestell/Luftraum und keine generische Feststoffdichte. Teilmengen erfordern sourcegebundene rationale Packvolumenregeln oder eine andere gefreezte Volumenpolicy. C10 ergibt 5/8 mm³ pro mg, C11 9/4, C12 4/3, C13 15/4. C12 kann nicht durch Abrunden jedes mg auf eine ganze mm³ korrekt werden. Für neu produzierte Halbzeug-/Offcut-/Brace-/Rock-/Gravel-Volumes fehlen in §§4–10 globale Feststoffprofile. Diese Lücke ist kein Anlass für willkürliche Dichten, Nullvolumen als Kapazitätsfreibrief oder einen parallelen Bestand. W01 muss Quelle/Unbekanntheit/zulässige Fixture-Volumenpolicy dokumentieren und die spätere W02-/Layoutkapazität davon abhängig prüfen. Alle Ursprungspositionen besitzen als Ganzes exakte gepackte mm³.

## Vollständiges C01–C28-Mapping

`→` nennt einen **vorgeschlagenen expliziten Runtime-ResourceId**, keinen schon vorhandenen kanonischen Eintrag. Die rechts genannten Risiken gehören in Katalog-/Fixturevalidierung oder später klar benannte Gates. ID-Familien für Geräte/Chassis ohne FP02-Registerzeile sind neue technische Mappingnamen; Quellreferenz bleibt Cxx plus Gebäudeprofil. Bulk-/Komponenten-/Werkzeugnamen links stammen direkt aus FP02 §4.2–4.3.

| Quelle | Inhalt / FP02-ID → Runtime-ID | Menge | Gesamtmasse kg | Gepacktes m³ | Mapping-/Bilanzrisiko |
|---|---|---:|---:|---:|---|
| C01 | Windpack → `fp02_device_wind_pack_6kw` | 2 Stück | 700 | 2.80 | 2 eindeutige 350-kg-Instanzen; integrierte Anschlusskabel in Pack enthalten; Nennleistung kein Energieinventar |
| C02 | PV-Pack → `fp02_device_pv_pack_2kwp` | 4 Stück | 320 | 1.12 | 4 eindeutige 80-kg-Instanzen; keine neue PV-Herstellung; 2 kWp keine garantierte Dauerleistung |
| C03 | Akku → `fp02_device_battery_4kwh` | 1 Stück | 50 | .10 | Exakt derselbe Akku, 3.6 kWh/12,960,000 J Energiezustand gesondert; keine zweite Batterie beim Unpack |
| C04 | Verteiler → `fp02_device_distribution_40kw` | 1 Stück | 25 | .08 | B04 ist Devicequelle; 40-kW-Netzkapazität keine Stromquelle |
| C05 | Feldwerkbank → `fp02_device_field_workbench` | 1 Stück | 40 | .20 | B05 bleibt mechanisch nutzbar; Falten/Entfalten erhält Instanz-ID und Masse |
| C06 | Thermogeneratorkern → `fp02_device_thermal_generator_core` | 1 Stück | 150 | .70 | Kein bereits fertiger 164.8-kg-Generator; kein Biomassevorrat; optionaler späterer Build |
| C07 | Feldkabel → `fp02_comp_field_cable` | 40 m | 10 | .12 | Mengenbasis Länge, .25 kg/m; 40m zusätzliche Kabel nach Pack-Anschlussleitungen. Mögliches mm-Profil: 250mg/mm und 3000mm³/mm, nicht 40 Stück beliebiger Länge |
| C08 | Materialcontainer → `fp02_device_material_container` | 3 Stück | 180 | 1.26 | Je 60kg leeres Asset; dessen eigener Cargo-Inhalt und nutzbare 200kg Last getrennt; leere Behälter nicht mit freien 200kg Material verwechseln |
| C09 | Fundamentschuh → `fp02_comp_foundation_foot` | 6 Stück | 72 | .42 | Je 12kg; keine Gleichsetzung mit 5.8kg-REC05-Stütze oder kostenloser 4x4m-Deckplatte |
| C10 | `fp02.bulk.steel_known` → `fp02_bulk_steel_known` | 96kg | 96 | .06 | Sortenbekanntes Bulk-Los; keine alte generische ore_iron_silicate-Definition; SALVAGE-01 gehört nicht dazu |
| C11 | `fp02.bulk.steel_profile` → `fp02_bulk_steel_profile` | 80kg | 80 | .18 | Gleiche Materialfamilie wie späteres Produkt; vorhandene Profiles sind Bootstrapbestand, nicht bereits Factoryproduktionsnachweis |
| C12 | `fp02.bulk.steel_sheet` → `fp02_bulk_steel_sheet` | 60kg | 60 | .08 | Packvolumen pro Masse rational 4/3mm³/mg; keine stille Rundung oder nachträgliche Profil↔Blech-Verwandlung |
| C13 | `fp02.bulk.elastomer_reclaimed` → `fp02_bulk_elastomer_reclaimed` | 16kg | 16 | .06 | Acht statt sieben Bulkdefinitionen inklusive Elastomer; begrenzte geeignete Ware, kein nachwachsendes Gummi |
| C14 | `fp02.comp.belt_module` → `fp02_comp_belt_module` | 24 Stück | 120 | .72 | Je 1m/5kg PASSIVES Modul; nicht je ein eigener Motor; identifizierte Einzelmodule |
| C15 | `fp02.comp.machine_drive` → `fp02_comp_machine_drive` | 4 Stück | 8 | .03 | Je2kg identifizierter Kern; weder 6kg Bandmotor noch fertiges REC06-Antriebsmodul |
| C16 | `fp02.comp.machine_controller` → `fp02_comp_machine_controller` | 5 Stück | 1 | .01 | Je.2kg; keine Chips selbst herstellen; Controller-ID nicht nach Build weiter frei halten |
| C17 | `fp02.comp.wiring_harness` → `fp02_comp_wiring_harness` | 8 Stück | 6.4 | .03 | Je.8kg, Stückkomponente; REC06 nennt .8kg Harness, meint genau einen existierenden Leitersatz; nicht Bulk-Harness spontan teilen |
| C18 | `fp02.tool.cutter_head` → `fp02_tool_cutter_head` | 1 Stück | 3 | .02 | Ein eindeutiger Funktionskopf; zweite Cutterinstanz kann ihn nicht erneut nutzen |
| C19 | `fp02.tool.forming_die` → `fp02_tool_forming_die` | 1 Stück | 4 | .02 | Ein Toolset; Former capability und Defektzustand davon gebunden |
| C20 | `fp02.tool.crusher_jaw` → `fp02_tool_crusher_jaw` | 1 Stück | 6 | .03 | Optionaler Brecher; nicht einmalig entnehmen und dennoch in Cargokopie behalten |
| C21 | `fp02.tool.assembly_fixture` → `fp02_tool_assembly_fixture` | 1 Stück | 3 | .02 | Spätere Montagezelle; deren schwerer Grundrahmen fehlt, keine sofort fertige 49kg-Fabrik |
| C22 | `fp02.tool.pit_head` → `fp02_tool_pit_head` | 1 Stück | 5 | .03 | Späterer Schürferwerkzeugkopf; kein miningfähiges Chassis und keine W13-Freigabe |
| C23 | `fp02.comp.belt_drive` → `fp02_comp_belt_drive` | 4 Stück | 24 | .08 | Je6kg; dedizierte Drives unabhängig von C15; zwei kurze 4m-Linien kosten zwei Drives |
| C24 | `fp02.comp.field_generator_core` → `fp02_comp_field_generator_core` | 1 Stück | 35 | .08 | Ein Reservegenerator-/Lagerkern; W19-Reassembly später, kein serienmäßig herstellbarer Zusatzmotor |
| C25 | Rotor-/Nabensatz → `fp02_comp_rotor_hub_kit` | 1 Stück | 40 | .20 | Kein zweiter Windpack; passt nur zum ausgewiesenen späteren C24-Reassemblypfad |
| C26 | Cutterchassis → `fp02_chassis_cutter` | 1 Stück | 180 | .80 | Ein Chassis wird genau einmal in208kg-Instanz verbaut; Kosten28kg sind Vervollständigung |
| C27 | Formerchassis → `fp02_chassis_former` | 1 Stück | 300 | 1.40 | Ein Chassis in341kg-Instanz; Kosten41kg sind Vervollständigung |
| C28 | Brecherchassis → `fp02_chassis_crusher` | 1 Stück | 450 | 1.80 | Ein Chassis in499kg-Instanz; optional/out-of-loop, kein Gratis-Brecher |
| SUMME | Genau28 Ursprungspositionen | 74 Stück +4Bulk+1Kabellos | **2984.4** | **12.45** | Origin-Event/Cargo-ID/Instanz-/Los-ID unterscheiden; SALVAGE-01/Equipment nicht addieren |

Zusätzliche registrierte Produkt-/Bulkdefinitionen ohne Anfangscargo: `fp02_bulk_steel_semi`, `fp02_bulk_steel_offcut`, `fp02_bulk_rock_raw`, `fp02_bulk_gravel_mix`, `fp02_comp_small_brace`, `fp02_comp_drive_module`. Anfangsmenge jeweils null/kein Stack. In §4.3 bereits vorhandene `fp02.comp.field_generator_core` verweist ausdrücklich auf C24 und darf nicht mit C06 vertauscht werden. Ein Mapping-Lookup muss sourceId UND Definitionversion prüfen; gleiche ID mit anderen Bytes darf nicht still ersetzen.

## Rezept-Massen-, Arbeits- und Prozessorakel

Source-IDs hier exakt aus §5.2; Runtime-ID-Bijektion kann beispielsweise explizit `REC-01-CUT`→`fp02_rec_01_cut` speichern. Die Beispiele sind nicht durch Zeichenersetzung bei Laufzeit zu erzeugen. Mengenbelege beziehen sich auf das jeweilige gefreezte massPerUnit-/quantityBasis-Profil.

| Quelle | Inputs | Produkt + Rest | Input=Output kg | Arbeit in J | Dauer / elektrische Last / Scope |
|---|---|---|---:|---:|---|
| REC-01-CUT | 8kg steel_known | 7.5kg steel_semi +.5kg steel_offcut | 8=8 | **36000** | 30s,1200W, `steel.cold-cut` |
| REC-02-PROFILE | 7.5kg steel_semi | 7kg steel_profile +.5kg offcut | 7.5=7.5 | **80000** | 40s,2000W, `steel.cold-form` |
| REC-03-SHEET | 7.5kg steel_semi | 7kg steel_sheet +.5kg offcut | 7.5=7.5 | **80000** | 40s,2000W, alternative Formerwahl |
| REC-04-CRUSH | 20kg rock_raw | 20kg gravel_mix inklusive Feinanteil | 20=20 | **60000** | 20s,3000W; nur Definition, keine kostenlose Terrainquelle |
| REC-05-BRACE | 4kg profile +2kg sheet | 1*5.8kg small_brace +.2kg offcut | 6=6 | **0 manuell /120000 später elektrisch** | Frühe Handmontage: Werkzeugzeit nicht festgelegt; spätere assembly.small30s/4000W getrennte Prozessvariante |
| REC-06-DRIVE | 3kg profile +1*.8kg Harness +1*2kg MachineDrive +1*.2kg Controller | 1*6kg drive_module | 6=6 | **240000** | 60s/4000W; spätere assembly.small, erzeugt keinen neuen Motor |
| REC-07-BELT | 2kg profile +1kg sheet +2kg elastomer | 1*5kg PASSIVES 1m belt_module | 5=5 | **0 Fabriknetz** | Handmontage90s ist expliziter Vorschlag; keine neue Strom-/Motorfähigkeit |

- Nur R01–R03 plus echte Handmontage R05 sind für den ersten trockenen Produktbeweis nötig. Vollständiger Katalog R01–R07 bedeutet keine Adoption zusätzlicher Systeme/W12–W29.
- Zwei CUT +PROFILE+SHEET liefern aus16kg Stahl abschließend `3kg Profile +5kg Blech +2.2kg Verschnitt +5.8kg Stütze =16kg`; Maschinenarbeit **232000J**, Band-/Diagnoselast separat.
- Steady-state-Orakel120s:32kg Stahl→21kg Profile +1.5kg Formerverschitt +2kg Cutterverschnitt +7.5kg verbleibendes Halbzeug. Dieses Fenster benötigt bereits eingeschwungenes WIP; kein Cold-start-Zeitgolden.
- WIP-Masse bleibt genau einmal einem Resources-/Jobowner zugeordnet. Output erst nach erfolgreichem Batchcommit; Energie/Arbeit keine Inventaritems. Diese Verhaltensfälle gehören W02/W04, nicht vermeintlich in W01 implementiert.

## Device-/BOM- und Portmaße

| Profil | Außenmaß / Footprint Meter | BOM-/Massenorakel | Materialpuffer / Leistungsprofil |
|---|---|---|---|
| B05 Werkbank |2x1x1.1 |1*C05=40kg |mechanische bench.assembly/bench.belt-join; keine Pflichtstromversorgung |
| B06 Cutter |3x2x2.5 |180+12+10+2+.2+.8+3=**208kg** |IN16kg; OUT22.5kg; OFFCUT6kg;1200W |
| B07 Former |4x3x3 |300+20+14+2+.2+.8+4=**341kg** |IN15kg; OUT21kg; OFFCUT6kg;2000W |
| B08 Crusher |3x3x3 |450+24+16+2+.2+.8+6=**499kg** |IN40kg; OUT60kg;3000W; optionale reine Definition |
| B09 Container |2x2x1.5 |1*C08=60kg, genau3 vorhanden |200kg Nutzlast als Fixturekandidat; Innenvolumen zusätzlich validieren; passives MAT-IN/MAT-OUT |
| B10 Band |1m Module; Nutzbreite.75, außen.90–1.00 |5kg/Modul +6kg je separat motorisierter Linie |.75m/s;10kg Paket;60kg/min nominal;25W/m; ≤12m Kandidat je Linie |
| B12 Foot/Brace |Fußprofil separat sourcegebunden |C09=12kg, REC05-Stütze=5.8kg, voneinander verschieden |Kein implizites großes Fundament |

Weitere B13/B14/B15-Profile nur sourcegebundene geplante Definitionen: B13 optional164.8kg nach realem Build; B14-Vervollständigungsset49kg hat fehlendes schweres Chassis/Aktuatoren; B15-Set68kg hat fehlendes Chassis. Keines als fertig materialisierte Anfangsmaschine erzeugen. Wind/PV/Akku/Verteiler-Deviceparameter aus FP01 lesen, nicht neu erfinden.

Portmaß-Kandidat: **.75x.75m** Matingfläche, Mittellinie **1m** über lokalem Installationsniveau, west IN/east OUT, normalisierte Gegen-Normalen. Mindestens1m Serviceraum und getrennte Haupt-OBB/Tool-sweep/Materialweg/Servicehüllen. `SolidBatchOut→SolidBatchIn` nur bei tatsächlichem geometrischem Kontakt; Conveyor über validierten Pfad; POWER über Kabel/Bus; WIP/Internal extern nicht connectable. Recipe-/Power-/Containerports benötigen getrennte SourceIDs und save-safe RuntimeIDs, soweit Resources-Portvalidierung greift.

Layout A:22x12m, C08-A Zentrum(1,6), Cutter(7.5,6), Former(15,6), C08-B(18,6), Bank(7,2), Verteiler(10,10). Kanten/Portzentren east2→6 und9→13 ergeben je4m;17→17 direkter Former-Containerkontakt.8 Module+2Drives=52kg. Maschinenbau kostet32kg Profile/24kg Blech; Rest48/36kg. Zusatzkabel13m, Rest27m. Last1200+2000+8*25+100=**3500W**.

Layout B:gleiche Metallreihe plus Crusher(7.5,13), C08-C(14,13), Band east9→13=4m.20kg Schotterbatch braucht2*10kg provenancegebundene Unterlose. Weitere24kg Profile/16kg Blech; Gesamt56/40, Rest24/20. Zusatzkabel17m insgesamt, Rest23m. Last3500+3000+4*25=**6600W**. Kein Gestein in Cargo; reale Entnahme bleibt W13, hier maximal ausdrücklich synthetische Datenfixture.

**Achsenfrage:** FP02 nennt east/north/height, HVP/Three arbeitet x/y/z. Eine durch bestehende Framekonvention belegte explizite Transformation samt Rotation-/Portgolden ist nötig. Die konkrete Nord-Vorzeichenwahl ist keine Angabe der FP02-Tabelle und darf nicht unkommentiert als Quellfakt ausgegeben werden.

**Terrainmassen:** HVP source cell=.125m und Kalksteindichte2400kg/m³→4.6875kg/Zelle,8Zellen→37.5kg. FP02-Beispiel.25m/2600→40.625kg; FP04.25m/2560→40kg. Alle drei Profile getrennt, keine Dichtenmigration. HVP-Dichteprovenienz `prototype-tuning-unapproved` beibehalten; Boden1500kg/m³ ergibt2,929,687.5mg/Zelle und ist ohne rationelle Restführung kein integer-mg-Miningfall. W01 prüft Arithmetik/Refs, genehmigt keine Terrainentnahme.

## Konkrete Red-/Green-Orakel für den späteren Writer

| Fall | Erwartetes Red vor Implementierung | Fachliches Green-Orakel |
|---|---|---|
| FP06-T005 Cargo |Katalog-/Fixturemodul fehlt bzw. Verhalten noch nicht vorhanden |genau C01–C28;2,984,400,000mg;12,450,000,000 gepackte mm³; eindeutige serialisierte Instanzen; SALVAGE-01 und Equipment fehlen in Anfangssumme |
| FP06-T006 BOM |keine sourcegebundene vollständige BOMfunktion |Cutter208,000,000mg und Former341,000,000mg; jeweils genau ein eigenes C26/C27-Chassis; negative/duplizierte Komponentenref reject |
| FP06-T007 Maßstab |keine getrennten source-/placement-Felder |Bauraster250mm, Terrain125mm; HVP-Profil und Dichteprovenienz gebunden;8Limestonezellen37,500,000mg; FP02/FP04-Werte getrennt |
| FP06-T008 Version/Bytes |Version-/Contentabweichung noch nicht geprüft |unknown Recipeversion bzw. gleiche ID/veränderte normative Bytes reject vor Fixture-/Inventar-/Worldänderung; Mapping bijektiv; mutable Eingabe verändert geladene Outputs nicht |
| Rezeptcrosscheck |Massensummen/Prozessvarianten nicht verfügbar |alle7 Rezepte geschlossene Massen; manuell vs elektrischR05 explizit; R06 konsumiert1vorhandenen Motor; R07 passiv; auf Byteänderung inklusive Quellen-/Digestbinding reject |
| ID-/Portcrosscheck |dotted FP02-ID kann Resourcesvalidator nicht passieren |SourceID erhalten, gesicherte snake-case RuntimeID; kollidierende/unknown mappings reject; Portflächen/Normentransformation versiongebunden |
| Zahlenadmission |nicht integrale mg/overflow noch nicht abgegrenzt |negative/NaN/Infinity/unsichere Zahlen reject; sichere whole-unit bzw. declared rational policy; keine Tests, die Rundung heimlich erlauben |

Gezielte spätere Befehle im Browserworktree: `npm run test -- tests/unit/factory/catalog.test.ts`; betroffene Kompatibilität `npm run test -- tests/unit/resourceCatalog.test.ts tests/unit/resourceContainers.test.ts tests/unit/resourceTransfer.test.ts`; `npm run build`; `git diff --check`. Red-/Greenausgaben mit echten Run-IDs aufzeichnen; bestehende Evidence nicht überschreiben. Dieses Preflightdokument selbst führt keinen dieser Tests aus.

## Exakte Read-/Write-Grenzen für W01

**Produktwriter erst nach W00-/Owner-Gate.** Ein gemeinsamer Contract-Integrator besitzt alle folgenden Produktwrites; kein zweiter Writer editiert `contracts.ts`.

| Erlaubter W01-Write | Zweck |
|---|---|
| `apps/weltraum-browser/src/factory/contracts.ts` |Kleine gemeinsame öffentliche Typfamilie und source-/unit-Bindings |
| `apps/weltraum-browser/src/factory/catalog/fp02Catalog.ts` |Sourcegebundener Katalog, sieben Recipeprofile, vollständige28Cargo-Refs, bijektives ID-Mapping/BOM/Portdaten |
| `apps/weltraum-browser/src/factory/catalog/sourceLock.ts` |Sourcehashes/-versionen/Definitionbindings; kein automatischer Remote-/Clockzugriff |
| `apps/weltraum-browser/tests/fixtures/factory/fp02Fixtures.ts` |Deterministische Cargo-/Layoutdaten und Fachorakel; keine freischaltende Worldauthority |
| `apps/weltraum-browser/tests/unit/factory/catalog.test.ts` |T005–T008 plus nötige unit-/mapping-/compatibilitynegatives |
| `apps/weltraum-browser/evidence/factory/w01/<echter-run-id>/**` |Logs, Manifest, unabhängiger Review, tatsächliche Diff-/Testbelege |

**Readset:** gefreezte Handoff-FP02 §§4–10, FP06 relevante gemeinsame/W01-Verträge, FP01 referenced Device-/Powerprofiles, FP03/FP04 unveränderte Fixtureverweise; `AGENTS.md`, README, `.agent/PLANS.md`, W00 source-/ownership-/decisionlocks; aktuelle `src/resources/**`; `src/hvp/hvpCoastSource.ts`; `src/hestia-prototype/physics/{profile,tick}.ts`; bestehende Resources-Tests und package/toolchainconfig nur lesen.

**Außerhalb W01-Write:** `src/resources/**`, Ship-Power-Core, HVP-/native Physics-/Save-/Terraindateien, Bootstrap/main/HUD, factory.html/Entry/Session, package.json/package-lock/Vite/CI, Assets/Renderer/UI, Mining/Fluids/Automation. W00-Dokumente und Ownershipregister nur durch den Orchestrator; W01-Writer darf sein Gate nicht selbst als bestanden umschreiben. Kein Push, PR, Mainmerge oder Veröffentlichung aus dieser Vorbereitung.

**Reviewpunkte vor Dispatch:** konkrete W01-Freigabe und Quelle erneut bestätigen; keine Kollision mit existierenden factory-Dateien/Locks; Source-ID-Mapping/Serienstückexpansion/Volumenpolicy explizit einfrieren; D05/D06/D07/D11 offen halten; vollständigen W01-Commit und Evidence nach Gate erfassen. Wenn der Byte-/Version-/Mengenfreeze weiter fehlt, verbleibt nur diese read-only Vorbereitung, kein Produktwrite.
