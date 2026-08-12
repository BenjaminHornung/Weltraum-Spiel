# Folgeprompt 04: Renderneutraler Command-Kernel-Spike

## Zweck

Isoliere und pruefe den gemeinsamen Command-/Transaction-/Receipt-Kern als headless TypeScript-Modul. Dieser Spike prueft Semantik, nicht UI, Datenbank oder Produktintegration.

## Autoritative Eingaben

- akzeptierte ADR aus Folgeprompt 03
- `X01_CONTRACT_CROSSWALK_V1.md`
- `EDITOR_COMMAND_CONTRACT_V1.md`
- G02, G03A, G11 und G17 in den eingefrorenen Fassungen

## Entry Gate

Beginne nur, wenn die Topologie-ADR akzeptiert ist, der Crosswalk keine ungeklärte doppelte Schreib-Authority enthaelt und ein isolierter Spike-Branch oder ein isoliertes Spike-Repository freigegeben ist.

## Fixierter Scope

- Headless TypeScript ohne Renderer und Framework.
- In-Memory-Authority mit synthetischem Dokument.
- Validate, Dry Run, Preview, Prepare, CAS-Commit, No-op, Reject, Unknown-Reconciliation und exaktes Undo.
- Kanonische Serialisierung und SHA-256 fuer Testfixtures.

## Auftrag

1. Implementiere minimale, versionierte Contract-Typen aus `EDITOR_COMMAND_CONTRACT_V1.md`.
2. Implementiere genau einen Command-Typ und genau eine atomare Mehrschritt-Transaction.
3. Belege idempotente Wiederholung ueber `actionId`, `commandId` und `transactionId`.
4. Belege monotone Revision und Digest-CAS.
5. Trenne Commit Receipt, Projection Receipt, Validation Report, Approval Record und E2E Receipt auf Typebene.
6. Teste exaktes Inverse einschliesslich Ablehnung bei veralteter Basis.

## Verbotener Scope

- Keine UI, Datenbank, Netzwerk-API, AI, Modding, Collaboration, CRDT oder echte Domain.
- Keine permissive Client-Actor- oder Capability-Uebernahme.
- Keine Produkt- oder Voxel-Lab-Integration.

## Exit Gate

Erfolgreich nur, wenn deterministische Tests fuer Commit, No-op, Reject, unbekannten Ausgang, Wiederholung, CAS-Konflikt und Undo gruen sind und ein Reviewer jeden mutierenden Pfad auf genau einen Commit Coordinator zurueckfuehren kann.

## Stop Gate

Stoppen, wenn Canonicalization oder Hash-Semantik nicht eindeutig ist, Undo eine Revision zuruecksetzt, unbekannte Commit-Ausgaenge blind wiederholt werden oder der Scope eine zweite Domain erfordert. Keine neue Funktion nach bestandenem Exit Gate beginnen.

## Handoff

Nur mit Review-`ACCEPT` `05_CONTENT_PACKAGE_LOCK_GOLDENS_PROMPT.md` starten.
