using System.Collections.Generic;
using UnityEngine;

public enum PrototypeEnvironmentPointKind
{
    Origin,
    Axis,
    RangeRing,
    Target,
    Beacon,
    Gate,
    Station,
    Obstacle
}

public enum PrototypeEnvironmentDisplayMode
{
    Minimal,
    Training,
    FullDebug
}

public sealed class PrototypeEnvironmentPoint
{
    public PrototypeEnvironmentPoint(string label, PrototypeEnvironmentPointKind kind, Vector3 position, Color color, float radius = 0f)
    {
        Label = string.IsNullOrWhiteSpace(label) ? kind.ToString() : label;
        Kind = kind;
        Position = position;
        Color = color;
        Radius = Mathf.Max(0f, radius);
    }

    public string Label { get; }
    public PrototypeEnvironmentPointKind Kind { get; }
    public Vector3 Position { get; }
    public Color Color { get; }
    public float Radius { get; }
}

[DisallowMultipleComponent]
public class PrototypeTestEnvironment : MonoBehaviour
{
    [SerializeField] private PrototypeEnvironmentDisplayMode environmentDisplayMode = PrototypeEnvironmentDisplayMode.Training;
    public const string RootName = "PrototypeEnvironment";

    private static readonly Color OriginColor = new Color(1f, 0.92f, 0.28f, 1f);
    private static readonly Color AxisXColor = new Color(1f, 0.18f, 0.16f, 1f);
    private static readonly Color AxisYColor = new Color(0.22f, 1f, 0.32f, 1f);
    private static readonly Color AxisZColor = new Color(0.22f, 0.58f, 1f, 1f);
    private static readonly Color RingColor = new Color(0.28f, 0.72f, 1f, 0.8f);
    private static readonly Color BeaconColor = new Color(0.95f, 0.55f, 1f, 1f);
    private static readonly Color GateColor = new Color(0.4f, 1f, 0.7f, 1f);
    private static readonly Color StationColor = new Color(0.66f, 0.72f, 0.82f, 1f);
    private static readonly Color ObstacleColor = new Color(0.46f, 0.47f, 0.5f, 1f);

    private readonly List<PrototypeEnvironmentPoint> points = new List<PrototypeEnvironmentPoint>();
    private Transform root;

    public IReadOnlyList<PrototypeEnvironmentPoint> Points => points;
    public Transform Root => root;
    public PrototypeEnvironmentDisplayMode EnvironmentDisplayMode => environmentDisplayMode;

    public void Rebuild()
    {
        Clear();

        GameObject rootObject = new GameObject(RootName);
        root = rootObject.transform;
        root.position = Vector3.zero;
        root.rotation = Quaternion.identity;

        ApplyReadableLighting();
        BuildOriginBeacon();
        BuildWorldAxes();
        BuildRangeRings();
        BuildTargets();
        BuildNavigationBeacons();
        BuildApproachGates();
        BuildStationPlaceholder();
        BuildAsteroidField();
    }

    public void Clear()
    {
        points.Clear();
        GameObject existing = GameObject.Find(RootName);
        if (existing != null)
        {
            DestroyObject(existing);
        }

        root = null;
    }

    public PrototypeEnvironmentPoint[] GetPointsSnapshot()
    {
        return points.ToArray();
    }

