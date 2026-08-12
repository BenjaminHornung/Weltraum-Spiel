# Folgeprompt 06: Validation-, Issue- und Quick-Fix-Spike

## Zweck

Pruefe den unveraenderlichen Validator- und Issue-Vertrag aus G17. Ein Quick Fix muss eine normale, pruefbare Transaction bleiben.

## Autoritative Eingaben

- akzeptierter Command-Kernel aus Folgeprompt 04
- akzeptierte Content-Goldens aus Folgeprompt 05
- `EDITOR_COMMAND_CONTRACT_V1.md`
- G17 in der eingefrorenen Fassung

## Entry Gate

Beginne nur, wenn Receipt-Typen und Content-Digests stabil sind und genau ein synthetischer Dokumenttyp fuer den Spike festgelegt wurde.

## Fixierter Scope

- Headless Validator fuer genau drei Regeln: Pflichtfeld, Referenzintegritaet und ein domainneutraler Wertebereich.
- Deterministische Issue IDs, Severity, TargetRef, Evidence und optionaler Quick-Fix-Command.
- Ein synchroner und ein asynchron simulierter Validator mit Stale-Rejection.

## Auftrag

1. Implementiere Validatoren als reine Leser unveraenderlicher Snapshots.
2. Belege stabile Issue-Reihenfolge und IDs bei identischem Input.
3. Leite einen Quick Fix als normalen Preview-/Approval-/Commit-Pfad durch den Kernel.
4. Verwerfe das Ergebnis eines asynchronen Validators, wenn Revision oder Digest nicht mehr passt.
5. Teste, dass ein Quick Fix bei CAS-Konflikt nicht teilweise angewendet wird.

## Verbotener Scope

- Kein Issue-Browser-UI, keine Produktdomain, kein Netzwerk und keine Datenbank.
- Validatoren duerfen nicht reparieren, committen oder mutable globale Zustände besitzen.
- Keine Fehlerunterdrueckung fuer Demo-Zwecke.

## Exit Gate

Erfolgreich nur, wenn Reinheit, deterministische Issues, Stale-Rejection, Quick-Fix-Approval und atomare CAS-Ablehnung durch Tests belegt sind und ein Reviewer keine Mutation ausserhalb des Commit Coordinators findet.

## Stop Gate

Stoppen, sobald ein Validator selbst mutiert, ein Quick Fix einen Sonderkanal verwendet, Issue IDs zufaellig sind oder ein asynchrones Ergebnis ohne Basispruefung sichtbar wird.

## Handoff

Nur nach Review-`ACCEPT` `07_PLAYWRIGHT_E2E_EVIDENCE_SPIKE_PROMPT.md` starten.
