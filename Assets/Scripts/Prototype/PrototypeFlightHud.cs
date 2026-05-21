using UnityEngine;

[RequireComponent(typeof(Camera))]
public class PrototypeFlightHud : MonoBehaviour
{
    public enum HudMode
    {
        World,
        Velocity,
        Target,
        Docking,
        OrbitGravity
    }

    [SerializeField] private ShipStats targetStats;
    [SerializeField] private Rigidbody targetRigidbody;
    [SerializeField] private Transform target;
    [SerializeField] private PlayerShipController shipController;
    [SerializeField] private PrototypeDebugOverlay debugOverlay;
    [SerializeField] private PrototypeWaypointAutopilot waypointAutopilot;
    [SerializeField] private PrototypeMomentumAssist momentumAssist;
    [SerializeField] private Transform trackedTarget;
    private SimpleFollowCamera followCamera;

    [Header("HUD")]
    [SerializeField] private bool showHud = true;
    [SerializeField] private Vector2 navballCenterOffset = new Vector2(0f, -126f);
    [SerializeField] private float navballRadius = 88f;
    [SerializeField] private float markerSize = 10f;
    [SerializeField] private float velocityMarkerThreshold = 0.05f;
    [SerializeField] private HudMode hudMode = HudMode.World;

    [Header("Debug Markers")]
    [SerializeField] private bool showDebugForceMarkers;
    [SerializeField] private float forceMarkerReferenceNewton = 9000f;

    private GUIStyle labelStyle;
    private GUIStyle smallLabelStyle;
    private GUIStyle centeredLabelStyle;
    private GUIStyle compactButtonStyle;
    private PrototypeUiWindowState windowState;

    public Transform Target => target;
    public Rigidbody TargetRigidbody => targetRigidbody;
    public ShipStats TargetStats => targetStats;
    public PlayerShipController ShipController => shipController;
    public Transform TrackedTarget => trackedTarget;
    public bool ShowHud => ResolveWindowState().Visible;
    public bool ShowDebugForceMarkers => showDebugForceMarkers;
    public float NavballRadius => navballRadius;
    public HudMode Mode => hudMode;
    public string LastModeLabel { get; private set; } = "WORLD";
    public string LastModeLabelStructure { get; private set; } = "WORLD | VELOCITY | TARGET | DOCKING | ORBIT/GRAVITY";
    public Vector2 LastForwardMarker { get; private set; }
    public Vector2 LastProgradeMarker { get; private set; }
    public Vector2 LastRetrogradeMarker { get; private set; }
    public Vector2 LastSasMarker { get; private set; }
    public Vector2 LastTargetMarker { get; private set; }
    public Vector2 LastDesiredForceMarker { get; private set; }
    public Vector2 LastActualForceMarker { get; private set; }
    public Vector2 LastResidualForceMarker { get; private set; }
    public bool LastHasVelocityMarker { get; private set; }
    public bool LastHasSasMarker { get; private set; }
    public bool LastHasTargetMarker { get; private set; }
    public bool LastHasDebugForceMarkers { get; private set; }
    public string LastNavigationComputerSummary { get; private set; } = "NavComp: n/a";

    private void Start()
    {
        ResolveReferences();
        RefreshDiagnostics();
    }

    private void OnValidate()
    {
        navballRadius = Mathf.Max(36f, navballRadius);
        markerSize = Mathf.Max(4f, markerSize);
        velocityMarkerThreshold = Mathf.Max(0f, velocityMarkerThreshold);
        forceMarkerReferenceNewton = Mathf.Max(1f, forceMarkerReferenceNewton);
    }

    private void OnGUI()
    {
        ResolveWindowState();
        if (!windowState.Visible)
        {
            return;
        }

        ResolveReferences();
        RefreshDiagnostics();
        EnsureStyles();
        windowState.SetSize(Mathf.Max(300f, (navballRadius * 2f) + 84f), windowState.Collapsed ? 58f : Mathf.Max(322f, (navballRadius * 2f) + 188f));
        windowState.Rect = GUI.Window(windowState.WindowId, windowState.Rect, DrawHudWindow, "HUD / Navball");
        windowState.ClampToScreen();
        windowState.SaveToPrefs();
    }

