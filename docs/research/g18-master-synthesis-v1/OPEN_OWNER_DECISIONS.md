# WELTRAUM Open Owner Decisions V1

**Stand:** 2026-08-12  
**Dokumentstatus:** `REQUIRES_OWNER_DECISION`  
**Scope:** blockierende oder richtungsgebende Ownerentscheidungen aus G03A, G04, P01 bis P05 und dem Launch-Addendum

## 1. Entscheidungsprinzip

Eine Ownerentscheidung akzeptiert nur den explizit genannten Scope. Sie akzeptiert keine Prototype-UX als Produktfunktion, keine ungemessene Performance, keine Quelllizenz und keinen Zugriff auf WP04. Jede Codearbeit benoetigt danach weiterhin das genannte serielle Gate.

Der aktive Quellen-Freeze lautet:

- `G03A_owner_freeze_command_receipt_rfc_spike1_plan_2026-08-12.md`, SHA-256 `052b292977229abfec977ac4a2ac6341b3a8e1aabbca7bee5400ea5c4a79f5da`, Dateiidentitaet durch Launch-Addendum final bestaetigt, fachlicher Workflow weiterhin `REQUIRES_OWNER_DECISION`;
- `G04_settlement_city_builder_system_abschlussbericht_2026-08-12(1).md`, SHA-256 `cdb98f5404028b23f2c907fee3d4679bfb084a4dd05cee2eb72e72c1cd1efb54`, Dateiidentitaet durch Launch-Addendum final bestaetigt, Bericht `COMPLETED`, Produktvorschlaege weiterhin `PROPOSED` beziehungsweise `REQUIRES_OWNER_DECISION`.

Quellenfinalitaet und Produktannahme sind getrennte Entscheidungen. Keine aeltere Library-Fassung darf diese aktiven Eingaben ersetzen.

## 2. Priorisierte Entscheidungen

