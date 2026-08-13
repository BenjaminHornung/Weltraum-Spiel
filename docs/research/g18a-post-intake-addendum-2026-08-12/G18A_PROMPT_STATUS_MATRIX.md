# G18A Prompt Status Matrix

**Status:** `REQUIRES_OWNER_DECISION`  
**Scope:** Re-Check der zehn historischen G18-Folgeprompts gegen P06, X01, X02, WP04, Storyboard und Hestia Visual Language

## 1. Klassifikationsregeln

| Klasse | Bedeutung |
|---|---|
| `READY` | alle Einstiegsgates erfüllt; Prompt ist textlich und autoritativ aktuell |
| `BLOCKED_BY_OWNER` | Prompt ist im Kern verwendbar, aber eine explizite Ownerentscheidung fehlt |
| `BLOCKED_BY_D037` | Prompt würde einen ersten einschlägigen Write auslösen, obwohl Repo/Pfad, Basis-SHA, Scope und sole Write Owner nicht akzeptiert sind |
| `SUPERSEDED` | das geforderte Research-/Dokumentartefakt liegt bereits commitgebunden vor; Prompt nicht erneut ausführen |
| `REQUIRES_FIX` | Prompttext enthält nach Intake eine falsche, überholte oder variantenglättende Annahme |

Die Matrix benennt eine primäre Klasse. Weitere Blocker bleiben in der Begründung sichtbar.

## 2. Matrix

| Nr. | Historischer G18-Prompt | Status | Begründung | Erforderliche nächste Aktion |
|---:|---|---|---|---|
| 01 | Owner Source Freeze | `SUPERSEDED` | X02 liefert einen exakten Owner Decision Freeze und Patchvorschlag. Der alte Prompt darf nicht mit eigener Statussemantik erneut laufen. | X02 durch Owner anwenden oder revidieren; keinen zweiten Freeze erzeugen. |
| 02 | Common Contract Crosswalk | `SUPERSEDED` | X01 liefert Proposal, Ownership Matrix und Shadow Risks. Lieferung ersetzt den Researchprompt, nicht den Ownerentscheid. | X01-D-01 bis D-17 entscheiden; Proposal nicht als implementiert behandeln. |
| 03 | G03A Editor Topology | `BLOCKED_BY_D037` | Ein Topologie-/Kernel-Write ist ohne akzeptiertes Ziel-Repo/Pfad, Basis-SHA, Scope und sole Write Owner unzulässig. D-036 steht zudem auf `SPIKE_FIRST`. | D-037 zuerst `ACCEPT` setzen; dann einen engen read-only oder ausdrücklich autorisierten Spike neu schneiden. |
| 04 | Renderneutral Command Kernel | `BLOCKED_BY_D037` | Der Prompt zielt direkt auf den ersten gemeinsamen Kernel-Write. X01 bleibt Proposal; D-032 ist `SPIKE_FIRST`. | D-037 und X01-Prerequisites schließen; Prompt mit akzeptiertem Repo/Pfad/SHA/Owner neu ausstellen. |
| 05 | Content Package Lock | `BLOCKED_BY_OWNER` | Namespace, Lockarten, Mod-Scope, Rechte und Signatur-/Lizenzfragen sind nicht akzeptiert. P02 ist unlicensed; P05 ist quarantänisiert. | Package- und Rechteentscheidungen treffen; P05 nur nach sicherer Source-only-Neupaketierung neu prüfen. |
| 06 | Validation, Issue und Quick-Fix | `BLOCKED_BY_OWNER` | X01s Validation-Vokabular und Package Ownership sind noch Proposal. Quick Fix darf kein direkter Validatorwrite sein. | X01-Validationcontract und Approval-/Ownershipgrenzen akzeptieren. |
| 07 | Playwright Evidence Runner | `BLOCKED_BY_OWNER` | Der Prompt bleibt strukturell brauchbar, aber Upstreamcontracts, C08-Abgrenzung und Owner-Thresholds sind offen. WP04 ist jetzt integriert, ersetzt jedoch kein Benchmark- oder Produktgate. | Entry Conditions auf `c64aeef...`, C08 als separates Gate und aktuelle Owner-Thresholds aktualisieren. |
| 08 | Mission Compiler | `BLOCKED_BY_OWNER` | G05-/Missioncontracts, Paketgrenzen, P02-Rechte und X01-Vokabular sind nicht akzeptiert. | Mission Authority und P02-Rechte entscheiden; Compilerprompt erst danach aktualisieren. |
| 09 | Settlement Contracts | `REQUIRES_FIX` | Der Prompt glättet offene G06-/G16-Varianten und kann globale Event-, Reservation- oder Spatial-Semantik vorwegnehmen. Das verstößt gegen X01. | Prompt variantensicher neu schreiben; G06/G16 und X01-D-01/D-03 vorher entscheiden. |
| 10 | Road, Block und Parcel Geometry | `REQUIRES_FIX` | Der Prompt setzt eingefrorene G04/G16-Geometrie- und Reservationannahmen voraus, obwohl G16 inkompatible Varianten besitzt und Ownership offen ist. | Eingaben auf explizit akzeptierte Variante, stabile IDs, Lineage, AuthoredSpatialReservation und Authoritygrenzen umstellen. |

## 3. Ergebniszählung

| Klasse | Anzahl | Prompts |
|---|---:|---|
| `READY` | 0 | keine |
| `SUPERSEDED` | 2 | 01, 02 |
| `BLOCKED_BY_D037` | 2 | 03, 04 |
| `BLOCKED_BY_OWNER` | 4 | 05, 06, 07, 08 |
| `REQUIRES_FIX` | 2 | 09, 10 |

## 4. Globale Korrekturen für jeden späteren Prompt

Jeder neu ausgestellte Folgeprompt muss:

1. exakte Repository-, Branch- und Commit-Inputs nennen;
2. Branch-Research nicht als Produkt-Main-Implementierung ausgeben;
3. X01 als Proposal labeln, bis die Varianten entschieden sind;
4. D-037 bei jedem Write als Entry Gate prüfen;
5. Hestias Visual Language als Design Target und technische Captures als Runtime Evidence trennen;
6. WP04 bei `c64aeef...` als integrierte Lab-Wahrheit behandeln;
7. C08 als separates Benchmark-Synthese-Gate behandeln;
8. P05-Distribution und alle Secret-Werte vollständig ausschließen;
9. nur einen Write-Owner pro Repository zulassen;
10. einen begrenzten Arbeitspaketscope statt eines Mega-Prompts enthalten.

## 5. Stop-Regel

Keiner der zehn historischen Prompts wird durch G18A ausgeführt. `SUPERSEDED` bedeutet nicht automatisch akzeptiert; `BLOCKED` bedeutet keine Erlaubnis zu einer Ersatzimplementierung.

