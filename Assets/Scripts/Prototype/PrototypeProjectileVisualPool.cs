using System.Collections.Generic;
using UnityEngine;

public enum PrototypeProjectileVisualKind
{
    Muzzle,
    Tracer,
    Projectile,
    Impact
}

public class PrototypeProjectileVisualPool : MonoBehaviour
{
    private const float DefaultMuzzleLifetime = 0.05f;
    private const float DefaultTracerLifetime = 0.08f;
    private const float DefaultImpactLifetime = 0.12f;

    [SerializeField] private int prewarmMuzzleCount = 4;
    [SerializeField] private int prewarmTracerCount = 16;
    [SerializeField] private int prewarmProjectileCount = 32;
    [SerializeField] private int prewarmImpactCount = 16;
    [SerializeField] private bool debugLightsEnabled;

    private readonly List<PooledVisual> muzzlePool = new List<PooledVisual>();
    private readonly List<PooledVisual> tracerPool = new List<PooledVisual>();
    private readonly List<PooledVisual> projectilePool = new List<PooledVisual>();
    private readonly List<PooledVisual> impactPool = new List<PooledVisual>();
    private readonly List<PooledVisual> activeVisuals = new List<PooledVisual>();

    private Material muzzleMaterial;
    private Material tracerMaterial;
    private Material projectileMaterial;
    private Material impactMaterial;
    private bool prewarmed;

    public int TotalCreatedCount { get; private set; }
    public int MuzzleCreatedCount { get; private set; }
    public int TracerCreatedCount { get; private set; }
    public int ProjectileCreatedCount { get; private set; }
    public int ImpactCreatedCount { get; private set; }
    public int ActiveVisualCount => activeVisuals.Count;
    public bool DebugLightsEnabled => debugLightsEnabled;

    public Material SharedTracerMaterial
    {
        get
        {
            EnsureMaterials();
            return tracerMaterial;
        }
    }

    private void Awake()
    {
        EnsurePrewarmed();
    }

    private void Update()
    {
        Tick(Time.time);
    }

    public void EnsurePrewarmed()
    {
        if (prewarmed)
        {
            return;
        }

        EnsureMaterials();
        Prewarm(muzzlePool, PrototypeProjectileVisualKind.Muzzle, Mathf.Max(0, prewarmMuzzleCount));
        Prewarm(tracerPool, PrototypeProjectileVisualKind.Tracer, Mathf.Max(0, prewarmTracerCount));
        Prewarm(projectilePool, PrototypeProjectileVisualKind.Projectile, Mathf.Max(0, prewarmProjectileCount));
        Prewarm(impactPool, PrototypeProjectileVisualKind.Impact, Mathf.Max(0, prewarmImpactCount));
        prewarmed = true;
    }

    public void Tick(float now)
    {
        for (int i = activeVisuals.Count - 1; i >= 0; i--)
        {
            PooledVisual visual = activeVisuals[i];
            if (visual == null || visual.GameObject == null)
            {
                activeVisuals.RemoveAt(i);
                continue;
            }

            if (now >= visual.DeactivateAt)
            {
                Deactivate(visual, i);
            }
        }
    }

    public void DeactivateAll()
    {
        for (int i = activeVisuals.Count - 1; i >= 0; i--)
        {
            Deactivate(activeVisuals[i], i);
        }
    }

    public void EmitMuzzle(Vector3 position, Quaternion rotation, float radius)
    {
        PooledVisual visual = Activate(PrototypeProjectileVisualKind.Muzzle, DefaultMuzzleLifetime);
        visual.Transform.position = position;
        visual.Transform.rotation = rotation;
        visual.Transform.localScale = Vector3.one * Mathf.Max(0.05f, radius * 2f);
    }

    public void EmitTracer(Vector3 start, Vector3 end, float radius)
    {
        PooledVisual visual = Activate(PrototypeProjectileVisualKind.Tracer, DefaultTracerLifetime);
        visual.Transform.position = Vector3.zero;
        LineRenderer line = visual.LineRenderer;
        if (line != null)
        {
            float width = Mathf.Max(0.01f, radius * 0.45f);
            line.positionCount = 2;
            line.useWorldSpace = true;
            line.SetPosition(0, start);
            line.SetPosition(1, end);
            line.startWidth = width;
            line.endWidth = Mathf.Max(0.003f, width * 0.25f);
        }
    }

