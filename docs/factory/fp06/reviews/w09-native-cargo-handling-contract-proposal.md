# W09 Native-Cargohandling — konkreter technischer Vertragsvorschlag

2026-10-11; `/root/fp06_domain`, READ_ONLY. Grundlage: Sourcepreflight SHA256`eb0635fd91a7b829ef2ac15dd946f81c46d54c3db008d6034666c6ba876762f0`, FP01:415–417/FP02:366,370,438–441,771 und Normalflow`e4402ed4…`. **Kein Grant/Freeze/PASS; sämtliche neuen Runtimegates NOT_RUN.** Domain-HEAD`6929bf2447b72c9f3f8fa3bcae0a59c0691966c0` bleibt sauber/unverändert; keine Ausführungsjobs.

## Tatsächliche Aufnahme

Aktueller Integrator-Draft: `factoryFacilitySession.ts:88–106` hält einen festen Cargo-S0-Accesswitness; :120–125 öffnet nach nativen LOS-/Support-/Reachchecks. `client.ts:237–277` und `physicsWorker.ts:155–159` tragen bestehenden Prepare/Commit/Publish/Rollback/Finalize-Vertrag. `session.ts:112–118` ist der echte60Hz-Worldstep. **Keine Handlingaufnahme existiert.** `placement.ts:60–68` akzeptiert nur ShipCargo; `buildStep.ts:22,49` besitzt bisher eine private Materialview, die W09 in die gemeinsame Sole-Resources-Adoption integrieren muss.

W02`reservations.ts:126–146,279–291` bietet vollständige atomare Moves/CAS/Receipts und sperrt Rezept-WIP. Vollständige Komponenten behalten Stack-/Instance-IDs; echte Bulk-Teillose brauchen neue Child-ID mit Herkunft. Ownership, Mission, Grade und Condition bleiben erhalten; `resources/transfer.ts:345–383` kann geometrische Reichweite nicht ersetzen.

## Kleinste vorgeschlagene Aufnahme

**Ein wiederverwendbarer Handlingslot je Session**, ein Nativeowner/eine konservative kinematische Payloadhülle in derselben World. Kein zusätzliches verbrauchbares Gestellitem: Pack/Frame ist bereits in C26/C27-Masse enthalten. Zugelassene versionierte Jobprofile binden exakt B06-/B07-BOM beziehungsweise konkrete W09-Material-/Bracewege; keine freie Menge,20kg-Defaulttasche oder unendliche Equipmentkapazität. Containerkapazität und erlaubte Sourceitems werden aus dem konkreten endlichen Job abgeleitet; rationale Packvolumina bleiben Kapazität, keine Colliderform.

Hostcommands, Namen **Vorschlag**:

```ts
Pickup {commandId,jobProfileRef,sourceLots,expectedBinding}
Deposit {commandId,handlingId,targetContainerId?,groundAnchorMm?,quarterTurns,expectedBinding}
Return {commandId,handlingId,targetContainerId,expectedBinding}
```

`expectedBinding`: Session/Epoch/Catalog/Sourceprofil, bestätigter NativeTick, Terrain-/Facility-/Material-/Sourcecontainerrevisionen. Keine Actorpose, Bodyform oder Masse vom UI. Host liest tatsächlichen Nativeactor; Nativecommand erhält geschlossene Source-/Job-/Materialcandidatebytes und prüft dasselbe Profil. Historische identische Commandbytes liefern gespeicherten Receipt; veränderte Bytes derselben ID rejecten, auch nach späteren Jobs.

**EMPTY→CARRYING→LOCAL_READY→EMPTY:** Pickup bei geöffnetem erreichbarem Sourceowner, LOS, Rechten, freiem Slot und tatsächlichem Actor-/Payloadground. Host bereitet W02-Moves vor; Nativeowner/Projektion bleiben verborgen bis gemeinsamer CAS/Publish; fehlender ACK führt zu Receiptauflösung/Hold, keiner Gratiserstattung. Während CARRYING erzeugen ausschließlich normale Nativeinputs Bewegung. Vor `setNextKinematicTranslation` prüft ein enger Locomotionhook vollständige Carrier-Swepthülle, eigene Bodenauflage und Coverage gegen aktuelle Collider; Actor und Payload nehmen denselben geprüften Schritt. Obstacle blockiert Bewegung, erhält Bestand; unbekannte Coverage hält nach vorhandener Policy. Kein Move-/Teleportcommand, keine RAF-Folgepose; normaler Carryzustand ist keine permanente Publishbarriere.

