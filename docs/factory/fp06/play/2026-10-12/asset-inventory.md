# PLAY-00 Assetinventur und lokaler Blender-Handoff, v1

Aufnahme: 2026-10-12T06:29:13.467614+00:00. Reviewer `/root/fp06_domain`, nur lesend; einzige neue Datei dieser Aufgabe ist dieser externe Bericht. Kein neuer Branch/Worktree, Produktwrite, Renderer-, Blender-, Build-, Test- oder Browserjob. `blender --version` ist ein tatsächlicher Versionscheck, keine Modellierung.

**Grundlage:** vorhandener lokaler Integrator `96cced23cd285b57f8a557d01ac9ed8a158c927f` auf `codex/hestia-fp06-integrator-2026-10-11`, Worktree `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`. Erste und letzte HEAD-Abfrage identisch; aktueller `git status --short`: leer. Der ältere Remote-main wurde nicht zur Neuimplementierung benutzt. W05 technisches PASS wird erhalten; Blender/HVOX und menschliche Art-Abnahme waren dort ausdrücklich NOT_RUN. W09 ist laut aktuellem Paketbericht BLOCKED, W10/W11 bleiben abhängig; diese Inventur schließt kein Paketgate.

## Gelesene Grundlage und Versionsprüfung

PLAY-Review und Startprompt unter `/workspace/hestia-followup-2026-10-12` vollständig gelesen; README, Status, heavy-route-v2 sowie FP01§3/14 und FP02§7 abgeglichen. `sha256sum -c SHA256SUMS.txt`: alle zehn Einträge OK, Exit0. Gelieferte package-status/heavy-route stimmen bytegleich mit Root-Controlplane überein. AGENTS, README, aktuelle Mainlinebeschreibung, Root-Locks und W05-Paketbericht gelesen. Neue PLAY-Beauftragung stammt von Root; die Lieferdokumente erklären alte Status-/Researchaussagen nicht zu frischen Runtimebeweisen oder früheren Ownerfreigaben.

Gültige Basis sind Meter, ground-center, Runtime +X east/+Z north/+Y height, rechtsorientiert. Bau-/Assetgrid0.25m ist getrennt von HVP-Zellen0.125m. `dimensionsM` ist historisch nicht überall in derselben Achsenreihenfolge: daher unten tatsächliche XYZ-Meshbounds, nicht blind diese Liste als XYZ verwenden. Cutter-Maß3×2×2.5m in FP02(E,N,H) entspricht Runtime3×2.5×2m. Wind hat ein konservatives nominales6m/13m-Envelope, kein behauptetes6m breites aktuelles Mesh.

## Objektinventar

`FA` = `src/factory/presentation/factoryAssets.ts`; `IP` = construction/installationProfile.ts; `HB` = hvp/hvpBootstrap.ts. Allen installierten FA-Objekten gemeinsam: IP→Sourceparts→MeshArtifacts→HB.stageFactoryScene→bestehender Presentation-Dispatcher/ThreeRenderBackend. Normale Runtime lädt die JSONs und erzeugt MeshArtifacts; kein Factory-GLBLoader vorhanden. Physik/Material kommen weiterhin aus NativeOwner/Resources.

**Neue In-game-Screenshots:** noch nicht geliefert; Aufnahme liegt ausschließlich beim Integrator. Für jede Tabellenzeile ist heutiger normaler Screenshot deshalb NOT_RUN in dieser Inventur. Historische W05-GPUbilder sind synthetische Assetproben und werden nicht als heutige normale Szene ausgegeben.

