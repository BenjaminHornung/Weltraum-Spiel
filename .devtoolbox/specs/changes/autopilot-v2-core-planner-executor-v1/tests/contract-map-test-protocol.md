# Test-Protokoll: Contract Map Verification

> **Typ:** Planungs- und Verifikationsprotokoll (Docs-Only)
>
> **Change:** `autopilot-v2-core-planner-executor-v1`
>
> **Stand:** 2026-06-15
>
> **Ersteller:** Planungs-Agent

---

## 1. Zweck

Dieses Dokument erfasst die Contract-Map-Verifikation für den Autopilot V2 Core
Planner Executor. Es dokumentiert, welche Kontextquellen gelesen wurden, welche
Evidence-Baseline existiert, und was bei der Implementierungsphase verifiziert
werden muss. **Keine Runtime-Änderungen, keine Prototype-Änderungen, keine
Szenen/Prefab-Änderungen und keine Test-Implementierungen wurden vorgenommen.**

---

## 2. Gelesene Kontextquellen

| # | Datei/Pfad | Abschnitte | Relevanz |
|---|---|---|---|
| 1 | `AGENTS.md` | Gesamtdokument | Spec-first, kleines verifizierbares Arbeiten, Namespace-Regeln, Autopilot-Architekturregel, Evidence-Gates |
| 2 | `.agent/PLANS.md` | Gesamtdokument | ExecPlan-Pflichtstruktur, Fortschrittslog-Format, DoD-Format |
| 3 | `docs/architecture/autopilot-v2-design.md` | L1-90 | Kernmodule, Zustandsmaschine, Module-Verantwortlichkeiten |
| 4 | `docs/architecture/autopilot-v2-design.md` | L92-124 | TargetDescriptor, ArrivalEnvelope Datenverträge |
| 5 | `docs/architecture/autopilot-v2-design.md` | L126-168 | Planungsphasen 1-9 (Resolve → Lock → Execute) |
| 6 | `docs/architecture/autopilot-v2-design.md` | L170-186 | RouteSegment-Typen (Orient, Burn, Coast, Brake, etc.) |
| 7 | `docs/architecture/autopilot-v2-design.md` | L187-215 | ObstacleSnapshot-Form (shape, radius, clearance, hazard, confidence) |
| 8 | `docs/architecture/autopilot-v2-design.md` | L247-259 | Timewarp-Regel (Zeitachse, planElapsedTime, keine neuen Hindernisse → Invalidated) |
| 9 | `docs/architecture/autopilot-v2-design.md` | L261-298 | Zustandsmaschine, Completion Gates (Position, Speed, Angular, Hold, NoCollision) |
| 10 | `docs/architecture/autopilot-v2-design.md` | L330-339 | DoD V2-Core (Pure Tests, Determinismus, Direct/Obstacle/Fuel/Invalid, Executor innerhalb Envelope) |
| 11 | `docs/architecture/autopilot-v2-test-harness.md` | L15-25 | Testpfade (RoutePlannerDirectTests, ObstacleTests, FuelTests, etc.) |
| 12 | `docs/architecture/autopilot-v2-test-harness.md` | L47-64 | Pflichtfälle (Direct_100m, TargetInsidePlanet, ObstacleCorridor, NoRcsAuthority, etc.) |
| 13 | `docs/architecture/autopilot-v2-test-harness.md` | L66-81 | Evaluierte Metriken (finalPositionError, fuelUsed, planHash, replanCountMustBeZero) |
| 14 | `docs/architecture/autopilot-v2-test-harness.md` | L122-136 | Evidence-Format (JSON, CSV, Screenshots, Failures) |
| 15 | `docs/architecture/autopilot-v2-test-harness.md` | L188-199 | Migration aus Proving Ground (Phase 1-4) |
| 16 | `docs/current-prototype-state.md` | L105-110 | Exact-Arrival-Status: 0.20m-0.52m, specs_validate PASS |
| 17 | `docs/current-prototype-state.md` | L128-157 | Done-State für exact-point-arrival, Proving-Ground-Evidence |
| 18 | `.devtoolbox/specs/changes/autopilot-v2-core-planner-executor-v1/proposal.md` | Gesamtdokument | Scope, Success Criteria, Out-of-Scope |
| 19 | `.devtoolbox/specs/changes/autopilot-v2-core-planner-executor-v1/design.md` | Gesamtdokument | Planned Shape, Key Decision (No Silent Replan) |
| 20 | `.devtoolbox/specs/changes/autopilot-v2-core-planner-executor-v1/tasks.md` | Gesamtdokument | Phasen 0-4, offene Runtime-Tasks |

---

## 3. Evidence Summary

### Keine Runtime-Verifikation durchgeführt

