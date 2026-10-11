# W09 — physischer Zugang zur endlichen Fracht und Bereitstellung

2026-10-11, `/root/w11_evidence`; read-only Preflight. Keine Produktwrites, Tests, Builds, Browser, Assetgenerierung oder Unteragenten. **Kein W07-Seal-/Spec-/Runtimeurteil.** Der aktuell bearbeitete Integratorstand wurde nur als begrenzter beweglicher Snapshot gelesen.

## Quellenbindung

Originalverzeichnis `/workspace/hestia-handoff/HESTIA_CODEX_CLOUD_HANDOFF_2026-10-11/01_PLANUNG_VERBINDLICHE_QUELLEN/`:

- FP01 `HESTIA_FP01_EINSTIEG_ENERGIE_DETAILPLAN_2026-10-10.md`, SHA256 `ec3e605de2c6a4877c2ff0afae244b3215e7bf8bb267feef4c466b546477080c`. §5.5:415 erlaubt vorkonfektioniertes Roll-/Tragegestell oder glaubwürdige Montagepalette, eine kurze einheitliche Aufnahme→legaler Bodenanker→Bestätigung statt vollständigem Fahrzeugtransport-Simulator. :417: nahe Depots per nachvollziehbarer Reichweite, echter atomarer Bestandstransfer, keine Teleportfunktion. E00:798–814: sicherer Cargo-Sichtanker, etwa12×8m nutzbare Wrackzone, seitlicher zugänglicher Eingang, normale Container-/Modulauswahl, stabile IDs, persistentes Öffnen und idempotentes Open/Claim; niemals erneute Flugfähigkeit. §9:1082–1083 fordert tatsächlichen World-/Cargo-Commit und cargo-seitigen Öffnungsintent.
- FP02 `HESTIA_FP02_PRODUKTIONSKETTEN_GEBAEUDE_LAYOUTS_DETAILPLAN_2026-10-10.md`, SHA256 `5c4f068edba3d0c89e77b0d3a40734d4ee1a672c39f3885cbfef31430d942f39`. :45/60 endliche existierende bergbare Frachtweltobjekte; :93 Cargo öffnen; :404 Tools/Equipment außerhalb C01–C28 dürfen keine zusätzlichen Fertigungsmaterialien werden; :406 SALVAGE-01 getrennt und hier nicht zu schenken. §6.4:437–440 schwere Packs nicht in eine20kg-Hosentasche teleportieren; Cargo-Wagen/Montagepaletten sind zulässig; ein Baucommand darf nur **„nachweislich erreichbares“** Depot reservieren. B05:529 bindet Handmontage an erreichbares Depot/unmittelbare Kiste. §9.1:785: **eigentliches Crash-Cargo liegt außerhalb der22×12m-Maschinenzone**, mit eigenen FP01-Clearances. Das ist kein Auftrag für zusätzliche Terrainmasken.

D07 bleibt exakt angenommene15-Masken/70m²-Fixture. Außerhalb ihrer Union wird die vorhandene Naturquelle benutzt und tatsächlich geprüft; weder dieses Preflight noch ein Cargoanker verändert Gelände oder erzeugt Material. Keine neue Ownerpolicy wird benötigt.

## Tatsächliche APIs und belegte Lücke

Integrator-HEAD bei Aufnahme `d5502ae7fd5431d58eda51bea062c54691ebe3c2`, Worktree `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`. Aufnahmepunkte12:53:40–12:54:31 UTC, relevante Callseams danach direkt gelesen. W07 ist **unsealed/IN_PROGRESS**; alle folgenden Pfade relativ zu `apps/weltraum-browser/`.

