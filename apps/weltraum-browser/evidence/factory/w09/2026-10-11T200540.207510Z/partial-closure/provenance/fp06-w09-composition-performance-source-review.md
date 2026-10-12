# W09 Composition: unabhängiger Source-/Profilreview

Read-only Review durch `/root/w00_architecture`; Integrator-Worktree `/workspace/Weltraum-Spiel/.worktrees/fp06-integrator-2026-10-11`, tatsächlicher HEAD `aa2e5d7c335453fc555a98ccd35e9f564c596e93` plus beweglicher W09-Draft. Keine eigenen Tests, Builds, Browser-, Native- oder Profiljobs. Vorhandene JSON-/gzip-Dateien wurden gelesen; ihre Rawbytes und SHA256 wurden geprüft. Kein Paket-/Browser-/Gitgate.

**Performanceziel: FAIL / NOT_MET. Vertragsreview: FAIL bis zur Schließung der aktuell echten REDs 146/147.** F1 ist im nachstehenden engen Nachtrag tatsächlich geschlossen; die historischen Sourcefindings und geschlossenen Input-/Array-Gegenfälle bleiben getrennt gebunden. Kein Gesamt-W09-Verdikt.

## Tatsächliche Messphase

Alle Receipts stammen aus `apps/weltraum-browser/evidence/factory/w09/2026-10-11T200540.207510Z/`. `profile-paid-band-before/goal.json` begrenzt das Ziel auf zwei Kandidaten, ausschließlich `src/factory/session/dryFactorySlice.ts`, unveränderte originale 5000 ms pro Fall sowie die vollständigen 23 beziehungsweise 56 Übergänge und Fachassertions.

| Phase | Tatsächliches Ergebnis | Wrapperzeit | Wesentliche Raw-SHA256 |
|---|---|---:|---|
| 131 unveränderte Baseline | 2 Timeouts, 14 skipped; Fälle 9514/23427 ms | 33,868780 s | `ebe692acc9b6a861660f8bfb4bea5f8cf342fce9414f7db0fd31113eb84360fd` |
| 132 ein unveränderter V8-Profillauf, erster Fall | 1 Timeout, 15 skipped; Fall 9918 ms | 10,915177 s | `5297e5d38572ba4bf4752cbcecd6b838e7af00900b54ba50ccb111f7a4eeb544` |
| 133 Kandidat 1 | 1 PASS, 1 Timeout, 14 skipped; zweiter Fall 9907 ms | 15,295799 s | `bde9d394bfbe41fd5a1ad541396c28d57058ff391e3327acb4752319a3a353b6` |
| 134 Kandidat 2 | 1 PASS, 1 Timeout, 14 skipped; zweiter Fall 5586 ms | 9,310227 s | `a2d73fbe427d9f6c38bac84cb0968ac22cf9b5a13493b8c8c73b6bffb0dce000` |

132 startete tatsächlich `2026-10-11T22:51:11.926413+00:00` und endete `22:51:22.841205+00:00`. V8-Profiling verändert den Aufwand; dessen Fallzeit ist kein unverfälschter Kandidatenvergleich. Kein dritter Performancekandidat, keine Timeoutänderung. Der nachträglich korrigierte Guard-Snapshot wurde noch nicht gegen die beiden Performancefälle gemessen.

## Unabhängige Auswertung vorhandener V8-Samples

Gewichtung: `samples[i]` mit `timeDeltas[i]`; Selfzeit nach Funktion, inklusive Zeit über die Elternkette ohne doppelte Zählung derselben Funktion je Sample. Inklusive Zeiten überlappen und dürfen nicht addiert werden. Profilzeitpunkte sind monotone Mikrosekunden, keine UTC-Uhrzeiten; Vite-Scriptzeilen sind keine verlässlichen physischen TS-Zeilen.

