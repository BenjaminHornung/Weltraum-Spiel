# W07 immediate FactoryInput: unabhängiger finaler Delta-Specreview

Reviewer `/root/w00_architecture`; nur Source-, Datei-/Hash- und bereits aufgezeichnete Logreads. Keine Tests/Builds/Browser-/Native-/Profiljobs, Produktwrites, Commit/Branch oder Unteragenten. Historischer siebter Bericht fc8a6f3c… wurde zuvor von Root bytegenau archiviert.

**INPUT_SPEC: FAIL / INPUT_CODE_QUALITY: FAIL wegen F1 unten.** Die zuvor gemeldeten Busy-Read-, SmallACK-, Terrain/Hold-/Jump-/Capguards sind geschlossen; ein weiterer belegter lokaler Preparing-Pfad bleibt offen. Kein Gesamt-W07- oder Browserurteil. Browser-/Paket-/Gitgate: **PENDING**, Reviewer-Runtime: **NOT_RUN**. Keine Ownerentscheidung oder neuer Grant.

## Phase und Bytes

Integrator-WT `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`, Basis `d5502ae7fd5431d58eda51bea062c54691ebe3c2`. Seal `fp06-w07-input-delivery-candidate-product-files.json`: SHA256 `0f9272a18f2f968a8b68fd6735a4c59300b84c07babdad0fa702af6912aa09b7`, erfasst16:50:12.656879UTC. Basispatch237566B/`d347852c0651fbd55ba8c509c2717bbefdcde49787911b8566fc62718a6be385`; Ninthdelta40156B/`e52212c7dd795207321acf4a97858990916150677ef6bf8393d68b56893d92ea`.

Initiale Fünfpfadbytes stimmen; vollständige30-Pfadprüfung16:52:30.078853UTC: **30/30 stimmen**, exakt5 Änderungen gegenüber Ninth/25 unverändert, deklarierte Deltapfadmenge identisch. 30 gewährte Pfade sind **28 tatsächlich geänderte** gegen Basis. Reiner Hashread, kein ausgeführter Verifier/Test.

Abschlussbindung16:55:31.654605UTC: nochmals alle30 Pfade/Bytes und Seal-SHA identisch, null Drift. Spätere Produkt- oder Browserphasen sind hiervon ausgeschlossen.

| Deltapfad relativ zu app | SHA256 | Bytes |
| --- | --- | ---: |
| `src/hestia-prototype/physics/client.ts` | `4b8bfe5766be527c9c71a5312cc80068cb6ac5b157012e24f4349993c71cc0e6` |34808|
| `src/hestia-prototype/physics/physicsWorker.ts` | `776ec49c1c8e180eb02e11d9e5a828087d4b7efd57a65619989c3408276056cb` |16654|
| `src/hestia-prototype/physics/session.ts` | `a08c7d6e2c2efdebd87b22fb64a38b9ce41561203563a321eadbf5737ee8c4e6` |37983|
| `src/hestia-prototype/player/locomotion.ts` | `59957019db4330ff1160851ec10326ee21fa1b8b6c1f372bb895b3af1b3aa89e` |7545|
| `tests/unit/hvp-player-input.test.ts` | `e2fff479910437fdd3fb431dd2fb4b981b4090dc6495e53de786d999a49edf4f` |23107|

## Geschlossene ursprüngliche Guards

Client:209–222 sendet FactoryInput unabhängig busyRead; Factory-Read inputfrei. Worker:78–87 bestätigt jeden FactoryInputpfad ausschließlich mit id beziehungsweise rejected, ohne snapshot/clock/timings/restoreState; Client:182–187 kehrt vor sämtlicher Publikation zurück. Worker:160 ignoriert Read.input zusätzlich im Factorymodus. Verspätete ACK kann Prepared/public/held/restorePhase nicht übernehmen.

