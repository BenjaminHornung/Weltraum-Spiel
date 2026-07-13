# Design

## Research Method

Jedes Projekt wird an einem unveraenderlichen Commit-SHA untersucht. Der Audit
erfasst URL, SHA, Commit-Datum, Branch/Tag, Lizenzpfad, untersuchte Source-Pfade
sowie Build-, Test-, Demo- und Browserstatus. Materielle Aussagen erhalten
genau eine der vorgegebenen Klassen: `README Claim`, `Code Evidence`,
`Test Evidence`, `Benchmark Evidence`, `Observed Demo Evidence` oder
`Inference`.

## Evaluation Model

Die Projektmatrix bewertet Problem Fit, Architecture Fit, Browser Fit,
Determinism, Testability, Performance Evidence, License Fit, Integration Cost,
Maturity und Main Risks. Das Abschlussurteil ist auf die sechs vorgegebenen
Kategorien begrenzt.

## Architecture Lens

Die lokale Browser-Mainline bleibt die Zielarchitektur:

- langlebige Weltwahrheit als Daten,
- explizite Game-/World-/Server-Authority,
- Renderer und UI als Snapshot-Konsumenten,
- Worker-Nachrichten mit Revisionen und begrenztem Ownership,
- orbitaler Kern getrennt von lokaler Surface-/Voxelphysik.

Fremde Implementierungen werden daher als Muster, Adapterkandidaten oder
isolierte Wiederverwendung bewertet, nicht als neue Produktbasis.

## Evidence Boundaries

- Eine sichtbare Demo beweist nur sichtbares Verhalten.
- README-Aussagen beweisen keine interne Architektur.
- Vorhandene Tests oder Benchmarks beweisen nur ihren konkreten Scope; nicht
  ausgefuehrte Suites werden als `NOT RUN` ausgewiesen.
- Lizenz- und Provenance-Risiken werden getrennt fuer Konzeptuebernahme und
  Source-Reuse bewertet.

## Verification Strategy

- Git-Provenance und Source-Pfade in temporaeren externen Klonen pruefen.
- Package-Skripte, Hooks und Cargo-`build.rs` vor jeder Buildentscheidung lesen.
- Vorhandene Browserdemos mit echtem Browser, Console und Network pruefen.
- `specs_validate`, Task-Preflights und Task-Toggles nur ausfuehren, wenn der
  DevToolbox-Path-Guard den isolierten Worktree akzeptiert.
- Abschliessend `git diff --check`, Allowlist-Pruefung und Diff-Review.
