using System.Collections.Generic;
using UnityEngine;

public enum PrototypeWeaponTargetPriorityMode
{
    ManualOrder,
    Nearest,
    HighestHealth,
    LowestHealth
}

public class PrototypeWeaponComputer : MonoBehaviour
{
    [SerializeField] private Transform shipRoot;
    [SerializeField] private ShipStats shipStats;
    [SerializeField] private PrototypeTurretWeapon turretWeapon;
    [SerializeField] private PrototypeWeaponTargetPriorityMode priorityMode;
    [SerializeField] private bool autoFireEnabled;
    [SerializeField] private float refreshIntervalSeconds = 0.5f;
    [SerializeField] private bool enableDebugFallbackDiscovery;

    private readonly List<PrototypeWeaponTarget> availableTargets = new List<PrototypeWeaponTarget>();
    private readonly List<int> selectedTargetIds = new List<int>();
    private float nextDebugFallbackRefreshTime;
    private int observedTargetRegistryVersion = int.MinValue;
    private bool hasLoadedDefaultAutoFire;
    private bool hasAttemptedReferenceResolve;

    public IReadOnlyList<PrototypeWeaponTarget> AvailableTargets => availableTargets;
    public PrototypeWeaponTarget ActiveTarget { get; private set; }
    public Transform ActiveTargetTransform => ActiveTarget != null ? ActiveTarget.TargetTransform : null;
    public PrototypeTurretFireStatus LastTurretStatus { get; private set; }
    public string TurretStatusLabel { get; private set; } = "no selected target";
    public PrototypeWeaponTargetPriorityMode PriorityMode => priorityMode;
    public bool AutoFireEnabled => autoFireEnabled;
    public PrototypeTurretWeapon TurretWeapon => turretWeapon;

    private void Awake()
    {
        ResolveReferences(force: true);
        RefreshTargets();
    }

    private void Update()
    {
        ResolveReferences(force: false);
        if (PrototypeWeaponTargetRegistry.Version != observedTargetRegistryVersion)
        {
            RefreshTargets();
        }
        else if (enableDebugFallbackDiscovery && Time.time >= nextDebugFallbackRefreshTime)
        {
            RefreshTargets(includeDebugFallback: true);
        }

        UpdateActiveTargetAndStatus();
        if (autoFireEnabled && turretWeapon != null && ActiveTargetTransform != null)
        {
            turretWeapon.TryFireAt(ActiveTargetTransform);
            LastTurretStatus = turretWeapon.LastFireStatus;
            TurretStatusLabel = NormalizeStatusLabel(LastTurretStatus);
        }
    }

    public void Bind(Transform root, ShipStats stats, PrototypeTurretWeapon weapon)
    {
        shipRoot = root != null ? root : shipRoot;
        shipStats = stats != null ? stats : shipStats;
        turretWeapon = weapon != null ? weapon : turretWeapon;
        ResolveReferences(force: true);
        RefreshTargets();
    }

    public void SetAutoFireEnabled(bool enabled)
    {
        autoFireEnabled = enabled;
    }

    public void SetPriorityMode(PrototypeWeaponTargetPriorityMode mode)
    {
        priorityMode = mode;
        UpdateActiveTargetAndStatus();
    }

    public bool IsSelected(PrototypeWeaponTarget target)
    {
        return target != null && selectedTargetIds.Contains(target.StableId);
    }

    public void ToggleTarget(PrototypeWeaponTarget target)
    {
        if (target == null || !target.IsValid)
        {
            return;
        }

        int index = selectedTargetIds.IndexOf(target.StableId);
        if (index >= 0)
        {
            selectedTargetIds.RemoveAt(index);
        }
        else
        {
            selectedTargetIds.Add(target.StableId);
        }

        UpdateActiveTargetAndStatus();
    }

    public void ClearSelection()
    {
        selectedTargetIds.Clear();
        UpdateActiveTargetAndStatus();
    }

    public void RefreshTargets()
    {
        RefreshTargets(includeDebugFallback: false);
    }

    private void RefreshTargets(bool includeDebugFallback)
    {
        nextDebugFallbackRefreshTime = Time.time + Mathf.Max(0.5f, refreshIntervalSeconds);
        ResolveReferences(force: false);
        PrototypeWeaponTarget.DiscoverInto(shipRoot, availableTargets, includeDebugFallback);
        observedTargetRegistryVersion = PrototypeWeaponTargetRegistry.Version;
        PruneSelection();
        UpdateActiveTargetAndStatus();
    }

