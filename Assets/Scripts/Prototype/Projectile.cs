using UnityEngine;

public struct ProjectileHitData
{
    public bool hasHit;
    public bool fromSweep;
    public Collider collider;
    public Rigidbody attachedRigidbody;
    public PrototypeTargetDummy targetDummy;
    public Vector3 point;
    public Vector3 normal;
    public Vector3 incomingVelocity;
    public float time;
}

[RequireComponent(typeof(Rigidbody))]
public class Projectile : MonoBehaviour
{
    private const float MinimumProjectileDiameterMeters = 0.01f;
    private const float MinimumTrailStartWidth = 0.01f;
    private const int SweepHitBufferSize = 32;

    private static readonly RaycastHit[] SweepHits = new RaycastHit[SweepHitBufferSize];
    private static readonly RaycastHit[] RayHits = new RaycastHit[SweepHitBufferSize];
    private static Material sharedProjectileMaterial;
    private static Material sharedTrailMaterial;

    [SerializeField] private float defaultLifetime = 3f;
    [SerializeField] private Color glowColor = new Color(1f, 0.45f, 0.15f, 1f);
    [SerializeField] private float minimumSweepRadius = 0.01f;
    [SerializeField] private float projectileMassKg = 1f;
    [SerializeField] private float damagePerImpulse = 0.02f;
    [SerializeField] private bool applyImpactImpulse = true;
    [SerializeField] private bool applyImpactDamage = true;
    [SerializeField] private bool debugLightEnabled;

    private float destroyAt;
    private Rigidbody rigidbodyRef;
    private Collider projectileCollider;
    private TrailRenderer trailRenderer;
    private Light glowLight;
    private Vector3 previousPositionWorld;
    private bool hasPreviousPosition;
    private bool hasReportedHit;
    private bool destroyQueued;
    private Collider[] ignoredColliders;
    private ProjectileHitData lastHitData;
    private PrototypeImpactEventData lastImpactEvent;
    private PrototypeModuleDamageState lastDamagedModule;
    private float lastDamageApplied;
    private bool lastImpactImpulseApplied;
    private float configuredProjectileDiameterMeters;
    private float configuredSweepRadius;

    public Vector3 PreviousPositionWorld => previousPositionWorld;
    public bool HasPreviousPosition => hasPreviousPosition;
    public bool HasReportedHit => hasReportedHit;
    public int IgnoredColliderCount => ignoredColliders != null ? ignoredColliders.Length : 0;
    public bool HasHitData => lastHitData.hasHit;
    public ProjectileHitData LastHitData => lastHitData;
    public bool HasImpactEvent => lastImpactEvent.hasImpact;
    public PrototypeImpactEventData LastImpactEvent => lastImpactEvent;
    public float ProjectileMassKg => Mathf.Max(0.001f, projectileMassKg);
    public float ProjectileDiameterMeters
    {
        get
        {
            if (configuredProjectileDiameterMeters > 0f)
            {
                return configuredProjectileDiameterMeters;
            }

            if (projectileCollider == null)
            {
                projectileCollider = GetComponent<Collider>();
            }

            if (projectileCollider != null)
            {
                Vector3 extents = projectileCollider.bounds.extents;
                return Mathf.Max(MinimumProjectileDiameterMeters, Mathf.Min(extents.x, Mathf.Min(extents.y, extents.z)) * 2f);
            }

            return Mathf.Max(MinimumProjectileDiameterMeters, Mathf.Max(transform.lossyScale.x, Mathf.Max(transform.lossyScale.y, transform.lossyScale.z)));
        }
    }
    public float ProjectileRadiusMeters => ProjectileDiameterMeters * 0.5f;
    public float SweepRadiusMeters
    {
        get
        {
            if (configuredSweepRadius > 0f)
            {
                return Mathf.Max(minimumSweepRadius, configuredSweepRadius);
            }

            if (projectileCollider == null)
            {
                projectileCollider = GetComponent<Collider>();
            }

            if (projectileCollider != null)
            {
                Vector3 extents = projectileCollider.bounds.extents;
                return Mathf.Max(minimumSweepRadius, Mathf.Min(extents.x, Mathf.Min(extents.y, extents.z)));
            }

            return Mathf.Max(0.001f, minimumSweepRadius);
        }
    }
    public PrototypeModuleDamageState LastDamagedModule => lastDamagedModule;
    public float LastDamageApplied => lastDamageApplied;
    public bool LastImpactImpulseApplied => lastImpactImpulseApplied;

    private void Awake()
    {
        rigidbodyRef = GetComponent<Rigidbody>();
        projectileCollider = GetComponent<Collider>();
        PrototypeProjectileRuntimeMarker.Mark(gameObject);
        SetupVisuals();
    }