| Objekt | Native Quelle / Maße / Parts und Ports | Runtimeprodukt / tatsächlicher Receiver | Animation jetzt / konkrete Lücke |
|---|---|---|---|
| Cutter B06 | art/factory/fp02/cutter/source.scene.json + authoring-v1; XYZ3×2.5×2m,12Parts/33Boxen: Füße,12-Box-Rahmen, Einlauf, Schutzkammer, Klemme, Tool, Auslauf, Service, Power, Kassette,2Carriages. IN-STEEL/OUT-SEMI0.75m; Powermarker0.25m;4Joints/Pivots/Sweeps. | FA-Projektion perPart; HB2216ff montiert normale bezahlte208kg-Instanz/ Ghost. | Reine sourcegebundene30s-Phasen vorhanden; sampleMachinePose im Produkt weder importiert noch angewandt. S1-Material-/Mechanismuslesbarkeit, echte Statebindung, Rezept/WIP-Los nötig; bestehende guten Formen erhalten. |
| Former B07 | art/factory/fp02/former; XYZ4×3×3m,13Parts/34Boxen: Füße, Portal, Bett, Tool/Teleskopstangen, Aktuatoren, Ein-/Auslauf, Service/Power/Kassette/Carriages/Klemme. IN-SEMI/OUT-PROFILE-OR-SHEET;4Joints. | FA→HB, bezahlte341kg. | Reine40s-Phasen und Kraftpfadprüfung vorhanden, normale Anwendung statisch. PROFILE/SHEET unterscheiden sich noch nicht als sichtbare tatsächlich ausgegebene Waren. |
| Wrack/Frachtzone | fixtures/cargoSite.ts: feste Owner fp02_wreck_owner/container fp02_wreck_cargo;1.5×1.5×1m XYZ-Zugangssegment an[-5.5,2,13.125]m, Accessbounds, geschlossenes source/profileDigest. Keine vollständige Wrack-Partscene. | HB2230ff erzeugt tatsächlich EINE BoxGeometry/MeshArtifact fp06_cargo_s0_access_v1. | Nativeopened vorhanden, Mesh ändert sich nicht. Zerrissene, lesbare Cargo-Gehäuse-/Zugangssilhouette fehlt. Erstes Derivat innerhalb genau dieses Segments; ein großes begehbares Wrack bräuchte gesonderten Native-/Räumlichkeitsumfang. Keine Bonuskisten/Flugfähigkeit. |
| Carrier/Last | closed cargoHandlingProfile + NativecarrierBoxes;5Parts: payload+4Supports. HeavyBody1×1×1.5m lokal; light0.5×1×0.5m, q1. Körper/Societykeine allgemeine Tasche; einzelne finite Profile/BOMs. | FA.createFactoryCarrierProjection→HB.stageCarrierScene/syncCarrierProjection, actualNative position/phase/digest, eine Präsentationsslotgruppe. | Pose folgt tatsächlich Native. Sichtbar einfacher Warnboxkörper; Auflage/Verriegelung/Lastfamilie und Carry/Depot/Hold fehlen als Gestaltung. Keine zusätzlichen kostenlosen Rigitems/Masse. |
| Werkbank B05 | In FA technische Quelle; XYZ2×1.1×1m,5Parts: Tisch+4Beine, keine Joints/Ports.40kg C05, manuelle bezahlte lokale Montage. | FA/IP→HB, Entry bench-Preview. | Statisch, Schraubstock/Faltgestell/Tools/Arbeitsauslage fehlen. Manualphase ist fachlich LAID_OUT/ASSEMBLED; UIconfirmedWorkMs ist für manuelle Arbeit0, kein Automatiktimer ableitbar. |
| Lager B09 (3C08) | FA technische Quelle; XYZ2×1.5×2m,5Parts: große Bodybox+4Füße. MAT-IN/MAT-OUT auf±X, source-solid.60kg/Stück. | FA/IP→HB; Entry raw/product-Preview; gleiche Definition mehrfach, finite drei Stücke. | Keine Frontklappe, Griffe, tatsächliche Inhalt-/Füllgradprojektion. Waren dürfen nur aus aktuellem lokalen Containerbestand angezeigt werden. |
| Bezahlte4m-Bandlinie | FA.beltSource; XYZ4×1×0.75m;9Parts/9Boxen:4Metermodule, Drive,4Supports.26kg aus4C14+1C23. Power-IN; logische Endpunkte über W08source/target. | FA/IP→HB via normale connect-belt-Aufnahme, aktuelle MeshArtifacts statisch. | W08 finite ein Paket/Line, Credit/Position existieren fachlich; Receiver zeigt weder Paket noch Rollen/Gurtbewegung. Dunkler Gurt/Seitenträger/Endkupplungen fehlen. Kein Rigidbody je Lot. |
| Windkit | power-kit/source.scene.json;7Parts/14Boxen, tatsächlichesXYZ-Mesh5.01314×12.75×3m; konservativesnominal6×13×3m. Mast/Fußarme/Nabe/3Blätter/exponierterPower-Out. | FA/IP→HB kann Definition projizieren; EntryghostSlot vorhanden, kein normaler Windbau-Button im aktuellenEntry. | Statisch, keineJoint-/Rotorbewegung gebunden. Wind-/Betriebsreadfact nötig; kein rAF-Energiegenerator. Kit bleibt finite C01. |
| Solarkit | power-kit, XYZ4×1.25×3m,5Parts/11Boxen; Füße/Rahmen/4Panelboxen/Hinge/Power-Out. | FA/IP→HB, Ghostslot vorhanden, kein normaler PVbau-Button. | Entfaltetes statisches S0; keine Deploymentphase/Umweltreadview. PV darf grafisch still bleiben, Ertrag kommt nur aus supply/Domain. |
| Akku | power-kit;XYZ2×1.5×1m,4Parts/7Boxen; Füße/Rahmen/Body/Statuspanel, bidirektionalerPowerport.50kg C03. | FA/IP→HB, Entrybattery-Preview q1; aktuellePosez2.5m. | Statisch; Panel ist keineSOC-Anzeige. SOC/Charge/Discharge/Fault benötigt ReadView, keine neue Batterie im Modell. |
| Verteiler | power-kit;XYZ2×2×1m,4Parts/7Boxen, bidirektionalerPort,25kg C04. | FA/IP→HB, Entrybutton. | Statisch, kein eigener Port-/Schalter-/Statusleser. Der überlappende aktuelleDefault ist kein bestätigter Dock; Art darf Placement/Service nicht optisch freigeben. |
| Kabel/Stecker | C07 mm-Ledger; geschlossene4750/6500/8000v1 und7000/5250/7500v2-Transportjobs, installed_cable-Container/paidlinks.routeMm in FactorySession. Kein eigener Modellsource. | Carrierbox währendTransport; danach keine tatsächliche Kabelgeometrie im HB/Entry. | Freigegebene bezahlte Route braucht eigenes DerivedRender, Endstecker/kleine Halter. Neue Gesamtlänge/Masse/Netzports werden nicht aus Mesh errechnet. |
| Materialfamilien | W01 steel_known/semi/profile/sheet/offcut: Bulkmg; aktuelle Resourcescontainer, ReservationWIP, Paketcustody. Keine5familien-Artdefinitionen. | Namen/Mengen nur UI/ReadView, optional generischeCarrierbox. Kein sichtbarer Batchreceiver. | Große Stahlsegmente/Halbzeug, erkennbareProfile, flachesBlech, Verschnittcassette fehlen. Ein tatsächlichesLot erhält EINEN Darstellungsort; verschwundene/transferierteLots nicht als Doppelbestand zeigen. |
| FertigeStütze | FA technischeSmallbracequelle;XYZ1×0.25×0.25m,3Parts/3Boxen: Beam+2Supports; keinePorts/Joints.5.8kg ausREC05, Maße ausdrücklichProxy. | FA/IP→HB, EntrybracePreview, tatsächliche bezahlte Installation. | Statische funktionaleProxyform, kein kompletterST-Katalog. Verstärkungsrolle/Kontaktpunkte/Materialbearbeitung lesbarer machen; keine großePlattform oder zusätzlichePaidSteelParts. |

