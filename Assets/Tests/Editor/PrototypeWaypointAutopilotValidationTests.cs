#if UNITY_EDITOR
using System;
using System.IO;
using System.Reflection;
using System.Text.RegularExpressions;
using NUnit.Framework;
using UnityEngine;

public class PrototypeWaypointAutopilotValidationTests
{
    private const BindingFlags PrivateInstance = BindingFlags.Instance | BindingFlags.NonPublic;
    private const string AutopilotRigTargetPrefix = "AutopilotRigTarget";
    private const string AutopilotRigTargetRootName = "WaypointAutopilotValidationTarget";
    private static int autopilotRigTargetCounter;

    [SetUp]
    public void SetUp()
    {
        autopilotRigTargetCounter = 0;
        CleanupValidationNavigationTargets();
        DestroyByPrefix("WaypointAutopilotValidationShip");
        DestroyByPrefix("WaypointAutopilotValidationTarget");
        DestroyByPrefix("WaypointAutopilotValidationObstacle");
        DestroyByPrefix("WaypointAutopilotValidationDetector");
        DestroyByPrefix(AutopilotRigTargetPrefix);
        PrototypeNavigationObstacleRegistry.ClearForTests();
    }

    [TearDown]
    public void TearDown()
    {
        DestroyNamed("PrototypeNavigationWaypoints");
        DestroyByPrefix("WaypointAutopilotValidationShip");
        DestroyByPrefix("WaypointAutopilotValidationTarget");
        DestroyByPrefix("WaypointAutopilotValidationObstacle");
        DestroyByPrefix("WaypointAutopilotValidationDetector");
        DestroyByPrefix(AutopilotRigTargetRootName);
        CleanupValidationNavigationTargets();
        PrototypeNavigationObstacleRegistry.ClearForTests();
    }

    [Test]
    public void WaypointManagerGeneratesThreeVisibleSelectableWaypoints()
    {
        var ship = new GameObject("WaypointAutopilotValidationShip");
        var manager = ship.AddComponent<PrototypeWaypointManager>();

        manager.EnsureDefaultWaypoints();

        PrototypeNavigationTarget[] targets = manager.NavigationTargets;
        Assert.That(targets.Length, Is.GreaterThanOrEqualTo(3));
        for (int i = 0; i < targets.Length; i++)
        {
            Assert.NotNull(targets[i]);
            Assert.False(string.IsNullOrWhiteSpace(targets[i].DisplayName));
            Assert.NotNull(targets[i].GetComponent<Renderer>());
            Assert.True(targets[i].gameObject.activeInHierarchy);
        }

        PrototypeNavigationTarget first = manager.SelectedTarget;
        PrototypeNavigationTarget next = manager.SelectNextTarget();
        Assert.AreNotSame(first, next);
        PrototypeNavigationTarget previous = manager.SelectPreviousTarget();
        Assert.AreSame(first, previous);
    }

    [Test]
    public void AutopilotStateEnumContainsRequiredStatesExactly()
    {
        string[] names = Enum.GetNames(typeof(PrototypeWaypointAutopilotState));

        CollectionAssert.AreEquivalent(new[]
        {
            "Idle",
            "TargetSelected",
            "FuelCheck",
            "AlignForBurn",
            "Accelerate",
            "ObstacleAvoidance",
            "FlipForBrake",
            "Brake",
            "FinalApproach",
            "HoldPosition",
            "Complete",
            "Aborted",
            "FuelInsufficient",
            "Failed"
        }, names);
    }

    [Test]
    public void TrajectoryPhaseEnumContainsRequestedNavigationComputerPhases()
    {
        string[] names = Enum.GetNames(typeof(PrototypeTrajectoryPhase));

        CollectionAssert.IsSubsetOf(new[]
        {
            "Idle",
            "AlignForBurn",
            "LongRangeBurn",
            "Coast",
            "Avoidance",
            "Brake",
            "FinalApproach",
            "Hold",
            "Failed"
        }, names);
    }

    [Test]
    public void MetricsComputeClosingLateralAndStoppingDistance()
    {
        PrototypeWaypointAutopilotMetrics metrics = PrototypeWaypointAutopilot.CalculateMetrics(
            Vector3.zero,
            new Vector3(3f, 0f, 20f),
            new Vector3(0f, 0f, 100f),
            5f,
            10f);

        Assert.That(metrics.distance, Is.EqualTo(100f).Within(0.0001f));
        Assert.That(metrics.closingSpeed, Is.EqualTo(20f).Within(0.0001f));
        Assert.That(metrics.lateralSpeed, Is.EqualTo(3f).Within(0.0001f));
        Assert.That(metrics.stoppingDistance, Is.EqualTo(40f).Within(0.0001f));
        Assert.False(metrics.shouldBrake);
        Assert.True(metrics.isFinite);
    }

    [Test]
    public void MetricsTreatAwayFromTargetVelocityAsZeroStoppingDistance()
    {
        PrototypeWaypointAutopilotMetrics metrics = PrototypeWaypointAutopilot.CalculateMetrics(
            Vector3.zero,
            new Vector3(0f, 0f, -25f),
            new Vector3(0f, 0f, 100f),
            5f,
            10f);

        Assert.That(metrics.closingSpeed, Is.EqualTo(-25f).Within(0.0001f));
        Assert.That(metrics.stoppingDistance, Is.EqualTo(0f).Within(0.0001f));
        Assert.False(metrics.shouldBrake);
    }

    [Test]
    public void ForwardInitialVelocityChangesBrakingDecision()
    {
        PrototypeWaypointAutopilotMetrics slow = PrototypeWaypointAutopilot.CalculateMetrics(
            Vector3.zero,
            new Vector3(0f, 0f, 10f),
            new Vector3(0f, 0f, 100f),
            5f,
            10f);
        PrototypeWaypointAutopilotMetrics fast = PrototypeWaypointAutopilot.CalculateMetrics(
            Vector3.zero,
            new Vector3(0f, 0f, 30f),
            new Vector3(0f, 0f, 100f),
            5f,
            10f);

        Assert.That(fast.stoppingDistance, Is.GreaterThan(slow.stoppingDistance));
        Assert.False(slow.shouldBrake);
        Assert.True(fast.shouldBrake);
    }

