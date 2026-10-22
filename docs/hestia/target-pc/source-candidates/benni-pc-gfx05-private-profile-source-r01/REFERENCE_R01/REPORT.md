# GFX05 CPU-Referenzvergleich R01 — 2026-10-19

**HOLD nach Metadatenfehler; kein Retry, keine Produktadoption.** Derselbe bestehende Hestia A0, App01a13648-c55b-7250-bf07-34921d70b43b, tatsächlicher Turn01a1550d-b890-7163-a557-ef60eafe897b. Genau ein unveränderter Controlleraufruf. Der CPUvergleich selbst endete sauber mit96Ergebnissen/48jeVariante und48paarweise identischen Binding-/Outputdigests. Erst danach scheiterte ein PowerShell-Befehl zur Preservation-Metadatenbeweissicherung beim Parsen: fehlende schließende Klammer im Statementblock, exec chunk59dabc, Zeile9. Der ganze Befehl wurde vor Ausführung verworfen und schrieb nichts. Gemäß strikter Stop-first-error-Regel ist der spätere Auftragsstatus HOLD; REPORT_VALIDATION.json bleibt als vorheriger erfolgreicher Datencheck erhalten. Nach HOLD erfolgten ausschließlich lesende Beweissicherung und Abschluss, kein erneuter Helper-/Nodeaufruf und keine Qualifikationsreparatur.

P = C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Hestia-A0-BenniPC-2026-10-13/.a0-runtime/benni-pc-gfx05-private-profile-source-r01. Neue Belege ausschließlich separat unter P/REFERENCE_R01; alter Sourcefreeze unverändert.

## Einziger Versuch und tatsächlicher Prozessabschluss

App read_thread lieferte startedAt1792428325 =16:45:25UTC. Die frühere unveränderte Rootendzeit ist17:19:55UTC, HelperlatestStart16:49:55UTC, ab17:15:55UTC nur Abschluss. Der tatsächliche Appstart+35Minuten hätte17:20:25UTC ergeben und verlängert die frühere Rootfrist nicht.

PreflightPASS16:46:58, Helperstart16:47:17.2510407UTC, Helperende16:47:21.2568559UTC. Eigene Node-PID77216, HelperprozessExit0, gemessene4016ms einschließlich Bereinigung. RESULT.passed=true/within1560000Ms=true, Terminalsignal, vollständige Streams und tatsächlich geschlossenes Handle; timedOut=false, primaryError=null, cleanupErrors=[]. Ein Worker pro Variante, Varianten seriell TS→Scalar. Originale15sInit-/Jobtimer sowie25MinArbeit/26MinGesamtbudget unverändert. Kein zweiter Helper-/Nodeaufruf. Die bereitgestellte Maximaldauer ist eine Abbruchgrenze und keine behauptete Laufdauer.

Root-Lease byteidentisch/CreateNew vollständig übernommen, SHA2568664d6959a287a0620703d546d39619f5103dabc8ac99c7143837b5bd71758d5. Slot hestia-root-gfx05-reference-r01-20261019-164455; Runner App:01a13648-c55b-7250-bf07-34921d70b43b/Paseo:58fc7970-b84f-485d-8cd0-e577205823e9. Direkte Nutzerbestätigung PCfrei/Spielansichtgeschlossen und exklusiver Rootslot sind gebunden; **USER_LEASE_ATTESTATION**, keine instrumentierte Hintergrundlastfreiheit. CPU-Wert aus angenommener JSON-Provenienz ordinal identisch:47Zeichen/10Endleerzeichen, UTF8-SHA25600f65031a9b6935e85f1aba2a99ce6ff20787f2aa389fcbec353b6f85b4166ab. Nodev22.23.2, keine neue Versions-/Modellabfrage.

## Tatsächliche CPUdaten des beendeten Versuchs

Reportworkloaddigest1d809daa51d65b2971a17ba02d7b895635a730df0802cd64c28ff9241da65b99 aus dem unveränderten Profil bestätigt. Sechs Originalworkloads×warm5/dirty3×zweiVarianten=96Resultate. Alle48TS-/Scalarpaare haben identische Binding- und Outputdigests; vollständige Zuordnung in REPORT_VALIDATION.json. Nicht als96neue Tests zählen.

