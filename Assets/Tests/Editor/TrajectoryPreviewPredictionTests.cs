#if UNITY_EDITOR
using NUnit.Framework;
using UnityEngine;

public class TrajectoryPreviewPredictionTests
{
    private const float PredictionToleranceMeters = 0.05f;

    [Test]
    public void BoundedPredictionReturnsFiniteStates()
    {
        using (PhysicsValidationProbe.GeneratedShipFixture fixture = PhysicsValidationProbe.CreateGeneratedShip())
        {
            GameObject gravityBody = CreateGravityBody(new Vector3(20f, 0f, 0f));
            try
            {
                fixture.PhysicsCore.ConfigureCentralGravity(gravityBody.transform, 800f, true);
                TrajectoryPredictionState initialState = TrajectoryPredictionState.FromRigidbody(fixture.Rigidbody, fixture.Stats);

                TrajectoryPredictionState[] states = TrajectoryPredictor.Predict(
                    initialState,
                    fixture.PhysicsCore,
                    new TrajectoryPredictionSettings(32, 0.02f, true));

                Assert.That(states.Length, Is.EqualTo(33));
                for (int i = 0; i < states.Length; i++)
                {
                    Assert.True(states[i].IsFinite, "state " + i + " should remain finite");
                }
            }
            finally
            {
                Object.DestroyImmediate(gravityBody);
            }
        }
    }

    [Test]
    public void PredictionClampsStepCountToBound()
    {
        TrajectoryPredictionState initialState = new TrajectoryPredictionState(
            Vector3.zero,
            Vector3.forward,
            Quaternion.identity,
            Vector3.zero,
            0f,
            0f);

        TrajectoryPredictionState[] states = TrajectoryPredictor.Predict(
            initialState,
            null,
            new TrajectoryPredictionSettings(TrajectoryPredictor.MaxStepCount + 100, 0.02f, false));

        Assert.That(states.Length, Is.EqualTo(TrajectoryPredictor.MaxStepCount + 1));
        Assert.True(states[states.Length - 1].IsFinite);
    }

    [Test]
    public void GravityOnlyPredictionMatchesShortSimulationTolerance()
    {
        using (PhysicsValidationProbe.GeneratedShipFixture fixture = PhysicsValidationProbe.CreateGeneratedShip())
        {
            const int steps = 10;
            const float deltaTime = 0.02f;
            GameObject gravityBody = CreateGravityBody(new Vector3(20f, 0f, 0f));
            SimulationMode previousSimulationMode = Physics.simulationMode;

            try
            {
                fixture.Rigidbody.position = Vector3.zero;
                fixture.Rigidbody.linearVelocity = new Vector3(0f, 0f, 1.5f);
                fixture.Rigidbody.angularVelocity = Vector3.zero;
                fixture.PhysicsCore.ConfigureCentralGravity(gravityBody.transform, 800f, true);
                Physics.simulationMode = SimulationMode.Script;
                Physics.SyncTransforms();

                TrajectoryPredictionState initialState = TrajectoryPredictionState.FromRigidbody(fixture.Rigidbody, fixture.Stats);
                TrajectoryPredictionState[] predicted = TrajectoryPredictor.Predict(
                    initialState,
                    fixture.PhysicsCore,
                    new TrajectoryPredictionSettings(steps, deltaTime, true));

                for (int i = 0; i < steps; i++)
                {
                    fixture.PhysicsCore.BeginPhysicsStep();
                    fixture.PhysicsCore.ApplyEnvironmentForces();
                    Physics.Simulate(deltaTime);
                }

                float error = Vector3.Distance(predicted[steps].position, fixture.Rigidbody.worldCenterOfMass);
                Assert.That(error, Is.LessThan(PredictionToleranceMeters));
            }
            finally
            {
                Physics.simulationMode = previousSimulationMode;
                Object.DestroyImmediate(gravityBody);
            }
        }
    }

    [Test]
    public void DebugGizmoRefreshStoresPredictedStates()
    {
        using (PhysicsValidationProbe.GeneratedShipFixture fixture = PhysicsValidationProbe.CreateGeneratedShip())
        {
            TrajectoryPreviewDebugGizmo gizmo = fixture.Ship.AddComponent<TrajectoryPreviewDebugGizmo>();

            int count = gizmo.RefreshPreview();

            Assert.That(count, Is.GreaterThan(1));
            Assert.That(gizmo.LastPreviewStates.Length, Is.EqualTo(count));
            Assert.True(gizmo.LastPreviewStates[count - 1].IsFinite);
        }
    }

