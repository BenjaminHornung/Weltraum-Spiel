using System.Collections.Generic;
using UnityEngine;

public struct PrototypeProjectileFireRequest
{
    public WeaponProjectileMode mode;
    public Transform ownerRoot;
    public Transform muzzleTransform;
    public Vector3 origin;
    public Vector3 direction;
    public Vector3 inheritedVelocity;
    public float projectileSpeed;
    public float projectileRadius;
    public float projectileMass;
    public float lifetime;
    public float maxDistance;
    public int tracerEveryNthShot;
    public int hitMask;
    public bool emitMuzzleVisual;
    public bool applyImpactDamage;
    public bool applyImpactImpulse;
    public float damagePerImpulse;

    public static PrototypeProjectileFireRequest FromWeapon(
        WeaponProjectileMode mode,
        Transform ownerRoot,
        Transform muzzleTransform,
        Vector3 direction,
        Vector3 inheritedVelocity,
        float projectileSpeed,
        float projectileRadius,
        float projectileMass,
        float lifetime,
        float maxDistance,
        int tracerEveryNthShot)
    {
        return new PrototypeProjectileFireRequest
        {
            mode = mode,
            ownerRoot = ownerRoot,
            muzzleTransform = muzzleTransform,
            origin = muzzleTransform != null ? muzzleTransform.position : Vector3.zero,
            direction = NormalizeOrFallback(direction, muzzleTransform != null ? muzzleTransform.forward : Vector3.forward),
            inheritedVelocity = inheritedVelocity,
            projectileSpeed = Mathf.Max(0f, projectileSpeed),
            projectileRadius = Mathf.Max(0.001f, projectileRadius),
            projectileMass = Mathf.Max(PrototypeGunSettings.MinimumProjectileMass, projectileMass),
            lifetime = Mathf.Max(PrototypeGunSettings.MinimumProjectileLifetime, lifetime),
            maxDistance = Mathf.Max(0.01f, maxDistance),
            tracerEveryNthShot = Mathf.Max(0, tracerEveryNthShot),
            hitMask = Physics.DefaultRaycastLayers,
            emitMuzzleVisual = true,
            applyImpactDamage = true,
            applyImpactImpulse = true,
            damagePerImpulse = 0.02f
        };
    }

    private static Vector3 NormalizeOrFallback(Vector3 value, Vector3 fallback)
    {
        if (value.sqrMagnitude > 0.0001f)
        {
            return value.normalized;
        }

        return fallback.sqrMagnitude > 0.0001f ? fallback.normalized : Vector3.forward;
    }
}

public struct PrototypeProjectileFireResult
{
    public bool fired;
    public WeaponProjectileMode mode;
    public Vector3 projectileVelocityWorld;
    public bool hasImmediateHit;
    public ProjectileHitData hitData;
    public PrototypeImpactEventData impactEvent;
    public float damageApplied;
    public bool impactImpulseApplied;
    public int activeSimulatedProjectileCount;
    public bool tracerVisualEmitted;
    public bool muzzleVisualEmitted;
    public bool impactVisualEmitted;
}

public class PrototypeProjectileSimulation : MonoBehaviour
{
    private const int DefaultHitBufferSize = 32;
    private const int DefaultMaxActiveProjectiles = 512;

    private static PrototypeProjectileSimulation instance;

    [SerializeField] private PrototypeProjectileVisualPool visualPool;
    [SerializeField] private int hitBufferSize = DefaultHitBufferSize;
    [SerializeField] private int maxActiveProjectiles = DefaultMaxActiveProjectiles;

    private readonly List<ActiveProjectile> activeProjectiles = new List<ActiveProjectile>(128);
    private RaycastHit[] hitBuffer;
    private int totalShotsProcessed;
    private int nextProjectileId = 1;
    private int projectileSnapshotVersion;