    public void Bind(Transform trackTarget, ShipStats stats, Rigidbody rb)
    {
        target = trackTarget;
        targetStats = stats != null ? stats : (trackTarget != null ? trackTarget.GetComponent<ShipStats>() : null);
        targetRigidbody = rb != null ? rb : (trackTarget != null ? trackTarget.GetComponent<Rigidbody>() : null);
        shipController = trackTarget != null ? trackTarget.GetComponent<PlayerShipController>() : null;
        debugOverlay = GetComponent<PrototypeDebugOverlay>();
        ResolveTrackedTarget();
        RefreshDiagnostics();
    }

    public void SetTrackedTarget(Transform targetTransform)
    {
        trackedTarget = targetTransform;
        RefreshDiagnostics();
    }

    public void SetHudVisible(bool visible)
    {
        showHud = visible;
        ResolveWindowState().Visible = visible;
    }

    public void SetShowDebugForceMarkers(bool visible)
    {
        showDebugForceMarkers = visible;
    }

    public void SetHudCollapsed(bool collapsed)
    {
        ResolveWindowState().Collapsed = collapsed;
    }

    public void SetMode(HudMode mode)
    {
        hudMode = mode;
        RefreshDiagnostics();
    }

    public void RefreshDiagnosticsForTests()
    {
        ResolveReferences();
        RefreshDiagnostics();
    }

    public Vector2 ProjectWorldDirectionToMarker(Vector3 worldDirection)
    {
        if (target == null || worldDirection.sqrMagnitude <= Mathf.Epsilon)
        {
            return Vector2.zero;
        }

        Vector3 localDirection = target.InverseTransformDirection(worldDirection.normalized);
        Vector2 projected = new Vector2(localDirection.x, -localDirection.y) * navballRadius;
        return Vector2.ClampMagnitude(projected, navballRadius);
    }

    public string BuildModeLabelStructure()
    {
        return "WORLD | VELOCITY | TARGET | DOCKING | ORBIT/GRAVITY";
    }

    private PrototypeUiWindowState ResolveWindowState()
    {
        if (windowState == null)
        {
            Rect defaultRect = new Rect(
                Mathf.Max(16f, (Screen.width - 320f) * 0.5f),
                Mathf.Max(16f, Screen.height - 336f),
                320f,
                320f);
            windowState = PrototypeUiLayoutManager.GetWindow(
                PrototypeUiLayoutManager.HudWindowId,
                defaultRect,
                showHud,
                false);
            showHud = windowState.Visible;
        }

        return windowState;
    }

    private void ResolveReferences()
    {
        if (target != null)
        {
            if (targetStats == null)
            {
                targetStats = target.GetComponent<ShipStats>();
            }

            if (targetRigidbody == null)
            {
                targetRigidbody = target.GetComponent<Rigidbody>();
            }

        if (shipController == null)
        {
            shipController = target.GetComponent<PlayerShipController>();
        }

        if (followCamera == null)
        {
            followCamera = GetComponent<SimpleFollowCamera>();
        }

            if (waypointAutopilot == null)
            {
                waypointAutopilot = target.GetComponent<PrototypeWaypointAutopilot>();
            }

            if (momentumAssist == null)
            {
                momentumAssist = target.GetComponent<PrototypeMomentumAssist>();
            }
        }

        if (debugOverlay == null)
        {
            debugOverlay = GetComponent<PrototypeDebugOverlay>();
        }

        ResolveTrackedTarget();
    }

    private void ResolveTrackedTarget()
    {
        if (trackedTarget != null)
        {
            return;
        }

        if (shipController == null)
        {
            return;
        }

        PrototypeTargetDummy dummy = FindAnyObjectByType<PrototypeTargetDummy>();
        if (dummy != null)
        {
            trackedTarget = dummy.transform;
        }
    }

