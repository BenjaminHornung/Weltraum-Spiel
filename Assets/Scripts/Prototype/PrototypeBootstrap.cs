using UnityEngine;

public class PrototypeBootstrap : MonoBehaviour
{
    [SerializeField] private bool buildOnStart = true;
    [SerializeField] private bool addOrientationMarkers = true;
    [SerializeField] private Vector3 shipStartPosition = new Vector3(0f, 0.5f, 0f);

    private const string PrototypeRootName = "PrototypeShip";

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    private static void RuntimeBootstrap()
    {
        if (!Application.isPlaying)
        {
            return;
        }

        if (Object.FindObjectOfType<PrototypeBootstrap>() == null)
        {
            var bootstrap = new GameObject("PrototypeBootstrap");
            bootstrap.AddComponent<PrototypeBootstrap>();
            Object.DontDestroyOnLoad(bootstrap);
        }
    }

    private void Start()
    {
        if (buildOnStart)
        {
            BuildPrototype();
        }
    }

public void BuildPrototype()
    {
        var ship = GameObject.Find(PrototypeRootName);
        if (ship == null)
        {
            ship = new GameObject(PrototypeRootName);
            ship.transform.position = shipStartPosition;
        }

        var stats = GetOrAddComponent<ShipStats>(ship);
        var shipRigidbody = GetOrAddComponent<Rigidbody>(ship);

        shipRigidbody.useGravity = false;
        shipRigidbody.mass = stats.CurrentMass;
        shipRigidbody.linearDamping = 0.05f;
        shipRigidbody.angularDamping = 3.5f;

        EnsureModuleParts(ship.transform);
        var mainNozzle = EnsureMainThrusterNozzle(ship.transform);
        EnsureRcsThrusters(ship.transform);
        RemoveRootFallbackChild(ship.transform, "Muzzle");

        var gun = GetOrAddComponent<GunModule>(ship);
        var engine = GetOrAddComponent<EngineVfxController>(ship);
        var mainThruster = GetOrAddComponent<MainThrusterModule>(ship);
        var rcs = GetOrAddComponent<RcsThrusterController>(ship);
        GetOrAddComponent<PlayerShipController>(ship);

        mainThruster.Configure(mainNozzle, shipRigidbody, stats);
        rcs.ConfigureThrusters(
            ship.transform.Find("RCS_Up"),
            ship.transform.Find("RCS_Down"),
            ship.transform.Find("RCS_Left"),
            ship.transform.Find("RCS_Right"),
            shipRigidbody);

        if (gun == null || engine == null)
        {
            Debug.LogWarning("Prototype ship bootstrap could not initialize all optional modules.");
        }

        if (addOrientationMarkers)
        {
            EnsureOrientationMarkers(ship.transform);
        }

        SetupMainCamera(ship.transform, stats, shipRigidbody);
        EnsureSceneDirectionalLight();
    }

    private static T GetOrAddComponent<T>(GameObject target) where T : Component
    {
        var component = target.GetComponent<T>();
        if (component == null)
        {
            component = target.AddComponent<T>();
        }

        return component;
    }

    private static void RemoveRootFallbackChild(Transform parent, string childName)
    {
        var child = parent.Find(childName);
        if (child == null)
        {
            return;
        }

        if (Application.isPlaying)
        {
            Destroy(child.gameObject);
        }
        else
        {
            DestroyImmediate(child.gameObject);
        }
    }

