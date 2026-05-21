using UnityEngine;

public struct PrototypeObstacleDetectionResult
{
    public bool detected;
    public bool hasObstacle;
    public PrototypeNavigationObstacle obstacle;
    public Collider collider;
    public Vector3 point;
    public Vector3 hitPoint;
    public Vector3 normal;
    public Vector3 hitNormal;
    public Vector3 avoidanceDirection;
    public float distance;
    public float hitDistance;
    public float clearanceRadius;
    public string status;

    public bool IsClear => !detected && !hasObstacle;

    public static PrototypeObstacleDetectionResult Clear(float clearanceRadius)
    {
        return new PrototypeObstacleDetectionResult
        {
            detected = false,
            hasObstacle = false,
            obstacle = null,
            collider = null,
            point = Vector3.zero,
            hitPoint = Vector3.zero,
            normal = Vector3.zero,
            hitNormal = Vector3.zero,
            avoidanceDirection = Vector3.zero,
            distance = 0f,
            hitDistance = 0f,
            clearanceRadius = Mathf.Max(0.01f, clearanceRadius),
            status = "clear"
        };
    }

    public static PrototypeObstacleDetectionResult Hit(
        PrototypeNavigationObstacle obstacle,
        Collider collider,
        RaycastHit hit,
        float clearanceRadius)
    {
        return new PrototypeObstacleDetectionResult
        {
            detected = obstacle != null,
            hasObstacle = obstacle != null,
            obstacle = obstacle,
            collider = collider,
            point = hit.point,
            hitPoint = hit.point,
            normal = hit.normal,
            hitNormal = hit.normal,
            avoidanceDirection = hit.normal.sqrMagnitude > 0.0001f ? hit.normal.normalized : Vector3.zero,
            distance = Mathf.Max(0f, hit.distance),
            hitDistance = Mathf.Max(0f, hit.distance),
            clearanceRadius = Mathf.Max(0.01f, clearanceRadius),
            status = obstacle != null ? obstacle.DisplayName : "obstacle"
        };
    }

    public static PrototypeObstacleDetectionResult HitFallback(
        PrototypeNavigationObstacle obstacle,
        Vector3 point,
        Vector3 normal,
        float distance,
        float clearanceRadius)
    {
        Vector3 safeNormal = normal.sqrMagnitude > 0.0001f ? normal.normalized : Vector3.up;
        return new PrototypeObstacleDetectionResult
        {
            detected = obstacle != null,
            hasObstacle = obstacle != null,
            obstacle = obstacle,
            collider = null,
            point = point,
            hitPoint = point,
            normal = safeNormal,
            hitNormal = safeNormal,
            avoidanceDirection = safeNormal,
            distance = Mathf.Max(0f, distance),
            hitDistance = Mathf.Max(0f, distance),
            clearanceRadius = Mathf.Max(0.01f, clearanceRadius),
            status = obstacle != null ? obstacle.DisplayName : "obstacle"
        };
    }
}

[DisallowMultipleComponent]
public class PrototypeObstacleDetector : MonoBehaviour
{
    [SerializeField] private LayerMask layerMask = ~0;
    [SerializeField] private float lookAheadSeconds = 4f;
    [SerializeField] private float minimumLookAheadDistance = 120f;
    [SerializeField] private float shipRadius = 3f;
    [SerializeField] private float defaultClearanceMeters = 8f;
    [SerializeField] private bool useSphereCast = true;
    [SerializeField] private bool includeNavigationObstacleComponentsWithoutCollider = true;

    private readonly RaycastHit[] hitBuffer = new RaycastHit[32];

    public float DefaultClearanceRadiusMeters => Mathf.Max(0.01f, defaultClearanceMeters);
    public float DefaultClearanceMeters => DefaultClearanceRadiusMeters;
    public LayerMask ObstacleLayers => layerMask;
    public LayerMask LayerMask => layerMask;
    public float LookAheadSeconds => lookAheadSeconds;
    public float MinimumLookAheadDistance => minimumLookAheadDistance;
    public float ShipRadius => shipRadius;
    public bool UseSphereCast => useSphereCast;
    public bool IncludeNavigationObstacleComponentsWithoutCollider => includeNavigationObstacleComponentsWithoutCollider;