Alle Zahlen in Millisekunden. Vollpfad = ursprüngliche costs.total + coldInitWallMs/48, einschließlich echter vorhandener Kandidatenvalidierung und Admission. Kernelgewinn allein entscheidet keine Übernahme. Quantile nach ursprünglichem nearest-rank-Verfahren; n5/n3 je Einzelgruppe, daher sind deren P95 die jeweiligen beobachteten Maxima. Ein serieller Lauf, feste Variantenreihenfolge, keine statistische Wiederholungs-/Gegenreihenfolgenbehauptung.

| Variante | Jobs | Vollpfad P50 | Vollpfad P95 | Kernel P50 | Kernel P95 | Cold Init | Cold First Adoption | Init/Job |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| ts | 48 | 34.389 | 102.406 | 3.599 | 20.289 | 34.717 | 135.426 | 0.723 |
| scalar | 48 | 33.363 | 93.816 | 1.331 | 2.688 | 35.470 | 137.766 | 0.739 |

Scalar verbessert den beobachteten aggregierten Vollpfad-P50 um 2.984% und P95 um 8.388%. Ursprüngliche Runnerempfehlung unverändert REQUIRES_DECISION. Der Auftragsstatus bleibt wegen des nachfolgenden Metadatenfehlers HOLD; die Daten rechtfertigen hier keine Produkt-/S2-Übernahme.

| Originalworkload | Zellgröße | Zweck | Phase | n je Variante | TS Vollpfad P50/P95 | Scalar Vollpfad P50/P95 | TS Kernel P50/P95 | Scalar Kernel P50/P95 |
|---|---:|---|---|---:|---:|---:|---:|---:|
| full | 0.125 | render | warm | 5 | 102.406 / 109.076 | 93.816 / 103.034 | 20.289 / 27.215 | 2.540 / 3.018 |
| full | 0.125 | render | dirty | 3 | 78.344 / 87.162 | 79.052 / 83.738 | 11.879 / 15.284 | 2.465 / 2.495 |
| materials | 0.25 | render | warm | 5 | 46.354 / 68.131 | 28.974 / 33.363 | 6.857 / 7.499 | 1.328 / 1.556 |
| materials | 0.25 | render | dirty | 3 | 34.389 / 39.331 | 30.231 / 30.622 | 7.724 / 14.242 | 1.313 / 1.323 |
| seam | 0.125 | render | warm | 5 | 13.582 / 14.730 | 14.921 / 15.941 | 1.147 / 1.971 | 1.037 / 1.189 |
| seam | 0.125 | render | dirty | 3 | 19.593 / 26.803 | 15.134 / 15.442 | 1.159 / 2.094 | 0.977 / 1.287 |
| saved | 0.125 | render | warm | 5 | 37.063 / 63.145 | 42.219 / 47.765 | 3.582 / 5.816 | 1.204 / 1.503 |
| saved | 0.125 | render | dirty | 3 | 29.870 / 33.000 | 56.426 / 58.964 | 2.725 / 3.075 | 1.526 / 1.534 |
| saved | 0.125 | collision | warm | 5 | 16.366 / 32.639 | 12.472 / 17.652 | 2.023 / 3.938 | 1.003 / 1.491 |
| saved | 0.125 | collision | dirty | 3 | 11.503 / 16.231 | 10.055 / 14.095 | 1.243 / 1.812 | 1.269 / 1.432 |
| saved | 0.125 | render-and-collision | warm | 5 | 37.949 / 41.611 | 42.773 / 74.051 | 3.651 / 4.426 | 2.630 / 3.101 |
| saved | 0.125 | render-and-collision | dirty | 3 | 35.802 / 42.093 | 40.260 / 41.658 | 3.581 / 3.599 | 2.179 / 2.256 |

Kopier-/Transfer-/Validierungs-/Adoptionkosten, aggregiert über48Jobs je Variante:

| Vorhandene Kostenstufe | TS P50/P95 | Scalar P50/P95 |
|---|---:|---:|
| inputValidation | 0.361 / 0.625 | 0.316 / 0.724 |
| mainInputValidation | 0.107 / 0.650 | 0.094 / 0.324 |
| inputCopy | 0.075 / 0.726 | 0.099 / 0.741 |
| inputTransfer | 0.075 / 0.438 | 0.061 / 0.371 |
| outputCopy | 0.000 / 0.000 | 0.030 / 0.051 |
| outputValidation | 9.066 / 29.679 | 10.012 / 25.248 |
| outputTransfer | 0.084 / 0.651 | 0.070 / 0.149 |
| consumerValidation | 8.842 / 29.139 | 10.084 / 26.873 |
| adoption | 9.705 / 22.845 | 9.704 / 29.333 |

