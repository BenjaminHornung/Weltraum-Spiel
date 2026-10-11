# W09 Technikkatalog: unabhängiger Sourcepreflight

Read-only `/root/w00_architecture`, keine Produktwrites, Tests, Builds, Browser-/Native-/Profiljobs. **Preflight, kein Paket- oder Implementierungs-PASS.** Technikkatalog ist hier eine lesbare Projektion bekannter Ziele; keine Freigabe zur Simulation von W12–W29 und kein neuer Produktfreeze.

Integrator-WT `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`, tatsächlich gelesener HEAD `aa2e5d7c335453fc555a98ccd35e9f564c596e93` plus beweglicher W09-Draft. Quell-/Hosthashread `2026-10-11T23:47:33.358055+00:00` siehe unten. Root und Integrator erhielten die konkreten Anforderungen parallel während ihrer laufenden autorisierten Arbeit.

## Verbindliche Bedeutung der Sichtbarkeit

FP06-W09/Brief26: „Mini-Techtree zeigt das volle definierte Zielverzeichnis samt nicht implementierten späteren Produktionsmöglichkeiten ehrlich. Nächste Defizite hervorheben, keinen Forschungslock ergänzen.“ T039 verlangt bei Auswahl einer noch nicht herstellbaren Technologie sichtbare Anforderungen; fehlende Definition/Implementierung ist kein geheimes Level.

FP03 §12.1–12.5 (`1251–1300`) trennt **bekannt**, **herstellbar/montierbar** und **betriebsfähig**. Der ganze Zielbaum ist bekannt, während Material, reale Montage-/Transportfähigkeit, sichere Fläche, Energie, Umwelt und Rechte echte Voraussetzungen bleiben. §14.5 (`1504–1508`) erlaubt eine kleine erste Kategorienansicht; das ist kein Löschen bekannter Zukunftsziele. §14.2/14.6 verlangt zugängliche DOM-Requirements und einen verständlichen primären Grund. Eine fehlende Trasse oder Definition darf nicht als verfügbare Produktion dargestellt werden.

FP04 §11.3 (`857–863`): standardmäßig die nächsten **drei konkreten fehlenden Voraussetzungen**, vollständiger Pfad lesbar; Warehousefunde ändern die Herstellbarkeitsprojektion, keine Forschungsfreischaltung. FP05 §10.1 (`991–1017`) erlaubt den vollständigen Industrie-/Stadt-/Raumfahrtpfad vom Start an; der Graph ist eine mögliche Abfolge, keine künstliche Zwangsreihenfolge. §10.3 (`1033–1039`) unterscheidet Fertigung, Betrieb und Dauerbetrieb.

## Konkretes definiertes Zielverzeichnis

Die folgenden Quellfamilien müssen im vollständigen Zielverzeichnis auffindbar sein. Gruppierung ist UI-Technik; Objekt-/Rezeptdefinitionen und ihre materiellen Werte werden dadurch nicht neu registriert.

