# W09 Batterie/Kabel: enger Source- und Evidence-Closure, v1

**SOURCE/CONTRACT/QUALITY/EVIDENCE: PASS für die Änderungen bis Snapshot190.** Kein enger erforderlicher Produktfix gefunden. W09-Paket, Browserbedienung, normaler Laufweg, Vollweltintegration, Art und Performance werden damit nicht freigegeben. Reviewer: `/root/fp06_domain`, ausschließlich lesend; keine Tests, Builds, Browser oder Nativejobs gestartet.

## Konkrete Bytes und zeitliche Bindung

Worktree: `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`; HEAD während Aufnahme unverändert `aa2e5d7c335453fc555a98ccd35e9f564c596e93`, beweglicher WIP, kein Commitnachweis. Aufnahme 2026-10-11T23:56:42.511452Z bis 23:58:36.925251Z. Fünf primäre Dateien ohne Drift. Sieben Abhängigkeiten erstmals am Ende einzeln gehasht, keine erfundene frühere Versiegelung.

Die vier Dateien in `supported-battery-cables-closure-190/source.json` stimmen vollständig mit Snapshot und aktuellem Worktree überein: Entry, cargoHandlingProfile, Cargo- und Facilitytests. HostLifecycle wurde als zusätzliche aktuelle Regressionreferenz gebunden; Snapshot190 listet keinen neuen HostTestpfad.

Vollständige absolute Pfade/Bytezahlen/SHA256:
- Start: `/workspace/.cloud-setup/fp06-w09-battery-cable-closure-start.json`, SHA256 `25bbc274975a54e1f71b011951901f9b9653356f4b0ec4b26d121d381f55d0ee`.
- Ende: `/workspace/.cloud-setup/fp06-w09-battery-cable-closure-end.json`, SHA256 `5099391a3c083600759b2e6f6dc910854ba8923028102541d1a40f088c04dae5`.
- Artifactbeweis: `/workspace/.cloud-setup/fp06-w09-battery-cable-closure-evidence-proof.json`, SHA256 `3882982eab14abbc1ad70b5f0e3eb459edbe187501868aed0b2d2fa1e4852f29`.

## Profile, Menge und Versionsgrenze

Entry verwendet Batterie `[-2250,1500,2500]` mm/q1. Abmessungen, Füße, Service, Yaw und Terrainmasken bleiben unverändert. Socket `[-1750,2500,2500]`; vollständige Fußunion X[-2750,-1750]/Z[1500,3500] liegt in bestehender Sourcefläche. Alter z3000 benötigt Z bis4000 und bleibt der echte negative Gegenfall. Hull/Service entsprechen dem vorausgehenden Sourcebericht; überlappender Distributordefault ist kein gültiger zusätzlicher Dock und keine Voraussetzung dieses direkten Batteriekreislaufs.

Exakt drei neue geschlossene Aliase:

| Ziel | Alias | Bezahlte mm | mg | Verpackungs-mm³ |
|---|---|---:|---:|---:|
| CUT | CABLE7000 | 7000 | 1750000 | 21000000 |
| BELT | CABLE5250 | 5250 | 1312500 | 15750000 |
| FORM | CABLE7500 | 7500 | 1875000 | 22500000 |

Längen entstehen aus aktuellen nativen Socketpositionen: Manhattan, Aufrundung auf250mm. Nur diese Aliase erhalten Sourcepolicyref `fp06-technical-s0-closed-native-socket-cable-jobs-v2`. Historische4750/6500/8000 behalten v1, Mengen und sämtliche profilbildenden Eingaben; die erweiterte globale Aliasliste wird nicht in deren Canonicalpayload aufgenommen. Gemeinsames Transportformatschema bleibt `fp06-handling-s0-v1`; neue IDs/Terms/Refs sind vollständig canonical und digestgebunden. Keine Callergröße; unbekannte Aliase werden nicht zugelassen. Lightbody500×1000×500mm unverändert, Kapazität exakt aus C07-Verpackungsprofil, Masse250mg/mm. Kein Material-, Geologie-, Budget- oder Profilabmessungsfreeze.

## Native-/Hostgrenzen

188 projiziert tatsächliche unveränderte Sourcecolumns begrenzt in Rapier, kontrolliert lückenlos feste Slots und maximal4096Collider; keine synthetische Ebene. Echte feste Owner, Transform/Yaw/Profil/Source/Memberchecks und Footpatch-Rays liefern Support. Sourceabgeleitete Hulls/Service/Sweeps bleiben unverändert. Socketadmission prüft ≤3m und echte Rays gegen aktive Nicht-Sensor-Kollisionen; eigene Zielkörper und Actor sind gezielt ausgenommen, andere Ziel-/Terrainkörper blockieren weiterhin. Die drei positiven Paare plus zwei alte Supportnegative laufen tatsächlich. Observerpositionen sind deklarierte Prüfpositionen, kein physisch gelaufener Spieler.

Hostcommand prüft raw Session/Epoch, aktuelles gesamtes UIbinding einschließlich TerrainSource/Revision, Material/Facility/Net/Handling sowie nach Pause erneut. Portadmission bindet installierten Owner, Source-/Profiledigest, aktuelle Revision und Nativeaccess. Exakte Menge, Sourcecontainerrevision, finite tatsächliche Stackmenge, ganzer deponierter Custodyinhalt und Profiledigest werden erneut geprüft. W02transfer, Material-CAS, Graphrevision und Native-Release werden gemeinsam angenommen; Rollback/RecoveryHold erhalten die Grenze. Historischer identischer Command liefert gespeicherten NoOp, keine zweite C07-Zahlung.

## Tatsächliche Evidence

Run: `apps/weltraum-browser/evidence/factory/w09/2026-10-11T200540.207510Z`. Alle sechs gzip-Dateien dekomprimieren fehlerfrei und stimmen in SHA/Bytezahl mit ihren ursprünglichen Commandreceipts überein; ProofJSON enthält exakte Befehle/CWD/Hashes.

| Phase | Tatsächliches Ergebnis | Wrappersekunden |
|---|---|---:|
|177|2 AssertionFAIL,28skip|9.774355|
|178|2 AssertionFAIL,28skip; Batterie unconfirmed, Ziele confirmed|9.511066|
|187|3 MissingClosedJobs-AssertionFAIL,2 alte SupportnegativePASS,28skip|21.523775|
|188|5PASS,28skip|21.456347|
|189|10PASS,41skip|3.143516|
|190|originales TypeScript/Vitebuild Exit0|4.120357|

189 bezahlt19750mm, hinterlässt20250mm, erhält Gesamtmasse, leert Custody und prüft historische Material-NoOps sowie falsche Mengen/unknownalias. Gemeinsamer Host-/Graph-/NativeReleasefall ist ausdrücklich das historische6500-NativeStub-Orakel; die drei neuen Jobs sind hier pure finite W02-Zahlung. Keine Behauptung eines neuen gemeinsamen Vollwelttransfers. Nativewalk, Browser, vollständige Sourceweltmitgliedschaft und Fresh-CUT→FORM-Gameplay bleiben NOT_RUN in diesem Review. Historische177/178FAILs bleiben erhalten.
