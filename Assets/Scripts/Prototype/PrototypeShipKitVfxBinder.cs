using UnityEngine;

public sealed class PrototypeShipKitVfxBinder : MonoBehaviour
{
    public const string MainThrusterNozzleToken = "THRUST_NOZZLE_MAIN";
    public const string RcsNozzleToken = "RCS_NOZZLE_";
    public const string MainThrusterVfxChildName = "PreviewMainThrusterVfx";
    public const string RcsThrusterVfxChildName = "PreviewRcsThrusterVfx";

    [SerializeField] private GameObject mainThrusterVfxPrefab;
    [SerializeField] private GameObject rcsThrusterVfxPrefab;
    [SerializeField] private bool bindOnAwake = true;
    [SerializeField] private bool previewEffectsActive = true;

    public int LastNozzleTransformCount { get; private set; }
    public int LastMainThrusterBindings { get; private set; }
    public int LastRcsThrusterBindings { get; private set; }
    public int LastCreatedInstances { get; private set; }

    public GameObject MainThrusterVfxPrefab
    {
        get => mainThrusterVfxPrefab;
        set => mainThrusterVfxPrefab = value;
    }

    public GameObject RcsThrusterVfxPrefab
    {
        get => rcsThrusterVfxPrefab;
        set => rcsThrusterVfxPrefab = value;
    }

    public bool PreviewEffectsActive
    {
        get => previewEffectsActive;
        set => previewEffectsActive = value;
    }

    private void Awake()
    {
        if (bindOnAwake)
        {
            BindNow();
        }
    }

    public BindStats BindNow()
    {
        BindStats stats = BindHierarchy(transform, mainThrusterVfxPrefab, rcsThrusterVfxPrefab, previewEffectsActive);
        LastNozzleTransformCount = stats.NozzleTransformCount;
        LastMainThrusterBindings = stats.MainThrusterBindings;
        LastRcsThrusterBindings = stats.RcsThrusterBindings;
        LastCreatedInstances = stats.CreatedInstances;
        return stats;
    }

    public static BindStats BindHierarchy(Transform root, GameObject mainPrefab, GameObject rcsPrefab, bool previewActive)
    {
        BindStats stats = new BindStats();
        if (root == null)
        {
            return stats;
        }

        Transform[] transforms = root.GetComponentsInChildren<Transform>(true);
        for (int i = 0; i < transforms.Length; i++)
        {
            Transform nozzle = transforms[i];
            if (!IsBindableNozzleTransform(nozzle.name))
            {
                continue;
            }

            stats.NozzleTransformCount++;

            if (PrototypeShipSocketUtility.IsMainThrusterNozzleName(nozzle.name))
            {
                if (BindSingleNozzle(nozzle, mainPrefab, MainThrusterVfxChildName, previewActive))
                {
                    stats.CreatedInstances++;
                }
                stats.MainThrusterBindings++;
            }
            else if (PrototypeShipSocketUtility.IsRcsNozzleName(nozzle.name))
            {
                if (BindSingleNozzle(nozzle, rcsPrefab, RcsThrusterVfxChildName, previewActive))
                {
                    stats.CreatedInstances++;
                }
                stats.RcsThrusterBindings++;
            }
        }

        return stats;
    }

    public static bool IsBindableNozzleTransform(string transformName)
    {
        if (string.IsNullOrEmpty(transformName))
        {
            return false;
        }

        if (!PrototypeShipSocketUtility.IsMainThrusterNozzleName(transformName) && !PrototypeShipSocketUtility.IsRcsNozzleName(transformName))
        {
            return false;
        }

        return !transformName.Contains("VIS_PART_")
            && !transformName.Contains("_Mesh")
            && !transformName.Contains("GEO_");
    }

    private static bool BindSingleNozzle(Transform nozzle, GameObject prefab, string childName, bool previewActive)
    {
        if (nozzle == null || prefab == null)
        {
            return false;
        }

        Transform existing = nozzle.Find(childName);
        if (existing != null)
        {
            ApplyPreviewState(existing.gameObject, previewActive);
            return false;
        }

        GameObject instance = Instantiate(prefab, nozzle, false);
        instance.name = childName;
        instance.transform.localPosition = childName == RcsThrusterVfxChildName ? Vector3.back * 0.18f : Vector3.zero;
        instance.transform.localRotation = Quaternion.Euler(0f, 180f, 0f);
        instance.transform.localScale = Vector3.one;
        ApplyPreviewState(instance, previewActive);
        return true;
    }

    private static void ApplyPreviewState(GameObject target, bool previewActive)
    {
        if (target == null)
        {
            return;
        }

        target.SetActive(previewActive);
        ParticleSystem[] particleSystems = target.GetComponentsInChildren<ParticleSystem>(true);
        for (int i = 0; i < particleSystems.Length; i++)
        {
            ParticleSystem particleSystem = particleSystems[i];
            ParticleSystem.EmissionModule emission = particleSystem.emission;
            emission.enabled = previewActive;

            if (previewActive && !particleSystem.isPlaying)
            {
                particleSystem.Play();
            }
            else if (!previewActive && particleSystem.isPlaying)
            {
                particleSystem.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            }
        }
    }

    [System.Serializable]
    public struct BindStats
    {
        public int NozzleTransformCount;
        public int MainThrusterBindings;
        public int RcsThrusterBindings;
        public int CreatedInstances;
    }
}

