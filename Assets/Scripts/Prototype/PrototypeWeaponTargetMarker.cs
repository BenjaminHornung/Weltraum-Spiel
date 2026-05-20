using UnityEngine;

[DisallowMultipleComponent]
public class PrototypeWeaponTargetMarker : MonoBehaviour
{
    [SerializeField] private Transform targetRoot;

    public Transform TargetRoot => targetRoot != null ? targetRoot : transform;

    private void OnEnable()
    {
        PrototypeWeaponTargetRegistry.Register(TargetRoot);
    }

    private void OnDisable()
    {
        PrototypeWeaponTargetRegistry.Unregister(TargetRoot);
    }

    public void Configure(Transform root)
    {
        if (isActiveAndEnabled)
        {
            PrototypeWeaponTargetRegistry.Unregister(TargetRoot);
        }

        targetRoot = root != null ? root : transform;

        if (isActiveAndEnabled)
        {
            PrototypeWeaponTargetRegistry.Register(TargetRoot);
        }
    }
}
