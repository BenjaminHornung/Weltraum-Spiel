using System.Collections.Generic;
using UnityEngine;

public readonly struct PrototypePveArenaSnapshot
{
    public PrototypePveArenaSnapshot(
        string objectiveName,
        bool active,
        bool completed,
        int totalTargets,
        int destroyedTargets,
        string rewardStubLabel)
    {
        ObjectiveName = string.IsNullOrWhiteSpace(objectiveName) ? "Arena objective" : objectiveName;
        Active = active;
        Completed = completed;
        TotalTargets = Mathf.Max(0, totalTargets);
        DestroyedTargets = Mathf.Clamp(destroyedTargets, 0, TotalTargets);
        RemainingTargets = Mathf.Max(0, TotalTargets - DestroyedTargets);
        RewardStubLabel = string.IsNullOrWhiteSpace(rewardStubLabel) ? "Reward pending" : rewardStubLabel;
    }

    public string ObjectiveName { get; }
    public bool Active { get; }
    public bool Completed { get; }
    public int TotalTargets { get; }
    public int DestroyedTargets { get; }
    public int RemainingTargets { get; }
    public string RewardStubLabel { get; }
    public float ProgressFraction => TotalTargets > 0 ? Mathf.Clamp01((float)DestroyedTargets / TotalTargets) : 0f;
    public string ProgressLabel => DestroyedTargets.ToString() + "/" + TotalTargets.ToString();
    public string StatusLabel => Completed ? "Complete" : Active ? "Active" : "Inactive";
    public bool IsVisible => Active || Completed || TotalTargets > 0;
}

[DisallowMultipleComponent]
public sealed class PrototypePveArenaLoop : MonoBehaviour
{
    private const int MinimumTargetCount = 3;

    [SerializeField] private string objectiveName = "Clear the Arena";
    [SerializeField] private string rewardStubLabel = "Reward queued: salvage voucher";
    [SerializeField] private int targetCount = MinimumTargetCount;
    [SerializeField] private float targetIntegrity = 80f;
    [SerializeField] private Vector3 arenaCenter = new Vector3(0f, 0.5f, 78f);
    [SerializeField] private float targetSpacing = 14f;
    [SerializeField] private Vector3 targetScale = new Vector3(3f, 3f, 0.8f);
    [SerializeField] private bool autoStartOnEnable = true;

    private readonly List<PrototypePveArenaTarget> targets = new List<PrototypePveArenaTarget>();
    private Transform arenaRoot;
    private bool active;
    private bool completed;

    public PrototypePveArenaSnapshot Snapshot
    {
        get
        {
            RefreshProgress();
            return new PrototypePveArenaSnapshot(
                objectiveName,
                active,
                completed,
                targets.Count,
                CountDestroyedTargets(),
                completed ? rewardStubLabel : string.Empty);
        }
    }

    public IReadOnlyList<PrototypePveArenaTarget> Targets => targets;
    public bool Active => active;
    public bool Completed => completed;

    private void OnEnable()
    {
        if (autoStartOnEnable)
        {
            StartOrResetArena();
        }
    }

    private void Update()
    {
        RefreshProgress();
    }

    public void Configure(
        string configuredObjectiveName,
        string configuredRewardStubLabel,
        int configuredTargetCount,
        float configuredTargetIntegrity,
        Vector3 configuredArenaCenter,
        float configuredTargetSpacing)
    {
        objectiveName = string.IsNullOrWhiteSpace(configuredObjectiveName) ? objectiveName : configuredObjectiveName;
        rewardStubLabel = string.IsNullOrWhiteSpace(configuredRewardStubLabel) ? rewardStubLabel : configuredRewardStubLabel;
        targetCount = Mathf.Max(MinimumTargetCount, configuredTargetCount);
        targetIntegrity = Mathf.Max(1f, configuredTargetIntegrity);
        arenaCenter = configuredArenaCenter;
        targetSpacing = Mathf.Max(2f, configuredTargetSpacing);
    }

    public void StartOrResetArena()
    {
        EnsureTargets();
        for (int i = 0; i < targets.Count; i++)
        {
            targets[i].Restore();
        }

        active = targets.Count > 0;
        completed = false;
        RefreshProgress();
    }

    public void ResetArena()
    {
        StartOrResetArena();
    }

    public void RefreshProgress()
    {
        if (!active || completed)
        {
            return;
        }

        if (targets.Count > 0 && CountDestroyedTargets() >= targets.Count)
        {
            active = false;
            completed = true;
        }
    }

    private void EnsureTargets()
    {
        targetCount = Mathf.Max(MinimumTargetCount, targetCount);
        EnsureArenaRoot();
        for (int i = 0; i < targetCount; i++)
        {
            PrototypePveArenaTarget target = i < targets.Count ? targets[i] : null;
            if (target == null || target.Transform == null)
            {
                target = CreateTarget(i);
                if (i < targets.Count)
                {
                    targets[i] = target;
                }
                else
                {
                    targets.Add(target);
                }
            }

            target.Place(TargetPosition(i));
        }

        for (int i = targets.Count - 1; i >= targetCount; i--)
        {
            PrototypePveArenaTarget target = targets[i];
            if (target != null && target.Transform != null)
            {
                DestroyGameObject(target.Transform.gameObject);
            }

            targets.RemoveAt(i);
        }
    }