| Tatsächlicher Code | Aussage und Grenze |
|---|---|
| `src/factory/catalog/fp02Catalog.ts:215–230` | Einmaliges endliches C01–C28-Resources-State `fp02_wreck_cargo`, Owner `fp02_wreck_owner`, stabile Instance-/Sourceevent-IDs. Keine Worldpose oder native Cargoobjektanlage. |
| `src/factory/session/factorySession.ts:29–34` | W07 initialisiert einmal das logische ShipCargo-Snapshot mit endlichen4000kg/30m³/200Stacks; kein Cargo-Worldowner entsteht hier. Mengen bleiben W02/Resources-owned. |
| `src/hvp/hvpBootstrap.ts`, `construction.readFacts` (Aufnahme :2203–2208) | Actorposition stammt tatsächlich aus `physics.read().player.position`; fehlender Nativeplayer wird abgewiesen. **cargoPositionMm ist dagegen ein Literal `[-4750,1500,5000]`.** Kein dazu gebundener Cargoowner, Access-/Pose-/Containerlocation-Receipt oder Öffnungszustand im gelesenen Host. |
| `src/factory/construction/placement.ts:20,55–58,83–88` | Entfernung zu Servicehülle≤3m und zum behaupteten Cargopunkt≤4m. Quellenwahl wurde im aktuellen Snapshot korrekt auf `fp02_wreck_cargo` geschlossen; ownerweite Inventarsuche ist nicht mehr die Quelle. Das beweist Materialherkunft, aber noch nicht den physischen Cargopunkt. |
| `src/resources/containers.ts:69–117`, `transfer.ts:79–127,325–394` | Actor-/Owner-/Port-/Capacity-/Revisionpolitik und generische Extensions; **keine aufgenommene WorldPose-/LOS-/Entfernungsautorität**. W02-Transfer-CAS prüft native Inhalte, nicht ob der Actor den Container geometrisch erreicht. |
| `src/hestia-prototype/player/locomotion.ts:8–21,55–105` | Echter kinematischer Playerbody in derselben privaten Rapierworld, kollisionsgeprüfte Bewegung und Coveragehold. Playerpose ist geeignetes Hostfaktum; Kamera-/Renderposition ist es nicht. |
| `src/voxel/structural/physicsCommit.ts:76–79`, `physics/rigidBody.ts` | Bestehende ParentWorldPose ist eine lokale Structuralbody-Poseprimitive. Sie registriert keine Cargo-/Containerlocation. |
| `physics/factoryFacilitySession.ts:33,77–96`, HostPort | W07s beweglicher Draft besitzt begrenzte Fixed-Facilityanlage, aktuelle Worldshape-Overlapqueries und gemeinsame Adoption. Kein bereits vorhandener Cargo-/Handtransportmodus wurde im inspizierten HVP/Factorycode gefunden. |

Inverse D07-Abbildung des Literals: east=12.5−5=7.5m, north=−4.75+12.25=7.5m. Das liegt **innerhalb** der Cutterservice-Maske(east6..9,north7..8). Es ist daher kein quellenkompatibler Nachweis des eigentlichen außerhalb gelegenen Cargo-Blocks. Als späterer lokaler Bereitstellungspunkt wäre die Lage nur nach echter Materialbeförderung und Service-/Collisionprüfung zulässig. Das aktuelle Literal allein belegt weder diesen Transport noch ein Depot. Der normale Entry zeigt bislang Buildbuttons, jedoch keinen tatsächlichen Open-/Transport-Cargofluss. Dies ist die konkrete W09-Aufnahmelücke; daraus wird kein endgültiger Fehler des noch bearbeiteten W07-Pakets erfunden.

## Kleinste vorgeschlagene normale Aufnahme

**A. Quelle als echtes Szenarioobjekt binden.** Ein kleines versioniertes Factory-Cargo-S0-Szenarioprofil benennt ursprünglichen Worldowner, Container-ID, Source-/Terrain-/Sessionbindung, unveränderliche geprüfte Pose, tatsächliche Accessfläche, Collision-/Clearancehüllen und Öffnungszustand. Ein zugängliches S0-Frachtsegment mit wenigen registrierten Fixedcollidern und leasegebundener Projektion genügt als technische Anfangswitness; kein vollständiges Flugschiff/Artpaket oder RigidItemsystem. Es repräsentiert die bereits vorgegebene endliche Crashquelle, keine neu gewonnene Bauressource. Seine nicht als C01–C28-Material gezählte Wrackhülle darf keine SALVAGE-/Mininggutschrift oder Gratisbauplattform sein. Eigenen Standort **außerhalb** der Maschinenzone auf tatsächlich geprüftem unverändertem Terrain wählen; keine numerische Lage wird hier freigegeben oder als tragfähig behauptet. Nativeowner/initiales Szeneprofil bleiben in W10 vollständig erfassbar; globale und Facilitycaps inklusive Staging unverändert.

**B. Nur reale Nähe öffnet Zugriff.** Player erreicht die Accessseite über normale Nativebewegung. Frischer Open-/Selectintent bindet actual Actorpose, Sourceowner/Pose-/Terrainrevision, Access-/LOS-/Coverageprüfung und Rechte. Mechanischer Zugang benötigt keinen Gratisstrom. Open ist idempotent und erzeugt keine Fracht. ReadViews zeigen genau denselben endlichen W02-Container. Cargoanker kommt ausschließlich aus Host-/Native-/Szenarioregister; kein UI-`setSourcePose` und kein beim Öffnen an den Player kopierter Cargopunkt.