    public static PrototypeProjectileSimulation Instance => instance;
    public PrototypeProjectileVisualPool VisualPool => visualPool;
    public int ActiveProjectileCount => activeProjectiles.Count;
    public int TotalShotsProcessed => totalShotsProcessed;
    public int CopyActiveProjectileSnapshot(List<ProjectileData> buffer)
    {
        if (buffer == null)
        {
            return 0;
        }

        int snapshotVersion = ++projectileSnapshotVersion;
        buffer.Clear();
        for (int i = 0; i < activeProjectiles.Count; i++)
        {
            ActiveProjectile projectile = activeProjectiles[i];
            buffer.Add(new ProjectileData
            {
                projectileId = projectile.id,
                ownerTargetId = projectile.ownerRoot != null ? projectile.ownerRoot.GetHashCode() : 0,
                mode = WeaponProjectileMode.SimulatedProjectile,
                snapshotVersion = snapshotVersion,
                hitMask = projectile.hitMask,
                previousPosition = projectile.previousPosition,
                position = projectile.position,
                direction = projectile.direction,
                velocity = projectile.velocity,
                radius = projectile.radius,
                mass = projectile.mass,
                lifetime = projectile.lifetime,
                age = projectile.age,
                damagePerImpulse = projectile.damagePerImpulse,
                applyImpactDamageFlag = projectile.applyImpactDamage ? 1 : 0,
                applyImpactImpulseFlag = projectile.applyImpactImpulse ? 1 : 0,
                lastDamageApplied = projectile.lastDamageApplied,
                lastImpactImpulseAppliedFlag = projectile.lastImpactImpulseApplied ? 1 : 0
            });
        }

        return buffer.Count;
    }
    public int HitBufferSize => hitBuffer != null ? hitBuffer.Length : Mathf.Max(1, hitBufferSize);
    public int NextProjectileId
    {
        get
        {
            return nextProjectileId;
        }
    }
    public PrototypeProjectileFireResult LastFireResult { get; private set; }

    public static PrototypeProjectileSimulation GetOrCreateDefault()
    {
        if (instance != null)
        {
            return instance;
        }

        var host = new GameObject("PrototypeProjectileSimulation");
        PrototypeProjectileRuntimeMarker.Mark(host);
        instance = host.AddComponent<PrototypeProjectileSimulation>();
        instance.EnsureInitialized();
        return instance;
    }

    private void Awake()
    {
        if (instance == null)
        {
            instance = this;
        }

        EnsureInitialized();
    }

    private void OnDestroy()
    {
        if (instance == this)
        {
            instance = null;
        }
    }

    private void FixedUpdate()
    {
        Simulate(Time.fixedDeltaTime);
    }

    public void EnsureInitialized()
    {
        if (hitBuffer == null || hitBuffer.Length != Mathf.Max(1, hitBufferSize))
        {
            hitBuffer = new RaycastHit[Mathf.Max(1, hitBufferSize)];
        }

        if (visualPool == null)
        {
            visualPool = GetComponentInChildren<PrototypeProjectileVisualPool>();
            if (visualPool == null)
            {
                var poolObject = new GameObject("PrototypeProjectileVisualPool");
                poolObject.transform.SetParent(transform, false);
                PrototypeProjectileRuntimeMarker.Mark(poolObject);
                visualPool = poolObject.AddComponent<PrototypeProjectileVisualPool>();
            }
        }

        visualPool.EnsurePrewarmed();
        PrototypeProjectileRuntimeMarker.Mark(gameObject);
    }