    [Test]
    public void AutopilotRestTargetAheadRequestsLongRangeBurn()
    {
        var rig = CreateAutopilotRig();
        ShipStats stats = rig.Ship.GetComponent<ShipStats>();
        SetPrivateFloat(stats, "currentFuelKg", 25f);
        rig.Body.linearVelocity = Vector3.zero;
        rig.Target.transform.position = Vector3.forward * 150f;
        rig.Autopilot.SelectTarget(rig.Target);
        rig.Autopilot.ToggleAutopilot();
        InvokeFixedUpdate(rig.Autopilot);

        Assert.True(rig.Autopilot.AutopilotEngaged);
        Assert.That(rig.Autopilot.ArrivalPhase, Is.EqualTo(PrototypeWaypointAutopilotArrivalPhase.LongRangeBurn));
        Assert.That(rig.Autopilot.RequestedMainThrottle, Is.GreaterThan(0.8f));
        Assert.That(rig.Autopilot.DesiredBurnDirection.z, Is.GreaterThan(0.98f));
        Assert.False(rig.Autopilot.ArrivalFailureReason == "FuelInsufficient");
    }

    [Test]
    public void AutopilotForwardVelocityTriggersBrakeEarlierThanRestCase()
    {
        var restRig = CreateAutopilotRig();
        restRig.Target.transform.position = Vector3.forward * 150f;
        restRig.Body.linearVelocity = Vector3.zero;
        restRig.Autopilot.SelectTarget(restRig.Target);
        restRig.Autopilot.ToggleAutopilot();
        InvokeFixedUpdate(restRig.Autopilot);
        Assert.That(restRig.Autopilot.ArrivalPhase, Is.Not.EqualTo(PrototypeWaypointAutopilotArrivalPhase.Brake));

        restRig.Autopilot.ToggleAutopilot();

        var fastRig = CreateAutopilotRig();
        fastRig.Target.transform.position = Vector3.forward * 150f;
        fastRig.Body.linearVelocity = Vector3.forward * 45f;
        fastRig.Autopilot.SelectTarget(fastRig.Target);
        fastRig.Autopilot.ToggleAutopilot();
        InvokeFixedUpdate(fastRig.Autopilot);
        Assert.That(fastRig.Autopilot.ArrivalPhase, Is.EqualTo(PrototypeWaypointAutopilotArrivalPhase.Brake));
    }

    [Test]
    public void AutopilotFastApproachFlipsBeforeMainDecelBurn()
    {
        var rig = CreateAutopilotRig();
        rig.Target.transform.position = Vector3.forward * 150f;
        rig.Body.linearVelocity = Vector3.forward * 45f;
        rig.Autopilot.SelectTarget(rig.Target);
        rig.Autopilot.ToggleAutopilot();

        InvokeFixedUpdate(rig.Autopilot);

        Assert.That(rig.Autopilot.ArrivalPhase, Is.EqualTo(PrototypeWaypointAutopilotArrivalPhase.Brake));
        Assert.That(rig.Autopilot.CurrentState, Is.EqualTo(PrototypeWaypointAutopilotState.FlipForBrake));
        Assert.That(rig.Controller.LastExternalFlightAssistRequest.mainThrottle, Is.EqualTo(0f).Within(0.0001f));
        Assert.That(rig.Controller.LastExternalFlightAssistRequest.torqueLocal.magnitude, Is.GreaterThan(1000f));

        InvokeFixedUpdate(rig.Controller);
        Assert.That(rig.Controller.LastRcsDesiredTorqueWorld.magnitude, Is.GreaterThan(1000f));
        Assert.That(rig.Controller.MainThrustCommand, Is.EqualTo(0f).Within(0.0001f));

        rig.Ship.transform.rotation = Quaternion.LookRotation(Vector3.back, Vector3.up);
        InvokeFixedUpdate(rig.Autopilot);

        Assert.That(rig.Autopilot.CurrentState, Is.EqualTo(PrototypeWaypointAutopilotState.Brake));
        Assert.That(rig.Controller.LastExternalFlightAssistRequest.mainThrottle, Is.GreaterThan(0.5f));
        InvokeFixedUpdate(rig.Controller);
        Assert.That(rig.Controller.MainThrustCommand, Is.GreaterThan(0.5f));
    }

    [Test]
    public void AutopilotClosedLoopApproachBrakesWithoutManualAlignment()
    {
        SimulationMode previousSimulationMode = Physics.simulationMode;
        Physics.simulationMode = SimulationMode.Script;
        try
        {
            var rig = CreateAutopilotRig();
            rig.Target.transform.position = Vector3.forward * 150f;
            rig.Body.linearVelocity = Vector3.forward * 45f;
            rig.Body.angularVelocity = Vector3.zero;
            rig.Autopilot.SelectTarget(rig.Target);
            rig.Autopilot.ToggleAutopilot();

            float initialRetrogradeAngle = Vector3.Angle(rig.Ship.transform.forward, -rig.Body.linearVelocity.normalized);
            float minRetrogradeAngle = initialRetrogradeAngle;
            bool sawRcsTorque = false;
            bool sawMainThrottleApplication = false;
            bool sawBrakeForceOpposingVelocity = false;
            bool mainCommandAfterAlignment = false;

            for (int i = 0; i < 300; i++)
            {
                InvokeFixedUpdate(rig.Autopilot);
                InvokeFixedUpdate(rig.Controller);
                Physics.Simulate(Time.fixedDeltaTime);

                if (rig.Body.linearVelocity.sqrMagnitude > 0.0001f)
                {
                    float retrogradeAngle = Vector3.Angle(rig.Ship.transform.forward, -rig.Body.linearVelocity.normalized);
                    minRetrogradeAngle = Mathf.Min(minRetrogradeAngle, retrogradeAngle);
                }

                if (rig.Controller.LastRcsActualTorqueWorld.magnitude > 100f)
                {
                    sawRcsTorque = true;
                }

                if (Vector3.Dot(rig.Controller.LastMainForceWorld, rig.Body.linearVelocity) < -0.01f)
                {
                    sawBrakeForceOpposingVelocity = true;
                }

                if (rig.Controller.MainThrustCommand > 0.05f)
                {
                    sawMainThrottleApplication = true;
                    float angleToRetrograde = rig.Body.linearVelocity.sqrMagnitude > 0.0001f
                        ? Vector3.Angle(rig.Ship.transform.forward, -rig.Body.linearVelocity.normalized)
                        : minRetrogradeAngle;
                    if (!mainCommandAfterAlignment && angleToRetrograde <= 30f)
                    {
                        mainCommandAfterAlignment = true;
                    }
                }
            }

            Assert.That(minRetrogradeAngle, Is.LessThan(initialRetrogradeAngle - 45f), "ship should visibly rotate toward retrograde under autopilot RCS torque");
            Assert.True(sawRcsTorque, "autopilot should produce actual RCS torque in the closed-loop simulation");
            Assert.True(mainCommandAfterAlignment, "main thruster should only become active after the ship is near retrograde alignment");
            Assert.True(sawBrakeForceOpposingVelocity, "main thruster force should oppose the approach velocity during the deceleration burn");
            Assert.True(sawMainThrottleApplication, "autopilot should eventually command main throttle for the deceleration burn");
        }
        finally
        {
            Physics.simulationMode = previousSimulationMode;
        }
    }