Powermarker in JSON heißen weiterhin authoring-only. W07/W09 bindet die aktuelle technische Nativeaufnahme explizit; daraus wird weder ein neuer W01Portfreeze noch HVOX-Kompilation.

## Konkrete Runtime-/Authority-Seams

1. `sampleMachinePose` hat ausschließlich seine Definition und Tests als Treffer; HB bindet alle Partkeys an dieselbe statische Gesamtpose. Artclip-Export allein aktiviert daher keine echte Maschinenanimation. Integrator muss confirmedWork/status auf vorhandene Parttransforms anwenden, WAIT/Recovery ohne eigene Fortschrittuhr.
2. Gegenwärtige FactoryUiReadModel nennt bestätigte elektrische Arbeit, Recipe, Stocks, Power/SOC; kein Beltpacket-/Kabelroute-Publikationsvertrag und keine authoritative presentPartIds/damageRevision. FactorySessionHandle publiziert nicht den gesamten privaten Domaincore. Kleinster read-only Renderhandoff muss diese tatsächlichen Fakten revisionsgebunden liefern; keine Renderer-/UI-Losbuchhaltung und kein selbst erfundener Damagezustand.
3. `installationProfile.ts` liest Collider/Footsupport/Service/Sweeps direkt aus FA-Sourceboxes. Änderungen bestehender source.scene.json sind deshalb Nativegeometrieänderungen. Erster Artgrant hält S0Part/Port/Pivot/Boundsbytes **FROZEN**; dekorative Details bleiben an denselben vorhandenen Partgruppen, innerhalb bisheriger Bounds/Sweeps/Portöffnungen. Keine neue Masse/Kollision/Authority.
4. Vorhandener `tools/blender/hestia_asset_authoring/export_hestia_glb.py` liefert canonical Semantik+GLB+Report. Er ist **kein HVOX- oder AssetVoxelcompiler**. Es gibt hier keinen belegten akzeptierten StructuralS1-/Voxelbridge. Blender/GLB-Derivate schließen diese Lücke nicht automatisch; gute S0Proxies bleiben korrekt. Menschliche Artentscheidung bleibt OWNER_REVIEW_PENDING.