    private void BuildOriginBeacon()
    {
        Transform group = CreateGroup("Origin");
        float beaconScale = environmentDisplayMode == PrototypeEnvironmentDisplayMode.FullDebug ? 1f : 0.25f;
        GameObject mast = CreatePrimitive("Origin_Beacon_Tower", PrimitiveType.Cylinder, new Vector3(0f, 12f * beaconScale, 0f), Vector3.one, group);
        mast.transform.localScale = new Vector3(2.5f * beaconScale, 12f * beaconScale, 2.5f * beaconScale);
        ApplyMaterial(mast, OriginColor, true);
        RemoveCollider(mast);

        GameObject light = CreatePrimitive("Origin_Beacon_Light", PrimitiveType.Sphere, new Vector3(0f, 26f * beaconScale, 0f), Vector3.one * (7f * beaconScale), group);
        ApplyMaterial(light, OriginColor, true);
        RemoveCollider(light);

        Light pointLight = light.GetComponent<Light>();
        if (pointLight == null)
        {
            pointLight = light.AddComponent<Light>();
        }

        pointLight.type = LightType.Point;
        pointLight.color = OriginColor;
        pointLight.range = Mathf.Lerp(70f, 220f, beaconScale);
        pointLight.intensity = Mathf.Lerp(1.1f, 2.6f, beaconScale);

        if (ShouldCreateEnvironmentLabel(PrototypeEnvironmentPointKind.Origin, 0))
        {
            CreateLabel("Label_ORIGIN", "ORIGIN", new Vector3(0f, 38f * beaconScale, 0f), OriginColor, group, 5f);
        }
        AddPoint("ORIGIN", PrototypeEnvironmentPointKind.Origin, Vector3.zero, OriginColor, 18f * beaconScale);
    }

    private void BuildWorldAxes()
    {
        Transform group = CreateGroup("World_Axes");
        CreateLine("Axis_X", group, AxisXColor, 1.2f, new Vector3(-1000f, 0.1f, 0f), new Vector3(1000f, 0.1f, 0f));
        CreateLine("Axis_Y", group, AxisYColor, 1.2f, new Vector3(0f, -100f, 0f), new Vector3(0f, 420f, 0f));
        CreateLine("Axis_Z", group, AxisZColor, 1.2f, new Vector3(0f, 0.1f, -1000f), new Vector3(0f, 0.1f, 1000f));

        if (ShouldCreateEnvironmentLabel(PrototypeEnvironmentPointKind.Axis, 0))
        {
            CreateLabel("Label_X", "+X", new Vector3(1010f, 12f, 0f), AxisXColor, group, 10f);
        }

        if (ShouldCreateEnvironmentLabel(PrototypeEnvironmentPointKind.Axis, 1))
        {
            CreateLabel("Label_Y", "+Y", new Vector3(0f, 430f, 0f), AxisYColor, group, 10f);
        }

        if (ShouldCreateEnvironmentLabel(PrototypeEnvironmentPointKind.Axis, 2))
        {
            CreateLabel("Label_Z", "+Z", new Vector3(0f, 12f, 1010f), AxisZColor, group, 10f);
        }

        AddPoint("+X Axis", PrototypeEnvironmentPointKind.Axis, new Vector3(1000f, 0f, 0f), AxisXColor);
        AddPoint("+Y Axis", PrototypeEnvironmentPointKind.Axis, new Vector3(0f, 400f, 0f), AxisYColor);
        AddPoint("+Z Axis", PrototypeEnvironmentPointKind.Axis, new Vector3(0f, 0f, 1000f), AxisZColor);
    }

    private void BuildRangeRings()
    {
        Transform group = CreateGroup("Range_Rings");
        float[] rings = { 100f, 250f, 500f, 1000f };
        for (int i = 0; i < rings.Length; i++)
        {
            float radius = rings[i];
            Color color = Color.Lerp(RingColor, Color.white, i * 0.08f);
            if (ShouldRenderRangeRing(i))
            {
                CreateRing("Range_" + Mathf.RoundToInt(radius) + "m", group, radius, Vector3.zero, RingPlane.XZ, color, 0.75f);
                if (ShouldCreateEnvironmentLabel(PrototypeEnvironmentPointKind.RangeRing, i))
                {
                    CreateLabel("Label_Range_" + Mathf.RoundToInt(radius), Mathf.RoundToInt(radius) + " m", new Vector3(radius, 4f, 0f), color, group, 4f);
                }
            }

            AddPoint(Mathf.RoundToInt(radius) + " m ring", PrototypeEnvironmentPointKind.RangeRing, Vector3.zero, color, radius);
        }
    }