    [Test]
    public void ToggleAutopilotForcesSasKillRotationBeforeBrakeWhenHoldAttitudeWasActive()
    {
        var rig = CreateAutopilotRig();
        rig.Target.transform.position = Vector3.forward * 150f;
        rig.Body.linearVelocity = Vector3.forward * 45f;
        rig.Autopilot.SelectTarget(rig.Target);
        rig.Controller.SetSasMode(SasControlMode.HoldAttitude);
        var rcsController = rig.Ship.GetComponent<RcsThrusterController>();
        Assert.NotNull(rcsController);

        rig.Autopilot.ToggleAutopilot();
        InvokeFixedUpdate(rig.Autopilot);
        InvokeFixedUpdate(rig.Controller);

        Assert.That(rig.Controller.SasMode, Is.EqualTo(SasControlMode.KillRotation));
        Assert.That(rcsController.LastSasMode, Is.EqualTo(SasControlMode.KillRotation));
        Assert.That(rig.Autopilot.CurrentState, Is.EqualTo(PrototypeWaypointAutopilotState.FlipForBrake));
        Assert.That(rig.Controller.LastExternalFlightAssistRequest.mainThrottle, Is.EqualTo(0f).Within(0.0001f));
        Assert.That(rig.Controller.LastExternalFlightAssistRequest.torqueLocal.magnitude, Is.GreaterThan(1000f));
        Assert.That(rig.Controller.MainThrottle, Is.EqualTo(0f).Within(0.0001f));
        Assert.That(rig.Controller.MainThrustCommand, Is.EqualTo(0f).Within(0.0001f));

        rig.Ship.transform.rotation = Quaternion.LookRotation(Vector3.back, Vector3.up);
        InvokeFixedUpdate(rig.Autopilot);
        InvokeFixedUpdate(rig.Controller);

        Assert.That(rig.Autopilot.CurrentState, Is.EqualTo(PrototypeWaypointAutopilotState.Brake));
        Assert.That(rig.Controller.LastExternalFlightAssistRequest.mainThrottle, Is.GreaterThan(0.5f));
        Assert.That(rig.Controller.MainThrustCommand, Is.GreaterThan(0.5f));
    }

    [Test]
    public void AutopilotLateralVelocityRequestsCorrection()
    {
        var rig = CreateAutopilotRig();
        rig.Target.transform.position = Vector3.forward * 80f;
        rig.Body.linearVelocity = Vector3.right * 4f;
        rig.Autopilot.SelectTarget(rig.Target);
        rig.Autopilot.ToggleAutopilot();
        InvokeFixedUpdate(rig.Autopilot);

        Assert.That(rig.Autopilot.ArrivalPhase, Is.EqualTo(PrototypeWaypointAutopilotArrivalPhase.LateralCorrection));
        Assert.True(rig.Controller.HasExternalFlightAssistRequest);
        Assert.That(rig.Controller.LastExternalFlightAssistRequest.forceWorld.x, Is.LessThan(-0.0001f));
    }

    [Test]
    public void ObstacleDetectorFindsDirectTriggerObstacleIgnoresOwnShipAndClearsEmptyPath()
    {
        var ship = new GameObject("WaypointAutopilotValidationShip");
        Rigidbody body = ship.AddComponent<Rigidbody>();
        body.useGravity = false;
        var ownColliderObject = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        ownColliderObject.name = "WaypointAutopilotValidationShipCollider";
        ownColliderObject.transform.SetParent(ship.transform, false);
        ownColliderObject.transform.localPosition = Vector3.forward * 4f;
        Collider ownCollider = ownColliderObject.GetComponent<Collider>();
        ownCollider.isTrigger = true;

        var detectorObject = new GameObject("WaypointAutopilotValidationDetector");
        var detector = detectorObject.AddComponent<PrototypeObstacleDetector>();
        GameObject obstacle = CreateObstacle("WaypointAutopilotValidationObstacle", Vector3.forward * 40f, 5f);
        Physics.SyncTransforms();

        PrototypeObstacleDetectionResult hit = detector.DetectDirectPath(body, Vector3.forward * 100f, 3f);
        PrototypeObstacleDetectionResult clear = detector.DetectDirectPath(body, Vector3.right * 100f, 3f);

        Assert.True(hit.detected);
        Assert.AreSame(obstacle.GetComponent<PrototypeNavigationObstacle>(), hit.obstacle);
        Assert.AreNotSame(ownCollider, hit.collider);
        Assert.True(clear.IsClear);
    }