    public PrototypeObstacleDetectionResult DetectDirectPath(
        Rigidbody ownShip,
        Vector3 targetPosition,
        float clearanceRadiusMeters)
    {
        if (ownShip == null)
        {
            return PrototypeObstacleDetectionResult.Clear(clearanceRadiusMeters);
        }

        return DetectDirectPath(
            ownShip.worldCenterOfMass,
            targetPosition,
            Mathf.Max(0.01f, clearanceRadiusMeters),
            ownShip.transform,
            ownShip.linearVelocity,
            EstimateStoppingDistance(ownShip));
    }

    public PrototypeObstacleDetectionResult DetectDirectPath(
        Vector3 origin,
        Vector3 targetPosition,
        float clearanceRadiusMeters,
        Transform ownRoot)
    {
        return DetectDirectPath(origin, targetPosition, clearanceRadiusMeters, ownRoot, Vector3.zero, 0f);
    }

    public PrototypeObstacleDetectionResult DetectDirectPath(
        Vector3 origin,
        Vector3 targetPosition,
        float clearanceRadiusMeters,
        Transform ownRoot,
        Vector3 currentVelocity,
        float stoppingDistanceMeters)
    {
        float clearanceRadius = Mathf.Max(0.01f, clearanceRadiusMeters);
        Vector3 toTarget = targetPosition - origin;
        float pathDistance = toTarget.magnitude;
        if (pathDistance <= 0.01f)
        {
            return PrototypeObstacleDetectionResult.Clear(clearanceRadius);
        }

        Vector3 direction = toTarget / pathDistance;
        float maxDistance = ComputeLookAheadDistance(currentVelocity, stoppingDistanceMeters, pathDistance);
        if (useSphereCast
            && Physics.SphereCast(origin, clearanceRadius, direction, out RaycastHit firstHit, maxDistance, layerMask, QueryTriggerInteraction.Collide)
            && TryBuildResult(firstHit, ownRoot, clearanceRadius, out PrototypeObstacleDetectionResult firstResult))
        {
            return firstResult;
        }

        int count = useSphereCast
            ? Physics.SphereCastNonAlloc(origin, clearanceRadius, direction, hitBuffer, maxDistance, layerMask, QueryTriggerInteraction.Collide)
            : Physics.RaycastNonAlloc(origin, direction, hitBuffer, maxDistance, layerMask, QueryTriggerInteraction.Collide);
        int bestIndex = -1;
        float bestDistance = float.PositiveInfinity;
        for (int i = 0; i < count; i++)
        {
            RaycastHit hit = hitBuffer[i];
            if (hit.collider == null || hit.distance >= bestDistance)
            {
                continue;
            }

            if (!TryBuildResult(hit, ownRoot, clearanceRadius, out _))
            {
                continue;
            }

            bestIndex = i;
            bestDistance = hit.distance;
        }

        if (bestIndex >= 0 && TryBuildResult(hitBuffer[bestIndex], ownRoot, clearanceRadius, out PrototypeObstacleDetectionResult result))
        {
            return result;
        }

        if (includeNavigationObstacleComponentsWithoutCollider
            && TryDetectFallbackObstacle(origin, direction, maxDistance, clearanceRadius, ownRoot, out PrototypeObstacleDetectionResult fallback))
        {
            return fallback;
        }

        return PrototypeObstacleDetectionResult.Clear(clearanceRadius);
    }

    private static bool TryBuildResult(
        RaycastHit hit,
        Transform ownRoot,
        float clearanceRadius,
        out PrototypeObstacleDetectionResult result)
    {
        result = PrototypeObstacleDetectionResult.Clear(clearanceRadius);
        Collider hitCollider = hit.collider;
        if (hitCollider == null)
        {
            return false;
        }

        if (ownRoot != null && hitCollider.transform.IsChildOf(ownRoot))
        {
            return false;
        }

        PrototypeNavigationObstacle obstacle = hitCollider.GetComponentInParent<PrototypeNavigationObstacle>();
        if (obstacle == null || !obstacle.BlocksAutopilot)
        {
            return false;
        }

        result = PrototypeObstacleDetectionResult.Hit(obstacle, hitCollider, hit, clearanceRadius);
        return true;
    }

