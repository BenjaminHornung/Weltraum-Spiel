using UnityEngine;

[RequireComponent(typeof(Collider))]
public class PrototypeTargetDummy : MonoBehaviour
{
    [SerializeField] private Color idleColor = new Color(0.25f, 0.85f, 1f, 1f);
    [SerializeField] private Color hitColor = new Color(1f, 0.85f, 0.2f, 1f);
    [SerializeField] private float feedbackDuration = 0.22f;
    [SerializeField] private float pulseScale = 1.2f;
    [SerializeField] private float feedbackLightIntensity = 4f;
    [SerializeField] private float feedbackLightRange = 4f;

    private Renderer targetRenderer;
    private Material targetMaterial;
    private Light feedbackLight;
    private Vector3 baseScale;
    private float feedbackUntil;
    private bool wasHit;

    public bool WasHit => wasHit;
    public bool IsFeedbackVisible => Time.time < feedbackUntil;

    private void Awake()
    {
        baseScale = transform.localScale;
        CacheVisuals();
        ApplyVisualState(0f);
    }

    private void OnEnable()
    {
        if (baseScale == Vector3.zero)
        {
            baseScale = transform.localScale;
        }

        PrototypeWeaponTargetRegistry.Register(transform);
    }

    private void OnDisable()
    {
        PrototypeWeaponTargetRegistry.Unregister(transform);
    }

    private void Update()
    {
        if (Time.time < feedbackUntil)
        {
            float remaining = Mathf.InverseLerp(feedbackUntil - feedbackDuration, feedbackUntil, Time.time);
            ApplyVisualState(1f - remaining);
            return;
        }

        ApplyVisualState(0f);
    }

    public void PlayHitFeedback(Vector3 worldPosition)
    {
        CacheVisuals();
        wasHit = true;
        feedbackUntil = Time.time + Mathf.Max(0.05f, feedbackDuration);

        if (feedbackLight != null)
        {
            feedbackLight.transform.position = worldPosition;
        }

        ApplyVisualState(1f);
    }

    private void CacheVisuals()
    {
        if (targetRenderer == null)
        {
            targetRenderer = GetComponentInChildren<Renderer>();
        }

        if (targetRenderer != null && targetMaterial == null)
        {
            Shader shader = Shader.Find("Universal Render Pipeline/Lit");
            targetMaterial = new Material(shader == null ? Shader.Find("Standard") : shader);
            targetRenderer.material = targetMaterial;
        }

        if (feedbackLight == null)
        {
            var lightObject = new GameObject("HitFeedbackLight");
            lightObject.transform.SetParent(transform, false);
            lightObject.transform.localPosition = Vector3.zero;
            feedbackLight = lightObject.AddComponent<Light>();
            feedbackLight.type = LightType.Point;
            feedbackLight.range = feedbackLightRange;
            feedbackLight.color = hitColor;
            feedbackLight.intensity = 0f;
        }
    }

    private void ApplyVisualState(float amount)
    {
        amount = Mathf.Clamp01(amount);

        if (targetMaterial != null)
        {
            Color color = Color.Lerp(idleColor, hitColor, amount);
            targetMaterial.color = color;
            if (targetMaterial.HasProperty("_EmissionColor"))
            {
                targetMaterial.EnableKeyword("_EMISSION");
                targetMaterial.SetColor("_EmissionColor", color * Mathf.Lerp(0.5f, 2.5f, amount));
            }
        }

        if (baseScale != Vector3.zero)
        {
            float pulse = 1f + ((pulseScale - 1f) * amount);
            transform.localScale = baseScale * pulse;
        }

        if (feedbackLight != null)
        {
            feedbackLight.intensity = feedbackLightIntensity * amount;
            feedbackLight.range = feedbackLightRange;
            feedbackLight.color = hitColor;
        }
    }
}
