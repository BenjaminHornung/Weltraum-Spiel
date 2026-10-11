# W09 Serviceclock und Native-Supply — enges Closure-Review

2026-10-11, Read-only 22:22:12.209431–22:24:10.149827 UTC. Tatsächlich gelesener Integrator-HEAD `aa2e5d7c335453fc555a98ccd35e9f564c596e93` plus mutable WIP. Keine eigenen Tests, Builds, Browser-/Native-/CPUjobs oder Produktwrites. Vorbericht `fp06-w09-service-hold-followup-review.md` bleibt bytegleich SHA `78adda3f161514f0e57c97f82da0219b40499fa0e7c3c9dd645decbf18713814`. F2 wird nicht erneut geprüft.

**Enger Verdict: Spec/Sourcequalität PASS für First-Clear-Creditgrenze und Admissionverlust eines verbundenen Native-Powerowners.** Kein Gesamt-W09-, Save-, Native-Routen-, Browser- oder Pipeline-PASS. Die folgenden tatsächlichen Unitbelege und gelesenen Guardpfade tragen nur diese Closure.

## First-Clear: letzter Sourcegegenfall geschlossen

108 `first-clear-native-baseline-red`: echte1AssertionFAIL/29skip; erwartetFactorySteps1, tatsächlich2. Start22:21:00.750458, Ende22:21:03.461786 UTC, Wrapper2,711779091s, Raw-SHA `930aeee1cda852bf75e3906db0db1bdcab8cbf8c395bf9d0af116ba10b0e90d5`.109 derselbe fokussierte Fachfall:1PASS/29skip, Start22:21:13.966477, Ende22:21:16.679109 UTC, Wrapper2,713052105s/Vitest2,30s, Raw-SHA `67f888c65b8ee4d0a5eb597144ff28a43bb5753a3fc77fd2e700636f6cf2dfa7`. Jeweils dekomprimierte Rawbytes gegen tatsächliche Commandreceipt-SHA/Bytezahl geprüft.

`factorySession.ts:118` hält vor Neubewertung fest, ob der vorherige Snapshot ein Workhold war. Weiterhin blockierte, korrekt Source/Profile/Terrain/Facility-gebundene Beobachtungen erneuern nur die Nativebaseline (`:123–129`). **Die erste beobachtete Freigabe setzt jetzt selbst dieBaseline und kehrt ohne `advanceDomain` zurück (`:130–132`).** Somit können frühereTicks seit dem letzten blockiertenRead keine Arbeit oder SOC-Debits erzeugen. `:137–143` verarbeitet erst spätere bestätigteTicks mit der bestehenden6Ticks/100ms-Regel. Vorhandenes bestätigtes Remainder/WIP wird erhalten; kein Catch-up des blockierten Intervalls. W04, Native60Hz, Material-/Energiearithmetik, Queues und Timeouts bleiben unverändert.

Aktuelles tatsächliches Orakel `hostLifecycle.test.ts:333–338`:100msWork/8kgWIP vorHold; blockiert12→Inventory/SOC/Work gleich; erstesClear18→Ready, weiterhinFactorySteps1/100ms und gleicherSOC; erst24→FactorySteps2/200ms. Das schließt exakt den vorher gemeldeten Tick12→späteFreigabe17→ClearRead18-Gegenfall. NativeActor/Reparatur bleiben durch den bereits geprüften temporärenWorkhold zugänglich. Die Hostfixture liefert deklarierte Native-Facts; direkte Rapier-Servicequery und echter Browserweg bleiben separate Gates.

## Verbundene Native-Supply: verloreneBestätigung mintet keine Arbeit

106 `native-power-owner-admission-red`: echte1AssertionFAIL/29skip, Ready statt fail-closedRecoveryHold; Wrapper2,653035515s, Raw-SHA `57a44fc4c6e4fbc507ba08e225a48ae736f40fabee03f1fb84ccc2c5dc1994d3`.107 gleicher Fall:1PASS/29skip, Start22:17:18.847648, Ende22:17:21.658005 UTC, Wrapper2,810756339s/Vitest2,39s, Raw-SHA `7c8b07b3611066a8e059af1a713909ec9d3546bf0b32b479c14d576bb05b31ee`. Rawbytes/Receipts geprüft.

`advanceDomain:71–75` prüft **vor** Supplyberechnung und jeder Power-/Materialadoption jeden tatsächlichen Linkendpoint: NativeSocketconfirmed, zugehörige installierteInstance, Profile-/Source-Digest, aktuelleTerrainrevision und Facilityrevision. Fehlende/unbestätigte/mismatchedProofs werfen `NativePowerOwnerUnavailable`. Der beobachtete Bestätigungsverlust wird als Authorityfehler fail-closed behandelt, ohne neue Allokation oder Material-/Jobadoption. `hostLifecycle.test.ts:341–351` startet einen tatsächlich stromallozierten100ms-Job und verliert dann dieNativeBestätigung: RecoveryHold,100msWork, unveränderteSOC und Materialmengen/WIP. NativeSocket-/Membererkennung ist separat97 geprüft; keine vollständige Native-Powerpipeline daraus behauptet.

Der reine `readDryFactorySupply`-Adapter enthält weiterhin logisch erzeugte `confirmed:true`-Metadaten. Der **Runtime-Hostpfad** lässt verbundeneQuellen und Verbraucher erst nach obigem tatsächlichenNativeguard in diesen Adapter.107 schließt genau diesen verbundenen Admissionpfad; damit sind nicht alle unverbundenen Powerassets oder spätereRestorepfade unabhängig verifiziert. D03-Reserveadapter104→105 bleibt zuvor eng geprüft, keine zusätzliche500W-Arbeit.

## Hashbindung und mutable Drift

FactorySession Start `65bff6bf862585bdf0824bcd58b7b0f8533118f9e466d57749b95670cdfa6741` → Ende `dde4c5db13d67f207783e923743bc46f26c91a1f9e734c60869b7c17fc633826`. Beide beschriebenen Guardpfade wurden am Ende erneut gelesen und bleiben dort gleich; übrige mutable UI-/Commandarbeit ist kein Bestandteil dieses engenVerdicts. Kein vollständigerProduct-Seal behauptet.

Start-/Endread identisch: DrySlice `f325126b5c801af24ed3da77b751c7cabff99a583df7481fc5bd6f1c71efa69f`; NativeFacility `1d2222586f92dd7c71530cf8a26c171348ba5edeaf4427cbe8a68ff168ca81ba`; Bootstrap `30055d33d9cf2ee877144ebc1e7a39ea30d7dbb78953fba07572992f43585556`; geschütztesW04 ProductionStep `f74397051a7b2da13d6d183ccf573cb633cb932e915e1ebaf6bf6a50da29c449`, RecipeAdmission `c77eeaa220cbb491c51356533bdd8f1e6d221f67e9406b458d4a6c06ebac4102`. AktuellerHosttest-Endhash `e61032482fcfe95c94c9e2570850e8638b4c0f8fdcdf55d4b8265a8f050509e1`. Build110 ist ausschließlich Integratorarbeit; kein eigenes Buildresultat oder vorausgezogener Gesamtgate-PASS.
