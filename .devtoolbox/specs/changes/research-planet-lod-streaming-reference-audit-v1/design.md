# Design: Planet LOD Streaming Reference Audit v1

## Research-Methode

1. Repositories werden ausschließlich außerhalb von Weltraum-Spiel unter `C:\\tmp` geklont.
2. Jede Quelle wird auf einen exakten Commit gepinnt; Commit-Datum, Branch/Tag, Lizenzpfad und untersuchte Source-Pfade werden protokolliert.
3. README-Aussagen werden von Code-, Test-, Benchmark- und beobachteter Demo-Evidenz getrennt.
4. Builds werden nur nach Prüfung der Package-Scripts, Install-Hooks und gegebenenfalls `build.rs` gestartet. Nicht sicher prüfbare oder unverhältnismäßig teure Builds bleiben `NOT RUN` mit Begründung.
5. Existierende Browserdemos werden in einem echten Browser auf sichtbare Funktion, Console und Network geprüft; Screenshots bleiben temporär außerhalb des Repositories.

## Synthesegrenzen

- Durable Simulation Authority bleibt von Renderer-, Tile- und Scene-State getrennt.
- Planet Shell, Surface Region und Microvoxel-Edit-Layer sind getrennte Repräsentationen mit expliziten Handoffs.
- Visuelle Kontinuität ist kein Nachweis simulativer Kontinuität.
- Externe Scheduler oder Renderer werden nur über Adaptergrenzen bewertet.
- Marketingbegriffe werden ohne passende Evidenz nicht übernommen.

## Bewertungslogik

Jedes Projekt erhält die Felder Problem Fit, Architecture Fit, Browser Fit, Determinism, Testability, Performance Evidence, License Fit, Integration Cost, Maturity und Main Risks sowie genau eines der geforderten Abschlussurteile.

## Safe Stop

Bei fehlender Lizenz, nicht verifizierbarem kanonischem Repository, unbekannten Install-Scripts, credentialpflichtiger Demo oder blockierendem DevToolbox-Preflight wird nichts erzwungen. Der Status und die Einschränkung werden dokumentiert.