    private void BuildTargets()
    {
        Transform group = CreateGroup("Targets");
        CreateTarget(group, "Target Close", new Vector3(0f, 0.5f, 100f), new Vector3(9f, 9f, 1.2f), PrototypeModuleColorPalette.Target, 0);
        CreateTarget(group, "Target Far", new Vector3(0f, 0.5f, 500f), new Vector3(16f, 16f, 2f), new Color(0.2f, 0.58f, 1f, 1f), 1);
        CreateTarget(group, "Target High", new Vector3(0f, 150f, 300f), new Vector3(12f, 12f, 1.5f), new Color(0.4f, 1f, 0.95f, 1f), 2);
        CreateTarget(group, "Target Left", new Vector3(-250f, 35f, 220f), new Vector3(11f, 11f, 1.4f), new Color(0.2f, 0.85f, 0.7f, 1f), 3);
        CreateTarget(group, "Target Right", new Vector3(250f, -20f, 260f), new Vector3(11f, 11f, 1.4f), new Color(0.6f, 0.95f, 1f, 1f), 4);
        CreateTarget(group, "Target Moving Placeholder", new Vector3(120f, 70f, 650f), new Vector3(14f, 8f, 2f), new Color(1f, 0.62f, 0.2f, 1f), 5);
    }

    private void BuildNavigationBeacons()
    {
        Transform group = CreateGroup("Navigation_Beacons");
        CreateBeacon(group, "Beacon Alpha", new Vector3(-180f, 45f, 320f), BeaconColor, 0);
        CreateBeacon(group, "Beacon Beta", new Vector3(260f, 70f, 380f), new Color(1f, 0.62f, 0.95f, 1f), 1);
        CreateBeacon(group, "Beacon Gamma", new Vector3(-420f, 140f, 760f), new Color(0.72f, 0.54f, 1f, 1f), 2);
        CreateBeacon(group, "Beacon Delta", new Vector3(440f, -40f, 920f), new Color(1f, 0.74f, 0.86f, 1f), 3);
    }

    private void BuildApproachGates()
    {
        Transform group = CreateGroup("Approach_Gates");
        Vector3[] gatePositions =
        {
            new Vector3(0f, 25f, 200f),
            new Vector3(0f, 30f, 300f),
            new Vector3(0f, 35f, 400f),
            new Vector3(0f, 40f, 500f)
        };

        for (int i = 0; i < gatePositions.Length; i++)
        {
            Vector3 position = gatePositions[i];
            string label = "Gate " + (i + 1);
            if (ShouldRenderApproachGate(i))
            {
                CreateRing(label + "_Frame", group, 34f + i * 4f, position, RingPlane.XY, GateColor, 1.4f);
                CreateLine(label + "_TopBottom", group, GateColor, 0.8f, position + new Vector3(0f, -36f, 0f), position + new Vector3(0f, 36f, 0f));
                CreateLine(label + "_LeftRight", group, GateColor, 0.8f, position + new Vector3(-36f, 0f, 0f), position + new Vector3(36f, 0f, 0f));
                if (ShouldCreateEnvironmentLabel(PrototypeEnvironmentPointKind.Gate, i))
                {
                    CreateLabel("Label_" + label.Replace(" ", "_"), label, position + new Vector3(0f, 46f, 0f), GateColor, group, 4.5f);
                }
            }

            AddPoint(label, PrototypeEnvironmentPointKind.Gate, position, GateColor, 38f);
        }
    }

