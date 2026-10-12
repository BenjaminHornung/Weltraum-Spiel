# W07/W09 Cargo-S0 — konkreter Standort auf unveränderter Naturquelle

2026-10-11, `/root/w11_evidence`. Read-only Standortpreflight; ausschließlich kleine reine Quellabfragen und anschließende JSON-/Quellinspektion. Keine Produktänderung, Tests, Builds, Browser, Native-/GPU-/Assetjobs oder Unteragenten. **SOURCE_CANDIDATE_FOUND**, kein W07-Seal-/Runtime-/Owner-Art-PASS.

## Konkreter Vorschlag und tatsächlicher Support

Ein **kleines Zugriffsfragment des vorhandenen Crashcargo**, technisch vorgeschlagene S0-Maße **1,5 m X × 1,5 m Y × 1,0 m Z**, kann geometrisch auf folgender unveränderter Naturfläche stehen:

| Bindung | Meter im bestehenden World |
|---|---|
| Kontaktfläche, halboffen | x[-6,25;−4,75), z[12,625;13,625) |
| Unterkante / vorgeschlagenes Zentrum | y=1,25 / (−5,5;2,0;13,125) |
| Lokaler Layout-A-Frame | North[6;7,5), East[−1,125;−0,125): vollständig außerhalb der22×12-m-Maschinenzone |
| Accessface Richtung Fabrik | Zentrum(−5,5;2,25;12,625), Normal(0;0;−1) |
| Tatsächlich abgefragter Standpunkt | (−5,5;2,42;11,875), CenterTop1,5m; liegt in der angefragten Zugangshülle x[-6,25;−4,75),z[11,625;12,625) |

Die tatsächliche kanonische Quellabfrage um **13:19:00.562 UTC** liefert für alle **96**125-mm-Kontaktspalten exakt Top**1,25m**;46Spalten Slot1(Kalkstein trocken),45Slot3(Soil),5Slot4(Moss). **Null D07-Maskenspalten**, Factory-Reader und ursprünglicher v5-Reader stimmen für jede Kontaktspalte überein. Keine Nivellierung, Footverstellung, neue Maske, Zusatzplattform oder Materialgutschrift erforderlich.

`hvpCoastSource.ts:452–477` materialisiert aus diesen quantisierten Column-Tops: iy73 ist die oberste Solidzelle(y1,125..1,25), iy74..85 sind Air(y1,25..2,75). Daraus folgen geometrisch96durchgehende Kontaktzellen und1152Airzellen für die vorgeschlagene Witnesshülle. **Dies ist aus dem tatsächlichen Column-Export und dem gelesenen Materializer abgeleitete Occupancy**, keine separat ausgeführte Vollmaterialisierung oder Nativebodyprüfung. Der Standort liegt außerhalb der ausgehöhlten Rock-arm-Quelle und aller D07-Masken. Bodenfestigkeit/zulässige Traglast für Soil/Moss oder das vollständige Wrack sind nicht aus dieser Quelle bestimmt; kein Traglastzertifikat wird behauptet.

Die Maße gehören ausschließlich zum **begrenzten Access-/Wracksegment**, weder zum vollständigen etwa12×8-m-E00 noch zur tatsächlichen Packgeometrie des4000kg/30m³-Resourcescontainers. Die endliche ursprüngliche C01–C28-Custody bleibt dieselbe; es wird weder behauptet, die gesamte Fracht passe in diese2,25m³-Hülle, noch irgendeine Hülle als zusätzliche Fertigungsressource freigegeben. Keine gratis gebaute begehbare Plattform. Kein neuer Owner-Produktentscheid oder bereits akzeptiertes Artprofil.

## Erreichbarkeit: konkret gemessene Quellpunkte

W07s aktuell gelesene Cutterservice-AABB nach Rotation1/Zentrum(−6,25;1,5;5) lautet x[-5,25;−4,25],y[1,5;3,5],z[3,5;6,5]; `installationProfile.ts:19–27,48–49`. `placement.ts:55–58` fordert Source≤4m und Service≤3m. Gegen **die vorgeschlagene reale Accessface**, nicht das frühere Cargoliteral, ergibt die gespeicherte Quelle:

| Nativeplayer-Punkt als Vorschlag | CenterTop | Abstand zur Sourceface | Abstand zur Service-AABB |
|---|---:|---:|---:|
| (−5,75;2,17;9,0) |1,25m|3,634491m|2,549510m|
| (−5,75;2,17;9,25) |1,25m|3,385192m|2,795085m|
| (−6,25;2,42;9,25) |1,5m|3,461506m|2,926175m|

Die ersten beiden Punkte befinden sich **bereits tatsächlich im gespeicherten Sourcepfad**; die spätere Integratoranfrage erforderte keine weitere Sourceausführung. Ihre konservative0,31-m-Quadrathülle(radius0,3+offset0,01) ist covered, Topmin0,625/max1,5m; jeweils liegt die Hülle höchstens0,25m oberhalb des CenterTop. Das allein garantiert keinen tatsächlich gegangenen Nativeweg oder freien LOS. Der Accessstandpunkt hat dieselbe geprüfte Hülle mit Top1,25..1,5m. **Die ganze neu angefragte1,5×1,0-m-Zugangshülle wurde nicht vollständig geprüft**; keine entsprechende Gesamtflächenbehauptung.

