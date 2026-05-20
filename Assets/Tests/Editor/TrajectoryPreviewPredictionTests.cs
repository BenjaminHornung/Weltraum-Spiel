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
}
#endif
