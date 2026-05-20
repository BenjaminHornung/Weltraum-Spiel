using System;
using UnityEngine;

public class PrototypeFlightDebugConsole : MonoBehaviour
{
    private const string ObstacleScenarioPrefix = "PrototypeNavObstacleScenario_";

    [SerializeField] private ShipStats targetStats;
    [SerializeField] private Rigidbody targetRigidbody;
    [SerializeField] private Transform target;
    [SerializeField] private PlayerShipController shipController;
    [SerializeField] private PrototypeDebugOverlay debugOverlay;
    [SerializeField] private PrototypeFlightHud flightHud;
    [SerializeField] private PrototypeKeybindOverlay keybindOverlay;
    [SerializeField] private PrototypeMinimapOverlay minimapOverlay;
    [SerializeField] private PrototypeBootstrap bootstrap;
    [SerializeField] private PrototypeWaypointAutopilot waypointAutopilot;
    [SerializeField] private PrototypeMomentumAssist momentumAssist;
    [SerializeField] private SimpleFollowCamera followCamera;
    [SerializeField] private Vector2 windowPosition = new Vector2(660f, 16f);

    private bool showConsole;
    private bool consoleCollapsed = true;
    private bool controlsOpen = true;
    private bool actionsOpen = true;
    private bool navigationAutopilotOpen = true;
    private bool momentumAssistOpen = true;
    private bool pulsesOpen = true;
    private bool rcsDiagnosticsOpen = true;
    private bool controlCalibrationOpen = true;
    private GUIStyle labelStyle;
    private Vector2 scrollPosition;
    private PrototypeUiWindowState windowState;

    public bool IsConsoleVisible => ResolveWindowState().Visible;

    private void Start()
    {
        ResolveReferences();
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

        if (flightHud == null)
        {
            flightHud = GetComponent<PrototypeFlightHud>();
        }

        if (keybindOverlay == null)
        {
            keybindOverlay = GetComponent<PrototypeKeybindOverlay>();
        }

        if (followCamera == null)
        {
            followCamera = GetComponent<SimpleFollowCamera>();
        }

        if (minimapOverlay == null)
        {
            minimapOverlay = GetComponent<PrototypeMinimapOverlay>();
        }

        if (bootstrap == null)
        {
            bootstrap = FindAnyObjectByType<PrototypeBootstrap>();
        }
    }

    private void EnsureStyle()
    {
        if (labelStyle != null)
        {
            return;
        }

        labelStyle = new GUIStyle(GUI.skin.label);
        labelStyle.fontSize = 13;
        labelStyle.normal.textColor = Color.white;
    }

    private void Update()
    {
        ResolveReferences();
        PrototypeUiLayoutManager.HandleFunctionKeys(debugOverlay, this, flightHud, keybindOverlay, minimapOverlay);
    }

    private void OnGUI()
    {
        if (!Application.isEditor && !Debug.isDebugBuild)
        {
            return;
        }

        ResolveReferences();
        EnsureStyle();
        ResolveWindowState();

        if (!windowState.Visible)
        {
            return;
        }

        windowState.SetSize(consoleCollapsed ? 260f : 660f, consoleCollapsed ? 64f : 560f);
        windowState.Collapsed = consoleCollapsed;
        windowState.Rect = GUI.Window(windowState.WindowId, windowState.Rect, DrawWindow, "Debug Console");
        windowState.ClampToScreen();
        windowState.SaveToPrefs();
    }

    private PrototypeUiWindowState ResolveWindowState()
    {
        if (windowState == null)
        {
            windowState = PrototypeUiLayoutManager.GetWindow(
                PrototypeUiLayoutManager.DebugConsoleWindowId,
                new Rect(windowPosition.x, windowPosition.y, 660f, 560f),
                showConsole,
                consoleCollapsed);
            showConsole = windowState.Visible;
            consoleCollapsed = windowState.Collapsed;
        }

        return windowState;
    }

