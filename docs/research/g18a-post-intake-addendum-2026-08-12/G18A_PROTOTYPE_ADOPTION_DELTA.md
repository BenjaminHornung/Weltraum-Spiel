# G18A Prototype Adoption Delta

**Status:** `REQUIRES_OWNER_DECISION`  
**Basis:** P06 bei `BenjaminHornung/Weltraum-Spiel@9da5a187d68fd801ee3acafa9db5837215350cbd`  
**Scope:** Aktualisierung von G18s Prototype Adoption Matrix, keine Codeübernahme

## 1. Statusdelta

| Paket | G18-Historie | P06-belegter G18A-Status | Zulässige Übernahme | Harte Grenze |
|---|---|---|---|---|
| P01 | `ADAPT` | `ADAPT` | UI-Informationsarchitektur, Validierungsdarstellung, Vergleichs- und Inspector-Learnings | Fixture- und personenbezogene Benennungen neutralisieren; Lizenz und Provenienz vor Codeübernahme klären |
| P02 | `ADAPT` | `ADAPT` | Mission-Graph-UX, Auswahl- und Inspector-Learnings, React-Flow-Projektion nach akzeptiertem headless G05-Vertrag | Paket ist `UNLICENSED`; Dependencies und Rechte separat prüfen; keine UI-Library als Domain-Authority |
| P03 | `REFERENCE_ONLY` | `ADAPT`, mit enger Evidenzgrenze | RoadGraph-/Parcel-Vertragsideen, Pfad- und Inspector-UX | Fresh-checkout Captures belegen nur den geprüften Stand; Font-404, Keyboard-Lücken, schmaler Inspector und unbestätigtes Save/Load bleiben Issues; Geometrie/FNV/Mock nicht übernehmen |
| P04 | `REFERENCE_ONLY` | `ADAPT`, mit enger Runtimegrenze | View-State-, Handoff- und Telemetrie-UX | Mock-Orbits, ETA, Fuel und Risk nicht als Runtimevertrag übernehmen; Modal-Fokus ist fehlerhaft |
| P05 | `ADAPT` | Distribution `QUARANTINED`, Paket `DISCARD`, nur Learnings `ADAPT` | abstrahierte UX-, Rollen-, Vorschau- und Approval-Learnings | kompromittierte Distribution; kein Zitieren, Kopieren, Ausführen oder Adoptieren; Secret invalidieren/rotieren und nur Source-only neu paketieren |

## 2. Paketweise Delta-Details

### P01

P01 bleibt der sauberste UI-Referenzpunkt. Sein Wert liegt in der Visualisierung von Auswahl, Validierung und Vergleichszuständen. G18A autorisiert keine direkte Quellübernahme. Vor einer solchen Übernahme sind Lizenz, Herkunft, neutrale Fixtures und die Abbildung auf akzeptierte gemeinsame Contracts zu klären.

### P02

P02 besitzt die stärkste automatisierte Prototyp-Evidence im Intake, aber nur in seinem engen Paketkontext. Das Paket beweist keine Produktarchitektur. React Flow darf später eine Projektion sein, niemals die kanonische Missionsautorität. Die fehlende Lizenz ist ein harter Rechte- und Dependency-Boundary, kein kosmetischer Hinweis.

### P03

P03 wird gegenüber G18 von `REFERENCE_ONLY` auf ein enges `ADAPT` angehoben. Übernommen werden dürfen Vertrags- und Bedienideen rund um Straßen, Knoten, Blöcke und Parzellen. Nicht übernommen werden der aktuelle Mock- oder Geometriekern, ein lokales Hashschema als Projektvertrag oder unbestätigte Persistenzbehauptungen. Bildbelege werden nur für exakt verifizierte Views und Zustände verwendet.

### P04

P04 wird ebenfalls von `REFERENCE_ONLY` auf ein enges `ADAPT` angehoben. Der Wert liegt in Zustandsübergaben und der Darstellung abgeleiteter Missions- oder Flugansichten. Die gezeigten Orbit-, ETA-, Fuel- und Risk-Werte sind keine Simulation Authority. Der Modal-Fokusfehler verhindert eine unqualifizierte UX-Freigabe.

### P05

Die aktuelle P05-Distribution wird verworfen und quarantänisiert. G18A dokumentiert absichtlich keinen Secret-Wert und keinen Pfad innerhalb der kompromittierten Distribution. Zulässig sind nur abstrahierte Learnings, die ohne Zugriff auf oder Kopie aus dem kompromittierten Paket formuliert werden können.

Erforderliche Reihenfolge für jede spätere Wiederaufnahme:

1. betroffenes Secret invalidieren oder rotieren;
2. kompromittierte Distribution isolieren;
3. Source-only-Paket aus sauberer Quelle neu erzeugen;
4. Lizenz-, Dependency- und Secret-Audit wiederholen;
5. erst danach eine neue Adoption Classification ausstellen.

## 3. Domänen- und Autoritätsgrenzen

| Prototyp-Learning | Zielgrenze |
|---|---|
| Graphdarstellung | nur Projektion auf akzeptierten Domain Contract |
| Inspector und Selection | UI-Zustand, keine zweite Domain-Wahrheit |
| Preview | Copy-on-write oder äquivalente isolierte Proposal-Ansicht |
| Validation | strukturierte Issues; Quick Fix nur als normaler Command |
| Save/Load | erst nach belegtem Schema-, Revision- und Provenienzvertrag |
| Telemetrie | Diagnostik, kein Benchmark und keine Gameplay-Authority |
| Approval UX | Darstellung eines akzeptierten Approval Contracts, keine UI-Erfindung von Rechten |

## 4. Lizenz- und Sicherheitsregeln

- `UNLICENSED` bedeutet: keine Codeadoption, bis Rechte ausdrücklich geklärt sind.
- Dependency-Nutzung und Quellcodeadoption werden getrennt entschieden.
- P05 bleibt fail-closed. Keine Ausnahme durch Demoqualität, Zeitdruck oder fehlende Alternative.
- Screenshots belegen nur den konkreten Capture-Zustand. Sie beweisen keine versteckte Funktion.
- Kein Prototyp darf X01-Varianten, X02-Entscheidungen oder Produkt-Main-Verträge still festlegen.

## 5. Ergebnis

Die fünf Prototypen liefern nützliche UX- und Contract-Learnings, aber kein Paket ist für direkte Produktintegration freigegeben. P01 bis P04 sind eng adaptierbare Referenzen. P05 bleibt in seiner aktuellen Form unbrauchbar und sicherheitsbedingt quarantänisiert.
