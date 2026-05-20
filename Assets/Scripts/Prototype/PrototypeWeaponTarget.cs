using System.Collections.Generic;
using UnityEngine;

public sealed class PrototypeWeaponTarget
{
    private const float NeutralFallbackHealth = 100f;

    private PrototypeWeaponTarget(
        Transform targetTransform,
        string label,
        float currentHealth,
        float maxHealth,
        string healthLabel,
        bool hasHealthSource)
    {
        TargetTransform = targetTransform;
        Label = label;
        CurrentHealth = Mathf.Max(0f, currentHealth);
        MaxHealth = Mathf.Max(1f, maxHealth);
        HealthLabel = healthLabel;
        HasHealthSource = hasHealthSource;
        StableId = targetTransform != null ? targetTransform.GetHashCode() : 0;
    }

    public Transform TargetTransform { get; }
    public string Label { get; }
    public float CurrentHealth { get; }
    public float MaxHealth { get; }
    public string HealthLabel { get; }
    public bool HasHealthSource { get; }
    public int StableId { get; }
    public Vector3 Position => TargetTransform != null ? TargetTransform.position : Vector3.zero;
    public bool IsValid => TargetTransform != null;

    public static PrototypeWeaponTarget FromTransform(Transform candidate)
    {
        if (candidate == null)
        {
            return null;
        }

        if (IsProjectileCandidate(candidate))
        {
            return null;
        }

        Transform root = ResolveTargetRoot(candidate);
        if (root == null)
        {
            return null;
        }

        if (IsProjectileCandidate(root))
        {
            return null;
        }

        PrototypeModuleDamageState[] damageStates = root.GetComponentsInChildren<PrototypeModuleDamageState>(false);
        if (damageStates != null && damageStates.Length > 0)
        {
            float current = 0f;
            float max = 0f;
            for (int i = 0; i < damageStates.Length; i++)
            {
                PrototypeModuleDamageState state = damageStates[i];
                if (state == null)
                {
                    continue;
                }

                current += state.CurrentIntegrity;
                max += state.MaxIntegrity;
            }

            if (max > 0f)
            {
                return new PrototypeWeaponTarget(root, BuildLabel(root), current, max, "damage-state source", true);
            }
        }

        PrototypeTargetDummy dummy = root.GetComponentInChildren<PrototypeTargetDummy>(false);
        if (dummy != null)
        {
            return new PrototypeWeaponTarget(root, BuildLabel(root), NeutralFallbackHealth, NeutralFallbackHealth, "no health source", false);
        }

        if (root.GetComponent<ShipStats>() != null || root.GetComponent<Rigidbody>() != null)
        {
            return new PrototypeWeaponTarget(root, BuildLabel(root), NeutralFallbackHealth, NeutralFallbackHealth, "no health source", false);
        }

        return null;
    }

    public static List<PrototypeWeaponTarget> Discover(Transform ownerRoot)
    {
        var targets = new List<PrototypeWeaponTarget>();
        var seen = new HashSet<int>();
        AddTargetsFromComponents(Object.FindObjectsByType<PrototypeModuleDamageState>(FindObjectsInactive.Exclude), ownerRoot, targets, seen);
        AddTargetsFromComponents(Object.FindObjectsByType<PrototypeTargetDummy>(FindObjectsInactive.Exclude), ownerRoot, targets, seen);
        AddTargetsFromComponents(Object.FindObjectsByType<ShipStats>(FindObjectsInactive.Exclude), ownerRoot, targets, seen);
        AddTargetsFromComponents(Object.FindObjectsByType<Rigidbody>(FindObjectsInactive.Exclude), ownerRoot, targets, seen);
        targets.Sort((left, right) => left.StableId.CompareTo(right.StableId));
        return targets;
    }

    private static void AddTargetsFromComponents<T>(T[] components, Transform ownerRoot, List<PrototypeWeaponTarget> targets, HashSet<int> seen)
        where T : Component
    {
        if (components == null)
        {
            return;
        }

        for (int i = 0; i < components.Length; i++)
        {
            T component = components[i];
            if (component == null || component.transform == null)
            {
                continue;
            }

            Transform root = ResolveTargetRoot(component.transform);
            if (root == null || IsSameHierarchy(ownerRoot, root) || IsProjectileCandidate(root))
            {
                continue;
            }

            PrototypeWeaponTarget target = FromTransform(root);
            if (target == null || !target.IsValid || !seen.Add(target.StableId))
            {
                continue;
            }

            targets.Add(target);
        }
    }

    private static Transform ResolveTargetRoot(Transform candidate)
    {
        if (candidate == null)
        {
            return null;
        }

        Rigidbody body = candidate.GetComponentInParent<Rigidbody>();
        if (body != null)
        {
            return body.transform;
        }

        ShipStats stats = candidate.GetComponentInParent<ShipStats>();
        if (stats != null)
        {
            return stats.transform;
        }

        PrototypeTargetDummy dummy = candidate.GetComponentInParent<PrototypeTargetDummy>();
        if (dummy != null)
        {
            return dummy.transform;
        }

        PrototypeModuleDamageState damageState = candidate.GetComponentInParent<PrototypeModuleDamageState>();
        return damageState != null ? damageState.transform : candidate;
    }

    private static bool IsSameHierarchy(Transform ownerRoot, Transform candidate)
    {
        if (ownerRoot == null || candidate == null)
        {
            return false;
        }

        return candidate == ownerRoot || candidate.IsChildOf(ownerRoot) || ownerRoot.IsChildOf(candidate);
    }

    private static bool IsProjectileCandidate(Transform candidate)
    {
        return candidate != null && candidate.GetComponentInParent<Projectile>() != null;
    }

    private static string BuildLabel(Transform target)
    {
        return target != null && !string.IsNullOrWhiteSpace(target.name) ? target.name : "Target";
    }
}
