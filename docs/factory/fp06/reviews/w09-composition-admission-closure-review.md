# W09 gemeinsame Admission: enger unabhängiger Nachreview

Reviewer `/root/w00_architecture`, ausschließlich Source-/Hash-/Receiptreads. Keine eigenen Tests, Builds, Browser-, Native- oder Profiljobs. Vorreview unverändert: `/workspace/.cloud-setup/fp06-w09-composition-performance-source-review.md`, SHA256 `aaf8e07301cb1f71a63319a2b0e7cb1fce28ca1e71d9dd7ab82cbace0ff47819`.

**146/147: enger Spec-/Qualitätsabschluss PASS. Aktuelle Gesamt-Sourceentscheidung für diesen Kompositionskandidaten: FAIL wegen des neu konkret belegten Sourcepfads F2, Runtime-RED dazu noch NOT_RUN zum hier gebundenen Readzeitpunkt.** Performanceziel bleibt NOT_MET; kein Gesamt-W09-, Native-, Browser- oder Gitgate.

## Bindung

Startread `2026-10-11T23:08:52.956642+00:00`, Integrator-Worktree `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`, tatsächlicher HEAD `aa2e5d7c335453fc555a98ccd35e9f564c596e93` plus beweglicher W09-Draft. Source `src/factory/session/dryFactorySlice.ts`: 30938 B / `94762ca1cc1139a1c4f2ea596eea88fbd25093431b29e20e79a96d54ccf2d4b6`. Test `tests/unit/factory/dryFactorySlice.test.ts`: 32818 B / `24fd55e665af3ac206791ae194a473043931b9f719a53b65406e8b33da564ac6`. Die bytegenau gelesenen Kopien im OwnRun `joint-admission-guards-148/` stimmen überein; dortiger Snapshotzeitpunkt `23:08:25.444632+00:00`.

Geschützte Bytes unverändert gegenüber dem Vorreview: W02 `material/reservations.ts` `4f5c1d17db3c5167dc42b23e0ab6b0a63f3a9b441684bc5140c367dd7d4d483e`; W04 `productionStep.ts` `f74397051a7b2da13d6d183ccf573cb633cb932e915e1ebaf6bf6a50da29c449`, `recipeAdmission.ts` `c77eeaa220cbb491c51356533bdd8f1e6d221f67e9406b458d4a6c06ebac4102`; W03 `factoryPower.ts` `70ddfe44c9a81c6355262bed928ee4d72b410b4b0db2a6c6bf08a36ec71b2825`; W08 `beltReference.ts` `45fb7e4d0bb618a07d215ab923db4521c1bd46203428b49760e5140f402be211`, `beltPorts.ts` `54c2bdd48838f869db887d72b19f4169487070ba194e301340b12179f6a7cfa9`.

## Tatsächliche Schließung 146/147

OwnRun `apps/weltraum-browser/evidence/factory/w09/2026-10-11T200540.207510Z/`: Rawgzipbytes wurden unabhängig mit Receipts verglichen.

| Lauf | Tatsächlich beobachtet | Raw-SHA256 |
|---|---|---|
| 146 | 2 AssertionFAIL/26 skipped: fremdes gemeinsames `lastStep.factsBytes` und Power-`nextState.revision` noch Committed | `7983b2a38f19dda1b706ad40067ffb8625b7223a9eca964575017db1055916b3` |
| 147 | 2 AssertionFAIL/28 skipped: ungültige W02-Receiptchain/Reservation im leeren Domain noch Prepared | `ba5ff085543b5fab3d4e63374e558c1030903c14e80b9fc482553ce1b3978ccc` |
| 148 | 1 Datei, 27 PASS/3 skipped, Exit0; Start23:07:51.206553Z→End23:07:53.485620Z, Wrapper2,279487 s | `cad53a28f80509e900ef842a45148a31e9c9e06c583e25df760b2d6a6e213033` |
| 149 | vollständiger originaler `tsc -p tsconfig.json && vite build` PASS, Exit0, Wrapper4,116411 s; End23:08:28.035786Z | `c6c3547d9f80bbbb3ca79e80ac96b14cbfa09e48bd30add6f9b0bd68b6a54747` |

`validateDryMaterial:55–65` prüft zuerst die tatsächliche vollständige W04-Materialquelle und anschließend den bestehenden W02-`prepareFactoryMaterialStep` über eine hypothetische, konfliktfreie leere Transfer-ID. Dessen `assertView` validiert die durchgängige Receiptrevision sowie Reservation-/WIP-/Outputkapazität (`reservations.ts:83–112`). Der hypothetische Kandidat samt Receipt wird nie adoptiert. Erst nach **beiden** erfolgreichen Prüfungen und streng lokaler Deep-Immutable-Data-Prüfung wird exakt diese Materialidentität memoisiert. Mutable Kopien, Prototypen, Getter und neue JSON-Identitäten bleiben im Prüfpfad. `prepare:177` und `commit:230` rufen denselben Guard auf, letzterer für Input und Output.

Externe Vorschläge erhalten `:231–234` die vollständige Powerbody-/canonicalJson-/Digestkonsistenzprüfung. Der externe Commit vergleicht `:245–248` vollständige Materialbytes, komplette gemeinsame `lastStep`-Receipt und komplette Powerausgabe mit frischer Berechnung. Replay `:235–238` erhält die aktuelle Autorität und prüft zusätzlich die gemeinsame Receipt vollständig. Der private Shortcut `:221–222,:240–243` bleibt auf exakt selbst erzeugte, vollständig validierte, tief unveränderliche Vorschläge mit identischer Basis-/Materialidentität und frisch verglichenen Inputbytes begrenzt. Kein W04-/W08-Public-Contract wurde verändert.

## F2 – externer Return behält mutable Callerreferenzen (offen)

`commitDryFactoryStep:249` liefert im externen Fallback weiterhin **`proposal.state` und `proposal.material`**. Eine gültige mutable JSONkopie des Vorschlags kann sämtliche vollständigen Vergleiche bestehen. Das Commitresult behält anschließend die Callerreferenz: eine nachträgliche Änderung von `callerCopy.state.power.revision` verändert den angeblich geprüften Resultzustand ohne erneute CAS. Ein wechselnder Getter für `proposal.material` kann entsprechend zwischen Validierungsreads und finalem Return umschalten. Die frisch geprüften Objekte `checked.state`/`checked.material` liegen bereits privat vor. Die bestehenden W04-/W02-Fallbacks liefern diese verifizierten Objekte (`productionStep.ts:379`, `reservations.ts:291`).

Dieser konkrete Sourcegegenfall wurde Root und Integrator für ein tatsächliches öffentliches Dry-Commit-RED und minimalen verified-Return-Fix gemeldet. Keine neue Cache-/Ownerentscheidung oder zusätzliche Performanceiteration folgt daraus. Der private exakt immutable WeakMap-Pfad ist von F2 nicht betroffen. Nach diesem engen Fix genügt ein gezieltes Source-/Byte-/Receiptfollowup; keine pauschale erneute Prüfung.

Endread `2026-10-11T23:11:07.333093+00:00`: Dryslice und Testdatei blieben exakt bei den oben gebundenen `94762ca…`/`24fd55e…`-Hashes. Ein anderes parallel erzeugtes Native-Depot-Receipt150 betrifft diesen Kompositionsabschluss nicht und wurde hier nicht bewertet. Kein späterer F2-GREEN wird vorweggenommen.
