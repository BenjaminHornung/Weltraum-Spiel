#if UNITY_EDITOR
using NUnit.Framework;
using UnityEngine;

public class PrototypeFlightHudValidationTests
{
    [TearDown]
    public void TearDown()
    {
        DestroyNamed("HudShip");
        DestroyNamed("HudCamera");
        DestroyNamed("PrototypeShip");
        DestroyNamed("PrototypeTargetDummy");
        DestroyNamed("Main Camera");
        DestroyNamed("Directional Light");
        DestroyNamed("HudBootstrap");
    }

    [Test]
    public void HudComputesProgradeAndRetrogradeMarkersFromShipLocalVelocity()
    {
        GameObject ship = new GameObject("HudShip");
        Rigidbody rb = ship.AddComponent<Rigidbody>();
        ShipStats stats = ship.AddComponent<ShipStats>();
        GameObject cameraObject = new GameObject("HudCamera");
        cameraObject.AddComponent<Camera>();
        PrototypeFlightHud hud = cameraObject.AddComponent<PrototypeFlightHud>();

        hud.Bind(ship.transform, stats, rb);
        rb.linearVelocity = ship.transform.TransformDirection(new Vector3(1f, 0f, 1f).normalized * 24f);

        hud.RefreshDiagnosticsForTests();

        Assert.True(hud.LastHasVelocityMarker);
        Assert.That(hud.LastProgradeMarker.x, Is.GreaterThan(hud.NavballRadius * 0.55f));
        Assert.That(Mathf.Abs(hud.LastProgradeMarker.y), Is.LessThan(0.01f));
        Assert.That(hud.LastRetrogradeMarker.x, Is.LessThan(-hud.NavballRadius * 0.55f));
        Assert.That((hud.LastProgradeMarker + hud.LastRetrogradeMarker).magnitude, Is.LessThan(0.02f));
        Assert.That(hud.LastModeLabel, Is.EqualTo("VELOCITY"));
    }

    [Test]
    public void HudShowsSasHoldAndTargetMarkersWhenAvailable()
    {
        GameObject ship = new GameObject("HudShip");
        Rigidbody rb = ship.AddComponent<Rigidbody>();
        ShipStats stats = ship.AddComponent<ShipStats>();
        PlayerShipController controller = AddFlightControllerDependencies(ship);
        GameObject target = GameObject.CreatePrimitive(PrimitiveType.Cube);
        target.name = "PrototypeTargetDummy";
        target.transform.position = ship.transform.position + new Vector3(12f, 0f, 12f);
        target.AddComponent<PrototypeTargetDummy>();

        GameObject cameraObject = new GameObject("HudCamera");
        cameraObject.AddComponent<Camera>();
        PrototypeFlightHud hud = cameraObject.AddComponent<PrototypeFlightHud>();

        controller.SetSasEnabled(true);
        controller.CaptureSasTargetRotation();
        hud.Bind(ship.transform, stats, rb);
        hud.SetTrackedTarget(target.transform);

        hud.RefreshDiagnosticsForTests();

        Assert.True(hud.LastHasSasMarker);
        Assert.True(hud.LastHasTargetMarker);
        Assert.That(hud.LastTargetMarker.x, Is.GreaterThan(hud.NavballRadius * 0.55f));
        Assert.That(hud.LastModeLabel, Is.EqualTo("TARGET"));
    }

    [Test]
    public void BootstrapBindsHudAfterVariantSpawn()
    {
        GameObject bootstrapObject = new GameObject("HudBootstrap");
        PrototypeBootstrap bootstrap = bootstrapObject.AddComponent<PrototypeBootstrap>();

        bootstrap.BuildBuiltInVariant(0);

        GameObject ship = GameObject.Find("PrototypeShip");
        Assert.NotNull(ship);
        Assert.NotNull(Camera.main);
        PrototypeFlightHud hud = Camera.main.GetComponent<PrototypeFlightHud>();
        Assert.NotNull(hud);
        Assert.NotNull(Camera.main.GetComponent<PrototypeKeybindOverlay>());
        Assert.AreSame(ship.transform, hud.Target);
        Assert.NotNull(hud.TargetRigidbody);
        Assert.False(hud.ShowDebugForceMarkers);
        Assert.That(hud.BuildModeLabelStructure(), Does.Contain("WORLD"));
        Assert.That(hud.BuildModeLabelStructure(), Does.Contain("VELOCITY"));
        Assert.That(hud.BuildModeLabelStructure(), Does.Contain("TARGET"));
        Assert.That(hud.BuildModeLabelStructure(), Does.Contain("DOCKING"));
        Assert.That(hud.BuildModeLabelStructure(), Does.Contain("ORBIT/GRAVITY"));

        bootstrap.BuildBuiltInVariant(3);

        ship = GameObject.Find("PrototypeShip");
        hud = Camera.main.GetComponent<PrototypeFlightHud>();
        hud.RefreshDiagnosticsForTests();

        Assert.NotNull(ship);
        Assert.NotNull(hud);
        Assert.AreSame(ship.transform, hud.Target);
        Assert.NotNull(hud.ShipController);
    }

    [Test]
    public void HudDebugForceMarkersStayQuietUntilDebugVectorsAreActive()
    {
        GameObject ship = new GameObject("HudShip");
        Rigidbody rb = ship.AddComponent<Rigidbody>();
        ShipStats stats = ship.AddComponent<ShipStats>();
        AddFlightControllerDependencies(ship);
        GameObject cameraObject = new GameObject("HudCamera");
        cameraObject.AddComponent<Camera>();
        PrototypeDebugOverlay overlay = cameraObject.AddComponent<PrototypeDebugOverlay>();
        PrototypeFlightHud hud = cameraObject.AddComponent<PrototypeFlightHud>();

        hud.Bind(ship.transform, stats, rb);
        hud.SetShowDebugForceMarkers(false);
        overlay.SetDrawDebugVectors(false);

        hud.RefreshDiagnosticsForTests();

        Assert.False(hud.LastHasDebugForceMarkers);

        overlay.SetDrawDebugVectors(true);
        hud.RefreshDiagnosticsForTests();

        Assert.True(hud.LastHasDebugForceMarkers);
    }

    private static PlayerShipController AddFlightControllerDependencies(GameObject ship)
    {
        Rigidbody rb = ship.GetComponent<Rigidbody>();
        ShipStats stats = ship.GetComponent<ShipStats>();
        ShipPhysicsCore core = ship.AddComponent<ShipPhysicsCore>();
        MainThrusterBank mainThruster = ship.AddComponent<MainThrusterBank>();
        ship.AddComponent<RcsThrusterController>();
        ship.AddComponent<GunModule>();
        core.Configure(rb);
        mainThruster.Configure(new MainThrusterModule[0], rb, stats, core);
        return ship.AddComponent<PlayerShipController>();
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
