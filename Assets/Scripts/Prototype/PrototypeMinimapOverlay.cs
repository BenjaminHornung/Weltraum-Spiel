using System.Collections.Generic;
using UnityEngine;

public class PrototypeMinimapOverlay : MonoBehaviour
{
    private static readonly float[] ZoomLevels = { 250f, 500f, 1000f, 2500f };

    [SerializeField] private Transform target;
    [SerializeField] private Rigidbody targetRigidbody;
    [SerializeField] private PrototypeTestEnvironment environment;
    [SerializeField] private PrototypeWaypointAutopilot navigationAutopilot;
    [SerializeField] private PrototypeTrajectoryPreviewNavMap trajectoryPreview;
    [SerializeField] private bool showLabels;
    [SerializeField] private bool showTargets = true;
    [SerializeField] private bool showBeacons = true;
    [SerializeField] private bool showGates = true;
    [SerializeField] private bool showStation = true;
    [SerializeField] private bool showObstacles = true;
    [SerializeField] private int zoomIndex = 2;

    private const int MaxRelevantMapLabels = 3;
    private GUIStyle labelStyle;
    private GUIStyle smallLabelStyle;
    private PrototypeUiWindowState windowState;
    private readonly HashSet<PrototypeEnvironmentPoint> labeledPoints = new HashSet<PrototypeEnvironmentPoint>();

    public bool IsWindowVisible => ResolveWindowState().Visible;
    public Transform Target => target;
    public PrototypeTestEnvironment Environment => environment;
    public PrototypeWaypointAutopilot NavigationAutopilot => navigationAutopilot;
    public PrototypeTrajectoryPreviewNavMap TrajectoryPreview => trajectoryPreview;
    public bool ShowLabels => showLabels;
    public float CurrentZoomMeters => ZoomLevels[Mathf.Clamp(zoomIndex, 0, ZoomLevels.Length - 1)];
    public bool LastRouteUsedAvoidance { get; private set; }
    public PrototypeTrajectoryPreviewStatus LastTrajectoryPreviewStatus { get; private set; } = PrototypeTrajectoryPreviewStatus.Disabled;

    private void Start()
    {
        ResolveReferences();
    }

    private void OnValidate()
    {
        zoomIndex = Mathf.Clamp(zoomIndex, 0, ZoomLevels.Length - 1);
    }

    private void OnGUI()
    {
        ResolveReferences();
        ResolveWindowState();
        if (!windowState.Visible)
        {
            return;
        }

        EnsureStyles();
        windowState.SetSize(320f, windowState.Collapsed ? 58f : 384f);
        windowState.Rect = GUI.Window(windowState.WindowId, windowState.Rect, DrawWindow, "Minimap / Radar");
        windowState.ClampToScreen();
        windowState.SaveToPrefs();
    }

    public void Bind(Transform trackTarget, Rigidbody body, PrototypeTestEnvironment sourceEnvironment)
    {
        target = trackTarget;
        targetRigidbody = body != null ? body : (trackTarget != null ? trackTarget.GetComponent<Rigidbody>() : null);
        environment = sourceEnvironment != null ? sourceEnvironment : environment;
        navigationAutopilot = trackTarget != null ? trackTarget.GetComponent<PrototypeWaypointAutopilot>() : navigationAutopilot;
        trajectoryPreview = trackTarget != null ? trackTarget.GetComponent<PrototypeTrajectoryPreviewNavMap>() : trajectoryPreview;
        ResolveReferences();
    }

    public void BindNavigationAutopilot(PrototypeWaypointAutopilot autopilot)
    {
        navigationAutopilot = autopilot;
    }

    public void BindTrajectoryPreview(PrototypeTrajectoryPreviewNavMap preview)
    {
        trajectoryPreview = preview != null ? preview : trajectoryPreview;
    }

    public void SetTrajectoryPreviewVisible(bool visible)
    {
        if (trajectoryPreview != null)
        {
            trajectoryPreview.SetPreviewEnabled(visible);
        }
    }

    public void SetWindowVisible(bool visible)
    {
        ResolveWindowState().Visible = visible;
    }

    public void SetWindowCollapsed(bool collapsed)
    {
        ResolveWindowState().Collapsed = collapsed;
    }

