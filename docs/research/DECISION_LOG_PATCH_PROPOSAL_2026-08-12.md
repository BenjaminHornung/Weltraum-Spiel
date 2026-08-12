# X02 – Decision Log Patch Proposal

**Datum:** 2026-08-12  
**Ziel:** Vorschlag zur expliziten Ownerfreigabe für G18 und den ersten Editor-Core-Spike  
**Status:** nicht angewandt; keine Repository- oder Decision-Log-Änderung

## Patch-Regel

Für jede X02-Disposition und für die `Status`-Spalte der neuen Patchzeilen verwendet dieser Entwurf ausschließlich die verlangten Statuswerte. In Abschnitt A werden abweichende Originalstatuswerte nur als unveränderte Evidenz daneben gezeigt:

| X02-Status | Abbildung bestehender Logstatuswerte |
|---|---|
| `ACCEPT` | `ACCEPTED` beziehungsweise eine ausdrücklich belegte geltende Festlegung |
| `REJECT` | `REJECTED` beziehungsweise eine durch geltende Festlegung ausgeschlossene Option |
| `DEFER` | `DEFERRED` oder noch nicht aufgelöste `OWNER_DECISION_REQUIRED`-Frage |
| `SPIKE_FIRST` | `REQUIRES_SPIKE` |

Ein Owner-Sign-off auf diesen Patch macht auch eine `DEFER`-Zeile zu einer bewussten Vertagung. Ohne Sign-off bleiben alle neuen Zeilen reine Vorschläge. Bestehende Einträge werden nicht still überschrieben; jede spätere Richtungsänderung braucht eine neue `SUPERSEDES D-xxx`-Zeile.

## A. Bestehende Wirkung bewahren; Originalstatus auf X02 abbilden

| ID | Originalstatus | X02-Status | Bewahrte Wirkung |
|---|---|---|---|
| `D-001` | `ACCEPTED` | `ACCEPT` | Browser-/Chromium-first, harte Blockvoxels, CPU-Zellauthority. |
| `D-004` | `ACCEPTED` | `ACCEPT` | Benchmark Protocol v1 und Rohsample-/Provenienzregeln. |
| `D-005` | `ACCEPTED` | `ACCEPT` | Serielle BR-/WP-Gates bleiben wirksam. |
| `D-010` | `ACCEPTED` | `ACCEPT` | Keine Lab→Produkt-Integration vor WP12; erster späterer Handoff read-only/fixturegebunden. Keine weitergehende Spike-Isolation aus `D-010` ableiten. |
| `D-012` | `ACCEPTED` | `ACCEPT` | `0,25 m` als V1-Referenz; `0,125 m` nur explizite lokale Forschungsdomäne. Keine universelle Produktauflösung daraus ableiten. |
| `D-013` | `ACCEPTED` | `ACCEPT` | Lizenz-/Provenienzmanifest; keine Kopie von GPL/NC/unlizenzierten Inhalten. |
| `D-014` | `OWNER_DECISION_REQUIRED` | `DEFER` | Explizite Lab-Lizenz bleibt offen; bis dahin kein Release, Contribution oder Transfer. |
| `D-022` | `ACCEPTED` | `ACCEPT` | Human Review bleibt für Art Direction zwingend. |

## B. Patchzeilen nach `D-023`

Die folgenden Zeilen sind patch-ready, aber erst nach explizitem Owner-Sign-off wirksam. Der vollständige normative Acht-Feld-Datensatz jeder ID — Frage, Optionen, Berichtsempfehlung, sicherer Default, Vertagungsfolge, blockierte Gates, Decision-ID und Status — steht in `OWNER_DECISION_FREEZE_2026-08-12.md`. Die Tabelle unten ist dessen kompakte Log-Serialisierung und ersetzt diese acht Felder nicht.