    private void BuildStationPlaceholder()
    {
        Transform group = CreateGroup("Station_Hangar");
        Vector3 origin = new Vector3(220f, 45f, 850f);

        CreateStationPart(group, "Station_Spine", origin, new Vector3(150f, 12f, 18f), StationColor);
        CreateStationPart(group, "Station_Left_Pylon", origin + new Vector3(-70f, 0f, 0f), new Vector3(12f, 80f, 18f), StationColor);
        CreateStationPart(group, "Station_Right_Pylon", origin + new Vector3(70f, 0f, 0f), new Vector3(12f, 80f, 18f), StationColor);
        CreateStationPart(group, "Station_Dock_Frame_Top", origin + new Vector3(0f, 46f, -30f), new Vector3(100f, 8f, 8f), GateColor);
        CreateStationPart(group, "Station_Dock_Frame_Bottom", origin + new Vector3(0f, -46f, -30f), new Vector3(100f, 8f, 8f), GateColor);
        CreateStationPart(group, "Station_Dock_Frame_Left", origin + new Vector3(-54f, 0f, -30f), new Vector3(8f, 92f, 8f), GateColor);
        CreateStationPart(group, "Station_Dock_Frame_Right", origin + new Vector3(54f, 0f, -30f), new Vector3(8f, 92f, 8f), GateColor);
        if (ShouldCreateEnvironmentLabel(PrototypeEnvironmentPointKind.Station, 0))
        {
            CreateLabel("Label_Station", "STATION / HANGAR", origin + new Vector3(0f, 74f, -30f), StationColor, group, 7f);
        }
        AddPoint("Station / Hangar", PrototypeEnvironmentPointKind.Station, origin, StationColor, 70f);
    }

    private void BuildAsteroidField()
    {
        Transform group = CreateGroup("Asteroid_Field_Visual");
        Vector3 fieldCenter = new Vector3(-380f, 20f, 520f);
        Vector3[] offsets =
        {
            new Vector3(-80f, -10f, -50f),
            new Vector3(-42f, 25f, 16f),
            new Vector3(0f, -30f, 74f),
            new Vector3(58f, 16f, -20f),
            new Vector3(96f, 42f, 48f),
            new Vector3(-118f, 56f, 92f),
            new Vector3(24f, 68f, -98f),
            new Vector3(130f, -22f, -76f),
            new Vector3(-22f, 4f, -138f)
        };

        for (int i = 0; i < offsets.Length; i++)
        {
            Vector3 position = fieldCenter + offsets[i];
            float scale = 12f + (i % 4) * 5f;
            GameObject asteroid = CreatePrimitive("Asteroid_Visual_" + (i + 1), PrimitiveType.Sphere, position, new Vector3(scale * 1.3f, scale * 0.8f, scale), group);
            asteroid.transform.rotation = Quaternion.Euler(i * 19f, i * 37f, i * 11f);
            ApplyMaterial(asteroid, Color.Lerp(ObstacleColor, Color.white, (i % 3) * 0.08f), false);
            RemoveCollider(asteroid);
            AddPoint("Asteroid " + (i + 1), PrototypeEnvironmentPointKind.Obstacle, position, ObstacleColor, scale);
        }

        if (ShouldCreateEnvironmentLabel(PrototypeEnvironmentPointKind.Obstacle, 0))
        {
            CreateLabel("Label_Asteroid_Field", "VISUAL OBSTACLE FIELD", fieldCenter + new Vector3(0f, 120f, 0f), ObstacleColor, group, 7f);
        }
    }

    private void CreateTarget(Transform group, string label, Vector3 position, Vector3 scale, Color color, int labelIndex)
    {
        GameObject target = CreatePrimitive(label, PrimitiveType.Cube, position, scale, group);
        target.transform.LookAt(Vector3.zero);
        ApplyMaterial(target, color, true);

        Collider collider = target.GetComponent<Collider>();
        if (collider != null)
        {
            collider.isTrigger = false;
        }

        if (target.GetComponent<PrototypeTargetDummy>() == null)
        {
            target.AddComponent<PrototypeTargetDummy>();
        }

        if (ShouldCreateEnvironmentLabel(PrototypeEnvironmentPointKind.Target, labelIndex))
        {
            CreateLabel("Label_" + label.Replace(" ", "_"), label, position + Vector3.up * (scale.y + 10f), color, group, 4.5f);
        }

        AddPoint(label, PrototypeEnvironmentPointKind.Target, position, color, Mathf.Max(scale.x, scale.y));
    }