    [Test]
    public void NavigationObstacleExposesSpecShapeAndDetectorFindsColliderlessFallback()
    {
        var ship = new GameObject("WaypointAutopilotValidationShip");
        Rigidbody body = ship.AddComponent<Rigidbody>();
        body.useGravity = false;

        var detectorObject = new GameObject("WaypointAutopilotValidationDetector");
        var detector = detectorObject.AddComponent<PrototypeObstacleDetector>();
        detector.SetIncludeNavigationObstacleComponentsWithoutCollider(true);
        var ignoredObject = new GameObject("WaypointAutopilotValidationObstacleIgnored");
        ignoredObject.transform.position = Vector3.forward * 25f;
        ignoredObject.AddComponent<PrototypeNavigationObstacle>().Configure(8f, 4f, false);
        var obstacleObject = new GameObject("WaypointAutopilotValidationObstacleFallback");
        obstacleObject.transform.position = Vector3.forward * 45f;
        PrototypeNavigationObstacle obstacle = obstacleObject.AddComponent<PrototypeNavigationObstacle>();
        obstacle.Configure(6f, 3f, true);
        obstacle.SetDebugGizmoVisible(false);

        PrototypeObstacleDetectionResult hit = detector.DetectDirectPath(body, Vector3.forward * 100f, 2f);

        Assert.That(obstacle.DisplayName, Is.Not.Empty);
        Assert.That(obstacle.Radius, Is.EqualTo(6f).Within(0.0001f));
        Assert.That(obstacle.ClearanceMeters, Is.EqualTo(3f).Within(0.0001f));
        Assert.That(obstacle.WorldPosition, Is.EqualTo(obstacleObject.transform.position));
        Assert.That(obstacle.EffectiveClearanceRadius, Is.GreaterThanOrEqualTo(9f));
        Assert.False(obstacle.ShowDebugGizmo);
        Assert.True(hit.hasObstacle);
        Assert.True(hit.detected);
        Assert.AreSame(obstacle, hit.obstacle);
        Assert.IsNull(hit.collider);
        Assert.That(hit.hitPoint, Is.EqualTo(hit.point));
        Assert.That(hit.hitNormal, Is.EqualTo(hit.normal));
        Assert.That(hit.hitDistance, Is.EqualTo(hit.distance).Within(0.0001f));
        Assert.That(hit.avoidanceDirection.sqrMagnitude, Is.GreaterThan(0.1f));
        Assert.That(hit.status, Is.EqualTo(obstacle.DisplayName));
    }

    [Test]
    public void DirectObstaclePlansAvoidanceAndAutopilotDoesNotBurnIntoObstacle()
    {
        var rig = CreateAutopilotRig();
        rig.Target.transform.position = Vector3.forward * 150f;
        rig.Body.linearVelocity = Vector3.zero;
        CreateObstacle("WaypointAutopilotValidationObstacle", Vector3.forward * 55f, 8f);
        Physics.SyncTransforms();

        rig.Autopilot.SelectTarget(rig.Target);
        rig.Autopilot.ToggleAutopilot();
        InvokeFixedUpdate(rig.Autopilot);

        Assert.True(rig.Autopilot.NavigationObstacleDetected);
        Assert.That(rig.Autopilot.CurrentState, Is.EqualTo(PrototypeWaypointAutopilotState.ObstacleAvoidance));
        Assert.That(rig.Autopilot.LastTrajectoryPhase, Is.EqualTo(PrototypeTrajectoryPhase.Avoidance));
        Assert.That(Vector3.Dot(rig.Autopilot.DesiredBurnDirection.normalized, rig.Autopilot.LastTrajectoryPlan.obstacleDirection.normalized), Is.LessThan(0.76f));
        Assert.True(rig.Autopilot.CurrentPlan.isValid);
        Assert.True(rig.Autopilot.CurrentPlan.avoidanceActive);
        Assert.That(rig.Autopilot.CurrentPlan.desiredBurnDirectionWorld, Is.EqualTo(rig.Autopilot.LastTrajectoryPlan.desiredBurnDirection));
        Assert.That(rig.Autopilot.CurrentPlan.requestedMainThrottle, Is.EqualTo(rig.Autopilot.RequestedMainThrottle).Within(0.0001f));
        Assert.That(rig.Autopilot.ObstacleStatus, Does.Contain("@"));
        Assert.That(rig.Autopilot.AvoidanceWaypoint.sqrMagnitude, Is.GreaterThan(0.1f));
        Assert.That(rig.Autopilot.PlannedStoppingDistance, Is.GreaterThanOrEqualTo(0f));
        Assert.That(rig.Autopilot.RequestedAcceleration.sqrMagnitude, Is.GreaterThan(0.1f));
        Assert.That(rig.Autopilot.RequestedRcsForce, Is.EqualTo(rig.Autopilot.RequestedRcsTranslation));
        Assert.That(rig.Autopilot.FailureReason, Is.EqualTo(rig.Autopilot.ArrivalFailureReason));
        Assert.That(rig.Controller.LastExternalFlightAssistRequest.source, Is.EqualTo(FlightAssistRequestSource.WaypointAutopilot));
        Assert.False(rig.Controller.LastExternalFlightAssistRequest.debugOnlyNonPhysical);
    }

    [Test]
    public void UrgentBrakeWithDirectObstacleKeepsObstacleDiagnosticsAndRequestsRetrograde()
    {
        var rig = CreateAutopilotRig();
        rig.Target.transform.position = Vector3.forward * 150f;
        rig.Body.linearVelocity = Vector3.forward * 45f;
        CreateObstacle("WaypointAutopilotValidationObstacle", Vector3.forward * 55f, 8f);
        Physics.SyncTransforms();

        rig.Autopilot.SelectTarget(rig.Target);
        rig.Autopilot.ToggleAutopilot();
        InvokeFixedUpdate(rig.Autopilot);

        Assert.True(rig.Autopilot.NavigationObstacleDetected);
        Assert.True(rig.Autopilot.CurrentPlan.avoidanceActive);
        Assert.That(rig.Autopilot.ArrivalPhase, Is.EqualTo(PrototypeWaypointAutopilotArrivalPhase.Brake));
        Assert.That(rig.Autopilot.CurrentState, Is.EqualTo(PrototypeWaypointAutopilotState.FlipForBrake));
        Assert.That(rig.Autopilot.DesiredBurnDirection.z, Is.LessThan(-0.98f));
        Assert.That(rig.Controller.LastExternalFlightAssistRequest.torqueLocal.magnitude, Is.GreaterThan(1000f));
        Assert.That(rig.Controller.LastExternalFlightAssistRequest.mainThrottle, Is.EqualTo(0f).Within(0.0001f));

        rig.Ship.transform.rotation = Quaternion.LookRotation(Vector3.back, Vector3.up);
        InvokeFixedUpdate(rig.Autopilot);

        Assert.That(rig.Autopilot.CurrentState, Is.EqualTo(PrototypeWaypointAutopilotState.Brake));
        Assert.That(rig.Controller.LastExternalFlightAssistRequest.mainThrottle, Is.GreaterThan(0.5f));
    }