    public void EmitImpact(Vector3 position, Vector3 normal, float radius)
    {
        PooledVisual visual = Activate(PrototypeProjectileVisualKind.Impact, DefaultImpactLifetime);
        visual.Transform.position = position;
        visual.Transform.rotation = normal.sqrMagnitude > 0.0001f
            ? Quaternion.LookRotation(normal.normalized, Vector3.up)
            : Quaternion.identity;
        visual.Transform.localScale = Vector3.one * Mathf.Max(0.06f, radius * 1.5f);
    }

    public GameObject ActivateProjectile(Vector3 position, Quaternion rotation, float radius, float lifetime)
    {
        PooledVisual visual = Activate(PrototypeProjectileVisualKind.Projectile, Mathf.Max(0.01f, lifetime));
        visual.Transform.position = position;
        visual.Transform.rotation = rotation;
        visual.Transform.localScale = Vector3.one * Mathf.Max(0.03f, radius * 2f);
        return visual.GameObject;
    }

    public void MoveProjectile(GameObject projectileVisual, Vector3 position, Quaternion rotation)
    {
        if (projectileVisual == null)
        {
            return;
        }

        projectileVisual.transform.position = position;
        projectileVisual.transform.rotation = rotation;
    }

    public void ReleaseProjectile(GameObject projectileVisual)
    {
        if (projectileVisual == null)
        {
            return;
        }

        for (int i = activeVisuals.Count - 1; i >= 0; i--)
        {
            PooledVisual visual = activeVisuals[i];
            if (visual != null && visual.GameObject == projectileVisual)
            {
                Deactivate(visual, i);
                return;
            }
        }

        projectileVisual.SetActive(false);
    }

    public int GetCreatedCount(PrototypeProjectileVisualKind kind)
    {
        switch (kind)
        {
            case PrototypeProjectileVisualKind.Muzzle:
                return MuzzleCreatedCount;
            case PrototypeProjectileVisualKind.Tracer:
                return TracerCreatedCount;
            case PrototypeProjectileVisualKind.Projectile:
                return ProjectileCreatedCount;
            case PrototypeProjectileVisualKind.Impact:
                return ImpactCreatedCount;
            default:
                return TotalCreatedCount;
        }
    }

    public int GetActiveCount(PrototypeProjectileVisualKind kind)
    {
        int count = 0;
        for (int i = 0; i < activeVisuals.Count; i++)
        {
            PooledVisual visual = activeVisuals[i];
            if (visual != null && visual.Kind == kind)
            {
                count++;
            }
        }

        return count;
    }

    private void Prewarm(List<PooledVisual> pool, PrototypeProjectileVisualKind kind, int count)
    {
        while (pool.Count < count)
        {
            pool.Add(CreateVisual(kind));
        }
    }

    private PooledVisual Activate(PrototypeProjectileVisualKind kind, float lifetime)
    {
        EnsurePrewarmed();
        List<PooledVisual> pool = GetPool(kind);
        PooledVisual visual = null;
        for (int i = 0; i < pool.Count; i++)
        {
            if (pool[i] != null && !pool[i].IsActive)
            {
                visual = pool[i];
                break;
            }
        }

        if (visual == null)
        {
            visual = CreateVisual(kind);
            pool.Add(visual);
        }

        visual.IsActive = true;
        visual.DeactivateAt = Time.time + Mathf.Max(0.01f, lifetime);
        visual.GameObject.SetActive(true);
        if (!activeVisuals.Contains(visual))
        {
            activeVisuals.Add(visual);
        }

        return visual;
    }

    private void Deactivate(PooledVisual visual, int activeIndex)
    {
        if (visual == null)
        {
            activeVisuals.RemoveAt(activeIndex);
            return;
        }

        visual.IsActive = false;
        if (visual.LineRenderer != null)
        {
            visual.LineRenderer.positionCount = 0;
        }

        if (visual.GameObject != null)
        {
            visual.GameObject.SetActive(false);
        }

        activeVisuals.RemoveAt(activeIndex);
    }

    private List<PooledVisual> GetPool(PrototypeProjectileVisualKind kind)
    {
        switch (kind)
        {
            case PrototypeProjectileVisualKind.Muzzle:
                return muzzlePool;
            case PrototypeProjectileVisualKind.Tracer:
                return tracerPool;
            case PrototypeProjectileVisualKind.Projectile:
                return projectilePool;
            case PrototypeProjectileVisualKind.Impact:
                return impactPool;
            default:
                return tracerPool;
        }
    }

