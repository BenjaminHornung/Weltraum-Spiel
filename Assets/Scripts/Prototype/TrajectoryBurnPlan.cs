using System;
using UnityEngine;

[Serializable]
public struct TrajectoryBurnPlan
{
    public Vector3 directionWorld;
    public float durationSeconds;
    public float throttle;
    public float requestedFuelKg;
    public float estimatedFuelKg;
    public float appliedFuelFraction;
    public float estimatedDeltaV;

    public TrajectoryBurnPlan(
        Vector3 directionWorld,
        float durationSeconds,
        float throttle,
        float requestedFuelKg,
        float estimatedFuelKg,
        float appliedFuelFraction,
        float estimatedDeltaV)
    {
        this.directionWorld = directionWorld.sqrMagnitude > 0.0001f ? directionWorld.normalized : Vector3.forward;
        this.durationSeconds = Mathf.Max(0f, durationSeconds);
        this.throttle = Mathf.Clamp01(throttle);
        this.requestedFuelKg = Mathf.Max(0f, requestedFuelKg);
        this.estimatedFuelKg = Mathf.Max(0f, estimatedFuelKg);
        this.appliedFuelFraction = Mathf.Clamp01(appliedFuelFraction);
        this.estimatedDeltaV = Mathf.Max(0f, estimatedDeltaV);
    }

    public bool HasBurn => durationSeconds > 0f && throttle > 0f && directionWorld.sqrMagnitude > 0.0001f;
    public bool IsFinite => TrajectoryPredictionMath.IsFinite(directionWorld)
        && TrajectoryPredictionMath.IsFinite(durationSeconds)
        && TrajectoryPredictionMath.IsFinite(throttle)
        && TrajectoryPredictionMath.IsFinite(requestedFuelKg)
        && TrajectoryPredictionMath.IsFinite(estimatedFuelKg)
        && TrajectoryPredictionMath.IsFinite(appliedFuelFraction)
        && TrajectoryPredictionMath.IsFinite(estimatedDeltaV);

    public static TrajectoryBurnPlan None => new TrajectoryBurnPlan(
        Vector3.forward,
        0f,
        0f,
        0f,
        0f,
        1f,
        0f);

    public static TrajectoryBurnPlan Estimate(
        Vector3 directionWorld,
        float durationSeconds,
        float throttle,
        float thrustNewtons,
        float fuelKgPerSecond,
        float availableFuelKg,
        float massKg)
    {
        float clampedDuration = Mathf.Max(0f, durationSeconds);
        float clampedThrottle = Mathf.Clamp01(throttle);
        if (clampedDuration <= 0f || clampedThrottle <= 0f)
        {
            return None;
        }

        float requestedFuel = Mathf.Max(0f, fuelKgPerSecond) * clampedThrottle * clampedDuration;
        float estimatedFuel = requestedFuel > 0f
            ? Mathf.Min(Mathf.Max(0f, availableFuelKg), requestedFuel)
            : 0f;
        float fuelFraction = requestedFuel > 0f ? Mathf.Clamp01(estimatedFuel / requestedFuel) : 1f;
        float effectiveThrust = Mathf.Max(0f, thrustNewtons) * clampedThrottle * fuelFraction;
        float deltaV = massKg > 0f ? (effectiveThrust * clampedDuration) / massKg : 0f;

        return new TrajectoryBurnPlan(
            directionWorld,
            clampedDuration,
            clampedThrottle,
            requestedFuel,
            estimatedFuel,
            fuelFraction,
            deltaV);
    }

    public static TrajectoryBurnPlan EstimateMainBurn(
        Vector3 directionWorld,
        float durationSeconds,
        float throttle,
        ShipStats stats,
        float massKg)
    {
        return Estimate(
            directionWorld,
            durationSeconds,
            throttle,
            stats != null ? stats.Thrust : 0f,
            stats != null ? stats.FuelConsumptionKgPerSecond : 0f,
            stats != null ? stats.CurrentFuelKg : 0f,
            massKg);
    }
}