    public PrototypeProjectileFireResult Fire(PrototypeProjectileFireRequest request)
    {
        EnsureInitialized();
        totalShotsProcessed++;
        request.direction = NormalizeOrFallback(request.direction, request.muzzleTransform != null ? request.muzzleTransform.forward : Vector3.forward);
        request.projectileRadius = Mathf.Max(0.001f, request.projectileRadius);
        request.projectileMass = Mathf.Max(PrototypeGunSettings.MinimumProjectileMass, request.projectileMass);
        request.lifetime = Mathf.Max(PrototypeGunSettings.MinimumProjectileLifetime, request.lifetime);
        request.maxDistance = request.maxDistance > 0f ? request.maxDistance : Mathf.Max(1f, request.projectileSpeed * request.lifetime);
        request.hitMask = request.hitMask == 0 ? Physics.DefaultRaycastLayers : request.hitMask;

        var result = new PrototypeProjectileFireResult
        {
            fired = true,
            mode = request.mode,
            projectileVelocityWorld = request.inheritedVelocity + (request.direction * request.projectileSpeed),
            activeSimulatedProjectileCount = activeProjectiles.Count
        };

        if (request.emitMuzzleVisual && visualPool != null)
        {
            Quaternion muzzleRotation = request.muzzleTransform != null
                ? request.muzzleTransform.rotation
                : Quaternion.LookRotation(request.direction, Vector3.up);
            visualPool.EmitMuzzle(request.origin, muzzleRotation, request.projectileRadius);
            result.muzzleVisualEmitted = true;
        }

        WeaponProjectileMode resolvedMode = request.mode == WeaponProjectileMode.GuidedProjectile
            ? WeaponProjectileMode.SimulatedProjectile
            : request.mode;

        if (resolvedMode == WeaponProjectileMode.SimulatedProjectile)
        {
            QueueSimulatedProjectile(request, ref result);
        }
        else
        {
            ProcessHitscan(request, ref result);
        }

        result.activeSimulatedProjectileCount = activeProjectiles.Count;
        LastFireResult = result;
        return result;
    }

    public void Simulate(float deltaTime)
    {
        EnsureInitialized();
        float dt = Mathf.Max(0f, deltaTime);
        if (dt <= 0f)
        {
            return;
        }

        for (int i = activeProjectiles.Count - 1; i >= 0; i--)
        {
            ActiveProjectile projectile = activeProjectiles[i];
            projectile.age += dt;
            Vector3 nextPosition = projectile.position + (projectile.velocity * dt);
            bool remove = projectile.age >= projectile.lifetime;
            if (!remove)
            {
                ProjectileHitData hitData;
                if (TrySweep(projectile.position, nextPosition, projectile.radius, projectile.velocity, projectile.ownerRoot, projectile.hitMask, out hitData))
                {
                    ProcessHit(hitData, projectile.mass, projectile.damagePerImpulse, projectile.applyImpactDamage, projectile.applyImpactImpulse, ref projectile.lastImpactEvent, out projectile.lastDamageApplied, out projectile.lastImpactImpulseApplied);
                    if (visualPool != null)
                    {
                        visualPool.EmitImpact(hitData.point, hitData.normal, projectile.radius);
                    }

                    remove = true;
                }
            }

            if (remove)
            {
                if (visualPool != null)
                {
                    visualPool.ReleaseProjectile(projectile.visualObject);
                }

                RemoveActiveAt(i);
                continue;
            }

            projectile.previousPosition = projectile.position;
            projectile.position = nextPosition;
            if (visualPool != null)
            {
                visualPool.MoveProjectile(projectile.visualObject, projectile.position, Quaternion.LookRotation(projectile.direction, Vector3.up));
            }

            activeProjectiles[i] = projectile;
        }
    }

    public void ClearRuntime()
    {
        for (int i = activeProjectiles.Count - 1; i >= 0; i--)
        {
            if (visualPool != null)
            {
                visualPool.ReleaseProjectile(activeProjectiles[i].visualObject);
            }
        }

        activeProjectiles.Clear();
        if (visualPool != null)
        {
            visualPool.DeactivateAll();
        }
    }

    private void QueueSimulatedProjectile(PrototypeProjectileFireRequest request, ref PrototypeProjectileFireResult result)
    {
        if (activeProjectiles.Count >= Mathf.Max(1, maxActiveProjectiles))
        {
            if (visualPool != null)
            {
                visualPool.ReleaseProjectile(activeProjectiles[0].visualObject);
            }

            RemoveActiveAt(0);
        }

        GameObject visual = visualPool != null
            ? visualPool.ActivateProjectile(request.origin, Quaternion.LookRotation(request.direction, Vector3.up), request.projectileRadius, request.lifetime)
            : null;

        activeProjectiles.Add(new ActiveProjectile
        {
            id = nextProjectileId++,
            ownerRoot = request.ownerRoot,
            previousPosition = request.origin,
            position = request.origin,
            direction = request.direction,
            velocity = request.inheritedVelocity + (request.direction * request.projectileSpeed),
            radius = request.projectileRadius,
            mass = request.projectileMass,
            lifetime = request.lifetime,
            age = 0f,
            hitMask = request.hitMask,
            visualObject = visual,
            damagePerImpulse = Mathf.Max(0f, request.damagePerImpulse),
            applyImpactDamage = request.applyImpactDamage,
            applyImpactImpulse = request.applyImpactImpulse
        });

        if (ShouldEmitTracer(request.tracerEveryNthShot) && visualPool != null)
        {
            float tracerDistance = Mathf.Min(request.maxDistance, Mathf.Max(1f, request.projectileSpeed * 0.05f));
            visualPool.EmitTracer(request.origin, request.origin + request.direction * tracerDistance, request.projectileRadius);
            result.tracerVisualEmitted = true;
        }
    }