## Tatsächliche Toolbereitschaft

- `/usr/bin/blender --version`: Exit0, **Blender4.3.2**.
- Installierte `/usr/share/blender/scripts/addons_core/io_scene_gltf2/__init__.py`: glTFExporter **4.3.47**, requiresBlender4.3.0. Re-Export wurde NICHT ausgeführt.
- Python3, Node, ffmpeg im PATH. game-dev/gltf-transform/assimp nicht im PATH; keine entsprechenden callableGameDevtools entdeckt. Plugin-doctor/packageworkflow deshalb NOT_RUN; dies blockiert den vorhandenen lokalen Blenderexporter nicht.
- Repository enthält bisherige Shipkit.blend/GLBs und vorhandenen HestiaAuthoringexporter, aber **keine Factory.blend, Factory.glb oder Factory.hvox** in den gefundenen Product/Artpfaden. Kein Systempackageinstall, Remoteprovider, Credential-/Spendflow, neueDependency oder Renderjob.
- Genutzter Skill: game-development-studio:game-asset-production; lokale vorhandene Quellen/Tools haben Vorrang, keine kostenpflichtigeGenerierung gewählt.

## Vorgeschlagene exakte neue Artgrenzen — noch kein Produktgrant

Artwriter auf neuem Root-erstelltem Worktree ab96cced23, maximalzweiterWriter nebenIntegratorkern:

```
art/factory/play-2026-10-12/cutter/**
art/factory/play-2026-10-12/former/**
art/factory/play-2026-10-12/wreck-cargo/**
art/factory/play-2026-10-12/carrier/**
art/factory/play-2026-10-12/workbench/**
art/factory/play-2026-10-12/storage/**
art/factory/play-2026-10-12/belt/**
art/factory/play-2026-10-12/power-kit/**
art/factory/play-2026-10-12/materials/**
art/factory/play-2026-10-12/brace/**
art/factory/play-2026-10-12/build_assets.py
art/factory/play-2026-10-12/manifest.json
art/factory/play-2026-10-12/README.md
art/factory/play-2026-10-12/LICENSE.txt
apps/weltraum-browser/public/factory/play-2026-10-12/**
apps/weltraum-browser/tests/unit/factory/playAssetDerivatives.test.ts
```

Schwerpunkt zuerst WrackCargo/Carrier/Werkbank/Lager/Band/Material/Stütze; Cutter/Former ergänzen, nicht entsorgen. ART zählt als Writer. Vorhandene art/factory/fp01/fp02, FA/IP, Contracts, Material/Power, Native, Host, Entry, Save, Config und package.json bleiben Artwritegesperrt. Eigene Evidence nur nach konkretem späterem Grant. Keine fingierte laufende Modellierung.

**Integratorseam:** isolierter `src/factory/presentation/playAssetLoader.ts` + tatsächliche Entry/HB/Sessionreadview-Anbindung gehört zunächst Integrator, nicht Art. Bestehende ThreeGLTFLoaderdependency ist im Shipvisual schon vorhanden, keine Dependencyänderung erforderlich. Ein reinesLoaderkompatibilitätsinterface kann vor Artumsetzung eingefroren werden; Runtimeadoption bleibt gesondert nachgewiesen.

## Kleinster tatsächlicher Blender-to-Parts/GLB-Handoff nach Grant

