using System.Collections.Generic;
using UnityEngine;

public static class PrototypeWeaponTargetRegistry
{
    private static readonly List<Transform> targets = new List<Transform>();
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

        targets.Add(target);
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
            if (targets[i] == null || GetTargetId(targets[i]) == id)
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
            Transform target = targets[i];
            if (target != null && target.gameObject.activeInHierarchy)
            {
                buffer.Add(target);
            }
        }
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
            Transform target = targets[i];
            if (target != null)
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
            if (targets[i] != null)
            {
                targetIds.Add(GetTargetId(targets[i]));
            }
        }

        Version++;
    }

    private static int GetTargetId(Transform target)
    {
        return target != null ? target.GetHashCode() : 0;
    }
}