    private void DrawWindow(int id)
    {
        GUILayout.BeginVertical();
        GUILayout.BeginHorizontal();
        if (GUILayout.Button(consoleCollapsed ? "Open" : "Collapse", GUILayout.Width(76f)))
        {
            SetConsoleCollapsed(!consoleCollapsed);
        }

        if (GUILayout.Button("Hide", GUILayout.Width(54f)))
        {
            SetConsoleVisible(false);
        }

        GUILayout.Label("F3 toggles console", labelStyle);
        GUILayout.EndHorizontal();

        if (!consoleCollapsed)
        {
            DrawPresetControls();

            if (shipController == null)
            {
                GUILayout.Label("No PlayerShipController bound.", labelStyle);
            }
            else
            {
                scrollPosition = GUILayout.BeginScrollView(scrollPosition);
                GUILayout.BeginHorizontal();
                GUILayout.BeginVertical(GUILayout.Width(310f));
                DrawControls();
                DrawActions();
                DrawNavigationAutopilotStatus();
                DrawMomentumAssist();
                GUILayout.EndVertical();
                GUILayout.BeginVertical(GUILayout.Width(310f));
                DrawPulses();
                DrawRcsDiagnostics();
                GUILayout.EndVertical();
                GUILayout.EndHorizontal();
                GUILayout.EndScrollView();
            }
        }

        GUILayout.EndVertical();
        GUI.DragWindow(new Rect(0f, 0f, 10000f, 24f));
    }

    private void DrawPresetControls()
    {
        GUILayout.Label("UI preset", labelStyle);
        GUILayout.BeginHorizontal();
        if (GUILayout.Button("Basic")) ApplyPreset(PrototypeUiPreset.Basic);
        if (GUILayout.Button("Flight Test")) ApplyPreset(PrototypeUiPreset.FlightTest);
        if (GUILayout.Button("RCS Test")) ApplyPreset(PrototypeUiPreset.RcsTest);
        if (GUILayout.Button("Full Diagnostics")) ApplyPreset(PrototypeUiPreset.FullDiagnostics);
        GUILayout.EndHorizontal();

        GUILayout.BeginHorizontal();
        if (GUILayout.Button("Reset Layout"))
        {
            PrototypeUiLayoutManager.ResetLayout();
            ApplyPreset(PrototypeUiLayoutManager.CurrentPreset);
        }

        if (GUILayout.Button("Hide All Debug UI"))
        {
            PrototypeUiLayoutManager.HideAll(debugOverlay, this, flightHud, keybindOverlay, minimapOverlay);
        }
        GUILayout.EndHorizontal();
    }

    private void ApplyPreset(PrototypeUiPreset preset)
    {
        PrototypeUiLayoutManager.ApplyPreset(preset, debugOverlay, this, flightHud, keybindOverlay, minimapOverlay);
    }

    private void DrawControls()
    {
        controlsOpen = GUILayout.Toggle(controlsOpen, "Controls");
        if (!controlsOpen)
        {
            return;
        }

        PrototypeFlightControlDiagnostics diagnostics = shipController.FlightControlDiagnostics;
        bool rcsEnabled = GUILayout.Toggle(diagnostics.rcsEnabled, "RCS");
        if (rcsEnabled != shipController.RcsEnabled)
        {
            shipController.SetRcsEnabled(rcsEnabled);
        }

        bool sasEnabled = GUILayout.Toggle(diagnostics.sasEnabled, "SAS");
        if (sasEnabled != shipController.SasEnabled)
        {
            shipController.SetSasEnabled(sasEnabled);
        }
        GUILayout.Label($"Control mode: {diagnostics.controlModeLabel}", labelStyle);
        GUILayout.BeginHorizontal();
        if (GUILayout.Button("Normal"))
        {
            shipController.SetControlMode(FlightControlMode.Normal);
        }

        if (GUILayout.Button("Precision"))
        {
            shipController.SetControlMode(FlightControlMode.Precision);
        }

        if (GUILayout.Button("Translation"))
        {
            shipController.SetControlMode(FlightControlMode.Translation);
        }
        GUILayout.EndHorizontal();
        GUILayout.Label($"States: RCS {(diagnostics.rcsEnabled ? "on" : "off")}/{(diagnostics.rcsAvailable ? "available" : "unavailable")} {diagnostics.rcsAllocatorStatus} | SAS armed {(diagnostics.sasEnabled ? "on" : "off")} effective {(diagnostics.effectiveSasEnabled ? "on" : "off")} | Main {(diagnostics.mainThrusterAllowed ? "allowed" : "off")} | Gimbal {(diagnostics.gimbalAllowed ? "allowed" : "off")}", labelStyle);

        if (debugOverlay != null)
        {
            bool vectors = GUILayout.Toggle(debugOverlay.DrawDebugVectors, "Debug vectors");
            if (vectors != debugOverlay.DrawDebugVectors)
            {
                debugOverlay.SetDrawDebugVectors(vectors);
            }

            bool gizmos = GUILayout.Toggle(debugOverlay.DrawDebugGizmos, "Debug gizmos");
            if (gizmos != debugOverlay.DrawDebugGizmos)
            {
                debugOverlay.SetDrawDebugGizmos(gizmos);
            }
        }
        else
        {
            GUILayout.Label("Debug vector/gizmo toggles unavailable: no PrototypeDebugOverlay.", labelStyle);
        }

        DrawEnumSelector("SAS mode", shipController.SasMode, shipController.SetSasMode);
        DrawEnumSelector("Assist", shipController.FlightAssistMode, shipController.SetFlightAssistMode);
        DrawEnumSelector("Main thrust", shipController.MainThrustMode, shipController.SetMainThrustMode);
        DrawEnumSelector("Gimbal assist", shipController.GimbalAssistMode, shipController.SetGimbalAssistMode);
        DrawCameraControls();
        DrawControlCalibration();
        DrawVariantSelector();
    }