A. Jede vorhandene Partgruppe mit stabiler partId/Parentrelation und den exakten S0Box-/Port-/Support-/Pivot-/Sweepdaten nach Blender importieren; Boxkonturen hart/facettiert, keine Auto-Bevel-Rundmaschinen. Meter/Runtimeachsen explizit nach BlenderZup/glTFYup transformieren und zurück prüfen. Bestehende graphit/warmgrau/petrol/bernstein/PV-Palette wiederverwenden. Details funktional: reale Portal/Antrieb/Einzug/Auslauf, Lamellen, Verriegelungen, Klappe, Lastauflage; keine reine Boxexport-S1Behauptung.

B. Zusätzliche sichtbareDetailmeshes erhalten genau einen vorhandenen Parentpart; alle dargestellten Bauteile verschwinden mit diesem Parent. StructuralS0, paidBOM, Bounds und Portöffnungen bleiben vollständig identisch. Payload/Waren nutzen bestehendeSourceItem/Lotanker; kein neuesItem oderRig. Wrackderivat darf den vorhandenen lokalenZugangsowner nicht zur scheinbar großen physikalischenShipworld aufblasen.

C. Tatsächlich `.blend` speichern, neu öffnen, dann unveränderten bestehenden Hestiaexporter benutzen. Beispielhafter späterer, noch **nicht ausgeführter** Export:

```
blender --background art/factory/play-2026-10-12/cutter/cutter.blend --python tools/blender/hestia_asset_authoring/export_hestia_glb.py -- --output apps/weltraum-browser/public/factory/play-2026-10-12/cutter.glb --collection hestia_cutter --unapplied-scale error
```

D. Manifest bindet .blend/.glb/Exporterreport/nativeSourceSHA, Definitionref, Parts/Parents, Meter/Achsen, Bounds/Ports/Pivots, vorhandeneMaterialrollen, Originalprojektlizenz, Blender/Exporter/GLBHashes. Runtimekonturen aus derselben Sourcepartdefinition; GLB ist abgeleitet. Keine kanonischeSourceaus GLB-Dreiecken oderFarben rekonstruieren.

E. Sinnvolle Gateorakel: fehlendesPart/Portref oder falscheScale/SourceSHA real RED; nach minimalemFix validierte kompletteExtrabytes/Bounds. Integrator normalerReceiver: Importfehler sichtbar; beschädigtesPart bleibt entfernt; WAIT_POWER eingefroren; echterOutput erst nachLedgercommit; positiveLesbarkeit amSpieleraugenpunkt. Echter normaler Screenshot und Bewegung im späterenCLI-/Browserlease, keine parallelenBlender/GPUjobs. Export-, Native-/Gameplay-, Art-, Performance- und Ownergates getrennt berichten.

## Byteaufnahme der tatsächlich gelesenen Sources

Die folgende Aufnahme ist aktuellesSourcehashing, keine Behauptung einer historischen Vollsuite oder eines neuen Produktseals.