    private float ComputeLookAheadDistance(Vector3 currentVelocity, float stoppingDistanceMeters, float pathDistance)
    {
        float speedLookAhead = currentVelocity.magnitude * Mathf.Max(0f, lookAheadSeconds);
        float requestedLookAhead = Mathf.Max(minimumLookAheadDistance, speedLookAhead + Mathf.Max(0f, stoppingDistanceMeters));
        return Mathf.Clamp(requestedLookAhead, 0.01f, Mathf.Max(0.01f, pathDistance));
    }

    private static float EstimateStoppingDistance(Rigidbody ownShip)
    {
        if (ownShip == null)
        {
            return 0f;
        }

        ShipStats stats = ownShip.GetComponent<ShipStats>();
        if (stats == null || stats.CurrentMass <= 0f || stats.Thrust <= 0f)
        {
            return 0f;
        }

        float acceleration = stats.Thrust / stats.CurrentMass;
        return acceleration > 0.0001f ? ownShip.linearVelocity.sqrMagnitude / (2f * acceleration) : 0f;
    }

    private bool TryDetectFallbackObstacle(
        Vector3 origin,
        Vector3 direction,
        float maxDistance,
        float clearanceRadius,
        Transform ownRoot,
        out PrototypeObstacleDetectionResult result)
    {
        result = PrototypeObstacleDetectionResult.Clear(clearanceRadius);
        PrototypeNavigationObstacle[] obstacles = FindObjectsByType<PrototypeNavigationObstacle>(FindObjectsInactive.Exclude);
        PrototypeNavigationObstacle bestObstacle = null;
        Vector3 bestPoint = Vector3.zero;
        Vector3 bestNormal = Vector3.zero;
        float bestDistance = float.PositiveInfinity;

        for (int i = 0; i < obstacles.Length; i++)
        {
            PrototypeNavigationObstacle obstacle = obstacles[i];
            if (obstacle == null || !obstacle.BlocksAutopilot || obstacle.GetComponentInChildren<Collider>() != null)
            {
                continue;
            }

            if (ownRoot != null && obstacle.transform.IsChildOf(ownRoot))
            {
                continue;
            }

            if (((1 << obstacle.gameObject.layer) & layerMask.value) == 0)
            {
                continue;
            }

            Vector3 toObstacle = obstacle.WorldPosition - origin;
            float projectedDistance = Vector3.Dot(toObstacle, direction);
            if (projectedDistance < 0f || projectedDistance > maxDistance || projectedDistance >= bestDistance)
            {
                continue;
            }

            Vector3 closestPointOnPath = origin + direction * projectedDistance;
            Vector3 fromPath = obstacle.WorldPosition - closestPointOnPath;
            float combinedRadius = obstacle.EffectiveClearanceRadius + clearanceRadius + Mathf.Max(0f, shipRadius);
            if (fromPath.sqrMagnitude > combinedRadius * combinedRadius)
            {
                continue;
            }

            bestObstacle = obstacle;
            bestPoint = closestPointOnPath;
            bestNormal = fromPath.sqrMagnitude > 0.0001f ? -fromPath.normalized : -direction;
            bestDistance = projectedDistance;
        }

        if (bestObstacle == null)
        {
            return false;
        }

        result = PrototypeObstacleDetectionResult.HitFallback(bestObstacle, bestPoint, bestNormal, bestDistance, clearanceRadius);
        return true;
    }

    private void OnValidate()
    {
        defaultClearanceMeters = Mathf.Max(0.01f, defaultClearanceMeters);
        lookAheadSeconds = Mathf.Max(0f, lookAheadSeconds);
        minimumLookAheadDistance = Mathf.Max(0.01f, minimumLookAheadDistance);
        shipRadius = Mathf.Max(0f, shipRadius);
    }
}
