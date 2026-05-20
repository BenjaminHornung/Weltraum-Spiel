using UnityEngine;

[CreateAssetMenu(menuName = "Prototype/Ship VFX Library", fileName = "PrototypeShipVfxLibrary")]
public sealed class PrototypeShipVfxLibrary : ScriptableObject
{
    public const string DefaultAssetPath = "Assets/Art/PrototypeShipKit/VFX/PrototypeShipVfxLibrary.asset";

    [SerializeField] private GameObject mainThrusterVfxPrefab;
    [SerializeField] private GameObject rcsThrusterVfxPrefab;
    [SerializeField] private GameObject muzzleFlashVfxPrefab;

    public GameObject MainThrusterVfxPrefab => mainThrusterVfxPrefab;
    public GameObject RcsThrusterVfxPrefab => rcsThrusterVfxPrefab;
    public GameObject MuzzleFlashVfxPrefab => muzzleFlashVfxPrefab;

#if UNITY_EDITOR
    public static PrototypeShipVfxLibrary LoadDefaultEditor()
    {
        return UnityEditor.AssetDatabase.LoadAssetAtPath<PrototypeShipVfxLibrary>(DefaultAssetPath);
    }
#endif
}