| ID | Status | Entscheidungstext | Wirksamkeit / sichere Grenze | Blockierte Gates | Quellen in G01–G17 |
|---|---|---|---|---|---|
| `D-024` | `DEFER` | MVP-Grenze bleibt offen. Planungsdefault ist VS-01 bis VS-03; VS-03 ist erster spielrepräsentativer Slice, danach Scope-Stopp. | Keine Scope-/Terminfreigabe; Schiff, Orbit, Vollstadt, dynamische Fragmente und Multiplayer bleiben außerhalb des Defaults. | `DG-01`, P0, Readiness Crosswalk, VS-01–VS-03-Handoff | G01:678–701, 820–833, 1150–1163 |
| `D-025` | `DEFER` | Survivalhärte bleibt offen. Default: mittlerer Expeditionsdruck bei stabiler Basis, keine permanenten Bedürfnisse. | VS-01 nutzt reversible Knappheit und kein hartes Hunger-/Durstsystem. | `DG-01`, GDD, VS-01 | G01:559–567, 1057–1063; G04:912–920 |
| `D-026` | `DEFER` | Zeitpunkt der ersten Stadt bleibt offen. G01 empfiehlt Kontakt nach 60–90 min und funktionalen Sektor nach 105–140 min. | Keine absolute Minute wird Vertrag; G14 ergänzt nur Stadtrand/kleine Settlement-Zone als räumliche Eintrittsform. | P0/GDD, `UX-04`, First City | G01:571–583, 1063–1064; G14:637–655 |
| `D-027` | `DEFER` | Zeitpunkt des ersten Orbits bleibt offen. Sequenzdefault: nach Stadtbogen, eigenem Schiff und Surface-Payoff. | G01s 15–20 Stunden sind Richtwert, kein Freeze. | P0/GDD, `UX-06`, `G15-12` | G01:587–600, 1063–1064; G07:995–1044; G14:656–670 |
| `D-028` | `DEFER` | Kampfpflicht bleibt offen. Default: kein Pflichtkampf im ersten Slice; spätere Konflikte unterstützen glaubwürdige Nicht-Kill-Lösungen. | Keine allgemeine Zusage „Combat vollständig optional“. | VS-07, `G15-00`, `G15-12` | G01:331–337, 559–565, 772–793; G15:1146–1200 |
| `D-029` | `DEFER` | Singleplayer-versus-Multiplayer bleibt formal offen. Default: lokal autoritativer Singleplayer zuerst, Verträge multiplayerfähig. | Kein Netzwerk-/Shared-World-Code im ersten Core-Spike. | Multiplayer-/Shared-Authority, Persistenz, Economy | G01:856–886, 1067–1069; G08:1851–1862; G13:948–959 |
| `D-030` | `SPIKE_FIRST` | Physische Developer-App-Topologie wird erst nach isoliertem Vergleich von separater Browser-App/Origin und Dev-Route entschieden. | Development Authority und Surface bleiben logisch getrennt; keine versteckte Dev-Authority im Player-Bundle. | G03.4/G03.5, `UX-00`, `G17-00` | G02:127–143, 972–978; G03:405–429, 627–646; G17:1387–1393 |
| `D-031` | `DEFER` | Player Construction als Runtime-Workspace bleibt offen. Default für Tests: eigener `player`-Actor, enge Gameplay-Allowlist, kein Dev-/Schema-Zugriff. | Keine Produktfunktion oder persistente Bauauthority wird freigegeben. | `UX-00`, `UX-05`, Player Capability Sandbox | G02:419–439, 979–984; G11:218–256; G14:480–508 |
| `D-032` | `SPIKE_FIRST` | Ein gemeinsamer Command-/Transaction-Kern für Developer, Player, Migration und KI ist bevorzugte Hypothese und wird synthetisch bewiesen. | In-memory Domain Commands, Prepare/Diff/Validate, Revision/CAS, atomarer Commit, Receipt, Undo; keine Product API. | G02 Core Spike, G03 Mini-RFC, `G17-00`–`G17-03` | G02:68–84, 959–970; G11:710–803; G17:219–247 |
| `D-033` | `REJECT` | Die Zulassung ungeprüfter KI-Direktmutation und einer privilegierten Modell-Commitroute wird abgelehnt. | KI bleibt Proposal/Dry Run/Diff/Preview; jede Mutation nutzt ausschließlich die normale Transaction-Authority. Ob jede V1-Auslösung Human Approval braucht, bleibt `D-034`. | AI-Write-Handler, `G17-15` | G03:47–58; G05:82–92; G12:36–50 |
| `D-034` | `DEFER` | Ob wirklich jeder AI-initiierte V1-Commit Human Approval braucht, bleibt offen. Default: ja, an exakten Prepared Hash und einmalige Freigabe gebunden. | Kein AI-Autocommit; manueller Core-Spike darf fortfahren. | G11.0/G11.7, `G17-00`, `G17-15` | G02:385–417; G11:1580–1587, 1623–1631; G17:1308–1320 |
| `D-035` | `DEFER` | V1-Modumfang bleibt offen. Default: ausschließlich additive, deklarative data-only Pakete; kein JS/Wasm/Shader/HTML/native oder Remote-Code. | Nicht erlaubter Inhalt bleibt inaktiv/fail-closed. | G09-00/G09-13, `G13.0` | G09:854–870, 1070–1092; G13:65–114, 701–708 |
| `D-036` | `SPIKE_FIRST` | G03 Hybrid-Eigenbau wird vor Adoption bewiesen: Semantik selbst, austauschbare UI-Bausteine nur nach Vergleich. | Kein Voll-Editor, Framework-Lock-in oder Enginewechsel vor Evidenz. | G03.1, G03.4, G03.5 | G03:15–43, 551–588, 653–669 |
| `D-037` | `DEFER` | Ziel des ersten isolierten Spikes bleibt offen. Owner muss Repo/Pfad, Basis-SHA, Scope und alleinigen Write-Owner exakt benennen. | Bis dahin kein Write. Die Spike-Berichte empfehlen, Produkt- und Lab-Repo auszuschließen; `D-010` verbietet unabhängig davon Lab→Produkt-Integration, wählt aber kein Repo. | G02-S3, G03.4, G11 Write-Handoff | G02:805–837, 989; G03:551–588; G11:1680–1704 |
| `D-038` | `DEFER` | Normativer Craft-Frame bleibt offen. Default: explizite Frame-IDs plus getesteter `CraftFrameAdapter`. | Keine stille +X/+Z-Umdeutung oder implizite Handedness. | G09-00–G09-03 | G09:134–140, 1120–1128 |
| `D-039` | `DEFER` | `CraftBlueprintV2` bleibt offen. Preferred path nur mit verlustfreiem V1-Migrator; `ShipBlueprintV1` bleibt Migrationsquelle. | Keine parallele Craft-Authority und kein Hard Replace. | G09-00–G09-03, G09-13 | G09:108–120, 171–235, 1070–1092 |
| `D-040` | `DEFER` | Tactical Pause bleibt offen. Default: vollständige lokale Planpause, Commands erst nach Resume. | Bis zum Freeze kein Pause-Oracle und keine Zeitbalancebehauptung. | `G15-00`, Tick/UI, `G15-12` | G15:849–860, 1202–1210, 1388–1393 |
| `D-041` | `DEFER` | Drone Lost Link bleibt offen. Default: safe-point-then-hold/return, keine neue Zielwahl, ROE-Erweiterung, Eskalation oder Scuttle. | Nur deterministischer Failsafe-Harness, keine bewaffnete Autonomie. | `G15-04`, `UX-07` | G15:653–664, 723–815; G14:686–690, 795–817 |
| `D-042` | `SPIKE_FIRST` | NPC-/Stadtgröße wird nach Messung entschieden. Erstes Harness: 64 persistent/16 `FULL`; City-Kappen 80–250/16–48 bleiben separater, ungemessener Scope. | Keine Produktkapazitäts- oder Framerategarantie. | G04 Gate 7, G06.7, H1–H3 | G04:1182–1205, 1341–1346; G06:9–23, 269–331 |
| `D-043` | `DEFER` | Offlinefortschreibung bleibt offen. G05/G08 empfehlen V1 aus; G06 entwirft deterministischen Catch-up samt 48-h-Szenario und lässt Umfang/harte Folgen owneroffen. | Default: kein Wallclock-Fortschritt und keine harten Offlineverluste; späterer Catch-up nur event-/grenzenbasiert. | G04 Gate 7, G06.0–G06.3, Time/Save Authority | G05:1292–1299; G06:208–229, 340, 440–443; G08:1252–1254 |
| `D-044` | `DEFER` | Contribution-Governance bleibt offen: geschlossen, DCO, CLA oder anderer expliziter Rechtefluss. | Keine externen Contributions oder Codeextraktion bis Lab-/Toolchain-Lizenz und Rechteinhaberschaft geklärt sind. | `D-014`, G12 AT-00, `G13.0` | G09:888–892, 1138–1140; G12:785–793; G13:1008–1010 |
| `D-045` | `DEFER` | Reale H2-/H3-Geräte, Browser, OS und Fixtures bleiben offen. | Keine Hardcaps oder Performanceversprechen; Messwerte bleiben D-004-Diagnostik. | G04/G06 Performance, G17-13/G17-14 | G01:90–103; G09:978–990; G17:1398–1401, 1587–1602 |
| `D-046` | `DEFER` | Eine H3-spezifische WebGL2-Fallbackbindung ist nicht entschieden. | WebGL2-Pfad behalten, aber keine H3-Backend- oder Leistungsbehauptung. | H2/H3-Freeze, WP10/WP12, G17-13/G17-14 | G02:774–776; G17:884–905, 1001–1007 |
| `D-047` | `DEFER` | Save-Supportfenster bleibt offen: N Releases, Zeitfenster, unbegrenzte Pins oder explizite Migration. | Exakte Locksets, Original-Save und zertifizierte/idempotente Migration; keine stille Substitution. | G09-13, `G13.0`, `G13.4`, `G13.5`, `G17-00` | G05:455–475; G13:452–460, 1091–1092; G17:1393–1395 |
| `D-048` | `DEFER` | Package-Quarantänepolitik bleibt offen. Default: unveränderte Bytes und Diagnose erhalten, nicht ausführen oder still ersetzen. | Fehlende simulationsrelevante Abhängigkeit blockiert Load/Aktivierung; reparierte Releases bekommen neue Version und Digest. | `G13.0`, `G13.4`, `G13.5`, Public/Product Release | G02:939–948; G11:1164–1201; G13:680–697, 963–996 |