| Absolute Datei | Bytes | SHA256 |
|---|---:|---|
| `/workspace/Weltraum-Spiel/.worktrees/fp06-w00-2026-10-11/docs/factory/fp06/reviews/package-status-current.md` | 16196 | `4048cd1ece05df82c77c6a033c36647a9667fdf13f9ee1b1f38b311ef63078b7` |
| `/workspace/Weltraum-Spiel/.worktrees/fp06-w00-2026-10-11/docs/factory/fp06/reviews/w05-package-report.md` | 41082 | `d6048235d42b9def59766a186aee14b22d1659713fbcf576411e2e615bf27bf8` |
| `/workspace/Weltraum-Spiel/.worktrees/fp06-w00-2026-10-11/docs/factory/fp06/proposals/heavy-route-start-site-v2.md` | 8362 | `5fd528af5b7fdddf467905f26087090a295ff65c3e15bb2dd843134f6aaee7c7` |
| `/workspace/Weltraum-Spiel/.worktrees/fp06-w00-2026-10-11/docs/factory/fp06/source-lock.json` | 278991 | `21aa7dba98963722ff09a92a809e5161e56880645ee07749e793cea69fe4a61c` |
| `/workspace/Weltraum-Spiel/.worktrees/fp06-w00-2026-10-11/docs/factory/fp06/write-ownership.json` | 255037 | `8e85eed60c12ec857765d71d7186e74ab0ed404cb102c0bb5e943bfe247aa517` |
| `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/apps/weltraum-browser/src/factory/presentation/factoryAssets.ts` | 14061 | `a9d707c53d8ae401e952076007aff523bcec127f4c0b58d37020aaea9ced973c` |
| `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/apps/weltraum-browser/src/factory/presentation/machinePose.ts` | 3309 | `c426f01ae087004a1eacde662de0c5da7c22f18410d5900d2ca20e840cae111b` |
| `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/apps/weltraum-browser/src/factory/construction/installationProfile.ts` | 5568 | `4e5d3f027da5aef0ba68243b911c55d7558eab86477e2ebd3e134a26f82d8b8b` |
| `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/apps/weltraum-browser/src/factory/construction/cargoHandlingProfile.ts` | 4766 | `04e3f16fdc073414c5d02ef58082cfe9f959663a597e2d1d689206e892a92fcd` |
| `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/apps/weltraum-browser/src/factory/fixtures/cargoSite.ts` | 4071 | `83fa38b62b88c8f0c7f9351a1d30617b2704d4c04a21bb64fcc5084e8739ef0c` |
| `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/apps/weltraum-browser/src/factory/session/hostPort.ts` | 10087 | `da5fc8501828850272aeb3e55e93cce37f57c288961fb81b2c5aec9f09e9afdf` |
| `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/apps/weltraum-browser/src/factory/session/factorySession.ts` | 66208 | `ea8d8cdee5ea1826a9b00f0dd7d2d7cbfc4408cdeb7cb2e3f880893ea86a448a` |
| `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/apps/weltraum-browser/src/factory/factoryEntry.ts` | 13665 | `d6ef6be3e810ee815857f739a832eae04e5b80d99804a870999712d5006c4dd7` |
| `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/apps/weltraum-browser/src/hvp/hvpBootstrap.ts` | 175076 | `66ec6f330dc7d6cf7c25851fc20b3ae17bb0daf8faad8827efe6d45dff81198d` |
| `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/apps/weltraum-browser/src/hestia-prototype/physics/factoryFacilitySession.ts` | 53631 | `d6b78d8f21b3c726752f72310c20e851c21dfe9589969823630830bb5ca98311` |
| `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/tools/blender/hestia_asset_authoring/export_hestia_glb.py` | 18150 | `96732611048d3ff0d215e5c69ccfeed68234d552e75eed8c871572caf07b5b27` |
| `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/tools/blender/hestia_asset_authoring/blender_adapter.py` | 45739 | `ea500e05019536ceba34f1c6ec3564fc66514068b37faeecd05398e91b17dcad` |
| `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/art/factory/fp01/power-kit/authoring-v1.json` | 7286 | `ebab668ca024e995b8742021f4440886c10b51ba58a5c7520de37a6bc87c7dd8` |
| `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/art/factory/fp01/power-kit/derived-report.json` | 16840 | `21bd57c0853b2f5ff151532d06308d0baffab4aa2920d2bd2bc1d3e9379d40f0` |
| `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/art/factory/fp01/power-kit/source.scene.json` | 27070 | `bb131bb9b03f2e76abf1ba4ad25fe7d228ecf19b70ec9910e491c03dd1ab256c` |
| `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/art/factory/fp02/cutter/authoring-v1.json` | 5596 | `0cdb071fb15c5b7c5ee57fa5f10685b8919b741adbe0d10c5e7f47f93cca1a61` |
| `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/art/factory/fp02/cutter/derived-report.json` | 10823 | `03d2d4c8ad1198d8e24d655ded01de7cd8cdbbe7af798ef6f02c5a6b5ea9a38a` |
| `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/art/factory/fp02/cutter/source.scene.json` | 19222 | `abd1ce25fd19ad61a9cb65de9f5ba10c303aa5c1a1aa16260de9dce9534fa5fd` |
| `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/art/factory/fp02/former/authoring-v1.json` | 5889 | `31500d6c38d06be22226940222c8abcba5d2e9e48483e36293910da71575c34b` |
| `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/art/factory/fp02/former/derived-report.json` | 10954 | `d8886ba6ae7703a3718c2293582812d8d6c153bfc0defe717a49449713e4a8c9` |
| `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/art/factory/fp02/former/source.scene.json` | 19487 | `4e27abd922e46516d1db0307b8dfb5edaf1b8c6807e80006781344b9dfcf535d` |
