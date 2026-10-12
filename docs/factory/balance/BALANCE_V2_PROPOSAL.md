# BAL-01/BAL-02 — Inaktiver V2-Vorschlag

Profil-ID: **`factory-readable-rates-v2-proposal-2026-10-12`**, Proposalrevision1. Status **PROPOSED / NOT_ACTIVE / OWNER_REVIEW_PENDING**. Grundlage: Live-Snapshot im [Audit](BALANCE_AUDIT.md), voller Handoff und dessen ausdrücklich illustrative V2-Kette. Die aktuelle Implementierung, Cargo, Goldens und W09-Zahlen wurden nicht verändert. Keiner der folgenden IDs/Digests ist als aktiver Content freigegeben.

## Regeln und Versionierung

Neue primäre Material- und Item-Nennraten werden exakt als Vielfache von5 in kg/min beziehungsweise Stück/min entworfen; Hauptmaschinenleistung bevorzugt500-W-Schritte. Dies gilt bei100 %, bestätigter Versorgung, geeignetem Feed, gesunden Werkzeugen, freiem Output und zulässigen Ports. Bestände, Massen, Wetter, tatsächliche Energie, Materialqualität, geometrische Quanten und WIP bleiben exakt. 50 % von15 kg/min sind7,5 kg/min; keine Rundung auf10.

Für die spätere Registry werden neue eigenständige Source-/Runtime-IDs und Definitionversion2 vorgeschlagen; der aktuelle Typvertrag mit `version:1` und einem frozen-v1-Katalog muss vorher explizit erweitert werden. Beispiele: `BALV2-QUALITY-CUT` → `balv2_quality_cut`, `BALV2-FORM-PROFILE` → `balv2_form_profile`, `BALV2-FORM-SHEET` → `balv2_form_sheet`, `BALV2-BRACE-5KG` → `balv2_brace_5kg`. Recipe-/Device-/Catalog-/Source-/Install-/BOM-Digests müssen aus vollständig reviewed neuen Bytes berechnet werden. **Kein aktiver Digest wird hier erfunden.**

Frühe Linie: sechs Warenfamilien — geprüfte geeignete Schiffsstahlteile, qualifiziertes Halbzeug, Profile, Blech, alternative5-kg-Stütze, getrennt gebuchter Reststahl. Optional Gestein/Schotter macht acht. Erzkonzentrat, Tailings, Gas und Wasser gehören in einen späteren getrennten Schritt. Maschinen können über echte Werkzeuge/Teile/Fundamente verfügbar werden; kein zusätzlicher künstlicher Forschungslevel. Fehlende Chassis bleiben fehlende Chassis.

## Vollständige Vier-Maschinen-Kette bei100 %

Alle Hauptprozesse haben zunächst60 s aktive Zeit pro Batch. Die hier einfachen Batchmassen sind tatsächliche zukünftige Buchungen und müssen als ganze mg gespeichert werden. Die neue Stütze ist eine **andere Produktdefinition**; Größe, Lasttragfähigkeit, native Geometrie und Baukosten sind vor Freigabe konstruktiv zu prüfen. Die alte5,8-kg-Stütze bleibt bestehen.

| Neue Rezept-/Devicefamilie | Exakter Batch / Nennfluss pro Minute | Power | Elektrische Prozessarbeit/Batch | Verbraucherrelation |
| --- | --- | --- | --- | --- |
| `BALV2-QUALITY-CUT` | 30 kg geeignete bekannte Stahlteile →25 kg qualifiziertes Halbzeug +5 kg separierter Reststahl | 1,5 kW | 90.000 J =1/40 kWh | Ein Cutter liefert zusammen15+10 kg/min an zwei Zweige |
| `BALV2-FORM-PROFILE` | 15 kg Halbzeug →15 kg Profile | 2,0 kW | 120.000 J =1/30 kWh | Ein Profilformer : eine Montage,15→15 |
| `BALV2-FORM-SHEET` | 10 kg Halbzeug →10 kg Blech | 2,5 kW | 150.000 J =1/24 kWh | Ein Blechformer : eine Montage,10→10 |
| `BALV2-BRACE-5KG` | 15 kg Profile +10 kg Blech →5 Stützen à5 kg, kein verschwiegener Rest | 3,0 kW | 180.000 J =1/20 kWh | 1 Cutter :1 Profilformer :1 Blechformer :1 Montage |