    private void DrawCameraControls()
    {
        GUILayout.Label("Camera framing", labelStyle);

        if (followCamera == null)
        {
            GUILayout.Label("Camera controls unavailable: no SimpleFollowCamera found.", labelStyle);
            return;
        }

        GUILayout.Label($"Mode: {followCamera.CameraModeName} | Dist {followCamera.EffectiveDistance:0.00} (base {followCamera.BaseVisualDistance:0.00}) | Zoom {followCamera.Zoom:0.00} | Bounds {followCamera.BaseVisualBoundsRadius:0.00}", labelStyle);
        GUILayout.BeginHorizontal();
        if (GUILayout.Button("Previous mode"))
        {
            followCamera.PreviousCameraMode();
        }

        if (GUILayout.Button("Next mode"))
        {
            followCamera.CycleCameraMode();
        }

        if (GUILayout.Button("Reset framing"))
        {
            followCamera.ResetFraming();
        }

        if (GUILayout.Button("Reframe"))
        {
            followCamera.ReframeToTargetVisualBounds();
        }
        GUILayout.EndHorizontal();

        GUILayout.BeginHorizontal();
        if (GUILayout.Button("Zoom In"))
        {
            followCamera.AdjustZoom(-1f);
        }

        if (GUILayout.Button("Zoom Out"))
        {
            followCamera.AdjustZoom(1f);
        }
        GUILayout.EndHorizontal();
    }

    private void DrawActions()
    {
        actionsOpen = GUILayout.Toggle(actionsOpen, "Actions");
        if (!actionsOpen)
        {
            return;
        }

        GUILayout.BeginHorizontal();
        if (GUILayout.Button("Refuel")) shipController.RefuelFull();
        if (GUILayout.Button("Cut")) shipController.CutMainThrottle();
        if (GUILayout.Button("Full")) shipController.FullMainThrottle();
        GUILayout.EndHorizontal();

        GUILayout.BeginHorizontal();
        if (GUILayout.Button("Reset pos")) shipController.ResetPosition();
        if (GUILayout.Button("Reset vel")) shipController.ResetVelocity();
        if (GUILayout.Button("Reset ang")) shipController.ResetAngularVelocity();
        GUILayout.EndHorizontal();

        if (GUILayout.Button("Capture SAS attitude"))
        {
            shipController.CaptureSasTargetRotation();
        }

        bool hasDamage = shipController.HasDamageStates();
        GUILayout.BeginHorizontal();
        GUI.enabled = hasDamage;
        if (GUILayout.Button("Clear damage")) shipController.ClearPrototypeDamage();
        if (GUILayout.Button("Apply damage")) shipController.ApplyPrototypeDamage(15f);
        GUI.enabled = true;
        GUILayout.EndHorizontal();

        GUI.enabled = bootstrap != null;
        if (GUILayout.Button("Spawn target"))
        {
            bootstrap.SpawnTestTarget();
        }

        if (GUILayout.Button("Rebuild environment"))
        {
            bootstrap.RebuildTestEnvironment();
        }
        GUI.enabled = true;

        if (!hasDamage)
        {
            GUILayout.Label("Damage actions unavailable: no module damage states found.", labelStyle);
        }

        if (bootstrap == null)
        {
            GUILayout.Label("Spawn target unavailable: no PrototypeBootstrap found.", labelStyle);
        }
    }