    public void SetLabelsVisible(bool visible)
    {
        showLabels = visible;
    }

    public void SetZoomIndex(int index)
    {
        zoomIndex = Mathf.Clamp(index, 0, ZoomLevels.Length - 1);
    }

    private PrototypeUiWindowState ResolveWindowState()
    {
        if (windowState == null)
        {
            Rect defaultRect = new Rect(Mathf.Max(16f, Screen.width - 344f), 16f, 320f, 384f);
            windowState = PrototypeUiLayoutManager.GetWindow(
                PrototypeUiLayoutManager.MinimapWindowId,
                defaultRect,
                true,
                false);
        }

        return windowState;
    }

    private void ResolveReferences()
    {
        if (target != null && targetRigidbody == null)
        {
            targetRigidbody = target.GetComponent<Rigidbody>();
        }

        if (target != null && navigationAutopilot == null)
        {
            navigationAutopilot = target.GetComponent<PrototypeWaypointAutopilot>();
        }

        if (target != null && trajectoryPreview == null)
        {
            trajectoryPreview = target.GetComponent<PrototypeTrajectoryPreviewNavMap>();
        }

        if (environment == null)
        {
            environment = FindAnyObjectByType<PrototypeTestEnvironment>();
        }
    }

    private void EnsureStyles()
    {
        if (labelStyle != null)
        {
            return;
        }

        labelStyle = new GUIStyle(GUI.skin.label)
        {
            fontSize = 13,
            alignment = TextAnchor.MiddleLeft
        };
        labelStyle.normal.textColor = Color.white;

        smallLabelStyle = new GUIStyle(GUI.skin.label)
        {
            fontSize = 10,
            alignment = TextAnchor.MiddleCenter,
            clipping = TextClipping.Clip
        };
        smallLabelStyle.normal.textColor = Color.white;
    }

    private void DrawWindow(int id)
    {
        GUILayout.BeginVertical();
        GUILayout.BeginHorizontal();
        if (GUILayout.Button(windowState.Collapsed ? "Open" : "Collapse", GUILayout.Width(76f)))
        {
            windowState.Collapsed = !windowState.Collapsed;
        }

        GUILayout.Label("F5 toggles minimap", labelStyle);
        GUILayout.EndHorizontal();

        if (!windowState.Collapsed)
        {
            DrawControls();
            Rect mapRect = GUILayoutUtility.GetRect(288f, 288f, GUILayout.ExpandWidth(true));
            DrawMap(mapRect);
        }

        GUILayout.EndVertical();
        GUI.DragWindow(new Rect(0f, 0f, 10000f, 24f));
    }

    private void DrawControls()
    {
        GUILayout.BeginHorizontal();
        GUI.enabled = zoomIndex > 0;
        if (GUILayout.Button("-", GUILayout.Width(32f)))
        {
            zoomIndex--;
        }

        GUI.enabled = zoomIndex < ZoomLevels.Length - 1;
        if (GUILayout.Button("+", GUILayout.Width(32f)))
        {
            zoomIndex++;
        }

        GUI.enabled = true;
        GUILayout.Label("Range " + Mathf.RoundToInt(CurrentZoomMeters) + " m", labelStyle, GUILayout.Width(118f));
        showLabels = GUILayout.Toggle(showLabels, "Labels");
        GUILayout.EndHorizontal();

        GUILayout.BeginHorizontal();
        showTargets = GUILayout.Toggle(showTargets, "Targets");
        showBeacons = GUILayout.Toggle(showBeacons, "Beacons");
        showGates = GUILayout.Toggle(showGates, "Gates");
        GUILayout.EndHorizontal();

        GUILayout.BeginHorizontal();
        showStation = GUILayout.Toggle(showStation, "Station");
        showObstacles = GUILayout.Toggle(showObstacles, "Obstacles");
        GUILayout.EndHorizontal();

        if (trajectoryPreview != null)
        {
            GUILayout.BeginHorizontal();
            bool nextPreview = GUILayout.Toggle(trajectoryPreview.PreviewEnabled, "Trajectory");
            if (nextPreview != trajectoryPreview.PreviewEnabled)
            {
                trajectoryPreview.SetPreviewEnabled(nextPreview);
            }

            GUILayout.Label(trajectoryPreview.LastSnapshot.StatusLabel, smallLabelStyle);
            GUILayout.EndHorizontal();
        }
    }

