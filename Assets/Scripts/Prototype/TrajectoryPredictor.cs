using System;
using UnityEngine;

[Serializable]
public struct TrajectoryPredictionSettings
{
    public int stepCount;
    public float fixedDeltaTime;
    public bool includeCentralGravity;
    public Vector3 mainAccelerationDirectionWorld;
    public float mainAccelerationMetersPerSecondSquared;
    public Vector3 rcsAccelerationWorld;
    public float fuelKgPerSecond;

    public TrajectoryPredictionSettings(int stepCount, float fixedDeltaTime, bool includeCentralGravity)
        : this(stepCount, fixedDeltaTime, includeCentralGravity, Vector3.zero, 0f, Vector3.zero, 0f)
    {
    }

    public TrajectoryPredictionSettings(
        int stepCount,
        float fixedDeltaTime,
        bool includeCentralGravity,
        Vector3 mainAccelerationDirectionWorld,
        float mainAccelerationMetersPerSecondSquared,
        Vector3 rcsAccelerationWorld,
        float fuelKgPerSecond)
    {
        this.stepCount = stepCount;
        this.fixedDeltaTime = fixedDeltaTime;
        this.includeCentralGravity = includeCentralGravity;
        this.mainAccelerationDirectionWorld = mainAccelerationDirectionWorld.sqrMagnitude > 0.0001f
            ? mainAccelerationDirectionWorld.normalized
            : Vector3.zero;
        this.mainAccelerationMetersPerSecondSquared = Mathf.Max(0f, mainAccelerationMetersPerSecondSquared);
        this.rcsAccelerationWorld = rcsAccelerationWorld;
        this.fuelKgPerSecond = Mathf.Max(0f, fuelKgPerSecond);
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

            if (settings.mainAccelerationMetersPerSecondSquared > 0f
                && settings.mainAccelerationDirectionWorld.sqrMagnitude > 0.0001f
                && (settings.fuelKgPerSecond <= 0f || current.remainingFuelKg > 0f))
            {
                acceleration += settings.mainAccelerationDirectionWorld * settings.mainAccelerationMetersPerSecondSquared;
            }

            if (settings.rcsAccelerationWorld.sqrMagnitude > 0.0001f)
            {
                acceleration += settings.rcsAccelerationWorld;
            }

            float remainingFuel = settings.fuelKgPerSecond > 0f
                ? Mathf.Max(0f, current.remainingFuelKg - settings.fuelKgPerSecond * deltaTime)
                : current.remainingFuelKg;
            Vector3 velocity = current.velocity + acceleration * deltaTime;
            Vector3 position = current.position + velocity * deltaTime;
            var next = new TrajectoryPredictionState(
                position,
                velocity,
                current.rotation,
                current.angularVelocity,
                current.elapsedTime + deltaTime,
                remainingFuel);

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

    public static TrajectoryPredictionState[] Predict(
        TrajectoryPredictionState initialState,
        Vector3 constantAccelerationWorld,
        int stepCount,
        float fixedDeltaTime,
        bool includeCentralGravity = false,
        ShipPhysicsCore physicsCore = null)
    {
        if (!initialState.IsFinite || !TrajectoryPredictionMath.IsFinite(constantAccelerationWorld))
        {
            return Array.Empty<TrajectoryPredictionState>();
        }

        int steps = Mathf.Clamp(stepCount, 0, MaxStepCount);
        float deltaTime = fixedDeltaTime > 0f && TrajectoryPredictionMath.IsFinite(fixedDeltaTime)
            ? fixedDeltaTime
            : DefaultFixedDeltaTime;

        var states = new TrajectoryPredictionState[steps + 1];
        states[0] = initialState;

        TrajectoryPredictionState current = initialState;
        Vector3 baselineAcceleration = constantAccelerationWorld;

        for (int i = 1; i < states.Length; i++)
        {
            Vector3 acceleration = baselineAcceleration;
            if (includeCentralGravity
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

    public static TrajectoryPredictionState[] PredictWithActuatorProfile(
        TrajectoryPredictionState initialState,
        Vector3 constantAccelerationWorld,
        TrajectoryPredictionSettings settings,
        ShipPhysicsCore physicsCore = null)
    {
        TrajectoryPredictionSettings safeSettings = settings;
        if (!TrajectoryPredictionMath.IsFinite(safeSettings.fixedDeltaTime) || safeSettings.fixedDeltaTime <= 0f)
        {
            safeSettings.fixedDeltaTime = DefaultFixedDeltaTime;
        }

        safeSettings.stepCount = Mathf.Clamp(safeSettings.stepCount, 0, MaxStepCount);

        return Predict(
            initialState,
            constantAccelerationWorld,
            safeSettings.stepCount,
            safeSettings.fixedDeltaTime,
            safeSettings.includeCentralGravity,
            physicsCore);
    }
}