    [Test]
    public void NavMapPreviewSourcePredictsBoundedFiniteRouteWithBurnPlan()
    {
        using (PhysicsValidationProbe.GeneratedShipFixture fixture = PhysicsValidationProbe.CreateGeneratedShip())
        {
            GameObject gravityBody = CreateGravityBody(new Vector3(30f, 0f, 0f));
            try
            {
                fixture.Rigidbody.linearVelocity = Vector3.forward * 4f;
                fixture.PhysicsCore.ConfigureCentralGravity(gravityBody.transform, 650f, true);

                PrototypeTrajectoryPreviewNavMap preview = fixture.Ship.AddComponent<PrototypeTrajectoryPreviewNavMap>();
                preview.Bind(fixture.Ship.transform, fixture.Rigidbody, fixture.Stats, fixture.PhysicsCore, null);
                preview.ConfigureForTests(true, 6, 32, 0.05f, true, false);

                PrototypeTrajectoryPreviewSnapshot snapshot = preview.RefreshPreview();

                Assert.That(snapshot.Status, Is.EqualTo(PrototypeTrajectoryPreviewStatus.Truncated));
                Assert.That(snapshot.Points.Length, Is.EqualTo(6));
                Assert.That(snapshot.StepLimit, Is.EqualTo(32));
                Assert.That(snapshot.HorizonSeconds, Is.EqualTo(1.6f).Within(0.0001f));
                Assert.True(snapshot.UsedPredictor);
                Assert.True(snapshot.UsedCentralGravity);
                Assert.True(snapshot.UsedBurnPlan);
                Assert.True(snapshot.BurnPlan.HasBurn);
                Assert.False(snapshot.NonFiniteDetected);
                for (int i = 0; i < snapshot.Points.Length; i++)
                {
                    Assert.True(TrajectoryPredictionMath.IsFinite(snapshot.Points[i]), "preview point " + i + " should be finite");
                }
            }
            finally
            {
                Object.DestroyImmediate(gravityBody);
            }
        }
    }

    [Test]
    public void NavMapPreviewFiltersNonFiniteRoutesAndSupportsDeterministicToggle()
    {
        Vector3[] route =
        {
            Vector3.zero,
            Vector3.forward * 20f,
            new Vector3(float.NaN, 0f, 40f),
            Vector3.forward * 60f
        };

        PrototypeTrajectoryPreviewSnapshot snapshot = PrototypeTrajectoryPreviewNavMap.BuildSnapshotFromRoute(
            route,
            true,
            4,
            "test route",
            route.Length,
            12,
            1.2f,
            usedAutopilotRoute: true,
            usedPredictor: false,
            usedCentralGravity: false,
            usedBurnPlan: true,
            burnPlan: TrajectoryBurnPlan.Estimate(Vector3.forward, 1f, 0.5f, 1000f, 0.5f, 1f, 100f));

        Assert.That(snapshot.Status, Is.EqualTo(PrototypeTrajectoryPreviewStatus.Truncated));
        Assert.That(snapshot.Points.Length, Is.EqualTo(2));
        Assert.True(snapshot.NonFiniteDetected);
        Assert.True(snapshot.UsedAutopilotRoute);
        Assert.True(snapshot.UsedBurnPlan);
        for (int i = 0; i < snapshot.Points.Length; i++)
        {
            Assert.True(TrajectoryPredictionMath.IsFinite(snapshot.Points[i]));
        }

        PrototypeTrajectoryPreviewSnapshot disabled = PrototypeTrajectoryPreviewNavMap.BuildSnapshotFromRoute(
            route,
            false,
            4,
            "test route",
            route.Length,
            12,
            1.2f,
            usedAutopilotRoute: true,
            usedPredictor: false,
            usedCentralGravity: false,
            usedBurnPlan: false,
            burnPlan: TrajectoryBurnPlan.None);

        Assert.That(disabled.Status, Is.EqualTo(PrototypeTrajectoryPreviewStatus.Disabled));
        Assert.That(disabled.Points.Length, Is.EqualTo(0));
    }