    private void RefreshDiagnostics()
    {
        LastModeLabelStructure = BuildModeLabelStructure();
        LastForwardMarker = Vector2.zero;
        LastHasVelocityMarker = false;
        LastHasSasMarker = false;
        LastHasTargetMarker = false;
        LastHasDebugForceMarkers = false;
        LastProgradeMarker = Vector2.zero;
        LastRetrogradeMarker = Vector2.zero;
        LastSasMarker = Vector2.zero;
        LastTargetMarker = Vector2.zero;
        LastDesiredForceMarker = Vector2.zero;
        LastActualForceMarker = Vector2.zero;
        LastResidualForceMarker = Vector2.zero;
        LastNavigationComputerSummary = BuildNavigationComputerSummary();

        Vector3 velocity = targetRigidbody != null ? targetRigidbody.linearVelocity : Vector3.zero;
        if (velocity.magnitude > velocityMarkerThreshold)
        {
            LastHasVelocityMarker = true;
            LastProgradeMarker = ProjectWorldDirectionToMarker(velocity);
            LastRetrogradeMarker = ProjectWorldDirectionToMarker(-velocity);
        }

        if (shipController != null && shipController.HasSasTargetRotation)
        {
            LastHasSasMarker = true;
            LastSasMarker = ProjectWorldDirectionToMarker(shipController.SasTargetRotation * Vector3.forward);
        }

        if (target != null && trackedTarget != null)
        {
            Vector3 targetDirection = trackedTarget.position - target.position;
            if (targetDirection.sqrMagnitude > 0.0001f)
            {
                LastHasTargetMarker = true;
                LastTargetMarker = ProjectWorldDirectionToMarker(targetDirection);
            }
        }

        if (ShouldShowDebugForceMarkers())
        {
            LastHasDebugForceMarkers = true;
            LastDesiredForceMarker = ProjectForceVectorToMarker(shipController.LastRcsDesiredForceWorld);
            LastActualForceMarker = ProjectForceVectorToMarker(shipController.LastRcsActualForceWorld);
            LastResidualForceMarker = ProjectForceVectorToMarker(shipController.LastRcsResidualForceWorld);
        }

        LastModeLabel = ResolveActiveModeLabel(velocity);
    }

    private bool ShouldShowDebugForceMarkers()
    {
        if (shipController == null)
        {
            return false;
        }

        bool debugVectorsActive = debugOverlay != null && debugOverlay.DrawDebugVectors;
        return showDebugForceMarkers || debugVectorsActive || shipController.FlightAssistMode == FlightAssistMode.DebugAssist;
    }

    private Vector2 ProjectForceVectorToMarker(Vector3 force)
    {
        if (force.sqrMagnitude <= 0.0001f)
        {
            return Vector2.zero;
        }

        Vector2 marker = ProjectWorldDirectionToMarker(force);
        float magnitudeScale = Mathf.Clamp01(force.magnitude / forceMarkerReferenceNewton);
        return marker * Mathf.Lerp(0.35f, 1f, magnitudeScale);
    }

    private string ResolveActiveModeLabel(Vector3 velocity)
    {
        if (hudMode == HudMode.OrbitGravity || (shipController != null && shipController.GravityEnabled))
        {
            return "ORBIT/GRAVITY";
        }

        if (hudMode == HudMode.Docking)
        {
            return "DOCKING";
        }

        if (hudMode == HudMode.Target || LastHasTargetMarker)
        {
            return "TARGET";
        }

        if (hudMode == HudMode.Velocity || velocity.magnitude > velocityMarkerThreshold)
        {
            return "VELOCITY";
        }

        return "WORLD";
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
            alignment = TextAnchor.UpperLeft
        };
        labelStyle.normal.textColor = Color.white;

        smallLabelStyle = new GUIStyle(GUI.skin.label)
        {
            fontSize = 11,
            alignment = TextAnchor.MiddleCenter
        };
        smallLabelStyle.normal.textColor = Color.white;

        centeredLabelStyle = new GUIStyle(GUI.skin.label)
        {
            fontSize = 12,
            alignment = TextAnchor.MiddleCenter
        };
        centeredLabelStyle.normal.textColor = Color.white;