    private static GameObject EnsureModuleParts(Transform ship)
    {
        BuildModulePart(ship, "Hull", PrimitiveType.Capsule, new Vector3(0f, 0f, 0f), Quaternion.Euler(0f, 90f, 0f), new Vector3(1.8f, 0.8f, 3.0f), new Color(0.75f, 0.78f, 0.85f));
        BuildModulePart(ship, "Cockpit", PrimitiveType.Sphere, new Vector3(0f, 0.9f, 0.4f), Quaternion.identity, new Vector3(0.7f, 0.45f, 0.7f), new Color(0.82f, 0.2f, 0.2f));
        BuildModulePart(ship, "FuelTank", PrimitiveType.Cylinder, new Vector3(0f, -0.65f, 0.4f), Quaternion.identity, new Vector3(0.7f, 0.5f, 0.7f), new Color(0.2f, 0.7f, 0.2f));
        BuildModulePart(ship, "Engine", PrimitiveType.Cylinder, new Vector3(0f, -0.35f, -1.65f), Quaternion.Euler(0f, 90f, 0f), new Vector3(0.6f, 0.2f, 0.9f), new Color(0.16f, 0.44f, 0.9f));

        var gun = BuildModulePart(ship, "Gun", PrimitiveType.Cube, new Vector3(0f, 0.15f, 1.55f), Quaternion.identity, new Vector3(0.35f, 0.25f, 0.45f), new Color(0.9f, 0.9f, 0.3f));
        var muzzle = gun.transform.Find("Muzzle");
        if (muzzle == null)
        {
            var muzzleObj = new GameObject("Muzzle");
            muzzleObj.transform.SetParent(gun.transform, false);
            muzzleObj.transform.localPosition = new Vector3(0f, 0f, 0.3f);
            muzzleObj.transform.localRotation = Quaternion.identity;
        }

        return ship.gameObject;
    }

private static Transform EnsureMainThrusterNozzle(Transform ship)
    {
        var existing = ship.Find("MainThrusterNozzle");
        if (existing != null)
        {
            existing.localPosition = new Vector3(0f, -0.35f, -2.15f);
            existing.localRotation = Quaternion.identity;
            return existing;
        }

        var nozzle = new GameObject("MainThrusterNozzle");
        nozzle.transform.SetParent(ship, false);
        nozzle.transform.localPosition = new Vector3(0f, -0.35f, -2.15f);
        nozzle.transform.localRotation = Quaternion.identity;
        return nozzle.transform;
    }


    private static void EnsureRcsThrusters(Transform ship)
    {
        var up = BuildModulePart(ship, "RCS_Up", PrimitiveType.Cube, new Vector3(0f, -0.42f, 0.95f), Quaternion.identity, new Vector3(0.22f, 0.16f, 0.22f), new Color(0.25f, 0.9f, 1f));
        var down = BuildModulePart(ship, "RCS_Down", PrimitiveType.Cube, new Vector3(0f, 0.78f, 0.95f), Quaternion.identity, new Vector3(0.22f, 0.16f, 0.22f), new Color(0.25f, 0.9f, 1f));
        var left = BuildModulePart(ship, "RCS_Left", PrimitiveType.Cube, new Vector3(0.9f, 0f, 0.15f), Quaternion.identity, new Vector3(0.16f, 0.22f, 0.22f), new Color(0.25f, 0.9f, 1f));
        var right = BuildModulePart(ship, "RCS_Right", PrimitiveType.Cube, new Vector3(-0.9f, 0f, 0.15f), Quaternion.identity, new Vector3(0.16f, 0.22f, 0.22f), new Color(0.25f, 0.9f, 1f));

        EnsureRcsVfx(up.transform, "RCS_Up_VFX", new Vector3(0f, -0.18f, 0f), new Vector3(0.08f, 0.35f, 0.08f));
        EnsureRcsVfx(down.transform, "RCS_Down_VFX", new Vector3(0f, 0.18f, 0f), new Vector3(0.08f, 0.35f, 0.08f));
        EnsureRcsVfx(left.transform, "RCS_Left_VFX", new Vector3(0.18f, 0f, 0f), new Vector3(0.35f, 0.08f, 0.08f));
        EnsureRcsVfx(right.transform, "RCS_Right_VFX", new Vector3(-0.18f, 0f, 0f), new Vector3(0.35f, 0.08f, 0.08f));
    }

    private static void EnsureRcsVfx(Transform parent, string name, Vector3 localPos, Vector3 localScale)
    {
        var existing = parent.Find(name);
        if (existing != null)
        {
            existing.gameObject.SetActive(false);
            return;
        }

        var vfx = GameObject.CreatePrimitive(PrimitiveType.Cube);
        vfx.name = name;
        vfx.transform.SetParent(parent, false);
        vfx.transform.localPosition = localPos;
        vfx.transform.localRotation = Quaternion.identity;
        vfx.transform.localScale = localScale;
        ApplyMaterialColor(vfx, new Color(0.45f, 0.95f, 1f, 0.85f), true);
        vfx.SetActive(false);
    }