Dieser Planungsslice hat **keine** der folgenden Aktionen durchgeführt:

```text
✗ Kein dotnet build
✗ Kein dotnet test
✗ Kein Unity validate_script
✗ Kein Unity PlayMode Test
✗ Keine Screenshot-Aufnahme
✗ Keine Scene/Prefab-Änderung
✗ Keine Prototype-Code-Änderung
✗ Keine Task-Toggle in tasks.md
```

### Erstellte Artefakte

```text
✓ implementation-plan.md (Contract Map, ExecPlan, DTOs, Services, Executor-Regeln, Tests, DoD)
✓ tests/contract-map-test-protocol.md (dieses Dokument)
```

---

## 4. Exact-Arrival Baseline-Tabelle

Quelle: `docs/current-prototype-state.md` L128-157 und
`fix-autopilot-exact-point-arrival-v1/tests/test-protocol.md`.

Diese Werte sind die **Referenz-Baseline** für V2-Target-Arrival-Qualität.
V2 muss mindestens diese Präzision erreichen oder verbessern.

| # | Szenario | Endzustand | Finale Distanz (m) | Finale Geschwindigkeit (m/s) | Safety-Replans | Notizen |
|---|---|---|---|---|---|---|
| 1 | Direct_Short_100m_NoObstacle | Complete | 0.243416 | 0.047162 | 0 | Strict Arrival Envelope erfüllt |
| 2 | Direct_Medium_500m_NoObstacle | Complete | 0.240253 | 0.047273 | 0 | Direct Medium Baseline |
| 3 | Direct_Long_2400m_NoObstacle | Complete | 0.227089 | 0.047481 | 0 | Long Range Direct Baseline |
| 4 | LateralVelocity_500m_NoObstacle | Complete | 0.515857 | 0.047267 | 0 | Lateral-Korrektur stabil |
| 5 | OffAxisRotation_500m_NoObstacle | Complete | 0.485552 | 0.047370 | 0 | Rotationskorrektur + Brake |
| 6 | ObstacleCorridor_500m_Reacquire | Complete | 0.504097 | 0.046968 | 0 | 85.49461m min. Clearance erhalten |
| 7 | NearTarget_Overshoot_InitialVelocity | Complete | 0.515906 | 0.047367 | 0 | Kein post-brake Accelerate |
| 8 | LowRcsAuthority_TerminalCorrection | Complete | 0.202228 | 0.046831 | 0 | RCS-Terminalkorrektur präzise |
| 9 | NoRcsAuthority_Negative_NoFalseComplete | Failed | 1751.105 | 16.0 | 5454 | Korrekt Failed, kein False Complete |

### Verification Evidence (aus fix-autopilot-exact-point-arrival-v1)

```text
✓ validate_script PASS
✓ 46/46 EditMode Tests PASS
✓ Proving Ground Generator PASS
✓ Proving Ground Acceptance Gate PASS
✓ PlayMode Nominal-Reacquire Regression PASS
✓ dotnet build PASS
✓ specs_validate PASS
```

---

## 5. Contract Completeness Checklist

### DTOs (14 Pflicht-DTOs)

| # | DTO | Namespace definiert | Zielpfad definiert | Felder spezifiziert | Invarianten definiert | Produzenten | Konsumenten | Tests gelistet |
|---|---|---|---|---|---|---|---|---|
| 1 | TargetDescriptor | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 2 | ArrivalEnvelope | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 3 | RoutePlan | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 4 | RouteSegment | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 5 | RouteCandidate | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 6 | RouteScore | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 7 | NavigationEnvironmentSnapshot | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 8 | ShipAuthoritySnapshot | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 9 | ObstacleSnapshot | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 10 | FuelBudget | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 11 | BrakeReserve | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 12 | PlanInvalidationReason | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 13 | AutopilotExecutionState | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| 14 | AutopilotTelemetry | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

> **Hinweis:** Alle Checkboxen oben sind mit ☐ markiert, weil die DTOs im
> Planungsdokument **spezifiziert** sind, aber in diesem Slice **nicht
> implementiert** wurden. Der Implementierungs-Agent muss diese bei Erstellung
> der jeweiligen Dateien abhaken.

### Planner-Services (6 Stück)