        compactButtonStyle = new GUIStyle(GUI.skin.button)
        {
            fontSize = 10,
            alignment = TextAnchor.MiddleCenter,
            padding = new RectOffset(4, 4, 2, 2)
        };
    }

    private void DrawHudWindow(int id)
    {
        GUILayout.BeginVertical();
        GUILayout.BeginHorizontal();
        if (GUILayout.Button(windowState.Collapsed ? "Open" : "Collapse", GUILayout.Width(76f)))
        {
            windowState.Collapsed = !windowState.Collapsed;
        }

        GUILayout.Label("F4 toggles HUD/Navball", labelStyle);
        GUILayout.EndHorizontal();

        if (!windowState.Collapsed)
        {
            DrawHud(new Rect(10f, 42f, windowState.Rect.width - 20f, windowState.Rect.height - 52f));
        }

        GUILayout.EndVertical();
        GUI.DragWindow(new Rect(0f, 0f, 10000f, 24f));
    }

    private void DrawHud(Rect contentRect)
    {
        Vector2 center = new Vector2(contentRect.center.x, contentRect.y + navballRadius + 16f);

        DrawCircle(center, navballRadius, new Color(0.65f, 0.85f, 1f, 0.9f), 2f);
        DrawCrosshair(center, navballRadius * 0.18f, Color.white);
        DrawMarker(center, LastForwardMarker, Color.white, "FWD", markerSize);

        if (LastHasVelocityMarker)
        {
            DrawMarker(center, LastProgradeMarker, Color.green, "PRO", markerSize);
            DrawMarker(center, LastRetrogradeMarker, new Color(1f, 0.45f, 0.45f, 1f), "RET", markerSize);
        }

        if (LastHasSasMarker && LastHasDebugForceMarkers)
        {
            DrawMarker(center, LastSasMarker, new Color(1f, 0.9f, 0.25f, 1f), "SAS", markerSize * 0.9f);
        }

        if (LastHasTargetMarker)
        {
            DrawMarker(center, LastTargetMarker, new Color(0.25f, 0.85f, 1f, 1f), "TGT", markerSize * 0.9f);
        }

        if (LastHasDebugForceMarkers)
        {
            DrawMarker(center, LastDesiredForceMarker, new Color(0.35f, 0.75f, 1f, 1f), "DES", markerSize * 0.75f);
            DrawMarker(center, LastActualForceMarker, new Color(0.4f, 1f, 0.55f, 1f), "ACT", markerSize * 0.75f);
            DrawMarker(center, LastResidualForceMarker, new Color(1f, 0.45f, 1f, 1f), "RES", markerSize * 0.75f);
        }

        DrawQuickActions(contentRect);

        Rect hintRect = new Rect(contentRect.x + 8f, contentRect.yMax - 86f, contentRect.width - 16f, 72f);
        string targetLabel = waypointAutopilot != null ? waypointAutopilot.TargetName : (trackedTarget != null ? trackedTarget.name : "none");
        PrototypeFlightControlDiagnostics diagnostics = shipController != null ? shipController.FlightControlDiagnostics : default;
        string cameraLine = followCamera != null
            ? $"Cam: {followCamera.CameraModeName} | dist {followCamera.EffectiveDistance:0.00} ({followCamera.BaseVisualDistance:0.00}) | zoom {followCamera.Zoom:0.00} | bounds {followCamera.BaseVisualBoundsRadius:0.00}"
            : "Cam: unavailable";
        string autopilotLabel = shipController != null
            ? $"{(diagnostics.autopilotEngaged ? "ON" : "OFF")} {diagnostics.autopilotState}"
            : "N/A";
        string sasLabel = shipController != null ? (diagnostics.effectiveSasEnabled ? "SAS Eff On" : "SAS Eff Off") : "SAS n/a";
        string autopilotPhase = waypointAutopilot != null ? waypointAutopilot.ArrivalPhase.ToString() : "n/a";
        string autopilotReason = waypointAutopilot != null && !string.IsNullOrWhiteSpace(waypointAutopilot.ArrivalFailureReason)
            ? $" | {waypointAutopilot.ArrivalFailureReason}"
            : string.Empty;
        GUI.Label(hintRect, $"G Autopilot | Tab/B Target | Caps Mode\n{cameraLine}\nTarget: {targetLabel} | Auto: {autopilotLabel} | phase: {autopilotPhase}{autopilotReason} | {ResolveControlModeHint()} | {sasLabel}\n{LastNavigationComputerSummary}", smallLabelStyle);

        Rect labelRect = new Rect(contentRect.x + 8f, contentRect.yMax - 14f, contentRect.width - 16f, 14f);
        GUI.Label(labelRect, "Mode: " + LastModeLabel, centeredLabelStyle);
    }

    private void DrawCrosshair(Vector2 center, float length, Color color)
    {
        DrawLine(center + Vector2.left * length, center + Vector2.right * length, color, 1.5f);
        DrawLine(center + Vector2.up * length, center + Vector2.down * length, color, 1.5f);
    }

    private void DrawCircle(Vector2 center, float radius, Color color, float thickness)
    {
        const int segments = 64;
        Vector2 previous = center + new Vector2(radius, 0f);
        for (int i = 1; i <= segments; i++)
        {
            float angle = (Mathf.PI * 2f * i) / segments;
            Vector2 next = center + new Vector2(Mathf.Cos(angle) * radius, Mathf.Sin(angle) * radius);
            DrawLine(previous, next, color, thickness);
            previous = next;
        }
    }

    private void DrawMarker(Vector2 center, Vector2 markerOffset, Color color, string label, float size)
    {
        Vector2 position = center + Vector2.ClampMagnitude(markerOffset, navballRadius);
        DrawLine(position + Vector2.left * size, position + Vector2.right * size, color, 2f);
        DrawLine(position + Vector2.up * size, position + Vector2.down * size, color, 2f);
        smallLabelStyle.normal.textColor = color;
        Vector2 labelOffset = MarkerLabelOffset(markerOffset, size, label);
        GUI.Label(new Rect(position.x + labelOffset.x - 26f, position.y + labelOffset.y - 8f, 52f, 18f), label, smallLabelStyle);
        smallLabelStyle.normal.textColor = Color.white;
    }

    private void DrawQuickActions(Rect contentRect)
    {
        if (shipController == null)
        {
            return;
        }

        Rect quickActionRect = new Rect(contentRect.x + 8f, contentRect.y + (navballRadius * 2f) + 26f, contentRect.width - 16f, 50f);
        GUILayout.BeginArea(quickActionRect);
        GUILayout.BeginVertical();
        GUILayout.BeginHorizontal();

        GUI.enabled = waypointAutopilot != null;
        if (GUILayout.Button("Prev", compactButtonStyle, GUILayout.Width(52f), GUILayout.Height(16f)))
        {
            waypointAutopilot?.SelectPreviousTarget();
        }

        if (GUILayout.Button("Next", compactButtonStyle, GUILayout.Width(52f), GUILayout.Height(16f)))
        {
            waypointAutopilot?.SelectNextTarget();
        }

        if (GUILayout.Button(waypointAutopilot != null && waypointAutopilot.AutopilotEngaged ? "Autopilot Off" : "Autopilot On", compactButtonStyle, GUILayout.Width(88f), GUILayout.Height(16f)))
        {
            waypointAutopilot?.ToggleAutopilot();
        }

        GUI.enabled = momentumAssist != null;
        if (GUILayout.Button("Kill Momentum", compactButtonStyle, GUILayout.Width(88f), GUILayout.Height(16f)))
        {
            momentumAssist?.Toggle();
        }
        GUI.enabled = true;

        GUILayout.EndHorizontal();
        GUILayout.BeginHorizontal();

        PrototypeFlightControlDiagnostics diagnostics = shipController.FlightControlDiagnostics;
        string modeButton = diagnostics.controlMode switch
        {
            FlightControlMode.Precision => "Mode: Precision",
            FlightControlMode.Translation => "Mode: Transl",
            _ => "Mode: Cruise"
        };
        if (GUILayout.Button(modeButton, compactButtonStyle, GUILayout.Width(96f), GUILayout.Height(16f)))
        {
            shipController.CycleControlMode();
        }

        bool sasEnabled = diagnostics.sasEnabled;
        if (GUILayout.Button(sasEnabled ? "SAS Off" : "SAS On", compactButtonStyle, GUILayout.Width(58f), GUILayout.Height(16f)))
        {
            shipController.SetSasEnabled(!sasEnabled);
        }

        string momentumLabel = momentumAssist != null ? diagnostics.momentumAssistState.ToString() : "No Momentum";
        GUILayout.Label(momentumLabel, smallLabelStyle, GUILayout.Width(88f), GUILayout.Height(16f));

        GUILayout.EndHorizontal();
        GUILayout.EndVertical();
        GUILayout.EndArea();
    }

    private string BuildNavigationComputerSummary()
    {
        if (waypointAutopilot == null)
        {
            return "NavComp: n/a";
        }

        string phase = waypointAutopilot.CurrentPlan.statusLabel;
        if (string.IsNullOrWhiteSpace(phase))
        {
            phase = waypointAutopilot.ArrivalPhase.ToString();
        }

        string avoidance = waypointAutopilot.CurrentPlan.avoidanceActive
            ? "avoid " + FormatVectorCompact(waypointAutopilot.AvoidanceWaypoint)
            : "avoid off";
        string warning = waypointAutopilot.FuelFeasible ? string.Empty : " | WARN fuel";
        if (!string.IsNullOrWhiteSpace(waypointAutopilot.FailureReason) && waypointAutopilot.FailureReason != "none")
        {
            warning += " | WARN " + waypointAutopilot.FailureReason;
        }

        return $"NavComp: {waypointAutopilot.TargetName} {FormatCompact(waypointAutopilot.DistanceToTarget)}m rel {FormatCompact(waypointAutopilot.LastMetrics.relativeSpeed)}m/s | {phase} | {(waypointAutopilot.AutopilotEngaged ? "auto on" : "auto off")} | obs {waypointAutopilot.ObstacleStatus} | {avoidance} | ETA {FormatCompactTime(waypointAutopilot.PlannedEta)} | main {waypointAutopilot.RequestedMainThrottle:0.00} RCS {FormatCompact(waypointAutopilot.RequestedRcsForce.magnitude)}N{warning}";
    }

    private static Vector2 MarkerLabelOffset(Vector2 markerOffset, float size, string label)
    {
        if (label == "FWD")
        {
            return new Vector2(-34f, -size - 18f);
        }

        if (markerOffset.sqrMagnitude <= 1f)
        {
            return new Vector2(0f, size + 10f);
        }

        Vector2 direction = markerOffset.normalized;
        return direction * (size + 16f);
    }

    private static void DrawLine(Vector2 start, Vector2 end, Color color, float thickness)
    {
        Matrix4x4 oldMatrix = GUI.matrix;
        Color oldColor = GUI.color;
        Vector2 delta = end - start;
        float angle = Mathf.Atan2(delta.y, delta.x) * Mathf.Rad2Deg;
        float length = delta.magnitude;

        GUI.color = color;
        GUIUtility.RotateAroundPivot(angle, start);
        GUI.DrawTexture(new Rect(start.x, start.y - (thickness * 0.5f), length, thickness), Texture2D.whiteTexture);
        GUI.matrix = oldMatrix;
        GUI.color = oldColor;
    }

    private string ResolveControlModeHint()
    {
        if (shipController == null)
        {
            return "Mode: n/a";
        }

        PrototypeFlightControlDiagnostics diagnostics = shipController.FlightControlDiagnostics;
        switch (diagnostics.controlMode)
        {
            case FlightControlMode.Precision:
                return "Mode: Precision";
            case FlightControlMode.Translation:
                return "Mode: Translation";
            default:
                return "Mode: Cruise";
        }
    }

    private static string FormatCompact(float value)
    {
        if (float.IsNaN(value))
        {
            return "n/a";
        }

        if (float.IsInfinity(value))
        {
            return "inf";
        }

        return value.ToString("0.0");
    }

    private static string FormatCompactTime(float value)
    {
        return float.IsInfinity(value) ? "inf" : FormatCompact(value) + "s";
    }

    private static string FormatVectorCompact(Vector3 value)
    {
        return $"({value.x:0},{value.y:0},{value.z:0})";
    }
}