    private static GameObject BuildModulePart(Transform parent, string name, PrimitiveType type, Vector3 localPos, Quaternion localRot, Vector3 localScale, Color color)
    {
        var existing = parent.Find(name);
        if (existing != null)
        {
            return existing.gameObject;
        }

        var go = GameObject.CreatePrimitive(type);
        go.name = name;
        go.transform.SetParent(parent, false);
        go.transform.localPosition = localPos;
        go.transform.localRotation = localRot;
        go.transform.localScale = localScale;
        ApplyMaterialColor(go, color, false);
        return go;
    }

    private static void ApplyMaterialColor(GameObject go, Color color, bool emissive)
    {
        var renderer = go.GetComponent<Renderer>();
        if (renderer == null)
        {
            return;
        }

        if (renderer.sharedMaterial == null)
        {
            var shader = Shader.Find("Universal Render Pipeline/Lit");
            renderer.material = new Material(shader == null ? Shader.Find("Standard") : shader);
        }

        renderer.material.color = color;
        if (emissive && renderer.material.HasProperty("_EmissionColor"))
        {
            renderer.material.EnableKeyword("_EMISSION");
            renderer.material.SetColor("_EmissionColor", color * 2.5f);
        }
    }

    private static void EnsureOrientationMarkers(Transform ship)
    {
        if (ship.Find("OrientationMarkers") != null)
        {
            return;
        }

        var markerRoot = new GameObject("OrientationMarkers");
        markerRoot.transform.SetParent(ship, false);

        CreateMarker(markerRoot.transform, "Marker_Forward", Color.cyan, new Vector3(0f, 0f, 2f), new Vector3(0.06f, 0.06f, 1.2f));
        CreateMarker(markerRoot.transform, "Marker_Right", Color.red, new Vector3(1.2f, 0f, 0f), new Vector3(1.2f, 0.06f, 0.06f));
        CreateMarker(markerRoot.transform, "Marker_Up", Color.green, new Vector3(0f, 1.1f, 0f), new Vector3(0.06f, 1.1f, 0.06f));
    }

    private static void CreateMarker(Transform parent, string name, Color color, Vector3 localPos, Vector3 scale)
    {
        var mark = GameObject.CreatePrimitive(PrimitiveType.Cube);
        mark.name = name;
        mark.transform.SetParent(parent, false);
        mark.transform.localPosition = localPos;
        mark.transform.localScale = scale;
        ApplyMaterialColor(mark, color, false);
    }

    private static void SetupMainCamera(Transform target, ShipStats stats, Rigidbody body)
    {
        var camera = Camera.main;
        if (camera == null)
        {
            var existingMain = GameObject.Find("Main Camera");
            if (existingMain != null)
            {
                camera = existingMain.GetComponent<Camera>();
            }
        }

        if (camera == null)
        {
            var camObj = new GameObject("Main Camera");
            camObj.tag = "MainCamera";
            camera = camObj.AddComponent<Camera>();
        }
        else
        {
            camera.tag = "MainCamera";
        }

        var camTransform = camera.transform;
        camTransform.position = target.position - (target.forward * 12f) + (Vector3.up * 4f);
        camTransform.LookAt(target.position + target.forward * 2f);

        var follow = camera.gameObject.GetComponent<SimpleFollowCamera>();
        if (follow == null)
        {
            follow = camera.gameObject.AddComponent<SimpleFollowCamera>();
        }
        follow.BindTarget(target, stats);

        var overlay = camera.gameObject.GetComponent<PrototypeDebugOverlay>();
        if (overlay == null)
        {
            overlay = camera.gameObject.AddComponent<PrototypeDebugOverlay>();
        }
        overlay.Bind(target, stats, body);
    }

    private static void EnsureSceneDirectionalLight()
    {
        var sceneLight = GameObject.Find("Directional Light");
        if (sceneLight == null)
        {
            sceneLight = new GameObject("Directional Light");
            var light = sceneLight.AddComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = 1.2f;
            sceneLight.transform.rotation = Quaternion.Euler(50f, 330f, 0f);
        }
        else if (sceneLight.GetComponent<Light>() == null)
        {
            sceneLight.AddComponent<Light>().type = LightType.Directional;
        }
    }
}
