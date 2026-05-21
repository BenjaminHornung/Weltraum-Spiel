using UnityEngine;

public enum PrototypeTrajectoryPhase
{
    Idle,
    AlignForBurn,
    LongRangeBurn,
    Coast,
    Avoidance,
    Brake,
    FinalApproach,
    Hold,
    Failed,
    Clear
}

public struct PrototypeTrajectorySnapshot
{
    public Vector3 position;
    public Vector3 velocity;
    public Vector3 targetPosition;
    public Vector3 forward;
    public float massKg;
    public float maxMainAcceleration;
    public float maxRcsForce;
    public float clearanceRadius;

    public PrototypeTrajectorySnapshot(
        Vector3 position,
        Vector3 velocity,
        Vector3 targetPosition,
        Vector3 forward,
        float massKg,
        float maxMainAcceleration,
        float maxRcsForce,
        float clearanceRadius)
    {
        this.position = position;
        this.velocity = velocity;
        this.targetPosition = targetPosition;
        this.forward = forward.sqrMagnitude > 0.0001f ? forward.normalized : Vector3.forward;
        this.massKg = Mathf.Max(0.01f, massKg);
        this.maxMainAcceleration = Mathf.Max(0f, maxMainAcceleration);
        this.maxRcsForce = Mathf.Max(0f, maxRcsForce);
        this.clearanceRadius = Mathf.Max(0.01f, clearanceRadius);
    }

    public Vector3 DirectionToTarget
    {
        get
        {
            Vector3 toTarget = targetPosition - position;
            return toTarget.sqrMagnitude > 0.0001f ? toTarget.normalized : forward;
        }
    }
}

public struct PrototypeTrajectoryPlan
{
    public PrototypeTrajectoryPhase phase;
    public Vector3 desiredBurnDirection;
    public Vector3 desiredBurnDirectionWorld;
    public Vector3 desiredAccelerationWorld;
    public Vector3 requestedRcsForceWorld;
    public Vector3 requestedTorqueLocal;
    public Vector3 avoidanceDirection;
    public Vector3 obstacleDirection;
    public Vector3 avoidanceWaypoint;
    public float mainThrottleLimit;
    public float requestedMainThrottle;
    public bool obstacleDetected;
    public bool isValid;
    public bool avoidanceActive;
    public string obstacleLabel;
    public float obstacleDistance;
    public float plannedStoppingDistance;
    public float plannedEtaSeconds;
    public string failureReason;
    public string status;
    public string statusLabel;

    public bool RequiresAvoidance => phase == PrototypeTrajectoryPhase.Avoidance || avoidanceActive;

    public static PrototypeTrajectoryPlan Clear(Vector3 desiredDirection)
    {
        Vector3 direction = desiredDirection.sqrMagnitude > 0.0001f ? desiredDirection.normalized : Vector3.forward;
        return new PrototypeTrajectoryPlan
        {
            phase = PrototypeTrajectoryPhase.LongRangeBurn,
            desiredBurnDirection = direction,
            desiredBurnDirectionWorld = direction,
            desiredAccelerationWorld = direction,
            requestedRcsForceWorld = Vector3.zero,
            requestedTorqueLocal = Vector3.zero,
            avoidanceDirection = Vector3.zero,
            obstacleDirection = Vector3.zero,
            avoidanceWaypoint = Vector3.zero,
            mainThrottleLimit = 1f,
            requestedMainThrottle = 1f,
            obstacleDetected = false,
            isValid = true,
            avoidanceActive = false,
            obstacleLabel = "none",
            obstacleDistance = 0f,
            plannedStoppingDistance = 0f,
            plannedEtaSeconds = float.PositiveInfinity,
            failureReason = string.Empty,
            status = "clear",
            statusLabel = "clear"
        };
    }
}

public class PrototypeTrajectoryPlanner
{
    private const float AvoidanceBlend = 1.45f;