    private void DrawNavigationAutopilotStatus()
    {
        navigationAutopilotOpen = GUILayout.Toggle(navigationAutopilotOpen, "Navigation / Autopilot");
        if (!navigationAutopilotOpen)
        {
            return;
        }

        if (shipController == null)
        {
            GUILayout.Label("Autopilot controls unavailable: no PlayerShipController bound.", labelStyle);
            return;
        }

        if (waypointAutopilot == null)
        {
            GUILayout.Label("Autopilot unavailable: no PrototypeWaypointAutopilot.", labelStyle);
            return;
        }

        GUILayout.Label($"Target: {waypointAutopilot.TargetName}", labelStyle);
        PrototypeFlightControlDiagnostics diagnostics = shipController.FlightControlDiagnostics;
        GUILayout.Label($"Autopilot engaged: {(diagnostics.autopilotEngaged ? "yes" : "no")}", labelStyle);
        GUILayout.Label($"State: {diagnostics.autopilotState}", labelStyle);

        GUILayout.BeginHorizontal();
        if (GUILayout.Button("Previous Target"))
        {
            waypointAutopilot.SelectPreviousTarget();
        }

        if (GUILayout.Button("Next Target"))
        {
            waypointAutopilot.SelectNextTarget();
        }
        GUILayout.EndHorizontal();

        GUILayout.BeginHorizontal();
        if (GUILayout.Button(waypointAutopilot.AutopilotEngaged ? "Autopilot Off" : "Autopilot On"))
        {
            waypointAutopilot.ToggleAutopilot();
        }

        if (GUILayout.Button("Abort Autopilot"))
        {
            waypointAutopilot.Abort();
        }
        GUILayout.EndHorizontal();

        GUILayout.BeginHorizontal();
        if (GUILayout.Button("Replan Now"))
        {
            waypointAutopilot.ReplanNow();
        }

        if (GUILayout.Button("Toggle obstacle debug gizmos"))
        {
            ToggleObstacleDebugGizmos();
        }
        GUILayout.EndHorizontal();

        GUILayout.BeginHorizontal();
        if (GUILayout.Button("Spawn obstacle test scenario"))
        {
            SpawnObstacleTestScenario();
        }

        if (GUILayout.Button("Clear obstacle test scenario"))
        {
            ClearObstacleTestScenario();
        }
        GUILayout.EndHorizontal();

        GUILayout.Label($"Distance: {FormatCompact(waypointAutopilot.DistanceToTarget)} m", labelStyle);
        GUILayout.Label($"Closing speed: {FormatCompact(waypointAutopilot.ClosingSpeed)} m/s", labelStyle);
        GUILayout.Label($"Lateral speed: {FormatCompact(waypointAutopilot.LateralSpeed)} m/s", labelStyle);
        GUILayout.Label($"Stopping distance: {FormatCompact(waypointAutopilot.StoppingDistance)} m", labelStyle);
        GUILayout.Label($"Arrival phase: {waypointAutopilot.ArrivalPhase}", labelStyle);
        PrototypeTrajectoryPlan plan = waypointAutopilot.CurrentPlan;
        GUILayout.Label($"Plan: {plan.statusLabel} phase {plan.phase} valid {(plan.isValid ? "yes" : "no")}", labelStyle);
        GUILayout.Label($"Desired accel: {FormatVector(waypointAutopilot.RequestedAcceleration)} m/s2", labelStyle);
        GUILayout.Label($"Obstacle: {plan.obstacleLabel} @ {FormatCompact(plan.obstacleDistance)} m | {waypointAutopilot.ObstacleStatus}", labelStyle);
        GUILayout.Label($"Avoidance waypoint: {FormatVector(waypointAutopilot.AvoidanceWaypoint)}", labelStyle);
        GUILayout.Label($"Plan stop/ETA: {FormatCompact(waypointAutopilot.PlannedStoppingDistance)} m / {FormatFuel(waypointAutopilot.PlannedEta)} s", labelStyle);
        GUILayout.Label($"Arrival envelope: dist <= {FormatCompact(waypointAutopilot.LastMetrics.distance)} m, speed {FormatCompact(waypointAutopilot.LastMetrics.relativeSpeed)} m/s, lateral {FormatCompact(waypointAutopilot.LastMetrics.lateralSpeed)} m/s", labelStyle);
        GUILayout.Label($"Fuel available/required: {FormatFuel(waypointAutopilot.AvailableBurnSeconds)} / {FormatFuel(waypointAutopilot.RequiredBurnSeconds)} s", labelStyle);
        GUILayout.Label($"Desired burn dir: {FormatVector(waypointAutopilot.DesiredBurnDirection)}", labelStyle);
        GUILayout.Label($"Req main throttle: {waypointAutopilot.RequestedMainThrottle:0.00}", labelStyle);
        GUILayout.Label($"Req RCS translation: {FormatVector(waypointAutopilot.RequestedRcsTranslation)}", labelStyle);
        GUILayout.Label($"Limited final approach: {(waypointAutopilot.LimitedFinalApproachCapability ? "yes" : "no")}", labelStyle);
        GUILayout.Label($"Arrival status: {waypointAutopilot.ArrivalStatus}", labelStyle);
        GUILayout.Label($"Fuel insufficient hint: {(waypointAutopilot.FuelFeasible ? "no" : "yes")}", labelStyle);
        GUILayout.Label($"Failure/limitation: {waypointAutopilot.ArrivalFailureReason}", labelStyle);
        GUILayout.Label($"Manual override: {(shipController.LastManualFlightInput ? "active" : "inactive")}", labelStyle);

        if (momentumAssist != null)
        {
            GUILayout.Label($"Momentum Assist: {(diagnostics.momentumAssistActive ? "on" : "off")} | {diagnostics.momentumAssistState} / {diagnostics.momentumAssistStatus}", labelStyle);
        }
        else
        {
            GUILayout.Label("Momentum Assist unavailable: no PrototypeMomentumAssist.", labelStyle);
        }
    }