    private PooledVisual CreateVisual(PrototypeProjectileVisualKind kind)
    {
        EnsureMaterials();
        GameObject go;
        LineRenderer line = null;
        Renderer renderer = null;
        if (kind == PrototypeProjectileVisualKind.Tracer)
        {
            go = new GameObject("ProjectileTracerVisual");
            line = go.AddComponent<LineRenderer>();
            line.sharedMaterial = tracerMaterial;
            line.positionCount = 0;
            line.alignment = LineAlignment.View;
            line.textureMode = LineTextureMode.Stretch;
            line.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            line.receiveShadows = false;
        }
        else
        {
            go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            go.name = kind == PrototypeProjectileVisualKind.Muzzle
                ? "ProjectileMuzzleVisual"
                : kind == PrototypeProjectileVisualKind.Impact
                    ? "ProjectileImpactVisual"
                    : "ProjectileSimulatedVisual";
            Collider collider = go.GetComponent<Collider>();
            if (collider != null)
            {
                collider.enabled = false;
                if (Application.isPlaying)
                {
                    Destroy(collider);
                }
                else
                {
                    DestroyImmediate(collider);
                }
            }

            renderer = go.GetComponent<Renderer>();
            if (renderer != null)
            {
                renderer.sharedMaterial = GetMaterial(kind);
            }
        }

        go.transform.SetParent(transform, false);
        PrototypeProjectileRuntimeMarker.Mark(go);
        if (!debugLightsEnabled)
        {
            Light light = go.GetComponent<Light>();
            if (light != null)
            {
                light.enabled = false;
            }
        }

        go.SetActive(false);
        TotalCreatedCount++;
        switch (kind)
        {
            case PrototypeProjectileVisualKind.Muzzle:
                MuzzleCreatedCount++;
                break;
            case PrototypeProjectileVisualKind.Tracer:
                TracerCreatedCount++;
                break;
            case PrototypeProjectileVisualKind.Projectile:
                ProjectileCreatedCount++;
                break;
            case PrototypeProjectileVisualKind.Impact:
                ImpactCreatedCount++;
                break;
        }

        return new PooledVisual(go, go.transform, renderer, line, kind);
    }

    private Material GetMaterial(PrototypeProjectileVisualKind kind)
    {
        switch (kind)
        {
            case PrototypeProjectileVisualKind.Muzzle:
                return muzzleMaterial;
            case PrototypeProjectileVisualKind.Impact:
                return impactMaterial;
            case PrototypeProjectileVisualKind.Projectile:
                return projectileMaterial;
            default:
                return tracerMaterial;
        }
    }

    private void EnsureMaterials()
    {
        if (tracerMaterial != null)
        {
            return;
        }

        Shader shader = Shader.Find("Universal Render Pipeline/Unlit");
        if (shader == null)
        {
            shader = Shader.Find("Sprites/Default");
        }

        if (shader == null)
        {
            shader = Shader.Find("Standard");
        }

        muzzleMaterial = CreateSharedMaterial(shader, new Color(1f, 0.75f, 0.25f, 1f));
        tracerMaterial = CreateSharedMaterial(shader, new Color(1f, 0.46f, 0.12f, 1f));
        projectileMaterial = CreateSharedMaterial(shader, new Color(1f, 0.38f, 0.1f, 1f));
        impactMaterial = CreateSharedMaterial(shader, new Color(1f, 0.9f, 0.35f, 1f));
    }

    private static Material CreateSharedMaterial(Shader shader, Color color)
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
            material.SetColor("_EmissionColor", color * 1.5f);
        }

        return material;
    }

    private sealed class PooledVisual
    {
        public PooledVisual(GameObject gameObject, Transform transform, Renderer renderer, LineRenderer lineRenderer, PrototypeProjectileVisualKind kind)
        {
            GameObject = gameObject;
            Transform = transform;
            Renderer = renderer;
            LineRenderer = lineRenderer;
            Kind = kind;
        }

        public GameObject GameObject { get; }
        public Transform Transform { get; }
        public Renderer Renderer { get; }
        public LineRenderer LineRenderer { get; }
        public PrototypeProjectileVisualKind Kind { get; }
        public float DeactivateAt { get; set; }
        public bool IsActive { get; set; }
    }
}
