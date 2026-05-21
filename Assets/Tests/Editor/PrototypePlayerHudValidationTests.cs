#if UNITY_EDITOR
using System.Reflection;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.UI;

public class PrototypePlayerHudValidationTests
{
    [TearDown]
    public void TearDown()
    {
        PrototypeWeaponTargetRegistry.ClearForTests();
        DestroyNamed("PrototypeBootstrap");
        DestroyNamed("PrototypeShip");
        DestroyNamed("PrototypePlayerHudCamera");
        DestroyNamed("PlayerHudDockSource");
        DestroyNamed("PlayerHudDockTarget");
        DestroyNamed("Main Camera");
        DestroyNamed("Directional Light");
        DestroyNamed("EventSystem");
        DestroyNamed("PrototypePlayerHudEventSystem");
    }

    [Test]
    public void SnapshotBuildsFlightStatusAndPlayerWarningsWithoutDebugTelemetry()
    {
        using (var builder = new PrototypeScenarioBuilder())
        {
            PrototypeShipRig rig = builder.CreateShip("PlayerHudFlightShip");
            rig.Controller.SetControlMode(FlightControlMode.Translation);
            rig.Body.linearVelocity = rig.Ship.transform.forward * 37f;
            SetPrivateField(rig.Stats, "currentFuelKg", 12f);

            PrototypePlayerHudSnapshot snapshot = PrototypePlayerHudSnapshotBuilder.Build(
                rig.Ship.transform,
                rig.Body,
                rig.Stats,
                rig.Controller,
                null,
                null,
                null,
                null,
                null);

            Assert.That(snapshot.Flight.SpeedMetersPerSecond, Is.EqualTo(37f).Within(0.01f));
            Assert.That(snapshot.Flight.ControlModeLabel, Is.EqualTo("Translation"));
            Assert.That(snapshot.Flight.RcsLabel, Does.Contain("RCS"));
            Assert.That(string.Join(" | ", Labels(snapshot.Warnings)), Does.Contain("Treibstoff niedrig"));
            Assert.That(string.Join(" | ", Labels(snapshot.Warnings)), Does.Not.Contain("DES"));
            Assert.That(string.Join(" | ", Labels(snapshot.Warnings)), Does.Not.Contain("residual"));
        }
    }

    [Test]
    public void NavigationSnapshotUsesFriendlyLabelsAndHidesPlannerDebugValues()
    {
        using (var builder = new PrototypeScenarioBuilder())
        {
            PrototypeAutopilotRig rig = builder.CreateAutopilotRig(targetPosition: Vector3.forward * 220f);
            rig.Autopilot.EvaluateMetrics();

            PrototypePlayerHudSnapshot snapshot = PrototypePlayerHudSnapshotBuilder.Build(
                rig.Ship.Ship.transform,
                rig.Ship.Body,
                rig.Ship.Stats,
                rig.Ship.Controller,
                rig.Autopilot,
                null,
                null,
                null,
                null);

            Assert.True(snapshot.Navigation.Visible);
            Assert.That(snapshot.Navigation.TargetName, Is.EqualTo("HeadlessAutopilotTarget"));
            Assert.That(snapshot.Navigation.DistanceMeters, Is.GreaterThan(100f));
            Assert.That(snapshot.Navigation.PhaseLabel, Is.EqualTo("Direkter Kurs"));
            Assert.That(snapshot.Navigation.StateLabel, Is.Not.Contains("Candidate"));
            Assert.That(snapshot.Navigation.StateLabel, Is.Not.Contains("requested"));
            Assert.That(PrototypePlayerHudSnapshotBuilder.TranslateNavigationState(PrototypeWaypointAutopilotState.AlignForBurn), Is.EqualTo("Zum Schub ausrichten"));
            Assert.That(PrototypePlayerHudSnapshotBuilder.TranslateNavigationState(PrototypeWaypointAutopilotState.FinalApproach), Is.EqualTo("Endanflug"));
        }
    }

    [Test]
    public void CombatTranslatorMapsWeaponBlocksWithoutYawPitchOrTuningLeak()
    {
        PrototypeTurretFireStatus outOfArc = PrototypeTurretFireStatus.Blocked(
            PrototypeTurretFireBlockReason.OutOfArc,
            "out of arc",
            requestedYawDegrees: 42f,
            requestedPitchDegrees: 11f,
            appliedYawDegrees: 12f,
            appliedPitchDegrees: 4f,
            distanceMeters: 320f,
            hasSelectedTarget: true);
        PrototypeTurretFireStatus cooldown = PrototypeTurretFireStatus.Blocked(
            PrototypeTurretFireBlockReason.Cooldown,
            "cooldown",
            cooldownRemainingSeconds: 0.4f,
            distanceMeters: 320f,
            hasSelectedTarget: true);

        string outOfArcLabel = PrototypePlayerHudSnapshotBuilder.TranslateFireStatus(outOfArc);
        string cooldownLabel = PrototypePlayerHudSnapshotBuilder.TranslateFireStatus(cooldown);

        Assert.That(outOfArcLabel, Is.EqualTo("Ausserhalb Feuerwinkel"));
        Assert.That(cooldownLabel, Is.EqualTo("Cooldown 0.4s"));
        Assert.That(outOfArcLabel, Does.Not.Contain("Yaw"));
        Assert.That(outOfArcLabel, Does.Not.Contain("Pitch"));
        Assert.That(outOfArcLabel, Does.Not.Contain("Hit"));
        Assert.That(outOfArcLabel, Does.Not.Contain("Projectile"));
    }