    private void OnEnable()
    {
        destroyAt = Time.time + Mathf.Max(0.1f, defaultLifetime);
        hasReportedHit = false;
        destroyQueued = false;
        lastHitData = default;
        ResetImpactDiagnostics();
        RecordCurrentPosition();
    }

    public void Initialize(Vector3 initialVelocity, float lifetime)
    {
        Initialize(initialVelocity, lifetime, null);
    }

    public void Initialize(Vector3 initialVelocity, float lifetime, Collider[] collidersToIgnore)
    {
        Initialize(initialVelocity, lifetime, projectileMassKg, collidersToIgnore);
    }

    public void Initialize(Vector3 initialVelocity, float lifetime, float configuredProjectileMassKg, Collider[] collidersToIgnore)
    {
        InitializeInternal(initialVelocity, lifetime, configuredProjectileMassKg, 0f, false, collidersToIgnore);
    }

    public void Initialize(Vector3 initialVelocity, float lifetime, float configuredProjectileMassKg, float configuredProjectileDiameterMeters, Collider[] collidersToIgnore)
    {
        InitializeInternal(initialVelocity, lifetime, configuredProjectileMassKg, configuredProjectileDiameterMeters, true, collidersToIgnore);
    }

    private void InitializeInternal(
        Vector3 initialVelocity,
        float lifetime,
        float configuredProjectileMassKg,
        float configuredProjectileDiameterMeters,
        bool applyConfiguredDiameter,
        Collider[] collidersToIgnore)
    {
        if (rigidbodyRef == null)
        {
            rigidbodyRef = GetComponent<Rigidbody>();
        }

        if (applyConfiguredDiameter)
        {
            ApplyProjectileDiameter(configuredProjectileDiameterMeters);
        }

        projectileMassKg = Mathf.Max(0.001f, configuredProjectileMassKg);
        rigidbodyRef.useGravity = false;
        rigidbodyRef.mass = ProjectileMassKg;
        rigidbodyRef.linearVelocity = initialVelocity;
        destroyAt = Time.time + Mathf.Max(0.1f, lifetime);
        hasReportedHit = false;
        destroyQueued = false;
        lastHitData = default;
        ResetImpactDiagnostics();
        ConfigureIgnoredColliders(collidersToIgnore);
        RecordCurrentPosition();
    }

    private void ApplyProjectileDiameter(float diameterMeters)
    {
        configuredProjectileDiameterMeters = Mathf.Max(MinimumProjectileDiameterMeters, diameterMeters);
        configuredSweepRadius = Mathf.Max(minimumSweepRadius, configuredProjectileDiameterMeters * 0.5f);
        transform.localScale = Vector3.one * configuredProjectileDiameterMeters;

        SphereCollider sphereCollider = GetComponent<SphereCollider>();
        if (sphereCollider != null)
        {
            sphereCollider.radius = 0.5f;
            sphereCollider.center = Vector3.zero;
            projectileCollider = sphereCollider;
        }
        else if (projectileCollider == null)
        {
            projectileCollider = GetComponent<Collider>();
        }

        if (trailRenderer == null)
        {
            trailRenderer = GetComponent<TrailRenderer>();
        }

        if (trailRenderer != null)
        {
            trailRenderer.startWidth = Mathf.Max(MinimumTrailStartWidth, configuredProjectileDiameterMeters * 0.35f);
        }
    }

    private void FixedUpdate()
    {
        Vector3 currentPosition = GetCurrentPosition();
        if (!hasReportedHit && hasPreviousPosition)
        {
            SweepTravel(previousPositionWorld, currentPosition);
        }

        if (!hasReportedHit)
        {
            RecordPosition(currentPosition);
        }
    }

    private void Update()
    {
        if (Time.time >= destroyAt)
        {
            DestroySelf();
        }
    }

    private void DestroySelf()
    {
        if (destroyQueued)
        {
            return;
        }

        destroyQueued = true;
        if (Application.isPlaying)
        {
            Destroy(gameObject);
            return;
        }

#if UNITY_EDITOR
        GameObject target = gameObject;
        UnityEditor.EditorApplication.delayCall += () =>
        {
            if (target != null)
            {
                DestroyImmediate(target);
            }
        };
#else
        Destroy(gameObject);
#endif
    }

