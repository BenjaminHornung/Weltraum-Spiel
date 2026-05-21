using UnityEngine;

public struct ProjectileData
{
    public int projectileId;
    public int ownerTargetId;
    public WeaponProjectileMode mode;
    public int snapshotVersion;
    public int hitMask;
    public Vector3 previousPosition;
    public Vector3 position;
    public Vector3 direction;
    public Vector3 velocity;
    public float radius;
    public float mass;
    public float lifetime;
    public float age;
    public float damagePerImpulse;
    public int applyImpactDamageFlag;
    public int applyImpactImpulseFlag;
    public float lastDamageApplied;
    public int lastImpactImpulseAppliedFlag;
}

public struct TargetData
{
    public int targetId;
    public int snapshotVersion;
    public Vector3 position;
    public Quaternion rotation;
    public Vector3 forward;
    public Vector3 up;
    public Vector3 linearVelocity;
    public int isActiveInHierarchy;
    public int hasRigidbody;
    public int hasDamageState;
    public float currentHealth;
    public float maxHealth;
}

public struct ShipRuntimeState
{
    public int shipId;
    public int snapshotVersion;
    public int hasRigidbody;
    public int hasPhysicsCore;
    public int hasShipStats;
    public Vector3 position;
    public Quaternion rotation;
    public Vector3 linearVelocity;
    public Vector3 angularVelocity;
    public Vector3 centerOfMass;
    public float totalMass;
    public float fuelMass;
}

public struct RcsNozzleData
{
    public int nozzleId;
    public int shipId;
    public int snapshotVersion;
    public int isActive;
    public int isSpooling;
    public Vector3 localPosition;
    public Vector3 worldPosition;
    public Vector3 localForward;
    public Vector3 localUp;
    public Vector3 localRight;
    public Vector3 baseVfxScale;
    public float actualThrottle;
    public int cacheVersion;
    public int isCacheDirty;
}

public struct TrajectoryCandidateData
{
    public int candidateId;
    public int snapshotVersion;
    public Vector3 origin;
    public Vector3 velocity;
    public Vector3 targetPosition;
    public float timeToTarget;
    public float impactTime;
    public float score;
    public int isValid;
}

public struct SensorContactData
{
    public int contactId;
    public int snapshotVersion;
    public int targetId;
    public Vector3 point;
    public Vector3 normal;
    public Vector3 relativeVelocity;
    public float distance;
    public float confidence;
    public int hasCollider;
    public int hasRigidbody;
}

public struct CameraVisualBoundsData
{
    public int snapshotVersion;
    public int refreshCount;
    public int totalRendererCount;
    public int includedRendererCount;
    public int hasVisualBounds;
    public Vector3 visualBoundsCenter;
    public Vector3 visualBoundsCenterLocal;
    public float visualBoundsRadius;
    public Vector3 visualBoundsCenterOffsetFromCom;
    public Vector3 focusPoint;
}
