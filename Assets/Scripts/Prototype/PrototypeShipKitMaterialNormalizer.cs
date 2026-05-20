using UnityEngine;

[ExecuteAlways]
public sealed class PrototypeShipKitMaterialNormalizer : MonoBehaviour
{
    private const string MaterialRoot = "Assets/Art/PrototypeShipKit/Materials/";

    [SerializeField] private bool normalizeOnEnable;

    public int LastRendererCount { get; private set; }
    public int LastRemappedMaterialSlots { get; private set; }

    private void OnEnable()
    {
        if (normalizeOnEnable)
        {
            NormalizeNow();
        }
    }

    public void NormalizeNow()
    {
        LastRendererCount = 0;
        LastRemappedMaterialSlots = 0;

#if UNITY_EDITOR
        Renderer[] renderers = GetComponentsInChildren<Renderer>(true);
        LastRendererCount = renderers.Length;

        for (int rendererIndex = 0; rendererIndex < renderers.Length; rendererIndex++)
        {
            Renderer targetRenderer = renderers[rendererIndex];
            Material[] materials = targetRenderer.sharedMaterials;
            bool changed = false;

            for (int materialIndex = 0; materialIndex < materials.Length; materialIndex++)
            {
                string canonicalName = ResolveCanonicalMaterialName(materials[materialIndex] != null ? materials[materialIndex].name : string.Empty);
                if (string.IsNullOrEmpty(canonicalName))
                {
                    continue;
                }

                Material canonical = UnityEditor.AssetDatabase.LoadAssetAtPath<Material>(MaterialRoot + canonicalName + ".mat");
                if (canonical == null || materials[materialIndex] == canonical)
                {
                    continue;
                }

                materials[materialIndex] = canonical;
                changed = true;
                LastRemappedMaterialSlots++;
            }

            if (changed)
            {
                targetRenderer.sharedMaterials = materials;
                UnityEditor.EditorUtility.SetDirty(targetRenderer);
            }
        }
#endif
    }

    public static string ResolveCanonicalMaterialName(string sourceMaterialName)
    {
        if (string.IsNullOrWhiteSpace(sourceMaterialName))
        {
            return string.Empty;
        }

        string normalized = sourceMaterialName.Replace(" (Instance)", string.Empty);
        int dotIndex = normalized.IndexOf('.');
        if (dotIndex > 0)
        {
            normalized = normalized.Substring(0, dotIndex);
        }

        string[] knownMaterials =
        {
            "MAT_Hull_DarkGrey",
            "MAT_Hull_Panel",
            "MAT_Cockpit_Glass_DarkBlue",
            "MAT_Fuel_Green",
            "MAT_Engine_DarkMetal",
            "MAT_Engine_Emission_Orange",
            "MAT_RCS_Cyan",
            "MAT_Weapon_YellowRed",
            "MAT_Cargo_Violet",
            "MAT_Connector_Lime",
            "MAT_Debug_Axis_Red",
            "MAT_Debug_Axis_Green",
            "MAT_Debug_Axis_Blue"
        };

        for (int i = 0; i < knownMaterials.Length; i++)
        {
            if (normalized.Contains(knownMaterials[i]))
            {
                return knownMaterials[i];
            }
        }

        if (normalized.Contains("Canopy") || normalized.Contains("Glass") || normalized.Contains("Cockpit"))
        {
            return "MAT_Cockpit_Glass_DarkBlue";
        }

        if (normalized.Contains("Fuel"))
        {
            return "MAT_Fuel_Green";
        }

        if (normalized.Contains("Engine") || normalized.Contains("Nozzle"))
        {
            return normalized.Contains("Orange") || normalized.Contains("Emission")
                ? "MAT_Engine_Emission_Orange"
                : "MAT_Engine_DarkMetal";
        }

        if (normalized.Contains("RCS") || normalized.Contains("Cyan"))
        {
            return "MAT_RCS_Cyan";
        }

        if (normalized.Contains("Weapon") || normalized.Contains("Gun") || normalized.Contains("Muzzle"))
        {
            return "MAT_Weapon_YellowRed";
        }

        if (normalized.Contains("Cargo") || normalized.Contains("Violet"))
        {
            return "MAT_Cargo_Violet";
        }

        if (normalized.Contains("Connector") || normalized.Contains("Hardpoint") || normalized.Contains("Lime"))
        {
            return "MAT_Connector_Lime";
        }

        if (normalized.Contains("Panel"))
        {
            return "MAT_Hull_Panel";
        }

        if (normalized.Contains("Hull"))
        {
            return "MAT_Hull_DarkGrey";
        }

        return string.Empty;
    }
}
