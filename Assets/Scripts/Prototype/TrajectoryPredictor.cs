using System;
using UnityEngine;

[Serializable]
public struct TrajectoryPredictionSettings
{
    public int stepCount;
    public float fixedDeltaTime;
    public bool includeCentralGravity;

    public TrajectoryPredictionSettings(int stepCount, float fixedDeltaTime, bool includeCentralGravity)
    {
        this.stepCount = stepCount;
        this.fixedDeltaTime = fixedDeltaTime;
        this.includeCentralGravity = includeCentralGravity;
    }

    public static TrajectoryPredictionSettings GravityOnly(int stepCount, float fixedDeltaTime)
    {
        return new TrajectoryPredictionSettings(stepCount, fixedDeltaTime, true);
    }
}

public static class TrajectoryPredictor
{
    public const int MaxStepCount = 2048;
    public const float DefaultFixedDeltaTime = 0.02f;

    public static TrajectoryPredictionState[] Predict(
        TrajectoryPredictionState initialState,
        ShipPhysicsCore physicsCore,
        int stepCount,
        float fixedDeltaTime)
    {
        return Predict(initialState, physicsCore, new TrajectoryPredictionSettings(stepCount, fixedDeltaTime, true));
    }

    public static TrajectoryPredictionState[] Predict(
        TrajectoryPredictionState initialState,
        ShipPhysicsCore physicsCore,
        TrajectoryPredictionSettings settings)
    {
        if (!initialState.IsFinite)
        {
            return Array.Empty<TrajectoryPredictionState>();
        }

        int steps = Mathf.Clamp(settings.stepCount, 0, MaxStepCount);
        float deltaTime = settings.fixedDeltaTime > 0f && TrajectoryPredictionMath.IsFinite(settings.fixedDeltaTime)
            ? settings.fixedDeltaTime
            : DefaultFixedDeltaTime;

        var states = new TrajectoryPredictionState[steps + 1];
        states[0] = initialState;

        TrajectoryPredictionState current = initialState;
        for (int i = 1; i < states.Length; i++)
        {
            Vector3 acceleration = Vector3.zero;
            if (settings.includeCentralGravity
                && physicsCore != null
                && physicsCore.TryEvaluateCentralGravityAcceleration(current.position, out Vector3 gravityAcceleration, out _, out _))
            {
                acceleration += gravityAcceleration;
            }

            Vector3 velocity = current.velocity + acceleration * deltaTime;
            Vector3 position = current.position + velocity * deltaTime;
            var next = new TrajectoryPredictionState(
                position,
                velocity,
                current.rotation,
                current.angularVelocity,
                current.elapsedTime + deltaTime,
                current.remainingFuelKg);

            if (!next.IsFinite)
            {
                Array.Resize(ref states, i);
                return states;
            }

            states[i] = next;
            current = next;
        }

        return states;
    }
}
