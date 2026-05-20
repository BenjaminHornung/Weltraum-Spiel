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
        DestroyByPrefix("WaypointAutopilotValidationProjectile");
        DestroyByPrefix(AutopilotRigTargetPrefix);
    }

    [TearDown]
    public void TearDown()
    {
        DestroyNamed("PrototypeNavigationWaypoints");
        DestroyByPrefix("WaypointAutopilotValidationShip");
        DestroyByPrefix("WaypointAutopilotValidationTarget");
        DestroyByPrefix("WaypointAutopilotValidationObstacle");
        DestroyByPrefix("WaypointAutopilotValidationProjectile");
        DestroyByPrefix(AutopilotRigTargetRootName);
        CleanupValidationNavigationTargets();
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
            "FlipForBrake",
            "Brake",
            "ObstacleAvoidance",
            "FinalApproach",
            "HoldPosition",
            "Complete",
            "Aborted",
            "FuelInsufficient",
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
        Assert.That(approachRig.Autopilot.ArrivalFailureReason, Is.EqualTo("reduced final approach capability"));
    }

    [Test]
    public void ObstacleInCorridorTriggersAvoidanceAndRcsRequest()
    {
        var rig = CreateAutopilotRig();
        rig.Target.transform.position = Vector3.forward * 150f;
        rig.Body.linearVelocity = Vector3.zero;
        GameObject obstacle = CreateNavigationObstacle("WaypointAutopilotValidationObstacle_Blocking", Vector3.forward * 45f, 6f);
        Physics.SyncTransforms();

        rig.Autopilot.SelectTarget(rig.Target);
        rig.Autopilot.ToggleAutopilot();
        InvokeFixedUpdate(rig.Autopilot);

        Assert.That(rig.Autopilot.CurrentState, Is.EqualTo(PrototypeWaypointAutopilotState.ObstacleAvoidance));
        Assert.That(rig.Autopilot.ArrivalPhase, Is.EqualTo(PrototypeWaypointAutopilotArrivalPhase.Avoidance));
        Assert.True(rig.Autopilot.AvoidanceActive);
        Assert.That(rig.Autopilot.AvoidanceTargetName, Is.EqualTo("WaypointAutopilotValidationObstacle_Blocking"));
        Assert.That(rig.Autopilot.AvoidanceDistance, Is.GreaterThan(0f));
        Assert.That(rig.Autopilot.AvoidanceVectorWorld.sqrMagnitude, Is.GreaterThan(0.5f));
        Assert.That(Vector3.Dot(rig.Autopilot.AvoidanceVectorWorld.normalized, Vector3.forward), Is.LessThan(0.25f));
        Assert.That(rig.Autopilot.RequestedMainThrottle, Is.EqualTo(0f).Within(0.0001f));
        Assert.True(rig.Controller.HasExternalFlightAssistRequest);
        Assert.That(rig.Controller.LastExternalFlightAssistRequest.forceWorld.magnitude, Is.GreaterThan(0f));
        Assert.AreSame(obstacle.GetComponent<Collider>(), rig.Autopilot.LastObstacleHit.collider);
    }

    [Test]
    public void ObstacleOutsideCorridorIsIgnored()
    {
        var rig = CreateAutopilotRig();
        rig.Target.transform.position = Vector3.forward * 150f;
        rig.Body.linearVelocity = Vector3.zero;
        CreateNavigationObstacle("WaypointAutopilotValidationObstacle_Outside", new Vector3(36f, 0f, 45f), 4f);
        Physics.SyncTransforms();

        rig.Autopilot.SelectTarget(rig.Target);
        rig.Autopilot.ToggleAutopilot();
        InvokeFixedUpdate(rig.Autopilot);

        Assert.That(rig.Autopilot.CurrentState, Is.EqualTo(PrototypeWaypointAutopilotState.Accelerate));
        Assert.False(rig.Autopilot.AvoidanceActive);
        Assert.That(rig.Autopilot.ArrivalPhase, Is.EqualTo(PrototypeWaypointAutopilotArrivalPhase.LongRangeBurn));
        Assert.That(rig.Autopilot.RequestedMainThrottle, Is.GreaterThan(0.8f));
    }

    [Test]
    public void ObstacleScanIgnoresTriggerAndProjectileHits()
    {
        var rig = CreateAutopilotRig();
        rig.Target.transform.position = Vector3.forward * 150f;
        rig.Body.linearVelocity = Vector3.zero;
        CreateNavigationObstacle("WaypointAutopilotValidationObstacle_Trigger", Vector3.forward * 25f, 6f, true);
        CreateProjectileObstacle("WaypointAutopilotValidationProjectile_Ignored", Vector3.forward * 38f);
        CreateNavigationObstacle("WaypointAutopilotValidationObstacle_ValidBehindIgnoredHits", Vector3.forward * 64f, 6f);
        Physics.SyncTransforms();

        rig.Autopilot.SelectTarget(rig.Target);
        rig.Autopilot.ToggleAutopilot();
        InvokeFixedUpdate(rig.Autopilot);

        Assert.That(rig.Autopilot.CurrentState, Is.EqualTo(PrototypeWaypointAutopilotState.ObstacleAvoidance));
        Assert.That(rig.Autopilot.AvoidanceTargetName, Is.EqualTo("WaypointAutopilotValidationObstacle_ValidBehindIgnoredHits"));
        Assert.That(rig.Autopilot.LastObstacleHit.collider.GetComponentInParent<Projectile>(), Is.Null);
        Assert.False(rig.Autopilot.LastObstacleHit.collider.isTrigger);
    }

    [Test]
    public void BrakeCorridorUsesCurrentVelocityForObstacleDetection()
    {
        var rig = CreateAutopilotRig();
        rig.Target.transform.position = Vector3.forward * 150f;
        rig.Body.linearVelocity = Vector3.forward * 45f;
        CreateNavigationObstacle("WaypointAutopilotValidationObstacle_BrakePath", Vector3.forward * 40f, 6f);
        Physics.SyncTransforms();

        rig.Autopilot.SelectTarget(rig.Target);
        rig.Autopilot.ToggleAutopilot();
        InvokeFixedUpdate(rig.Autopilot);

        Assert.That(rig.Autopilot.CurrentState, Is.EqualTo(PrototypeWaypointAutopilotState.ObstacleAvoidance));
        Assert.That(rig.Autopilot.ArrivalPhase, Is.EqualTo(PrototypeWaypointAutopilotArrivalPhase.Avoidance));
        Assert.That(rig.Autopilot.AvoidanceTargetName, Is.EqualTo("WaypointAutopilotValidationObstacle_BrakePath"));
        Assert.That(rig.Autopilot.RequestedMainThrottle, Is.EqualTo(0f).Within(0.0001f));
    }

    [Test]
    public void NoAvoidanceAuthorityFailsWithObstacleSpecificReason()
    {
        var rig = CreateAutopilotRig();
        rig.Target.transform.position = Vector3.forward * 80f;
        rig.Body.linearVelocity = Vector3.zero;
        SetPrivateFloat(rig.Ship.GetComponent<ShipStats>(), "fullThrottleFuelKgPerSecond", 0f);
        SetPrivateFloat(rig.Ship.GetComponent<ShipStats>(), "thrustForce", 0f);
        SetPrivateFloat(rig.Ship.GetComponent<RcsThrusterController>(), "translationForce", 0f);
        SetPrivateField(rig.Ship.GetComponent<MainThrusterBank>(), "thrusters", Array.Empty<MainThrusterModule>());
        CreateNavigationObstacle("WaypointAutopilotValidationObstacle_NoAuthority", Vector3.forward * 30f, 6f);
        Physics.SyncTransforms();

        rig.Autopilot.SelectTarget(rig.Target);
        rig.Autopilot.ToggleAutopilot();

        Assert.That(rig.Autopilot.CurrentState, Is.EqualTo(PrototypeWaypointAutopilotState.Failed));
        Assert.False(rig.Autopilot.AutopilotEngaged);
        Assert.That(rig.Autopilot.ArrivalFailureReason, Is.EqualTo("NoAvoidanceAuthority"));
    }

    [Test]
    public void AvoidanceReturnsToLongRangeBurnAfterClearFrames()
    {
        var rig = CreateAutopilotRig();
        rig.Target.transform.position = Vector3.forward * 150f;
        rig.Body.linearVelocity = Vector3.zero;
        GameObject obstacle = CreateNavigationObstacle("WaypointAutopilotValidationObstacle_ClearLater", Vector3.forward * 45f, 6f);
        Physics.SyncTransforms();

        rig.Autopilot.SelectTarget(rig.Target);
        rig.Autopilot.ToggleAutopilot();
        InvokeFixedUpdate(rig.Autopilot);
        Assert.True(rig.Autopilot.AvoidanceActive);

        UnityEngine.Object.DestroyImmediate(obstacle);
        Physics.SyncTransforms();
        InvokeFixedUpdate(rig.Autopilot);
        InvokeFixedUpdate(rig.Autopilot);
        InvokeFixedUpdate(rig.Autopilot);

        Assert.False(rig.Autopilot.AvoidanceActive);
        Assert.That(rig.Autopilot.CurrentState, Is.EqualTo(PrototypeWaypointAutopilotState.Accelerate));
        Assert.That(rig.Autopilot.ArrivalPhase, Is.EqualTo(PrototypeWaypointAutopilotArrivalPhase.LongRangeBurn));
        Assert.That(rig.Autopilot.RequestedMainThrottle, Is.GreaterThan(0.8f));
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
        Regex directRigidbodyWrite = new Regex(@"\.(position|rotation|velocity|linearVelocity|angularVelocity)\s*=", RegexOptions.Compiled);
        for (int i = 0; i < lines.Length; i++)
        {
            string noComments = StripComments(lines[i]);
            Assert.False(directRigidbodyWrite.IsMatch(noComments), $"Direct Rigidbody write detected in PrototypeWaypointAutopilot.cs line {i + 1}: {lines[i]}");
            Assert.False(noComments.Contains("SphereCastAll"), $"Unbounded physics query detected in PrototypeWaypointAutopilot.cs line {i + 1}: {lines[i]}");
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

    private static GameObject CreateNavigationObstacle(string name, Vector3 position, float scale, bool trigger = false)
    {
        GameObject obstacle = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        obstacle.name = name;
        obstacle.transform.position = position;
        obstacle.transform.localScale = Vector3.one * scale;
        Collider collider = obstacle.GetComponent<Collider>();
        Assert.NotNull(collider);
        collider.isTrigger = trigger;
        PrototypeNavigationObstacle metadata = obstacle.AddComponent<PrototypeNavigationObstacle>();
        metadata.Configure(name, scale + 4f, Mathf.Max(1f, scale * 0.5f), true);
        return obstacle;
    }

    private static GameObject CreateProjectileObstacle(string name, Vector3 position)
    {
        GameObject projectile = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        projectile.name = name;
        projectile.transform.position = position;
        projectile.transform.localScale = Vector3.one * 5f;
        Rigidbody body = projectile.AddComponent<Rigidbody>();
        body.useGravity = false;
        projectile.AddComponent<Projectile>();
        return projectile;
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