    private bool ShouldRenderPoint(PrototypeEnvironmentPointKind kind)
    {
        switch (kind)
        {
            case PrototypeEnvironmentPointKind.Target:
                return showTargets;
            case PrototypeEnvironmentPointKind.Beacon:
                return showBeacons;
            case PrototypeEnvironmentPointKind.Gate:
                return showGates;
            case PrototypeEnvironmentPointKind.Station:
                return showStation;
            case PrototypeEnvironmentPointKind.Obstacle:
                return showObstacles;
            default:
                return true;
        }
    }

    private void DrawMap(Rect mapRect)
    {
        HandleMouseWheel(mapRect);

        Color oldColor = GUI.color;
        GUI.color = new Color(0.015f, 0.022f, 0.04f, 0.92f);
        GUI.DrawTexture(mapRect, Texture2D.whiteTexture);
        GUI.color = oldColor;

        Vector2 center = mapRect.center;
        float radius = Mathf.Min(mapRect.width, mapRect.height) * 0.46f;
        DrawCircle(center, radius, new Color(0.3f, 0.62f, 1f, 0.95f), 1.2f);
        DrawRangeRings(center, radius);
        DrawEnvironmentPoints(mapRect, center, radius);
        DrawNavigationRoute(mapRect, center, radius);
        DrawTrajectoryPreview(mapRect, center, radius);
        DrawShip(center, radius);

        GUI.Label(new Rect(mapRect.x + 8f, mapRect.yMax - 22f, mapRect.width - 16f, 18f), "XZ radar centered on ship", smallLabelStyle);
    }

    private void HandleMouseWheel(Rect mapRect)
    {
        Event current = Event.current;
        if (current == null || current.type != EventType.ScrollWheel || !mapRect.Contains(current.mousePosition))
        {
            return;
        }

        if (current.delta.y > 0f)
        {
            zoomIndex = Mathf.Min(ZoomLevels.Length - 1, zoomIndex + 1);
        }
        else if (current.delta.y < 0f)
        {
            zoomIndex = Mathf.Max(0, zoomIndex - 1);
        }

        current.Use();
    }

    private void DrawRangeRings(Vector2 center, float radius)
    {
        Color ringColor = new Color(0.22f, 0.5f, 0.82f, 0.72f);
        DrawCircle(center, radius * 0.25f, ringColor, 0.8f);
        DrawCircle(center, radius * 0.5f, ringColor, 0.8f);
        DrawCircle(center, radius * 0.75f, ringColor, 0.8f);
        DrawLine(center + Vector2.left * radius, center + Vector2.right * radius, ringColor, 0.7f);
        DrawLine(center + Vector2.up * radius, center + Vector2.down * radius, ringColor, 0.7f);

        smallLabelStyle.normal.textColor = ringColor;
        GUI.Label(new Rect(center.x + radius * 0.52f, center.y - 12f, 72f, 18f), Mathf.RoundToInt(CurrentZoomMeters * 0.5f) + "m", smallLabelStyle);
        GUI.Label(new Rect(center.x + radius - 70f, center.y - 12f, 68f, 18f), Mathf.RoundToInt(CurrentZoomMeters) + "m", smallLabelStyle);
        smallLabelStyle.normal.textColor = Color.white;
    }

    private void DrawEnvironmentPoints(Rect mapRect, Vector2 center, float radius)
    {
        IReadOnlyList<PrototypeEnvironmentPoint> sourcePoints = environment != null ? environment.Points : null;
        if (sourcePoints == null)
        {
            return;
        }

        PrepareLabelSet(sourcePoints);

        for (int i = 0; i < sourcePoints.Count; i++)
        {
            PrototypeEnvironmentPoint point = sourcePoints[i];
            if (point == null || point.Kind == PrototypeEnvironmentPointKind.RangeRing || point.Kind == PrototypeEnvironmentPointKind.Axis)
            {
                continue;
            }

            Vector2 position = WorldToMap(point.Position, center, radius);
            if (!mapRect.Contains(position))
            {
                continue;
            }

            if (!ShouldRenderPoint(point.Kind))
            {
                continue;
            }

            DrawBlip(position, point);
        }
    }

