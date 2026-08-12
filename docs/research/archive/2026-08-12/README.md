# Weltraum Research- und Prototyp-Archiv – 2026-08-12

Dieses Verzeichnis archiviert die Cloud-Research-Berichte und die isolierten
P01–P05-Browserprototypen des Weltraum-Projekts.

## Status und Grenze

- Archivbranch; **keine Produktintegration**.
- Keine Änderung an der Runtime unter `apps/weltraum-browser/src/**`.
- P01–P05 bleiben UX-/Contract-Prototypen mit Mock-/Fixture-Daten.
- Research-Berichte bleiben `PROPOSED`, `REQUIRES_SPIKE` oder
  `REQUIRES_OWNER_DECISION`, soweit kein späteres Decision-Log etwas anderes
  festlegt.
- G03 und G04 werden erst dann als final kanonisch behandelt, wenn ihre
  aktuell laufenden Agentenläufe vom Owner ausdrücklich abgeschlossen wurden.

## Verzeichnis

- `reports/`: vorhandene G-, BR-, C-, R-/WP- und Projektgedächtnis-Berichte.
- `prototypes/packages/`: source-only ZIPs von P01–P05.
- `prototypes/screenshots/`: repräsentative Bilder für direkte GitHub-Vorschau.
- `manifests/archive-manifest.json`: SHA-256, Größen, Herkunft und Ausschlüsse.
- `PROTOTYPE_INTAKE_REVIEW.md`: erste projektweite Einordnung der Prototypen.

## Bewusste Ausschlüsse aus den Prototype-ZIPs

Generierte `dist`-/`.next`-/`.vinext`-/Cache-Verzeichnisse, Testreports,
`node_modules`, `*.tsbuildinfo` und eingebettete Fontdateien wurden nicht in die
Git-Archive übernommen. Quellcode, Lockfiles, Tests, Dokumentation, Fixtures und
vorhandene Screenshots bleiben enthalten.

## GitHub persistence state

A non-merged archive branch was created. Text metadata can be committed through
the GitHub connector. The prepared binary ZIP/PNG corpus is completed by the
local-git handoff in `BINARY_UPLOAD_HANDOFF.md`; hashes remain authoritative in
`manifests/archive-manifest.json`.