Für eine Minute stationären Materialgleichgewichts gilt **30 kg Eingang =25 kg gebuchte Stützen +5 kg Reststahl**. Intermediates:25 Halbzeug=15+10, Profile15=15, Blech10=10. Die beiden Former sind separate physisch vorhandene Maschinen; Rezeptumschalten auf einem B07 erzeugt keine zweite Maschine. Ein Ausgangssplit darf die vorhandenen25 kg nur in15+10 teilen. Die stationäre Minute ist keine Behauptung, dass nach60 s aus leeren Puffern bereits Endprodukte vorliegen; Befüllung, mindestens drei Prozessstufen, Anlauftransport und begrenzte Puffer kommen hinzu.

Realismusannahme: Der Qualitäts-Cut verarbeitet fixturegebunden sortierte, teilweise beschädigte Stahlteile;25/5 ist eine vorab geprüfte brauchbar/rest-Verteilung dieses Feeds. Es ist kein pauschaler Verlust jeder kalten Umformung. Die nachfolgenden Former verwenden passende Halbzeugabmessungen mit idealisiert verlustfreier Kaltumformung. Braucht die reale Konstruktion Beschnitt, muss ein zusätzliches präzises Reststofffeld die neue Rate verändern; es darf nicht verschwinden. Kein Reststahl wird ohne eigenes energie- und materialgebundenes Rezept wieder hochwertiges Halbzeug.

### Einfache skalierbare Zusatzprofile, weiter inaktiv

Die folgende Tabelle konkretisiert echte Verhältnisse an **derselben Halbzeug-Verbindung**. Es sind optional zu reviewende Feed-/Geräteprofile, keine gleichzeitig vorausgesetzten zusätzlichen Early-Game-Maschinen. Die unterschiedliche Sortierausbeute muss durch verschiedene gepinnte Qualitätsfixtures begründet sein; der Spieler darf keine höhere Qualität durch Auswahl des billigeren Rezeptnamens erzeugen.

| Optionaler Kandidat | Batch60 s / Haupt- und Restfluss | Power / Arbeit | Passende echte Verbindung |
| --- | --- | --- | --- |
| `BALV2-QUALITY-CUT-S` | 20 kg geeigneter Feed mit75 % qualifizierbarem Anteil →15 kg Halbzeug +5 kg Rest | 1,5 kW /90.000 J | **2 Cutter-S :3 Blechformer**,2×15=3×10=30 kg/min; beide Restströme zusammen10 kg/min |
| `BALV2-QUALITY-CUT-M` | 40 kg geeigneter Feed mit75 % qualifizierbarem Anteil →30 kg Halbzeug +10 kg Rest | 2,0 kW /120.000 J | **1 Cutter-M :2 Profilformer**,30=2×15 kg/min |
| Arithmetischer Planungsfall, kein zusätzlicher Content | Lieferant20 und Verbraucher30 kg/min | Power bleibt vom jeweiligen geprüften Prozess abhängig | **3:2**,3×20=2×30; konkrete künftige Definition erforderlich |

Die primäre Vier-Maschinen-Kette hat echte1:1-Verbindungen. Die Zusatzprofile liefern1:2 und2:3 ohne versteckte Taktfaktoren. Für den einfachsten ersten Release kann ausschließlich die primäre Kette vorgesehen werden; Zusatzprofile dürfen zurückgestellt werden. Teilzweigratios sind kein Beweis einer vollständigen multivariaten Fabrikbilanz.