    private void DrawNavigationRoute(Rect mapRect, Vector2 center, float radius)
    {
        LastRouteUsedAvoidance = false;
        if (target == null || navigationAutopilot == null || navigationAutopilot.CurrentTarget == null)
        {
            return;
        }

        Vector2 shipPoint = center;
        Vector2 targetPoint = WorldToMap(navigationAutopilot.CurrentTarget.Position, center, radius);
        PrototypeTrajectoryPlan plan = navigationAutopilot.CurrentPlan;
        Color routeColor = plan.directPathBlocked
            ? new Color(1f, 0.42f, 0.25f, 0.9f)
            : new Color(0.25f, 0.9f, 1f, 0.88f);

        DrawClippedRouteSegment(mapRect, shipPoint, targetPoint, routeColor);
        DrawObstacleClearance(mapRect, center, radius, plan);

        Vector3[] predictedRoute = navigationAutopilot.PredictedRoute;
        if (predictedRoute.Length > 1)
        {
            DrawPredictedRoute(mapRect, center, radius, predictedRoute);
        }

        if (plan.avoidanceActive)
        {
            Vector2 avoidancePoint = WorldToMap(navigationAutopilot.AvoidanceWaypoint, center, radius);
            DrawClippedRouteSegment(mapRect, shipPoint, avoidancePoint, new Color(1f, 0.85f, 0.2f, 0.95f));
            DrawClippedRouteSegment(mapRect, avoidancePoint, targetPoint, new Color(0.25f, 0.9f, 1f, 0.88f));
            DrawCircle(avoidancePoint, 5f, new Color(1f, 0.85f, 0.2f, 0.95f), 1.4f);
            LastRouteUsedAvoidance = true;
        }
    }

    private void DrawPredictedRoute(Rect mapRect, Vector2 center, float radius, Vector3[] route)
    {
        DrawPredictedRoute(mapRect, center, radius, route, new Color(0.75f, 1f, 0.45f, 0.82f));
    }

    private void DrawPredictedRoute(Rect mapRect, Vector2 center, float radius, Vector3[] route, Color predictedColor)
    {
        for (int i = 1; i < route.Length; i++)
        {
            Vector2 previous = WorldToMap(route[i - 1], center, radius);
            Vector2 next = WorldToMap(route[i], center, radius);
            DrawClippedRouteSegment(mapRect, previous, next, predictedColor);
        }
    }

    private void DrawTrajectoryPreview(Rect mapRect, Vector2 center, float radius)
    {
        if (trajectoryPreview == null)
        {
            LastTrajectoryPreviewStatus = PrototypeTrajectoryPreviewStatus.Unavailable;
            return;
        }

        PrototypeTrajectoryPreviewSnapshot snapshot = trajectoryPreview.RefreshPreview();
        LastTrajectoryPreviewStatus = snapshot.Status;
        if (!snapshot.HasRenderablePoints)
        {
            return;
        }

        DrawPredictedRoute(mapRect, center, radius, snapshot.Points, new Color(1f, 0.72f, 0.22f, 0.95f));
    }

    private void DrawObstacleClearance(Rect mapRect, Vector2 center, float radius, PrototypeTrajectoryPlan plan)
    {
        PrototypeObstacleDetectionResult detection = navigationAutopilot.LastObstacleDetection;
        if (!detection.hasObstacle || detection.obstacle == null)
        {
            return;
        }

        Vector2 obstaclePoint = WorldToMap(detection.obstacle.WorldPosition, center, radius);
        if (!mapRect.Contains(obstaclePoint))
        {
            return;
        }

        float clearanceRadius = (detection.obstacle.EffectiveClearanceRadius + Mathf.Max(0f, detection.clearanceRadius)) * (radius / CurrentZoomMeters);
        Color clearanceColor = plan.directPathBlocked
            ? new Color(1f, 0.35f, 0.2f, 0.78f)
            : new Color(0.3f, 0.9f, 0.55f, 0.62f);
        DrawCircle(obstaclePoint, Mathf.Clamp(clearanceRadius, 4f, radius), clearanceColor, 1.2f);
    }

    private static void DrawClippedRouteSegment(Rect mapRect, Vector2 start, Vector2 end, Color color)
    {
        if (!mapRect.Contains(start) && !mapRect.Contains(end))
        {
            return;
        }

        DrawLine(start, end, color, 1.4f);
    }