| # | Service | Interface/Class | Input | Output | Harte Ablehnung | Tests gelistet |
|---|---|---|---|---|---|---|
| 1 | DirectLocalPlanner | DirectLocalPlanner : IRoutePlanner | Target + Ship + Environment + Fuel + Mode | 1 Candidate | Empty List | ☐ |
| 2 | ObstacleAvoidancePlanner | ObstacleAvoidancePlanner : IRoutePlanner | Target + Ship + Environment + Fuel + Mode | 1..N Candidates | Empty List | ☐ |
| 3 | FuelAuthorityValidator | FuelAuthorityValidator | Candidate + Ship + Fuel | ValidationResult | Rejected | ☐ |
| 4 | RouteScorer | RouteScorer | Candidates + Mode | Score + SelectBest | Keine (bewertet nur) | ☐ |
| 5 | RouteValidator | RouteValidator | Candidate + Environment + Ship | ValidationResult | Rejected | ☐ |
| 6 | PlanHashService | PlanHashService | RoutePlan | string (Hash) | Empty-Rejektion | ☐ |

### Executor-Regeln (5 Kategorien)

| # | Regel | Spezifiziert in implementation-plan.md | Tests gelistet |
|---|---|---|---|
| 1 | Locked Plan Execution | ☑ Abschnitte Executor-Regeln 1-5 | ☐ |
| 2 | No Silent Replan | ☑ Abschnitte Executor-Regeln 6-8 | ☐ |
| 3 | Explicit Invalidation | ☑ Abschnitte Executor-Regeln 9-11 | ☐ |
| 4 | Manual Override | ☑ Abschnitte Executor-Regeln 12-13 | ☐ |
| 5 | Timewarp Readiness | ☑ Abschnitte Executor-Regeln 14-18 | ☐ |

### Testliste (25 Test-Dateien)

| # | Test-Datei | Phase | Prio | Spezifiziert | Implementiert |
|---|---|---|---|---|---|
| 1 | TargetDescriptorTests | Phase 1 | P0 | ☑ | ☐ |
| 2 | ArrivalEnvelopeTests | Phase 1 | P0 | ☑ | ☐ |
| 3 | RoutePlanTests | Phase 1 | P0 | ☑ | ☐ |
| 4 | RouteSegmentTests | Phase 1 | P0 | ☑ | ☐ |
| 5 | RouteCandidateTests | Phase 1 | P0 | ☑ | ☐ |
| 6 | RouteScoreTests | Phase 1 | P0 | ☑ | ☐ |
| 7 | NavigationEnvironmentSnapshotTests | Phase 1 | P0 | ☑ | ☐ |
| 8 | ShipAuthoritySnapshotTests | Phase 1 | P0 | ☑ | ☐ |
| 9 | ObstacleSnapshotTests | Phase 1 | P0 | ☑ | ☐ |
| 10 | FuelBudgetTests | Phase 1 | P0 | ☑ | ☐ |
| 11 | BrakeReserveTests | Phase 1 | P0 | ☑ | ☐ |
| 12 | PlanInvalidationReasonTests | Phase 1 | P0 | ☑ | ☐ |
| 13 | AutopilotExecutionStateTests | Phase 1 | P0 | ☑ | ☐ |
| 14 | AutopilotTelemetryTests | Phase 1 | P0 | ☑ | ☐ |
| 15 | DirectLocalPlannerTests | Phase 2 | P0 | ☑ | ☐ |
| 16 | ObstacleAvoidancePlannerTests | Phase 2 | P0 | ☑ | ☐ |
| 17 | FuelAuthorityValidatorTests | Phase 2 | P0 | ☑ | ☐ |
| 18 | RouteScorerTests | Phase 2 | P1 | ☑ | ☐ |
| 19 | RouteValidatorTests | Phase 2 | P0 | ☑ | ☐ |
| 20 | PlanHashServiceTests | Phase 2 | P0 | ☑ | ☐ |
| 21 | PlanDeterminismTests | Phase 2 | P0 | ☑ | ☐ |
| 22 | AutopilotExecutorNoReplanTests | Phase 3 | P0 | ☑ | ☐ |
| 23 | AutopilotExecutorInvalidationTests | Phase 3 | P0 | ☑ | ☐ |
| 24 | AutopilotSupervisorTests | Phase 3 | P1 | ☑ | ☐ |
| 25 | AutopilotTelemetryRecorderTests | Phase 3 | P1 | ☑ | ☐ |

### Migration-Items

| # | Regel | Spezifiziert | Verstanden |
|---|---|---|---|
| 1 | Keine 1:1-Namenskopie (Prototype*, DirectFastTransfer, ReplanNow, etc.) | ☑ | ☑ |
| 2 | Konzepte als Referenz (Arrival-Stabilität, Clearance, Authority, Gates) | ☑ | ☑ |
| 3 | Vergleichstests als Baseline, nicht als Kopie | ☑ | ☑ |
| 4 | Proving-Ground-Migration Phase 1-4 | ☑ | ☑ |
| 5 | Neue Dateien nur unter Assets/_Weltraum/ | ☑ | ☑ |
| 6 | Keine MonoBehaviour-Abhängigkeit in DTOs | ☑ | ☑ |