| ID | Prioritaet | Entscheidung | Empfohlener Default | Blockiert bis entschieden |
|---|---:|---|---|---|
| `OOD-001` | P0 | Soll `G03A-DR1` mit exaktem Dokument-SHA als Charter fuer den isolierten Spike 1 akzeptiert werden? | Ja, exakt im dort definierten Scope: unveroeffentlicht, no-React, `dockview-core@8.0.0`, Three `0.185.1` als Referenz, `SEP-D` gegen `OVR-D`, synthetische Authority, keine Produkt- oder WP04-Schreibvorgaenge. | G03A Spike 1 |
| `OOD-002` | P0 | Soll ein gemeinsamer renderneutraler Command-, Transaction-, Validation-, Approval- und Receipt-Kern die verbindliche Plattformgrenze fuer Developer Authoring und spaeteres Player Construction werden? | Ja. Eine Authority pro Domain, ein vertrauenswuerdiges Gateway, geschlossene Command-Unionen, CAS, Idempotenz, kanonische Digests, immutable Receipts und policybegrenzte Oberflaechen. | Produkt-RFC, X01, Editorplattform, Player Builder, AI-Write-UX |
| `OOD-003` | P0 | Wie werden Proposal-, Validation-, Approval- und Commit-Provenienz getrennt? | Separate Felder und Actoren fuer `proposedBy`, `validatedBy`, `approvedBy`, `committedBy`; Session und Capability stammen vom Host. AI darf nie Committer sein. | AI-Copilot, Audit, History und Approval UX |
| `OOD-004` | P0 | Wer koordiniert atomare Writes ueber World-, Settlement-, Mission-, Economy- oder andere Authorities? | Domainlokale Commands plus expliziter WorldTransaction Coordinator fuer echte Cross-Authority-Vorgaenge. Kein UI- und kein Settlement-Adapter darf fremde Authority direkt mutieren. | G04 Integration, Economy, Damage, Mission Effects, Savebarrieren |
| `OOD-005` | P0 | Welche Undo-Semantik gilt nach einem Commit? | Neue vorwaertslaufende, CAS-gepruefte History-Transaction aus einem digestgebundenen Inversionsplan. Kein Revision-Rewind und kein ungebundenes `restoreSnapshot`. | Gemeinsamer Kern, Editor History, AI-Undo |
| `OOD-006` | P0 | Darf eine Prototype-Implementierung oder ein Feldvertrag vor P06 und X01 uebernommen werden? | Nein. P06 vor Sourcecopy, X01 vor normativer Feld- oder Schemasemantik. Beide fehlen aktuell, blockieren aber nicht die G18-Synthese. | Prototype-Adoption, Lizenzfreigabe und Product RFC |
| `OOD-007` | P0 | Wie bleibt WP04 waehrend G03/G04/G18 isoliert? | Keine Inspektion, Aenderung oder Annahme zu uncommitteten WP04-Staenden. G03A und G04-Spikes in eigenen isolierten Researchpfaden. Tatsaechliche WP04-Identitaet erst beim autorisierten Review erfassen. | Jede Arbeit, die WP04 beruehren oder voraussetzen wuerde |
| `OOD-008` | P1 | Wann und wie wird die Editor-Topologie entschieden? | Nicht jetzt. Erst G03A Spike 1 mit identischer Authority, Bridge, Dockingkomponente und Kampagne fuer `SEP-D` und `OVR-D`; danach eigene Topologie-ADR. | Produkteditor-Shell und Deploymenttopologie |
| `OOD-009` | P1 | Bleiben Developer Authoring und Player Construction getrennte Oberflaechen? | Ja. Gemeinsamer Kern und gemeinsame Validatoren, aber getrennte Build-/UX-Surfaces, Allowlisten, Policies und Publishrechte. | Player Builder, Modding und Sicherheitsmodell |
| `OOD-010` | P1 | Welche AI-Autonomie ist fuer V1 zulaessig? | Read, Propose, Preview und Stage. Jede AI-Aenderung benoetigt menschliche Review und exaktes Approval. Kein Validate, Commit, Publish, Destructive oder Autocommit. | G11 Integration und P05-Adaption |
| `OOD-011` | P1 | Wird React Flow als Missionsgraph-Projektion weiter untersucht? | Ja, erst nach Freeze der G05-Vertraege und nur als isolierter Projektionsspike. React Flow ist nie Authority. Accessibility, 100/500/1000-Node-Scope und Lizenznotice sind eigene Gates. | P02-Adaption und Graph UI |
| `OOD-012` | P1 | Werden Story, Mission und Dialogue getrennte Graphvertraege? | Ja. Gemeinsame Conditions und Effects, aber getrennte Authoring- und Runtime-Dokumente. Dialogtexte ueber stabile Text-IDs, Conditions als geschlossene AST, Effekte ueber Gateway. | G05 Contract Gate und X01 |
| `OOD-013` | P1 | Welche Settlement-/World-/Voxel-Ownership gilt? | Settlement besitzt semantische Roads, Parcels, Rights, Buildings, Services und Construction. World-/Voxel-Authority besitzt Terrainzellen und physische Realisierung. Bindungen sind revisions- und digestgebunden. | G04 Gate 0 und Road-/Parcel-Spike |
| `OOD-014` | P1 | Soll der G04 Road-/Parcel-Spike nach Owner Freeze autorisiert werden? | Ja, aber erst nach `OOD-013`, Scopeentscheidungen und Lizenzgate. Isoliert, ohne Produkt- oder WP04-Write, mit Linie plus Kreisbogen, grade-aware Crossings, MultiPolygon/holes, Frontage, Lineage und `Valid | Invalid | Unknown`. | G04 Gate 1 bis Gate 4 |
| `OOD-015` | P1 | Welcher erste Settlement-Slice wird verbindlich? | 128 x 128 m Detailfenster, ein aktiver Bezirk, 12 bis 30 Parzellen, 12 bis 24 Gebaeude, 80 bis 250 Einwohneraequivalente und 16 bis 48 sichtbare mobile Repraesentanten. Erweiterung erst nach Browsermessung. | G04 Scope, G16 Generator, G06 NPC-LOD |
| `OOD-016` | P1 | Welche Rolle hat Zoning im Spiel? | Zoning als policy- und rechtegebundene Entwicklungsabsicht, nicht als sofortige automatische Gebaeudegeneration. Bau bleibt expliziter Auftrag mit Material, Arbeit, Zeit, Zugriff und Approval. | G04 Construction, Economy und Generator |
| `OOD-017` | P1 | Welches Zeitmodell gilt fuer Settlement, Pause, Catch-up und Offlinefortschritt? | Ein kanonischer `settlementTick`; grobe LODs duerfen Zwischenverlaeufe approximieren, aber Ledgerbarrieren nicht veraendern. Kein Realzeit-Offlinefortschritt in V1 ohne separate Entscheidung. | Settlement LOD, Economy, Saves, Hintergrundsimulation |
| `OOD-018` | P1 | Bleibt V1 Singleplayer? | Ja. Co-op und Shared World werden verschoben, weil Authority, Konfliktaufloesung, Identitaet, Approval und Saveprotokoll grundlegend erweitert werden muessten. | Netzwerk-, Collaboration- und CRDT-Scope |
| `OOD-019` | P1 | Welche Systemkartenwerte sind autoritativ? | P04 ist nur UX-Referenz. `CelestialSystemDocumentV1`, benannte Frames und die zustaendige Navigation liefern Position, Route und Evidence. Kartenprojektionen berechnen keine zweite Wahrheit. | G10 Contract Freeze und P04-Handoff |
| `OOD-020` | P1 | Darf `dockview-core@8.0.0` in G03A Spike 1 eingesetzt werden? | Ja, nach Annahme von `G03A-DR1`, exakter Lizenzaufnahme und Lockfile-Pin. Keine Produktadoption durch den Spike allein. | G03A Shell-Aufbau |
| `OOD-021` | P1 | Darf IndexedDB im G03A Spike die atomare lokale Persistenz bilden? | Ja, nur fuer synthetischen State, Receipts, History, Idempotenz und Outbox in einer DB-Transaktion. Keine allgemeine Saveentscheidung. | G03A Reload- und Crash-Gates |
| `OOD-022` | P1 | Welche Lizenz- und Provenienzregel gilt fuer P01 bis P05? | Archive als Research erhalten. Kein Codecopy, bis P06 Quelle, Autor, Lizenz, Drittkomponenten, Commitbezug und Aenderungen geklaert hat. | Jede Prototype-Quelladoption |
| `OOD-023` | P2 | Welche visuelle Evidence ist fuer Prototype-Adoption ausreichend? | Keine der aktuellen P01-bis-P05-Evidenzen ist Produktfreigabe. G17-konforme reproduzierbare Captures, Browsermatrix, Accessibility und Ownerreview sind erforderlich. | Visuelle Abnahme und UI-Produktentscheidung |