Deposit verlangt aktuelle Nähe/LOS zu beiden nativen Endpunkten und freie reale Zielkapazität oder legalen250mm-Bodenanker mit vollständigem Support. Groundanker nur am aktuellen Carrierstandort mit dokumentierter Raster-Snaptoleranz und Sweptprüfung, keine Weitversetzung. Beim Grounddepot wird derselbe Owner fixed, derselbe Container bleibt Custodyort; Placement darf anschließend ausschließlich dessen tatsächlich erreichbare Quellen nutzen. Slot wird erst nach vollständigem Verbrauch/Weitertransfer freigegeben; referenzierte leere Container bleiben für WIP/Receipts bestehen. Return ist nur eine echte lokale Rückübertragung. Abbruch vor Publish rollt beweisbar zurück; nach Pickup kein Fernrefund: Ware bleibt am aktuellen Carrier/Depot, bis legaler Transport/Return gelingt.

**Masse ehrlich:** C26/C27 bleiben1Piece180/300kg. Facilityowner.massMg ist sourcebilanziert (`installationProfile.ts:34–44`), Nativecollider benutzen jedoch Defaultdichte; Cargo-S0 bietet keine physische Packmassenaufnahme. Daher Payloadmassenaudit aus echten Sourcecontents; für den neuen kinematischen Owner ausdrücklich Colliderdichte0/zusätzliche Source-Payloadmasse und tatsächlichen Rapiermassentest vorsehen. Kinematische Solversemantik beweist keine dynamische Schwerlast-/Traglastsimulation. Packhülle/COM/Inertia sind technische Proxies, keine vorhandenen Quellenwerte; keine Masse aus Meshvolumen.

## Zusätzliche exakte Pfade und REDs

Neu, ausschließlich Integrator: `src/factory/construction/cargoHandlingProfile.ts`, `src/factory/session/cargoHandling.ts`, `tests/unit/factory/cargoHandling.test.ts`.

Nötige vorhandene Anschlüsse: `src/hestia-prototype/physics/{factoryFacilitySession,session,client,physicsWorker}.ts`, `src/hestia-prototype/player/locomotion.ts`, `tests/unit/factory/facilitySession.test.ts`, `tests/unit/hvp-locomotion.test.ts`. Bereits W09-geplante `placement.ts/buildStep.ts`, HostPort/Bootstrap/FactorySession/DrySlice/Entry liefern lokale Quellen, gemeinsame Authority und normale Intents/Projektion. Kein W01/W02-/Resourceskern-/Legacycodecwrite.

Fach-REDs: fern/geschlossen/LOS-blocked Pickup; echtes300kg-Piece plus BOM einmal bis lokaler Formeradmission; breite Payload an Hindernis/Unknowncoverage trotz freier Capsule; Source-/Terrainstale zwischen Prepare/Publish; Bulkchild-/Custody-/Recipe-WIPschutz; Replay nach Deposit/späterem Job und veränderte Bytes; Cancel/lostACK ohne Refund oder Zweitowner; native Masse/Budget einschließlich Staging.

W10 speichert ganze Materialview/Receipts, Handlingphase/Profil/Job/IDs/Cursor, bestätigte Pose/Orientierung/Owner-Membership, Depotbindung, Commandbelege und Pending/Hold-Ausgang gemeinsam. Restore pausiert, validiert Sourcegeometry/Masse/Custody/Support, mappt neue Handles; keine Anfangsfracht oder Offlinebewegung. Bestehender geschlossener `persistence/worldCheckpoint.ts` enthält keine Factoryfelder: ergänzender Combinedvertrag, keine stillschweigende Legacycodec-Erweiterung.