    [Test]
    public void DisengagedAutopilotDoesNotRefreshNavigationPlanInFixedUpdate()
    {
        var rig = CreateAutopilotRig();
        rig.Target.transform.position = Vector3.forward * 150f;
        CreateObstacle("WaypointAutopilotValidationObstacle", Vector3.forward * 55f, 8f);
        Physics.SyncTransforms();

        int before = rig.Autopilot.NavigationPlanRefreshCount;
        InvokeFixedUpdate(rig.Autopilot);
        InvokeFixedUpdate(rig.Autopilot);

        Assert.False(rig.Autopilot.AutopilotEngaged);
        Assert.That(rig.Autopilot.NavigationPlanRefreshCount, Is.EqualTo(before));
        Assert.False(rig.Autopilot.NavigationObstacleDetected);
    }

    [Test]
    public void ReplanNowRefreshesNavigationPlanWhileDisengaged()
    {
        var rig = CreateAutopilotRig();
        rig.Target.transform.position = Vector3.forward * 150f;
        CreateObstacle("WaypointAutopilotValidationObstacle", Vector3.forward * 55f, 8f);
        Physics.SyncTransforms();

        int before = rig.Autopilot.NavigationPlanRefreshCount;
        rig.Autopilot.ReplanNow();

        Assert.False(rig.Autopilot.AutopilotEngaged);
        Assert.That(rig.Autopilot.NavigationPlanRefreshCount, Is.EqualTo(before + 1));
        Assert.True(rig.Autopilot.NavigationObstacleDetected);
    }

    [Test]
    public void EngagedAutopilotThrottlesNavigationPlanRefreshesInsideInterval()
    {
        var rig = CreateAutopilotRig();
        rig.Target.transform.position = Vector3.forward * 150f;
        rig.Body.linearVelocity = Vector3.zero;
        rig.Autopilot.SelectTarget(rig.Target);
        rig.Autopilot.ToggleAutopilot();

        InvokeFixedUpdate(rig.Autopilot);
        int afterFirstTick = rig.Autopilot.NavigationPlanRefreshCount;
        InvokeFixedUpdate(rig.Autopilot);
        InvokeFixedUpdate(rig.Autopilot);

        Assert.True(rig.Autopilot.AutopilotEngaged);
        Assert.That(afterFirstTick, Is.EqualTo(1));
        Assert.That(rig.Autopilot.NavigationPlanRefreshCount, Is.EqualTo(afterFirstTick));
        Assert.That(rig.Autopilot.NavigationPlanIntervalSeconds, Is.InRange(0.1f, 0.25f));
    }

    [Test]
    public void ObstacleDetectorSourceDoesNotUseGlobalFindObjectsFallback()
    {
        string sourceFile = Path.Combine(Directory.GetCurrentDirectory(), "Assets", "Scripts", "Prototype", "PrototypeObstacleDetector.cs");
        Assert.True(File.Exists(sourceFile), sourceFile);

        string source = File.ReadAllText(sourceFile);

        Assert.False(source.Contains("FindObjectsByType<PrototypeNavigationObstacle>"), "Detector fallback must use PrototypeNavigationObstacleRegistry.");
        Assert.False(source.Contains("FindObjectsOfType<PrototypeNavigationObstacle>"), "Detector fallback must use PrototypeNavigationObstacleRegistry.");
    }

    [Test]
    public void LateralCorrectionForceScalesWithMassAndClampsToAuthority()
    {
        var lightRig = CreateAutopilotRig();
        SetPrivateFloat(lightRig.Ship.GetComponent<RcsThrusterController>(), "translationForce", 10000f);
        lightRig.Body.mass = 100f;
        lightRig.Target.transform.position = Vector3.forward * 80f;
        lightRig.Body.linearVelocity = Vector3.right;
        lightRig.Autopilot.SelectTarget(lightRig.Target);
        lightRig.Autopilot.ToggleAutopilot();
        InvokeFixedUpdate(lightRig.Autopilot);

        var heavyRig = CreateAutopilotRig();
        SetPrivateFloat(heavyRig.Ship.GetComponent<RcsThrusterController>(), "translationForce", 10000f);
        heavyRig.Body.mass = 1000f;
        heavyRig.Target.transform.position = Vector3.forward * 80f;
        heavyRig.Body.linearVelocity = Vector3.right;
        heavyRig.Autopilot.SelectTarget(heavyRig.Target);
        heavyRig.Autopilot.ToggleAutopilot();
        InvokeFixedUpdate(heavyRig.Autopilot);

        var clampedRig = CreateAutopilotRig();
        SetPrivateFloat(clampedRig.Ship.GetComponent<RcsThrusterController>(), "translationForce", 25f);
        clampedRig.Body.mass = 1000f;
        clampedRig.Target.transform.position = Vector3.forward * 80f;
        clampedRig.Body.linearVelocity = Vector3.right * 6f;
        clampedRig.Autopilot.SelectTarget(clampedRig.Target);
        clampedRig.Autopilot.ToggleAutopilot();
        InvokeFixedUpdate(clampedRig.Autopilot);

        Assert.That(lightRig.Autopilot.RequestedRcsTranslation.magnitude, Is.GreaterThan(0f));
        Assert.That(heavyRig.Autopilot.RequestedRcsTranslation.magnitude, Is.GreaterThan(lightRig.Autopilot.RequestedRcsTranslation.magnitude * 2f));
        Assert.That(clampedRig.Autopilot.RequestedRcsTranslation.magnitude, Is.LessThanOrEqualTo(25.001f));
    }

