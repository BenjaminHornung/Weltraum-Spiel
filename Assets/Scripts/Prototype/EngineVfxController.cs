using UnityEngine;

[RequireComponent(typeof(Rigidbody))]
[RequireComponent(typeof(ShipStats))]
public class EngineVfxController : MonoBehaviour
{
    [SerializeField] private Transform nozzle;
    [SerializeField] private ParticleSystem thrustParticles;
    [SerializeField] private Light thrustLight;
    [SerializeField] private GameObject thrustNozzleRing;

    [SerializeField] private float maxEmissionRate = 72f;
    [SerializeField] private float minEmissionRate = 1f;
    [SerializeField] private float maxLightIntensity = 6f;
    [SerializeField] private float minLightIntensity = 0f;
    [SerializeField] private float activeThrottleForVfx = 0.01f;
    [SerializeField] private Color plumeColdColor = new Color(0.2f, 0.6f, 1f, 0.85f);
    [SerializeField] private Color plumeHotColor = new Color(1f, 0.46f, 0.12f, 0.95f);

    private float throttle;

    private void Awake()
    {
        ResolveNozzle();
        EnsureParticles();
    }

    public void SetThrottle(float normalizedThrottle)
    {
        throttle = Mathf.Clamp01(normalizedThrottle);
        ApplyThrottle();
    }

    public void ConfigureNozzle(Transform nozzleTransform)
    {
        if (nozzleTransform == null)
        {
            return;
        }

        if (nozzle != nozzleTransform)
        {
            nozzle = nozzleTransform;
            thrustParticles = null;
            thrustLight = null;
            thrustNozzleRing = null;
        }

        EnsureParticles();
        ApplyThrottle();
    }

    private void Update()
    {
        ApplyThrottle();
    }

    private void ResolveNozzle()
    {
        if (nozzle != null)
        {
            return;
        }

        var mainNozzle = transform.Find("MainThrusterGimbal/MainThrusterNozzle");
        if (mainNozzle != null)
        {
            nozzle = mainNozzle;
            return;
        }

        foreach (Transform child in transform.GetComponentsInChildren<Transform>())
        {
            if (child != transform && (child.name == "Engine" || child.name == "MainThrusterGimbal"))
            {
                nozzle = child;
                return;
            }
        }

        var fallback = new GameObject("EngineNozzle");
        fallback.transform.SetParent(transform, false);
        fallback.transform.localPosition = Vector3.zero;
        fallback.transform.localRotation = Quaternion.identity;
        nozzle = fallback.transform;
    }

    private void EnsureParticles()
    {
        if (thrustParticles == null)
        {
            var host = new GameObject("EngineParticleSystem");
            host.transform.SetParent(nozzle, false);
            host.transform.localPosition = Vector3.zero;
            host.transform.localRotation = Quaternion.Euler(0f, 180f, 0f);
            thrustParticles = host.AddComponent<ParticleSystem>();

            var main = thrustParticles.main;
            main.startSpeed = 6f;
            main.startSize = 0.25f;
            main.startLifetime = 0.7f;
            main.startColor = Color.Lerp(plumeColdColor, plumeHotColor, 0.35f);
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.maxParticles = 300;

            var emission = thrustParticles.emission;
            emission.enabled = false;

            var shape = thrustParticles.shape;
            shape.shapeType = ParticleSystemShapeType.Cone;
            shape.angle = 12f;
            shape.radius = 0.18f;
            shape.rotation = Vector3.zero;
            shape.position = Vector3.zero;
            main.playOnAwake = false;
        }

        if (thrustLight == null)
        {
            var lightHost = new GameObject("EngineLight");
            lightHost.transform.SetParent(nozzle, false);
            lightHost.transform.localPosition = Vector3.zero;
            thrustLight = lightHost.AddComponent<Light>();
            thrustLight.type = LightType.Point;
            thrustLight.range = 4f;
            thrustLight.intensity = 0f;
            thrustLight.color = plumeColdColor;
        }

        if (thrustNozzleRing == null)
        {
            var ringPrimitive = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            ringPrimitive.name = "EngineNozzleRing";
            thrustNozzleRing = ringPrimitive;
            thrustNozzleRing.transform.SetParent(nozzle, false);
            thrustNozzleRing.transform.localPosition = Vector3.zero;
            thrustNozzleRing.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            thrustNozzleRing.transform.localScale = new Vector3(0.18f, 0.018f, 0.18f);
            var ringRenderer = thrustNozzleRing.GetComponent<Renderer>();
            if (ringRenderer != null)
            {
                var sourceMaterial = ringRenderer.sharedMaterial;
                var shader = Shader.Find("Universal Render Pipeline/Lit");
                if (sourceMaterial == null)
                {
                    sourceMaterial = new Material(shader == null ? Shader.Find("Standard") : shader);
                }
                else
                {
                    sourceMaterial = new Material(sourceMaterial);
                }

                if (Application.isPlaying)
                {
                    ringRenderer.material = sourceMaterial;
                }
                else
                {
                    ringRenderer.sharedMaterial = sourceMaterial;
                }

                var ringMaterial = Application.isPlaying ? ringRenderer.material : ringRenderer.sharedMaterial;
                if (ringMaterial != null)
                {
                    Color ringColor = Color.Lerp(plumeColdColor, plumeHotColor, 0.4f);
                    ringMaterial.color = ringColor;
                    if (ringMaterial.HasProperty("_EmissionColor"))
                    {
                        ringMaterial.EnableKeyword("_EMISSION");
                        ringMaterial.SetColor("_EmissionColor", ringColor * 2.5f);
                    }
                }
            }

            var ringCollider = thrustNozzleRing.GetComponent<Collider>();
            if (ringCollider != null)
            {
                if (Application.isPlaying)
                {
                    ringCollider.enabled = false;
                    Destroy(ringCollider);
                }
                else
                {
                    DestroyImmediate(ringCollider);
                }
            }
            thrustNozzleRing.SetActive(false);
        }
    }

