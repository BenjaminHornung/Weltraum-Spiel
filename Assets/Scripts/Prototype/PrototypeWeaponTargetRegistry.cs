using System.Collections.Generic;
using UnityEngine;

public static class PrototypeWeaponTargetRegistry
{
    private struct RegisteredTarget
    {
        public int targetId;
        public Transform target;
        public Rigidbody targetBody;
        public PrototypeModuleDamageState damageState;
    }

    private static readonly List<RegisteredTarget> targets = new List<RegisteredTarget>();
    private static readonly HashSet<int> targetIds = new HashSet<int>();

    public static int Version { get; private set; }

    public static int RegisteredCount
    {
        get
        {
            PruneInvalidTargets();
            return targets.Count;
        }
    }

    public static void Register(Transform target)
    {
        if (target == null)
        {
            return;
        }

        int id = GetTargetId(target);
        if (!targetIds.Add(id))
        {
            return;
        }

        targets.Add(new RegisteredTarget
        {
            targetId = id,
            target = target,
            targetBody = target.GetComponent<Rigidbody>(),
            damageState = target.GetComponentInParent<PrototypeModuleDamageState>()
        });
        Version++;
    }

    public static void Unregister(Transform target)
    {
        if (target == null)
        {
            return;
        }

        int id = GetTargetId(target);
        if (!targetIds.Remove(id))
        {
            return;
        }

        for (int i = targets.Count - 1; i >= 0; i--)
        {
            RegisteredTarget registeredTarget = targets[i];
            if (registeredTarget.target == target || registeredTarget.target == null || registeredTarget.targetId == id)
            {
                targets.RemoveAt(i);
            }
        }

        Version++;
    }

    public static void CopyRegisteredTargets(List<Transform> buffer)
    {
        if (buffer == null)
        {
            return;
        }

        PruneInvalidTargets();
        buffer.Clear();
        for (int i = 0; i < targets.Count; i++)
        {
            RegisteredTarget registeredTarget = targets[i];
            Transform target = registeredTarget.target;
            if (target != null && target.gameObject.activeInHierarchy)
            {
                buffer.Add(target);
            }
        }
    }

    public static int CopyRegisteredTargetData(List<TargetData> buffer)
    {
        if (buffer == null)
        {
            return 0;
        }

        PruneInvalidTargets();
        buffer.Clear();
        int snapshotVersion = Version;
        for (int i = 0; i < targets.Count; i++)
        {
            RegisteredTarget registeredTarget = targets[i];
            Transform target = registeredTarget.target;
            if (target == null || !target.gameObject.activeInHierarchy)
            {
                continue;
            }

            float maxHealth = 0f;
            float currentHealth = 0f;
            if (registeredTarget.damageState != null)
            {
                maxHealth = registeredTarget.damageState.MaxIntegrity;
                currentHealth = registeredTarget.damageState.CurrentIntegrity;
            }

            buffer.Add(new TargetData
            {
                targetId = registeredTarget.targetId,
                snapshotVersion = snapshotVersion,
                position = target.position,
                rotation = target.rotation,
                forward = target.forward,
                up = target.up,
                linearVelocity = registeredTarget.targetBody != null ? registeredTarget.targetBody.linearVelocity : Vector3.zero,
                isActiveInHierarchy = target.gameObject.activeInHierarchy ? 1 : 0,
                hasRigidbody = registeredTarget.targetBody != null ? 1 : 0,
                hasDamageState = registeredTarget.damageState != null ? 1 : 0,
                currentHealth = currentHealth,
                maxHealth = maxHealth
            });
        }

        return buffer.Count;
    }

    public static void ClearForTests()
    {
        targets.Clear();
        targetIds.Clear();
        Version++;
    }

    private static void PruneInvalidTargets()
    {
        bool changed = false;
        for (int i = targets.Count - 1; i >= 0; i--)
        {
            RegisteredTarget registeredTarget = targets[i];
            if (registeredTarget.target != null)
            {
                continue;
            }

            targets.RemoveAt(i);
            changed = true;
        }

        if (!changed)
        {
            return;
        }

        targetIds.Clear();
        for (int i = 0; i < targets.Count; i++)
        {
            RegisteredTarget registeredTarget = targets[i];
            if (registeredTarget.target != null)
            {
                targetIds.Add(registeredTarget.targetId);
            }
        }

        Version++;
    }

    private static int GetTargetId(Transform target)
    {
        return target != null ? target.GetHashCode() : 0;
    }
}
