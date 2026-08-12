# Folgeprompt 03: G03A Editor-Topologie-Spike 1

## Zweck

Fuehre den ersten und bewusst kleinen Write-Spike aus. Vergleiche eine separate Developer-App mit einem Developer-Overlay gegen denselben minimalen renderneutralen Kern. Entscheide nur die Topologie, nicht die Produktintegration.

## Autoritative Eingaben

- `G18_OWNER_DECISION_RECEIPT.md`
- `X01_CONTRACT_CROSSWALK_V1.md`
- `G03A_owner_freeze_command_receipt_rfc_spike1_plan_2026-08-12.md`, SHA-256 `052b292977229abfec977ac4a2ac6341b3a8e1aabbca7bee5400ea5c4a79f5da`
- `AUTHORING_PLATFORM_ARCHITECTURE_V1.md`
- `EDITOR_COMMAND_CONTRACT_V1.md`

## Entry Gate

Beginne nur, wenn:

- der Owner G03A-DR1 und den isolierten Spike-Ort explizit akzeptiert hat;
- Folgeprompt 02 mit Reviewerstatus `ACCEPT` abgeschlossen ist;
- ein neues, leeres Spike-Verzeichnis ausserhalb des Produktrepos und ausserhalb des Voxel-Labs bereitsteht;
- Lizenz und Loesch-/Archivierungsregel des Spike-Verzeichnisses geklaert sind.

## Fixierter Scope

- TypeScript.
- `dockview-core@8.0.0` ohne React.
- `three@0.185.1` fuer eine minimale Renderprojektion.
- Zwei duenne Shells: `SEP-D` als separate Developer-App und `OVR-D` als Developer-Overlay.
- Ein gemeinsamer Fake-Domain-Kern mit Preview, Validate, CAS-Commit, Receipt und exaktem Undo.
- Nur lokale, synthetische Fixtures ohne Produktdaten.

## Auftrag

1. Implementiere beide Shells gegen exakt dieselbe Kern-API.
2. Binde Actor und Policy in einem lokalen vertrauenswuerdigen Gateway-Adapter, nicht aus Command-Payloads.
3. Belege Preview-Isolation, monotone Revision, CAS-Ablehnung, idempotente Wiederholung und getrennte Projection Receipts.
4. Erfasse fuer beide Topologien Startaufwand, Fehlerisolation, Kontextwechsel, Sicherheitsgrenze und Packaging-Risiko.
5. Erzeuge reproduzierbare Tests und einen kurzen Evidence-Index.
6. Verfasse eine ADR mit `SEP-D`, `OVR-D` oder `INSUFFICIENT_EVIDENCE` als Ergebnis.

## Verbotener Scope

- Kein React, Mission Graph, AI/MCP, Player Builder, CRDT, Worker-Pool, City-, NPC-, Economy- oder Voxel-Code.
- Keine Verbindung zum Produktrepo, zu realen Saves oder zum Voxel-Lab.
- Kein Publishing und kein Merge.
- Keine Produktfunktionsbehauptung aus der Spike-UX ableiten.

## Exit Gate

Erfolgreich nur, wenn:

- beide Shells dieselben Kern-Contract-Tests bestehen;
- kein mutierender Pfad Gateway und Commit Coordinator umgeht;
- alle Abhaengigkeiten und Versionen im Evidence-Index stehen;
- die ADR Messkriterien, Ergebnis, Restunsicherheit und Ownerentscheidung ausweist;
- S1-10 aus G03A vollstaendig dokumentiert ist.

## Stop Gate

Sofort stoppen, wenn der Arbeitsort innerhalb von Produktrepo oder Voxel-Lab liegt, eine geforderte Version nicht pinbar ist, eine Shell eigene Domain-Logik benoetigt oder nur eine Topologie testbar ist. Nach dem Exit Gate ebenfalls stoppen. Keine Integration beginnen.

## Handoff

Nur nach Owner-`ACCEPT` der ADR `04_RENDERNEUTRAL_COMMAND_KERNEL_SPIKE_PROMPT.md` starten.