    public PrototypeTrajectoryPlan Plan(PrototypeTrajectorySnapshot snapshot, PrototypeObstacleDetectionResult detection)
    {
        Vector3 targetDirection = snapshot.DirectionToTarget;
        if (!detection.detected || detection.obstacle == null)
        {
            PrototypeTrajectoryPlan clearPlan = PrototypeTrajectoryPlan.Clear(targetDirection);
            clearPlan.plannedStoppingDistance = EstimateStoppingDistance(snapshot);
            clearPlan.plannedEtaSeconds = EstimateEta(snapshot);
            clearPlan.desiredAccelerationWorld = targetDirection * snapshot.maxMainAcceleration;
            clearPlan.statusLabel = clearPlan.status;
            return clearPlan;
        }

        Vector3 obstacleCenter = detection.obstacle.WorldBounds.center;
        Vector3 obstacleDirection = obstacleCenter - snapshot.position;
        obstacleDirection = obstacleDirection.sqrMagnitude > 0.0001f ? obstacleDirection.normalized : targetDirection;
        Vector3 rejection = obstacleDirection - targetDirection * Vector3.Dot(obstacleDirection, targetDirection);
        Vector3 avoidanceDirection = rejection.sqrMagnitude > 0.0001f
            ? -rejection.normalized
            : Vector3.Cross(targetDirection, Vector3.up);
        if (avoidanceDirection.sqrMagnitude <= 0.0001f)
        {
            avoidanceDirection = Vector3.Cross(targetDirection, Vector3.right);
        }

        avoidanceDirection.Normalize();
        Vector3 desiredDirection = (targetDirection + avoidanceDirection * AvoidanceBlend).normalized;
        if (Vector3.Dot(desiredDirection, obstacleDirection) > 0.75f)
        {
            desiredDirection = avoidanceDirection;
        }

        float obstacleDistance = detection.distance > 0f
            ? detection.distance
            : Vector3.Distance(snapshot.position, detection.obstacle.WorldPosition);
        Vector3 avoidanceWaypoint = snapshot.position + desiredDirection * Mathf.Max(snapshot.clearanceRadius * 2f, obstacleDistance);
        float requestedThrottle = 0.65f;
        Vector3 requestedRcsForce = Vector3.zero;
        if (snapshot.maxRcsForce > 0.0001f)
        {
            float maxRcsAcceleration = snapshot.maxRcsForce / snapshot.massKg;
            float desiredRcsAcceleration = Mathf.Clamp(snapshot.maxMainAcceleration * 0.35f, 0.5f, Mathf.Max(0.5f, maxRcsAcceleration));
            requestedRcsForce = Vector3.ClampMagnitude(avoidanceDirection * snapshot.massKg * desiredRcsAcceleration, snapshot.maxRcsForce);
        }

        return new PrototypeTrajectoryPlan
        {
            phase = PrototypeTrajectoryPhase.Avoidance,
            desiredBurnDirection = desiredDirection,
            desiredBurnDirectionWorld = desiredDirection,
            desiredAccelerationWorld = desiredDirection * snapshot.maxMainAcceleration * requestedThrottle,
            requestedRcsForceWorld = requestedRcsForce,
            requestedTorqueLocal = Vector3.zero,
            avoidanceDirection = avoidanceDirection,
            obstacleDirection = obstacleDirection,
            avoidanceWaypoint = avoidanceWaypoint,
            mainThrottleLimit = requestedThrottle,
            requestedMainThrottle = requestedThrottle,
            obstacleDetected = true,
            isValid = true,
            avoidanceActive = true,
            obstacleLabel = detection.obstacle.DisplayName,
            obstacleDistance = obstacleDistance,
            plannedStoppingDistance = EstimateStoppingDistance(snapshot),
            plannedEtaSeconds = EstimateEta(snapshot),
            failureReason = string.Empty,
            status = "avoidance",
            statusLabel = "avoidance"
        };
    }

    private static float EstimateStoppingDistance(PrototypeTrajectorySnapshot snapshot)
    {
        if (snapshot.maxMainAcceleration <= 0.0001f)
        {
            return 0f;
        }

        float closingSpeed = Mathf.Max(0f, Vector3.Dot(snapshot.velocity, snapshot.DirectionToTarget));
        return (closingSpeed * closingSpeed) / (2f * snapshot.maxMainAcceleration);
    }

    private static float EstimateEta(PrototypeTrajectorySnapshot snapshot)
    {
        Vector3 toTarget = snapshot.targetPosition - snapshot.position;
        float distance = toTarget.magnitude;
        if (distance <= 0.0001f)
        {
            return 0f;
        }

        float closingSpeed = Mathf.Max(0f, Vector3.Dot(snapshot.velocity, snapshot.DirectionToTarget));
        return closingSpeed > 0.0001f ? distance / closingSpeed : float.PositiveInfinity;
    }
}