    private void SetupVisuals()
    {
        Renderer meshRenderer = GetComponent<Renderer>();
        if (meshRenderer != null)
        {
            meshRenderer.sharedMaterial = GetSharedProjectileMaterial(glowColor);
        }

        SphereCollider collider = GetComponent<SphereCollider>();
        if (collider != null)
        {
            collider.radius = 0.5f;
        }

        if (trailRenderer == null)
        {
            trailRenderer = GetComponent<TrailRenderer>();
            if (trailRenderer == null)
            {
                trailRenderer = gameObject.AddComponent<TrailRenderer>();
            }
        }

        trailRenderer.sharedMaterial = GetSharedTrailMaterial(glowColor);
        trailRenderer.startWidth = 0.08f;
        trailRenderer.endWidth = 0f;
        trailRenderer.alignment = LineAlignment.View;
        trailRenderer.time = 0.35f;
        trailRenderer.minVertexDistance = 0.03f;
        trailRenderer.startColor = glowColor;
        trailRenderer.endColor = new Color(glowColor.r, glowColor.g, glowColor.b, 0f);

        if (!debugLightEnabled)
        {
            if (glowLight == null)
            {
                glowLight = GetComponent<Light>();
            }

            if (glowLight != null)
            {
                glowLight.enabled = false;
            }

            return;
        }

        if (glowLight == null)
        {
            glowLight = GetComponent<Light>();
            if (glowLight == null)
            {
                glowLight = gameObject.AddComponent<Light>();
            }
        }

        glowLight.type = LightType.Point;
        glowLight.color = glowColor;
        glowLight.range = 3f;
        glowLight.intensity = 1.8f;
    }

    private void RecordCurrentPosition()
    {
        RecordPosition(GetCurrentPosition());
    }

    private void RecordPosition(Vector3 position)
    {
        previousPositionWorld = position;
        hasPreviousPosition = true;
    }

    private Vector3 GetCurrentPosition()
    {
        return rigidbodyRef != null ? rigidbodyRef.position : transform.position;
    }

    private void SweepTravel(Vector3 from, Vector3 to)
    {
        Vector3 travel = to - from;
        float distance = travel.magnitude;
        if (distance <= 0.0001f)
        {
            return;
        }

        Vector3 direction = travel / distance;
        int hitCount = Physics.SphereCastNonAlloc(
            from,
            GetSweepRadius(),
            direction,
            SweepHits,
            distance,
            Physics.DefaultRaycastLayers,
            QueryTriggerInteraction.Ignore);

        if (TryReportNearestHit(SweepHits, hitCount))
        {
            return;
        }

        hitCount = Physics.RaycastNonAlloc(
            from,
            direction,
            RayHits,
            distance,
            Physics.DefaultRaycastLayers,
            QueryTriggerInteraction.Ignore);
        TryReportNearestHit(RayHits, hitCount);
    }

    private float GetSweepRadius()
    {
        return SweepRadiusMeters;
    }

    private bool TryReportNearestHit(RaycastHit[] hits, int hitCount)
    {
        if (hits == null || hitCount <= 0)
        {
            return false;
        }

        int nearestIndex = -1;
        float nearestDistance = float.PositiveInfinity;
        for (int i = 0; i < hitCount; i++)
        {
            Collider candidate = hits[i].collider;
            if (candidate == null || IsProjectileCollider(candidate) || IsIgnoredCollider(candidate))
            {
                continue;
            }

            if (hits[i].distance < nearestDistance)
            {
                nearestIndex = i;
                nearestDistance = hits[i].distance;
            }
        }

        if (nearestIndex < 0)
        {
            return false;
        }

        RaycastHit nearest = hits[nearestIndex];
        return TryReportHit(nearest.collider, nearest.point, nearest.normal, true);
    }

    private bool IsProjectileCollider(Collider candidate)
    {
        return candidate == projectileCollider || candidate.transform == transform || candidate.transform.IsChildOf(transform);
    }

    private bool IsIgnoredCollider(Collider candidate)
    {
        if (ignoredColliders == null)
        {
            return false;
        }

        for (int i = 0; i < ignoredColliders.Length; i++)
        {
            if (candidate == ignoredColliders[i])
            {
                return true;
            }
        }

        return false;
    }

    private void ConfigureIgnoredColliders(Collider[] collidersToIgnore)
    {
        ignoredColliders = collidersToIgnore;
        if (ignoredColliders == null || ignoredColliders.Length == 0)
        {
            return;
        }

        if (projectileCollider == null)
        {
            projectileCollider = GetComponent<Collider>();
        }

        if (projectileCollider == null)
        {
            return;
        }

        for (int i = 0; i < ignoredColliders.Length; i++)
        {
            Collider ignored = ignoredColliders[i];
            if (ignored != null && ignored != projectileCollider)
            {
                Physics.IgnoreCollision(projectileCollider, ignored, true);
            }
        }
    }