| Profil | Bytes / SHA256 | Profilgrenzen / Samples |
|---|---|---|
| Parent `CPU.20261011.225111.145567.0.001.cpuprofile` | 291089 / `e7bd64d902c6f1601f151d5375dbfa934d6bfc84bf97d7a6bf0426cd826d9fe4` | 50290079624→50300961284; 10881,660 ms; 917 Nodes, 9861 Samples; Deltasumme 10880,618 ms |
| Worker `CPU.20261011.225112.145592.0.001.cpuprofile` | 1433958 / `d45a1ec3288e127167e89a8bbe4bf6826490185436c21c920cd580a5c53e2d90` | 50290399394→50300924039; 10524,645 ms; 4743 Nodes, 9497 Samples; Deltasumme 10524,463 ms |

Parent: 10216,250 ms idle (93,89 %), kein belegter Produkt-Hotspot. Worker-Selfzeiten: `serializeCanonicalJson` 5856,954 ms (55,65 %), `canonicalize` 746,466 ms, `defineCanonicalProperty` 726,824 ms, GC 717,724 ms. Inklusive: `canonicalJson` 7752,547 ms, `prepareDryFactoryStep` 6924,123 ms, `commitDryFactoryStep` 4819,090 ms, `dryStateBytes` 2890,560 ms, `commitFactoryBeltStep` 2411,715 ms, `assertMaterialSnapshots` 2109,693 ms, `assertFactoryBeltState` 1817,083 ms. Dies belegt wiederholte kanonische Verarbeitung im lokalen Unit-Kompositionsfall; keine GPU-, Hardware-, D07-Route- oder Browserursache.

## Sourcevertrag des Kandidaten `363c5b…`

`dryFactorySlice.ts:19–41` verwendet lokale WeakMap/WeakSet-Caches für rekursiv gefrorene Plain-Data-Objekte mit Deskriptorkontrolle, Zyklus-/Prototyp-/Funktions-/Symbol-/Nichtendlichkeitsprüfung. Mutable Daten und Getter werden nicht memoisiert. Arraybytes werden nun indexweise gebildet; eigene `.map`-Properties werden nicht aufgerufen. Primitive, Sparse- und sonstige ausgeschlossene Werte fallen auf den bestehenden Serializer zurück. Vollständige Bytes bleiben erhalten; kein Hash ersetzt Authoritydaten.

`:161–181` prüft weiterhin bestätigten 100000-µs-Intervall, vollständige Bindung/Membership und reale Materialdaten, bevor derselbe W03-Allocator entscheidet. `:188–193` übernimmt ausschließlich den gerade privat erzeugten tief unveränderlichen W04-Preparedvorschlag; W04 hat dessen Zustand, Native-Material und verschachtelte Materialpläne bereits geprüft (`productionStep.ts:322–348`). `:199–203` verkürzt nur einen privat erzeugten W08-Vorschlag ohne Materialplan; W08 prüft beide Custodyzustände (`beltReference.ts:228`). Transfers bleiben im W08/W02-Commitpfad. `:205–211` prüft Masse/Revisionsgrenzen und registriert nur exakt eigene unveränderliche Vorschlagsidentität. `:218–227` prüft erneut reale Inputmaterialdaten und vollständige frische Basis-/Input-/Materialbytes; externe oder veränderte Objekte erhalten erneute Berechnung.

**F1 – externe Outputmaterial-Fälschung bleibt durchgelassen (Sourcegegenfall, eigener Runtimeversuch NOT_RUN).** `commitDryFactoryStep:218` validiert nur `input.material`. Ein gültiger Preparedvorschlag kann extern kopiert werden: ausschließlich `proposal.material` wird mit einer C10-Stackquantity +1 versehen, während Snapshot-`canonicalJson`/Signaturen kopiert bleiben. Kein WeakMaphit; `:227` berechnet aus legitimen Inputs erneut. `:228` vergleicht anschließend lediglich `factoryMaterialBytes(checked.material)` und `factoryMaterialBytes(proposal.material)`. Diese Funktion (`construction/placement.ts:36–37`) liest kopierte Definition-/State-Receiptstrings, nicht tatsächliche Stackdaten. Die Vergleiche bleiben gleich; `:230` gibt das ungeprüfte fremde `proposal.material` zurück. Der eigene interne Shortcut ist gegen diese Kopie geschützt; der externe Fallback ist es noch nicht. Integrator und Root erhielten den exakten Gegenfall für tatsächliches öffentliches RED und engen Fix. 136/137 beweisen nur Inputmaterialschutz und schließen F1 nicht.