    private void EnsureArenaRoot()
    {
        if (arenaRoot != null)
        {
            return;
        }

        Transform existing = transform.Find("PrototypePveArena");
        if (existing != null)
        {
            arenaRoot = existing;
            return;
        }

        arenaRoot = new GameObject("PrototypePveArena").transform;
        arenaRoot.SetParent(transform, false);
    }

    private PrototypePveArenaTarget CreateTarget(int index)
    {
        GameObject targetObject = GameObject.CreatePrimitive(PrimitiveType.Cube);
        targetObject.name = "PrototypeArenaTarget_" + (index + 1).ToString("00");
        targetObject.transform.SetParent(arenaRoot, false);
        targetObject.transform.localScale = targetScale;

        Rigidbody body = targetObject.GetComponent<Rigidbody>();
        if (body == null)
        {
            body = targetObject.AddComponent<Rigidbody>();
        }

        body.useGravity = false;
        body.isKinematic = true;

        PrototypeModuleDamageState damageState = targetObject.GetComponent<PrototypeModuleDamageState>();
        if (damageState == null)
        {
            damageState = targetObject.AddComponent<PrototypeModuleDamageState>();
        }

        damageState.Configure(targetObject.name, targetIntegrity, 0f);
        damageState.RepairFull();

        PrototypeWeaponTargetMarker marker = targetObject.GetComponent<PrototypeWeaponTargetMarker>();
        if (marker == null)
        {
            marker = targetObject.AddComponent<PrototypeWeaponTargetMarker>();
        }

        marker.Configure(targetObject.transform);

        if (targetObject.GetComponent<PrototypeTargetDummy>() == null)
        {
            targetObject.AddComponent<PrototypeTargetDummy>();
        }

        ApplyTargetMaterial(targetObject);
        return new PrototypePveArenaTarget(targetObject.transform, damageState, TargetPosition(index));
    }

    private Vector3 TargetPosition(int index)
    {
        int row = index / MinimumTargetCount;
        int column = index % MinimumTargetCount;
        float x = (column - 1) * targetSpacing;
        float z = row * targetSpacing * 0.6f;
        return arenaCenter + new Vector3(x, 0f, z);
    }

    private int CountDestroyedTargets()
    {
        int destroyed = 0;
        for (int i = 0; i < targets.Count; i++)
        {
            PrototypePveArenaTarget target = targets[i];
            if (target != null && IsValidObjectiveTarget(target))
            {
                destroyed++;
            }
        }

        return destroyed;
    }

    private static bool IsValidObjectiveTarget(PrototypePveArenaTarget target)
    {
        return target != null
            && target.Transform != null
            && target.Transform.gameObject != null
            && target.Transform.gameObject.activeInHierarchy
            && target.DamageState != null
            && target.DamageState.IsDestroyed;
    }

    private static void ApplyTargetMaterial(GameObject targetObject)
    {
        Renderer renderer = targetObject != null ? targetObject.GetComponent<Renderer>() : null;
        if (renderer == null)
        {
            return;
        }

        Shader shader = Shader.Find("Universal Render Pipeline/Lit");
        Material material = new Material(shader == null ? Shader.Find("Standard") : shader);
        material.color = PrototypeModuleColorPalette.Target;
        if (material.HasProperty("_EmissionColor"))
        {
            material.EnableKeyword("_EMISSION");
            material.SetColor("_EmissionColor", PrototypeModuleColorPalette.Target * 1.2f);
        }

        if (Application.isPlaying)
        {
            renderer.material = material;
        }
        else
        {
            renderer.sharedMaterial = material;
        }
    }

    private static void DestroyGameObject(GameObject target)
    {
        if (target == null)
        {
            return;
        }

        if (Application.isPlaying)
        {
            Destroy(target);
        }
        else
        {
            DestroyImmediate(target);
        }
    }
}

public sealed class PrototypePveArenaTarget
{
    private Vector3 startPosition;

    public PrototypePveArenaTarget(Transform targetTransform, PrototypeModuleDamageState damageState, Vector3 configuredStartPosition)
    {
        Transform = targetTransform;
        DamageState = damageState;
        startPosition = configuredStartPosition;
    }

    public Transform Transform { get; }
    public PrototypeModuleDamageState DamageState { get; }
    public bool IsDestroyed => IsValidObjectiveTargetWithDamageState() && DamageState.IsDestroyed;

    public void Place(Vector3 worldPosition)
    {
        if (Transform == null)
        {
            return;
        }

        startPosition = worldPosition;
        Transform.position = worldPosition;
        Transform.rotation = Quaternion.identity;
    }

    public void Restore()
    {
        if (Transform == null)
        {
            return;
        }

        Transform.gameObject.SetActive(true);
        Transform.position = startPosition;
        Transform.rotation = Quaternion.identity;
        if (DamageState != null)
        {
            DamageState.RepairFull();
        }
    }

    private bool IsValidObjectiveTargetWithDamageState()
    {
        return Transform != null
            && Transform.gameObject != null
            && Transform.gameObject.activeInHierarchy
            && DamageState != null;
    }
}