| Familie | Konkrete Quellenziele und Referenzen | W09-Bedeutung |
|---|---|---|
| Geerbter Gerätepfad | B01 Wind, B02 PV, B03 Akku, B04 Verteiler/Masten, B05 Werkbank, B06 Cutter, B07 Former, B08 Crusher, B09 Lager/Kassetten, B10 Band/Drive, B11 Split/Merge, B12 Fundamente/Stützen, B13 Biomasse, B14 Montagezelle, B15 Flachschürfer; FP03§4.7:322–330 und FP02§7:521–667 | Bekanntheit vollständig; tatsächlich geschlossene Prototyppfade separat markieren |
| Produktionsziele | W01-Katalog REC01–REC07 und reale Produkte Halbzeug, Profile, Bleche, Verschnitt, Brace, Drive/Band; `fp02Catalog.ts:73–87` | Nur geschlossene W04/W08-Pfade unterstützt; bloßes Katalog-`availability` reicht nicht |
| Struktur | ST-01 Fuß, ST-02 Brace, ST-03 Deck2m, ST-04 Deck1m, ST-05 Hauptträger, ST-06 Konsole, ST-07 Rampe, ST-08 Bühne, ST-09 Treppe/Leiter, ST-10 Wand, ST-11 Tor, ST-12 Dach, ST-13 Geländer, ST-14 Bandträger, ST-15 Kabelträger, ST-16 Verbinder; FP03§4.2:257–274 | Spätere/geplante Strukturprofile; ST-04–16 Maße/BOM/Traglast ausdrücklich Kandidaten. Vorhandene fertige Füße/Brace sind kein universell gebautes Plattformnetz |
| Baukomfort/-automation | B0 Einzelbau/Verbindung, B1 Copy/Paste/Bibliothek, B2 Ghost-Großplanung, B3 echte Geräte/Bauqueue, B4 Erdarbeitspläne; FP03§2.2:117–123,§12.1:1253–1266 | Frühe Planungskenntnis ohne Forschungslock; unimplementierte Komfort-/Ausführungspfade ehrlich geplant |
| FP04 Katalog A | M01–M07: Flachschürfer, Vermessungsanker, Kompaktbagger, Grader, Großbagger, Biomasseernte, Mining-Hopper; FP04§6:331–426 | Sieben konkrete bekannte Zukunftsobjekte; keine Mining-/Erdbauimplementierung |
| FP04 Katalog B | T01–T06: Crawler, Kipptransporter, Schüttgutdepot, Ladebucht, Dispatchterminal, Bandnetzausbau; FP04§7:450–499 | Sechs Ziele; aktueller einfacher genehmigter Träger ist kein fertig simulierter autonomer Crawler |
| FP04 Katalog C | C01–C05: Bau-Crawler, Baudrohne, Lastheber, Baudepot, Reparaturbot; FP04§8:511–556 | Fünf Ziele; IDs quellenqualifizieren, nicht mit CargoC01 oder FP05CityC01 verwechseln |
| Energieherstellung | FP04 E0-EXPEDITION, E1-REASSEMBLY, E2-RECYCLED-FAB, E3-RAW-MATERIAL-CLOSURE, E4-HEAVY-POWER; §10.2:673–677; explizites `FP04-WIND-FAB-6KW-V0` §10.4:699 | Fertiges Startgerät ≠ einmaliges C24/C25-3kW-Reassembly ≠ neue Generatorfertigung ≠ eigene Rohstoffclosure. Forschung-/Designwerte nicht als bestätigte Runtimeprofile übernehmen |
| FP05 Wasser/Fluid | W01–W11: Survey, Intake, Pumpe, Rohrmodul, Ventil, Tank, Filter, Messstück, Recyclingwasser, Kühlskid, Rohrbrücke; FP05§6:456–570 | Elf Ziele mit offenem/fehlendem Fluidcontract; keine versteckte Pflicht für trockene Fabrik |
| FP05 Industrie | H01–H15: Nasskonzentrator, Eindicker, Filterpresse, Sortierung, Recyclingschmelze, Gusszelle, Präzision, Teilemontage, Wärmetauscher, Schaltwerk, thermische Energie, Gasdruck, Reststoffhof, Tanker, Wartungsportal; FP05§7:589–757 | Fünfzehn Ziele; Metallrecycling ≠ Erzreduktion, Wärme/Gas-/Chemieverträge ehrlich fehlend |
| FP05 Stadt/Raumhafen | C01–C12: Tor, Substation, Pumpwerk, Industrieyard, Roboterdocks, Archiv, Frachtterminal, Kommunikation, Service, Sozialplatz, Raumhafen, Schwarzstartinsel; FP05§8:778–896 | Zwölf bekannte Ziele. Keine Stadt-/NPC-/Roboterauthorität, kein Wiederflug des Startschiffs |
| Weiterer Energiepfad | FP05 P0–P6: Starter, optionale Biomasse, endliches3kW-Reassembly, eigene6kW, große Wind/PV/Netze, optionale thermische Anlage, City/Spaceportnetz; §10.2:1023–1031 | Kann mit obigen Energiezielen verknüpft/gruppiert werden, ihre unterschiedlichen Engpässe bleiben sichtbar |

FP04 enthält damit18 ausdrückliche Maschinen-/Logistik-/Bauobjekte, FP05 enthält38 ausdrückliche Wasser-/Industrie-/Cityobjekte. Das sind Quellobjektzahlen, keine zwingende flache UI-Buttonzahl oder neu akzeptierte Katalog-IDnorm. Konkrete stabile `fp04.*.v1`/`fp05.*.v1`-Refs stehen bei den jeweiligen Steckbriefheaders; technische UIaliasnamen brauchen quellenqualifizierte Bezüge.

## supported / planned / blocked / unknown im tatsächlichen ReadContract

`hostPort.ts:122–123` bietet bereits `id/name/status/requirements/reason` mit `AVAILABLE | MISSING_REQUIREMENTS | PLANNED`. Die folgenden Begriffe sind eine fachliche Zuordnung, keine neue verpflichtende Enum/API:

- **Supported:** Der bestehende Prototyp besitzt tatsächlich geschlossenen Command-/Native-/Material-/Processpfad. `AVAILABLE` darf dann „Im Prototyp unterstützt“ bedeuten; daraus folgt weder gebaut, lokal montierbar noch stromversorgt. B05/B06/B07/B09, C03/C04 und bezahltes4m-Band/REC05-Brace besitzen konkrete S0-Pfade; numerische Fakten bleiben W01-owned. Wind/PV-S0-Autorendaten oder REC07-`first-dry-loop` allein beweisen keine geschlossene Heavyhandling-/Aircoverage-/W04manual-Admission.
- **Planned:** Bekanntes Quellenziel mit noch fehlender Runtime-/Definitionsintegration: `PLANNED` plus konkrete Teile-/Werkzeug-/Netz-/Prozessdefizite. FP04/FP05-Infrastruktur wird nicht aufgebaut. Ein bloßes „Später“ reicht T039 nicht.
- **Blocked:** Aktuell unterstützter Pfad, bei dem tatsächlich gelesene Materialien/Fähigkeiten/Nativezustände fehlen: `MISSING_REQUIREMENTS` mit sichtbarem primärem Grund und nächsten Defiziten. Keine Forschungspunkte oder synthetischen Blocker; Fakten nur aus derselben Host-/Materialauthority.
- **Unknown:** Nicht geschlossene Definition, Geometrie, BOM, Leistungs-/Umwelt-/Rechtefähigkeit oder nicht bestätigte Beobachtung ausdrücklich als ungeklärt anzeigen. Existierendes `PLANNED` mit sichtbarem Requirements-/Reasontext kann das ausdrücken; keine null/0-Schätzung, kein stilles supported. Keine offenen Ownerentscheidungen als angenommen deklarieren.