## 3. Gebuendelte G04-Ownerfragen

Die folgenden Fragen koennen als ein Scope- und Authority-Record entschieden werden. Sie bleiben offen, auch wenn die Architektur im G04-Bericht bereits vorgeschlagen ist.

| Bereich | Zu entscheiden | Empfohlene Richtung |
|---|---|---|
| Slice-Fantasie | Was baut und betreibt der Spieler im ersten Settlement-Slice? | Kleine physische Service- und Logistikbasis, keine vollstaendige Grossstadt. |
| City-Groesse | Aktiver Bezirk und Gesamtpopulation | Default aus `OOD-015`; aggregierter zweiter Bezirk erst nach Gate 7. |
| Citizenidentitaet | Individuen versus Population Units | Stabile Personen fuer relevante NPCs; disjunkte Population Units und LOD fuer den Rest. |
| Economy-Tiefe | Welche Produktion und Logistik im City Slice? | Begrenzte Material-, Energie-, Lager-, Job- und Transportledger mit exakten Reservations. |
| Recht und Rechte | Wer darf bauen, betreiben, abbrechen oder enteignen? | Capability, Rolle, Lizenz, Claim und Jurisdiction getrennt modellieren. |
| Service-Coverage | Luftlinie, Roadroute, Kapazitaet oder Kombination | Keine radiale Produktwahrheit. Graphbasierte Erreichbarkeit plus Kapazitaet, Modell explizit versioniert. |
| Terrainrealisation | Cut, Fill, Bruecke, Tunnel und Hydrologie | Als versionierter `TerrainRealizationPlan`; Voxelmutation nur durch World-/Voxel-Authority. |
| Savehistorie | Snapshot, Event-Tail und Migration | Gemeinsam gebarriertes Savepaket mit Schema-, Algorithmus-, Katalog-, Epoch-, Revision- und Digestbindungen. |
| Zielgeraete | Mindestbrowser und Hardwareklasse | Vor Budgets festlegen, danach G17-/Benchmarkkampagne. Keine Prototype-FPS verwenden. |
| Generative AI | Darf AI Districts erzeugen? | Nur Draft plus Constraintreport, Human Review, Command-Diff und authored Fallback. |

