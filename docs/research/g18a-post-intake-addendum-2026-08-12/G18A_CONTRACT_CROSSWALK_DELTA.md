# G18A Contract Crosswalk Delta

**Status:** `REQUIRES_OWNER_DECISION`  
**X01-Basis:** `BenjaminHornung/Weltraum-Spiel@e7f2aad3ede7f307cf80ddd5a118e8a19ad5cd30`  
**Einordnung:** `Research Proposal`, nicht akzeptierter oder implementierter Shared Contract

## 1. Delta zu G18

G18 musste einen gemeinsamen renderneutralen Command-, Transaction- und Receipt-Kern noch als fehlend behandeln. X01 liefert nun ein präzises vorgeschlagenes Vokabular, eine Ownership Matrix und ein Shadow Contract Risk Register. Diese Lieferung supersediert den Erstellungsauftrag für X01, aber nicht den Ownerentscheid über X01.

X01 ist ausdrücklich nicht `READY_FOR_G18_INPUT`, solange mindestens die Varianten G06, G15 und G16 sowie die damit verbundenen Entscheidungen offen sind.

## 2. Nicht auflösbare Varianten

| Konflikt | Offene Varianten | G18A-Regel |
|---|---|---|
| G06 | G06-A gegen G06-B | keine Auswahl, kein synthetischer Hybrid, bis `X01-D-01` entschieden ist |
| G15 | G15-A gegen G15-B | keine Auswahl, kein stilles Owner-Mapping, bis `X01-D-02` entschieden ist |
| G16 | G16-A gegen G16-B | keine Auswahl, keine globale Spatial-/Event-Annahme, bis `X01-D-03` entschieden ist |

Jeder Folgeprompt, der eine dieser Varianten als bereits eingefroren behandelt, benötigt eine Korrektur oder bleibt owner-blocked.

## 3. Vorgeschlagenes gemeinsames Vokabular

| X01-Term | Vorgeschlagene Bedeutung | Grenze |
|---|---|---|
| `StableId<K>` | typisierte, langlebige Identität | keine positions- oder UI-abhängige Neuvergabe |
| `SchemaRef` | Schema-ID plus Version | Schemaänderung bleibt explizit |
| `AuthorityEpochRef` | Epoch der fachlichen Authority | nicht mit Render-, UI- oder Zeit-Epoch vermischen |
| `Revision` | fachlicher Revisionsbezug | Scope und Owner müssen erkennbar sein |
| `ContentDigest` plus `DigestProfileId` | inhaltsbezogener Hash nach benanntem Profil | keine Hashgleichheit ohne identisches Digestprofil behaupten |
| `SourceBinding` / `SourceBindingSet` | Quellen- und Provenienzbindung | keine bloße URL ohne Commit/Version als Contract |
| `CommandId` | Identität eines angeforderten Commands | nicht mit einer Ausführung oder Domänenoperation gleichsetzen |
| `ExecutionOperationId` / `DomainOperationId` | Ausführungs- beziehungsweise Fachoperation | beide Rollen getrennt halten |
| `ChangeTransactionId` | Mutationstransaktion | nicht mit Ledger-/Economy-Transaktion vermischen |
| `LedgerTransactionId` | ökonomische oder buchhalterische Transaktion | getrennte Domain-Semantik |
| `PreviewRevision` | Revision einer nichtkanonischen Vorschau | kein Commitbeweis |
| `PreviewReceipt` | Beleg über Vorschauerzeugung | kein `CommitReceipt` |
| `ApprovalGrant` | explizite Freigabebindung | getrennt von Decision, Receipt und Ticket |
| `ValidationIssue` | strukturierter, stabil identifizierbarer Befund | Validator schreibt nicht selbst |
| `PreparedChangeSet` | unveränderlicher vorbereiteter Kandidat | Parameteränderung verlangt neues Prepare |
| `CommitReceipt` | Beleg für Commit oder No-op im erlaubten Contract | umgebendes `CommitOutcome` muss Fail/Conflict abbilden, kein Receipt für Fehler |
| `EventEnvelope` | Ereignis mit Schema, Authority und Provenienz | keine stillen globalen Eventannahmen |
| `PackageId`, `EntryId`, `ContentLock`, `AuthorityLock` | Paket- und Lockvokabular | Contentlock und Authoritylock nicht vermischen |
| `CapabilityRef`, `CapabilityDecision`, `CapabilityStatus`, `CapabilityAvailability` | Capability-Identität, Entscheidung, Zustand und Verfügbarkeit | keine boolean-Kurzschlüsse über unterschiedliche Bedeutungen |
| `PrincipalRef`, `ActorRef`, `SourceRef` | Sicherheitsprinzipal, handelnder Akteur und Quelle | Rollen nicht austauschbar behandeln |
| `ReadSet`, `WriteSet` | explizite Lese- und Schreibmengen | nötig für Conflict, Approval und Audit |
| `ResourceReservation`, `AuthoredSpatialReservation`, `ScopeLease` | Ressourcen-, authored räumliche und temporäre Scope-Bindung | drei getrennte Vertragsarten |
| `KnowledgeState`, `CoverageStatus`, `MissingCoverage` | Wissen, Abdeckung und fehlende Abdeckung | `Unknown` oder Missing niemals zu Air oder Empty kollabieren |
| `SimulationTimeRef`, `SystemTimeRef` | Simulations- und Systemzeit | zusätzlich von anderen Epochs trennen |

