using System.Collections.Generic;
using UnityEngine;

public sealed class PrototypeWeaponTarget
{
    private const float NeutralFallbackHealth = 100f;
    private static readonly List<Transform> RegisteredTargetBuffer = new List<Transform>();
    private static readonly HashSet<int> SeenTargetIds = new HashSet<int>();

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
    public static int LastRegistryCandidateCount { get; private set; }
    public static bool LastDiscoveryUsedDebugFallback { get; private set; }
    public static int DebugFallbackDiscoveryCount { get; private set; }

    public static PrototypeWeaponTarget FromTransform(Transform candidate)
    {
        if (candidate == null)
        {
            return null;
        }

        if (IsIgnoredCandidate(candidate))
        {
            return null;
        }

        Transform root = ResolveTargetRoot(candidate);
        if (root == null)
        {
            return null;
        }

        if (IsIgnoredCandidate(root))
        {
            return null;
        }

        bool isExplicitlyMarked = HasExplicitMarker(candidate, root);
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

        if (root.GetComponent<ShipStats>() != null || isExplicitlyMarked)
        {
            return new PrototypeWeaponTarget(root, BuildLabel(root), NeutralFallbackHealth, NeutralFallbackHealth, "no health source", false);
        }

        return null;
    }

    public static List<PrototypeWeaponTarget> Discover(Transform ownerRoot)
    {
        var targets = new List<PrototypeWeaponTarget>();
        DiscoverInto(ownerRoot, targets, includeDebugFallback: false);
        return targets;
    }

    public static void DiscoverInto(Transform ownerRoot, List<PrototypeWeaponTarget> targets, bool includeDebugFallback)
    {
        if (targets == null)
        {
            return;
        }

        targets.Clear();
        SeenTargetIds.Clear();
        LastDiscoveryUsedDebugFallback = includeDebugFallback;
        PrototypeWeaponTargetRegistry.CopyRegisteredTargets(RegisteredTargetBuffer);
        LastRegistryCandidateCount = RegisteredTargetBuffer.Count;
        AddTargetsFromTransforms(RegisteredTargetBuffer, ownerRoot, targets, SeenTargetIds);
        if (includeDebugFallback)
        {
            DebugFallbackDiscoveryCount++;
            AddTargetsFromComponents(Object.FindObjectsByType<PrototypeModuleDamageState>(FindObjectsInactive.Exclude), ownerRoot, targets, SeenTargetIds);
            AddTargetsFromComponents(Object.FindObjectsByType<PrototypeTargetDummy>(FindObjectsInactive.Exclude), ownerRoot, targets, SeenTargetIds);
            AddTargetsFromComponents(Object.FindObjectsByType<ShipStats>(FindObjectsInactive.Exclude), ownerRoot, targets, SeenTargetIds);
        }

        targets.Sort((left, right) => left.StableId.CompareTo(right.StableId));
        SeenTargetIds.Clear();
    }

    private static void AddTargetsFromTransforms(List<Transform> candidates, Transform ownerRoot, List<PrototypeWeaponTarget> targets, HashSet<int> seen)
    {
        if (candidates == null)
        {
            return;
        }

        for (int i = 0; i < candidates.Count; i++)
        {
            Transform candidate = candidates[i];
            if (candidate == null)
            {
                continue;
            }

            AddTargetFromTransform(candidate, ownerRoot, targets, seen);
        }
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

            AddTargetFromTransform(component.transform, ownerRoot, targets, seen);
        }
    }

    private static void AddTargetFromTransform(Transform candidate, Transform ownerRoot, List<PrototypeWeaponTarget> targets, HashSet<int> seen)
    {
        Transform root = ResolveTargetRoot(candidate);
        if (root == null || IsSameHierarchy(ownerRoot, root) || IsIgnoredCandidate(candidate) || IsIgnoredCandidate(root))
        {
            return;
        }

        PrototypeWeaponTarget target = FromTransform(candidate);
        if (target == null || !target.IsValid || !seen.Add(target.StableId))
        {
            return;
        }

        targets.Add(target);
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

    private static bool IsIgnoredCandidate(Transform candidate)
    {
        return IsProjectileCandidate(candidate) || IsWeaponVisualCandidate(candidate);
    }

    private static bool IsProjectileCandidate(Transform candidate)
    {
        return candidate != null
            && (candidate.GetComponentInParent<Projectile>() != null
                || PrototypeProjectileRuntimeMarker.IsRuntimeProjectileTransform(candidate));
    }

    private static bool IsWeaponVisualCandidate(Transform candidate)
    {
        Transform current = candidate;
        while (current != null)
        {
            string name = current.name;
            if (!string.IsNullOrEmpty(name))
            {
                string upper = name.ToUpperInvariant();
                if (upper.StartsWith("WEAPON_MUZZLE")
                    || upper.StartsWith("WEAPON_TURRET")
                    || upper.Contains("MUZZLE_FLASH"))
                {
                    return true;
                }
            }

            if (current.GetComponent<PrototypeTurretWeapon>() != null || current.GetComponent<PrototypeTurretMount>() != null)
            {
                return true;
            }

            current = current.parent;
        }

        return false;
    }

    private static bool HasExplicitMarker(Transform candidate, Transform root)
    {
        PrototypeWeaponTargetMarker marker = candidate != null ? candidate.GetComponentInParent<PrototypeWeaponTargetMarker>() : null;
        if (marker != null && marker.TargetRoot != null)
        {
            return root == marker.TargetRoot || marker.TargetRoot.IsChildOf(root) || root.IsChildOf(marker.TargetRoot);
        }

        if (root == null)
        {
            return false;
        }

        return root.GetComponent<PrototypeWeaponTargetMarker>() != null
            || root.GetComponentInChildren<PrototypeWeaponTargetMarker>(false) != null;
    }

    private static string BuildLabel(Transform target)
    {
        return target != null && !string.IsNullOrWhiteSpace(target.name) ? target.name : "Target";
    }
}
