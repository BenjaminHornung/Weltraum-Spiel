using UnityEngine;

public struct PrototypeImpactEventData
{
    public bool hasImpact;
    public Collider hitCollider;
    public Rigidbody targetRigidbody;
    public ModuleMassDescriptor moduleHit;
    public Vector3 hitPoint;
    public Vector3 hitNormal;
    public Vector3 relativeVelocity;
    public Vector3 impactImpulse;
    public float time;

    public bool HasModule => moduleHit != null;
    public string ModuleId => moduleHit != null ? moduleHit.ModuleId : "none";
    public float ImpactSpeed => relativeVelocity.magnitude;
    public float ImpactImpulseMagnitude => impactImpulse.magnitude;

    public static PrototypeImpactEventData Create(
        Collider collider,
        Rigidbody rigidbody,
        ModuleMassDescriptor module,
        Vector3 point,
        Vector3 normal,
        Vector3 relativeVelocity,
        Vector3 impactImpulse,
        float time)
    {
        return new PrototypeImpactEventData
        {
            hasImpact = true,
            hitCollider = collider,
            targetRigidbody = rigidbody,
            moduleHit = module,
            hitPoint = point,
            hitNormal = NormalizeOrFallback(normal, -relativeVelocity),
            relativeVelocity = relativeVelocity,
            impactImpulse = impactImpulse,
            time = time
        };
    }

    public static PrototypeImpactEventData FromProjectileHit(ProjectileHitData hit, float projectileMassKg)
    {
        if (!hit.hasHit)
        {
            return default;
        }

        Rigidbody targetBody = hit.attachedRigidbody;
        Vector3 targetVelocity = targetBody != null ? targetBody.linearVelocity : Vector3.zero;
        Vector3 relativeVelocity = hit.incomingVelocity - targetVelocity;
        Vector3 impulse = EstimateImpulse(relativeVelocity, projectileMassKg);
        ModuleMassDescriptor module = hit.collider != null ? hit.collider.GetComponentInParent<ModuleMassDescriptor>() : null;
        return Create(hit.collider, targetBody, module, hit.point, hit.normal, relativeVelocity, impulse, hit.time);
    }

    public static Vector3 EstimateImpulse(Vector3 relativeVelocity, float projectileMassKg)
    {
        float mass = Mathf.Max(0f, projectileMassKg);
        return relativeVelocity * mass;
    }

    private static Vector3 NormalizeOrFallback(Vector3 value, Vector3 fallback)
    {
        if (value.sqrMagnitude > 0.0001f)
        {
            return value.normalized;
        }

        if (fallback.sqrMagnitude > 0.0001f)
        {
            return fallback.normalized;
        }

        return Vector3.forward;
    }
}