## 4. G18-zu-X01-Crosswalk

| Historischer G18-Begriff oder Muster | X01-konforme vorgeschlagene Fassung | Delta-Risiko |
|---|---|---|
| generisches `actionId` | `CommandId`, gegebenenfalls zusätzlich `ExecutionOperationId` und `DomainOperationId` | eine ID darf nicht drei Lebenszyklen tragen |
| generisches `TransactionId` | `ChangeTransactionId` oder `LedgerTransactionId` | Mutation und Economy strikt trennen |
| `PreparedTransaction` | `PreparedChangeSet` | Kandidat ist unveränderlich und basisgebunden |
| `ApprovalBinding` | `ApprovalGrant` plus separate Decision-/Receipt-Referenz | Freigabe, Entscheidung und Beleg nicht zusammenziehen |
| Receipt für jeden Ausgang | `CommitOutcome` mit `CommitReceipt` nur bei Commit/No-op | Fehler oder Conflict dürfen keinen Commit vortäuschen |
| beliebiger Preview-State | `PreviewRevision` plus `PreviewReceipt` | Preview bleibt nichtkanonisch |
| generischer Eventtyp | `EventEnvelope` mit Domainowner und Source Binding | verhindert globalen Shadow Event Contract |
| Reservation | eine der drei Arten: Resource, Authored Spatial, Scope Lease | verhindert falsche Kollisions- und Locksemantik |
| Missing oder nicht geladen | `CoverageStatus` und `MissingCoverage` | niemals automatisch Air/Empty |
| User/Actor/Source | `PrincipalRef`, `ActorRef`, `SourceRef` | Security-, Audit- und Provenienzrollen bleiben getrennt |

## 5. Vorgeschlagene Paketgrenzen

X01 schlägt vor, behauptet aber noch keine existierenden Pakete:

1. `@weltraum/core-contracts`
2. `@weltraum/command-contracts`
3. `@weltraum/content-contracts`
4. `@weltraum/validation-contracts`
5. domänenspezifische Pakete
6. Presentation Adapter

Vorgeschlagene Importrichtung:

`core -> command/content/validation -> domain -> presentation`

Zusätzliche Grenze: command, content und validation importieren nicht direkt wechselseitig. Gemeinsame Basistypen gehören in core. Presentation darf Domain lesen, aber keine zweite Authority etablieren.

## 6. Shadow-Contract-Risiken

| Risiko | G18A-Behandlung |
|---|---|
| dieselbe ID für Command, Execution und Domain Operation | drei Rollen explizit modellieren |
| Receipt auch bei Failure/Conflict | `CommitOutcome` als Sum Type, Receipt nur bei tatsächlichem Commit/No-op |
| Preview als kanonischer Zustand | PreviewRevision und Source Binding separat halten |
| ein globaler Eventtyp für alle Domains | Domainowner, Schema und Authority in EventEnvelope binden |
| ein Reservationstyp für Ressourcen, Raum und Locks | drei Vertragsfamilien |
| `missing = empty/air` | Coverage und Knowledge getrennt modellieren |
| UI-Library oder Prototype-Graph als Domainmodell | Presentation Adapter ohne Schreibautorität |
| X01-Paketnamen als bereits implementiert | bis Owner-Freeze immer `PROPOSED` labeln |

## 7. Akzeptanzvoraussetzungen

X01 kann erst verbindlicher G18-Input werden, wenn:

- `X01-D-01` bis `X01-D-03` die G06/G15/G16-Varianten explizit schließen;
- die übrigen X01-Entscheidungen `D-04` bis `D-17` akzeptiert oder mit benanntem Owner und zeitlich begrenztem Adapter überbrückt sind;
- Package Ownership und Import Rules einem benannten Owner zugeordnet sind;
- das Ergebnis als Decision-Log-Änderung angewandt wurde;
- Produkt-Main-Implementierung separat nachgewiesen wird.

## 8. Ergebnis

X01 ist die richtige vorgeschlagene gemeinsame Sprache für weitere Entscheidungen. Es ist kein freigegebener Kernel und keine Main-Implementierung. Bis zur Variantenschließung darf es nur als explizit markierter Proposal-Crosswalk verwendet werden.

