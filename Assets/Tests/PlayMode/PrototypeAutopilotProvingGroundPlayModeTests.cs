using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using NUnit.Framework;
using UnityEngine;

public class PrototypeAutopilotProvingGroundPlayModeTests
{
    private const string ChangeName = "autopilot-proving-ground-harness-v1";
    private const string TestObjectPrefix = "AutopilotProvingGround";
    private static readonly CultureInfo CsvCulture = CultureInfo.InvariantCulture;

    [SetUp]
    public void SetUp()
    {
        DestroyByPrefix(TestObjectPrefix);
        PrototypeNavigationObstacleRegistry.ClearForTests();
        Physics.SyncTransforms();
    }

    [TearDown]
    public void TearDown()
    {
        DestroyByPrefix(TestObjectPrefix);
        PrototypeNavigationObstacleRegistry.ClearForTests();
        Physics.SyncTransforms();
    }

    [Test]
    [Category("AutopilotProvingGround")]
    public void PlayMode_AutopilotProvingGround_RunsScenarioMatrix()
    {
        string evidenceRoot = BuildEvidenceRoot();
        Directory.CreateDirectory(evidenceRoot);
        Directory.CreateDirectory(Path.Combine(evidenceRoot, "performance"));

        List<ScenarioResult> results = new List<ScenarioResult>();
        foreach (AutopilotProvingGroundScenario scenario in BuildScenarios())
        {
            results.Add(RunScenario(scenario, evidenceRoot));
        }

        string summaryPath = Path.Combine(evidenceRoot, "autopilot-proving-ground-summary.json");
        string reportPath = Path.Combine(evidenceRoot, "test-protocol.md");
        WriteSummaryJson(summaryPath, results);
        WriteMarkdownReport(reportPath, results);

        Assert.That(new FileInfo(summaryPath).Length, Is.GreaterThan(0));
        Assert.That(new FileInfo(reportPath).Length, Is.GreaterThan(0));

        List<string> failures = new List<string>();
        for (int i = 0; i < results.Count; i++)
        {
            if (results[i].classification != ScenarioClassification.Pass)
            {
                failures.Add(results[i].scenario.name + ": " + ClassificationLabel(results[i].classification) + " - " + results[i].failureSummary);
            }
        }

        Assert.That(
            failures,
            Is.Empty,
            "Autopilot Proving Ground found gameplay-quality failures. Evidence: " + reportPath + "\n" + string.Join("\n", failures));
    }

    private static ScenarioResult RunScenario(AutopilotProvingGroundScenario scenario, string evidenceRoot)
    {
        string csvPath = Path.Combine(evidenceRoot, "performance", scenario.name + ".csv");
        ScenarioResult result = new ScenarioResult(scenario, csvPath);

        try
        {
            using (PrototypeScenarioBuilder builder = new PrototypeScenarioBuilder())
            using (HeadlessSimulationRunner runner = new HeadlessSimulationRunner())
            {
                PrototypeAutopilotRig rig = builder.CreateAutopilotRig(
                    TestObjectPrefix + "_" + scenario.name + "_Ship",
                    scenario.targetPosition,
                    0.5f);

                ConfigureRig(rig, scenario);

                List<PrototypeNavigationObstacle> obstacles = new List<PrototypeNavigationObstacle>();
                for (int i = 0; i < scenario.obstacles.Length; i++)
                {
                    ScenarioObstacle obstacle = scenario.obstacles[i];
                    obstacles.Add(builder.CreateObstacle(
                        TestObjectPrefix + "_" + scenario.name + "_Obstacle_" + i,
                        obstacle.position,
                        obstacle.radius,
                        obstacle.clearanceMeters,
                        true,
                        true));
                }

                runner.AddUpdateTick(rig.Autopilot);
                runner.AddFixedTick(rig.Autopilot);
                runner.AddFixedTick(rig.Ship.Controller);

                rig.Autopilot.SetFlightPlanExecutorEnabledForTests(true);
                rig.Autopilot.SetStrictFlightPlanExecutionForTests(true);
                rig.Autopilot.ToggleAutopilot();

                int maxSteps = Mathf.CeilToInt(scenario.maxCompletionTimeSeconds / runner.FixedDeltaTime);
                maxSteps = Mathf.Clamp(maxSteps, 1, 60000);

                using (StreamWriter writer = new StreamWriter(csvPath, false))
                {
                    WriteCsvHeader(writer);
                    for (int step = 0; step <= maxSteps; step++)
                    {
                        ProvingGroundSample sample = CaptureSample(scenario, rig, runner, result);
                        result.Observe(sample);
                        WriteCsvRow(writer, sample);

                        if (IsTerminalState(rig.Autopilot.CurrentState))
                        {
                            result.completedTimeSeconds = sample.time;
                            break;
                        }

                        if (step < maxSteps)
                        {
                            runner.Step();
                        }
                    }
                }

                result.completed = IsTerminalState(rig.Autopilot.CurrentState);
                result.Evaluate();
            }
        }
        catch (Exception ex)
        {
            result.classification = ScenarioClassification.BlockedByTestSetup;
            result.failureSummary = ex.GetType().Name + ": " + ex.Message;
            File.WriteAllText(csvPath, "blockedByTestSetup,message\ntrue," + CsvEscape(result.failureSummary) + "\n");
        }

        return result;
    }

