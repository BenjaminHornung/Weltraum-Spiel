# FP06 W00: Entscheidungen und nächste Freigabe

Stand: 2026-10-10T20:46:08.453050+00:00. Basis: `e40592c113b72a8dc93725187f92cf948e07f44d`. Produktstatus: **BLOCKED**.
W00 wurde durch den aktuellen Benutzerauftrag gestartet. Dieser Auftrag macht die explizit offenen produktrelevanten Entscheidungen des Kickoffs nicht automatisch zu ACCEPTED. Keine Ownerannahme wird erfunden.

## Verifizierte Quellen und geltende Autorität

FP01 bis FP05 sind vollständig als Bytes verfügbar; alle fünf SHA-256 und Zeilenzahlen stimmen mit FP06 Kapitel 2 überein. FP01 ist nach FP02/FP06 fachlich angenommen. Sein unveränderter historischer Header bleibt PROPOSED; die Annahmeprovenienz wird getrennt geführt. FP02 bis FP05 bleiben versionsgebundene Vorschläge. Die G-Berichte ergänzen die Herkunft, ersetzen keine FP-Quelle.

## D01 bis D11

| ID | Konkreter Vorschlag | Aktueller Status |
|---|---|---|
| D01 | 0.25-m placement grid; terrain cell size remains read from the 0.125-m versioned HVP source. No terrain migration. | PROPOSED_OWNER_REVIEW_REQUIRED |
| D02 | Resources snapshots remain sole cargo authority; exact factory admissions, indivisible components and explicit rejection for nonrepresentable quantities. | PROPOSED_OWNER_REVIEW_REQUIRED |
| D03 | FP01 factory electrical priorities/reserves in a local allocator; existing ship solver semantics unchanged. | PROPOSED_OWNER_REVIEW_REQUIRED |
| D04 | New combined factory checkpoint and slot namespace using existing atomic repository; legacy HVP slots unchanged. | PROPOSED_OWNER_REVIEW_REQUIRED |
| D05 | 100-ms factory step bound to confirmed host/physics and universe ticks, without independent wall-clock progress. | PROPOSED_OWNER_REVIEW_REQUIRED |
| D06 | Powered belt accrues 1 kg/s, starts at zero, caps credit at 10 kg and persists it; nominal long-term 60 kg/min, not a strict sliding-window cap. | PROPOSED_OWNER_REVIEW_REQUIRED |
| D07 | Separate /factory.html entry within current browser package; main.ts unchanged. | PROPOSED_OWNER_REVIEW_REQUIRED |
| D08 | Atomic mining material participant in existing terrain commit. Outside W00-W11. | DEFERRED_OUT_OF_SCOPE |
| D09 | Replay-safe bounded receipt protocol. Outside W00-W11. | DEFERRED_OUT_OF_SCOPE |
| D10 | Existing global test and CI timeouts unchanged; segmented UI tests and separate full-duration evidence. | PROPOSED_OWNER_REVIEW_REQUIRED |
| D11 | Bounded fixed facility owners in the same native world, prepare/commit/publish/rollback/finalize and complete combined checkpoint; proposed 16-owner admission is not approved. | PROPOSED_OWNER_REVIEW_REQUIRED |

## Minimaler nächster Ownerentscheid: W01

Zur Freigabe steht ausschließlich der kleine W01-Katalog, ohne Produktintegration. Der vorgeschlagene Freeze bindet die unveränderten FP02-Bytes mit SHA-256 `5c4f068edba3d0c89e77b0d3a40734d4ee1a672c39f3885cbfef31430d942f39` und die W01-Paketkarte an die verifizierte Basis.

- D01: 0,25 m ist Placementraster; das vorhandene Terrainprofil bleibt bei 0,125 m. Kein Rasterwechsel der Welt. Acht Kalksteinzellen ergeben 37,5 kg bei der aktuellen Dichtequelle; andere FP-Dichten bleiben getrennte Referenzen.
- FP02 C01 bis C28: 28 endliche Positionen, insgesamt 2.984,4 kg und 12,45 m³, ohne SALVAGE-01. Keine Kiste, Chassis- oder Ressourcenverdoppelung.
- REC-01 bis REC-07, Material- und Komponenten-IDs, BOM, Maße, Ports und Frames werden als unveränderte Versionen übernommen. Cutter 208 kg, Former 341 kg. Kein Mapping von generischem `ore_iron_silicate` auf Stahl.
- Mengenfreeze-Vorschlag für den W01-Katalog: Massengüter in exakten 1-mg-Quanten, Volumen in ganzen mm³, serialisierte Komponenten nur als ganze Stücke. Nicht exakt repräsentierbare Werte und Überlauf werden abgewiesen. Keine Rundung auf Gratisgut. Der eigentliche Resources-Adapter bleibt W02/D02 vorbehalten.
- Schreibscope ausschließlich die fünf W01-Dateien in `write-ownership.json`. Kein HVP-, Physik-, Save-, Package- oder Runtimehook in W01.

