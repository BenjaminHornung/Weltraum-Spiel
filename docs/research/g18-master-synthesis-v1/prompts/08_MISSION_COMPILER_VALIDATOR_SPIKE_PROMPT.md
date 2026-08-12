# Folgeprompt 08: Mission-Compiler- und Validator-Spike

## Zweck

Pruefe einen headless, deterministischen Mission-Compiler fuer getrennte Story-, Mission- und Dialogue-Graphen. P02 liefert UX- und Spike-Referenz, aber wegen `UNLICENSED` keinen kopierbaren Produktcode.

## Autoritative Eingaben

- G05 in der eingefrorenen Fassung
- akzeptierter Command-Kernel und Validator-Spike aus Folgeprompts 04 und 06
- `PROTOTYPE_ADOPTION_MATRIX.md`, Eintrag P02
- `X01_CONTRACT_CROSSWALK_V1.md`

## Entry Gate

Beginne nur, wenn der Owner die Graphtrennung, Conditions-/Effects-Typen, Text-ID-Regel und Capability-Allowlist akzeptiert hat. Fuer P02 muss entweder eine nachweisbare Nutzungserlaubnis vorliegen oder eine Clean-room-Neuimplementierung aus Spezifikation beschlossen sein.

## Fixierter Scope

- Headless TypeScript, kein Graph-UI.
- Je eine minimale StoryGraph-, MissionGraph- und DialogueGraph-Fixture.
- Reachability, Zyklus-/SCC-Regel, Cardinality, Referenzintegritaet und kanonischer Compiler.
- Ein simulierter Runner, der Effects nur als Gateway-Anfrage ausgibt.

## Auftrag

1. Definiere minimale getrennte Schemas mit stabilen IDs.
2. Kompiliere identische Inputs byteidentisch.
3. Erzeuge positive und negative Goldens fuer alle Validatorregeln.
4. Belege, dass ein Dialogue-Knoten keinen Economy-, Faction- oder World-State direkt mutiert.
5. Kennzeichne P02-Muster als `Adapt`, `Reference only` oder `Discard` auf Komponentenebene.

## Verbotener Scope

- Kein React Flow, Ink, Runtime-LLM, dynamischer Missionsgenerator, Localization-Backend oder Produktcontent.
- Kein Quellcodekopieren aus einem ungeklaert lizenzierten Prototyp.
- Keine direkte Effect-Ausfuehrung.

## Exit Gate

Erfolgreich nur, wenn Graphgrenzen im Schema erzwungen sind, Compiler und Validator deterministisch laufen, alle Effects nur autorisierte Gateway-Requests erzeugen und die Lizenz-/Clean-room-Entscheidung dokumentiert ist.

## Stop Gate

Stoppen, wenn Graphen fuer den Spike vermischt werden muessen, Klartext stabile Text-IDs ersetzt, ein Effect lokal mutiert oder P02-Code ohne geklaerte Lizenz uebernommen werden soll.

## Handoff

Nur nach G05-Review-`ACCEPT` `09_SETTLEMENT_AUTHORITY_CONTRACT_GOLDENS_PROMPT.md` starten.