    private void ToggleObstacleDebugGizmos()
    {
        PrototypeNavigationObstacle[] obstacles = FindObjectsByType<PrototypeNavigationObstacle>(FindObjectsInactive.Exclude);
        bool anyHidden = false;
        for (int i = 0; i < obstacles.Length; i++)
        {
            if (obstacles[i] != null && !obstacles[i].ShowDebugGizmo)
            {
                anyHidden = true;
                break;
            }
        }

        for (int i = 0; i < obstacles.Length; i++)
        {
            if (obstacles[i] != null)
            {
                obstacles[i].SetDebugGizmoVisible(anyHidden);
            }
        }
    }

    private void SpawnObstacleTestScenario()
    {
        ClearObstacleTestScenario();
        Vector3 origin = target != null ? target.position : Vector3.zero;
        Vector3 forward = target != null ? target.forward : Vector3.forward;
        Vector3 right = target != null ? target.right : Vector3.right;
        CreateScenarioObstacle("Center", origin + forward * 80f, 8f);
        CreateScenarioObstacle("Offset", origin + forward * 135f + right * 22f, 10f);
        Physics.SyncTransforms();
        waypointAutopilot?.ReplanNow();
    }

    private void CreateScenarioObstacle(string suffix, Vector3 position, float radiusMeters)
    {
        GameObject obstacle = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        obstacle.name = ObstacleScenarioPrefix + suffix;
        obstacle.transform.position = position;
        obstacle.transform.localScale = Vector3.one * Mathf.Max(0.1f, radiusMeters * 2f);
        Collider obstacleCollider = obstacle.GetComponent<Collider>();
        if (obstacleCollider != null)
        {
            obstacleCollider.isTrigger = true;
        }

        obstacle.AddComponent<PrototypeNavigationObstacle>().Configure(radiusMeters, 8f, true);
    }

