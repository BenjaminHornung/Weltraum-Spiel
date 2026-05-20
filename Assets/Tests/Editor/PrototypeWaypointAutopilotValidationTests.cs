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

    [TearDown]
    public void TearDown()
    {
        DestroyNamed("PrototypeNavigationWaypoints");
        DestroyNamed("WaypointAutopilotValidationShip");
        DestroyNamed("WaypointAutopilotValidationTarget");
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
        var autopilot = ship.AddComponent<PrototypeWaypointAutopilot>();
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
        ship.AddComponent<EngineVfxController>();
        ship.AddComponent<MainThrusterBank>();
        ship.AddComponent<RcsThrusterController>();
        ship.AddComponent<PlayerShipController>();
        physicsCore.Configure(body);
        stats.ApplyMassProperties(body);
        return ship;
    }

    private static void SetPrivateFloat(object target, string fieldName, float value)
    {
        FieldInfo field = target.GetType().GetField(fieldName, PrivateInstance);
        Assert.NotNull(field, fieldName);
        field.SetValue(target, value);
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
}
#endif