    private bool TryReportHit(Collider hitCollider, Vector3 hitPoint, Vector3 hitNormal, bool fromSweep)
    {
        if (hasReportedHit || hitCollider == null || IsIgnoredCollider(hitCollider))
        {
            return false;
        }

        var targetDummy = hitCollider.GetComponentInParent<PrototypeTargetDummy>();
        lastHitData = new ProjectileHitData
        {
            hasHit = true,
            fromSweep = fromSweep,
            collider = hitCollider,
            attachedRigidbody = hitCollider.attachedRigidbody,
            targetDummy = targetDummy,
            point = hitPoint,
            normal = hitNormal,
            incomingVelocity = rigidbodyRef != null ? rigidbodyRef.linearVelocity : Vector3.zero,
            time = Time.time
        };
        ProcessImpactEvent();

        hasReportedHit = true;
        if (targetDummy != null)
        {
            targetDummy.PlayHitFeedback(hitPoint);
        }

        DestroySelf();
        return true;
    }


    private void OnCollisionEnter(Collision collision)
    {
        if (collision.collider == null)
        {
            return;
        }

        ContactPoint contact = collision.contactCount > 0 ? collision.GetContact(0) : default;
        Vector3 hitPoint = collision.contactCount > 0 ? contact.point : transform.position;
        Vector3 hitNormal = collision.contactCount > 0 ? contact.normal : -GetCurrentVelocity().normalized;
        TryReportHit(collision.collider, hitPoint, hitNormal, false);
    }

    private Vector3 GetCurrentVelocity()
    {
        return rigidbodyRef != null ? rigidbodyRef.linearVelocity : Vector3.zero;
    }

    private void ProcessImpactEvent()
    {
        ResetImpactDiagnostics();
        lastImpactEvent = PrototypeImpactEventData.FromProjectileHit(lastHitData, projectileMassKg);
        if (!lastImpactEvent.hasImpact)
        {
            return;
        }

        PrototypeModuleDamageState damageState = FindDamageState(lastHitData.collider, lastImpactEvent.moduleHit);
        if (applyImpactDamage && damageState != null)
        {
            float damage = lastImpactEvent.ImpactImpulseMagnitude * Mathf.Max(0f, damagePerImpulse);
            lastDamageApplied = damageState.ApplyImpactDamage(lastImpactEvent, damage);
            lastDamagedModule = damageState;
        }

        if (!applyImpactImpulse)
        {
            return;
        }

        ShipPhysicsCore core = FindPhysicsCore(lastHitData.collider, lastImpactEvent.targetRigidbody);
        if (core != null)
        {
            lastImpactImpulseApplied = core.ApplyImpactImpulse(lastImpactEvent);
        }
    }

    private static PrototypeModuleDamageState FindDamageState(Collider hitCollider, ModuleMassDescriptor module)
    {
        if (module != null)
        {
            var damageState = module.GetComponent<PrototypeModuleDamageState>();
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
            var core = targetRigidbody.GetComponent<ShipPhysicsCore>();
            if (core != null)
            {
                return core;
            }
        }

        return hitCollider != null ? hitCollider.GetComponentInParent<ShipPhysicsCore>() : null;
    }

    private void ResetImpactDiagnostics()
    {
        lastImpactEvent = default;
        lastDamagedModule = null;
        lastDamageApplied = 0f;
        lastImpactImpulseApplied = false;
    }

    private static Material GetSharedProjectileMaterial(Color color)
    {
        if (sharedProjectileMaterial != null)
        {
            return sharedProjectileMaterial;
        }

        Shader shader = Shader.Find("Universal Render Pipeline/Lit");
        if (shader == null)
        {
            shader = Shader.Find("Standard");
        }

        sharedProjectileMaterial = CreateSharedMaterial(shader, color, 2f);
        return sharedProjectileMaterial;
    }

    private static Material GetSharedTrailMaterial(Color color)
    {
        if (sharedTrailMaterial != null)
        {
            return sharedTrailMaterial;
        }

        Shader shader = Shader.Find("Sprites/Default");
        if (shader == null)
        {
            shader = Shader.Find("Unlit/Color");
        }

        if (shader == null)
        {
            shader = Shader.Find("Standard");
        }

        sharedTrailMaterial = CreateSharedMaterial(shader, color, 1.5f);
        return sharedTrailMaterial;
    }

    private static Material CreateSharedMaterial(Shader shader, Color color, float emission)
    {
        Material material = new Material(shader);
        material.color = color;
        if (material.HasProperty("_BaseColor"))
        {
            material.SetColor("_BaseColor", color);
        }

        if (material.HasProperty("_EmissionColor"))
        {
            material.EnableKeyword("_EMISSION");
            material.SetColor("_EmissionColor", color * emission);
        }

        return material;
    }
}
