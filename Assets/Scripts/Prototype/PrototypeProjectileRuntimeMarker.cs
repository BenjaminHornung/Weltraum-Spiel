using UnityEngine;

[DisallowMultipleComponent]
public class PrototypeProjectileRuntimeMarker : MonoBehaviour
{
    public const int IgnoreRaycastLayer = 2;

    public static void Mark(GameObject target)
    {
        if (target == null)
        {
            return;
        }

        if (target.GetComponent<PrototypeProjectileRuntimeMarker>() == null)
        {
            target.AddComponent<PrototypeProjectileRuntimeMarker>();
        }

        SetLayerRecursive(target.transform, IgnoreRaycastLayer);
    }

    public static bool IsRuntimeProjectileTransform(Transform candidate)
    {
        return candidate != null && candidate.GetComponentInParent<PrototypeProjectileRuntimeMarker>() != null;
    }

    private static void SetLayerRecursive(Transform root, int layer)
    {
        if (root == null)
        {
            return;
        }

        root.gameObject.layer = layer;
        for (int i = 0; i < root.childCount; i++)
        {
            SetLayerRecursive(root.GetChild(i), layer);
        }
    }
}
