using System;
using UnityEngine;

public class PrototypeFlightDebugConsole : MonoBehaviour
{
    [SerializeField] private ShipStats targetStats;
    [SerializeField] private Rigidbody targetRigidbody;
    [SerializeField] private Transform target;
    [SerializeField] private PlayerShipController shipController;
    [SerializeField] private PrototypeDebugOverlay debugOverlay;
    [SerializeField] private PrototypeBootstrap bootstrap;
    [SerializeField] private Vector2 windowPosition = new Vector2(660f, 16f);

    private bool showConsole = true;
    private bool controlsOpen = true;
    private bool actionsOpen = true;
    private bool pulsesOpen = true;
    private bool rcsDiagnosticsOpen = true;
    private GUIStyle labelStyle;

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
        }

        if (debugOverlay == null)
        {
            debugOverlay = GetComponent<PrototypeDebugOverlay>();
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

    private void OnGUI()
    {
        if (!Application.isEditor && !Debug.isDebugBuild)
        {
            return;
        }

        ResolveReferences();
        EnsureStyle();

        if (GUILayout.Button(showConsole ? "Hide Flight Debug Console" : "Show Flight Debug Console", GUILayout.Width(220f)))
        {
            showConsole = !showConsole;
        }

        if (!showConsole || shipController == null)
        {
            return;
        }

        Rect rect = new Rect(windowPosition.x, windowPosition.y, 640f, 500f);
        GUI.Box(rect, "Prototype Flight Debug Console");
        GUILayout.BeginArea(new Rect(rect.x + 8f, rect.y + 22f, rect.width - 16f, rect.height - 28f));
        GUILayout.BeginHorizontal();
        GUILayout.BeginVertical(GUILayout.Width(305f));
        DrawControls();
        DrawActions();
        GUILayout.EndVertical();
        GUILayout.BeginVertical(GUILayout.Width(305f));
        DrawPulses();
        DrawRcsDiagnostics();
        GUILayout.EndVertical();
        GUILayout.EndHorizontal();
        GUILayout.EndArea();
    }

    private void DrawControls()
    {
        controlsOpen = GUILayout.Toggle(controlsOpen, "Controls");
        if (!controlsOpen)
        {
            return;
        }

        bool rcsEnabled = GUILayout.Toggle(shipController.RcsEnabled, "RCS");
        if (rcsEnabled != shipController.RcsEnabled)
        {
            shipController.SetRcsEnabled(rcsEnabled);
        }

        bool sasEnabled = GUILayout.Toggle(shipController.SasEnabled, "SAS");
        if (sasEnabled != shipController.SasEnabled)
        {
            shipController.SetSasEnabled(sasEnabled);
        }

        bool precision = GUILayout.Toggle(shipController.PrecisionControls, "Precision controls");
        if (precision != shipController.PrecisionControls)
        {
            shipController.SetPrecisionControls(precision);
        }

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
        DrawVariantSelector();
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
        debugOverlay = GetComponent<PrototypeDebugOverlay>();
        bootstrap = sourceBootstrap != null ? sourceBootstrap : FindAnyObjectByType<PrototypeBootstrap>();
    }
}
