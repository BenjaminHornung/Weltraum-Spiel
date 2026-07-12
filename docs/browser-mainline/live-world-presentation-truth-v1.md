# Browser Live World Presentation Truth v1

## Zielzustand

Die normale Browser-Route `/` projiziert ihre räumliche Darstellung ausschließlich
aus `TelemetrySnapshot.navigationMap`. Das betrifft Schiff, ausgewähltes Ziel,
kanonische Route, Hindernisse sowie die vierzehn residenten Low-Poly-World-Entities.
Raw Telemetry ergänzt nur Bewegung und Autopilot-Lifecycle-Metadaten.

Der Renderer besitzt keine zweite World Truth. Die sechs Basisasteroiden sind
`Ambient`-World-Entities, die acht Gates und Beacons sind `Landmark`-World-Entities.
Nur Sternfeld, ferner Planet und der Cinematic-Belt mit 150 Asteroiden bleiben
render-only, radar-unsichtbar und kollisionsirrelevant.

## Runtime-Vertrag

- `buildWorldPresentationSnapshot` verlangt `telemetry.navigationMap`; fehlende Map
  oder widersprüchliche sichtbare/blockierte Route führen zum Abbruch.
- `absoluteFrameId` ist die semantische Frame-ID. Floating-Origin-Frame und
  `renderFrameRevision` verändern die World-Presentation-Signatur nicht.
- Die vierzehn Instanzslots werden über exakte Entity-IDs gebunden. Fehlende oder
  `Culled` Entities werden nullskaliert; Scale und Rotation bleiben deterministisch.
- Normale Canvas-Attribute veröffentlichen nur Zustände und Counts. Vollständige
  Target-, Route-, Segment-, Entity-, Provenance- und Signaturwerte sind über den
  query-gated `/?testBridge=1`-Pfad prüfbar.
- Preview und Engage erhalten den exakt sichtbar bestätigten PlanHash; Planner- und
  Executor-Core bleiben unverändert.

## Automatischer Nachweis

Der Test
`apps/weltraum-browser/tests/e2e/live-world-presentation-truth.spec.ts` prüft in
einem Lauf beide Oberflächen:

1. Normal `/`: kein TestBridge, sichtbares Ziel und kanonische Route, Map-Entity-,
   Residency-, Hindernis- und Dekorations-Counts sowie
   `rendererOwnsWorldTruth=false`.
2. Sichtbarer Planner-Flow: Target-Auswahl, Preview und Engage behalten denselben
   PlanHash; der gelockte Planner zeigt weiterhin exakt diesen Hash.
3. `/?testBridge=1`: Target-Position, Route-Segmentordnung und -geometrie,
   Entity-IDs/Positionen/Chunks/Residence/LOD/Rollen, World-Provenance und beide
   Signaturen entsprechen dem NavigationMap-Snapshot.
4. Mehrere Renderframes bei unverändertem Zustand erhöhen die Renderrevision,
   verändern aber weder Map- noch World-Presentation-Signatur.

Ausführen:

```text
cd apps/weltraum-browser
npm run test:e2e -- tests/e2e/live-world-presentation-truth.spec.ts
```

## Evidence

- `apps/weltraum-browser/evidence/browser-live-world-presentation-truth-v1-summary.json`
- `apps/weltraum-browser/evidence/browser-live-world-presentation-truth-v1.md`
- `apps/weltraum-browser/evidence/live-world-preview-route.png`
- `apps/weltraum-browser/evidence/live-world-locked-route.png`
- `apps/weltraum-browser/evidence/live-world-obstacle-proxies.png`

Die bekannte Vite-Warnung für den mehr als 500 kB großen Hauptchunk bleibt
dokumentiert. Code-Splitting und Package-Konfiguration liegen ausdrücklich
außerhalb dieses Changes.