**C. Vor entfernter Bauarbeit tatsächlich bereitstellen.** Wo ursprüngliche Fracht und Ziel nicht zugleich im zugelassenen Nahbereich liegen, erlaubt FP01:415 einen kleinen einheitlichen Handlingmodus: ausgewählte vollständige Job-BOM/Itemlose nahe der Quelle aufnehmen → mit dem tatsächlichen Player zum Ziel gehen → auf geprüften Zielanker ablegen → bauen. Ein endlicher Transport-WIP-/Bereitstellungscontainer besitzt die echten Resourcesmengen und gebundene Instance-/Lineage-IDs. Seine Kapazität wird auf den konkreten aufgenommenen Payload/Job begrenzt, samt exakter Masse/Packkapazität; kein unendlicher Suit und kein200kg-Lager als Aufnahmerecht für einen300kg-Formerkern. HeavyHandling bleibt eine quellenzulässige Montagepaletten-/Tragegestellfähigkeit, nicht zusätzliche frei verbrauchbare Fracht außerhalb der eingefrorenen C01–C28.

Der Host verfolgt die Transportpose anhand bestätigter Native-Actorbewegung und einer versionierten Carrierhülle, prüft deren Weg-/Terrain-/Collisioncoverage in **derselben** World und stoppt bei unbekanntem/blockiertem Weg. Playerkapsel allein beweist keinen breiteren schweren Payload. Renderer zeigt den angenommenen Handlingzustand; er bewegt keine Ressourcen. Kein direkter Source→RemoteDepot-Transfer nur aufgrund eines Zielklicks, kein Versetzen des gesamten ursprünglichen Cargoankers, keine erfundene Rückzahlung. Aufnahme, Ablegen/Abbruch und nachfolgende Installation erhalten gleiche StableIDs, echte Source-/Target-CAS und genau einmaliges Ownership; unbekannter Ausgang wird aufgelöst oder gehalten.

**D. Per Container validieren, nicht die ganze Ownerinventarliste öffnen.** Nach Ablegen steht ein tatsächlich lokales Jobdepot mit gebundener Pose/Resources-Custody bereit. W09 erweitert W07s enge Sourcewahl nur um konkret ausgewählte, autorisierte erreichbare Depot-/Carrier-/Outputcontainer. Jede verwendete Quelle erhält eigene Worldowner-/Pose-/Access-/Revisionprüfung; Ownergleichheit ersetzt sie nicht. Installed-BOM- und fremdes WIPmaterial bleiben gesperrt. Ein tatsächlich naher ursprünglicher Cargozugriff kann weiterhin direkt bauen; er benötigt kein künstliches Pflichttransportminispiel.

**E. Derselbe Weg für die frische Montage.** Zwei8kg-Stahlchargen werden aus dem echten Cargo in das bezahlte Rohlager bereitgestellt. Die4kg frisch erzeugten Profile+2kg Blech gelangen vom echten Fertiglager an die erreichbare Werkbank über denselben begrenzten Handlingweg; keine entfernte Werkbankreservation über eine globale Liste. REC05s actual Outputstück5.8kg wird danach mit seinem ursprünglichen Output-/Instancebeleg lokal verwendet/platziert. Manualarbeit bleibt der bereits autorisierte geordnete Workreceiptvertrag ohne erfundenen Timer. Carrier-/Depot-/Open-/Command-/WIPidentitäten müssen später W10-persistierbar sein; W09 meldet den fehlenden Savegate.

Diese Folge ist ein **technischer Vorschlag, noch nicht implementiert**. Sie benötigt keine Simulation jedes schweren Einzelitems, keinen neuen Fahrzeugcontroller, neue Terrainmasken, Produkt-Ownerfreigabe oder vollwertigen Wrackflug. Der später aufgenommene S0-Carrier-/Access-/Capacityvertrag muss seine konkreten Werte selbst ehrlich versionieren und fachlich prüfen.

## Conditional genaue Integratorpfade

Keine Grants durch dieses Preflight. Aktuelle W07-Dateien erst nach dessen Seal/Review auf die finalen APIs rebinden.