    [Test]
    public void DockingSnapshotTranslatesEligibilityAndProtectsHardLockPlaceholder()
    {
        GameObject sourceObject = new GameObject("PlayerHudDockSource");
        GameObject targetObject = new GameObject("PlayerHudDockTarget");
        sourceObject.AddComponent<Rigidbody>().useGravity = false;
        targetObject.AddComponent<Rigidbody>().useGravity = false;
        DockingPort source = sourceObject.AddComponent<DockingPort>();
        DockingPort target = targetObject.AddComponent<DockingPort>();
        source.Configure(Vector3.zero, Vector3.forward, 3f, 10f, 1.5f);
        target.Configure(Vector3.zero, Vector3.forward, 3f, 10f, 1.5f);
        sourceObject.transform.position = Vector3.zero;
        targetObject.transform.position = Vector3.forward * 0.2f;
        targetObject.transform.rotation = Quaternion.Euler(0f, 180f, 0f);

        PrototypePlayerHudSnapshot snapshot = PrototypePlayerHudSnapshotBuilder.Build(
            sourceObject.transform,
            sourceObject.GetComponent<Rigidbody>(),
            null,
            null,
            null,
            null,
            null,
            source,
            target);

        Assert.True(snapshot.Docking.Visible);
        Assert.That(snapshot.Docking.StatusLabel, Is.EqualTo("Lock-Kriterien erfuellt"));
        Assert.That(snapshot.Docking.HardLockLabel, Is.EqualTo("Prototype: Hard Lock noch nicht verbunden"));
        Assert.That(PrototypePlayerHudSnapshotBuilder.TranslateDockingDiagnostic("relative-velocity-too-high"), Is.EqualTo("Anflug zu schnell"));
        Assert.That(snapshot.Docking.HardLockLabel, Does.Not.Contain("Docked"));
    }

    [Test]
    public void PlayerHelpExcludesDebugOnlyControlsByDefault()
    {
        string help = PrototypePlayerHudSnapshotBuilder.BuildPlayerHelpText(FlightControlMode.Translation, false);

        Assert.That(help, Does.Contain("W/S: translate forward/back"));
        Assert.That(help, Does.Contain("Space: fire"));
        Assert.That(help, Does.Not.Contain("Debug Console"));
        Assert.That(help, Does.Not.Contain("Flight Diagnostics"));
        Assert.That(help, Does.Not.Contain("DES/ACT/RES"));
        Assert.That(help, Does.Not.Contain("Backspace: refill fuel"));
    }

    [Test]
    public void BootstrapBindsPlayerHudCanvasSeparateFromPrototypeWindows()
    {
        GameObject bootstrapObject = new GameObject("PrototypeBootstrap");
        PrototypeBootstrap bootstrap = bootstrapObject.AddComponent<PrototypeBootstrap>();

        bootstrap.BuildBuiltInVariant(0);

        Assert.NotNull(Camera.main);
        PrototypePlayerHudRenderer playerHud = Camera.main.GetComponent<PrototypePlayerHudRenderer>();
        Assert.NotNull(playerHud);
        Assert.NotNull(playerHud.GetComponentInChildren<Canvas>(true));
        Assert.NotNull(Camera.main.GetComponent<PrototypeFlightHud>());
        Assert.NotNull(Camera.main.GetComponent<PrototypeDebugOverlay>());

        playerHud.RefreshNow();

        Assert.That(playerHud.LastSnapshot.Flight.FuelMaxKg, Is.GreaterThan(0f));
        Assert.That(playerHud.LastSnapshot.Flight.ControlModeLabel, Is.EqualTo("Cruise"));
    }

    private static string[] Labels(PrototypePlayerHudChip[] chips)
    {
        string[] labels = new string[chips.Length];
        for (int i = 0; i < chips.Length; i++)
        {
            labels[i] = chips[i].Label;
        }

        return labels;
    }

    private static void SetPrivateField(object target, string fieldName, object value)
    {
        FieldInfo field = target.GetType().GetField(fieldName, BindingFlags.Instance | BindingFlags.NonPublic);
        Assert.NotNull(field, fieldName);
        field.SetValue(target, value);
    }

    private static void DestroyNamed(string objectName)
    {
        GameObject target = GameObject.Find(objectName);
        if (target != null)
        {
            Object.DestroyImmediate(target);
        }
    }
}
#endif
