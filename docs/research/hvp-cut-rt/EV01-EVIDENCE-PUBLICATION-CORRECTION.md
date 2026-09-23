# EV01 — Korrektur der veröffentlichten Evidence-Menge

**Ausgang:** Cut-Codecommit `45188b2b90049f496e918b8701a314c883792ce5` (Tree `74cd849977333fa4014501d5b6c34cd1b2fcda50`) auf `feature/hvp-cut-rt-p00`. Sein ursprüngliches `apps/weltraum-browser/evidence/hvp-cut-rt-v2/MANIFEST.json` (Git-Blob `04086869df421ecf9373f18f8f10c5835b1f8755`) deklariert 255 Reportpayloads, aber nur 241 waren im Commit. Ursache: 14 historisch angelegte `.last-run.json`-Statusdateien unter Git-ignorierten `artifacts/` bzw. `playwright-output/` wurden nicht mitgestagt. Der ursprüngliche Commit wird nicht umgeschrieben; diese Lücke bleibt für ihn historisch bestehen.

## Exakt belegte Ergänzung

Jede der folgenden Dateien liegt am ursprünglichen zugehörigen Run-Pfad unter dem externen lokalen Evidenceordner; ihre Änderungszeit lag vor dem Ausgangscommit. Die beim ursprünglichen Run bereits im Manifest festgehaltenen `originalSha256`, `publishedSha256` und `bytes` wurden mit den tatsächlichen Originalbytes **und** der unveränderten task-lokalen Kopie an exakt demselben relativen Zielpfad verglichen. Alle 14 haben `redaction: null`; deshalb gelten die in der Tabelle genannten SHA-256-Werte **identisch als Original- und Published-Hash**. Das JSON wurde gelesen; diese Statusdateien wurden **nicht** durch Testwiederholung, Hashrekonstruktion oder Kopieren eines anderen PASS-Datensatzes erzeugt.

| Relativer Pfad unter `evidence/hvp-cut-rt-v2/` | Bytes | SHA-256 (`originalSha256 = publishedSha256`) |
|---|---:|---|
| `cb01-cold-neighbor-01/artifacts/.last-run.json` | 45 | `91d1c43004802cd49950d78eb11c8fa7d05da8ffffe219a8b13b2f561bc00903` |
| `p00-c2b-browser-01/artifacts/.last-run.json` | 45 | `91d1c43004802cd49950d78eb11c8fa7d05da8ffffe219a8b13b2f561bc00903` |
| `p00-source-cold-01/artifacts/.last-run.json` | 96 | `242f13f04d08706c082f413faca75c5866950058eccd128d6af76393b7ee94fd` |
| `p04-after-corrected-01/artifacts/.last-run.json` | 45 | `91d1c43004802cd49950d78eb11c8fa7d05da8ffffe219a8b13b2f561bc00903` |
| `p04-before-01/artifacts/.last-run.json` | 96 | `d86ef1ddfc2a6315c40c69faf1cb345398ee7554d77d9e7c2a629fe43826c9b0` |
| `p05-browser-01/artifacts/.last-run.json` | 45 | `91d1c43004802cd49950d78eb11c8fa7d05da8ffffe219a8b13b2f561bc00903` |
| `p07-binding-pilot-01/playwright-output/.last-run.json` | 96 | `9610e15c3f8a8ba9a55837e72120077717f526e8e91d4fb48bb29fb5673addac` |
| `p07-diagnostic-matrix-01/playwright-output/.last-run.json` | 45 | `91d1c43004802cd49950d78eb11c8fa7d05da8ffffe219a8b13b2f561bc00903` |
| `p07-play-precondition-diagnostic-03/playwright-output/.last-run.json` | 45 | `91d1c43004802cd49950d78eb11c8fa7d05da8ffffe219a8b13b2f561bc00903` |
| `p07-restore-collision-warm-05/playwright-output/.last-run.json` | 45 | `91d1c43004802cd49950d78eb11c8fa7d05da8ffffe219a8b13b2f561bc00903` |
| `p07-restore-final-browser-01/artifacts/.last-run.json` | 45 | `91d1c43004802cd49950d78eb11c8fa7d05da8ffffe219a8b13b2f561bc00903` |
| `p07-restore-shortkey-warm-04/playwright-output/.last-run.json` | 45 | `91d1c43004802cd49950d78eb11c8fa7d05da8ffffe219a8b13b2f561bc00903` |
| `p07-restore-warm-diagnostic-02/playwright-output/.last-run.json` | 96 | `9610e15c3f8a8ba9a55837e72120077717f526e8e91d4fb48bb29fb5673addac` |
| `p07-restore-warm-pilot-01/playwright-output/.last-run.json` | 96 | `9610e15c3f8a8ba9a55837e72120077717f526e8e91d4fb48bb29fb5673addac` |

Alle **14** Originale sind belegbar und lieferbar: **0** Statuspfade ausgeschlossen, **keine** Manifestzeile entfernt oder angepasst. Endmenge des Folgecommits: **255** manifestierte und tatsächlich versionierte Reportpayloads; `MANIFEST.json` und die vorhandenen 241 Payloads behalten ihre früheren Git-Blob-IDs. Das sind Runstatusmetadaten, nicht 14 zusätzliche gültige Cutversuche. Fehlgeschlagene historische Läufe und ihre Test-IDs bleiben unverändert.

## Prüfgrenze und Freigabe

Gitobjekte des ursprünglichen und des Folgecommits wurden auf sichere eindeutige Manifestpfade, vollständige Payloadmenge einschließlich Punktdateien, tatsächliche Gitbytes, Länge, SHA-256, JSON-Parsing und erlaubtes Dateidelta geprüft. Für die nachgetragenen Statusbytes wurde zusätzlich ein enger Inhaltsscan auf private Schlüssel, Token/Authorization und Nutzerpfade durchgeführt; eine allgemeine Datenschutzfreigabe des übrigen alten Evidencebestands folgt daraus **nicht**. Die vollständige originale Redaktionsprovenienz der 21 bestehenden `process.json` wird durch EV01 nicht neu attestiert. Originaler Manifestdefekt und diese Korrektur sind getrennte Zeitstände.

**Nicht geändert oder erneut ausgeführt:** Produkt-/Test-/Config-/Lock-/Build-/Runtimebytes, Goldens und historischer Source-/Buildinventare. Der ignorierte historische Build und die externe Testkonfiguration werden nicht nachpubliziert und sind auf GitHub allein weiterhin nicht vollständig rekonstruierbar. Der vorherige funktionale 14/14-Diagnosebericht bleibt n=1 je Klasse/Temperatur, keine formale p95- oder Visual-Owner-Abnahme. Ein unabhängiger externer Code-/Evidence-Reviewer wurde nicht von EV01 gestartet; R00 und R01 bleiben außerhalb dieser Evidencekorrektur. Ein gesonderter Folgecommit veröffentlicht diese Korrektur, ohne den Ausgangscommit zu amendieren.
