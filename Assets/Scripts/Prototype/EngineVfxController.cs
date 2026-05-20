using UnityEngine;

[RequireComponent(typeof(Rigidbody))]
[RequireComponent(typeof(ShipStats))]
public class EngineVfxController : MonoBehaviour
{
    [SerializeField] private Transform nozzle;
    [SerializeField] private ParticleSystem thrustParticles;
    [SerializeField] private Light thrustLight;

    [SerializeField] private float maxEmissionRate = 55f;
    [SerializeField] private float minEmissionRate = 2f;
    [SerializeField] private float maxLightIntensity = 5f;
    [SerializeField] private float minLightIntensity = 0f;

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
            main.startColor = new Color(1f, 0.6f, 0.2f, 0.7f);
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
            thrustLight.color = new Color(1f, 0.55f, 0.15f);
        }
    }

    private void ApplyThrottle()
    {
        if (thrustParticles == null || thrustLight == null)
        {
            return;
        }

        var emission = thrustParticles.emission;
        emission.enabled = throttle > 0.01f;

        var rate = emission.rateOverTime;
        rate.constant = Mathf.Lerp(minEmissionRate, maxEmissionRate, throttle);
        emission.rateOverTime = rate;

        if (throttle > 0.01f && !thrustParticles.isPlaying)
        {
            thrustParticles.Play();
        }
        else if (throttle <= 0.01f && thrustParticles.isPlaying)
        {
            thrustParticles.Stop();
        }

        thrustLight.intensity = Mathf.Lerp(minLightIntensity, maxLightIntensity, throttle);
    }
}