Synchrone Anwendung im bestehenden Worker, FIFO, Client-commandDepth:441–445, mutating/bodyPending, Restorebar Worker:125 vor await sowie Disposebar schließen den vorgeschlagenen CrossWorldpfad ohne zusätzliche Generationfence. Keine Retention-/Retryqueue. Native Factoryguard:337–345 prüft wirkliche PrivateSession, Factoryflag/disposed/Walking/Running und native busy/held; neutraler expliziter Cancel wird vor Busyguard zugelassen. Keine Position-/Tickautorität im Input.

Zentraler `holdTick` Session:120–121 neutralisiert Factorylevel und pendingJump. Tatsächliche Neighbor:268, BodyResidency:278/304/316, pinnedCoverage:322, MovingStage:359, Branch:367 und Terrain:409 verwenden ihn. Commit/Rollback/Finalize behalten Wiederanlauf-/Memberregeln; Neutralisierung schreibt weder Pose noch Geschwindigkeit, enabled noch Tick. Locomotion:49–54 bewahrt normalen Up-Jump einmal und löscht ihn bei Cancel; Legacydefault unverändert.

Client:200–210 behält Cap8/20s. Nicht zustellbarer Factoryrelease endet failclosed mit Workerterminate, entfernten Listenern/Pending; keine Latch-, Timing-, Geschwindigkeits-, World-/Budgetänderung. Kurzer DownUp zwischen echten NativeSteps kann weiterhin korrekt null Bewegung ergeben.

## F1: gewöhnlicher Release geht während lokaler Bodycut-Vorbereitung verloren

**Trigger:** Native hat Down angenommen; tatsächlicher gültiger BeginBodyCut beginnt lokale Vorbereitung, Benutzer lässt vor Stage los.

Client:409–415 setzt bodyPending, ohne Nativecancel. Session:353–355 ruft `moving.begin` ohne holdTick. `bodyCutSession:30,48,83` ergibt **busy=true, Preparing, holdsWorld=false**. Session:325 lässt NativeSteps weiterlaufen. Gewöhnliches Up wird Client:383 wegen bodyPending verworfen; direktes neutrales FactoryInput wird Session:344 wegen moving.busy ebenfalls verworfen. Das gesetzte Nativelevel läuft bis späterem Stage/ausdrücklichem Cancel weiter. Legacy konnte in dieser lokalen Phase weiterhin neutrale Read.input übernehmen.

Minimum: Factorylevel/pendingJump beim Eintritt in diese lokale Vorbereitung neutralisieren, oder sicheren gewöhnlichen neutralen Release wirklich zustellen. Keine neue Pause/World-/Legacyregel. Echtes enges Orakel vor Fix: realer zulässiger Movingcontact/Begin bei vorherigem Down; Up während Preparing; sechs NativeSteps vor Stage müssen x unverändert lassen. **Sourcebefund, zusätzlicher Runtime-RED NOT_RUN**; Root sofort informiert.

## Tatsächliche Evidence und Grenzen

OwnRun `evidence/factory/w07/2026-10-11T122211.412749Z`; Rawbytes/SHAs69–75 stimmen Commandreceipts, CWD tatsächliches Integratorapp.69:2AssertionFAIL/14skip;70:4TestsFAIL/16skip (mehrere fachliche Assertions), keine Import-/Setupfehler.71 ist ausdrücklich rekonstruierte unsichere Report-only-Capvariante nach initialem Fix, kein unveränderter Initialruntime-RED.72:21PASS.73:82PASS/1FAIL wegen vor Prepare erfasster Clockidentität, keine Runtimebugbehauptung; aktuelle Fixture erfasst Clock nach Prepare.74:frische5Files/83PASS,4,74sraw/5,126663swrapper;75:TS+VitePASS,4,150740swrapper.

Real-Rapier-Units nutzen echten Trimesh/Coverage/grounded, identische NativeWorld und bestehende60Hz-Steps. NativeTransport ist kontrollierter Transportharness und führt nicht den tatsächlichen physicsWorker-Timer aus. Sein ACK-Negativoracle sendet echten Preparedsnapshot auf falschem Replykind; keine erfundene Pose. Diese Evidence legitimiert kein echtes Browser-, Performance- oder gesamtes W07-PASS.
