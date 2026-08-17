# Voxel-Lab und sichtbarer Fortschritt

**Stand:** 2026-08-17  
**Dokumentstatus:** `COORDINATION_SNAPSHOT`  
**Zweck:** Grober Fahrplan nach dem BR01-Finalreview, keine neue Architektur- oder Integrationsentscheidung.

Dieses Dokument liegt absichtlich im Repository `Weltraum-Spiel`, weil der aktive Desktop-Write-Agent derzeit exklusiv im Repository `hestia-voxel-kernel-lab` arbeitet. Es verändert keinen Voxel-Lab-Branch und darf Remote-Commits, akzeptierte Reviews oder Integrationsberichte nicht überstimmen.

## 1. Aktueller Stand

```text
WP01 Visible Faces                         integriert
WP02 Large Fixture World                   integriert
WP03 Greedy Meshing                        integriert
WP04 Block AO und Palette                  integriert
Voxel-Lab Integrations-Head                c64aeef1f51dd0ed2d8431411cf3ba1e84195b9d

BR01 Contracts und Provenienz              im finalen Fix-Loop
BR01 Arbeitsbranch Remote-Head             78d8a7ca8e52f444988ee790953febf8f8e0223c
BR01 Integration                           noch nicht erfolgt
BR02, BR03, BR04                            noch nicht begonnen
WP05 Worker und Scheduler                  noch nicht begonnen
```

Der Desktop-Agent bearbeitet aktuell die drei letzten Reviewpunkte:

1. Candidate-Sourcepfade müssen an den verifizierten aktuellen Git-Commit und Git-Tree gebunden werden.
2. Sample-Reachability und Measurement-Eligibility müssen für Warmup, Trace und Leak getrennt werden.
3. Die globale Änderung an `vitest.config.ts` muss entweder entfallen oder ausdrücklich als notwendige Scope-Ausnahme belegt werden.

## 2. Serielle technische Route

Jedes Paket folgt grundsätzlich demselben Muster:

```text
Implementierung
→ unabhängiger Review
→ enger Fix-Loop
→ ACCEPT
→ Fast-Forward-Integration
→ frische Integrationsverifikation
→ nächstes Paket
```

### Phase A, BR01 abschließen

```text
Desktop-Fix
→ finaler unabhängiger Review
→ bei Bedarf weiterer enger Fix
→ BR01 ACCEPT
→ --ff-only Integration in integration/voxel-kernel-lab-v1
```

Ergebnis: stabile Contracts, Provenienz, Schemata, Registry und Validierungsgrundlage. Dies ist wichtig, aber praktisch nicht als neues Gameplay sichtbar.

### Phase B, Benchmarkpfad BR02 bis BR04

```text
BR02 In-Browser-Telemetrie
→ BR03 Playwright/CDP Benchmark Runner
→ BR04 Aggregator und neutrale Berichte
```

Ergebnis: Rohtelemetrie, reproduzierbare Browserläufe, Provenienz, Auswertungen und belastbare Vergleichbarkeit. Sichtbar sind vor allem Entwicklerartefakte, Exporte und Berichte, noch kein neues Spielverhalten.

### Phase C, wieder interaktive Voxelarbeit

```text
WP05 Worker und Scheduler
→ WP06 DDA Picking
→ WP07 Single-Voxel Edits
→ WP08 Brush und Stress Edits
```

Erwartete sichtbare Meilensteine:

| Paket | Was man tatsächlich sieht |
|---|---|
| WP05 | Meshing und Adoption laufen responsiver; sichtbarer Unterschied vor allem bei Interaktion und Last. |
| WP06 | Erstmals klar sichtbares Zell-Picking, Hover oder Trefferanzeige im Voxel-Lab. |
| WP07 | Erstmals direktes Hinzufügen oder Entfernen einzelner Voxels. Das ist der erste eindeutig spielähnliche Fortschritt. |
| WP08 | Größere Brush-Edits, Stress-Änderungen und deutlich sichtbarere Bau- oder Zerstörungsabläufe. |

### Phase D, Skalierung und Technologieentscheidung

```text
WP09 32³ gegen 64³
→ WP10 Raw WebGPU Single Volume
→ WP11 Raw WebGPU Fixtures und Edits
→ WP12 Technology Decision
```

Ergebnis: belastbare Entscheidung über den späteren Produktpfad. Vor WP12 bleibt das Voxel-Lab technisch isoliert.

### Phase E, Produktintegration

Erst nach WP12 und einer ausdrücklichen Integrationsentscheidung darf der neue Lab-Kern in `Weltraum-Spiel` eingebunden werden. Der erste Produktpfad soll klein, read-only, fixturegebunden und per Feature Flag isoliert sein. Volle World-Authority, Planetstreaming, Gameplayzerstörung und Player Construction folgen nicht automatisch mit dem ersten Handoff.

## 3. Wann wieder sichtbarer Fortschritt zu erwarten ist

### Im Voxel-Lab

```text
Entwickler-sichtbar:
BR02 bis BR04

Spürbar interaktiv:
WP05

Klar visuell:
WP06

Erstes echtes Voxel-Edit:
WP07

Deutliches Bau-/Zerstörungsgefühl:
WP08
```

Vom heutigen Stand aus liegt der erste klar sichtbare Lab-Meilenstein also nicht direkt nach BR01, sondern nach:

```text
BR01 Abschluss
+ BR02
+ BR03
+ BR04
+ WP05
→ WP06 Picking
```

Das sind ungefähr fünf weitere vollständig abgeschlossene Implementierungs-, Review- und Integrationsetappen nach dem aktuellen BR01-Fix. Das erste echte Bearbeiten der Welt folgt eine Etappe später mit WP07.

### Im eigentlichen Weltraum-Spiel

Ein sichtbarer Lab-Erfolg ist noch keine Produktintegration. Im Hauptspiel ist ein neuer Voxelpfad erst nach WP12 und dem anschließenden Integrationsgate zu erwarten.

Ein getrenntes UI-, Storyboard- oder Editor-Showroom-Paket kann im Repository `Weltraum-Spiel` früher sichtbare Fortschritte liefern, solange es keine Lab-Integration oder neue World-Authority behauptet und ein eigener Write-Agent die Repositorygrenze einhält.

## 4. Praktische Statusampel

| Bereich | Status |
|---|---|
| Blockdarstellung, Greedy, AO und Palette | `GREEN` |
| BR01 Contracts und Provenienz | `YELLOW`, finaler Fix-Loop |
| Benchmark-Infrastruktur BR02 bis BR04 | `GREY`, wartet auf BR01 |
| Worker und interaktive Edits | `GREY`, wartet auf BR01 bis BR04 |
| Sichtbares Picking und Voxelbearbeitung | `GREY`, WP06 und WP07 |
| Integration ins Hauptspiel | `BLOCKED_UNTIL_WP12` |

## 5. Stop- und Wahrheitsregeln

- Kein nächstes Paket startet vor `ACCEPT` und Fast-Forward-Integration des Vorgängers.
- Kein Implementierungsagent führt seinen eigenen Merge aus.
- Maximal ein Write-Agent pro Repository.
- GitHub-Remote, akzeptierte Commits, committed Tests und reproduzierbare Evidence haben Vorrang vor diesem Plan.
- Dieses Dokument wird bei jeder akzeptierten Integration aktualisiert oder ausdrücklich als `SUPERSEDED` markiert.
