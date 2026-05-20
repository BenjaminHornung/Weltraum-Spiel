using UnityEngine;

[DisallowMultipleComponent]
public class PrototypeNavigationObstacle : MonoBehaviour
{
    [SerializeField] private string obstacleLabel;
    [SerializeField] private float clearanceRadiusMeters = 6f;
    [SerializeField] private float dangerRadiusMeters = 2f;
    [SerializeField] private bool blocksAutopilotNavigation = true;

    public string Label => string.IsNullOrWhiteSpace(obstacleLabel) ? gameObject.name : obstacleLabel;
    public float ClearanceRadiusMeters => Mathf.Max(0f, clearanceRadiusMeters);
    public float DangerRadiusMeters => Mathf.Max(0f, dangerRadiusMeters);
    public bool BlocksAutopilotNavigation => blocksAutopilotNavigation;

    public void Configure(string label, float clearanceRadius, float dangerRadius, bool blocksNavigation = true)
    {
        obstacleLabel = string.IsNullOrWhiteSpace(label) ? obstacleLabel : label;
        clearanceRadiusMeters = Mathf.Max(0f, clearanceRadius);
        dangerRadiusMeters = Mathf.Max(0f, dangerRadius);
        blocksAutopilotNavigation = blocksNavigation;
    }

    public static bool TryGet(Collider collider, out PrototypeNavigationObstacle obstacle)
    {
        obstacle = collider != null ? collider.GetComponentInParent<PrototypeNavigationObstacle>() : null;
        return obstacle != null && obstacle.BlocksAutopilotNavigation;
    }

    private void OnValidate()
    {
        clearanceRadiusMeters = Mathf.Max(0f, clearanceRadiusMeters);
        dangerRadiusMeters = Mathf.Max(0f, dangerRadiusMeters);
    }
}