| Pfad unter `apps/weltraum-browser/` | Minimaler Anlass |
|---|---|
| `src/factory/fixtures/cargoSite.ts` (neu, falls kein W07-Nachfolger dies liefert) | Nur sourcegebundenes Cargo-S0-/Access-/Pose-/Initialownerprofil, keine Geologieänderung oder Cargoaufstockung. |
| `src/factory/session/cargoAccess.ts` (neu, bedingt) | Enger Host-Access-/Location-/Open-/Handling-/Depotvertrag; reine Intents/ReadViews und einmalige Resources-Custody. Keine andere Materialautorität. |
| Bereits geplante W09 `factoryEntry.ts`, `ui/cargoPanel.ts`, `session/{hostPort,factorySession,dryFactorySlice}.ts`, `hvp/hvpBootstrap.ts` | Normale Open/Select/Handlingintents; tatsächliches Szenario-/Nativeposefakt statt Cargoliteral, gemeinsame Context-/Focus-/Pending-/Disposebarriere und eine Materialview. |
| `src/factory/construction/{placement,buildStep}.ts` | Nur ausgewählte admissible Sourcecontainer samt echter individueller Reach-/Revisionbindung; spezifisches produziertes Braceitem. Keine Rückkehr zum ungeprüften Ownercontainerscan. |
| `src/hestia-prototype/physics/session.ts` und gegebenenfalls `factoryFacilitySession.ts` | Falls das endgültige W07 keinen initialen sourcegebundenen Cargoowner und Carrier-/Accessqueryseam hat: eng in der vorhandenen privaten World aufnehmen. `physics/{client,physicsWorker}.ts` nur dann zusätzlich konkret planen, wenn hierfür tatsächlich neue begrenzte Factoryinit-/Query-/Handlingmessages benötigt werden. Keine Worldhandle-/generische Spawn-/Sourcepose-Writefreigabe. |
| `tests/unit/factory/cargoAccess.test.ts` (neu, bedingt), vorhandene W09 `dryFactorySlice.test.ts`/`factory-dry-flow.spec.ts` | Spätere tatsächliche Quellen-/Nativepose-/fremdesDepot-/Fernquelle-/stale-/doubleOpen-/cancel-/transportBlock-Negativfälle und echter Normalflow ohne Bridge. Betroffene Host-/Nativeunits nur für konkret ergänzte Seams. |

Keine W01-/Resourceskern-/OldGameCodec-/generischen Repository-/Density-/Coaständerung. Keine zusätzlich geplante CargoArtproduction jetzt. Notwendige spätere Nachweise: wirklicher SourceCargo-Sichtanker außerhalb Maschinenzone, normaler native Playerzugang, tatsächlicher Open und sourcegebundene Debits, bestätigter Handlingweg und Depotpose, frische Outputlineage bis Braceinstallation, unveränderte16kg-Produktbilanz und globale endliche Cargo-/WIP-/Installedbilanz. Hier **alle Runtime-/Browser-/Transport-/Saveprüfungen NOT_RUN**.

## Begrenzte Snapshot-Digests, ausdrücklich kein Seal

SHA256 um2026-10-11T12:54:31.847117Z, im oben genannten Integrator-WT; spätere Writeränderungen dürfen diese vorläufige Aufnahme überholen:

```text
1da905096e066307f9f627a7e02ea49c253d900125b9d0485a30f1dd4e5a5c8b src/factory/construction/placement.ts
4e5db5b1bb70921a8ee4cfbd91da48c66f4e5686b2228805b5b0ab6ae2f8ea17 src/factory/construction/buildStep.ts
62261cb871749c4564104889101d3700cbc46d09677743e1581f6eb07bba2bbd src/factory/session/hostPort.ts
27fd3d8d192f6eacc16540ffecac904a677466c89cbc613328b1901f77cf3aa2 src/factory/session/factorySession.ts
f0964274aeb4422e40f9ed50518478a65a2899c235617ee479cab2b0533f9b6a src/factory/factoryEntry.ts
69ddeb1f6092792654cbeb1ff086d51aa2addc2ec3c6335dbb11f4a7e05ec4cd src/hvp/hvpBootstrap.ts
53725bbf06af6be92ac1b3b3e250ee6548e37bb6abf8500b4cd50e09b1ec1a29 src/factory/fixtures/startSite.ts
09f0d3001e43ec4c83a7d45c7f24b4cf1dd9d8f5dc52def74135d55f3fa0de62 src/hestia-prototype/physics/factoryFacilitySession.ts
```