    private void ProcessHitscan(PrototypeProjectileFireRequest request, ref PrototypeProjectileFireResult result)
    {
        ProjectileHitData hitData;
        Vector3 tracerEnd = request.origin + (request.direction * request.maxDistance);
        if (TryCast(request.origin, request.direction, request.maxDistance, request.projectileRadius, result.projectileVelocityWorld, request.ownerRoot, request.hitMask, out hitData))
        {
            result.hasImmediateHit = true;
            result.hitData = hitData;
            tracerEnd = hitData.point;
            ProcessHit(hitData, request.projectileMass, request.damagePerImpulse, request.applyImpactDamage, request.applyImpactImpulse, ref result.impactEvent, out result.damageApplied, out result.impactImpulseApplied);
            if (visualPool != null)
            {
                visualPool.EmitImpact(hitData.point, hitData.normal, request.projectileRadius);
                result.impactVisualEmitted = true;
            }
        }

        if (ShouldEmitTracer(request.tracerEveryNthShot) && visualPool != null)
        {
            visualPool.EmitTracer(request.origin, tracerEnd, request.projectileRadius);
            result.tracerVisualEmitted = true;
        }
    }

    private bool TrySweep(Vector3 from, Vector3 to, float radius, Vector3 incomingVelocity, Transform ownerRoot, int hitMask, out ProjectileHitData hitData)
    {
        Vector3 travel = to - from;
        float distance = travel.magnitude;
        if (distance <= 0.0001f)
        {
            hitData = default;
            return false;
        }

        return TryCast(from, travel / distance, distance, radius, incomingVelocity, ownerRoot, hitMask, out hitData);
    }

    private bool TryCast(Vector3 origin, Vector3 direction, float distance, float radius, Vector3 incomingVelocity, Transform ownerRoot, int hitMask, out ProjectileHitData hitData)
    {
        hitData = default;
        int hitCount = radius > 0.001f
            ? Physics.SphereCastNonAlloc(origin, radius, direction, hitBuffer, distance, hitMask, QueryTriggerInteraction.Ignore)
            : Physics.RaycastNonAlloc(origin, direction, hitBuffer, distance, hitMask, QueryTriggerInteraction.Ignore);

        int nearestIndex = -1;
        float nearestDistance = float.PositiveInfinity;
        for (int i = 0; i < hitCount; i++)
        {
            RaycastHit hit = hitBuffer[i];
            Collider candidate = hit.collider;
            if (!IsValidHit(candidate, ownerRoot))
            {
                continue;
            }

            if (hit.distance < nearestDistance)
            {
                nearestIndex = i;
                nearestDistance = hit.distance;
            }
        }

        if (nearestIndex < 0)
        {
            return false;
        }

        RaycastHit nearest = hitBuffer[nearestIndex];
        hitData = new ProjectileHitData
        {
            hasHit = true,
            fromSweep = true,
            collider = nearest.collider,
            attachedRigidbody = nearest.collider != null ? nearest.collider.attachedRigidbody : null,
            targetDummy = nearest.collider != null ? nearest.collider.GetComponentInParent<PrototypeTargetDummy>() : null,
            point = nearest.point,
            normal = nearest.normal,
            incomingVelocity = incomingVelocity,
            time = Time.time
        };
        return true;
    }

