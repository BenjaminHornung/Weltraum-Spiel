using UnityEngine;

public class PrototypeBootstrap : MonoBehaviour
{
    [SerializeField] private bool buildOnStart = true;
    [SerializeField] private bool addOrientationMarkers = true;
    [SerializeField] private Vector3 shipStartPosition = new Vector3(0f, 0.5f, 0f);

    private const string PrototypeRootName = "PrototypeShip";
    private static readonly Color HullColor = new Color(0.68f, 0.72f, 0.78f);
    private static readonly Color RcsBlockColor = new Color(0.22f, 0.85f, 0.95f);
    private static readonly Color RcsVfxColor = new Color(0.35f, 1f, 0.65f, 0.85f);
    private const float DefaultRcsBlockThrust = 6500f;

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    private static void RuntimeBootstrap()
    {
        if (!Application.isPlaying)
        {
            return;
        }

        if (Object.FindAnyObjectByType<PrototypeBootstrap>() == null)
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
        shipRigidbody.linearDamping = 0f;
        shipRigidbody.angularDamping = 0f;
        shipRigidbody.interpolation = RigidbodyInterpolation.Interpolate;

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
            ship.transform.Find("RCS_Top"),
            ship.transform.Find("RCS_Bottom"),
            ship.transform.Find("RCS_Left"),
            ship.transform.Find("RCS_Right"),
            null,
            null,
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

        DestroyGameObject(child.gameObject);
    }

    private static GameObject EnsureModuleParts(Transform ship)
    {
        BuildModulePart(ship, "Hull", PrimitiveType.Cube, Vector3.zero, Quaternion.identity, new Vector3(1.8f, 1.1f, 6.0f), HullColor);
        BuildModulePart(ship, "Cockpit", PrimitiveType.Cube, new Vector3(0f, 0.45f, 2.05f), Quaternion.identity, new Vector3(1.0f, 0.45f, 1.0f), new Color(0.82f, 0.2f, 0.2f));
        BuildModulePart(ship, "FuelTank", PrimitiveType.Cube, new Vector3(0f, -0.45f, 0.1f), Quaternion.identity, new Vector3(1.2f, 0.35f, 2.1f), new Color(0.2f, 0.7f, 0.2f));

        var gun = BuildModulePart(ship, "Gun", PrimitiveType.Cube, new Vector3(0f, 0.1f, 3.25f), Quaternion.identity, new Vector3(0.32f, 0.22f, 0.65f), new Color(0.9f, 0.9f, 0.3f));
        var muzzle = gun.transform.Find("Muzzle");
        if (muzzle == null)
        {
            var muzzleObj = new GameObject("Muzzle");
            muzzleObj.transform.SetParent(gun.transform, false);
            muzzleObj.transform.localPosition = new Vector3(0f, 0f, 0.45f);
            muzzleObj.transform.localRotation = Quaternion.identity;
        }
        else
        {
            muzzle.localPosition = new Vector3(0f, 0f, 0.45f);
            muzzle.localRotation = Quaternion.identity;
        }

        return ship.gameObject;
    }

    private static Transform EnsureMainThrusterNozzle(Transform ship)
    {
        DestroyChildIfExists(ship, "Engine");
        var gimbal = BuildModulePart(ship, "MainThrusterGimbal", PrimitiveType.Cube, new Vector3(0f, 0f, -3.35f), Quaternion.identity, new Vector3(1.0f, 0.75f, 0.7f), new Color(0.16f, 0.44f, 0.9f));
        var nozzle = gimbal.transform.Find("MainThrusterNozzle");
        if (nozzle == null)
        {
            var nozzleObject = new GameObject("MainThrusterNozzle");
            nozzleObject.transform.SetParent(gimbal.transform, false);
            nozzle = nozzleObject.transform;
        }

        nozzle.localPosition = new Vector3(0f, 0f, -0.55f);
        nozzle.localRotation = Quaternion.identity;
        return nozzle;
    }

    private static void EnsureRcsThrusters(Transform ship)
    {
        DestroyChildIfExists(ship, "RCS_Up");
        DestroyChildIfExists(ship, "RCS_Down");
        DestroyChildIfExists(ship, "RCS_Forward");
        DestroyChildIfExists(ship, "RCS_Back");

        BuildRcsBlock(ship, "RCS_Top", new Vector3(0f, 0.7f, 0f), new Vector3(0.55f, 0.22f, 0.55f), Vector3.down);
        BuildRcsBlock(ship, "RCS_Bottom", new Vector3(0f, -0.7f, 0f), new Vector3(0.55f, 0.22f, 0.55f), Vector3.up);
        BuildRcsBlock(ship, "RCS_Left", new Vector3(-1.02f, 0f, 0f), new Vector3(0.22f, 0.55f, 0.55f), Vector3.right);
        BuildRcsBlock(ship, "RCS_Right", new Vector3(1.02f, 0f, 0f), new Vector3(0.22f, 0.55f, 0.55f), Vector3.left);
    }