## Band, Strom, Puffermengen und endliche Baukosten

Ein ausgerechnet passender60er-Kredit allein garantiert keine60-kg/min-Portbedienung. Für die vollständige Beispielanlage werden **fünf getrennte4-m-Linien** angenommen: Rohstahl→Cutter30 kg/min; Cutter→Profilformer15; Cutter→Blechformer10; Profilformer→Montage15; Blechformer→Montage10. Reststahl verbleibt in einem6-kg-Beispielcassette und muss spätestens nach einem60-s-Batch gebucht entnommen werden; bei voller Kassette WAIT_WASTE. Stützen werden in der Montageausgabe abgelegt. Ein physischer25er-Split am Cutter verlangt eigene bestätigte Verteil-/Portsemantik; die bestehende eine B06-Ausgangsbuchse darf nicht durch UI allein zu zwei Ports werden.

| Linie | Nennfluss | Vorgeschlagene Paketplanung pro60 s | Kredit- und Belegungsprüfung bei4 m | Bandpower |
| --- | --- | --- | --- | --- |
| Rohfeed | 30 kg/min | 4×7,5 kg, Abstand mindestens15 s | Jedes Paket≤10 kg; powered Kredit7,5 s; Bewegung5,4 s plus Injektion0,1 s;15-s-Zyklus ausreichend im reinen Modell | 100 W |
| Halbzeug zum Profilformer | 15 kg/min | 2×7,5 kg, Abstand30 s | 7,5-s-Kredit und5,5-s-Belegung liegen unter30 s | 100 W |
| Halbzeug zum Blechformer | 10 kg/min | 1×10 kg | 10-s-Kredit,5,5-s-Belegung; ganzes Batch wird erst nach tatsächlich angekommenem Material reserviert | 100 W |
| Profile zur Montage | 15 kg/min | 2×7,5 kg | wie Profilfeed | 100 W |
| Blech zur Montage | 10 kg/min | 1×10 kg | wie Blechfeed | 100 W |

Diese Mathematik setzt exakte aufteilbare Lose, freie Zielkapazität, kompatible native Ports, gleiche Version-/Provenienzbindung, ausreichende bestätigte Stromleistung und tatsächliche Entfernung voraus. **Runtime-Port-/Delivery-/Stauprüfung NOT_RUN.** Die aktuelle ein-Paket-Policy darf nicht auf mehrere Pakete erweitert werden, nur um das Modell einzuhalten. Ein5-kg-Paket alle5,5 s liefert maximal600/11 kg/min: eine gestalterisch kleine Paketmasse kann trotz60er-Kredit zum Bottleneck werden.

Power: vier Prozesse1,5+2+2,5+3=**9 kW**. Genau20 aktive Bandmeter×25 W/m=**0,5 kW**, Summe **9,5 kW**. 60 s gleichzeitige Vollast ergibt **570.000 J** Busarbeit; vier Prozessarbeiten540.000 J plus30.000 J Band. Falls das neue Layout zusätzlich den bekannten100-W-Steuerverbrauch übernimmt, lautet die ehrliche Summe **9,6 kW /576.000 J je Minute**. Andere Lasten und tatsächliche Verluste werden zusätzlich gebucht; die Layoutsumme wird nicht auf9,5 gerundet.

Bei ausschließlicher Akkuversorgung kann die vorhandene8-kW-Grenze die9,5-kW-Anlage nicht gleichzeitig bedienen. Das ist ein sichtbares Power-/WAIT-Gate. 6,8-kW-Wetterfixture würde2,7 kW Busdefizit lassen, mit η19/20 genau **54/19 kW** Speicherentladung; Wiederanlaufreserve, Verteilung und andere Lasten kommen hinzu. Der aktuelle Dry-Supply hat ohne bestätigte Umweltobservation0 W Erzeugung. Kein Wind-/PV-Wert wird erhöht, um diese Kette zu ermöglichen. Kleinere zeitversetzte Bedienung senkt die tatsächliche Rate; sie darf weiterhin das vorhandene Strommodell verwenden.