    private void ClearObstacleTestScenario()
    {
        GameObject[] objects = FindObjectsByType<GameObject>(FindObjectsInactive.Exclude);
        for (int i = 0; i < objects.Length; i++)
        {
            if (objects[i] != null && objects[i].name.StartsWith(ObstacleScenarioPrefix, StringComparison.Ordinal))
            {
                Destroy(objects[i]);
            }
        }
    }

    private void DrawMomentumAssist()
    {
        momentumAssistOpen = GUILayout.Toggle(momentumAssistOpen, "Momentum Assist");
        if (!momentumAssistOpen)
        {
            return;
        }

        if (momentumAssist == null)
        {
            GUILayout.Label("Momentum Assist unavailable: no PrototypeMomentumAssist.", labelStyle);
            return;
        }

        GUILayout.BeginHorizontal();
        if (GUILayout.Button(momentumAssist.IsActive ? "Abort" : "Engage"))
        {
            if (momentumAssist.IsActive)
            {
                momentumAssist.Abort("debug console");
            }
            else
            {
                momentumAssist.ActivateFromUi();
            }
        }

        if (GUILayout.Button("Toggle"))
        {
            momentumAssist.Toggle();
        }
        GUILayout.EndHorizontal();

        GUILayout.Label($"State: {momentumAssist.CurrentState} / {momentumAssist.StatusLabel}", labelStyle);
        GUILayout.Label($"Speed: {FormatCompact(momentumAssist.SpeedMetersPerSecond)} m/s | Angular: {FormatCompact(momentumAssist.AngularSpeed)} rad/s", labelStyle);
        GUILayout.Label($"Brake direction: {FormatVector(momentumAssist.LastBrakeDirectionWorld)}", labelStyle);
        GUILayout.Label($"RCS desired force: {FormatVector(momentumAssist.LastRequestedForceWorld)} N", labelStyle);
        GUILayout.Label($"Requested torque: {FormatVector(momentumAssist.LastRequestedTorqueLocal)} Nm", labelStyle);
        GUILayout.Label($"Main throttle request: {momentumAssist.LastMainThrottleRequest:0.00}", labelStyle);
        GUILayout.Label($"Authority/status: main {(momentumAssist.CanUseMainBrake ? "yes" : "no")} | {momentumAssist.StatusLabel}", labelStyle);
    }

    private void DrawPulses()
    {
        pulsesOpen = GUILayout.Toggle(pulsesOpen, "Test Pulses");
        if (!pulsesOpen)
        {
            return;
        }

        GUILayout.Label("RCS translation", labelStyle);
        GUILayout.BeginHorizontal();
        if (GUILayout.Button("+X")) shipController.PulseRcsTranslation(Vector3.right);
        if (GUILayout.Button("-X")) shipController.PulseRcsTranslation(Vector3.left);
        if (GUILayout.Button("+Y")) shipController.PulseRcsTranslation(Vector3.up);
        if (GUILayout.Button("-Y")) shipController.PulseRcsTranslation(Vector3.down);
        GUILayout.EndHorizontal();
        GUILayout.BeginHorizontal();
        if (GUILayout.Button("+Z")) shipController.PulseRcsTranslation(Vector3.forward);
        if (GUILayout.Button("-Z")) shipController.PulseRcsTranslation(Vector3.back);
        GUILayout.EndHorizontal();

        GUILayout.Label("Attitude", labelStyle);
        GUILayout.BeginHorizontal();
        if (GUILayout.Button("Pitch+")) shipController.PulseRcsAttitude(Vector3.right);
        if (GUILayout.Button("Pitch-")) shipController.PulseRcsAttitude(Vector3.left);
        if (GUILayout.Button("Yaw+")) shipController.PulseRcsAttitude(Vector3.up);
        if (GUILayout.Button("Yaw-")) shipController.PulseRcsAttitude(Vector3.down);
        GUILayout.EndHorizontal();
        GUILayout.BeginHorizontal();
        if (GUILayout.Button("Roll+")) shipController.PulseRcsAttitude(Vector3.forward);
        if (GUILayout.Button("Roll-")) shipController.PulseRcsAttitude(Vector3.back);
        GUILayout.EndHorizontal();

        GUILayout.BeginHorizontal();
        if (GUILayout.Button("Main thrust")) shipController.PulseMainThrust(1f);
        if (GUILayout.Button("Gimbal yaw")) shipController.PulseGimbal(1f, 0f);
        if (GUILayout.Button("Gimbal pitch")) shipController.PulseGimbal(0f, 1f);
        GUILayout.EndHorizontal();
    }