---

## 6. Spätere Verifikationsbefehle (NICHT AUSGEFÜHRT)

Die folgenden Befehle sind für die Implementierungsphase vorgesehen und hier nur
dokumentiert, **nicht ausgeführt**:

```text
#NICHT AUSGEFÜHRT: Lösungsbau
dotnet build "Weltraum Spiel.sln" --no-restore

#NICHT AUSGEFÜHRT: Lösungstests
dotnet test "Weltraum Spiel.sln" --no-build

#NICHT AUSGEFÜHRT: Unity Script-Validierung (pro Datei)
# Für jede neue .cs-Datei unter Assets/_Weltraum/Scripts/Navigation/:
unityMCP validate_script uri="Assets/_Weltraum/Scripts/Navigation/<Datei>.cs"

#NICHT AUSGEFÜHRT: Unity EditMode-Tests
unityMCP run_tests mode="EditMode" group_names=["Navigation"]

#NICHT AUSGEFÜHRT: Unity Konsolen-Check
unityMCP read_console action="get" types=["error"]

#NICHT AUSGEFÜHRT: Spec-Validierung
servicerunner_specs_validate workspaceRoot="E:\\Unity\\Weltraum Spiel\\Weltraum Spiel"

#NICHT AUSGEFÜHRT: Determinismus-Test (100 Iterationen)
# Wird als EditMode-Test implementiert: PlanDeterminismTests

#NICHT AUSGEFÜHRT: NoSilentReplan-Test
# Wird als EditMode-Test implementiert: AutopilotExecutorNoReplanTests
```

---

## 7. Constraints

### Harte Constraints für diesen Slice

```text
□ Keine Runtime-Code-Änderungen.
□ Keine Prototype-Code-Änderungen.
□ Keine Szenen-, Prefab- oder Asset-Änderungen.
□ Keine Test-Implementierungen (nur Planungs-Artefakte).
□ Keine Task-Toggles in tasks.md.
□ Keine claims von Runtime-Verification.
□ Nur Dokumentenerstellung: implementation-plan.md + tests/contract-map-test-protocol.md.
```

### Constraints für die Implementierungsphase (später)

```text
□ Alle neuen Dateien unter Assets/_Weltraum/ (nicht Assets/Scripts/Prototype/).
□ Alle DTOs immutable (readonly struct oder immutable class).
□ Executor darf niemals still replan.
□ replanCount muss immer 0 sein.
□ PlanHash deterministisch (SHA256).
□ Alle Tests pure EditMode (kein MonoBehaviour, keine Scene).
□ Naming-Verbote beachten (siehe implementation-plan.md Migration-Abschnitt).
```

---

## 8. Offene Fragen und Risiken

| # | Frage/Risiko | Status | Notiz |
|---|---|---|---|
| 1 | DTO-Typ (struct vs class) für RoutePlan und RouteCandidate: Vorschlag ist immutable class wegen IReadOnlyList-Felder. readonly struct mit Referenz-Feldern ist möglich aber komplexer. | Offen bis Phase 1 | implementation-plan.md schlägt class vor; Agent darf bei guter Begründung abweichen |
| 2 | Planeten/Mondkörper/Atmosphären-No-Go brauchen in V1 keine zusätzliche DTO-Klasse; sie werden als `ObstacleSnapshot`/`NoGoVolumes` im `NavigationEnvironmentSnapshot` modelliert. | Entschieden für V1 | Ein separates CelestialBodySnapshot bleibt Future Work, nicht Pflichtumfang dieser Contract Map |
| 3 | TestShipFactory / TestWorldFactory aus Test-Harness-Doc sind für PlayMode-Harness gedacht. Pure EditMode kann simpler sein (direkte DTO-Konstruktion). | Offen bis Phase 2 | implementation-plan.md listet keine MonoBehaviour-Fixtures für EditMode |
| 4 | Double-Precision (Vector3d, QuaternionD) vs Vector3: Design-Doc verwendet d-Suffix. Unity-Kern hat Vector3d nicht nativ; benötigt Custom-Struct oder externe Lib. | Offen bis Phase 1 | Wenn Vector3d nicht vorhanden, Vector3 verwenden und Präzision dokumentieren |

---

## 9. Sign-off

```text
Planungs-Agent:
  Datum: 2026-06-15
  Artefakte erstellt: 2 (implementation-plan.md, tests/contract-map-test-protocol.md)
  Runtime-Änderungen: 0
  Prototype-Änderungen: 0
  Tasks toggled: 0
  Verification claims: 0
  Status: PLANUNG KOMPLETT, Implementierung ausstehend
```
