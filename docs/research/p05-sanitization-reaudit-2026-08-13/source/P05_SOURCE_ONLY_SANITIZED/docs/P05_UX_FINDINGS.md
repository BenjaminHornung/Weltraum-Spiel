# P05 Findings: AI-Copilot-Transaction-UX-Prototyp

**Datum:** 2026-08-12  
**Status:** PROTOTYPE FINDINGS / PROPOSED  
**Basis:** P05-Arbeitsauftrag, Projektgedächtnis, Projekt-Addendum sowie ausgewählte PROPOSED-Vertragsmuster aus Integrationsaudit, BR01 und BR02

## Ergebnis in einem Satz

Ein Copilot-Write wird verständlich und kontrollierbar, wenn Vorschlag, Validierung, Freigabe, Commit und Undo als getrennte, hash-gebundene Transaktionsartefakte sichtbar bleiben und nur der Owner die letzten drei Berechtigungsstufen öffnen kann.

## Konkrete Findings

### 1. Ein linearer Neun-Schritte-Ablauf ist für den Erstkontakt tragfähig

Die Schrittleiste macht sichtbar, dass ein Prompt nicht direkt zu einem Write führt. Besonders wichtig ist die eigenständige Dry-run-Stufe vor dem Validator: Preview und Korrektheit sind dadurch nicht dasselbe.

**Inference:** Für häufige Nutzung sollte der Ablauf später abgeschlossene, unveränderte Schritte einklappen können. Im Lernprototyp ist die explizite Trennung wertvoller als maximale Geschwindigkeit.

### 2. Permission Levels müssen an Aktionen statt an abstrakte Rollen gekoppelt sein

`READ`, `PROPOSE`, `VALIDATE`, `COMMIT` und `UNDO` sind dauerhaft sichtbar. Dadurch wird sofort erkennbar, dass Copilot und Validator die Authority nicht verändern dürfen.

**Offen:** Ein Produktgate muss zusätzlich `APPROVE` als eigene Capability modellieren und alle Rechte serverseitig oder in einer vertrauenswürdigen Authority prüfen. Die UI allein ist keine Sicherheitsgrenze.

### 3. Owner Approval braucht einen exakt sichtbaren Bindungsumfang

Die Freigabe zeigt Base-Version, Plan-Hash, Diff-Hash und Validatorstatus. Ein generisches „freigegeben“ wäre zu schwach, weil ein später geänderter Candidate sonst fälschlich dasselbe Approval verwenden könnte.

**Folgecontract:** Approval sollte mindestens `{transactionId, baseRevision, proposalRevision, planDigest, diffDigest}` binden und bei jeder nachgelagerten Änderung ungültig werden.

### 4. Autofix darf nicht wie eine automatische Mutation wirken

Der vorgeschlagene Fix besitzt eine eigene Stufe und einen eigenen „anwenden“-Schritt. Selbst danach entsteht nur eine neue Dry-run-Revision. Das hält die Grenze zwischen `PROPOSE` und `COMMIT` sichtbar.

**Offen:** Ein Folgespike sollte einen Fix prüfen, der die Nutzerabsicht sichtbar verändert. Dafür braucht die Oberfläche eine ausdrückliche Intent-Drift-Warnung oder ein zweites Owner-Acknowledgement.

### 5. Provenienz ist als Live-Rail nützlicher als als nachträgliches Auditfenster

Feste Fixture-Zeitpunkte, Actor, Aktion, Digest-Kürzel und Revision erscheinen während des Ablaufs. Der Owner kann damit beim Approval nachvollziehen, wie der Diff entstanden ist.

**Grenze:** Die angezeigten Hashes sind feste Mock-Werte. Ein echter Contract benötigt kanonische Serialisierung, vollständige SHA-256-Digests, versionierte Schemas und eine append-only Ablage.

### 6. Undo sollte Commit nicht aus der Historie entfernen

Nach Undo bleibt der ursprüngliche Commit im Log, ergänzt um ein kompensierendes Ereignis. Der Round-trip wird über den wiederhergestellten Basis-Hash erklärt.

**Folgecontract:** Undo muss gegen die aktuelle Authority revision-sicher geprüft werden. Nach zwischenzeitlichen Änderungen darf es kein stilles Restore oder Rebase geben.

## Was dieser Prototyp belegt

- Der komplette P05-Ablauf lässt sich in einer responsiven Einzelansicht darstellen.
- Blocking Issues können Approval und Commit verständlich sperren.
- Ein explizites Owner-Acknowledgement trennt Rollenbesitz von konkreter Freigabe.
- Commit und Undo können als lokale, reversible Mock-Operationen mit append-only Provenienz vermittelt werden.

## Was er nicht belegt

- Keine Sicherheit oder Authentizität der Mock-Rollen
- Keine echte KI-, Tool-, Validator- oder Dateiausführung
- Keine Persistenz, Parallelitätskontrolle oder Stale-Result-Rejection
- Keine Eignung der Contract-Struktur für Produktintegration
- Keine Performanceeigenschaft
- Keine Akzeptanz der zugrunde liegenden Research-Empfehlungen

## Empfohlene kleine Folgegates

1. **Contract-Gate:** Geschlossenes JSON-Schema für Transaction Binding, Approval, Commit Receipt und Undo Receipt, inklusive kanonischer Digest-Berechnung.
2. **Stale-Gate:** Simulierter konkurrierender Authority-Write zwischen Approval und Commit; erwartetes Ergebnis ist fail-closed ohne Auto-Rebase.
3. **Intent-Gate:** Autofix verändert einen gewünschten Wert; UX muss Drift benennen und eine erneute Owner-Entscheidung erzwingen.
4. **Permission-Gate:** Viewer-, Author- und Owner-Rollen mit protokollierten Denied-Attempts, weiterhin ausschließlich in einer isolierten Fixture.
5. **Accessibility-Gate:** Automatisierter Scan plus manueller Tastatur-, Zoom- und Screenreader-Check.

Keine dieser Empfehlungen autorisiert eine Integration in Voxel-Lab oder Weltraum-Spiel.