    private static void ConfigureRig(PrototypeAutopilotRig rig, AutopilotProvingGroundScenario scenario)
    {
        rig.Ship.Ship.name = TestObjectPrefix + "_" + scenario.name + "_Ship";
        rig.Target.gameObject.name = TestObjectPrefix + "_" + scenario.name + "_Target";

        rig.Ship.Body.useGravity = scenario.gravityEnabled;
        rig.Ship.Body.linearDamping = 0f;
        rig.Ship.Body.angularDamping = 0f;
        rig.Ship.Body.position = scenario.initialShipPosition;
        rig.Ship.Body.rotation = scenario.initialShipRotation;
        rig.Ship.Body.linearVelocity = scenario.initialShipVelocity;
        rig.Ship.Body.angularVelocity = scenario.initialAngularVelocity;
        rig.Ship.Ship.transform.SetPositionAndRotation(scenario.initialShipPosition, scenario.initialShipRotation);

        PrototypeRcsSettings rcsSettings = PrototypeRcsSettings.Default;
        rcsSettings.translationForce *= scenario.rcsTranslationScale;
        rcsSettings.attitudeForce *= scenario.rcsAttitudeScale;
        rcsSettings.sasAuthority *= scenario.rcsAttitudeScale;
        rcsSettings.nozzleSpoolUpRate = 0f;
        rcsSettings.nozzleSpoolDownRate = 0f;
        rig.Ship.Rcs.ApplySettings(rcsSettings);
        rig.Ship.Rcs.SetRcsEnabled(scenario.rcsEnabled);
        rig.Ship.Controller.SetRcsEnabled(scenario.rcsEnabled);

        PrototypeMainThrusterSettings mainSettings = PrototypeMainThrusterSettings.Default;
        mainSettings.throttleScale = scenario.mainThrottleScale;
        mainSettings.throttleSpoolUpRate = 0f;
        mainSettings.throttleSpoolDownRate = 0f;
        rig.Ship.MainThruster.ApplySettings(mainSettings);
        rig.Ship.Stats.ApplySettings(
            PrototypeShipMassSettings.Default,
            PrototypeShipFuelSettings.Default,
            mainSettings,
            PrototypeGunSettings.Default,
            PrototypeCameraSettings.Default);
        rig.Ship.Stats.ApplyMassProperties(rig.Ship.Body);
        rig.Ship.Controller.ResetStartupFlightControls(scenario.initialShipPosition, scenario.initialShipRotation);
        rig.Autopilot.SelectTarget(rig.Target);
        Physics.SyncTransforms();
    }

