# FP06 W00: Entscheidungen und Freigabegrenzen

Stand: 2026-10-11. Basis: `e40592c113b72a8dc93725187f92cf948e07f44d`.
Die Nutzeranweisung beauftragt W00–W11, abhängigkeitsgerecht und nur soweit erforderliche Freigaben und konfliktfreie Schreibgrenzen bestehen. Sie genehmigt keine offenen produktprägenden Varianten pauschal. Anhänge sind Planungsquellen; ein vorgeschlagener Wert wird durch Lesen oder Hashprüfung nicht akzeptiert.

| ID | Status und konkrete Grenze | Auswirkung |
|---|---|---|
| D01 | USER_CONSTRAINT: Bau 0,25 m; Terrain 0,125 m separat aus aktuellem HVP-Profil. | Kein eigener Rasterblocker. |
| D02 | USER_CONSTRAINT: bestehende Resources-Snapshots sind alleiniger Cargo-Bestand; keine Schattenbuchhaltung. Quantisierung separat im W01-Freeze. | W02 bleibt vom W01-Gate abhängig. |
| D03 | USER_CONSTRAINT_WITH_SOURCE_POLICY: bestehende Schiffspolitik bleibt erhalten; lokaler Factoryallocator wird gegen fachlich angenommenes FP01 geprüft. Keine erfundene Fairness/Hysterese. | W03 nach W01; Sourcepolicy vor Implementierung exakt lesen. |
| D04 | USER_CONSTRAINT_WITH_DESIGN_GATE: gemeinsamer Save/Recovery ausdrücklich beauftragt. Geschlossenes HVP-V1 nicht still erweitern; neuer gebundener kombinierter Formatvertrag. | W10 bleibt zusätzlich von D11 und W09 abhängig. |
| D05 | ACCEPTED_BY_USER: 100 ms nach sechs bestätigten 60-Hz-Hostticks; keine Offline-Nachholung. | W04/W06 bleiben vorgängerabhängig. |
| D06 | ACCEPTED_BY_USER: versorgter Bandkredit 1 kg/s, initial 0, maximal 10 kg, persistent. Burstreserve ist keine strenge gleitende Minutenrate. | W08 bleibt von W02 abhängig. |
| D07 | ACCEPTED_BY_USER: `/factory.html` im bestehenden Browserpaket, eine HVP-/Native-World. | W06 bleibt von W01 abhängig. |
| D08 | DEFERRED_OUT_OF_SCOPE: Terrain-Materialparticipant. | Nur W13; wird nicht begonnen. |
| D09 | DEFERRED_OUT_OF_SCOPE: langlebiges begrenztes Receiptprotokoll. | Nur W15; wird nicht begonnen. |
| D10 | USER_CONSTRAINT: keine pauschalen Timeout-/Queue-Erhöhungen. | W11 behält 30 s / Expect 5 s; Langflow separat. |
| D11 | ACCEPTED_BY_USER: maximal 16 feste Facility-Owner; native Installtransaktion und vollständiger gemeinsamer Worldcheckpoint innerhalb bestehender Gesamtbudgets. | W07/W10 bleiben vorgängerabhängig. |

Diese Statusbezeichnungen erfassen die tatsächlich vorhandene Nutzerautorisierung und deren Grenzen. Sie sind keine neu erfundenen Owner-Acceptance-Receipts. Der ältere Remote-FP06-Branch ließ D01–D07/D10/D11 vorgeschlagen; er ist kein aktuelles Freigabesignal.

## Offener nächster Write: W01-Quellen-/Mengenfreeze

Dem Nutzer wurde der konkrete Freeze vorgelegt: unveränderte FP02 C01–C28, REC-01–REC-07, BOM, Maße und Ports; Massengüter in 1-mg-Zulassungsquanten, Komponenten in ganzen Stückzahlen, SALVAGE-01 separat, unpassende Mengen abweisen. Nutzerantwort „W01-Freeze freigeben“ am 2026-10-11 um 09:23:32 UTC; ACCEPTED_BY_USER. W01 besitzt erst nach W00-Gate einen Produktwrite-Grant.

