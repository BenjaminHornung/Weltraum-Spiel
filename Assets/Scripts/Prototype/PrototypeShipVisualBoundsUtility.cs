using System;
using UnityEngine;

public static class PrototypeShipVisualBoundsUtility
{
    private static readonly string[] ImportedDemoBodyRendererExclusions =
    {
        "VFX",
        "MUZZLE_FLASH",
        "WEAPON_CLEARANCE",
        "WEAPON_ARC_LIMIT",
        "Debug",
        "Label",
        "Ring",
        "Marker",
        "SOCKET",
        "CONN_",
        "CONNECTOR",
        "HARDPOINT",
        "THRUST_NOZZLE",
        "RCS_NOZZLE",
        "WEAPON_MUZZLE",
        "WEAPON_TURRET",
        "NOZZLE"
    };

    public static bool IsImportedDemoShipBodyRenderer(Renderer renderer)
    {
        if (renderer == null || !renderer.enabled || !renderer.gameObject.activeInHierarchy)
        {
            return false;
        }

        if (renderer.GetComponentInParent<PrototypeIgnoreCameraBounds>() != null)
        {
            return false;
        }

        string renderName = renderer.gameObject.name;
        if (!renderName.StartsWith("DEMO_", StringComparison.Ordinal))
        {
            return false;
        }

        for (int i = 0; i < ImportedDemoBodyRendererExclusions.Length; i++)
        {
            if (renderName.IndexOf(ImportedDemoBodyRendererExclusions[i], StringComparison.OrdinalIgnoreCase) >= 0)
            {
                return false;
            }
        }

        return true;
    }
}
