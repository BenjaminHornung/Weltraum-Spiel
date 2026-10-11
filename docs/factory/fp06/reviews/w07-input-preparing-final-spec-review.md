# W07 F1 Preparing: unabhängiger finaler Delta-Spec-/Qualitätsreview

**SPEC: PASS. CODE_QUALITY: PASS. F1: CLOSED.** Dieses Urteil betrifft ausschließlich die Preparing-Korrektur samt erhaltenen Inputguards. Kein Browser-, Performance-, Gesamt-W07-, Paket- oder Gitgate-PASS. Keine Ownerentscheidung/Grant.

Read-only Reviewer `/root/w00_architecture`; keine Tests/Builds/Browser-/Native-/Profiljobs, Produktwrites oder Unteragenten. Historischer FAILbericht `8e4314c5…` wurde von Root als Candidatephase erhalten.

## Bytebindung

Integrator-WT `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`; Basis `d5502ae7fd5431d58eda51bea062c54691ebe3c2`. Finalseal `fp06-w07-input-delivery-preparing-final-product-files.json`: **SHA256 b516b07c5502fe559ea89d530d912c76e3d2d69b0a840e5a466fe06cbab850b2**, erfasst17:02:33.072722UTC. Basispatch241228Bytes/**2bf5e1f0dcf225085c1f6d41b05760b4c643eab87a87e9a9faa42b3fe4964a4b**.

Tatsächliche Initialbindung17:03:03.643956UTC: **alle30 Pfade/Bytes stimmen; exakt2 Änderungen gegenüber Candidate0f927…;28 andere unverändert**. Damit bleiben Client/Worker/Locomotion und alle früher geprüften Host-/Source-/Native-/Ghostpfade bytegleich.30 gewährte,28 tatsächlich geänderte Pfade gegenüber Basis.

Abschlussbindung17:03:46.146374UTC: nochmals30/30 tatsächliche Pfade/Bytes und Seal-SHA identisch; null Drift. Spätere Browser-/Produktphasen sind ausgeschlossen.

| Enger Deltapfad relativ zur app | SHA256 | Bytes |
| --- | --- | ---: |
| `src/hestia-prototype/physics/session.ts` | `3bd432ac5618a6b30b1b5248c9ae0711bd7e722fd6b079189ae623f62c6973a4` |38047|
| `tests/unit/hvp-player-input.test.ts` | `fbc9380f96223d9c6345fae2df1c11a5f278c9bc6a6704e2f948162594cbd931` |26308|

## F1-Schließung und erhaltene Grenzen

Session:353–356 ruft zuerst tatsächliches `moving.begin` erfolgreich auf, neutralisiert dann über bestehenden `neutralizeFactoryInput` und gibt dieselbe Preparation zurück. Kein await dazwischen; fehlgeschlagener Begin erreicht die Neutralisierung nicht. Helfer:120 wirkt ausschließlich für live Factorymode; Locomotion:31/49–54 leert nur Inputlevel/pendingJump.

Preparing bleibt Running/holdsWorld=false; keine neue Tickpause. Pose, Velocity, Enabled, native Handles/Members und ursprünglicher Bodycut-Payload-/Rollbackpfad werden durch die Zusatzoperation nicht verändert. Legacy erhält einen NoOp. Alte Down-/Jumpabsicht ist schon beim erfolgreichen Eintritt gelöscht; gewöhnlicher Up darf daher weiterhin in Preparing verworfen werden, ohne Bewegung nachwirken zu lassen.

Die fünf vorher geprüften Guards bleiben erhalten: unabhängiges inputfreies FactoryRead; auf allen Pfaden snapshot-/clock-/restorefreie SmallACK; FIFO plus Command-/Restore-/Disposebarrieren; zentral neutralisierte echte Nativeholds und tatsächlicher Nativeguard; OrdinaryJump/Cancel einmal, Legacydefault sowie Cap8/20s/failclosed unverändert. Keine neue Generationfence, Pose-/Clockautorität oder Inputlatch.

## Tatsächliche RED/GREEN-Evidence

OwnRun `evidence/factory/w07/2026-10-11T122211.412749Z`. Command-CWD echte Integratorapp; sämtliche77–80 Rawbytes/SHA256/Exitreceipts eigenständig als Dateien geprüft.

77: **2 TestsFAIL/22skip,4 Assertionfehler** vor Fix; Native UND Client zeigen nach gültigem realem Movingcontact weiterhin0,300000012m und einen alten Jump.78: **2PASS/22skip**,1,93sraw/2,298241swrapper.79: **frische6Dateien/89PASS**,18,68sraw/19,068374swrapper, darunter Input24 und ursprüngliche Moving4.80: **TS+VitePASS**,4,285461swrapper.

Unit:177–209 legt ausdrücklich synthetischen mechanischen Kontakt über bestehende125mm-Terrainfragment-/Nativeinstalltransaktion an. Echter sourcegebundener Digest/Ownerkontakt und Preparing-Receipt; kein erfundener Grounded-/Posezustand. Beide Grenzen bestätigen unveränderte Eintrittsticks/-pose und nach sechs echten60Hz-Steps weder X-Nachlauf noch alten Jump; echter Rollback endet Idle. Dieser Transportharness beweist keinen realen Browser-Workerlauf und keinen bezahlten Factorygameplaykreis.