## Tatsächliche Vertrags- und Regressionsevidenz

136: zwei echte Assertions FAIL (eigene Array-`.map=null` und tatsächliche C10-Inputquantity +1 bei kopierten Receipts), zwei PASS, 16 skipped; RawSHA `0e7714b636a0cf3661700bfd0285bbf7713a1d22270d343da04edf390e4d5cfe`. 137: vier PASS, 16 skipped, RawSHA `ed55d6dfd43c01779f6a15c63d6cddd9e4bf16b7913ad7e6388677ffaf4710a8`. Mutable `confirmed`, eingefrorener Getter und fremder kopierter Vorschlag werden im tatsächlichen Fachtest geprüft (`dryFactorySlice.test.ts:38–56`).

138: tatsächlich zwei Dateien/38 PASS/3 skipped; die zwei zusätzlich genannten nicht vorhandenen Dateipfade waren keine ausgeführten Regressionen, RawSHA `457ab9055618e97683def54f5651a7a9c0de08daed538ef4bccf7625639cb514`. 139: echte Conveyor-/Materialdateien, 29 PASS, RawSHA `f18142c660b85c5034d2aa7391f23a12f1aa7c0c06c2e89ad53ad4c06eb01e90`. 140: ursprünglicher Build FAIL wegen Test-Fixture-Typen; 141: enger Host-Fixture-Fall PASS; 142 nach Test-Typkorrektur: unveränderter vollständiger TS/Vite-Build PASS, 4,552509 s, RawSHA `a3f37c1651c1464a5e9653cc306a2d148abd7259b11c019a9f77ef8df9f3fca7`. Keine frische Vollsuite-/F1-/Performance-PASS-Behauptung.

## Bytebindung und bewegliche Phase

Reviewbeginn `2026-10-11T22:55:08.890705+00:00`: Dryslice 25338 B / `b54e9b07a020e69bc99a1fb2d4f8681e8354a1ffe788d24bea5b2e07349aa61e`; genau dieser ursprüngliche Profilsource ist im Vorher-Snapshot gebunden. Beobachteter Guardstand `23:01:38.895685+00:00` und erneute Prüfung `23:05:18.031227+00:00`: Dryslice 29703 B / `363c5b53e590154fb903fd1070f98bd17580419d3e977ebf7289f9040ab188e3`. Testdatei driftete legitim vom Guard-Snapshot `806096d491faedea478163ef91813d2142c89cf7f64ed28c7ceac7a183e5cea7` zum typkorrigierten aktuellen `e064b56a60f9e5e2815a1d3510ff862d5ff82f22755eb393cb9f037648107cf6`; neuer F1-Test/Fix kann folgen. Dies ist kein finaler Produkthold.

Geschützte Sourcebytes beim Beginn und erneuten Lesen unverändert: W04 `productionStep.ts` `f74397051a7b2da13d6d183ccf573cb633cb932e915e1ebaf6bf6a50da29c449`, `recipeAdmission.ts` `c77eeaa220cbb491c51356533bdd8f1e6d221f67e9406b458d4a6c06ebac4102`; W03 `factoryPower.ts` `70ddfe44c9a81c6355262bed928ee4d72b410b4b0db2a6c6bf08a36ec71b2825`; W08 `beltReference.ts` `45fb7e4d0bb618a07d215ab923db4521c1bd46203428b49760e5140f402be211`, `beltPorts.ts` `54c2bdd48838f869db887d72b19f4169487070ba194e301340b12179f6a7cfa9`. Weitere gelesene Bindungsquellen: `placement.ts` `9b75688f1ad743246559d0e46c2c423cfd29c584932fdbae7b64c740f9ad75a3`, `factorySession.ts` `a4f5be980449af2983ce9ed4314a9ec0108ef7bbe400d64e63491db3e4e15410`.

