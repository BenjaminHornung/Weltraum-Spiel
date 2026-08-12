# Folgeprompt 01: Owner- und Quellen-Freeze

## Zweck

Erzeuge einen belastbaren, rein dokumentarischen Owner-Entscheidungsbeleg fuer den Start der spaeteren Spikes. Dieser Prompt autorisiert weder Code noch Integration.

## Autoritative Eingaben

- `G18_MASTER_SYNTHESIS_REPORT_V1.md`
- `OPEN_OWNER_DECISIONS.md`
- `TECHNICAL_READINESS_CROSSWALK.md`
- `G03A_owner_freeze_command_receipt_rfc_spike1_plan_2026-08-12.md`, SHA-256 `052b292977229abfec977ac4a2ac6341b3a8e1aabbca7bee5400ea5c4a79f5da`
- `G04_settlement_city_builder_system_abschlussbericht_2026-08-12(1).md`, SHA-256 `cdb98f5404028b23f2c907fee3d4679bfb084a4dd05cee2eb72e72c1cd1efb54`

## Entry Gate

Beginne nur, wenn alle oben genannten Dateien mit exakt diesen Identitaeten vorliegen und G18 den Status `REQUIRES_OWNER_DECISION` traegt. Eine aeltere Library-Version darf keine aktive Datei ersetzen.

## Auftrag

1. Pruefe die Quellidentitaeten und dokumentiere den Pruefzeitpunkt.
2. Lege jede in `OPEN_OWNER_DECISIONS.md` mit Prioritaet `P0` oder `P1` markierte Frage dem Owner einzeln vor.
3. Erfasse pro Frage genau eine Antwort: `ACCEPT`, `REVISE` oder `DEFER`.
4. Trenne die vom Launch-Addendum bestaetigte Quellenfinalitaet von den weiterhin offenen fachlichen Ownerentscheidungen in G03A und G04.
5. Erzeuge `G18_OWNER_DECISION_RECEIPT.md` mit Antwort, Begruendung, Datum und den Hashes der geprueften Eingaben.

## Erlaubter Scope

- Dateien lesen und Hashes berechnen.
- Genau einen Markdown-Entscheidungsbeleg in einem neutralen Dokumentarbeitsbereich erstellen.

## Verbotener Scope

- Kein Produktrepo und kein Voxel-Lab veraendern.
- Kein Code, Build, Test, Benchmark, Merge oder `--ff-only` ausfuehren.
- WP04 weder akzeptieren noch als integriert darstellen.
- Keine stillschweigende Standardantwort fuer den Owner setzen.

## Exit Gate

Erfolgreich nur, wenn:

- jede `P0`- und `P1`-Frage eine explizite Ownerantwort besitzt;
- der Beleg alle Eingabe-Hashes enthaelt;
- offene oder vertagte Punkte als Blocker dem konkreten Folgeprompt zugeordnet sind;
- der gemeinsame renderneutrale Command-/Transaction-/Receipt-Kern explizit `ACCEPT` oder `REVISE` erhalten hat.

## Stop Gate

Sofort stoppen und `SOURCE_IDENTITY_MISMATCH` melden, wenn Dateiname oder SHA-256 von G03A oder G04 abweicht. Bei `REVISE` fuer den gemeinsamen Kern ebenfalls stoppen; Prompt 02 darf dann nicht starten.

## Handoff

Nur bei bestandenem Exit Gate `02_CONTRACT_CROSSWALK_PROMPT.md` starten.
