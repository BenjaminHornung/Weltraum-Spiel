#if UNITY_EDITOR
using NUnit.Framework;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

public class PrototypeShipKitImportVfxValidationTests
{
    private const string MaterialRoot = "Assets/Art/PrototypeShipKit/Materials/";
    private const string MainVfxPrefabPath = "Assets/Art/PrototypeShipKit/VFX/Prefabs/MainThrusterVfx.prefab";
    private const string RcsVfxPrefabPath = "Assets/Art/PrototypeShipKit/VFX/Prefabs/RcsThrusterVfx.prefab";
    private const string PreviewScenePath = "Assets/Scenes/PrototypeShipKitPreview.unity";

    [TearDown]
    public void TearDown()
    {
        DestroyNamed("ShipKitImportVfxTestInstance");
    }

    [Test]
    public void CanonicalShipKitMaterialsAreOpaque()
    {
        string[] materialNames =
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
            "MAT_Connector_Lime"
        };

        for (int i = 0; i < materialNames.Length; i++)
        {
            Material material = AssetDatabase.LoadAssetAtPath<Material>(MaterialRoot + materialNames[i] + ".mat");
            Assert.NotNull(material, materialNames[i]);
            Assert.That(ReadMaterialAlpha(material), Is.GreaterThanOrEqualTo(0.999f), material.name);
            Assert.False(material.IsKeywordEnabled("_SURFACE_TYPE_TRANSPARENT"), material.name);
            Assert.That(material.renderQueue, Is.LessThanOrEqualTo(2500).Or.EqualTo(-1), material.name);

            if (material.HasProperty("_Surface"))
            {
                Assert.That(material.GetFloat("_Surface"), Is.EqualTo(0f).Within(0.001f), material.name);
            }
        }
    }

    [Test]
    public void VfxPrefabsContainParticleSystems()
    {
        GameObject mainPrefab = AssetDatabase.LoadAssetAtPath<GameObject>(MainVfxPrefabPath);
        GameObject rcsPrefab = AssetDatabase.LoadAssetAtPath<GameObject>(RcsVfxPrefabPath);

        Assert.NotNull(mainPrefab);
        Assert.NotNull(rcsPrefab);
        Assert.NotNull(mainPrefab.GetComponentInChildren<ParticleSystem>(true));
        Assert.NotNull(rcsPrefab.GetComponentInChildren<ParticleSystem>(true));
    }

    [Test]
    public void BinderAttachesVfxToImportedDemoNozzlesWithoutDuplicating()
    {
        GameObject source = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Art/PrototypeShipKit/DemoShips/demo_scout_mk1.fbx");
        GameObject mainPrefab = AssetDatabase.LoadAssetAtPath<GameObject>(MainVfxPrefabPath);
        GameObject rcsPrefab = AssetDatabase.LoadAssetAtPath<GameObject>(RcsVfxPrefabPath);

        Assert.NotNull(source);
        Assert.NotNull(mainPrefab);
        Assert.NotNull(rcsPrefab);

        GameObject instance = Object.Instantiate(source);
        instance.name = "ShipKitImportVfxTestInstance";

        var normalizer = instance.AddComponent<PrototypeShipKitMaterialNormalizer>();
        normalizer.NormalizeNow();
        Assert.That(normalizer.LastRendererCount, Is.GreaterThan(0));

        var binder = instance.AddComponent<PrototypeShipKitVfxBinder>();
        binder.MainThrusterVfxPrefab = mainPrefab;
        binder.RcsThrusterVfxPrefab = rcsPrefab;
        PrototypeShipKitVfxBinder.BindStats firstBind = binder.BindNow();
        PrototypeShipKitVfxBinder.BindStats secondBind = binder.BindNow();

        Assert.That(firstBind.MainThrusterBindings, Is.GreaterThanOrEqualTo(1));
        Assert.That(firstBind.RcsThrusterBindings, Is.GreaterThanOrEqualTo(8));
        Assert.That(firstBind.CreatedInstances, Is.EqualTo(firstBind.MainThrusterBindings + firstBind.RcsThrusterBindings));
        Assert.That(secondBind.CreatedInstances, Is.EqualTo(0));
        Assert.That(CountDescendantNamesContaining(instance.transform, PrototypeShipKitVfxBinder.MainThrusterVfxChildName), Is.EqualTo(firstBind.MainThrusterBindings));
        Assert.That(CountDescendantNamesContaining(instance.transform, PrototypeShipKitVfxBinder.RcsThrusterVfxChildName), Is.EqualTo(firstBind.RcsThrusterBindings));
    }

    [Test]
    public void PreviewSceneAssetExists()
    {
        SceneAsset sceneAsset = AssetDatabase.LoadAssetAtPath<SceneAsset>(PreviewScenePath);
        Assert.NotNull(sceneAsset);
        Assert.True(EditorSceneManager.GetSceneByPath(PreviewScenePath).isLoaded || AssetDatabase.AssetPathExists(PreviewScenePath));
    }

    private static float ReadMaterialAlpha(Material material)
    {
        if (material.HasProperty("_BaseColor"))
        {
            return material.GetColor("_BaseColor").a;
        }

        return material.color.a;
    }

    private static int CountDescendantNamesContaining(Transform root, string namePart)
    {
        int count = 0;
        Transform[] transforms = root.GetComponentsInChildren<Transform>(true);
        for (int i = 0; i < transforms.Length; i++)
        {
            if (transforms[i].name.Contains(namePart))
            {
                count++;
            }
        }

        return count;
    }

    private static void DestroyNamed(string objectName)
    {
        GameObject target = GameObject.Find(objectName);
        if (target != null)
        {
            Object.DestroyImmediate(target);
        }
    }
}
#endif