    public void UpdateActiveTargetAndStatus()
    {
        PruneSelection();
        ActiveTarget = SelectActiveTarget();
        if (ActiveTarget == null || ActiveTargetTransform == null)
        {
            LastTurretStatus = PrototypeTurretFireStatus.Blocked(
                PrototypeTurretFireBlockReason.NoAuthority,
                "no target",
                hasSelectedTarget: false);
            TurretStatusLabel = "no target";
            return;
        }

        if (turretWeapon == null)
        {
            LastTurretStatus = PrototypeTurretFireStatus.Blocked(
                PrototypeTurretFireBlockReason.NoAuthority,
                "no authority",
                hasSelectedTarget: true);
            TurretStatusLabel = "no authority";
            return;
        }

        LastTurretStatus = turretWeapon.EvaluateFireStatus(ActiveTarget.Position);
        TurretStatusLabel = NormalizeStatusLabel(LastTurretStatus);
    }

    private void ResolveReferences(bool force)
    {
        if (!force && hasAttemptedReferenceResolve && shipRoot != null && (shipStats != null || hasLoadedDefaultAutoFire))
        {
            return;
        }

        if (shipRoot == null)
        {
            shipRoot = transform;
        }

        if (shipStats == null)
        {
            shipStats = shipRoot != null ? shipRoot.GetComponent<ShipStats>() : GetComponentInParent<ShipStats>();
        }

        if (turretWeapon == null)
        {
            turretWeapon = shipRoot != null ? shipRoot.GetComponentInChildren<PrototypeTurretWeapon>() : GetComponentInChildren<PrototypeTurretWeapon>();
        }

        if (shipStats != null && !hasLoadedDefaultAutoFire)
        {
            autoFireEnabled = shipStats.AutoFireEnabled;
            hasLoadedDefaultAutoFire = true;
        }

        hasAttemptedReferenceResolve = true;
    }

    private void PruneSelection()
    {
        for (int i = selectedTargetIds.Count - 1; i >= 0; i--)
        {
            if (FindAvailableById(selectedTargetIds[i]) == null)
            {
                selectedTargetIds.RemoveAt(i);
            }
        }
    }

    private PrototypeWeaponTarget SelectActiveTarget()
    {
        if (selectedTargetIds.Count == 0)
        {
            return null;
        }

        switch (priorityMode)
        {
            case PrototypeWeaponTargetPriorityMode.Nearest:
                return SelectByDistance();
            case PrototypeWeaponTargetPriorityMode.HighestHealth:
                return SelectByHealth(highest: true);
            case PrototypeWeaponTargetPriorityMode.LowestHealth:
                return SelectByHealth(highest: false);
            default:
                return FindAvailableById(selectedTargetIds[0]);
        }
    }

    private PrototypeWeaponTarget SelectByDistance()
    {
        Vector3 origin = shipRoot != null ? shipRoot.position : transform.position;
        PrototypeWeaponTarget best = null;
        float bestDistance = float.PositiveInfinity;
        for (int i = 0; i < selectedTargetIds.Count; i++)
        {
            PrototypeWeaponTarget candidate = FindAvailableById(selectedTargetIds[i]);
            if (candidate == null)
            {
                continue;
            }

            float distance = Vector3.SqrMagnitude(candidate.Position - origin);
            if (best == null || distance < bestDistance)
            {
                best = candidate;
                bestDistance = distance;
            }
        }

        return best;
    }

    private PrototypeWeaponTarget SelectByHealth(bool highest)
    {
        PrototypeWeaponTarget best = null;
        for (int i = 0; i < selectedTargetIds.Count; i++)
        {
            PrototypeWeaponTarget candidate = FindAvailableById(selectedTargetIds[i]);
            if (candidate == null)
            {
                continue;
            }

            if (best == null
                || (highest && candidate.CurrentHealth > best.CurrentHealth)
                || (!highest && candidate.CurrentHealth < best.CurrentHealth))
            {
                best = candidate;
            }
        }

        return best;
    }

    private PrototypeWeaponTarget FindAvailableById(int stableId)
    {
        for (int i = 0; i < availableTargets.Count; i++)
        {
            PrototypeWeaponTarget target = availableTargets[i];
            if (target != null && target.IsValid && target.StableId == stableId)
            {
                return target;
            }
        }

        return null;
    }

    private static string NormalizeStatusLabel(PrototypeTurretFireStatus status)
    {
        if (!string.IsNullOrWhiteSpace(status.message))
        {
            return status.message;
        }

        return status.canFire ? "in arc" : "no authority";
    }
}
