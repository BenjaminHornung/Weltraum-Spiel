# PLAY-06: Wiederverwendung des validierten Quellenkatalogs

Root, serieller Integrator, vorhandener Branch
`codex/hestia-fp06-play-candidate-2026-10-12`, Basis
`4ca33091bc104f5098a2a4f2fce9f428b32d3c2a`. Exakt zwei Pfade:
`sourceAdapter.ts` und `power.test.ts`, Grant
`../grants/play-06-source-catalog-cache.json`.

## Grenze

Die Quellenprüfung las bisher denselben vollständigen Katalog bei jedem
bestätigten 100-ms-Schritt neu ein. Eine private WeakMap hält jetzt pro
Katalogobjekt genau ein bereits durch den unveränderten Loader vollständig
validiertes, tief eingefrorenes Ergebnis. Jeder Aufruf liest die aktuellen
rohen Katalogbytes genau einmal. Nur identische Strings erlauben die
Wiederverwendung; nicht normalisierte, aber gültige JSON-Strings bleiben
eigene Eingaben. Aktueller Digest und Snapshotdigest werden weiter frisch
geprüft. Nicht-String-Eingaben behalten den ursprünglichen Parsepfad.

Die Rekonstruktion und Prüfung aller aktuellen Resources-Container,
Mengen, Signaturen, endlichen Seriennummern, Owner, Ports, Beobachtungen,
Intervalle und Ausgabebytes ist unverändert. Kein Ressourcen-, Energie-,
Recipe-, Save-, World- oder Zeitcache wurde eingeführt.

## Tatsächliche Evidence

Browserpaket: `evidence/factory/play/2026-10-12/PLAY-06/20261012T222600Z-root-source-catalog/`.

| Lauf | Ergebnis | Raw-SHA256 |
| --- | --- | --- |
| 01 | FAIL; drei unnötige Loaderaufrufe; zusätzlicher Test erwartete Bytesfehler, wurde aber schon am MaxQuantity-Gate abgewiesen | `d475e067aeb711ab768bfa24ab34fc8223afb944e86db119278626d7c2d7f6b1` |
| 02 | korrigierte Stahlmengenfixture: echter RED mit drei unnötigen Loaderaufrufen, zwei Schutzfälle PASS | `e43b820f0e6342910a7ea884415e2ab14662b9cca2938ab4913ef13177667395` |
| 03 | erste Implementierung: 26 Powerfälle PASS | `c183f2677915f3bff6aafb9d038979ce2a1313e49a5a0700e9e675e930aeafc9` |
| 04 | neuer Nicht-String-Fach-RED: unbeabsichtigter TypeError statt ursprünglichem SyntaxError; exakter Cacheguard korrigiert | `959f42309e2356b3419dd952fb0b3e740a8bc0686e5f6a8d9579103bf2a340ef` |
| 05 | alle 27 Powerfälle PASS, 2,114845976 s, Exit 0 | `63d044fd588b84ffc1f5656a50ee78036cbbf1641190477dba2b51385a52fbe4` |
| 06 | serielle vollständige Drysuite: 39 PASS, ursprünglicher 5.000-ms-Bandfall FAIL mit 6.809 ms; 16,011794411 s, Exit 1 | `96dfc34118787635f326263ff3578a22e4efa349257488b02d9507fc77dd5352` |
| 07 | ursprünglicher Typecheck und Vitebuild PASS, 6,349029845 s, Exit 0 | `26d5ca4282ac9acbdc652fb48afc426a03c91b5dd6de55d5b9e22c7ff49425fe` |

Alle Fehlversuche bleiben erhalten. Der ältere gemeinsame Dry-/Hostlauf
war kein serieller Vergleich; daraus wird kein Speedup abgeleitet.

## Unabhängiger Review

Tatsächlicher ausschließlich lesender Reviewer
`/root/blocked_band_readonly_review`: begrenzter SOURCE REVIEW PASS ohne
Blocker. Er hat die RED-/GREEN-Rawhashes und beide aktuellen Bindungen
selbst gelesen und verglichen, keine Tests ausgeführt und keine Datei
geschrieben.

- Source: 9.207 Byte, SHA256
  `a88c027d0ac4729b30534cbde1801ccd5d8144ed8627b0340a9fe15c7585612d`.
- Test: 27.786 Byte, SHA256
  `201b1556faa42bb4d8947aebc6dc44806732cfe479f508a09df8e2b40034e104`.

Dies ist eine bestandene Funktions-/Schutzgrenze. Der Bandtimeout,
Browserholds, vollständige W09-Kreis, W10, W11 und menschliche Abnahmen
bleiben getrennt offen. Kein vollständiger Performance-PASS.
