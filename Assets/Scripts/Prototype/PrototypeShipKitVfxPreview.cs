using UnityEngine;

public sealed class PrototypeShipKitVfxPreview : MonoBehaviour
{
    [SerializeField] private bool mainEnginePreview = true;
    [SerializeField] private bool rcsPreview = true;
    [SerializeField] private bool allRcsPulseMode = true;
    [SerializeField] private float rcsPulseSpeed = 1.6f;
    [SerializeField] private float rcsPulseDuty = 0.35f;

    private ParticleSystem[] cachedMainParticles;
    private ParticleSystem[] cachedRcsParticles;

    private void OnEnable()
    {
        Refresh();
        ApplyState(true);
    }

    private void Update()
    {
        ApplyState(false);
    }

    public void Refresh()
    {
        ParticleSystem[] allParticles = GetComponentsInChildren<ParticleSystem>(true);
        cachedMainParticles = FilterParticles(allParticles, PrototypeShipKitVfxBinder.MainThrusterVfxChildName);
        cachedRcsParticles = FilterParticles(allParticles, PrototypeShipKitVfxBinder.RcsThrusterVfxChildName);
    }

    public void SetMainEnginePreview(bool active)
    {
        mainEnginePreview = active;
        ApplyState(true);
    }

    public void SetRcsPreview(bool active)
    {
        rcsPreview = active;
        ApplyState(true);
    }

    public void SetAllRcsPulseMode(bool active)
    {
        allRcsPulseMode = active;
        ApplyState(true);
    }

    private void ApplyState(bool forceRefresh)
    {
        if (forceRefresh || cachedMainParticles == null || cachedRcsParticles == null)
        {
            Refresh();
        }

        ApplyParticles(cachedMainParticles, mainEnginePreview);

        bool showRcs = rcsPreview;
        if (showRcs && allRcsPulseMode && Application.isPlaying)
        {
            float phase = Mathf.Repeat(Time.time * Mathf.Max(0.05f, rcsPulseSpeed), 1f);
            showRcs = phase <= Mathf.Clamp01(rcsPulseDuty);
        }

        ApplyParticles(cachedRcsParticles, showRcs);
    }

    private static ParticleSystem[] FilterParticles(ParticleSystem[] allParticles, string parentName)
    {
        if (allParticles == null || allParticles.Length == 0)
        {
            return new ParticleSystem[0];
        }

        System.Collections.Generic.List<ParticleSystem> result = new System.Collections.Generic.List<ParticleSystem>();
        for (int i = 0; i < allParticles.Length; i++)
        {
            ParticleSystem particleSystem = allParticles[i];
            if (particleSystem == null)
            {
                continue;
            }

            Transform current = particleSystem.transform;
            while (current != null)
            {
                if (current.name == parentName)
                {
                    result.Add(particleSystem);
                    break;
                }

                current = current.parent;
            }
        }

        return result.ToArray();
    }

    private static void ApplyParticles(ParticleSystem[] particleSystems, bool active)
    {
        if (particleSystems == null)
        {
            return;
        }

        for (int i = 0; i < particleSystems.Length; i++)
        {
            ParticleSystem particleSystem = particleSystems[i];
            if (particleSystem == null)
            {
                continue;
            }

            ParticleSystem.EmissionModule emission = particleSystem.emission;
            emission.enabled = active;

            if (active && !particleSystem.isPlaying)
            {
                particleSystem.Play();
            }
            else if (!active && particleSystem.isPlaying)
            {
                particleSystem.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            }
        }
    }
}