    private void DrawControlCalibration()
    {
        controlCalibrationOpen = GUILayout.Toggle(controlCalibrationOpen, "Control calibration");
        if (!controlCalibrationOpen)
        {
            return;
        }

        string interpretationLabel = shipController.ControlMode switch
        {
            FlightControlMode.Translation => "Translation (W/S forward/back, A/D left/right)",
            FlightControlMode.Precision => "Precision attitude (RCS, no main)",
            _ => "Cruise attitude (main throttle enabled)"
        };

        GUILayout.Label($"Flight mode: {shipController.ControlModeLabel}", labelStyle);
        GUILayout.Label($"RCS layer: {shipController.ActiveRcsLayerLabel}", labelStyle);
        GUILayout.Label($"Key interpretation: {interpretationLabel}", labelStyle);
        GUILayout.Label($"Attitude command: {FormatVector(shipController.RcsAttitudeCommand)}", labelStyle);
        GUILayout.Label($"Translation command: {FormatVector(shipController.RcsTranslationCommand)}", labelStyle);
        GUILayout.Label(shipController.ControlMode == FlightControlMode.Translation
            ? "W/S forward/back, A/D left/right, H/N up/down, Q/E roll"
            : "W/S pitch, A/D yaw, Q/E roll", labelStyle);
        GUILayout.Label($"Angular velocity local: {FormatVector(shipController.LastRcsSasAngularVelocityLocal)} rad/s", labelStyle);

        bool invertKeyboardPitch = GUILayout.Toggle(shipController.InvertKeyboardPitch, "Invert keyboard pitch");
        if (invertKeyboardPitch != shipController.InvertKeyboardPitch)
        {
            shipController.SetInvertKeyboardPitch(invertKeyboardPitch);
        }

        bool invertKeyboardYaw = GUILayout.Toggle(shipController.InvertKeyboardYaw, "Invert keyboard yaw");
        if (invertKeyboardYaw != shipController.InvertKeyboardYaw)
        {
            shipController.SetInvertKeyboardYaw(invertKeyboardYaw);
        }

        bool invertKeyboardRoll = GUILayout.Toggle(shipController.InvertKeyboardRoll, "Invert keyboard roll");
        if (invertKeyboardRoll != shipController.InvertKeyboardRoll)
        {
            shipController.SetInvertKeyboardRoll(invertKeyboardRoll);
        }

        bool invertGamepadPitch = GUILayout.Toggle(shipController.InvertGamepadPitch, "Invert gamepad pitch");
        if (invertGamepadPitch != shipController.InvertGamepadPitch)
        {
            shipController.SetInvertGamepadPitch(invertGamepadPitch);
        }
    }

    private void DrawRcsDiagnostics()
    {
        rcsDiagnosticsOpen = GUILayout.Toggle(rcsDiagnosticsOpen, "RCS Diagnostics");
        if (!rcsDiagnosticsOpen)
        {
            return;
        }

        GUILayout.Label($"Force desired: {FormatVector(shipController.LastRcsDesiredForceWorld)} N", labelStyle);
        GUILayout.Label($"Force actual: {FormatVector(shipController.LastRcsActualForceWorld)} N", labelStyle);
        GUILayout.Label($"Force residual: {FormatVector(shipController.LastRcsResidualForceWorld)} N", labelStyle);
        GUILayout.Label($"Torque desired: {FormatVector(shipController.LastRcsDesiredTorqueWorld)} Nm", labelStyle);
        GUILayout.Label($"Torque actual: {FormatVector(shipController.LastRcsActualTorqueWorld)} Nm", labelStyle);
        GUILayout.Label($"Torque residual: {FormatVector(shipController.LastRcsResidualTorqueWorld)} Nm", labelStyle);
        GUILayout.Label($"Nozzle max: {shipController.LastRcsMaxNozzleThrottle:0.00}, saturated {shipController.LastRcsSaturatedNozzleCount}, active {shipController.ActiveRcsNozzleCount}/{shipController.InstalledRcsNozzleCount}", labelStyle);
        GUILayout.Label($"Allocator: {shipController.LastRcsAllocatorStatus}, applications {shipController.LastRcsNozzleApplicationCount}", labelStyle);
        GUILayout.Label($"Active nozzles: {Shorten(shipController.ActiveRcsNozzleIds, 78)}", labelStyle);
    }