    private void ProcessHit(
        ProjectileHitData hitData,
        float projectileMass,
        float damagePerImpulse,
        bool applyDamage,
        bool applyImpulse,
        ref PrototypeImpactEventData impactEvent,
        out float damageApplied,
        out bool impactImpulseApplied)
    {
        damageApplied = 0f;
        impactImpulseApplied = false;
        if (!hitData.hasHit)
        {
            return;
        }

        if (hitData.targetDummy != null)
        {
            hitData.targetDummy.PlayHitFeedback(hitData.point);
        }

        impactEvent = PrototypeImpactEventData.FromProjectileHit(hitData, projectileMass);
        if (!impactEvent.hasImpact)
        {
            return;
        }

        PrototypeModuleDamageState damageState = FindDamageState(hitData.collider, impactEvent.moduleHit);
        if (applyDamage && damageState != null)
        {
            damageApplied = damageState.ApplyImpactDamage(impactEvent, impactEvent.ImpactImpulseMagnitude * Mathf.Max(0f, damagePerImpulse));
        }

        if (!applyImpulse)
        {
            return;
        }

        ShipPhysicsCore core = FindPhysicsCore(hitData.collider, impactEvent.targetRigidbody);
        if (core != null)
        {
            impactImpulseApplied = core.ApplyImpactImpulse(impactEvent);
        }
    }

    private bool ShouldEmitTracer(int tracerEveryNthShot)
    {
        if (tracerEveryNthShot <= 0)
        {
            return false;
        }

        return totalShotsProcessed % tracerEveryNthShot == 0;
    }

    private void RemoveActiveAt(int index)
    {
        int last = activeProjectiles.Count - 1;
        if (index < 0 || index > last)
        {
            return;
        }

        activeProjectiles[index] = activeProjectiles[last];
        activeProjectiles.RemoveAt(last);
    }

    private static bool IsValidHit(Collider candidate, Transform ownerRoot)
    {
        if (candidate == null)
        {
            return false;
        }

        Transform candidateTransform = candidate.transform;
        if (candidateTransform == null || PrototypeProjectileRuntimeMarker.IsRuntimeProjectileTransform(candidateTransform) || candidateTransform.GetComponentInParent<Projectile>() != null)
        {
            return false;
        }

        if (ownerRoot != null)
        {
            if (candidateTransform == ownerRoot || candidateTransform.IsChildOf(ownerRoot))
            {
                return false;
            }

            Rigidbody attachedBody = candidate.attachedRigidbody;
            if (attachedBody != null && (attachedBody.transform == ownerRoot || attachedBody.transform.IsChildOf(ownerRoot)))
            {
                return false;
            }
        }

        return true;
    }

    private static PrototypeModuleDamageState FindDamageState(Collider hitCollider, ModuleMassDescriptor module)
    {
        if (module != null)
        {
            PrototypeModuleDamageState damageState = module.GetComponent<PrototypeModuleDamageState>();
            if (damageState != null)
            {
                return damageState;
            }
        }

        return hitCollider != null ? hitCollider.GetComponentInParent<PrototypeModuleDamageState>() : null;
    }

    private static ShipPhysicsCore FindPhysicsCore(Collider hitCollider, Rigidbody targetRigidbody)
    {
        if (targetRigidbody != null)
        {
            ShipPhysicsCore core = targetRigidbody.GetComponent<ShipPhysicsCore>();
            if (core != null)
            {
                return core;
            }
        }

        return hitCollider != null ? hitCollider.GetComponentInParent<ShipPhysicsCore>() : null;
    }

    private static Vector3 NormalizeOrFallback(Vector3 value, Vector3 fallback)
    {
        if (value.sqrMagnitude > 0.0001f)
        {
            return value.normalized;
        }

        return fallback.sqrMagnitude > 0.0001f ? fallback.normalized : Vector3.forward;
    }

    private struct ActiveProjectile
    {
        public int id;
        public Transform ownerRoot;
        public Vector3 previousPosition;
        public Vector3 position;
        public Vector3 direction;
        public Vector3 velocity;
        public float radius;
        public float mass;
        public float lifetime;
        public float age;
        public int hitMask;
        public GameObject visualObject;
        public float damagePerImpulse;
        public bool applyImpactDamage;
        public bool applyImpactImpulse;
        public PrototypeImpactEventData lastImpactEvent;
        public float lastDamageApplied;
        public bool lastImpactImpulseApplied;
    }
}
