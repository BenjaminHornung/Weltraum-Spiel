#if UNITY_EDITOR || UNITY_INCLUDE_TESTS
using UnityEngine;

public static class SimulationAssertions
{
    public static bool MovedAlong(Vector3 before, Vector3 after, Vector3 direction, float minimumDistance)
    {
        Vector3 safeDirection = direction.sqrMagnitude > 0.0001f ? direction.normalized : Vector3.forward;
        return Vector3.Dot(after - before, safeDirection) >= Mathf.Max(0f, minimumDistance);
    }

    public static bool DistanceToTargetDecreased(Vector3 before, Vector3 after, Vector3 target, float minimumDecrease = 0f)
    {
        float beforeDistance = Vector3.Distance(before, target);
        float afterDistance = Vector3.Distance(after, target);
        return afterDistance <= beforeDistance - Mathf.Max(0f, minimumDecrease);
    }

    public static bool VectorIsFinite(Vector3 value)
    {
        return IsFinite(value.x) && IsFinite(value.y) && IsFinite(value.z);
    }

    public static float DistanceToTarget(Vector3 position, Vector3 target)
    {
        return Vector3.Distance(position, target);
    }

    private static bool IsFinite(float value)
    {
        return !float.IsNaN(value) && !float.IsInfinity(value);
    }
}
#endif
