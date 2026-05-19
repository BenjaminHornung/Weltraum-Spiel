using UnityEngine;

[RequireComponent(typeof(Camera))]
public class PrototypeDebugOverlay : MonoBehaviour
{
    [SerializeField] private ShipStats targetStats;
    [SerializeField] private Rigidbody targetRigidbody;
    [SerializeField] private Transform target;
    [SerializeField] private SimpleFollowCamera followCamera;
    [SerializeField] private PlayerShipController shipController;

    [Header("Overlay")]
    [SerializeField] private Vector2 windowPosition = new Vector2(16f, 16f);

    [Header("Debug Vectors")]
    [SerializeField] private bool drawDebugVectors;
    [SerializeField] private bool drawDebugGizmos;
    [SerializeField] private float forceVectorScale = 0.00015f;
    [SerializeField] private float torqueVectorScale = 0.00025f;

    private GUIStyle labelStyle;

    private void Start()
    {
        ResolveTargetReferences();
    }

    private void ResolveTargetReferences()
    {
        if (target == null)
        {
            return;
        }

        if (targetStats == null)
        {
            targetStats = target.GetComponent<ShipStats>();
        }

        if (targetRigidbody == null)
        {
            targetRigidbody = target.GetComponent<Rigidbody>();
        }


        if (followCamera == null)
        {
            followCamera = GetComponent<SimpleFollowCamera>();
        }
        if (shipController == null)
        {
            shipController = target.GetComponent<PlayerShipController>();
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

    private void LateUpdate()
    {
        if (!drawDebugVectors)
        {
            return;
        }

        ResolveTargetReferences();
        DrawRuntimeDebugVectors();
    }

    private void OnGUI()
    {
        if (targetStats == null || targetRigidbody == null || shipController == null)
        {
            ResolveTargetReferences();
            if (targetStats == null || targetRigidbody == null)
            {
                return;
            }
        }

        EnsureStyle();

        Vector3 linearVelocity = targetRigidbody.linearVelocity;
        Vector3 angularVelocity = targetRigidbody.angularVelocity;
        float speedMps = linearVelocity.magnitude;
        float speedKph = speedMps * 3.6f;
        float rbMass = targetRigidbody.mass;
        Vector3 centerOfMassLocal = targetRigidbody.centerOfMass;
        Vector3 centerOfMassWorld = targetRigidbody.worldCenterOfMass;
        Vector3 inertiaTensor = targetRigidbody.inertiaTensor;
        ShipMassProperties massProperties = targetStats.LastMassProperties;

        Vector3 rcsTranslation = shipController != null ? shipController.RcsTranslationCommand : Vector3.zero;
        Vector3 rcsAttitude = shipController != null ? shipController.RcsAttitudeCommand : Vector3.zero;
        float throttlePercent = shipController != null ? shipController.MainThrottlePercent : targetStats.LastThrottle * 100f;
        float mainCommand = shipController != null ? shipController.MainThrustCommand : targetStats.LastThrottle;
        float throttleScale = shipController != null ? shipController.MainThrottleScale : 0f;
        bool gimbalEnabled = shipController != null && shipController.GimbalEnabled;
        float gimbalLimit = shipController != null ? shipController.GimbalLimitDegrees : 0f;
        float gimbalResponse = shipController != null ? shipController.GimbalResponseScalar : 0f;
        float gimbalYaw = shipController != null ? shipController.GimbalYawCommand : 0f;
        float gimbalPitch = shipController != null ? shipController.GimbalPitchCommand : 0f;
        float gimbalAngle = shipController != null ? shipController.LastGimbalAngleDegrees : 0f;
        float turnInput = shipController != null ? shipController.TurnInput : 0f;
        bool hasRcs = shipController != null && shipController.HasRcs;
        bool rcsEnabled = shipController != null && shipController.RcsEnabled;
        bool sasEnabled = shipController != null && shipController.SasEnabled;
        bool effectiveSas = shipController != null && shipController.EffectiveSasEnabled;
        bool precision = shipController != null && shipController.PrecisionControls;
        float forwardAcceleration = shipController != null ? shipController.LastForwardAcceleration : targetStats.LastAcceleration;
        Vector3 rcsPivotLocal = shipController != null ? shipController.RcsControlPivotLocal : Vector3.zero;
        Vector3 rcsPivotWorld = shipController != null ? shipController.RcsControlPivotWorld : centerOfMassWorld;
        int installedNozzles = shipController != null ? shipController.InstalledRcsNozzleCount : 0;
        int activeNozzles = shipController != null ? shipController.ActiveRcsNozzleCount : 0;
        string activeNozzleIds = shipController != null ? shipController.ActiveRcsNozzleIds : string.Empty;
        float rcsMaxNozzleThrottle = shipController != null ? shipController.LastRcsMaxNozzleThrottle : 0f;
        int rcsNozzleApplications = shipController != null ? shipController.LastRcsNozzleApplicationCount : 0;
        float rcsTranslationSetting = shipController != null ? shipController.RcsTranslationForceSetting : 0f;
        float rcsAttitudeSetting = shipController != null ? shipController.RcsAttitudeForceSetting : 0f;
        float sasAuthority = shipController != null ? shipController.RcsSasAuthority : 0f;
        float minSelectionDot = shipController != null ? shipController.RcsMinSelectionDot : 0f;
        Vector3 rawSasCommand = shipController != null ? shipController.LastRawRcsSasCommand : Vector3.zero;
        Vector3 sasCommand = shipController != null ? shipController.LastRcsSasCommand : Vector3.zero;
        Vector3 sasReleasedAxes = shipController != null ? shipController.LastRcsSasReleasedAxes : Vector3.one;
        Vector3 rcsTotalForce = shipController != null ? shipController.LastRcsForce : Vector3.zero;
        Vector3 rcsTranslationForce = shipController != null ? shipController.LastRcsTranslationForce : Vector3.zero;
        Vector3 rcsTorque = shipController != null ? shipController.LastRcsTorque : Vector3.zero;
        Vector3 rcsYawTorque = shipController != null ? shipController.LastRcsYawTorque : Vector3.zero;
        Vector3 coreForce = shipController != null ? shipController.LastCoreAppliedForce : Vector3.zero;
        Vector3 coreTorque = shipController != null ? shipController.LastCoreAppliedTorque : Vector3.zero;
        int coreApplications = shipController != null ? shipController.LastCoreAppliedForceCount : 0;
        Vector3 mainDirection = shipController != null ? shipController.LastMainThrustDirection : target.transform.forward;
        Vector3 mainForce = shipController != null ? shipController.LastMainForceWorld : Vector3.zero;
        Vector3 mainStraight = shipController != null ? shipController.LastMainStraightForceWorld : Vector3.zero;
        Vector3 mainSteering = shipController != null ? shipController.LastMainSteeringForceWorld : Vector3.zero;
        Vector3 mainTorque = shipController != null ? shipController.LastMainGimbalTorque : Vector3.zero;
        PrototypeThermalModule mainThermal = shipController != null ? shipController.MainThermalModule : null;
        bool mainThermalEnabled = shipController != null && shipController.MainThermalEnabled;
        bool mainThermalOverheated = shipController != null && shipController.MainThermalOverheated;
        float mainThermalEfficiency = shipController != null ? shipController.MainThermalEfficiency : 1f;
        float mainPowerDrawKw = shipController != null ? shipController.MainPowerDrawKw : 0f;
        string cameraMode = followCamera != null ? followCamera.CameraModeName : "none";
        float cameraAnchorError = followCamera != null ? followCamera.AnchorError : 0f;
        float cameraLookYaw = followCamera != null ? followCamera.LookYaw : 0f;
        float cameraLookPitch = followCamera != null ? followCamera.LookPitch : 0f;
        Vector3 mainForcePosition = shipController != null ? shipController.LastMainForcePositionWorld : centerOfMassWorld;

        Rect rect = new Rect(windowPosition.x, windowPosition.y, 620f, 630f);
        GUI.Box(rect, "Prototype Flight Diagnostics");

        GUILayout.BeginArea(new Rect(rect.x + 8f, rect.y + 22f, rect.width - 14f, rect.height - 24f));
        GUILayout.BeginHorizontal();
        GUILayout.BeginVertical(GUILayout.Width(300f));
        GUILayout.Label($"Fuel: {targetStats.CurrentFuelKg:0.0} / {targetStats.MaxFuelKg:0.0} kg", labelStyle);
        GUILayout.Label($"Mass: stats {targetStats.CurrentMass:0.0} kg, rb {rbMass:0.0} kg", labelStyle);
        GUILayout.Label($"Speed: {speedMps:0.0} m/s ({speedKph:0.0} km/h)", labelStyle);
        GUILayout.Label($"Velocity: {FormatVector(linearVelocity)} m/s", labelStyle);
        GUILayout.Label($"Camera: {cameraMode}, anchor error {cameraAnchorError:0.000} m", labelStyle);
        GUILayout.Label($"Camera look: yaw {cameraLookYaw:0.0} deg, pitch {cameraLookPitch:0.0} deg", labelStyle);
        GUILayout.Label($"Angular velocity: {FormatVector(angularVelocity)} rad/s", labelStyle);
        GUILayout.Label($"COM local: {FormatVector(centerOfMassLocal)}", labelStyle);
        GUILayout.Label($"COM world: {FormatVector(centerOfMassWorld)}", labelStyle);
        GUILayout.Label($"Mass model: {massProperties.ModuleCount} modules, dry {massProperties.DryMassKg:0.0} kg, fuel {massProperties.FuelMassKg:0.0} kg", labelStyle);
        GUILayout.Label($"Inertia tensor: {FormatVector(inertiaTensor)} kg*m^2", labelStyle);
        GUILayout.Space(4f);
        GUILayout.Label($"Throttle: {throttlePercent:0}% cmd {mainCommand:0.00} scale {throttleScale:0.00}", labelStyle);
        GUILayout.Label($"Main thrust: {targetStats.LastAppliedThrust:0} / {targetStats.Thrust:0} N", labelStyle);
        GUILayout.Label($"Forward accel: {forwardAcceleration:0.0} m/s^2", labelStyle);
        GUILayout.Label($"Main dir: {FormatVector(mainDirection)}", labelStyle);
        GUILayout.Label($"Main force pos: {FormatVector(mainForcePosition)}", labelStyle);
        GUILayout.Label($"Main force: {FormatVector(mainForce)}", labelStyle);
        GUILayout.Label($"Main straight: {FormatVector(mainStraight)}", labelStyle);
        GUILayout.Label($"Main steering: {FormatVector(mainSteering)}", labelStyle);
        GUILayout.Label($"Main torque est: {FormatVector(mainTorque)}", labelStyle);
        if (mainThermal != null)
        {
            GUILayout.Label($"Thermal: {mainThermal.ModuleName} {mainThermal.CurrentTemperature:0.0}/{mainThermal.MaxTemperature:0.0} C {mainThermal.StateLabel}", labelStyle);
            GUILayout.Label($"Heat/power: heat {mainThermal.LastHeatGeneratedPerSecond:0.0}/s, cool {mainThermal.LastCoolingApplied:0.00}, power {mainPowerDrawKw:0.0} kW", labelStyle);
            GUILayout.Label($"Overheat hook: {(mainThermalEnabled ? "sim" : "off")}, {(mainThermalOverheated ? "active" : "clear")}, eff {mainThermalEfficiency:0.00}", labelStyle);
        }
        GUILayout.Label($"Gimbal: {(gimbalEnabled ? "on" : "off")} / {gimbalLimit:0.0} deg", labelStyle);
        GUILayout.Label($"Gimbal cmd: Y {gimbalYaw:0.00} P {gimbalPitch:0.00}, response {gimbalResponse:0.00}, angle {gimbalAngle:0.0}", labelStyle);
        GUILayout.EndVertical();

        GUILayout.BeginVertical(GUILayout.Width(300f));
        GUILayout.Label($"RCS: installed {(hasRcs ? "yes" : "no")}, enabled {(rcsEnabled ? "yes" : "no")}", labelStyle);
        GUILayout.Label($"RCS tuning: move {rcsTranslationSetting:0} N, attitude {rcsAttitudeSetting:0} N", labelStyle);
        GUILayout.Label($"RCS select dot: {minSelectionDot:0.00}, nozzles {activeNozzles}/{installedNozzles}", labelStyle);
        GUILayout.Label($"RCS allocator: max throttle {rcsMaxNozzleThrottle:0.00}, applications {rcsNozzleApplications}", labelStyle);
        GUILayout.Label($"Precision: {(precision ? "on" : "off")}", labelStyle);
        GUILayout.Label($"Move cmd: L/R {rcsTranslation.x:0.00}, U/D {rcsTranslation.y:0.00}, F/B {rcsTranslation.z:0.00}", labelStyle);
        GUILayout.Label($"Attitude cmd: P {rcsAttitude.x:0.00}, Y {rcsAttitude.y:0.00}, R {rcsAttitude.z:0.00}", labelStyle);
        GUILayout.Label($"Turn input: {turnInput:0.00}", labelStyle);
        GUILayout.Label($"RCS pivot local: {FormatVector(rcsPivotLocal)}", labelStyle);
        GUILayout.Label($"RCS pivot world: {FormatVector(rcsPivotWorld)}", labelStyle);
        GUILayout.Label($"RCS total force: {FormatVector(rcsTotalForce)}", labelStyle);
        GUILayout.Label($"RCS translate force: {FormatVector(rcsTranslationForce)}", labelStyle);
        GUILayout.Label($"RCS torque est: {FormatVector(rcsTorque)}", labelStyle);
        GUILayout.Label($"RCS yaw torque est: {FormatVector(rcsYawTorque)}", labelStyle);
        GUILayout.Label($"Core force: {FormatVector(coreForce)}", labelStyle);
        GUILayout.Label($"Core torque: {FormatVector(coreTorque)}, applications {coreApplications}", labelStyle);
        GUILayout.Space(4f);
        GUILayout.Label($"SAS: {(sasEnabled ? "on" : "off")} (effective {(effectiveSas ? "on" : "off")}) auth {sasAuthority:0.00}", labelStyle);
        GUILayout.Label($"SAS raw cmd: {FormatVector(rawSasCommand)}", labelStyle);
        GUILayout.Label($"SAS masked cmd: {FormatVector(sasCommand)}", labelStyle);
        GUILayout.Label($"SAS released axes: {FormatAxisMask(sasReleasedAxes)}", labelStyle);
        GUILayout.Label($"Debug vectors: lines {(drawDebugVectors ? "on" : "off")}, gizmos {(drawDebugGizmos ? "on" : "off")}", labelStyle);
        GUILayout.Label($"Active nozzles: {Shorten(activeNozzleIds, 74)}", labelStyle);
        GUILayout.EndVertical();
        GUILayout.EndHorizontal();
        GUILayout.EndArea();
    }

    private void OnDrawGizmos()
    {
        if (!drawDebugGizmos)
        {
            return;
        }

        ResolveTargetReferences();
        if (targetRigidbody == null || shipController == null)
        {
            return;
        }

        DrawGizmoVector(shipController.LastMainForcePositionWorld, shipController.LastMainForceWorld, forceVectorScale, Color.cyan);
        DrawGizmoVector(shipController.LastMainForcePositionWorld, shipController.LastMainSteeringForceWorld, forceVectorScale, Color.magenta);
        DrawGizmoVector(shipController.RcsControlPivotWorld, shipController.LastRcsTranslationForce, forceVectorScale, Color.green);
        DrawGizmoVector(targetRigidbody.worldCenterOfMass, shipController.LastRcsTorque, torqueVectorScale, Color.yellow);
        DrawGizmoVector(targetRigidbody.worldCenterOfMass, shipController.LastMainGimbalTorque, torqueVectorScale, Color.red);
        DrawGizmoVector(targetRigidbody.worldCenterOfMass, shipController.LastCoreAppliedForce, forceVectorScale, Color.white);
        DrawGizmoVector(targetRigidbody.worldCenterOfMass, shipController.LastCoreAppliedTorque, torqueVectorScale, Color.blue);
    }

    private void DrawRuntimeDebugVectors()
    {
        if (targetRigidbody == null || shipController == null)
        {
            return;
        }

        DrawDebugVector(shipController.LastMainForcePositionWorld, shipController.LastMainForceWorld, forceVectorScale, Color.cyan);
        DrawDebugVector(shipController.LastMainForcePositionWorld, shipController.LastMainSteeringForceWorld, forceVectorScale, Color.magenta);
        DrawDebugVector(shipController.RcsControlPivotWorld, shipController.LastRcsTranslationForce, forceVectorScale, Color.green);
        DrawDebugVector(targetRigidbody.worldCenterOfMass, shipController.LastRcsTorque, torqueVectorScale, Color.yellow);
        DrawDebugVector(targetRigidbody.worldCenterOfMass, shipController.LastMainGimbalTorque, torqueVectorScale, Color.red);
        DrawDebugVector(targetRigidbody.worldCenterOfMass, shipController.LastCoreAppliedForce, forceVectorScale, Color.white);
        DrawDebugVector(targetRigidbody.worldCenterOfMass, shipController.LastCoreAppliedTorque, torqueVectorScale, Color.blue);
    }

    private static void DrawGizmoVector(Vector3 origin, Vector3 vector, float scale, Color color)
    {
        if (vector.sqrMagnitude <= 0.0001f || scale <= 0f)
        {
            return;
        }

        Gizmos.color = color;
        Gizmos.DrawLine(origin, origin + vector * scale);
    }

    private static void DrawDebugVector(Vector3 origin, Vector3 vector, float scale, Color color)
    {
        if (vector.sqrMagnitude <= 0.0001f || scale <= 0f)
        {
            return;
        }

        Debug.DrawLine(origin, origin + vector * scale, color, 0f, false);
    }

    private static string FormatVector(Vector3 value)
    {
        return $"({value.x:0.00}, {value.y:0.00}, {value.z:0.00})";
    }

    private static string FormatAxisMask(Vector3 value)
    {
        return $"P {(value.x > 0.5f ? "released" : "manual")}, Y {(value.y > 0.5f ? "released" : "manual")}, R {(value.z > 0.5f ? "released" : "manual")}";
    }

    public void Bind(Transform trackTarget, ShipStats stats, Rigidbody rb)
    {
        target = trackTarget;
        targetStats = stats;
        targetRigidbody = rb;
        followCamera = GetComponent<SimpleFollowCamera>();
        shipController = trackTarget != null ? trackTarget.GetComponent<PlayerShipController>() : null;
    }

    private static string Shorten(string value, int maxLength)
    {
        if (string.IsNullOrEmpty(value) || value.Length <= maxLength)
        {
            return string.IsNullOrEmpty(value) ? "none" : value;
        }

        return value.Substring(0, Mathf.Max(0, maxLength - 3)) + "...";
    }
}