    private void DrawBlip(Vector2 position, PrototypeEnvironmentPoint point)
    {
        float size = point.Kind == PrototypeEnvironmentPointKind.Station ? 8f : 5f;
        Color color = point.Color;
        switch (point.Kind)
        {
            case PrototypeEnvironmentPointKind.Target:
                DrawLine(position + Vector2.left * size, position + Vector2.right * size, color, 2f);
                DrawLine(position + Vector2.up * size, position + Vector2.down * size, color, 2f);
                break;
            case PrototypeEnvironmentPointKind.Beacon:
                DrawLine(position + new Vector2(0f, -size), position + new Vector2(size, 0f), color, 2f);
                DrawLine(position + new Vector2(size, 0f), position + new Vector2(0f, size), color, 2f);
                DrawLine(position + new Vector2(0f, size), position + new Vector2(-size, 0f), color, 2f);
                DrawLine(position + new Vector2(-size, 0f), position + new Vector2(0f, -size), color, 2f);
                break;
            case PrototypeEnvironmentPointKind.Gate:
                DrawCircle(position, size + 2f, color, 1.2f);
                break;
            case PrototypeEnvironmentPointKind.Station:
                FillRect(new Rect(position.x - size, position.y - size, size * 2f, size * 2f), color);
                break;
            case PrototypeEnvironmentPointKind.Obstacle:
                FillRect(new Rect(position.x - 2f, position.y - 2f, 4f, 4f), color);
                break;
            default:
                DrawCircle(position, size + 2f, color, 1.5f);
                break;
        }

        if (showLabels && labeledPoints.Contains(point))
        {
            smallLabelStyle.normal.textColor = color;
            GUI.Label(new Rect(position.x + 6f, position.y - 8f, 136f, 18f), BuildPointLabel(point), smallLabelStyle);
            smallLabelStyle.normal.textColor = Color.white;
        }
    }

    private void PrepareLabelSet(IReadOnlyList<PrototypeEnvironmentPoint> sourcePoints)
    {
        labeledPoints.Clear();
        if (!showLabels || sourcePoints == null)
        {
            return;
        }

        PrototypeEnvironmentPoint[] nearestRelevant = new PrototypeEnvironmentPoint[MaxRelevantMapLabels];
        float[] nearestDistances = new float[MaxRelevantMapLabels];
        for (int i = 0; i < nearestDistances.Length; i++)
        {
            nearestDistances[i] = float.PositiveInfinity;
        }

        Vector3 labelOrigin = target != null ? target.position : Vector3.zero;
        for (int i = 0; i < sourcePoints.Count; i++)
        {
            PrototypeEnvironmentPoint point = sourcePoints[i];
            if (point == null || !ShouldRenderPoint(point.Kind))
            {
                continue;
            }

            if (point.Kind == PrototypeEnvironmentPointKind.Origin || point.Kind == PrototypeEnvironmentPointKind.Station)
            {
                labeledPoints.Add(point);
                continue;
            }

            if (IsRelevantLabelCandidate(point.Kind))
            {
                InsertNearestLabelCandidate(point, Vector3.Distance(labelOrigin, point.Position), nearestRelevant, nearestDistances);
            }
        }

        for (int i = 0; i < nearestRelevant.Length; i++)
        {
            if (nearestRelevant[i] != null)
            {
                labeledPoints.Add(nearestRelevant[i]);
            }
        }
    }

    private static bool IsRelevantLabelCandidate(PrototypeEnvironmentPointKind kind)
    {
        return kind == PrototypeEnvironmentPointKind.Target
            || kind == PrototypeEnvironmentPointKind.Beacon
            || kind == PrototypeEnvironmentPointKind.Gate;
    }

    private static void InsertNearestLabelCandidate(
        PrototypeEnvironmentPoint point,
        float distance,
        PrototypeEnvironmentPoint[] nearestRelevant,
        float[] nearestDistances)
    {
        for (int i = 0; i < nearestRelevant.Length; i++)
        {
            if (distance >= nearestDistances[i])
            {
                continue;
            }

            for (int j = nearestRelevant.Length - 1; j > i; j--)
            {
                nearestRelevant[j] = nearestRelevant[j - 1];
                nearestDistances[j] = nearestDistances[j - 1];
            }

            nearestRelevant[i] = point;
            nearestDistances[i] = distance;
            return;
        }
    }