METRICS_SUMMARY.json enthält diese P50/P95 zusätzlich **für jede der24Originalgruppen** getrennt nach Variante, Workload, Zellgröße, Zweck und Phase. Cold First Adoption existiert tatsächlich nur einmal pro frischem Variantenworker, nicht je Workload; keine weiteren Coldwerte erfunden. Die vorhandenen Stage-Zähler können verschachtelte Messbereiche enthalten und werden nicht zu einer scheinbar unabhängigen Walltime summiert. Vollpfad bleibt die beobachtete Walltime einschließlich amortisiertem Start. Validierung/Admission dominieren gegenüber dem kleinen Kernel; aus einem schnelleren Kernel folgt kein entsprechend großer Vollpfadgewinn.

## Unveränderte Originale und neue Belege

Preflight bestätigte vor dem einzigen Versuch23alteManifestzeilen/26physischeSource-Dateien, zehn private plus zehn Producer-Laufdateien,60historischeBEFORE_BINDINGS,45alteEvidence-Dateien und separat vier oberste Producer-.runtime-Dateien. Node, Controller4456Bytes/SHA256b26fb35094f10a06254f83b2cd4efaedccbd1983f59fb1c8cafaac861f92ffe8, Argumenttemplate und QUALIFIED_INPUTS unverändert. Alle sieben Laufziele und REFERENCE_R01 waren vorher abwesend. Lease erst nach vollständigem Preflight vollständig byteidentisch/CreateNew kopiert. Kein Unterobjekt neu serialisiert.

Lesende Beweissicherung nach HOLD bestätigt alle26/60/4/20konkreten Dateipins ohne Abweichung, dieselbe45erEvidence-Mitgliedschaft und unveränderte vier oberste Producerdateien. Producer-reference-profile.json bleibt abwesend. Eigener TEMP enthält0Einträge, nichts gelöscht. Keine rekursive965Cache-/Gesamtpaketbehauptung. Alle fünf ursprünglichen Prozessrohdateien liegen byteidentisch zusätzlich unter REFERENCE_R01; unverändertes146413Byte-Profil-JSON ebenfalls. Originale SOURCE_MANIFEST_FINAL/FREEZE/APP_TURN_CLOSE wurden nicht überschrieben.

Neue Belege: ACTUAL_TURN.json, PREFLIGHT.json, DISPATCH.json, ROOT_BINDING_DISPATCH.json, ATTEMPT_BEGIN.json, fünf Prozesskopien, reference-profile.json, REPORT_VALIDATION.json, METRICS_SUMMARY.json, HOLD.json, PRESERVATION_AFTER_HOLD.json, Bericht sowie neue Inventar-/Manifest-/Freeze-/separateClose-Dateien. Das neue Manifest bindet nur neue Dateien, konkrete Top-Level-Laufziele und private Runtimeausgabe; alte26 bleiben gesondert erhalten. Selbst-/nachgeordnete Manifest-/Freeze-/Close-Dateien werden ausdrücklich ausgenommen und separat gebunden.

## Grenzen und Abschluss

Keine neuen Tests, Builds, Version-/Modellreads, Produktquellen-/Runner-/Timeränderungen, Kinder, Fremdprozessbeendigungen oder Browser-/Fokusübernahme. ScalarMesherWASM ist ausschließlich als genehmigter CPUvergleich enthalten. M5/Familie/Native24/Rapier/echtePhysik/GPU/Renderer/Browser/Save sowie Produkt-/Defaultadoption NOT_RUN bzw.NO. Keine FPS-/Cut-/physikalischeHeap-/GPUbehauptung; logische Speicher-/WASM-Seitenzähler im Rohreport sind kein physischer Peak.

Freeze ist kein tatsächliches Appende. Start16:45:25UTC und frühere Rootfrist17:19:55UTC gelten unverändert. Eigene APP_TURN_CLOSE.json ist nur der Zeitpunkt vor finaler Rückgabe; den tatsächlichen Hostabschluss muss Root nach final/idle lesen. Status **HOLD**, genau1Helperversuch/0Retry, danach idle ohne automatische Fortsetzung. Nächste Aktion für Root: vorhandenen Bericht und Rohdaten lesen; keine automatische Wiederholung oder Produktübernahme.