    private static void BuildRcsBlock(Transform ship, string blockName, Vector3 localPosition, Vector3 localScale, Vector3 blockedDirection)
    {
        var block = BuildModulePart(ship, blockName, PrimitiveType.Cube, localPosition, Quaternion.identity, localScale, RcsBlockColor);
        var thrusterBlock = GetOrAddComponent<RcsThrusterBlock>(block);
        thrusterBlock.ConfigureDefault(DefaultRcsBlockThrust);

        Vector3[] directions = { Vector3.forward, Vector3.back, Vector3.left, Vector3.right, Vector3.up, Vector3.down };
        for (int i = 0; i < directions.Length; i++)
        {
            Vector3 direction = directions[i];
            if (Vector3.Dot(direction, blockedDirection) > 0.95f)
            {
                continue;
            }

            EnsureRcsNozzle(block.transform, blockName, DirectionName(direction), direction);
        }
    }

    private static void EnsureRcsNozzle(Transform block, string blockName, string directionName, Vector3 localDirection)
    {
        string nozzleName = "RCS_Nozzle_" + blockName + "_" + directionName;
        var nozzle = block.Find(nozzleName);
        if (nozzle == null)
        {
            var nozzleObject = new GameObject(nozzleName);
            nozzleObject.transform.SetParent(block, false);
            nozzle = nozzleObject.transform;
        }

        nozzle.localPosition = localDirection.normalized * 0.38f;
        nozzle.localRotation = LookRotationLocal(localDirection.normalized);

        var vfx = nozzle.Find("VFX");
        if (vfx == null)
        {
            var vfxObject = GameObject.CreatePrimitive(PrimitiveType.Cube);
            vfxObject.name = "VFX";
            vfxObject.transform.SetParent(nozzle, false);
            vfx = vfxObject.transform;
        }

        vfx.localPosition = Vector3.back * 2.3f;
        vfx.localRotation = Quaternion.Euler(0f, 180f, 0f);
        vfx.localScale = new Vector3(0.08f, 0.08f, 0.12f);
        RemoveCollider(vfx.gameObject);
        ApplyMaterialColor(vfx.gameObject, RcsVfxColor, true);
        vfx.gameObject.SetActive(false);
    }

    private static Quaternion LookRotationLocal(Vector3 localDirection)
    {
        Vector3 up = Mathf.Abs(Vector3.Dot(localDirection, Vector3.up)) > 0.9f ? Vector3.forward : Vector3.up;
        return Quaternion.LookRotation(localDirection, up);
    }

    private static string DirectionName(Vector3 direction)
    {
        if (direction == Vector3.forward) return "Forward";
        if (direction == Vector3.back) return "Back";
        if (direction == Vector3.left) return "Left";
        if (direction == Vector3.right) return "Right";
        if (direction == Vector3.up) return "Up";
        return "Down";
    }

    private static GameObject BuildModulePart(Transform parent, string name, PrimitiveType type, Vector3 localPos, Quaternion localRot, Vector3 localScale, Color color)
    {
        var existing = parent.Find(name);
        GameObject go;
        if (existing != null)
        {
            go = existing.gameObject;
        }
        else
        {
            go = GameObject.CreatePrimitive(type);
            go.name = name;
            go.transform.SetParent(parent, false);
        }

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
        var markerRoot = ship.Find("OrientationMarkers");
        if (markerRoot == null)
        {
            markerRoot = new GameObject("OrientationMarkers").transform;
            markerRoot.SetParent(ship, false);
        }

        CreateMarker(markerRoot, "Marker_Forward", Color.cyan, new Vector3(0f, 0f, 3.7f), new Vector3(0.08f, 0.08f, 1.2f));
        CreateMarker(markerRoot, "Marker_Right", Color.red, new Vector3(1.5f, 0f, 0f), new Vector3(1.2f, 0.08f, 0.08f));
        CreateMarker(markerRoot, "Marker_Up", Color.green, new Vector3(0f, 1.3f, 0f), new Vector3(0.08f, 1.1f, 0.08f));
    }

    private static void CreateMarker(Transform parent, string name, Color color, Vector3 localPos, Vector3 scale)
    {
        var existing = parent.Find(name);
        GameObject mark;
        if (existing == null)
        {
            mark = GameObject.CreatePrimitive(PrimitiveType.Cube);
            mark.name = name;
            mark.transform.SetParent(parent, false);
        }
        else
        {
            mark = existing.gameObject;
        }

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
        camTransform.position = target.position - (target.forward * 18f) + (Vector3.up * 6f);
        camTransform.LookAt(target.position + target.forward * 1.5f);

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

    private static void DestroyChildIfExists(Transform parent, string childName)
    {
        var child = parent.Find(childName);
        if (child != null)
        {
            DestroyGameObject(child.gameObject);
        }
    }

    private static void DestroyGameObject(GameObject target)
    {
        if (target == null)
        {
            return;
        }

        if (Application.isPlaying)
        {
            Destroy(target);
        }
        else
        {
            DestroyImmediate(target);
        }
    }


    private static void RemoveCollider(GameObject target)
    {
        if (target == null)
        {
            return;
        }

        var collider = target.GetComponent<Collider>();
        if (collider == null)
        {
            return;
        }

        if (Application.isPlaying)
        {
            Destroy(collider);
        }
        else
        {
            DestroyImmediate(collider);
        }
    }
}