**Freigabestatus aller fünf Punkte: PROPOSED / OWNER_REVIEW_REQUIRED.** Eine spätere Freigabe muss W01, D01 und diesen konkreten Quellen-/Mengenfreeze nennen. Abweichende Policy braucht eine neue dokumentierte Version; keine stillen Defaultzahlen.

## Paketgates und Zuständigkeiten

| Paket | Vorgesehene Rolle, kein behaupteter gestarteter Writer | Abhängigkeiten | Zusätzliche Eintrittsgates | Abschluss-/Abnahmegates | Status |
|---|---|---|---|---|---|
| W00 | Orchestrator | keine | W00-Dokumentenscope erteilt | Paketnachweise und unabhängiges Review | BLOCKED |
| W01 | Integrator A | W00 | D01, FP02_CATALOG_QUANTITY_FREEZE | Paketnachweise und unabhängiges Review | BLOCKED |
| W02 | Domain/Asset B | W01 | D02 | Paketnachweise und unabhängiges Review | BLOCKED |
| W03 | Integrator A | W01 | D03 | Paketnachweise und unabhängiges Review | BLOCKED |
| W04 | Integrator A | W02, W03 | D05 | Paketnachweise und unabhängiges Review | BLOCKED |
| W05 | Domain/Asset B | W01 | ASSET_SOURCE_AND_WRITE_SCOPE | SEPARATE_VISUAL_OWNER_ACCEPTANCE | BLOCKED |
| W06 | Integrator A | W01 | D05, D07, HVP_HOST_WRITE_LEASE | Paketnachweise und unabhängiges Review | BLOCKED |
| W07 | Integrator A | W02, W05, W06 | D01, D11, PHYSICS_FACILITY_WRITE_LEASE | Paketnachweise und unabhängiges Review | BLOCKED |
| W08 | Domain/Asset B | W02 | D06 | Paketnachweise und unabhängiges Review | BLOCKED |
| W09 | Integrator A | W04, W07, W08 | EXCLUSIVE_COMPOSITION_WINDOW | Paketnachweise und unabhängiges Review | BLOCKED |
| W10 | Integrator A | W09 | D04, D11, EXCLUSIVE_SAVE_PHYSICS_WINDOW | Paketnachweise und unabhängiges Review | BLOCKED |
| W11 | Testwriter after W10 | W10 | D10, PERFORMANCE_PROFILE_AND_TARGETS | OWNER_GAMEPLAY_VISUAL_REVIEW, SEPARATE_FUNCTIONAL_UI_SAVE_VISUAL_GAMEPLAY_PERFORMANCE_RECEIPT | BLOCKED |

D08 und D09 sind außerhalb des beauftragten Blocks; sie blockieren W01 nicht. Gemeinsame Dateien besitzen später genau einen Integrator. W09/W10 erhalten nacheinander exklusive Integrationsfenster. Maximal zwei aktive Implementierungswriter, derzeit null. Die disjunkten Parallelwellen sind ausdrücklich A:W03/B:W05, A:W06/B:W02 und A:W04/B:W08; sie starten erst nach den jeweiligen Gates und Vorgängerreceipts. W05 erzeugt seine Projektion zuerst; die visuelle Ownerabnahme erfolgt nach Captures über W06 und ist kein vorgezogener Eintrittsentscheid. W11 erzeugt zuerst den Abnahmelauf; Visual-/Gameplayentscheid und getrennte Functional/UI/Save/Visual/Gameplay/Performance-Werte werden danach erfasst. Ein reales Leistungsprofil muss vor dem Performancevergleich vorliegen. Kein Performanceziel wird geraten.

## Source-/Write-Locks und Beobachtungsgrenze

Remotezweige für Cut, Destruction, HUD, Bundle und Assettools existieren. Ihre Diffs enthalten überlappende historische Integrationsdateien; Existenz eines Branches beweist keinen aktiven Writer. Lokale Registry und Git-Locks zeigen keine belegten aktuellen Leases. Externe uncommittete Worktrees sind nicht sichtbar. Deshalb sind HVP-/Physics-/Save-Leases für W06/W07/W10 ausdrücklich **nicht erteilt**. Neue Factorypfade sind in den geprüften relevanten Branchdeltas unberührt. Bestehende fremde Dirty-Dateien bleiben unangetastet.

## Scopeauslegung und sichere Stopps

Der Kickoff beschränkt die W00-Repositorywrites auf genau vier Dokumente. W00-Rohlogs und Reviews werden daher außerhalb des Repositorys in einem separaten Runbeleg gesichert, nicht als zusätzliche Produkt- oder Evidencewrites eingeschleust. `tools/factory/verify-evidence.mjs` wird für die zukünftige W06-Karte als Repositoryroot-Ziel interpretiert; diese eng deklarierte Interpretation ist vor W06 zu bestätigen. Tatsächlich vorhandene Konfiguration: `apps/weltraum-browser/vite.config.ts`.

Keine neue Spec wird als bereits implementierte API geführt. Die globale Physics-, Voxel-, Save- und Rendererarchitektur bleibt unverändert. Keine Produktwrites, keine W12-W29-Arbeit und kein Main-Merge.