    private static ProvingGroundSample CaptureSample(
        AutopilotProvingGroundScenario scenario,
        PrototypeAutopilotRig rig,
        HeadlessSimulationRunner runner,
        ScenarioResult result)
    {
        Rigidbody body = rig.Ship.Body;
        PrototypeWaypointAutopilot autopilot = rig.Autopilot;
        PlayerShipController controller = rig.Ship.Controller;
        RcsThrusterController rcs = rig.Ship.Rcs;
        Vector3 targetPosition = rig.Target.Position;
        Vector3 toTarget = targetPosition - body.position;
        float distance = toTarget.magnitude;
        Vector3 targetDirection = distance > 0.0001f ? toTarget / distance : Vector3.forward;
        Vector3 velocity = body.linearVelocity;
        float closingSpeed = Vector3.Dot(velocity, targetDirection);
        Vector3 lateralVelocity = velocity - (targetDirection * closingSpeed);
        PrototypeFlightPlan plan = autopilot.CurrentFlightPlan;
        PrototypeFlightPlanExecutionState execution = autopilot.CurrentFlightPlanExecutionState;
        PrototypeFlightPlanTrackingCommand tracking = autopilot.CurrentFlightPlanTrackingCommand;
        bool brakeCommitted = autopilot.ArrivalBrakeCommitted || autopilot.DirectFastTransferBrakeCommitted;
        bool terminalCapture = autopilot.ArrivalTerminalCaptureActive || autopilot.DirectFastTransferTerminalCaptureActive;

        ProvingGroundSample sample = new ProvingGroundSample
        {
            step = runner.StepCount,
            time = runner.ElapsedTime,
            position = body.position,
            velocity = velocity,
            distance = distance,
            relativeSpeed = velocity.magnitude,
            lateralSpeed = lateralVelocity.magnitude,
            closingSpeed = closingSpeed,
            state = autopilot.CurrentState.ToString(),
            navigationPhase = autopilot.NavigationPhase.ToString(),
            flightPlanPhase = execution.hasActiveSegment ? execution.activePhase.ToString() : tracking.error.activePhase.ToString(),
            activeSegmentLabel = autopilot.ActiveSegmentLabel,
            requestedMainThrottle = autopilot.RequestedMainThrottle,
            actualMainThrottle = controller.MainActualThrottle,
            requestedRcsForceMagnitude = controller.LastRcsDesiredForceWorld.magnitude,
            actualRcsForceMagnitude = controller.LastRcsActualForceWorld.magnitude,
            requestedRcsTorqueMagnitude = controller.LastRcsDesiredTorqueWorld.magnitude,
            actualRcsTorqueMagnitude = controller.LastRcsActualTorqueWorld.magnitude,
            planElapsed = autopilot.FlightPlanExecutorElapsedSeconds,
            planTotalDuration = plan.totalDurationSeconds,
            flightPlanSafetyReplanCount = autopilot.FlightPlanSafetyReplanCount,
            flightPlanRequiresReplan = autopilot.FlightPlanRequiresReplan,
            selectedCandidate = autopilot.SelectedCandidate,
            selectedCandidateReason = autopilot.SelectedCandidateReason,
            obstacleStatus = autopilot.ObstacleStatus,
            arrivalBrakeCommitted = autopilot.ArrivalBrakeCommitted,
            directFastTransferBrakeCommitted = autopilot.DirectFastTransferBrakeCommitted,
            arrivalTerminalCaptureActive = autopilot.ArrivalTerminalCaptureActive,
            directFastTransferTerminalCaptureActive = autopilot.DirectFastTransferTerminalCaptureActive,
            directFastTransferTerminalReacquireActive = autopilot.DirectFastTransferTerminalReacquireActive,
            transitionsIntoAccelerateAfterFirstBrakeCommit = result.transitionsIntoAccelerateAfterFirstBrakeCommit,
            brakeFlipTerminalToAccelerateTransitions = result.brakeFlipTerminalToAccelerateTransitions,
            minimumDistanceReached = Mathf.Min(result.minimumDistanceReached, distance),
            maximumDistanceAfterFirstEnteringTwoMeters = result.maximumDistanceAfterFirstEnteringTwoMeters,
            angularSpeed = body.angularVelocity.magnitude,
            allowedPlannerProfiles = string.Join("|", scenario.allowedPlannerProfiles),
            obstacleAvoidanceExpected = scenario.obstacleAvoidanceExpected,
            gravityEnabled = scenario.gravityEnabled,
            rcsTranslationAuthority = rcs.TranslationForce,
            rcsAttitudeAuthority = rcs.AttitudeForce,
            brakeOrTerminalOwned = brakeCommitted || terminalCapture || autopilot.DirectFastTransferTerminalReacquireActive
        };

        return sample;
    }

    private static void WriteCsvHeader(StreamWriter writer)
    {
        writer.WriteLine(
            "step,time,shipPosition.x,shipPosition.y,shipPosition.z,"
            + "shipVelocity.x,shipVelocity.y,shipVelocity.z,"
            + "distanceToExactTarget,relativeSpeed,lateralSpeed,closingSpeed,"
            + "autopilotState,navigationPhase,currentFlightPlanPhase,activeSegmentLabel,"
            + "requestedMainThrottle,actualMainThrottle,"
            + "requestedRcsForceMagnitude,actualRcsForceMagnitude,requestedRcsTorqueMagnitude,actualRcsTorqueMagnitude,"
            + "planElapsed,planTotalDuration,flightPlanSafetyReplanCount,flightPlanRequiresReplan,"
            + "selectedCandidate,selectedCandidateReason,obstacleStatus,"
            + "arrivalBrakeCommitted,directFastTransferBrakeCommitted,arrivalTerminalCaptureActive,"
            + "directFastTransferTerminalCaptureActive,directFastTransferTerminalReacquireActive,"
            + "transitionsIntoAccelerateAfterFirstBrakeCommit,brakeFlipTerminalToAccelerateTransitions,"
            + "minimumDistanceReached,maximumDistanceAfterFirstEntering2m,angularSpeed,"
            + "allowedPlannerProfiles,obstacleAvoidanceExpected,gravityEnabled,rcsTranslationAuthority,rcsAttitudeAuthority");
    }