Der aktuelle `factorySession.ts:191` veröffentlicht nur `factory_dry`/`fluids`, sodass das vollständige Verzeichnis noch fehlt. `technologyView.ts:22–24` ignoriert bisher `reason` und zeigt für jeden nicht geplanten Eintrag pauschal „Gebaut wird …“. Deshalb müssen fehlende Definition/unknown/Gates entweder als Requirements tatsächlich sichtbar sein oder Reason im bereits gewährten UIpfad angezeigt werden. Der Selektionsbutton ändert nur lokale Auswahl, keine `submit`-/Build-/Stock-/Energieaktion; diese Grenze erhalten. Bereits vorhandene Statuslabels dürfen Zukunftseinträge nicht als Bauaktion ausgeben.

Minimaler zulässiger Anschluss: statische, quellengebundene Zielmetadaten plus dynamische gelesene Defizite im bereits gewährten `factorySession.ts`/ReadView; Anzeige im vorhandenen `technologyView.ts`, lokale Read-/DOM-Orakel im vorhandenen Host/UI-Testscope. Keine Änderungen am gefrorenen W01-/W03-/W04-/W08-Katalog, keine neue Admission oder generische Facilitycreation. Bezeichnungen/Quellenrefs solcher reinen Metadaten sind technische S0-Bindung, kein akzeptierter Produktions-/Physikfreeze.

## Gelesene Sourcehashes

Archiv FP03:191555B/`7d43e358ae7ead52da3996e85bc52906cb2584a42e0802fc4d1e959df1289cb1`; FP04:183440B/`a04f8074afc4e1d5cd8d8eb948bb93f42cdc5a5cc73b3f2a077cb13e67e48570`; FP05:234260B/`8aea627c70e7335a0d5d0c82c3070bfcc7d575605d037e9435ba0935e51557df`; FP06-Mainplan:195396B/`501bf5d80ee6dec9627e48ea27c271b3f964d21cde61ce9410be7eb77fa182ea`.

Tatsächliche Produktsources im oben gebundenen Read: HostPort10087B/`da5fc8501828850272aeb3e55e93cce37f57c288961fb81b2c5aec9f09e9afdf`; FactorySession46091B/`81e81d62570ea63bc1833ce4c64624990dddbdd894e10d3da78a2c98ac178ef5`; TechnologyView1756B/`dd0dc44d98d7747b8cb9274c5d9f8158218744ad8fd9770860baacf0cec90da9`; fp02Catalog23335B/`e746f2408314511a9e82315734fc78993b13ddc2627216b72dc0aa2c35d73fd3`; InstallationProfile5568B/`4e5d3f027da5aef0ba68243b911c55d7558eab86477e2ebd3e134a26f82d8b8b`; FactoryAssets14061B/`a9d707c53d8ae401e952076007aff523bcec127f4c0b58d37020aaea9ced973c`; HostLifecycleTest50961B/`dd188d2f172e948beec2935fdc399261bef9be5e12bea236e75316366a69561c`. Autorisierter Writer darf diese bewegliche Phase weiterentwickeln; neuer Seal/Testreceipt-Review folgt separat, nicht als hier bereits bestanden.

Endread `2026-10-11T23:50:23.629057+00:00`: HostPort, FactorySession und TechnologyView blieben bei diesen Hashes. Der Hosttest driftete legitim für den Root-gemeldeten tatsächlichen179-RED auf54444B/`85982fc861f3e3c19395118b3ff91cb65db360478bdb866e40418db3c4e322c4`; seine Ausführung und künftige180-/Buildphase wurden im Sourcepreflight nicht als bereits PASS bewertet.

**Scopekorrektur nach Root-Mitteilung vom 2026-10-11:** Meine obige Bezeichnung eines „bereits gewährten UIpfads“ war unzutreffend: Die tatsächliche aktuelle26-Pfad-Integratorfreigabe enthält `technologyView.ts` und die UIpanels nicht; der UIwriterlease ist geschlossen. Sichtbare Reason-/Unknowntexte können innerhalb des bestehenden Grants direkt über `FactorySession`-`requirements` veröffentlicht werden. Erst wenn eine konkrete UIänderung tatsächlich nötig wäre, müsste Root deren exakten zusätzlichen Pfad gewähren; dieser Preflight erteilt keinen solchen Grant. Historische Sourcebeobachtungen und Unterlagenanforderungen bleiben unverändert lesbar.