    private void CreateBeacon(Transform group, string label, Vector3 position, Color color, int labelIndex)
    {
        GameObject beacon = CreatePrimitive(label, PrimitiveType.Sphere, position, Vector3.one * 15f, group);
        ApplyMaterial(beacon, color, true);
        RemoveCollider(beacon);

        GameObject mast = CreatePrimitive(label + "_Mast", PrimitiveType.Cylinder, position + Vector3.down * 20f, new Vector3(4f, 20f, 4f), group);
        ApplyMaterial(mast, color * 0.72f, true);
        RemoveCollider(mast);

        if (ShouldCreateEnvironmentLabel(PrototypeEnvironmentPointKind.Beacon, labelIndex))
        {
            CreateLabel("Label_" + label.Replace(" ", "_"), label, position + Vector3.up * 22f, color, group, 4.5f);
        }

        AddPoint(label, PrototypeEnvironmentPointKind.Beacon, position, color, 16f);
    }

    private bool ShouldRenderRangeRing(int index)
    {
        if (environmentDisplayMode == PrototypeEnvironmentDisplayMode.FullDebug)
        {
            return true;
        }

        if (environmentDisplayMode == PrototypeEnvironmentDisplayMode.Training)
        {
            return index < 2;
        }

        return index < 1;
    }

    private bool ShouldRenderApproachGate(int index)
    {
        if (environmentDisplayMode == PrototypeEnvironmentDisplayMode.FullDebug)
        {
            return true;
        }

        if (environmentDisplayMode == PrototypeEnvironmentDisplayMode.Training)
        {
            return index < 2;
        }

        return false;
    }

    private bool ShouldCreateEnvironmentLabel(PrototypeEnvironmentPointKind kind, int orderIndex)
    {
        if (environmentDisplayMode == PrototypeEnvironmentDisplayMode.FullDebug)
        {
            return true;
        }

        if (environmentDisplayMode == PrototypeEnvironmentDisplayMode.Training)
        {
            if (kind == PrototypeEnvironmentPointKind.Origin || kind == PrototypeEnvironmentPointKind.Station)
            {
                return true;
            }

            if (kind == PrototypeEnvironmentPointKind.Target)
            {
                return orderIndex < 1;
            }

            if (kind == PrototypeEnvironmentPointKind.Beacon)
            {
                return orderIndex < 1;
            }
        }

        return false;
    }

    private void CreateStationPart(Transform parent, string name, Vector3 position, Vector3 scale, Color color)
    {
        GameObject part = CreatePrimitive(name, PrimitiveType.Cube, position, scale, parent);
        ApplyMaterial(part, color, false);
        RemoveCollider(part);
    }

    private Transform CreateGroup(string name)
    {
        Transform group = root.Find(name);
        if (group != null)
        {
            return group;
        }

        GameObject groupObject = new GameObject(name);
        groupObject.transform.SetParent(root, false);
        return groupObject.transform;
    }

    private GameObject CreatePrimitive(string name, PrimitiveType type, Vector3 position, Vector3 scale, Transform parent)
    {
        GameObject go = GameObject.CreatePrimitive(type);
        go.name = name;
        go.transform.SetParent(parent, true);
        go.transform.position = position;
        go.transform.localScale = scale;
        return go;
    }

    private void CreateRing(string name, Transform parent, float radius, Vector3 center, RingPlane plane, Color color, float width)
    {
        const int segments = 96;
        GameObject ring = new GameObject(name);
        ring.transform.SetParent(parent, false);
        LineRenderer line = ring.AddComponent<LineRenderer>();
        float scaledWidth = ScaleEnvironmentLineWidth(width);
        line.useWorldSpace = false;
        line.loop = true;
        line.positionCount = segments;
        line.startWidth = scaledWidth;
        line.endWidth = scaledWidth;
        line.startColor = color;
        line.endColor = color;
        line.material = CreateMaterial(color, true);

        for (int i = 0; i < segments; i++)
        {
            float angle = (Mathf.PI * 2f * i) / segments;
            Vector3 offset;
            if (plane == RingPlane.XY)
            {
                offset = new Vector3(Mathf.Cos(angle) * radius, Mathf.Sin(angle) * radius, 0f);
            }
            else
            {
                offset = new Vector3(Mathf.Cos(angle) * radius, 0f, Mathf.Sin(angle) * radius);
            }

            line.SetPosition(i, center + offset);
        }
    }