## C. Freigabeklausel für den ersten Editor-Core-Spike

`D-037 DEFER` oder `SPIKE_FIRST` autorisiert keinen Write. Der Spike darf erst schreiben, nachdem der Owner Zielrepo/-pfad, Basis-SHA, Scope und Write-Owner exakt benannt und `D-037` ausdrücklich auf `ACCEPT` gesetzt beziehungsweise durch einen neuen `ACCEPT`-Eintrag supersediert hat. Sein maximaler Scope ist dann:

1. synthetische, in-memory Testdomäne; keine Produkt-, Save-, Golden- oder Voxel-Lab-Authority;
2. zwei Actors (`developer`, enger `player`) auf demselben experimentellen Command-Gateway;
3. `prepare → diff/preview → validate → human apply → atomic commit → receipt → undo/redo`;
4. keine UI-/Renderer-Direktmutation, kein Cross-Domain-Teilcommit, kein automatisches Rebase;
5. KI deaktiviert oder proposal-only; kein Modell-Commitpfad;
6. nur data-only Fixtures; keine externen Runtime-URLs oder ausführbaren Packages;
7. Ergebnisse sind Spike-Evidence, keine Produktadoption und kein implizites `ACCEPT` für `D-030`, `D-032` oder `D-036`.

### Stopbedingungen

- kein exakt benanntes Zielrepo/-verzeichnis oder keine akzeptierte Basis-SHA;
- Produkt- oder Lab-Code müsste kopiert, verändert oder gebunden werden;
- ein Commit wäre ohne Revision-/Hashprüfung, atomaren Receipt-Pfad oder Undo-Oracle möglich;
- unklare Lizenz/Provenienz, ausführbares Package oder versteckter Netzwerkpfad;
- ein Benchmarkwert würde ohne D-004-Vertrag als Produktbudget ausgegeben.

## D. Owner-Sign-off-Feld

| Feld | Eintrag |
|---|---|
| Scope akzeptiert | _offen_ |
| Abweichende Decision-IDs/Status | _offen_ |
| Zielrepo/-pfad | _offen_ |
| Basis-SHA | _offen_ |
| Write-Owner | _offen_ |
| Datum/Owner | _offen_ |

Ohne ausgefüllten Sign-off bleibt dieser Patch vollständig nichtoperativ.