Die letzte begrenzte125-mm-Quellpfadsuche untersuchte786Knoten und1678eindeutige kanonische Spalten. Admission: CenterTop≥0,375m, vollständige Coverage der0,31-m-Hülle, EnvelopeMax−CenterTop≤0,25m, Nachbar-Centerstep≤0,25m; Cutterbody und vorgeschlagene Cargo-Witness-AABB jeweils um0,31m ausgeschlossen. Vorhandenes Profil:`profile.ts:5–7`, Height1,8m, Step0,26m. Gefundene Sourcewege ab dem bestehenden Factory-Start(-4,75;5):

- Zum Buildactor: (−4,75;5)→(−4,875;5)→(−4,875;6,875)→(−6,25;6,875)→(−6,25;9,25),46Rastersteps/5,75m.
- Zum Cargoaccess: (−4,75;5)→(−4,875;5)→(−4,875;6,875)→(−5,75;6,875)→(−5,75;10)→(−5,625;10)→(−5,625;10,5)→(−5,5;10,5)→(−5,5;11,875),65Steps/8,125m. Enthält die beiden angefragten Buildactorpunkte.

Beide Pfade: alle Hüllen known-source-covered, MinimumTop0,375m, MaximumTop1,5m, größter Centerstep0,25m, maximaler Hüllen-Top über Center0,25m. Das ist ein **trockener Sourcegraph-Witness**, kein Rapier-Walk-PASS. Die normale Nativecapsule muss die Stufen tatsächlich durchlaufen; kein Snap/Velocityshortcut. Noch nicht installierte Rohlager/Bänder/Batterie sind nicht als freie Dauerwege angenommen: diese Quellpfade gelten für die erste Cutter-/Cargoaufnahme und müssen für W09s später gebaute Owner neu geprüft werden.

Ein Factory-spezifischer **initialer** Spawn am abgefragten Accessstandpunkt(−5,5;2,42;11,875) wäre eine technische Quellenbindung, keine neue Terrainfläche. SourceTop/Coverage/Hülle sind konkret belegt; **Native-Playeradmission/Overlap/Standzustand NOT_RUN**. Erst nach deren tatsächlicher Prüfung übernehmen; keine spätere Versetzung eines laufenden Players und kein UI-`setSourcePose`.

## Bestehende native Coverage und Clearancegrenzen

`hvpCoastSource.ts:24–32` adressiert x/z[-16,16),y[-8,8),125-mm-Zellen. Standort und Wege liegen vollständig darin; Cargo liegt im vorhandenen4×4-m-Collisionsektor x[-8,−4),z[12,16), rechnerisch Row7/Column2(Index58 der8×8-Primärquelle); die Wege außerdem in den primären Sektoren42/50. **Keine neue Region nötig.** `terrainColliders.ts:26–62` erzeugt canonicalSource-Sektoren; `physics/client.ts:120–126` veröffentlicht Playercoverage erst nach tatsächlichem akzeptiertem Workerergebnis. `hvpBootstrap.ts:1064–1074,1144` übergibt dieselbe Terrainroot und vorhandenes Wood an die private World; `physics/session.ts:104–107` bindet die Playercoverage daran. Hier wurde keine laufende Nativecoverage ausgelesen: die bestehende erfolgreiche Startupadmission ist weiterhin ein Integratorgate.

Gelesene Factory-Vegetation(`presentation/vegetation.ts:14–15,83–94`): west-frame/north-young sind im akzeptierten Profil ausgelassen; verbleibende native Woodquellhüllen liegen konservativ bei hero x[2,14] bzw.east-young x[7,75,16,25] und schneiden diesen Cargo/Sourceweg nicht. Dekoration besitzt `decorationPhysics:"none"`; sichtbare Vegetations-/Panelverdeckung ist nicht per Browser geprüft. Drop/Inertia/Branch-Startanker liegen bei z−9/−13/−13,5, außerhalb dieses Weges. **Liveowner-/Actor-/dekorative Clearance, LOS, Cargoowneranlage und tatsächlicher Zugang bleiben NOT_RUN.** Global-/Facilitycaps und Membership einschließlich initialer Cargo-Witness dürfen nicht ausgelassen werden.

## Quellen, Abfragewerkzeug und reproduzierbare Bindung

- Original FP01 E00:798–814: zugänglicher sicherer Cargo-Sichtanker, seitlicher Zugang, etwa12×8m nutzbarer Wrackbereich, mechanischer Öffnungspfad, stabile IDs/idempotentes Open. SHA256 `ec3e605de2c6a4877c2ff0afae244b3215e7bf8bb267feef4c466b546477080c`.
- Original FP02:785: tatsächlicher Crashcargo außerhalb22×12-m-Maschinenzone. SHA256 `5c4f068edba3d0c89e77b0d3a40734d4ee1a672c39f3885cbfef31430d942f39`.
- Angenommene D07-Proposal im W00-WT: `docs/factory/fp06/proposals/start-site-v1.md`, SHA256 `21a6b5a2e87036639f91c795458b1cb14b7160cef8679fc5df96341beddd47bb`: exakt15Masken70m², Natur außerhalb unverändert, keine zusätzliche Fläche/Gutschrift.

