using UnityEngine;

[RequireComponent(typeof(Rigidbody))]
public class Projectile : MonoBehaviour
{
    [SerializeField] private float defaultLifetime = 3f;
    [SerializeField] private Color glowColor = new Color(1f, 0.45f, 0.15f, 1f);
    [SerializeField] private float minimumSweepRadius = 0.01f;

    private float destroyAt;
    private Rigidbody rigidbodyRef;
    private Collider projectileCollider;
    private TrailRenderer trailRenderer;
    private Light glowLight;
    private Vector3 previousPositionWorld;
    private bool hasPreviousPosition;
    private bool hasReportedHit;

    public Vector3 PreviousPositionWorld => previousPositionWorld;
    public bool HasPreviousPosition => hasPreviousPosition;
    public bool HasReportedHit => hasReportedHit;

    private void Awake()
    {
        rigidbodyRef = GetComponent<Rigidbody>();
        projectileCollider = GetComponent<Collider>();
        SetupVisuals();
    }

    private void OnEnable()
    {
        destroyAt = Time.time + Mathf.Max(0.1f, defaultLifetime);
        hasReportedHit = false;
        RecordCurrentPosition();
    }

    public void Initialize(Vector3 initialVelocity, float lifetime)
    {
        if (rigidbodyRef == null)
        {
            rigidbodyRef = GetComponent<Rigidbody>();
        }

        rigidbodyRef.useGravity = false;
        rigidbodyRef.linearVelocity = initialVelocity;
        destroyAt = Time.time + Mathf.Max(0.1f, lifetime);
        hasReportedHit = false;
        RecordCurrentPosition();
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
            Destroy(gameObject);
        }
    }

    private void SetupVisuals()
    {
        Renderer meshRenderer = GetComponent<Renderer>();
        if (meshRenderer != null)
        {
            Shader shader = Shader.Find("Universal Render Pipeline/Lit");
            Material material = new Material(shader == null ? Shader.Find("Standard") : shader);
            material.color = glowColor;
            if (material.HasProperty("_EmissionColor"))
            {
                material.EnableKeyword("_EMISSION");
                material.SetColor("_EmissionColor", glowColor * 2f);
            }

            meshRenderer.material = material;
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

        Shader trailShader = Shader.Find("Sprites/Default");
        trailRenderer.material = new Material(trailShader == null ? Shader.Find("Unlit/Color") : trailShader);
        trailRenderer.material.color = glowColor;
        trailRenderer.startWidth = 0.08f;
        trailRenderer.endWidth = 0f;
        trailRenderer.alignment = LineAlignment.View;
        trailRenderer.time = 0.35f;
        trailRenderer.minVertexDistance = 0.03f;
        trailRenderer.startColor = glowColor;
        trailRenderer.endColor = new Color(glowColor.r, glowColor.g, glowColor.b, 0f);

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
        RaycastHit[] hits = Physics.SphereCastAll(
            from,
            GetSweepRadius(),
            direction,
            distance,
            Physics.DefaultRaycastLayers,
            QueryTriggerInteraction.Ignore);

        if (TryReportNearestHit(hits))
        {
            return;
        }

        hits = Physics.RaycastAll(
            from,
            direction,
            distance,
            Physics.DefaultRaycastLayers,
            QueryTriggerInteraction.Ignore);
        TryReportNearestHit(hits);
    }

    private float GetSweepRadius()
    {
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

    private bool TryReportNearestHit(RaycastHit[] hits)
    {
        if (hits == null || hits.Length == 0)
        {
            return false;
        }

        int nearestIndex = -1;
        float nearestDistance = float.PositiveInfinity;
        for (int i = 0; i < hits.Length; i++)
        {
            Collider candidate = hits[i].collider;
            if (candidate == null || IsProjectileCollider(candidate))
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
        return TryReportHit(nearest.collider, nearest.point);
    }

    private bool IsProjectileCollider(Collider candidate)
    {
        return candidate == projectileCollider || candidate.transform == transform || candidate.transform.IsChildOf(transform);
    }

    private bool TryReportHit(Collider hitCollider, Vector3 hitPoint)
    {
        if (hasReportedHit || hitCollider == null)
        {
            return false;
        }

        var targetDummy = hitCollider.GetComponentInParent<PrototypeTargetDummy>();
        if (targetDummy == null)
        {
            return false;
        }

        hasReportedHit = true;
        targetDummy.PlayHitFeedback(hitPoint);
        Destroy(gameObject);
        return true;
    }


    private void OnCollisionEnter(Collision collision)
    {
        if (collision.collider == null)
        {
            return;
        }

        Vector3 hitPoint = collision.contactCount > 0 ? collision.GetContact(0).point : transform.position;
        TryReportHit(collision.collider, hitPoint);
    }
}