## Spätere eng gebundene Phase: F1 geschlossen, weitere echte REDs offen

Der Endhashread `2026-10-11T23:06:51.700783+00:00` erfasste legitimen Writerdrift: Dryslice 29863 B / `2d836d463ef371ee130e48229228e3db40e338b64e9f2b1cbe4dfbb541077fae`, Testdatei 32818 B / `24fd55e665af3ac206791ae194a473043931b9f719a53b65406e8b33da564ac6`. Alle oben genannten W03-/W04-/W08-Hashes blieben unverändert. Der historische F1-Abschnitt bezieht sich ausschließlich auf `363c5b…`.

144 bestätigt F1 mit einem tatsächlichen Assertion-FAIL: fremde Native-OUTPUTquantity wurde `Committed` statt `Rejected`; 25 skipped, RawSHA `0e8a0e9abb58805d5876f0ebde3f0e84b693f770b920cf57bf950f8e1837aede`. 145 nach engem Fix: 23 PASS/3 skipped, 1,726392 s Wrapper, RawSHA `32e6868d142ac969876caa7f201753dc7e23aea7d1c1cad228b5828c38674001`. Aktuelle `dryFactorySlice.ts:218` validiert nun Input **und** Vorschlagsmaterial; `:229` vergleicht zusätzlich deren vollständige `productionMaterialCanonicalJson`-Bytes. F1 Source-/Fokusgate geschlossen, eigener Runtimejob weiterhin NOT_RUN.

146: zwei echte Assertion-FAILs/26 skipped, RawSHA `7983b2a38f19dda1b706ad40067ffb8625b7223a9eca964575017db1055916b3`. Ein fremdes `proposal.state.lastStep.factsBytes` und ein fremdes `proposal.power.nextState.revision` mit kopiertem `canonicalJson` werden noch `Committed`. Konkrete Sources: `dryStateBytes:154` lässt `lastStep` bewusst weg; externer Vergleich `:228–230` prüft keine vollständige gemeinsame Receipt- und Powerpayload. Diese beiden verbindlichen Payload-Gegenfälle sind offen; das entspricht nicht dem geschützten eigenen WeakMap-Vorschlag.

147: zwei echte Assertion-FAILs/28 skipped, RawSHA `ba5ff085543b5fab3d4e63374e558c1030903c14e80b9fc482553ce1b3978ccc`. Im leeren bestätigten Domain werden `material.revision=1,receipts=[]` beziehungsweise eine Reservation mit nicht vorhandenem WIP-Container noch `Prepared`. `productionMaterialCanonicalJson` validiert Native-Snapshots und Quelle, ersetzt aber die bestehenden W02-History-/Reservationprüfungen nicht (`material/reservations.ts:85–110`). Die aktuelle Komposition muss diese Prüfgrenze erhalten; W02 selbst bleibt geschützt. Kein GREEN zu 146/147 zum gebundenen Reviewzeitpunkt beobachtet.

Metadatenkorrektur: 143 beobachtet tatsächlich das aktivierte Node `v22.23.3`, `/workspace/.cloud-setup/toolchain/node_modules/node/bin/node`, npm `10.9.8`, RawSHA `22d839bda25802871268bed7826377d2a5039fecfc29fa1032f945a512b67ed1`. Das historische `goal.json` bezeichnet den Runtime irrtümlich als Node20; es ist keine rückwirkende Versionsbeobachtung jedes alten Laufs. Die aktuelle zweite Fachcase enthält weiterhin `55` Schritte plus einen weiteren Hold plus tatsächliche Freigabe, insgesamt `57` adoptierte Übergänge (`dryFactorySlice.test.ts:163–165`). Der ältere Goaltext „56“ ist kein Nachweis einer Workloadreduktion.

Nächster enger Gategegenstand: tatsächliche 146/147-Vertragsschließung und neue Sourcehashes. Das ausgeschöpfte Zeitbudget bleibt separat NOT_MET; W09-Gesamtgate bleibt offen.