## 4. Gemeinsamer Kern: vorgeschlagener Ownerrecord

Der folgende Record kann kopiert und nach Ownerpruefung ausgefuellt werden:

```text
OOD-002 ACCEPTED
date: <ISO-DATUM>
owner: <OWNER-ID>

Developer Authoring und Player Construction verwenden denselben renderneutralen
Command-, Transaction-, Validation-, Approval- und Receipt-Kern. Jede Domain
besitzt genau eine kanonische Authority. UI, Renderer, AI, Graphcanvas und
importierte Assets koennen nur Drafts oder geschlossene Commands erzeugen.

Jeder Commit ist an Actor, Policy, Authority-Epoch, erwartete Revision,
Transactiondigest, Validationevidence und gegebenenfalls exaktes Approval
gebunden. Writes sind atomar, idempotent und erzeugen immutable Receipts.
Undo und Redo sind neue vorwaertslaufende Transactions. Proposal, Validation,
Approval und Commit besitzen getrennte Provenienzrollen. AI hat in V1 keine
Commit-, Publish- oder Destructive-Capability.

Diese Entscheidung akzeptiert keine konkrete UI-Bibliothek, Editor-Topologie,
Engine, Persistenzimplementierung, Prototype-Source oder Produktintegration.
Die konkreten Felder werden erst nach X01 in einem versionierten RFC gefroren.
```

## 5. Serielle Entscheidungsreihenfolge

1. `OOD-002` bis `OOD-007` entscheiden.
2. `G03A-DR1` mit exaktem Dokument-SHA akzeptieren oder ablehnen.
3. P06 Intake Audit und X01 Contract Crosswalk terminieren.
4. G03A Spike 1 isoliert ausfuehren.
5. Topologie-ADR aus dem Spikeergebnis treffen.
6. G04 Scope-, Authority-, Zeit-, Save- und Lizenzfragen entscheiden.
7. Isolierten G04 Road-/Parcel-Spike autorisieren.
8. G17-konforme Evidence fuer jeden weiterverfolgten UI-Pfad erzeugen.
9. Produktintegration erst nach WP12 und separater Integrationsentscheidung pruefen.

## 6. Stopbedingungen

Die Arbeit stoppt und geht an den Owner zurueck, wenn:

- `G03A-DR1` ohne exakten Dokument-SHA gestartet werden soll;
- ein Prototype-Feld ohne X01 zum Produktvertrag werden soll;
- Prototypcode ohne P06 und Lizenzklaerung kopiert werden soll;
- UI, AI oder Renderer direkt Authority mutieren sollen;
- Proposal-Origin und Committer nicht getrennt werden koennen;
- ein Cross-Authority-Write keinen benannten Coordinator besitzt;
- WP04 oder ein uncommitteter WP04-Zwischenstand beruehrt werden muesste;
- eine Editor-Topologie vor dem G03A-Spike festgelegt werden soll;
- P03-Mockgeometrie, P04-Mockphysik oder P05-Mockreceipts als Produktfunktion gelten sollen;
- Produktintegration vor WP12 behauptet oder begonnen werden soll;
- Performance- oder QA-Freigabe ohne gefrorene Identitaet und reproduzierbare Evidence verlangt wird.
