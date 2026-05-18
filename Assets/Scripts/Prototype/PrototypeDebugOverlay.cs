using UnityEngine;

[RequireComponent(typeof(Camera))]
public class PrototypeDebugOverlay : MonoBehaviour
{
    [SerializeField] private ShipStats targetStats;
    [SerializeField] private Rigidbody targetRigidbody;
    [SerializeField] private Transform target;
    [SerializeField] private PlayerShipController shipController;

    [SerializeField] private Vector2 windowPosition = new Vector2(16f, 16f);

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

        float speedMps = targetRigidbody.linearVelocity.magnitude;
        float speedKph = speedMps * 3.6f;
        Vector3 rcsTranslation = shipController != null ? shipController.RcsTranslationCommand : Vector3.zero;
        Vector3 rcsAttitude = shipController != null ? shipController.RcsAttitudeCommand : Vector3.zero;
        float throttlePercent = shipController != null ? shipController.MainThrottlePercent : targetStats.LastThrottle * 100f;
        float mainCommand = shipController != null ? shipController.MainThrustCommand : targetStats.LastThrottle;
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
        Vector3 angularVelocity = targetRigidbody.angularVelocity;        Vector3 rcsPivotLocal = shipController != null ? shipController.RcsControlPivotLocal : Vector3.zero;
        Vector3 centerOfMass = targetRigidbody.worldCenterOfMass;
        int installedNozzles = shipController != null ? shipController.InstalledRcsNozzleCount : 0;
        int activeNozzles = shipController != null ? shipController.ActiveRcsNozzleCount : 0;
        string activeNozzleIds = shipController != null ? shipController.ActiveRcsNozzleIds : string.Empty;
        Vector3 sasCommand = shipController != null ? shipController.LastRcsSasCommand : Vector3.zero;
        Vector3 rcsTranslationForce = shipController != null ? shipController.LastRcsTranslationForce : Vector3.zero;
        Vector3 rcsTorque = shipController != null ? shipController.LastRcsTorque : Vector3.zero;
        Vector3 mainStraight = shipController != null ? shipController.LastMainStraightForceWorld : Vector3.zero;
        Vector3 mainSteering = shipController != null ? shipController.LastMainSteeringForceWorld : Vector3.zero;
        Vector3 mainTorque = shipController != null ? shipController.LastMainGimbalTorque : Vector3.zero;

        Rect rect = new Rect(windowPosition.x, windowPosition.y, 560f, 470f);
        GUI.Box(rect, "Prototype Debug");

        GUILayout.BeginArea(new Rect(rect.x + 8f, rect.y + 22f, rect.width - 14f, rect.height - 20f));
        GUILayout.Label($"Fuel: {targetStats.CurrentFuelKg:0.0} / {targetStats.MaxFuelKg:0.0} kg", labelStyle);
        GUILayout.Label($"Speed: {speedMps:0.0} m/s ({speedKph:0.0} km/h)", labelStyle);
        GUILayout.Label($"Mass: {targetStats.CurrentMass:0.0} kg", labelStyle);
        GUILayout.Label($"Throttle: {throttlePercent:0}%", labelStyle);
        GUILayout.Label($"SAS: {(sasEnabled ? "on" : "off")} (effective {(effectiveSas ? "on" : "off")})", labelStyle);        GUILayout.Label($"RCS: installed {(hasRcs ? "yes" : "no")}, enabled {(rcsEnabled ? "yes" : "no")}, nozzles {activeNozzles}/{installedNozzles}", labelStyle);
        GUILayout.Label($"Precision: {(precision ? "on" : "off")}", labelStyle);
        GUILayout.Label($"Main: cmd {mainCommand:0.00}, thrust {targetStats.LastAppliedThrust:0} / {targetStats.Thrust:0} N", labelStyle);
        GUILayout.Label($"Forward accel: {forwardAcceleration:0.0} m/s^2", labelStyle);        GUILayout.Label($"COM world: {FormatVector(centerOfMass)}", labelStyle);
        GUILayout.Label($"Angular velocity: {FormatVector(angularVelocity)} rad/s", labelStyle);
        GUILayout.Label($"Turn input: {turnInput:0.00}", labelStyle);
        GUILayout.Label($"Attitude input: P {rcsAttitude.x:0.00}, Y {rcsAttitude.y:0.00}, R {rcsAttitude.z:0.00}", labelStyle);
        GUILayout.Label($"RCS move: L/R {rcsTranslation.x:0.00}, U/D {rcsTranslation.y:0.00}, F/B {rcsTranslation.z:0.00}", labelStyle);        GUILayout.Label($"RCS pivot local: {FormatVector(rcsPivotLocal)}", labelStyle);
        GUILayout.Label($"RCS SAS cmd: {FormatVector(sasCommand)}", labelStyle);
        GUILayout.Label($"RCS translate force: {FormatVector(rcsTranslationForce)}", labelStyle);
        GUILayout.Label($"RCS torque est: {FormatVector(rcsTorque)}", labelStyle);
        GUILayout.Label($"Gimbal: {(gimbalEnabled ? "on" : "off")} / {gimbalLimit:0.0} deg, response {gimbalResponse:0.00}, cmd Y {gimbalYaw:0.00} P {gimbalPitch:0.00}, angle {gimbalAngle:0.0}", labelStyle);
        GUILayout.Label($"Active nozzles: {Shorten(activeNozzleIds, 68)}", labelStyle);
        GUILayout.Label($"Main straight force: {FormatVector(mainStraight)}", labelStyle);
        GUILayout.Label($"Main steering force: {FormatVector(mainSteering)}", labelStyle);
        GUILayout.Label($"Main torque est: {FormatVector(mainTorque)}", labelStyle);
        GUILayout.EndArea();
    }

    private static string FormatVector(Vector3 value)
    {
        return $"({value.x:0.00}, {value.y:0.00}, {value.z:0.00})";
    }

    public void Bind(Transform trackTarget, ShipStats stats, Rigidbody rb)
    {
        target = trackTarget;
        targetStats = stats;
        targetRigidbody = rb;
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
