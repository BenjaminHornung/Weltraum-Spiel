using UnityEngine;

[RequireComponent(typeof(Rigidbody))]
public class Projectile : MonoBehaviour
{
    [SerializeField] private float defaultLifetime = 3f;
    [SerializeField] private Color glowColor = new Color(1f, 0.45f, 0.15f, 1f);

    private float destroyAt;
    private Rigidbody rigidbodyRef;
    private TrailRenderer trailRenderer;
    private Light glowLight;

    private void Awake()
    {
        rigidbodyRef = GetComponent<Rigidbody>();
        SetupVisuals();
    }

    private void OnEnable()
    {
        destroyAt = Time.time + Mathf.Max(0.1f, defaultLifetime);
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
}

