#if UNITY_EDITOR
using NUnit.Framework;
using UnityEngine;

public class PrototypeHeadlessScenarioValidationTests
{
    [TearDown]
    public void TearDown()
    {
        PrototypeWeaponTargetRegistry.ClearForTests();
        if (PrototypeProjectileSimulation.Instance != null)
        {
            PrototypeProjectileSimulation.Instance.ClearRuntime();
        }
    }

    [Test]
    public void HeadlessRunnerMainThrottleMovesShipWithoutCameraOrHud()
    {
        using (var builder = new PrototypeScenarioBuilder())
        using (var runner = new HeadlessSimulationRunner())
        {
            PrototypeShipRig rig = builder.CreateShip();
            var driver = new ShipDriver(rig);
            runner.AddFixedTick(rig.Controller);

            Vector3 startPosition = rig.Body.position;
            driver.SetCruiseMode();
            driver.SetMainThrottle(1f);

            runner.Step(12);
            ShipSimulationSnapshot snapshot = driver.Snapshot(runner);

            Assert.That(snapshot.mainThrustCommand, Is.GreaterThan(0.99f));
            Assert.That(snapshot.netAppliedForce.z, Is.GreaterThan(1000f));
            Assert.That(snapshot.linearVelocity.z, Is.GreaterThan(0f));
            Assert.True(SimulationAssertions.MovedAlong(startPosition, snapshot.position, Vector3.forward, 0.01f));
            Assert.That(snapshot.fuelKg, Is.LessThan(300f));
            Assert.That(rig.Ship.GetComponentsInChildren<Camera>(true).Length, Is.EqualTo(0));
            Assert.That(rig.Ship.GetComponentsInChildren<Canvas>(true).Length, Is.EqualTo(0));
        }
    }

    [Test]
    public void HeadlessAutopilotTicksControllerAndReducesDistance()
    {
        using (var builder = new PrototypeScenarioBuilder())
        using (var runner = new HeadlessSimulationRunner())
        {
            PrototypeAutopilotRig rig = builder.CreateAutopilotRig(targetPosition: Vector3.forward * 140f);
            var autopilotDriver = new AutopilotDriver(rig);
            runner.AddFixedTick(rig.Autopilot);
            runner.AddFixedTick(rig.Ship.Controller);

            Vector3 startPosition = rig.Ship.Body.position;
            Vector3 targetPosition = rig.Target.Position;
            autopilotDriver.Engage();

            bool sawMainThrottle = false;
            AutopilotSimulationSnapshot autopilot = new AutopilotSimulationSnapshot();
            ShipSimulationSnapshot ship = new ShipSimulationSnapshot();

            for (int i = 0; i < 120; i++)
            {
                runner.Step(1);
                autopilot = autopilotDriver.Snapshot(runner);
                ship = new ShipDriver(rig.Ship).Snapshot(runner);
                if (autopilot.requestedMainThrottle > 0.5f || ship.mainThrustCommand > 0.5f)
                {
                    sawMainThrottle = true;
                }
            }

            Assert.True(autopilot.engaged);
            Assert.That(
                autopilot.arrivalPhase,
                Is.EqualTo(PrototypeWaypointAutopilotArrivalPhase.LongRangeBurn)
                    .Or.EqualTo(PrototypeWaypointAutopilotArrivalPhase.Brake)
                    .Or.EqualTo(PrototypeWaypointAutopilotArrivalPhase.LateralCorrection)
                    .Or.EqualTo(PrototypeWaypointAutopilotArrivalPhase.FinalApproach));
            Assert.That(sawMainThrottle, Is.True);
            Assert.True(rig.Ship.Controller.HasExternalFlightAssistRequest);
            Assert.That(rig.Ship.Controller.LastExternalFlightAssistRequest.source, Is.EqualTo(FlightAssistRequestSource.WaypointAutopilot));
            Assert.True(SimulationAssertions.DistanceToTargetDecreased(startPosition, rig.Ship.Body.position, targetPosition, 0.01f));
            Assert.That(rig.Ship.Ship.GetComponentsInChildren<Camera>(true).Length, Is.EqualTo(0));
        }
    }

    [Test]
    public void HeadlessCombatDriverAutoFiresSelectedTargetWithoutProjectileGameObjects()
    {
        using (var builder = new PrototypeScenarioBuilder())
        {
            PrototypeProjectileSimulation simulation = builder.CreateProjectileSimulation();
            PrototypeCombatRig rig = builder.CreateCombatRig();
            Transform target = builder.CreateWeaponTarget("HeadlessWeaponTarget", rig.Muzzle.position + Vector3.forward * 35f);
            var driver = new CombatDriver(rig);

            Assert.True(driver.SelectTarget(target));
            driver.EnableAutoFire(true);

            bool fired = driver.TickAutoFire();
            CombatSimulationSnapshot snapshot = driver.Snapshot();

            Assert.True(fired);
            Assert.That(snapshot.autoFireEnabled, Is.True);
            Assert.That(snapshot.activeTargetName, Is.EqualTo("HeadlessWeaponTarget"));
            Assert.That(snapshot.lastShotFired, Is.True);
            Assert.That(snapshot.lastProjectileMode, Is.EqualTo(WeaponProjectileMode.Hitscan));
            Assert.That(snapshot.totalShotsProcessed, Is.GreaterThanOrEqualTo(1));
            Assert.That(snapshot.activeProjectileCount, Is.EqualTo(0));
            Assert.That(rig.Ship.PhysicsCore.AppliedImpulseCount, Is.EqualTo(1));
            Assert.That(rig.Weapon.LastRecoilApplied, Is.True);
            Assert.That(UnityEngine.Object.FindObjectsByType<Projectile>(FindObjectsInactive.Include).Length, Is.EqualTo(0));
            Assert.AreSame(simulation, PrototypeProjectileSimulation.Instance);
        }
    }
}
#endif