    private void ApplyThrottle()
    {
        if (thrustParticles == null || thrustLight == null)
        {
            return;
        }

        var emission = thrustParticles.emission;
        bool showThrottleVisuals = throttle > activeThrottleForVfx;
        emission.enabled = showThrottleVisuals;

        var rate = emission.rateOverTime;
        float normalizedThrottle = showThrottleVisuals ? Mathf.InverseLerp(activeThrottleForVfx, 1f, throttle) : 0f;
        rate.constant = Mathf.Lerp(minEmissionRate, maxEmissionRate, normalizedThrottle);
        emission.rateOverTime = rate;

        if (showThrottleVisuals)
        {
            var main = thrustParticles.main;
            Color plumeColor = Color.Lerp(plumeColdColor, plumeHotColor, normalizedThrottle);
            main.startColor = new Color(plumeColor.r, plumeColor.g, plumeColor.b, Mathf.Lerp(0.65f, 0.98f, normalizedThrottle));

            if (thrustNozzleRing != null)
            {
                float ringScale = Mathf.Lerp(0.14f, 0.22f, normalizedThrottle);
                thrustNozzleRing.transform.localScale = new Vector3(ringScale, 0.018f, ringScale);
                var ringRenderer = thrustNozzleRing.GetComponent<MeshRenderer>();
                var ringMaterial = ringRenderer != null
                    ? (Application.isPlaying ? ringRenderer.material : ringRenderer.sharedMaterial)
                    : null;
                if (ringMaterial != null)
                {
                    Color ringColor = Color.Lerp(plumeColdColor, plumeHotColor, normalizedThrottle);
                    ringMaterial.color = new Color(ringColor.r, ringColor.g, ringColor.b, 1f);
                    if (ringMaterial.HasProperty("_EmissionColor"))
                    {
                        ringMaterial.SetColor("_EmissionColor", ringColor * Mathf.Lerp(1.2f, 2.8f, normalizedThrottle));
                    }
                }
                thrustNozzleRing.SetActive(true);
            }

            if (!thrustParticles.isPlaying)
            {
                thrustParticles.Play();
            }
        }
        else if (thrustParticles.isPlaying)
        {
            thrustParticles.Stop();
            if (thrustNozzleRing != null)
            {
                thrustNozzleRing.SetActive(false);
            }
        }

        Color lightColor = Color.Lerp(plumeColdColor, plumeHotColor, normalizedThrottle);
        thrustLight.color = lightColor;
        thrustLight.intensity = Mathf.Lerp(minLightIntensity, maxLightIntensity, normalizedThrottle);
    }
}
