using UnityEngine;

[DisallowMultipleComponent]
public class PrototypeNavigationObstacle : MonoBehaviour
{
    [SerializeField] private string displayName = "Navigation Obstacle";
    [SerializeField] private float radius = 10f;
    [SerializeField] private float clearanceMeters = 8f;
    [SerializeField] private bool blocksAutopilot = true;
    [SerializeField] private bool showDebugGizmo = true;
    [SerializeField] private Color debugColor = new Color(1f, 0.55f, 0.18f, 0.7f);

    public string DisplayName => string.IsNullOrWhiteSpace(displayName) ? name : displayName;
    public float Radius => Mathf.Max(0.1f, radius);
    public float ClearanceMeters => Mathf.Max(0f, clearanceMeters);
    public Vector3 WorldPosition => transform.position;
    public float EffectiveClearanceRadius => GetEffectiveRadius() + ClearanceMeters;
    public bool BlocksAutopilot => blocksAutopilot;
    public bool ShowDebugGizmo => showDebugGizmo;
    public Color DebugColor => debugColor;

    public float AvoidanceRadiusMeters => Radius;
    public Vector3 Position => transform.position;

    public Bounds WorldBounds
    {
        get
        {
            if (TryGetComponent(out Collider obstacleCollider))
            {
                return obstacleCollider.bounds;
            }

            if (TryGetComponent(out Renderer renderer))
            {
                return renderer.bounds;
            }

            return new Bounds(transform.position, Vector3.one * Radius * 2f);
        }
    }

    public float GetEffectiveRadius()
    {
        Bounds bounds = WorldBounds;
        float boundsRadius = bounds.extents.magnitude;
        return Mathf.Max(Radius, boundsRadius);
    }

    public void Configure(float radiusMeters)
    {
        radius = Mathf.Max(0.1f, radiusMeters);
    }

    public void Configure(float radiusMeters, float clearanceMeters, bool blocksAutopilot = true)
    {
        radius = Mathf.Max(0.1f, radiusMeters);
        this.clearanceMeters = Mathf.Max(0f, clearanceMeters);
        this.blocksAutopilot = blocksAutopilot;
    }

    public void SetDebugGizmoVisible(bool visible)
    {
        showDebugGizmo = visible;
    }

    private void OnValidate()
    {
        radius = Mathf.Max(0.1f, radius);
        clearanceMeters = Mathf.Max(0f, clearanceMeters);
        if (string.IsNullOrWhiteSpace(displayName))
        {
            displayName = name;
        }
    }

    private void OnDrawGizmosSelected()
    {
        if (!showDebugGizmo)
        {
            return;
        }

        Color previousColor = Gizmos.color;
        Color radiusColor = debugColor;
        radiusColor.a = Mathf.Clamp01(radiusColor.a);
        Gizmos.color = radiusColor;
        Gizmos.DrawWireSphere(WorldPosition, Radius);

        Color clearanceColor = debugColor;
        clearanceColor.a = Mathf.Clamp01(debugColor.a * 0.45f);
        Gizmos.color = clearanceColor;
        Gizmos.DrawWireSphere(WorldPosition, EffectiveClearanceRadius);
        Gizmos.color = previousColor;
    }
}
