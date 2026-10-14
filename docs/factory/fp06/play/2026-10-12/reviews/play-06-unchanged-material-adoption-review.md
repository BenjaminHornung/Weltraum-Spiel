# PLAY-06: unveränderte Materialadoption

Root implementiert seriell im erhaltenen Integratorbranch
`codex/hestia-fp06-play-candidate-2026-10-12`, Basis
`4ca33091bc104f5098a2a4f2fce9f428b32d3c2a`. Genau zwei Pfade sind durch
`../grants/play-06-unchanged-material-adoption.json` gebunden. Andere Drafts
bleiben erhalten.

## Befund und exakte Änderung

Im tatsächlichen normalen Browserprofil unter
`PLAY-06/20261012T220500Z-root-main-frame/diagnostic/main-thread.cpuprofile`
entfallen 1,092389 gesampelte Sekunden inklusive Unteraufrufen auf
`materialAuthority.adopt`. Dieser Wert überlappt mit dessen Validatoren und
darf nicht zu ihnen addiert werden. Das kurze Profil hat Diagnoseaufwand und
ist kein Performance-Endgate.

Nach dem vollständigen aktuellen/erwarteten Materialbytevergleich darf nur
`candidate === current && isImmutableData(current)` ohne erneuten W02-Probeaufruf
erfolgreich zurückkehren. Der Bytepfad hat dieselben vollständigen W02-Prüfungen
bereits durchgeführt. Die strenge Immutable-Proof schließt mutable Objekte,
Accessor und Proxy aus. Andere Kandidaten, ungültiges aktuelles Material und
veraltete Erwartungen behalten ihre bisherigen Prüfungen und Fehlerpfade.
Kein Receipt, Inventar, Materialrevision oder Worldzustand wird erzeugt.

## Tatsächlich ausgeführte Tests

Evidencebasis relativ zum Browserpaket:
`evidence/factory/play/2026-10-12/PLAY-06/20261012T221000Z-root-adoption-noop/`.

- `01-noop-red`: tatsächlicher Fach-RED, fünf zusätzliche W02-Vorbereitungen
  statt null. Der Kaltstart muss weiterhin validieren. Exit 1,
  Raw-SHA256 `cb11b3791887f8c58c2faee2b201bcfa74e1d3ca221ca46615a802888be2697f`.
- `02-focused-noop-and-guards`: 28 PASS, 12 bewusst gefilterte SKIP,
  3,894415934 Sekunden Befehlsdauer, Exit 0. Raw-SHA256
  `af1fd42152062cb792495dee91c76c681f221e00a847c5daa961dae999d3aa9a`.
- `03-dry-host-regressions`: 98 PASS, ein FAIL (der unveränderte
  5.000-ms-Bandrückstautest, hier 8.249 ms). Alle 59 Hostfälle bestanden.
  Gesamtdauer 93,122312046 Sekunden, Exit 1. Raw-SHA256
  `ead3a40fd00d4d17a228294af113f18044616b4e0c1eb095410ab74bff021aaa`.
- `04-original-build`: ursprünglicher Typecheck und Vitebuild PASS,
  7,887213721 Sekunden, Exit 0. Raw-SHA256
  `39e982176df665f19f39df1fe2d3447c46dfa6f6e6fc76502f9691cbb456cb9b`.
- `05-paired-actual-main-frame`: Diagnose abgeschlossen/Exit 0,
  25,361007904 Sekunden, tatsächlicher Gameplay-/Performancezustand FAIL:
  SimulationHold bei Tick 345. Raw-SHA256
  `dcc49cf6f7b6b8bd24fb78cb8728bc6a763e3108bbba3c6f57e2cdefbfd39184`.
  Gleicher 1-Renderthread-/1280×720-/DPR1-/8-Read-/2-Tastengesten-Profiler.
  Die gesampelte inklusive `adopt`-Zeit sank auf 0,001129 Sekunden;
  Profilspannen unterscheiden sich (5,573071 → 4,476883 gesampelte Sekunden).
  Main-CPU-Median 115,3 → 74,2 ms, aber P95 267,1 → 456,5 ms,
  Frameintervallmedian 266,6 → 499,9 ms. Kein pauschaler Speedup- oder
  FPS-PASS; Holdproblem verbleibt. Keine weitere Produktänderung aus diesen
  Werten abgeleitet.

## Unabhängiger Review

Tatsächlicher ausschließlich lesender Reviewer
`/root/blocked_band_readonly_review`: begrenzter SOURCE REVIEW PASS, kein
Blocker. Source 36.108 Byte, SHA256
`890882e41a8b7aa4f1dc344602b093fbbb3192b195d28c2e1190e4f8572a6710`;
Test 41.413 Byte, SHA256
`793db55ad9d2df803f637c83ce77ada6d39a613850e166bc233bbde1a9609dbd`.
Bestehende Proxy-/Tampertests prüfen überwiegend Drycommit; die Authoritygrenze
wurde zusätzlich anhand der tatsächlichen Sourceprädikate überprüft.

Der unveränderte 55-Tick-Bandtest verwendet diese Authority nicht. Sein
6.563-Byte-Block bleibt SHA256
`ce1fb626500b8b05fcbd255f574f4a0597d1ebd864dab82d74a98dbd64951cd1`.
Die Änderung schließt dessen 5.000-ms-Fehler ausdrücklich nicht. W09, W10,
W11 und menschliche Abnahmen bleiben offen.