Die bestehende ResourceId-Validierung akzeptiert keine FP02-Punktnamen. Ein explizites bijektives, versionsgebundenes Mapping muss beide Identitäten bewahren. Verpackungsvolumen ist nicht Feststoffdichte: beispielsweise 0,08 m³ / 60 kg Stahlblech ergibt 4/3 mm³ pro mg. Teilvolumen braucht exakte rationale Berechnung beziehungsweise eine freigegebene Losregel; Rundung und willkürliche Produktdichten sind unzulässig. Diese Präzisierung ist im Source-Lock sichtbar und keine still akzeptierte neue Zahl.

## Freigabegrund und zulässige Fortsetzung

FP06 §3.2: „Ein nicht abgenommener Vorschlag bleibt `PROPOSED`“. Die W01-Karte (§12.3) verlangt „Gefreezte FP02-IDs […] BOM, Ports und Frames“; §23 verlangt explizit freigegebenen Paket- und Source-Lock vor Produktwrite. Der Nutzer verlangt ausdrücklich, offene produktprägende Entscheidungen nicht selbst als akzeptiert zu deklarieren. Der anfangs offene W01-Freeze blockierte dessen Produktwrites und die abhängigen Pakete; die inzwischen ausdrückliche Antwort löst dieses Ownergate. W00-Audit, unabhängige Reviews und read-only W01-Vorbereitung laufen weiter. Keine zusätzliche generische Skill-Approval-Hürde wird eingeführt.

Die vier späteren Varianten D05/D06/D07/D11 wurden in einer gemeinsamen Frage vorgelegt. Die Quellen-/Mengenfrage wurde getrennt vorgelegt. Der Nutzer beantwortete beide Fragen ausdrücklich: „Alle vier für W00–W11 freigeben“ und „W01-Freeze freigeben“. Der vollständige Frageninhalt und Wortlaut liegen im Source-Lock und Run `user-approval.json`. Dies ist eine Freigabe ausschließlich dieser konkreten Varianten innerhalb W00–W11. Noch ungetestete Paketgates und spätere Owner-Art-/Gameplayabnahmen werden dadurch nicht bestanden.

## Technisch belegte Vertragsgrenzen

- HVP-Handle besitzt derzeit nur `dispose`; Factory-Hook ist neuer enger Integrationscode, keine bereits verfügbare Plugin-API.
- Physik läuft mit 1/60 s; Factoryzeit darf ausschließlich aus bestätigten Hostticks stammen.
- `hvp-game-checkpoint-v1` ist geschlossen; der kombinierte Save darf keine zweite, zeitversetzte World Authority erzeugen.
- Native Facility-Installpfad existiert noch nicht. Kein Umbenennen in die vorhandene Branch-Familie und kein Collider aus Rendererzustand.
- Acht 0,125-m-Kalksteinzellen bei 2400 kg/m³ ergeben 37,5 kg. Dichteprovenienz bleibt `prototype-tuning-unapproved`; dies genehmigt keinen W13-Bergbau.
- Wrack bleibt flugunfähig; C01–C28 sind endliche Fracht, SALVAGE-01 ist erst durch reale separate Übergabe erhältlich.

## Technische Kapazitätsbindung W01

Als konservative, explizit versionierte Kapazitätsenvelope (keine Feststoffdichte) verwenden Halbzeug, Verschnitt und Stütze das Maximum der sourcegebundenen C10/C11/C12-Verpackungsquotienten: 9/4 mm³ pro mg. Das Antriebsmodul verwendet seine vollständige rationale Input-Packenvelope. Bekannte Cxx-Packvolumina bleiben unverändert; tatsächliche Belegung wird exakt rational gegen ganze mm³-Grenzen verglichen. Rock/Gravel haben ohne zugelassenes Profil keine echten Kapazitätstransfers; ein explizites synthetisches Testprofil ist kein Mining-Grant. Diese konservative Ableitung kann mehr Platz reservieren als reale Packung; sie verhindert eine freie Kapazitätsgutschrift durch unbekannte Dichte.