    [Test]
    public void ArrivalAllowsSlightNegativeClosingSpeedAndHoldDampensResidualVelocity()
    {
        var completeRig = CreateAutopilotRig();
        completeRig.Target.transform.position = Vector3.forward * 5f;
        completeRig.Body.linearVelocity = Vector3.back * 0.05f;
        completeRig.Autopilot.SelectTarget(completeRig.Target);
        completeRig.Autopilot.ToggleAutopilot();
        InvokeFixedUpdate(completeRig.Autopilot);

        Assert.That(completeRig.Autopilot.CurrentState, Is.EqualTo(PrototypeWaypointAutopilotState.HoldPosition));
        Assert.True(completeRig.Autopilot.AutopilotEngaged);

        var holdRig = CreateAutopilotRig();
        holdRig.Target.transform.position = Vector3.forward * 5f;
        holdRig.Body.linearVelocity = Vector3.back * 0.5f;
        holdRig.Autopilot.SelectTarget(holdRig.Target);
        holdRig.Autopilot.ToggleAutopilot();
        InvokeFixedUpdate(holdRig.Autopilot);

        Assert.True(holdRig.Autopilot.AutopilotEngaged);
        Assert.That(holdRig.Autopilot.CurrentState, Is.EqualTo(PrototypeWaypointAutopilotState.HoldPosition));
        Assert.That(holdRig.Autopilot.RequestedRcsTranslation.z, Is.GreaterThan(0f));
        Assert.That(holdRig.Controller.LastExternalFlightAssistRequest.forceWorld.z, Is.GreaterThan(0f));
    }

    [Test]
    public void NoAuthorityAndFuelInsufficientDoNotCreatePhysicalRequest()
    {
        var noAuthorityRig = CreateAutopilotRig();
        SetPrivateFloat(noAuthorityRig.Ship.GetComponent<RcsThrusterController>(), "translationForce", 0f);
        UnityEngine.Object.DestroyImmediate(noAuthorityRig.Ship.GetComponent<MainThrusterModule>());
        SetPrivateField(noAuthorityRig.Ship.GetComponent<MainThrusterBank>(), "thrusters", new MainThrusterModule[0]);
        noAuthorityRig.Target.transform.position = Vector3.forward * 120f;
        noAuthorityRig.Autopilot.SelectTarget(noAuthorityRig.Target);
        noAuthorityRig.Autopilot.ToggleAutopilot();

        Assert.False(noAuthorityRig.Autopilot.AutopilotEngaged);
        Assert.That(noAuthorityRig.Autopilot.ArrivalFailureReason, Is.EqualTo("NoAuthority"));
        Assert.False(noAuthorityRig.Controller.HasExternalFlightAssistRequest);

        var fuelRig = CreateAutopilotRig();
        SetPrivateFloat(fuelRig.Ship.GetComponent<ShipStats>(), "currentFuelKg", 0f);
        fuelRig.Target.transform.position = Vector3.forward * 120f;
        fuelRig.Autopilot.SelectTarget(fuelRig.Target);
        fuelRig.Autopilot.ToggleAutopilot();

        Assert.False(fuelRig.Autopilot.AutopilotEngaged);
        Assert.That(fuelRig.Autopilot.ArrivalFailureReason, Is.EqualTo("FuelInsufficient"));
        Assert.False(fuelRig.Controller.HasExternalFlightAssistRequest);
    }

    [Test]
    public void AutopilotTooCloseAndFastRequestsBrake()
    {
        var rig = CreateAutopilotRig();
        rig.Target.transform.position = Vector3.forward * 12f;
        rig.Body.linearVelocity = Vector3.forward * 20f;
        rig.Autopilot.SelectTarget(rig.Target);
        rig.Autopilot.ToggleAutopilot();
        InvokeFixedUpdate(rig.Autopilot);

        Assert.That(rig.Autopilot.ArrivalPhase, Is.EqualTo(PrototypeWaypointAutopilotArrivalPhase.Brake));
        Assert.That(rig.Autopilot.CurrentState, Is.Not.EqualTo(PrototypeWaypointAutopilotState.Complete));
    }

    [Test]
    public void AutopilotNoRcsAllowsCoarseBurnAndReportsLimitedApproach()
    {
        var fastBurnRig = CreateAutopilotRig();
        fastBurnRig.Controller.SetRcsEnabled(false);
        fastBurnRig.Target.transform.position = Vector3.forward * 150f;
        fastBurnRig.Body.linearVelocity = Vector3.zero;
        fastBurnRig.Autopilot.SelectTarget(fastBurnRig.Target);
        fastBurnRig.Autopilot.ToggleAutopilot();
        InvokeFixedUpdate(fastBurnRig.Autopilot);

        Assert.That(fastBurnRig.Autopilot.ArrivalPhase, Is.EqualTo(PrototypeWaypointAutopilotArrivalPhase.LongRangeBurn));
        Assert.That(fastBurnRig.Autopilot.RequestedMainThrottle, Is.GreaterThan(0.8f));
        Assert.False(fastBurnRig.Autopilot.LimitedFinalApproachCapability);

        var approachRig = CreateAutopilotRig();
        SetPrivateFloat(approachRig.Ship.GetComponent<RcsThrusterController>(), "translationForce", 0f);
        approachRig.Target.Configure("ApproachTarget", 10f);
        approachRig.Target.transform.position = Vector3.forward * 12f;
        approachRig.Body.linearVelocity = Vector3.zero;
        approachRig.Autopilot.SelectTarget(approachRig.Target);
        approachRig.Autopilot.ToggleAutopilot();
        InvokeFixedUpdate(approachRig.Autopilot);

        Assert.That(approachRig.Autopilot.ArrivalPhase, Is.EqualTo(PrototypeWaypointAutopilotArrivalPhase.FinalApproach));
        Assert.True(approachRig.Autopilot.LimitedFinalApproachCapability);
        Assert.That(approachRig.Autopilot.ArrivalFailureReason, Is.EqualTo("LimitedRcsAuthority"));
    }