    private string BuildPointLabel(PrototypeEnvironmentPoint point)
    {
        if (target == null || point == null)
        {
            return point != null ? point.Label : string.Empty;
        }

        float distance = Vector3.Distance(target.position, point.Position);
        if (distance >= 1000f)
        {
            return point.Label + " " + (distance / 1000f).ToString("0.0") + "km";
        }

        return point.Label + " " + distance.ToString("0") + "m";
    }

    private void DrawShip(Vector2 center, float radius)
    {
        Vector2 heading = Vector2.up;
        Vector2 right = Vector2.right;
        if (target != null)
        {
            Vector2 flatForward = new Vector2(target.forward.x, -target.forward.z);
            if (flatForward.sqrMagnitude > 0.0001f)
            {
                heading = flatForward.normalized;
                right = new Vector2(heading.y, -heading.x);
            }
        }

        Vector2 nose = center + heading * 14f;
        Vector2 left = center - heading * 10f - right * 8f;
        Vector2 rightPoint = center - heading * 10f + right * 8f;
        Color shipColor = Color.white;
        DrawLine(nose, left, shipColor, 2f);
        DrawLine(left, rightPoint, shipColor, 2f);
        DrawLine(rightPoint, nose, shipColor, 2f);
        DrawLine(center, center + heading * 30f, new Color(1f, 1f, 1f, 0.65f), 1.1f);

        if (targetRigidbody != null && targetRigidbody.linearVelocity.sqrMagnitude > 0.05f)
        {
            Vector2 velocity = new Vector2(targetRigidbody.linearVelocity.x, -targetRigidbody.linearVelocity.z);
            if (velocity.sqrMagnitude > 0.0001f)
            {
                float length = Mathf.Clamp(velocity.magnitude * 2f, 14f, radius * 0.82f);
                DrawLine(center, center + velocity.normalized * length, Color.green, 1.8f);
                if (showLabels)
                {
                    smallLabelStyle.normal.textColor = Color.green;
                    GUI.Label(new Rect(center.x + velocity.normalized.x * length + 4f, center.y + velocity.normalized.y * length - 8f, 48f, 18f), "VEL", smallLabelStyle);
                    smallLabelStyle.normal.textColor = Color.white;
                }
            }
        }
    }

    private Vector2 WorldToMap(Vector3 worldPosition, Vector2 center, float radius)
    {
        Vector3 origin = target != null ? target.position : Vector3.zero;
        Vector2 delta = new Vector2(worldPosition.x - origin.x, worldPosition.z - origin.z);
        float scale = radius / CurrentZoomMeters;
        return center + new Vector2(delta.x, -delta.y) * scale;
    }

    private static void FillRect(Rect rect, Color color)
    {
        Color oldColor = GUI.color;
        GUI.color = color;
        GUI.DrawTexture(rect, Texture2D.whiteTexture);
        GUI.color = oldColor;
    }

    private static void DrawCircle(Vector2 center, float radius, Color color, float thickness)
    {
        const int segments = 48;
        Vector2 previous = center + new Vector2(radius, 0f);
        for (int i = 1; i <= segments; i++)
        {
            float angle = (Mathf.PI * 2f * i) / segments;
            Vector2 next = center + new Vector2(Mathf.Cos(angle) * radius, Mathf.Sin(angle) * radius);
            DrawLine(previous, next, color, thickness);
            previous = next;
        }
    }

    private static void DrawLine(Vector2 start, Vector2 end, Color color, float thickness)
    {
        Matrix4x4 oldMatrix = GUI.matrix;
        Color oldColor = GUI.color;
        Vector2 delta = end - start;
        float length = delta.magnitude;
        if (length <= 0.001f)
        {
            return;
        }

        float angle = Mathf.Atan2(delta.y, delta.x) * Mathf.Rad2Deg;
        GUI.color = color;
        GUIUtility.RotateAroundPivot(angle, start);
        GUI.DrawTexture(new Rect(start.x, start.y - thickness * 0.5f, length, thickness), Texture2D.whiteTexture);
        GUI.matrix = oldMatrix;
        GUI.color = oldColor;
    }
}