    [Test]
    public void PlayerHudSnapshotExposesTrajectoryPreviewRouteAndDisabledState()
    {
        using (PhysicsValidationProbe.GeneratedShipFixture fixture = PhysicsValidationProbe.CreateGeneratedShip())
        {
            fixture.Rigidbody.linearVelocity = Vector3.forward * 5f;
            PrototypeTrajectoryPreviewNavMap preview = fixture.Ship.AddComponent<PrototypeTrajectoryPreviewNavMap>();
            preview.Bind(fixture.Ship.transform, fixture.Rigidbody, fixture.Stats, fixture.PhysicsCore, null);
            preview.ConfigureForTests(true, 5, 16, 0.05f, true, false);

            PrototypePlayerHudSnapshot enabled = PrototypePlayerHudSnapshotBuilder.Build(
                fixture.Ship.transform,
                fixture.Rigidbody,
                fixture.Stats,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                preview);

            Assert.True(enabled.Navigation.Visible);
            Assert.That(enabled.Navigation.TargetName, Is.EqualTo("Trajectory Preview"));
            Assert.True(enabled.Navigation.TrajectoryPreview.HasRenderablePoints);
            Assert.That(enabled.Navigation.TrajectoryPreview.Points.Length, Is.EqualTo(5));
            Assert.That(string.Join(" | ", Labels(enabled.AssistChips)), Does.Contain("Trajectory Preview"));

            preview.SetPreviewEnabled(false);
            PrototypePlayerHudSnapshot disabled = PrototypePlayerHudSnapshotBuilder.Build(
                fixture.Ship.transform,
                fixture.Rigidbody,
                fixture.Stats,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                preview);

            Assert.False(disabled.Navigation.Visible);
            Assert.That(disabled.Navigation.TrajectoryPreview.Status, Is.EqualTo(PrototypeTrajectoryPreviewStatus.Disabled));
            Assert.That(disabled.Navigation.TrajectoryPreview.Points.Length, Is.EqualTo(0));
        }
    }

    [Test]
    public void BootstrapBindsTrajectoryPreviewToHudAndMinimap()
    {
        GameObject host = new GameObject("TrajectoryPreviewBootstrapHost");
        try
        {
            PrototypeBootstrap bootstrap = host.AddComponent<PrototypeBootstrap>();
            bootstrap.BuildBuiltInVariant(0);

            PrototypeTrajectoryPreviewNavMap preview = Object.FindAnyObjectByType<PrototypeTrajectoryPreviewNavMap>();
            PrototypePlayerHudRenderer hud = Camera.main != null ? Camera.main.GetComponent<PrototypePlayerHudRenderer>() : null;
            PrototypeMinimapOverlay minimap = Camera.main != null ? Camera.main.GetComponent<PrototypeMinimapOverlay>() : null;

            Assert.NotNull(preview);
            Assert.NotNull(hud);
            Assert.NotNull(minimap);
            Assert.AreSame(preview, hud.TrajectoryPreview);
            Assert.AreSame(preview, minimap.TrajectoryPreview);
            Assert.True(preview.RefreshPreview().HasRenderablePoints);
        }
        finally
        {
            DestroyNamed("TrajectoryPreviewBootstrapHost");
            DestroyNamed("PrototypeBootstrap");
            DestroyNamed("PrototypeShip");
            DestroyNamed("PrototypeDockingApproachTarget");
            DestroyNamed("Main Camera");
            DestroyNamed("Directional Light");
            DestroyNamed("EventSystem");
            DestroyNamed("PrototypePlayerHudEventSystem");
        }
    }

    [Test]
    public void BurnPlanEstimatesDirectionDurationThrottleFuelAndDeltaV()
    {
        TrajectoryBurnPlan plan = TrajectoryBurnPlan.Estimate(
            Vector3.up * 3f,
            5f,
            0.5f,
            1000f,
            0.6f,
            1f,
            100f);

        Assert.True(plan.HasBurn);
        Assert.That(Vector3.Distance(plan.directionWorld, Vector3.up), Is.LessThan(0.0001f));
        Assert.That(plan.durationSeconds, Is.EqualTo(5f).Within(0.0001f));
        Assert.That(plan.throttle, Is.EqualTo(0.5f).Within(0.0001f));
        Assert.That(plan.requestedFuelKg, Is.EqualTo(1.5f).Within(0.0001f));
        Assert.That(plan.estimatedFuelKg, Is.EqualTo(1f).Within(0.0001f));
        Assert.That(plan.appliedFuelFraction, Is.EqualTo(2f / 3f).Within(0.0001f));
        Assert.That(plan.estimatedDeltaV, Is.EqualTo((1000f * 0.5f * (2f / 3f) * 5f) / 100f).Within(0.0001f));
        Assert.True(plan.IsFinite);
    }

    private static GameObject CreateGravityBody(Vector3 position)
    {
        var gravityBody = new GameObject("TrajectoryPredictionGravityBody");
        gravityBody.transform.position = position;
        return gravityBody;
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

    private static void DestroyNamed(string name)
    {
        GameObject[] objects = Object.FindObjectsByType<GameObject>(FindObjectsInactive.Include);
        for (int i = 0; i < objects.Length; i++)
        {
            if (objects[i] != null && objects[i].name == name)
            {
                Object.DestroyImmediate(objects[i]);
            }
        }
    }
}
#endif
