using System.Collections.Generic;
using UnityEngine;

[DisallowMultipleComponent]
public class PrototypeWaypointManager : MonoBehaviour
{
    [SerializeField] private bool createDefaultWaypoints = true;
    [SerializeField] private Transform waypointRoot;
    [SerializeField] private int selectedIndex;
    [SerializeField] private float defaultArrivalRadius = 10f;

    private readonly List<PrototypeNavigationTarget> navigationTargets = new List<PrototypeNavigationTarget>();

    private static readonly Vector3[] DefaultWaypointPositions =
    {
        new Vector3(0f, 0.5f, 1000f),
        new Vector3(360f, 160f, 1900f),
        new Vector3(-520f, -120f, 3000f)
    };

    private static readonly Color[] DefaultWaypointColors =
    {
        new Color(1f, 0.72f, 0.18f, 1f),
        new Color(0.28f, 0.9f, 1f, 1f),
        new Color(0.62f, 1f, 0.36f, 1f)
    };

    public PrototypeNavigationTarget[] NavigationTargets => navigationTargets.ToArray();
    public int TargetCount => navigationTargets.Count;
    public int SelectedIndex => TargetCount > 0 ? Mathf.Clamp(selectedIndex, 0, TargetCount - 1) : -1;
    public PrototypeNavigationTarget SelectedTarget => SelectedIndex >= 0 ? navigationTargets[SelectedIndex] : null;

    private void Awake()
    {
        RefreshTargets();
        if (createDefaultWaypoints)
        {
            EnsureDefaultWaypoints();
        }
    }

    public void EnsureDefaultWaypoints()
    {
        EnsureRoot();
        RefreshTargets();

        for (int i = 0; i < DefaultWaypointPositions.Length; i++)
        {
            string targetName = $"Nav Waypoint {i + 1}";
            PrototypeNavigationTarget target = FindTargetByName(targetName);
            if (target == null)
            {
                GameObject waypoint = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                waypoint.name = targetName;
                waypoint.transform.SetParent(waypointRoot, false);
                waypoint.transform.position = DefaultWaypointPositions[i];
                waypoint.transform.localScale = Vector3.one * 18f;
                RemoveCollider(waypoint);
                ApplyMaterialColor(waypoint, DefaultWaypointColors[i % DefaultWaypointColors.Length], true);
                target = waypoint.AddComponent<PrototypeNavigationTarget>();
            }

            target.Configure(targetName, defaultArrivalRadius);
        }

        RefreshTargets();
    }

    public void RefreshTargets()
    {
        navigationTargets.Clear();
        PrototypeNavigationTarget[] targets = Object.FindObjectsByType<PrototypeNavigationTarget>(FindObjectsInactive.Exclude);
        for (int i = 0; i < targets.Length; i++)
        {
            if (targets[i] != null && targets[i].isActiveAndEnabled)
            {
                navigationTargets.Add(targets[i]);
            }
        }

        selectedIndex = TargetCount > 0 ? Mathf.Clamp(selectedIndex, 0, TargetCount - 1) : 0;
    }

    public PrototypeNavigationTarget SelectNextTarget()
    {
        RefreshTargets();
        if (TargetCount == 0)
        {
            return null;
        }

        selectedIndex = (SelectedIndex + 1) % TargetCount;
        return SelectedTarget;
    }

    public PrototypeNavigationTarget SelectPreviousTarget()
    {
        RefreshTargets();
        if (TargetCount == 0)
        {
            return null;
        }

        selectedIndex = (SelectedIndex + TargetCount - 1) % TargetCount;
        return SelectedTarget;
    }

    public PrototypeNavigationTarget SelectTarget(PrototypeNavigationTarget target)
    {
        RefreshTargets();
        int index = navigationTargets.IndexOf(target);
        if (index >= 0)
        {
            selectedIndex = index;
        }

        return SelectedTarget;
    }

    private void EnsureRoot()
    {
        if (waypointRoot != null)
        {
            return;
        }

        GameObject root = GameObject.Find("PrototypeNavigationWaypoints");
        if (root == null)
        {
            root = new GameObject("PrototypeNavigationWaypoints");
        }

        waypointRoot = root.transform;
    }

    private PrototypeNavigationTarget FindTargetByName(string targetName)
    {
        for (int i = 0; i < navigationTargets.Count; i++)
        {
            if (navigationTargets[i] != null && navigationTargets[i].DisplayName == targetName)
            {
                return navigationTargets[i];
            }
        }

        return null;
    }

    private static void ApplyMaterialColor(GameObject go, Color color, bool emissive)
    {
        Renderer renderer = go != null ? go.GetComponent<Renderer>() : null;
        if (renderer == null)
        {
            return;
        }

        Material material = Application.isPlaying ? renderer.material : renderer.sharedMaterial;
        if (material == null || (!Application.isPlaying && material.name == "Default-Material"))
        {
            Shader shader = Shader.Find("Universal Render Pipeline/Lit");
            material = new Material(shader == null ? Shader.Find("Standard") : shader);
            if (Application.isPlaying)
            {
                renderer.material = material;
            }
            else
            {
                renderer.sharedMaterial = material;
            }
        }

        material.color = color;
        if (emissive && material.HasProperty("_EmissionColor"))
        {
            material.EnableKeyword("_EMISSION");
            material.SetColor("_EmissionColor", color * 2.2f);
        }
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
}
