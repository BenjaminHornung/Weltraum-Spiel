# W07 Ghostfix: finales unabhängiges Spec-/Quality-Nachreview

**Spec PASS; Code Quality PASS für das versiegelte Bootstrap-/Unitdelta. G1 CLOSED.** Kein weiterer konkreter Befund. Tatsächlicher Ninth-Browser, finale Evidence-/Gitbindung und W07-Paketgate bleiben **PENDING**. Keine eigenen Tests, Builds, Browser-/Nativejobs oder Produkt-/Evidenceänderungen. Vorläufiger Report f839… wurde von Root archiviert; historische Eighth-/Inputreviews bleiben unverändert.

Basis `d5502ae7fd5431d58eda51bea062c54691ebe3c2`. Ninth-Seal `fp06-w07-before-ninth-browser-product.patch`: **214847 Bytes**, SHA256 **d7040eba7f26090783c69372b7ae64f077338de060f0abaaaa2387d510bd9184**; `-files.json` SHA256 **5f0588a7a969d185424780bd298fc16c45260874311ef9415cc4da49aa580c12**, erfasst 2026-10-11T15:55:12.557402Z. Unabhängiger initialer Check 15:57:14.533498Z: **29/29 Bytes und Hashes passend**, gegenüber Eighth nur zwei Änderungen, übrige **27 einschließlich normalem E2E unverändert**. Dateipfade relativ `apps/weltraum-browser` im Integrator-WT:

| Datei | Bytes | Final SHA256 |
|---|---:|---|
| `src/hvp/hvpBootstrap.ts` | 165644 | `ab5ec227a525684802affde9236ba1484d1842275b04f80024e41aed59bb9f88` |
| `tests/unit/hvp-bootstrap.test.ts` | 70821 | `012bb4f13bbd0d31fb79b5a8e8b00604da3b0674ef0ba2079862faf2966b5b84` |

**G1-Schließung.** Bootstrap `2188` erzeugt ausschließlich sechs begrenzte interne **`ghost:slot_N`**-IDs. NativeSafeID `/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/` in `src/resources/ids.ts:48–52` verbietet Colon; Presentation-SemanticID in `src/presentation/ids.ts:33–38` erlaubt es. Damit ist jede Ghostslot-ID von **allen** zulässigen paid instanceIds disjunkt. Sowohl Projectionkeys (`factoryAssets.ts:92` via Bootstrap `2201`) als auch private `factoryCosts` (`2248` gegenüber paid `prepareNative`) benutzen diese disjunkten IDs. NativeRequests und echte Paid-/Cargoidentitäten werden nicht umbenannt. Kein Receiver-, Native-, W05-, Material- oder Contractbyte geändert.

**Lifecycle.** Gleichartige Poses `2242–2243` aktualisieren nur die vorhandenen Transformarrays und bestehende Frameprojektion. Kein Meshupload/-remove, Leaseacquire/-release, Native-/Materialcommand. Cancel/Sourcewechsel verwenden echte zuletzt publizierte Artifacts und Leases; Wiederzulassung erhöht ausschließlich die abgeleitete Artifactrevision. W05-Sourcerevision/-Geometrie bleiben gleich. SafeInteger- und Poseprüfung `2244–2246` liegen vor neuer Allocation und Retire; ungültige Source/erschöpfte Revision entfernen keinen bestehenden Ghost. Native-/globale Resourcecaps werden nicht erhöht. Teilstaging-Cleanup bleibt scenegebunden (`2204–2210`), Dispose entfernt Ghost und Paidscenes unabhängig (`2249–2250`). Sourcewechsel-/Failurepfade sind statisch geprüft, kein entsprechendes eigenständiges Laufresultat behauptet.

**Echte Orakel.** Lifecycleunit `543–605` benutzt tatsächlichen `ThreeRenderBackend` und Ledger, ausschließlich GPUdriverstub. Sie prüft exakte aktuelle Pose, keine Pose-Uploads/Removes, konstante Backend-Geometrie-/Materialallocations und Disposals, bounded gleiche Keys trotz wechselnder Request-/Paid-ID, fünf Cancel/Repreviewzyklen mit Artifactrevisionen1–5, unveränderte Sourcehashes, keine Nativecommands und abschließenden echten Receiverdispose. Private Plainleases sind zusätzlich über den ausschließlich transformierenden Codepfad geprüft; Backenddiagnostics allein beweisen nicht alle privaten Leasereferenzen.

Collisionunit `608–645` prüft explizit die weiterhin gültige Paid-ID **`ghost_slot_0`**, tatsächliche finite W02-Resources/Host-CAS, keine Materialänderung durch Ghost, genau einen Native-Preparetransport, erfolgreichen Commit mit unverändertem InstanceId, disjunkte tatsächlich hochgeladene Paid-/Ghostkeys und nach Ghost-Cancel weiterhin sämtliche Paid-Meshes, ohne Receiverreject. Nativecalls/-pose sind hier klar Transportfixtures; **kein zweiter tatsächlicher Rapier-Installnachweis** daraus abgeleitet. Neues Namespace ändert keinen Materialcommand; echte 208-kg-/Gesamtmassen-/C26-Einmal-Orakel in unveränderter `placement.test.ts:35–47` sind Teil der frischen Regression65.

Gelesene Writercommands und dekomprimierte Rawlogs; sämtliche Raw-SHAs und -Bytezahlen passen:

| Phase | Tatsächliches Ergebnis | Vitest / Wrapper |
|---|---|---|
| 59 historisch | echter Receiver-Lifecycle **1 Assertion-FAIL/34 skipped**, Exit1, `RepresentationRemovedAtRevision` | 9,32 s / 9,739485 s |
| 60 historisch | Vor-Colon-Lifecycle **1 PASS/34 skipped**, Exit0 | 9,73 s / 10,117278 s |
| 63 | gültige Paid-ID: echter Host-/Receivercommit **1 Assertion-FAIL/35 skipped**, Exit1, `RevisionContentConflict` | 9,49 s / 9,884511 s |
| 64 final | beide tatsächlichen Receiverfälle **2 PASS/34 skipped**, Exit0 | 17,85 s / 18,211612 s |
| 65 final | Host/Input/Placement/Native **56 PASS**, vier Dateien, Exit0 | 5,40 s / 5,771231 s |
| 66 final | vollständiges TypeScript+Vite **PASS**, Exit0 | Vite1,53 s / 4,153198 s |

Die frühere 91-PASS-Suite61 betrifft Vor-Colon-Bytes und wird **nicht** als frische finale91-PASS-Behauptung übernommen. Kein Performance-/Browser-/W09-/W10-PASS. Finale Hashreprüfung und Berichtsdigest werden separat Root gemeldet.