    private void DrawVariantSelector()
    {
        if (bootstrap == null)
        {
            GUILayout.Label("Ship variant selector unavailable: no PrototypeBootstrap.", labelStyle);
            return;
        }

        GUILayout.BeginHorizontal();
        GUILayout.Label($"Ship variant: {bootstrap.SelectedVariantName}", labelStyle, GUILayout.Width(245f));
        if (GUILayout.Button("Prev"))
        {
            bootstrap.SelectPreviousVariant();
        }

        if (GUILayout.Button("Next"))
        {
            bootstrap.SelectNextVariant();
        }
        GUILayout.EndHorizontal();

        if (GUILayout.Button("Spawn Selected Variant"))
        {
            bootstrap.BuildSelectedVariant();
        }
    }

    private void DrawEnumSelector<T>(string label, T value, Action<T> apply) where T : Enum
    {
        GUILayout.BeginHorizontal();
        GUILayout.Label($"{label}: {value}", labelStyle, GUILayout.Width(205f));
        if (GUILayout.Button("Next"))
        {
            apply(NextEnumValue(value));
        }
        GUILayout.EndHorizontal();
    }

    private static T NextEnumValue<T>(T value) where T : Enum
    {
        Array values = Enum.GetValues(typeof(T));
        int index = Array.IndexOf(values, value);
        int next = index < 0 ? 0 : (index + 1) % values.Length;
        return (T)values.GetValue(next);
    }

    private static string FormatVector(Vector3 value)
    {
        return $"({value.x:0.00}, {value.y:0.00}, {value.z:0.00})";
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

        return value.ToString("0.00");
    }

    private static string FormatFuel(float value)
    {
        if (float.IsNaN(value))
        {
            return "n/a";
        }

        return float.IsInfinity(value) ? "inf" : value.ToString("0.00");
    }

    private static string Shorten(string value, int maxLength)
    {
        if (string.IsNullOrEmpty(value) || value.Length <= maxLength)
        {
            return string.IsNullOrEmpty(value) ? "none" : value;
        }

        return value.Substring(0, Mathf.Max(0, maxLength - 3)) + "...";
    }

    public void Bind(Transform trackTarget, ShipStats stats, Rigidbody rb, PrototypeBootstrap sourceBootstrap)
    {
        target = trackTarget;
        targetStats = stats;
        targetRigidbody = rb;
        shipController = trackTarget != null ? trackTarget.GetComponent<PlayerShipController>() : null;
        waypointAutopilot = trackTarget != null ? trackTarget.GetComponent<PrototypeWaypointAutopilot>() : null;
        momentumAssist = trackTarget != null ? trackTarget.GetComponent<PrototypeMomentumAssist>() : null;
        debugOverlay = GetComponent<PrototypeDebugOverlay>();
        flightHud = GetComponent<PrototypeFlightHud>();
        keybindOverlay = GetComponent<PrototypeKeybindOverlay>();
        minimapOverlay = GetComponent<PrototypeMinimapOverlay>();
        bootstrap = sourceBootstrap != null ? sourceBootstrap : FindAnyObjectByType<PrototypeBootstrap>();
    }

    public void SetConsoleVisible(bool visible)
    {
        showConsole = visible;
        ResolveWindowState().Visible = visible;
    }

    public void SetConsoleCollapsed(bool collapsed)
    {
        consoleCollapsed = collapsed;
        ResolveWindowState().Collapsed = collapsed;
    }

    public void SetRcsDiagnosticsExpanded(bool expanded)
    {
        rcsDiagnosticsOpen = expanded;
        controlsOpen = true;
        actionsOpen = true;
        pulsesOpen = expanded || PrototypeUiLayoutManager.CurrentPreset == PrototypeUiPreset.FullDiagnostics;
    }

}