    private static void WriteCsvRow(StreamWriter writer, ProvingGroundSample sample)
    {
        writer.WriteLine(
            sample.step + ","
            + FormatFloat(sample.time) + ","
            + FormatVector(sample.position) + ","
            + FormatVector(sample.velocity) + ","
            + FormatFloat(sample.distance) + ","
            + FormatFloat(sample.relativeSpeed) + ","
            + FormatFloat(sample.lateralSpeed) + ","
            + FormatFloat(sample.closingSpeed) + ","
            + CsvEscape(sample.state) + ","
            + CsvEscape(sample.navigationPhase) + ","
            + CsvEscape(sample.flightPlanPhase) + ","
            + CsvEscape(sample.activeSegmentLabel) + ","
            + FormatFloat(sample.requestedMainThrottle) + ","
            + FormatFloat(sample.actualMainThrottle) + ","
            + FormatFloat(sample.requestedRcsForceMagnitude) + ","
            + FormatFloat(sample.actualRcsForceMagnitude) + ","
            + FormatFloat(sample.requestedRcsTorqueMagnitude) + ","
            + FormatFloat(sample.actualRcsTorqueMagnitude) + ","
            + FormatFloat(sample.planElapsed) + ","
            + FormatFloat(sample.planTotalDuration) + ","
            + sample.flightPlanSafetyReplanCount + ","
            + sample.flightPlanRequiresReplan + ","
            + CsvEscape(sample.selectedCandidate) + ","
            + CsvEscape(sample.selectedCandidateReason) + ","
            + CsvEscape(sample.obstacleStatus) + ","
            + sample.arrivalBrakeCommitted + ","
            + sample.directFastTransferBrakeCommitted + ","
            + sample.arrivalTerminalCaptureActive + ","
            + sample.directFastTransferTerminalCaptureActive + ","
            + sample.directFastTransferTerminalReacquireActive + ","
            + sample.transitionsIntoAccelerateAfterFirstBrakeCommit + ","
            + sample.brakeFlipTerminalToAccelerateTransitions + ","
            + FormatFloat(sample.minimumDistanceReached) + ","
            + FormatFloat(sample.maximumDistanceAfterFirstEnteringTwoMeters) + ","
            + FormatFloat(sample.angularSpeed) + ","
            + CsvEscape(sample.allowedPlannerProfiles) + ","
            + sample.obstacleAvoidanceExpected + ","
            + sample.gravityEnabled + ","
            + FormatFloat(sample.rcsTranslationAuthority) + ","
            + FormatFloat(sample.rcsAttitudeAuthority));
    }

    private static void WriteSummaryJson(string path, List<ScenarioResult> results)
    {
        StringBuilder builder = new StringBuilder();
        builder.AppendLine("{");
        builder.AppendLine("  \"change\": \"" + ChangeName + "\",");
        builder.AppendLine("  \"generatedUtc\": \"" + DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture) + "\",");
        builder.AppendLine("  \"scenarios\": [");
        for (int i = 0; i < results.Count; i++)
        {
            ScenarioResult result = results[i];
            builder.AppendLine("    {");
            builder.AppendLine("      \"name\": \"" + JsonEscape(result.scenario.name) + "\",");
            builder.AppendLine("      \"classification\": \"" + ClassificationLabel(result.classification) + "\",");
            builder.AppendLine("      \"finalState\": \"" + JsonEscape(result.finalState) + "\",");
            builder.AppendLine("      \"finalDistance\": " + FormatJsonFloat(result.finalDistance) + ",");
            builder.AppendLine("      \"finalRelativeSpeed\": " + FormatJsonFloat(result.finalRelativeSpeed) + ",");
            builder.AppendLine("      \"finalAngularSpeed\": " + FormatJsonFloat(result.finalAngularSpeed) + ",");
            builder.AppendLine("      \"minimumDistance\": " + FormatJsonFloat(result.minimumDistanceReached) + ",");
            builder.AppendLine("      \"maximumDistanceAfterFirstEntering2m\": " + FormatJsonFloat(result.maximumDistanceAfterFirstEnteringTwoMeters) + ",");
            builder.AppendLine("      \"safetyReplans\": " + result.finalSafetyReplanCount + ",");
            builder.AppendLine("      \"transitionsIntoAccelerateAfterFirstBrakeCommit\": " + result.transitionsIntoAccelerateAfterFirstBrakeCommit + ",");
            builder.AppendLine("      \"brakeFlipTerminalToAccelerateTransitions\": " + result.brakeFlipTerminalToAccelerateTransitions + ",");
            builder.AppendLine("      \"failureSummary\": \"" + JsonEscape(result.failureSummary) + "\",");
            builder.AppendLine("      \"csvPath\": \"" + JsonEscape(result.csvPath.Replace('\\', '/')) + "\"");
            builder.Append("    }");
            if (i < results.Count - 1)
            {
                builder.Append(",");
            }

            builder.AppendLine();
        }