    [Test]
    public void AutopilotManualOverrideAfterGraceAbortsAndClearsRequest()
    {
        var rig = CreateAutopilotRig();
        rig.Target.transform.position = Vector3.forward * 120f;
        rig.Body.linearVelocity = Vector3.zero;
        rig.Autopilot.SelectTarget(rig.Target);
        rig.Autopilot.ToggleAutopilot();
        SetPrivateFloat(rig.Autopilot, "manualOverrideGraceUntilTime", -10f);
        SetPrivateProperty(rig.Controller, "LastManualFlightInput", true);
        InvokeUpdate(rig.Autopilot);
        InvokeFixedUpdate(rig.Autopilot);

        Assert.That(rig.Autopilot.CurrentState, Is.EqualTo(PrototypeWaypointAutopilotState.Aborted));
        Assert.False(rig.Autopilot.AutopilotEngaged);
        Assert.False(rig.Controller.HasExternalFlightAssistRequest);
        Assert.That(rig.Autopilot.ArrivalFailureReason, Is.EqualTo("manual override"));
    }

    [Test]
    public void FuelEstimateRejectsFarTargetWithLowFuelButAllowsFuelFreeThrust()
    {
        GameObject ship = new GameObject("WaypointAutopilotValidationShip");
        ShipStats stats = ship.AddComponent<ShipStats>();
        SetPrivateFloat(stats, "currentFuelKg", 0.1f);
        SetPrivateFloat(stats, "fullThrottleFuelKgPerSecond", 0.6f);

        PrototypeWaypointAutopilotMetrics far = PrototypeWaypointAutopilot.CalculateMetrics(
            Vector3.zero,
            Vector3.zero,
            new Vector3(0f, 0f, 50000f),
            5f,
            10f);
        PrototypeWaypointFuelEstimate lowFuel = PrototypeWaypointAutopilot.EstimateFuel(far, stats, 5f, 8f);

        Assert.False(lowFuel.isFeasible);
        Assert.That(lowFuel.requiredBurnSeconds, Is.GreaterThan(lowFuel.availableBurnSeconds));

        SetPrivateFloat(stats, "fullThrottleFuelKgPerSecond", 0f);
        PrototypeWaypointFuelEstimate fuelFree = PrototypeWaypointAutopilot.EstimateFuel(far, stats, 5f, 8f);

        Assert.True(fuelFree.isFuelFree);
        Assert.True(fuelFree.isFeasible);
    }

    [Test]
    public void AutopilotReportsFuelInsufficientBeforeCommandingLowFuelManeuver()
    {
        GameObject ship = CreateShipRig();
        var manager = ship.AddComponent<PrototypeWaypointManager>();
        manager.EnsureDefaultWaypoints();
        var autopilot = ship.GetComponent<PrototypeWaypointAutopilot>() ?? ship.AddComponent<PrototypeWaypointAutopilot>();
        ShipStats stats = ship.GetComponent<ShipStats>();
        SetPrivateFloat(stats, "currentFuelKg", 0f);

        autopilot.Bind(manager, ship.GetComponent<PlayerShipController>(), stats, ship.GetComponent<Rigidbody>());
        autopilot.SelectTarget(manager.SelectedTarget);
        autopilot.ToggleAutopilot();

        Assert.That(autopilot.CurrentState, Is.EqualTo(PrototypeWaypointAutopilotState.FuelInsufficient));
        Assert.False(autopilot.AutopilotEngaged);
        Assert.That(ship.GetComponent<PlayerShipController>().MainThrottle, Is.EqualTo(0f).Within(0.0001f));
    }

    [Test]
    public void AutopilotSourceDoesNotAssignRigidbodyMotionStateDirectly()
    {
        string sourceFile = Path.Combine(Directory.GetCurrentDirectory(), "Assets", "Scripts", "Prototype", "PrototypeWaypointAutopilot.cs");
        Assert.True(File.Exists(sourceFile), sourceFile);

        string[] lines = File.ReadAllLines(sourceFile);
        Regex directRigidbodyWrite = new Regex(@"\.(position|rotation|linearVelocity|angularVelocity)\s*=", RegexOptions.Compiled);
        for (int i = 0; i < lines.Length; i++)
        {
            string noComments = StripComments(lines[i]);
            Assert.False(directRigidbodyWrite.IsMatch(noComments), $"Direct Rigidbody write detected in PrototypeWaypointAutopilot.cs line {i + 1}: {lines[i]}");
        }
    }

    private static GameObject CreateShipRig()
    {
        GameObject ship = new GameObject("WaypointAutopilotValidationShip");
        Rigidbody body = ship.AddComponent<Rigidbody>();
        body.useGravity = false;
        ShipStats stats = ship.AddComponent<ShipStats>();
        ShipPhysicsCore physicsCore = ship.AddComponent<ShipPhysicsCore>();
        ship.AddComponent<GunModule>();
        var mainThruster = ship.AddComponent<MainThrusterBank>();
        ship.AddComponent<EngineVfxController>();
        var rcs = ship.AddComponent<RcsThrusterController>();
        var mainModule = ship.AddComponent<MainThrusterModule>();
        ship.AddComponent<PlayerShipController>();
        mainModule.Configure(ship.transform, body, stats, physicsCore);
        mainThruster.Configure(new[] { mainModule }, body, stats, physicsCore);
        ConfigureRcsNozzles(ship.transform, rcs, body, physicsCore);
        physicsCore.Configure(body);
        stats.ApplyMassProperties(body);
        return ship;
    }