Neue Puffer müssen mindestens den echten Batch abbilden: Cutterinput30 kg und Output25 kg; Profilinput/output15 kg; Blechinput/output10 kg; Montageinputs getrennt15/10 kg und Ausgabe25 kg für fünf ganze Stützen; Reststahl mindestens5 kg plus echte Behälterreserve. Die existierenden B06-Limits16/22,5 kg reichen für diesen Vorschlag nicht. Alle Volumen-/Install-/Native-BOM-/Ownerbudgets bleiben separate Gates; Masse allein ist kein Kapazitätsbeweis.

Die vorhandene Fracht hat nur ein Formerchassis und vier Banddrives; das Fünf-Linien-Beispiel braucht zwei Former und fünf Drives, dazu die bisher nicht vollständige Montagezelle. C01–C28 dürfen deshalb nicht heimlich erweitert werden. Ob die vier Maschinen plus Netz, fünf Linien, Behälter und tatsächliche Facilityowner in den vorhandenen16-Ownerpool passen, muss die spätere Planung vor Konstruktion exakt nachweisen. Das Profil ist zunächst **spätere neue Contentlinie**, kein garantierter sofortiger Starter. Neue BOM und Chassisquellen sind hier PENDING und wurden nicht erfunden.

## Separater plausibler Erzkonzentrationsfall, ausdrücklich später

Keine W12–W29-Implementierung und keine Änderung der realen HVP-Kalksteinregistry. Vorgeschlagen werden zwei60-s-Nennprozesse für eine später geologisch validierte, trocken aufschließbare hämatithaltige Feedfixture:

| Stufe | Exakter Nennfluss | Power / Arbeit je60 s | Bedeutung |
| --- | --- | --- | --- |
| `BALV2-ORE-CRUSH` | 60 kg geeignete Erzbrocken →60 kg gebrochenes Fördergut | 3 kW /180.000 J | Keine Stoffvermehrung, Feinanteil bleibt enthalten |
| `BALV2-DRY-CONCENTRATE` | 60 kg gebrochenes Fördergut →30 kg Konzentrat +30 kg Tailings | 5 kW /300.000 J | 1 Brecher :1 Separator; beide Outputs haben eigene endliche Custody |

Fixtureannahme: Feed enthält30 Masse-% Fe₂O₃ und70 % Gangue. Aus60 kg/min entstehen18 kg Fe₂O₃ +42 kg Gangue. Bei90 % Mineralrecovery enthalten30 kg Konzentrat16,2 kg Fe₂O₃ +13,8 kg Gangue,30 kg Tailings1,8 kg Fe₂O₃ +28,2 kg Gangue. Exakt18=16,2+1,8 und42=13,8+28,2; Konzentrat54 %, Tailings6 % Fe₂O₃. Fe₂O₃ ist Erzmineral, **kein metallisches Eisen**. Magnetische/gravitative Trennbarkeit, Aufschlussgrad, Kornspektrum, Feuchte, Staub und ausreichende Prozessarbeit müssen dieses Profil begründen. Andere Lagerstätten behalten andere tatsächliche Ausbeuten, auch krumme Werte.

Ein späterer metallurgischer Schritt könnte chemisch `Fe₂O₃ +3 CO →2 Fe +3 CO₂` abbilden. Mit ausdrücklich modellierten Molmassen159,687/28,010/55,845/44,009 g/mol gilt159,687+84,030=111,690+132,027 g pro Reaktionspaket. CO muss aus echter begrenzter Quelle oder energie-/materialgebundener Herstellung stammen, CO₂ wird tatsächlich gebucht, Gangue/Schlacke getrennt erhalten, Wärme und elektrische Arbeit bilanziert. Für diese Stufe wird hier **kein freier Rezeptoutput, kein Nullenergieprofil und keine implementierbare Nennrate** freigegeben; Chemie-/Atmosphäre-/Ofenvertrag und tatsächliche Energiekosten sind PENDING.