    private void CreateLine(string name, Transform parent, Color color, float width, params Vector3[] positions)
    {
        GameObject lineObject = new GameObject(name);
        lineObject.transform.SetParent(parent, false);
        LineRenderer line = lineObject.AddComponent<LineRenderer>();
        float scaledWidth = ScaleEnvironmentLineWidth(width);
        line.useWorldSpace = false;
        line.positionCount = positions.Length;
        line.startWidth = scaledWidth;
        line.endWidth = scaledWidth;
        line.startColor = color;
        line.endColor = color;
        line.material = CreateMaterial(color, true);
        line.SetPositions(positions);
    }

    private float ScaleEnvironmentLineWidth(float width)
    {
        if (environmentDisplayMode == PrototypeEnvironmentDisplayMode.FullDebug)
        {
            return width;
        }

        float scale = environmentDisplayMode == PrototypeEnvironmentDisplayMode.Training ? 0.22f : 0.12f;
        return Mathf.Max(0.05f, width * scale);
    }

    private void CreateLabel(string name, string text, Vector3 position, Color color, Transform parent, float characterSize)
    {
        GameObject label = new GameObject(name);
        label.transform.SetParent(parent, true);
        label.transform.position = position;
        label.transform.rotation = Quaternion.Euler(62f, 0f, 0f);

        TextMesh mesh = label.AddComponent<TextMesh>();
        mesh.text = text;
        mesh.anchor = TextAnchor.MiddleCenter;
        mesh.alignment = TextAlignment.Center;
        mesh.fontSize = 32;
        float modeScale = environmentDisplayMode == PrototypeEnvironmentDisplayMode.FullDebug ? 0.35f : 0.09f;
        float maxSize = environmentDisplayMode == PrototypeEnvironmentDisplayMode.FullDebug ? 3.5f : 0.75f;
        mesh.characterSize = Mathf.Clamp(characterSize * modeScale, 0.12f, maxSize);
        mesh.color = color;
    }

    private void AddPoint(string label, PrototypeEnvironmentPointKind kind, Vector3 position, Color color, float radius = 0f)
    {
        points.Add(new PrototypeEnvironmentPoint(label, kind, position, color, radius));
    }

    private static void ApplyReadableLighting()
    {
        RenderSettings.ambientLight = new Color(0.14f, 0.16f, 0.22f, 1f);
        RenderSettings.fog = true;
        RenderSettings.fogColor = new Color(0.01f, 0.015f, 0.028f, 1f);
        RenderSettings.fogDensity = 0.00025f;
    }

    private static void ApplyMaterial(GameObject go, Color color, bool emissive)
    {
        Renderer renderer = go != null ? go.GetComponent<Renderer>() : null;
        if (renderer == null)
        {
            return;
        }

        Material material = CreateMaterial(color, emissive);
        if (Application.isPlaying)
        {
            renderer.material = material;
        }
        else
        {
            renderer.sharedMaterial = material;
        }
    }

    private static Material CreateMaterial(Color color, bool emissive)
    {
        Shader shader = Shader.Find("Universal Render Pipeline/Unlit");
        if (shader == null)
        {
            shader = Shader.Find("Unlit/Color");
        }

        if (shader == null)
        {
            shader = Shader.Find("Standard");
        }

        Material material = new Material(shader);
        material.color = color;
        if (material.HasProperty("_BaseColor"))
        {
            material.SetColor("_BaseColor", color);
        }

        if (emissive && material.HasProperty("_EmissionColor"))
        {
            material.EnableKeyword("_EMISSION");
            material.SetColor("_EmissionColor", color * 2.2f);
        }

        return material;
    }

    private static void RemoveCollider(GameObject target)
    {
        Collider collider = target != null ? target.GetComponent<Collider>() : null;
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

    private static void DestroyObject(GameObject target)
    {
        if (target == null)
        {
            return;
        }

        if (Application.isPlaying)
        {
            target.name = target.name + "_Clearing";
            Destroy(target);
        }
        else
        {
            DestroyImmediate(target);
        }
    }

    private enum RingPlane
    {
        XZ,
        XY
    }
}