    private static AutopilotRig CreateAutopilotRig()
    {
        GameObject ship = CreateShipRig();
        GameObject root = EnsureAutopilotRigTargetRoot();
        var target = new GameObject($"{AutopilotRigTargetPrefix}_{autopilotRigTargetCounter++}");
        target.transform.SetParent(root.transform, false);
        target.AddComponent<PrototypeNavigationTarget>().Configure("ValidationTarget", 10f);
        var autopilot = ship.GetComponent<PrototypeWaypointAutopilot>() ?? ship.AddComponent<PrototypeWaypointAutopilot>();
        var controller = ship.GetComponent<PlayerShipController>() ?? ship.AddComponent<PlayerShipController>();
        var body = ship.GetComponent<Rigidbody>();
        var targetComponent = target.GetComponent<PrototypeNavigationTarget>();
        autopilot.Bind(null, controller, ship.GetComponent<ShipStats>(), body);
        autopilot.SelectTarget(targetComponent);
        return new AutopilotRig
        {
            Ship = ship,
            Target = targetComponent,
            Autopilot = autopilot,
            Controller = controller,
            Body = body
        };
    }

    private static void SetPrivateFloat(object target, string fieldName, float value)
    {
        FieldInfo field = target.GetType().GetField(fieldName, PrivateInstance);
        Assert.NotNull(field, fieldName);
        field.SetValue(target, value);
    }

    private static void SetPrivateField(object target, string fieldName, object value)
    {
        FieldInfo field = target.GetType().GetField(fieldName, PrivateInstance);
        Assert.NotNull(field, fieldName);
        field.SetValue(target, value);
    }

    private static void SetPrivateProperty<T>(object target, string propertyName, T value)
    {
        PropertyInfo property = target.GetType().GetProperty(propertyName, BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
        Assert.NotNull(property, propertyName);
        MethodInfo setter = property.GetSetMethod(true);
        Assert.NotNull(setter, $"{propertyName} has no set method");
        setter.Invoke(target, new object[] { value });
    }

    private static string StripComments(string line)
    {
        int index = line.IndexOf("//", StringComparison.Ordinal);
        return index >= 0 ? line.Substring(0, index) : line;
    }

    private static void DestroyNamed(string objectName)
    {
        GameObject target = GameObject.Find(objectName);
        if (target != null)
        {
            UnityEngine.Object.DestroyImmediate(target);
        }
    }

    private static GameObject EnsureAutopilotRigTargetRoot()
    {
        GameObject root = GameObject.Find(AutopilotRigTargetRootName);
        if (root == null)
        {
            root = new GameObject(AutopilotRigTargetRootName);
        }

        return root;
    }

    private static GameObject CreateObstacle(string name, Vector3 position, float radius)
    {
        GameObject obstacle = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        obstacle.name = name;
        obstacle.transform.position = position;
        obstacle.transform.localScale = Vector3.one * radius * 2f;
        Collider collider = obstacle.GetComponent<Collider>();
        Assert.NotNull(collider);
        collider.isTrigger = true;
        obstacle.AddComponent<PrototypeNavigationObstacle>().Configure(radius);
        return obstacle;
    }

    private static void CleanupValidationNavigationTargets()
    {
        PrototypeNavigationTarget[] targets = UnityEngine.Object.FindObjectsOfType<PrototypeNavigationTarget>();
        for (int i = 0; i < targets.Length; i++)
        {
            if (targets[i] == null)
            {
                continue;
            }

            if (targets[i].name.StartsWith(AutopilotRigTargetPrefix))
            {
                UnityEngine.Object.DestroyImmediate(targets[i].gameObject);
                continue;
            }

            if (targets[i].GetComponent<Renderer>() == null)
            {
                UnityEngine.Object.DestroyImmediate(targets[i].gameObject);
            }
        }
    }

    private static void DestroyByPrefix(string prefix)
    {
        GameObject[] objects = UnityEngine.Object.FindObjectsOfType<GameObject>();
        for (int i = 0; i < objects.Length; i++)
        {
            GameObject target = objects[i];
            if (target != null && target.name.StartsWith(prefix))
            {
                UnityEngine.Object.DestroyImmediate(target);
            }
        }
    }

    private static void ConfigureRcsNozzles(Transform shipTransform, RcsThrusterController rcs, Rigidbody body, ShipPhysicsCore physicsCore)
    {
        Transform[] nozzleTransforms = new Transform[6];
        string[] nozzleNames =
        {
            "RCS_Nozzle_Up",
            "RCS_Nozzle_Down",
            "RCS_Nozzle_Left",
            "RCS_Nozzle_Right",
            "RCS_Nozzle_Forward",
            "RCS_Nozzle_Back"
        };
        Vector3[] localPositions =
        {
            Vector3.up,
            Vector3.down,
            Vector3.left,
            Vector3.right,
            Vector3.forward,
            Vector3.back
        };

        for (int i = 0; i < nozzleNames.Length; i++)
        {
            nozzleTransforms[i] = shipTransform.Find(nozzleNames[i]);
            if (nozzleTransforms[i] == null)
            {
                GameObject nozzle = new GameObject(nozzleNames[i]);
                nozzle.transform.SetParent(shipTransform, false);
                nozzle.transform.localPosition = localPositions[i];
                nozzleTransforms[i] = nozzle.transform;
            }
        }

        rcs.ConfigureThrusters(
            nozzleTransforms[0],
            nozzleTransforms[1],
            nozzleTransforms[2],
            nozzleTransforms[3],
            nozzleTransforms[4],
            nozzleTransforms[5],
            body,
            physicsCore);
    }

    private static void InvokeFixedUpdate(object target)
    {
        MethodInfo fixedUpdate = target.GetType().GetMethod("FixedUpdate", PrivateInstance);
        Assert.NotNull(fixedUpdate);
        fixedUpdate.Invoke(target, null);
    }

    private static void InvokeUpdate(object target)
    {
        MethodInfo update = target.GetType().GetMethod("Update", PrivateInstance);
        Assert.NotNull(update);
        update.Invoke(target, null);
    }

    private struct AutopilotRig
    {
        public GameObject Ship;
        public Rigidbody Body;
        public PlayerShipController Controller;
        public PrototypeWaypointAutopilot Autopilot;
        public PrototypeNavigationTarget Target;
    }
}
#endif
