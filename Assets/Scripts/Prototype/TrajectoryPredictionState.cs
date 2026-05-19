using System;
using UnityEngine;

[Serializable]
public struct TrajectoryPredictionState
{
    public Vector3 position;
    public Vector3 velocity;
    public Quaternion rotation;
    public Vector3 angularVelocity;
    public float elapsedTime;
    public float remainingFuelKg;

    public TrajectoryPredictionState(
        Vector3 position,
        Vector3 velocity,
        Quaternion rotation,
        Vector3 angularVelocity,
        float elapsedTime,
        float remainingFuelKg)
    {
        this.position = position;
        this.velocity = velocity;
        this.rotation = rotation;
        this.angularVelocity = angularVelocity;
        this.elapsedTime = Mathf.Max(0f, elapsedTime);
        this.remainingFuelKg = Mathf.Max(0f, remainingFuelKg);
    }

    public bool IsFinite => TrajectoryPredictionMath.IsFinite(position)
        && TrajectoryPredictionMath.IsFinite(velocity)
        && TrajectoryPredictionMath.IsFinite(rotation)
        && TrajectoryPredictionMath.IsFinite(angularVelocity)
        && TrajectoryPredictionMath.IsFinite(elapsedTime)
        && TrajectoryPredictionMath.IsFinite(remainingFuelKg);

    public static TrajectoryPredictionState FromRigidbody(Rigidbody body, ShipStats stats = null)
    {
        if (body == null)
        {
            return new TrajectoryPredictionState(
                Vector3.zero,
                Vector3.zero,
                Quaternion.identity,
                Vector3.zero,
                0f,
                stats != null ? stats.CurrentFuelKg : 0f);
        }

        return new TrajectoryPredictionState(
            body.worldCenterOfMass,
            body.linearVelocity,
            body.rotation,
            body.angularVelocity,
            0f,
            stats != null ? stats.CurrentFuelKg : 0f);
    }
}

public static class TrajectoryPredictionMath
{
    public static bool IsFinite(float value)
    {
        return !float.IsNaN(value) && !float.IsInfinity(value);
    }

    public static bool IsFinite(Vector3 value)
    {
        return IsFinite(value.x) && IsFinite(value.y) && IsFinite(value.z);
    }

    public static bool IsFinite(Quaternion value)
    {
        return IsFinite(value.x) && IsFinite(value.y) && IsFinite(value.z) && IsFinite(value.w);
    }
}