Werkzeug:`functions.exec`→`tools.exec_command`, Interpreter `/workspace/.cloud-setup/toolchain/node_modules/node/bin/node`, **v22.23.3**. CWD `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11/apps/weltraum-browser`; HEAD bei Inspektion `d5502ae7fd5431d58eda51bea062c54691ebe3c2`, W07 **unsealed/dirty**. Node entfernt ausschließlich TypeScripttypen in RAM(`stripTypeScriptTypes`) und löst drei gelesene Puremodule über DataURLs auf; kein tsc/Vite, kein Produktfilewrite, kein Materializer/Solver geladen. Originalfunktionen `readHvpSourceColumnWorld`/`readFactorySourceColumnWorld` unverändert. ExperimentalWarning des Node-Type-Strippers wurde tatsächlich ausgegeben.

Tatsächlich ausgeführte Befehle, jeweils nach `source /workspace/.cloud-setup/activate.sh`, Exit0:

```bash
node /workspace/.cloud-setup/fp06-cargo-s0-source-query.mjs
node /workspace/.cloud-setup/fp06-cargo-s0-near-source-query.mjs
node /workspace/.cloud-setup/fp06-cargo-s0-selected-source-query.mjs
node /workspace/.cloud-setup/fp06-cargo-s0-final-source-query.mjs
node /workspace/.cloud-setup/fp06-cargo-s0-bounded-path-query.mjs
```

Chronologische JSONausgaben jeweils gleicher Stem, erhalten: erste Survey13:11:37.033Z findet südlichen späteren Handlingstart x[-15,−13,5),z[5,6) und[12,13), keine Aussage direkter W07-Cutterreach. Near13:14:47.835Z findet **keinen** trockenen Kandidaten in20nördlichen Rechtecken x≥−0,25/z≈3,5..6,5(Top−1,5..−0,625m), aber12ebene Westkandidaten. Erster falsch gewählter Westkontakt und direkte Kanallinie sind ungeeignet. Selected13:16:13.951Z korrigiert den Kontakt, Actor z9,5 ist jedoch service3,162m/zufern. Final13:17:19.881Z korrigiert Actorreach, handgewählter langer Umweg hat2m-Sourcecliff und wird **nicht** als Gehbeweis verwendet. Letzte bounded-path-Abfrage13:19:00.562Z findet die oben dokumentierten konkreten Pfade, Toolwall**0,06565s**. Alle Quellbyte-Digests waren während jeder Abfrage stabil. Keine weitere Sourceausführung nach13:19UTC; neu gewünschte Punkte nur aus gespeichertem JSON gelesen und Abstände arithmetisch berechnet.

Primäre finale Artefakte:

| Externe Datei | SHA256 |
|---|---|
| `fp06-cargo-s0-bounded-path-query.mjs` |`e64c81185fabcd4b39b339d043976d733250d860d3b000ca36c1f992ef81cd28`|
| `fp06-cargo-s0-bounded-path-query.json` |`408b475005230c907d811932d4fe9ab1d7f412936a0b623d4767accc2d662592`|

Quellen-SHA256 in jeder Abfrage: `startSite.ts`=`53725bbf06af6be92ac1b3b3e250ee6548e37bb6abf8500b4cd50e09b1ec1a29`; `hvpCoastSource.ts`=`13128d7ad3151da644ae909af0dbb0e2df0e91066c01f55ee566f7eedc1fdaca`; `core/hash.ts`=`7514fc507d6c83404462d967ff4736790abf6425842b676cefedc4928a2febee`. Die11gelesenen Source-/Native-/Host-/Profiledateien sind zusätzlich in `/workspace/.cloud-setup/fp06-cargo-s0-inspection-bindings.json` um13:19:42.543581UTC gebunden; kein Snapshot-Seal. Die Root-W07-Arbeit darf die mutable Hostdateien anschließend ändern.

**Enger Umsetzungskandidat, keine Schreibfreigabe:** vorhandene W07-Host-/Bootstrap-/private-Nativesession um ein festes versioniertes Initial-Cargo-Source-/Accessprofil ergänzen, gegebenenfalls `src/factory/fixtures/cargoSite.ts` neu; tatsächlicher Cargo-Worldowner/Pose/Accesspoint an ursprüngliche Resources-Custody binden. Kleine leasegebundene Projektion desselben Accesssegments; keine Rendererinventarliste, freie Spawn-API, generische Sourceposemutation oder versteckte Frachtanlage. Native Source-/Overlap-/Player-/LOS-Gates danach durch den Integrator. Carrier/W09-Handling und vollständiges E00-Artpaket sind nicht Teil dieses Standortpreflights.