        builder.AppendLine("  ]");
        builder.AppendLine("}");
        File.WriteAllText(path, builder.ToString());
    }

    private static void WriteMarkdownReport(string path, List<ScenarioResult> results)
    {
        StringBuilder builder = new StringBuilder();
        builder.AppendLine("# Autopilot Proving Ground Test Protocol");
        builder.AppendLine();
        builder.AppendLine("Change: `" + ChangeName + "`");
        builder.AppendLine();
        builder.AppendLine("This automated PlayMode harness uses programmatic setup and scripted physics. It intentionally keeps strict point-arrival thresholds so current gameplay-quality failures are visible.");
        builder.AppendLine();
        builder.AppendLine("## Summary");
        builder.AppendLine();
        builder.AppendLine("| Scenario | Classification | Final Error | Final Speed | Angular Speed | Replans | Notes |");
        builder.AppendLine("| --- | --- | ---: | ---: | ---: | ---: | --- |");
        for (int i = 0; i < results.Count; i++)
        {
            ScenarioResult result = results[i];
            builder.AppendLine("| `" + result.scenario.name + "` | " + ClassificationLabel(result.classification)
                + " | " + FormatFloat(result.finalDistance)
                + " | " + FormatFloat(result.finalRelativeSpeed)
                + " | " + FormatFloat(result.finalAngularSpeed)
                + " | " + result.finalSafetyReplanCount
                + " | " + EscapeMarkdown(result.failureSummary) + " |");
        }

        builder.AppendLine();
        builder.AppendLine("## Artifacts");
        builder.AppendLine();
        builder.AppendLine("- Summary JSON: `tests/autopilot-proving-ground-summary.json`");
        builder.AppendLine("- Per-scenario CSV files: `tests/performance/<scenario>.csv`");
        builder.AppendLine();
        builder.AppendLine("## Scenarios");
        builder.AppendLine();
        for (int i = 0; i < results.Count; i++)
        {
            ScenarioResult result = results[i];
            builder.AppendLine("### " + result.scenario.name);
            builder.AppendLine();
            builder.AppendLine("- Classification: `" + ClassificationLabel(result.classification) + "`");
            builder.AppendLine("- CSV: `" + result.csvPath.Replace('\\', '/') + "`");
            builder.AppendLine("- Final state: `" + result.finalState + "`");
            builder.AppendLine("- Minimum distance: `" + FormatFloat(result.minimumDistanceReached) + "m`");
            builder.AppendLine("- Maximum distance after first entering 2m: `" + FormatFloat(result.maximumDistanceAfterFirstEnteringTwoMeters) + "m`");
            builder.AppendLine("- Failure summary: " + result.failureSummary);
            builder.AppendLine();
        }

        File.WriteAllText(path, builder.ToString());
    }

    private static AutopilotProvingGroundScenario[] BuildScenarios()
    {
        return new[]
        {
            DirectScenario("Direct_Short_100m_NoObstacle", Vector3.forward * 100f, 90f),
            DirectScenario("Direct_Medium_500m_NoObstacle", Vector3.forward * 500f, 180f),
            DirectScenario("Direct_Long_2400m_NoObstacle", Vector3.forward * 2400f, 520f),
            DirectScenario(
                "LateralVelocity_500m_NoObstacle",
                Vector3.forward * 500f,
                220f,
                initialVelocity: new Vector3(18f, 0f, 0f)),
            DirectScenario(
                "OffAxisRotation_500m_NoObstacle",
                Vector3.forward * 500f,
                220f,
                initialRotation: Quaternion.Euler(0f, 145f, 0f)),
            new AutopilotProvingGroundScenario
            {
                name = "ObstacleCorridor_500m_Reacquire",
                targetPosition = Vector3.forward * 500f,
                initialShipPosition = Vector3.zero,
                initialShipVelocity = Vector3.zero,
                initialShipRotation = Quaternion.identity,
                initialAngularVelocity = Vector3.zero,
                obstacles = new[]
                {
                    new ScenarioObstacle(new Vector3(-8f, 0f, 170f), 12f, 9f),
                    new ScenarioObstacle(new Vector3(8f, 0f, 250f), 12f, 9f),
                    new ScenarioObstacle(new Vector3(0f, 0f, 330f), 10f, 9f)
                },
                maxArrivalError = 1.25f,
                maxFinalSpeed = 0.25f,
                maxFinalAngularSpeed = 0.15f,
                maxCompletionTimeSeconds = 260f,
                maxSafetyReplans = 1,
                allowedPlannerProfiles = new[] {"direct", "avoidance", "reacquire"},
                obstacleAvoidanceExpected = true,
                gravityEnabled = false,
                rcsEnabled = true,
                rcsTranslationScale = 1f,
                rcsAttitudeScale = 1f,
                mainThrottleScale = 1f
            },
            DirectScenario(
                "NearTarget_Overshoot_InitialVelocity",
                Vector3.forward * 40f,
                80f,
                initialPosition: Vector3.forward * -8f,
                initialVelocity: Vector3.forward * 35f),
            DirectScenario(
                "LowRcsAuthority_TerminalCorrection",
                Vector3.forward * 500f,
                260f,
                initialVelocity: new Vector3(8f, 0f, 0f),
                rcsTranslationScale: 0.12f,
                rcsAttitudeScale: 0.12f),
            DirectScenario(
                "NoRcsAuthority_Negative_NoFalseComplete",
                Vector3.forward * 140f,
                140f,
                initialVelocity: new Vector3(16f, 0f, 0f),
                rcsEnabled: false,
                rcsTranslationScale: 0f,
                rcsAttitudeScale: 0f,
                expectFalseCompleteNegative: true)
        };
    }

    private static AutopilotProvingGroundScenario DirectScenario(
        string name,
        Vector3 targetPosition,
        float maxCompletionTimeSeconds,
        Vector3? initialPosition = null,
        Vector3? initialVelocity = null,
        Quaternion? initialRotation = null,
        float rcsTranslationScale = 1f,
        float rcsAttitudeScale = 1f,
        bool rcsEnabled = true,
        bool expectFalseCompleteNegative = false)
    {
        return new AutopilotProvingGroundScenario
        {
            name = name,
            targetPosition = targetPosition,
            initialShipPosition = initialPosition ?? Vector3.zero,
            initialShipVelocity = initialVelocity ?? Vector3.zero,
            initialShipRotation = initialRotation ?? Quaternion.identity,
            initialAngularVelocity = Vector3.zero,
            obstacles = Array.Empty<ScenarioObstacle>(),
            maxArrivalError = 0.75f,
            maxFinalSpeed = 0.15f,
            maxFinalAngularSpeed = 0.15f,
            maxCompletionTimeSeconds = maxCompletionTimeSeconds,
            maxSafetyReplans = 0,
            allowedPlannerProfiles = new[] {"direct"},
            obstacleAvoidanceExpected = false,
            gravityEnabled = false,
            rcsEnabled = rcsEnabled,
            rcsTranslationScale = rcsTranslationScale,
            rcsAttitudeScale = rcsAttitudeScale,
            mainThrottleScale = 1f,
            expectFalseCompleteNegative = expectFalseCompleteNegative
        };
    }

    private static bool IsTerminalState(PrototypeWaypointAutopilotState state)
    {
        return state == PrototypeWaypointAutopilotState.Complete
            || state == PrototypeWaypointAutopilotState.Aborted
            || state == PrototypeWaypointAutopilotState.Failed
            || state == PrototypeWaypointAutopilotState.FuelInsufficient;
    }

    private static string BuildEvidenceRoot()
    {
        return Path.Combine(
            Directory.GetCurrentDirectory(),
            ".devtoolbox",
            "specs",
            "changes",
            ChangeName,
            "tests");
    }

    private static string FormatVector(Vector3 value)
    {
        return FormatFloat(value.x) + "," + FormatFloat(value.y) + "," + FormatFloat(value.z);
    }

    private static string FormatFloat(float value)
    {
        if (float.IsPositiveInfinity(value))
        {
            return "Infinity";
        }

        if (float.IsNegativeInfinity(value))
        {
            return "-Infinity";
        }

        if (float.IsNaN(value))
        {
            return "NaN";
        }

        return value.ToString("0.######", CsvCulture);
    }

    private static string FormatJsonFloat(float value)
    {
        return float.IsNaN(value) || float.IsInfinity(value) ? "null" : FormatFloat(value);
    }

    private static string CsvEscape(string value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        string escaped = value.Replace("\"", "\"\"");
        if (escaped.Contains(",") || escaped.Contains("\"") || escaped.Contains("\r") || escaped.Contains("\n"))
        {
            return "\"" + escaped + "\"";
        }

        return escaped;
    }

    private static string JsonEscape(string value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        return value
            .Replace("\\", "\\\\")
            .Replace("\"", "\\\"")
            .Replace("\r", "\\r")
            .Replace("\n", "\\n");
    }

    private static string EscapeMarkdown(string value)
    {
        return string.IsNullOrWhiteSpace(value) ? "none" : value.Replace("|", "\\|").Replace("\r", " ").Replace("\n", " ");
    }

    private static string ClassificationLabel(ScenarioClassification classification)
    {
        switch (classification)
        {
            case ScenarioClassification.Pass:
                return "PASS";
            case ScenarioClassification.FailExpectedCurrentBug:
                return "FAIL_EXPECTED_CURRENT_BUG";
            case ScenarioClassification.BlockedByTestSetup:
                return "BLOCKED_BY_TEST_SETUP";
            case ScenarioClassification.NotRun:
                return "NOT_RUN";
            default:
                return classification.ToString();
        }
    }

    private static void DestroyByPrefix(string prefix)
    {
        GameObject[] objects = UnityEngine.Object.FindObjectsOfType<GameObject>();
        for (int i = 0; i < objects.Length; i++)
        {
            if (objects[i] != null && objects[i].name.StartsWith(prefix, StringComparison.Ordinal))
            {
                UnityEngine.Object.DestroyImmediate(objects[i]);
            }
        }
    }

    private sealed class ScenarioResult
    {
        public readonly AutopilotProvingGroundScenario scenario;
        public readonly string csvPath;
        public ScenarioClassification classification = ScenarioClassification.NotRun;
        public string failureSummary = "not run";
        public string finalState = "none";
        public float finalDistance = float.PositiveInfinity;
        public float finalRelativeSpeed = float.PositiveInfinity;
        public float finalAngularSpeed = float.PositiveInfinity;
        public float minimumDistanceReached = float.PositiveInfinity;
        public float maximumDistanceAfterFirstEnteringTwoMeters;
        public int finalSafetyReplanCount;
        public int transitionsIntoAccelerateAfterFirstBrakeCommit;
        public int brakeFlipTerminalToAccelerateTransitions;
        public bool completed;
        public float completedTimeSeconds;
        private bool enteredTwoMeterRange;
        private bool sawBrakeCommit;
        private bool sawNearTargetReacceleration;
        private string previousState = string.Empty;
        private bool previousBrakeOrTerminalOwned;

        public ScenarioResult(AutopilotProvingGroundScenario scenario, string csvPath)
        {
            this.scenario = scenario;
            this.csvPath = csvPath;
        }

        public void Observe(ProvingGroundSample sample)
        {
            finalState = sample.state;
            finalDistance = sample.distance;
            finalRelativeSpeed = sample.relativeSpeed;
            finalAngularSpeed = sample.angularSpeed;
            finalSafetyReplanCount = sample.flightPlanSafetyReplanCount;
            minimumDistanceReached = Mathf.Min(minimumDistanceReached, sample.distance);

            if (sample.distance <= 2f)
            {
                enteredTwoMeterRange = true;
            }

            if (enteredTwoMeterRange)
            {
                maximumDistanceAfterFirstEnteringTwoMeters = Mathf.Max(maximumDistanceAfterFirstEnteringTwoMeters, sample.distance);
            }

            if (sample.brakeOrTerminalOwned)
            {
                sawBrakeCommit = true;
            }

            if (sawBrakeCommit && previousState != sample.state && sample.state == PrototypeWaypointAutopilotState.Accelerate.ToString())
            {
                transitionsIntoAccelerateAfterFirstBrakeCommit++;
            }

            if (previousBrakeOrTerminalOwned && sample.state == PrototypeWaypointAutopilotState.Accelerate.ToString())
            {
                brakeFlipTerminalToAccelerateTransitions++;
            }

            if (sawBrakeCommit
                && sample.distance <= 15f
                && sample.state == PrototypeWaypointAutopilotState.Accelerate.ToString()
                && (sample.requestedMainThrottle > 0.05f || sample.actualMainThrottle > 0.05f)
                && !scenario.allowsEmergencyRecovery)
            {
                sawNearTargetReacceleration = true;
            }

            sample.transitionsIntoAccelerateAfterFirstBrakeCommit = transitionsIntoAccelerateAfterFirstBrakeCommit;
            sample.brakeFlipTerminalToAccelerateTransitions = brakeFlipTerminalToAccelerateTransitions;
            previousState = sample.state;
            previousBrakeOrTerminalOwned = sample.brakeOrTerminalOwned
                || sample.state == PrototypeWaypointAutopilotState.Brake.ToString()
                || sample.state == PrototypeWaypointAutopilotState.FlipForBrake.ToString()
                || sample.state == PrototypeWaypointAutopilotState.FinalApproach.ToString();
        }

        public void Evaluate()
        {
            List<string> failures = new List<string>();

            if (scenario.expectFalseCompleteNegative)
            {
                if (finalState == PrototypeWaypointAutopilotState.Complete.ToString())
                {
                    failures.Add("negative scenario falsely reached Complete");
                }

                classification = failures.Count == 0 ? ScenarioClassification.Pass : ScenarioClassification.FailExpectedCurrentBug;
                failureSummary = failures.Count == 0 ? "negative scenario did not false-complete" : string.Join("; ", failures);
                return;
            }

            if (finalState != PrototypeWaypointAutopilotState.Complete.ToString())
            {
                failures.Add("terminal state was " + finalState + " instead of Complete");
            }

            if (finalDistance > scenario.maxArrivalError)
            {
                failures.Add("final exact target error " + FormatFloat(finalDistance) + "m > " + FormatFloat(scenario.maxArrivalError) + "m");
            }

            if (finalRelativeSpeed > scenario.maxFinalSpeed)
            {
                failures.Add("final relative speed " + FormatFloat(finalRelativeSpeed) + "m/s > " + FormatFloat(scenario.maxFinalSpeed) + "m/s");
            }

            if (finalAngularSpeed > scenario.maxFinalAngularSpeed)
            {
                failures.Add("final angular speed " + FormatFloat(finalAngularSpeed) + "rad/s > " + FormatFloat(scenario.maxFinalAngularSpeed) + "rad/s");
            }

            if (finalSafetyReplanCount > scenario.maxSafetyReplans)
            {
                failures.Add("safety replans " + finalSafetyReplanCount + " > " + scenario.maxSafetyReplans);
            }

            if (sawNearTargetReacceleration)
            {
                failures.Add("near-target re-acceleration after brake ownership");
            }

            if (!completed)
            {
                failures.Add("did not reach a terminal state within " + FormatFloat(scenario.maxCompletionTimeSeconds) + "s");
            }

            classification = failures.Count == 0 ? ScenarioClassification.Pass : ScenarioClassification.FailExpectedCurrentBug;
            failureSummary = failures.Count == 0 ? "all gates passed" : string.Join("; ", failures);
        }
    }

    private sealed class AutopilotProvingGroundScenario
    {
        public string name;
        public Vector3 targetPosition;
        public Vector3 initialShipPosition;
        public Vector3 initialShipVelocity;
        public Quaternion initialShipRotation;
        public Vector3 initialAngularVelocity;
        public ScenarioObstacle[] obstacles;
        public float maxArrivalError;
        public float maxFinalSpeed;
        public float maxFinalAngularSpeed;
        public float maxCompletionTimeSeconds;
        public int maxSafetyReplans;
        public string[] allowedPlannerProfiles;
        public bool obstacleAvoidanceExpected;
        public bool gravityEnabled;
        public bool rcsEnabled = true;
        public float rcsTranslationScale = 1f;
        public float rcsAttitudeScale = 1f;
        public float mainThrottleScale = 1f;
        public bool allowsEmergencyRecovery;
        public bool expectFalseCompleteNegative;
    }

    private readonly struct ScenarioObstacle
    {
        public readonly Vector3 position;
        public readonly float radius;
        public readonly float clearanceMeters;

        public ScenarioObstacle(Vector3 position, float radius, float clearanceMeters)
        {
            this.position = position;
            this.radius = radius;
            this.clearanceMeters = clearanceMeters;
        }
    }

    private sealed class ProvingGroundSample
    {
        public int step;
        public float time;
        public Vector3 position;
        public Vector3 velocity;
        public float distance;
        public float relativeSpeed;
        public float lateralSpeed;
        public float closingSpeed;
        public string state;
        public string navigationPhase;
        public string flightPlanPhase;
        public string activeSegmentLabel;
        public float requestedMainThrottle;
        public float actualMainThrottle;
        public float requestedRcsForceMagnitude;
        public float actualRcsForceMagnitude;
        public float requestedRcsTorqueMagnitude;
        public float actualRcsTorqueMagnitude;
        public float planElapsed;
        public float planTotalDuration;
        public int flightPlanSafetyReplanCount;
        public bool flightPlanRequiresReplan;
        public string selectedCandidate;
        public string selectedCandidateReason;
        public string obstacleStatus;
        public bool arrivalBrakeCommitted;
        public bool directFastTransferBrakeCommitted;
        public bool arrivalTerminalCaptureActive;
        public bool directFastTransferTerminalCaptureActive;
        public bool directFastTransferTerminalReacquireActive;
        public int transitionsIntoAccelerateAfterFirstBrakeCommit;
        public int brakeFlipTerminalToAccelerateTransitions;
        public float minimumDistanceReached;
        public float maximumDistanceAfterFirstEnteringTwoMeters;
        public float angularSpeed;
        public string allowedPlannerProfiles;
        public bool obstacleAvoidanceExpected;
        public bool gravityEnabled;
        public float rcsTranslationAuthority;
        public float rcsAttitudeAuthority;
        public bool brakeOrTerminalOwned;
    }

    private enum ScenarioClassification
    {
        Pass,
        FailExpectedCurrentBug,
        BlockedByTestSetup,
        NotRun
    }
}
