# Folgeprompt 02: X01 Contract Crosswalk

## Zweck

Erzeuge die fehlende, renderneutrale Zuordnung zwischen Domain-Authorities, Commands, Transactions, Receipts, Projektionen und Persistenzwurzeln. Dies ist eine Spezifikationsarbeit ohne Produktcode.

## Autoritative Eingaben

- `G18_OWNER_DECISION_RECEIPT.md`
- `AUTHORING_PLATFORM_ARCHITECTURE_V1.md`
- `EDITOR_COMMAND_CONTRACT_V1.md`
- `FEATURE_DEPENDENCY_GRAPH.md`
- G02, G03A, G04, G05, G08, G10, G11, G13, G17 in den in G18 eingefrorenen Fassungen

## Entry Gate

Beginne nur, wenn Folgeprompt 01 bestanden ist und der gemeinsame Command-/Transaction-/Receipt-Kern vom Owner akzeptiert wurde. Alle offenen Abweichungen muessen im Decision Receipt stehen.

## Auftrag

1. Erzeuge `X01_CONTRACT_CROSSWALK_V1.md`.
2. Ordne fuer jede Domain genau eine schreibende Authority und alle nur lesenden Projektionen zu.
3. Ordne Command-Familie, Validator, Transaction-Grenze, Commit Receipt, Projection Receipt und persistente Root zu.
4. Kennzeichne noch nicht eingefrorene Namen als `PROPOSED`, nie als implementiert.
5. Weise Economy-Schreibrechte ausschliesslich G08, Settlement-Schreibrechte G04 und Story-/Mission-Schreibrechte G05 zu.
6. Dokumentiere die G15-zu-G08-Grenze: bestaetigter physischer Extraction Receipt erzeugt genau ein idempotentes Economy-Ereignis.
7. Dokumentiere, dass Actor und Capability am vertrauenswuerdigen Gateway gebunden werden.

## Erlaubter Scope

- Quellen lesen, Widersprueche markieren und ein Markdown-Crosswalk erstellen.
- Neue Begriffe nur als Vorschlag mit Herkunft und Ownerstatus einfuehren.

## Verbotener Scope

- Keine Interfaces implementieren.
- Keine Prototype-Typen als Produktvertrag uebernehmen.
- Keine WP04-Annahmen als integrierte technische Wahrheit verwenden.
- Keine neue Domain-Authority erfinden, um einen Konflikt zu umgehen.

## Exit Gate

Erfolgreich nur, wenn:

- jede mutierende Operation genau einer Authority zugeordnet ist;
- Commit-, Projection-, Validation-, Approval- und E2E-Receipts getrennt sind;
- keine zirkulaere Schreibabhaengigkeit besteht;
- alle Namens- oder Ownership-Konflikte einen Owner oder einen konkreten Spike besitzen;
- der Crosswalk von einem unabhaengigen Reviewer mit `ACCEPT` bewertet wurde.

## Stop Gate

Stoppen, wenn zwei Domains dieselbe persistente Root unabhaengig mutieren sollen, eine Client-Actor-Angabe vertrauenswuerdig behandelt wird oder eine Authority-Zuordnung nur durch Vermischung von G18 und Voxel-Lab-C08 moeglich waere.

## Handoff

Nur nach `ACCEPT` den ersten Write-Spike `03_G03A_EDITOR_TOPOLOGY_SPIKE_PROMPT.md` starten.