## Spieleranzeige und Ratio-Planung

Zukünftige Maschinenkarte, vollständig aus gepinnter Definition plus bestätigtem ReadModel:

```text
Profilformer · Version 2 · WARTET AUF EINGANG
100 % Nennbetrieb: Eingang 15 kg/min → Profile 15 kg/min
Reststoff: 0 kg/min im freigegebenen verlustfreien Profil
Batch: 15 kg · aktive Zeit: 60 s · Nennleistung: 2,0 kW
Zugewiesen: 0 W · bestätigte Arbeit: 0 / 120.000 J
Aktuell geliefert: 0 kg in den letzten 60 bestätigten Simulationssekunden
Puffer: 7,5 / 15 kg · Grund: noch 7,5 kg Eingang erforderlich
```

Reale Rate wird als **gebuchte Produktmasse im benannten bestätigten Simulationsfenster** berechnet; ein Batch kann kurzzeitig0 und später15 kg/60 s ergeben. Produktive Auslastung/Arbeitsfortschritt ist ein anderes Feld. Bei Pause stoppt bestätigte Simzeit; Aufnahmezeit per Wallclock ist keine Produktionszeit. Unterversorgung, WAIT_POWER, voller Output oder Waste, beschädigtes Werkzeug, ungültige Revision und fehlende Native-Portbestätigung sind lesbare Blockadegründe. Fehlende aktuelle Messdaten lauten „Noch keine bestätigte Messung“, nicht ein erfundener Nennwert. Nicht implementierte Optionen heißen VORSCHLAG/NICHT IMPLEMENTIERT.

Ports zeigen Materialidentität und Einheit, etwa „15 kg/min Bedarf; vorhandene Linie60 kg/min Kredit; Paket-/Laufzeitprüfung erforderlich“. Istbelegung verwendet tatsächliche Paketmasse, Position und bestätigten Zielpuffer. Warnungen sind kurz: „Halbzeug fehlt“, „Ausgang voll“, „Band kann diese Paketfolge nicht bedienen“, „9,5 kW benötigt,8 kW aus Akku maximal“. Wetter-/SOC-Anzeige darf14,4 MJ oder eine krumme tatsächliche Energiemenge zeigen.

Ratio-Rechner verwendet exakt gleiche Material-/Qualitäts-/Einheitenbindung: Angebot15, Bedarf10 kg/min → **2 Lieferanten :3 Verbraucher**, ohne Inventaränderung. Angebot30, Bedarf15 →1:2; bestehendes v1-CUT15 gegen11,25 →3:4. Für mehrere Outputs löst die Anzeige getrennte Stoffbilanzen; sie darf Profile und Blech nicht zusammen als austauschbare25 kg behandeln. Eine alternative Taktstufe wird nur gezeigt, wenn ein späterer zugelassener Power-/Clockvertrag sie unterstützt. Preview und Rechnungen senden keine Produktionstransaktionen und erzeugen keine Baukosten oder Materialgutschrift.

## Entscheidung

**A bleibt Default**, bis W09/W10/W11 samt portablem Build tatsächlich abgeschlossen sind. Danach kann ein Owner neue future-content-v2-Definitionen, BOM, kapazitive Ports und Kompatibilität gezielt freigeben. Strategie B ist eine spätere explizite Migration mit alten gepinnten Jobs und getrennten Goldens; Voraussetzungen und betroffene Pfade stehen in der [Migrationsmatrix](BALANCE_MIGRATION_MATRIX.md). Keine dieser Planungstabellen liefert heute einen Produktwrite- oder Savegrant.
