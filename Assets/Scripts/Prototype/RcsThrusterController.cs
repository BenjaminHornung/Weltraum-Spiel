using UnityEngine;

[RequireComponent(typeof(Rigidbody))]
public class RcsThrusterController : MonoBehaviour
{
    [System.Serializable]
    private class RcsNozzle
    {
        public string id;
        public Transform transform;
        public GameObject vfx;
        public RcsThrusterBlock block;
        public bool active;
    }


    private class RcsAllocation
    {
        public RcsNozzle nozzle;
        public Vector3 position;
        public Vector3 forceAtFull;
        public Vector3 torqueAtFull;
        public float maxThrust;
        public float throttle;
    }

    [Header("RCS Tuning")]
    [SerializeField] private float translationForce = 9000f;
    [SerializeField] private float attitudeForce = 6500f;
    [SerializeField] private float sasAuthority = 1.8f;
    [SerializeField] private float minSelectionDot = 0.25f;

    [Header("RCS Response")]
    [SerializeField] private float nozzleSpoolUpRate;
    [SerializeField] private float nozzleSpoolDownRate;

    [Header("SAS PD Control")]
    [SerializeField] private float sasProportionalGain = 0.75f;
    [SerializeField] private float sasDerivativeGain = 1.8f;

    [SerializeField] private Rigidbody shipRigidbody;
    [SerializeField] private ShipPhysicsCore physicsCore;
    [SerializeField] private ShipStats shipStats;

    [Header("Installed RCS Thrusters")]
    [SerializeField] private Transform upThruster;
    [SerializeField] private Transform downThruster;
    [SerializeField] private Transform leftThruster;
    [SerializeField] private Transform rightThruster;
    [SerializeField] private Transform forwardThruster;
    [SerializeField] private Transform backThruster;

    private readonly System.Collections.Generic.List<RcsNozzle> nozzles = new System.Collections.Generic.List<RcsNozzle>();
    private readonly System.Text.StringBuilder activeNozzleBuilder = new System.Text.StringBuilder(160);
    private int cachedNozzleCount = -1;
    private const float ManualCommandDeadZone = 0.05f;
    private const float SasAngularVelocityDeadZone = 0.0025f;
    private const float SasAngularVelocitySettleThreshold = 0.0025f;
    private const float SasCommandDeadZone = 0.0001f;

    public float TranslationForce => Mathf.Max(0f, translationForce);
    public float AttitudeForce => Mathf.Max(0f, attitudeForce);
    public float SasAuthority => Mathf.Max(0f, sasDerivativeGain);
    public float SasProportionalGain => Mathf.Max(0f, sasProportionalGain);
    public float SasDerivativeGain => Mathf.Max(0f, sasDerivativeGain);
    public float MinSelectionDot => Mathf.Clamp(minSelectionDot, 0f, 0.95f);
    public float NozzleSpoolUpRate => Mathf.Max(0f, nozzleSpoolUpRate);
    public float NozzleSpoolDownRate => Mathf.Max(0f, nozzleSpoolDownRate);
public bool RcsEnabled { get; private set; } = true;
    public bool HasRcs => InstalledNozzleCount > 0;
    public bool CanApplyRcs => RcsEnabled && HasRcs;
    public int InstalledNozzleCount
    {
        get
        {
            RefreshNozzlesIfNeeded();
            return nozzles.Count;
        }
    }
    public int ActiveNozzleCount { get; private set; }
    public string ActiveNozzleIds { get; private set; } = string.Empty;
    public Vector3 ControlPivotLocal { get; private set; }
    public Vector3 ControlPivotWorld => shipRigidbody != null ? shipRigidbody.worldCenterOfMass : transform.TransformPoint(ControlPivotLocal);
    public Vector3 LastTranslationCommand { get; private set; }
    public Vector3 LastAttitudeCommand { get; private set; }
        public Vector3 LastRawSasCommand { get; private set; }
    public Vector3 LastSasReleasedAxes { get; private set; } = Vector3.one;
public Vector3 LastSasCommand { get; private set; }
    public SasControlMode LastSasMode { get; private set; } = SasControlMode.KillRotation;
    public bool LastSasTargetRotationValid { get; private set; }
    public Quaternion LastSasTargetRotation { get; private set; } = Quaternion.identity;
    public Vector3 LastSasAngularVelocityLocal { get; private set; }
    public Vector3 LastSasAngularErrorLocal { get; private set; }
    public Vector3 LastRawSasDesiredTorqueLocal { get; private set; }
    public Vector3 LastSasDesiredTorqueLocal { get; private set; }
    public Vector3 LastSasDesiredTorqueWorld { get; private set; }
    public Vector3 LastSasManualOverrideAxes { get; private set; }
    public Vector3 LastSasSuppressedTorqueLocal { get; private set; }
    public FlightAssistRequest LastFlightAssistRequest { get; private set; } = FlightAssistRequest.None;
    public FlightAssistMode LastFlightAssistMode => LastFlightAssistRequest.mode;
    public FlightAssistRequestSource LastFlightAssistSource => LastFlightAssistRequest.source;
    public Vector3 LastFlightAssistForceWorld => LastFlightAssistRequest.forceWorld;
    public Vector3 LastFlightAssistDesiredTorqueLocal => LastFlightAssistRequest.torqueLocal;
    public Vector3 LastFlightAssistDesiredTorqueWorld { get; private set; }
    public bool LastFlightAssistDebugOnly => LastFlightAssistRequest.debugOnlyNonPhysical;
    public Vector3 LastManualDesiredTorqueLocal { get; private set; }
    public Vector3 LastDesiredTorqueLocal { get; private set; }
    public Vector3 LastTranslationForce { get; private set; }
    public Vector3 LastTorque { get; private set; }
    public Vector3 LastForceAtPositionTotal { get; private set; }
    public Vector3 LastYawForceWorld { get; private set; }
    public Vector3 LastYawTorqueEstimate { get; private set; }
    public float LastMaxNozzleThrottle { get; private set; }
    public float LastAllocatedNozzleThrottleTotal { get; private set; }
    public int LastNozzleApplicationCount { get; private set; }
    public float LastFuelRequestedKg { get; private set; }
    public float LastFuelConsumedKg { get; private set; }
    public float LastAppliedFuelFraction { get; private set; } = 1f;

    private void Awake()
    {
        ResolveReferences();
        ResolveLegacyBlockReferences();
        RefreshNozzles();
        ClearNozzleVfx();
    }

    public void ConfigureThrusters(Transform up, Transform down, Transform left, Transform right, Rigidbody body)
    {
        ConfigureThrusters(up, down, left, right, null, null, body);
    }

    public void ConfigureThrusters(Transform up, Transform down, Transform left, Transform right, Transform forward, Transform back, Rigidbody body)
    {
        ConfigureThrusters(up, down, left, right, forward, back, body, null);
    }

    public void ConfigureThrusters(Transform up, Transform down, Transform left, Transform right, Transform forward, Transform back, Rigidbody body, ShipPhysicsCore core)
    {
        upThruster = up != null ? up : upThruster;
        downThruster = down != null ? down : downThruster;
        leftThruster = left != null ? left : leftThruster;
        rightThruster = right != null ? right : rightThruster;
        forwardThruster = forward != null ? forward : forwardThruster;
        backThruster = back != null ? back : backThruster;
        shipRigidbody = body != null ? body : shipRigidbody;
        physicsCore = core != null ? core : physicsCore;
        ResolveReferences();
        RefreshNozzles();
    }

    public void SetRcsEnabled(bool enabled)
    {
        RcsEnabled = enabled;
        if (!RcsEnabled)
        {
            ClearRuntimeForces();
            ClearNozzleVfx();
        }
    }

    private void ResolveReferences()
    {
        if (shipRigidbody == null)
        {
            shipRigidbody = GetComponent<Rigidbody>();
        }

        if (physicsCore == null)
        {
            physicsCore = GetComponent<ShipPhysicsCore>();
        }

        if (shipStats == null)
        {
            shipStats = GetComponent<ShipStats>();
        }

        if (physicsCore != null && shipRigidbody == null)
        {
            shipRigidbody = physicsCore.ShipRigidbody;
        }
    }

    private void ResolveLegacyBlockReferences()
    {
        upThruster = upThruster != null ? upThruster : transform.Find("RCS_Top");
        downThruster = downThruster != null ? downThruster : transform.Find("RCS_Bottom");
        leftThruster = leftThruster != null ? leftThruster : transform.Find("RCS_Left");
        rightThruster = rightThruster != null ? rightThruster : transform.Find("RCS_Right");
        forwardThruster = forwardThruster != null ? forwardThruster : transform.Find("RCS_Forward");
        backThruster = backThruster != null ? backThruster : transform.Find("RCS_Back");
    }

    private void RefreshNozzlesIfNeeded()
    {
        int actualCount = 0;
        foreach (Transform child in transform.GetComponentsInChildren<Transform>(true))
        {
            if (child != transform && IsActiveNozzleTransform(child))
            {
                actualCount++;
            }
        }

        if (actualCount != cachedNozzleCount || actualCount != nozzles.Count)
        {
            RefreshNozzles();
        }
    }

    public void RefreshNozzles()
    {
        nozzles.Clear();
        cachedNozzleCount = 0;
        Vector3 localSum = Vector3.zero;

        foreach (Transform child in transform.GetComponentsInChildren<Transform>(true))
        {
            if (child == transform || !IsActiveNozzleTransform(child))
            {
                continue;
            }

            var nozzle = new RcsNozzle
            {
                id = child.name,
                transform = child,
                vfx = FindNozzleVfx(child),
                block = FindNozzleBlock(child),
                active = false
            };
            nozzles.Add(nozzle);
            localSum += transform.InverseTransformPoint(child.position);
            cachedNozzleCount++;
        }

        ControlPivotLocal = nozzles.Count > 0 ? localSum / nozzles.Count : Vector3.zero;
    }

    private static bool IsActiveNozzleTransform(Transform nozzle)
    {
        return nozzle != null
            && nozzle.gameObject.activeInHierarchy
            && nozzle.name.StartsWith("RCS_Nozzle_", System.StringComparison.Ordinal);
    }

    private static GameObject FindNozzleVfx(Transform nozzle)
    {
        var vfx = nozzle.Find("VFX");
        return vfx != null ? vfx.gameObject : null;
    }

    public void RecomputeControlPivot()
    {
        RefreshNozzles();
    }

public void ApplyControls(Vector3 translationCommand, Vector3 attitudeCommand, bool stabilizeAngular, float deltaTime)
    {
        ApplyControls(translationCommand, attitudeCommand, stabilizeAngular, SasControlMode.KillRotation, transform.rotation, false, FlightAssistRequest.None, deltaTime);
    }

    public void ApplyControls(
        Vector3 translationCommand,
        Vector3 attitudeCommand,
        bool stabilizeAngular,
        SasControlMode sasMode,
        Quaternion sasTargetRotation,
        bool hasSasTargetRotation,
        float deltaTime)
    {
        ApplyControls(translationCommand, attitudeCommand, stabilizeAngular, sasMode, sasTargetRotation, hasSasTargetRotation, FlightAssistRequest.None, deltaTime);
    }

    public void ApplyControls(
        Vector3 translationCommand,
        Vector3 attitudeCommand,
        bool stabilizeAngular,
        SasControlMode sasMode,
        Quaternion sasTargetRotation,
        bool hasSasTargetRotation,
        FlightAssistRequest flightAssistRequest,
        float deltaTime)
    {
        ResolveReferences();
        ResolveLegacyBlockReferences();
        RefreshNozzlesIfNeeded();

        LastTranslationCommand = Vector3.ClampMagnitude(translationCommand, 1f);
        Vector3 manualAttitude = Vector3.ClampMagnitude(attitudeCommand, 1f);
        LastSasMode = sasMode;
        LastSasTargetRotation = sasTargetRotation;
        LastSasTargetRotationValid = hasSasTargetRotation;
        LastFlightAssistRequest = flightAssistRequest;
        LastFlightAssistDesiredTorqueWorld = transform.TransformDirection(flightAssistRequest.torqueLocal);
        if (!stabilizeAngular || shipRigidbody == null)
        {
            LastSasAngularVelocityLocal = Vector3.zero;
            LastSasAngularErrorLocal = Vector3.zero;
            LastRawSasDesiredTorqueLocal = Vector3.zero;
        }

        Vector3 sasCommand = stabilizeAngular && shipRigidbody != null
            ? ComputeSasCommand(sasMode, sasTargetRotation, hasSasTargetRotation)
            : Vector3.zero;
        LastRawSasCommand = sasCommand;
        LastSasReleasedAxes = GetSasReleasedAxes(manualAttitude);
        LastSasManualOverrideAxes = Vector3.one - LastSasReleasedAxes;
        LastSasCommand = MaskSasForManualAxes(sasCommand, manualAttitude);
        LastSasDesiredTorqueLocal = MaskSasForManualAxes(LastRawSasDesiredTorqueLocal, manualAttitude);
        LastSasSuppressedTorqueLocal = LastRawSasDesiredTorqueLocal - LastSasDesiredTorqueLocal;
        if (stabilizeAngular && shipRigidbody != null)
        {
            SettleTinySasAngularVelocity(manualAttitude);
        }

        LastAttitudeCommand = Vector3.ClampMagnitude(manualAttitude + LastSasCommand, 1f);
        Vector3 desiredForceWorld = transform.TransformDirection(LastTranslationCommand) * Mathf.Max(0f, translationForce);
        if (flightAssistRequest.HasPhysicalRequest)
        {
            desiredForceWorld += flightAssistRequest.forceWorld;
        }

        float torqueAuthority = GetTorqueAuthority();
        LastManualDesiredTorqueLocal = Vector3.ClampMagnitude(manualAttitude, 1f) * torqueAuthority;
        Vector3 assistTorqueLocal = flightAssistRequest.HasPhysicalRequest ? flightAssistRequest.torqueLocal : Vector3.zero;
        Vector3 desiredTorqueLocal = Vector3.ClampMagnitude(LastManualDesiredTorqueLocal + LastSasDesiredTorqueLocal + assistTorqueLocal, torqueAuthority);
        LastDesiredTorqueLocal = desiredTorqueLocal;
        Vector3 desiredTorqueWorld = transform.TransformDirection(desiredTorqueLocal);
        LastSasDesiredTorqueWorld = transform.TransformDirection(LastSasDesiredTorqueLocal);
        ClearRuntimeForces();

        if (shipRigidbody == null || physicsCore == null || !CanApplyRcs)
        {
            ClearNozzleVfx();
            return;
        }

        AllocateAndApplyRcs(desiredForceWorld, desiredTorqueWorld, manualAttitude, deltaTime);
        ApplyNozzleVfx();
    }

    private Vector3 ComputeSasCommand(SasControlMode sasMode, Quaternion sasTargetRotation, bool hasSasTargetRotation)
    {
        if (shipRigidbody == null)
        {
            return Vector3.zero;
        }

        float torqueAuthority = GetTorqueAuthority();
        LastRawSasDesiredTorqueLocal = ComputeSasDesiredTorqueLocal(sasMode, sasTargetRotation, hasSasTargetRotation, torqueAuthority);
        if (torqueAuthority <= 0.0001f)
        {
            return Vector3.zero;
        }

        return Vector3.ClampMagnitude(LastRawSasDesiredTorqueLocal / torqueAuthority, 1f);
    }

    private Vector3 ComputeSasDesiredTorqueLocal(SasControlMode sasMode, Quaternion sasTargetRotation, bool hasSasTargetRotation, float torqueAuthority)
    {
        Vector3 localAngularVelocity = transform.InverseTransformDirection(shipRigidbody.angularVelocity);
        localAngularVelocity.x = ApplySasAngularVelocityDeadZone(localAngularVelocity.x);
        localAngularVelocity.y = ApplySasAngularVelocityDeadZone(localAngularVelocity.y);
        localAngularVelocity.z = ApplySasAngularVelocityDeadZone(localAngularVelocity.z);
        LastSasAngularVelocityLocal = localAngularVelocity;

        Vector3 angularError = sasMode == SasControlMode.HoldAttitude && hasSasTargetRotation
            ? ComputeAngularErrorLocal(sasTargetRotation)
            : Vector3.zero;
        LastSasAngularErrorLocal = angularError;

        float derivativeGain = SasDerivativeGain * torqueAuthority;
        float proportionalGain = sasMode == SasControlMode.HoldAttitude ? SasProportionalGain * torqueAuthority : 0f;
        Vector3 desiredTorque = angularError * proportionalGain - localAngularVelocity * derivativeGain;
        return Vector3.ClampMagnitude(desiredTorque, torqueAuthority);
    }

    private Vector3 ComputeAngularErrorLocal(Quaternion targetRotation)
    {
        Quaternion error = targetRotation * Quaternion.Inverse(transform.rotation);
        if (error.w < 0f)
        {
            error.x = -error.x;
            error.y = -error.y;
            error.z = -error.z;
            error.w = -error.w;
        }

        error.ToAngleAxis(out float angleDegrees, out Vector3 axisWorld);
        if (float.IsNaN(axisWorld.x) || axisWorld.sqrMagnitude <= 0.0001f)
        {
            return Vector3.zero;
        }

        if (angleDegrees > 180f)
        {
            angleDegrees -= 360f;
        }

        Vector3 errorWorld = axisWorld.normalized * (angleDegrees * Mathf.Deg2Rad);
        return transform.InverseTransformDirection(errorWorld);
    }

    private static float ApplySasAngularVelocityDeadZone(float angularVelocity)
    {
        return Mathf.Abs(angularVelocity) <= SasAngularVelocityDeadZone ? 0f : angularVelocity;
    }

    private void SettleTinySasAngularVelocity(Vector3 manualAttitude)
    {
        Vector3 localAngularVelocity = transform.InverseTransformDirection(shipRigidbody.angularVelocity);
        bool settledX = TrySettleAxis(ref localAngularVelocity.x, manualAttitude.x);
        bool settledY = TrySettleAxis(ref localAngularVelocity.y, manualAttitude.y);
        bool settledZ = TrySettleAxis(ref localAngularVelocity.z, manualAttitude.z);

        if (settledX || settledY || settledZ)
        {
            shipRigidbody.angularVelocity = transform.TransformDirection(localAngularVelocity);
        }
    }

    private static bool TrySettleAxis(ref float localAngularVelocity, float manualCommand)
    {
        if (Mathf.Abs(manualCommand) > ManualCommandDeadZone || Mathf.Abs(localAngularVelocity) > SasAngularVelocitySettleThreshold)
        {
            return false;
        }

        localAngularVelocity = 0f;
        return true;
    }

private void ClearRuntimeForces()
    {
        LastTranslationForce = Vector3.zero;
        LastTorque = Vector3.zero;
        LastForceAtPositionTotal = Vector3.zero;
        LastYawForceWorld = Vector3.zero;
        LastYawTorqueEstimate = Vector3.zero;
        LastMaxNozzleThrottle = 0f;
        LastAllocatedNozzleThrottleTotal = 0f;
        LastNozzleApplicationCount = 0;
        LastFuelRequestedKg = 0f;
        LastFuelConsumedKg = 0f;
        LastAppliedFuelFraction = 1f;
        ActiveNozzleCount = 0;
        ActiveNozzleIds = string.Empty;
        activeNozzleBuilder.Length = 0;
        for (int i = 0; i < nozzles.Count; i++)
        {
            nozzles[i].active = false;
        }
    }

    private void ApplyTranslationForces()
    {
        ApplyLinearDemand(transform.right, LastTranslationCommand.x, translationForce, true);
        ApplyLinearDemand(transform.up, LastTranslationCommand.y, translationForce, true);
        ApplyLinearDemand(transform.forward, LastTranslationCommand.z, translationForce, true);
    }

    private void ApplyLinearDemand(Vector3 positiveDirection, float command, float fallbackForceScale, bool translation)
    {
        if (Mathf.Abs(command) <= 0.05f)
        {
            return;
        }

        Vector3 desiredForceDirection = (positiveDirection * Mathf.Sign(command)).normalized;
        ApplyNozzleSet(desiredForceDirection, Mathf.Abs(command), fallbackForceScale, translation, Vector3.zero);
    }

    private void ApplyAttitudeForces(Vector3 manualAttitude)
    {
        ApplyTorqueDemand(transform.right, SelectAttitudeCommand(manualAttitude.x, LastSasCommand.x, LastAttitudeCommand.x), attitudeForce, false, SelectAttitudeDeadZone(manualAttitude.x));
        ApplyTorqueDemand(transform.up, SelectAttitudeCommand(manualAttitude.y, LastSasCommand.y, LastAttitudeCommand.y), attitudeForce, true, SelectAttitudeDeadZone(manualAttitude.y));
        ApplyTorqueDemand(transform.forward, SelectAttitudeCommand(manualAttitude.z, LastSasCommand.z, LastAttitudeCommand.z), attitudeForce, false, SelectAttitudeDeadZone(manualAttitude.z));
    }

    private static float SelectAttitudeCommand(float manualCommand, float sasCommand, float combinedCommand)
    {
        return Mathf.Abs(manualCommand) > ManualCommandDeadZone ? combinedCommand : sasCommand;
    }

    private static float SelectAttitudeDeadZone(float manualCommand)
    {
        return Mathf.Abs(manualCommand) > ManualCommandDeadZone ? ManualCommandDeadZone : SasCommandDeadZone;
    }

private void ApplyTorqueDemand(Vector3 positiveAxis, float command, float fallbackForceScale, bool recordYaw, float commandDeadZone)
    {
        if (Mathf.Abs(command) <= commandDeadZone || shipRigidbody == null)
        {
            return;
        }

        Vector3 desiredTorqueAxis = (positiveAxis * Mathf.Sign(command)).normalized;
        float commandMagnitude = Mathf.Abs(command);
        Vector3 attitudeForceTotal = Vector3.zero;

        for (int i = 0; i < nozzles.Count; i++)
        {
            RcsNozzle nozzle = nozzles[i];
            if (!IsActiveNozzleTransform(nozzle.transform))
            {
                continue;
            }

            Vector3 forceDirection = GetNozzleForceDirection(nozzle.transform);
            Vector3 torqueAxis = Vector3.Cross(nozzle.transform.position - shipRigidbody.worldCenterOfMass, forceDirection);
            if (torqueAxis.sqrMagnitude <= 0.0001f)
            {
                continue;
            }

            float alignment = Vector3.Dot(torqueAxis.normalized, desiredTorqueAxis);
            if (alignment <= Mathf.Clamp(minSelectionDot, 0f, 0.95f))
            {
                continue;
            }

            float nozzleThrust = GetNozzleThrust(nozzle, fallbackForceScale);
            Vector3 force = forceDirection * (commandMagnitude * nozzleThrust * alignment);
            ApplyForceAtNozzle(nozzle, force, false, recordYaw);
            attitudeForceTotal += force;
        }

        NeutralizeAttitudeLinearForce(attitudeForceTotal);
    }

private void NeutralizeAttitudeLinearForce(Vector3 attitudeForceTotal)
    {
        if (shipRigidbody == null || attitudeForceTotal.sqrMagnitude <= 0.0001f)
        {
            return;
        }

        Vector3 counterForce = -attitudeForceTotal;
        physicsCore.ApplyForceAtCenterOfMass(counterForce, ForceMode.Force);
        LastForceAtPositionTotal += counterForce;
    }


    private void ApplyNozzleSet(Vector3 desiredForceDirection, float commandMagnitude, float fallbackForceScale, bool translation, Vector3 torqueAxisForDebug)
    {
        for (int i = 0; i < nozzles.Count; i++)
        {
            RcsNozzle nozzle = nozzles[i];
            if (!IsActiveNozzleTransform(nozzle.transform))
            {
                continue;
            }

            Vector3 forceDirection = GetNozzleForceDirection(nozzle.transform);
            float alignment = Vector3.Dot(forceDirection, desiredForceDirection);
            if (alignment <= Mathf.Clamp(minSelectionDot, 0f, 0.95f))
            {
                continue;
            }

            float nozzleThrust = GetNozzleThrust(nozzle, fallbackForceScale);
            Vector3 force = forceDirection * (commandMagnitude * nozzleThrust * alignment);
            ApplyForceAtNozzle(nozzle, force, translation, false);
        }
    }

    private static Vector3 GetSasReleasedAxes(Vector3 manualAttitude)
    {
        return new Vector3(
            Mathf.Abs(manualAttitude.x) > ManualCommandDeadZone ? 0f : 1f,
            Mathf.Abs(manualAttitude.y) > ManualCommandDeadZone ? 0f : 1f,
            Mathf.Abs(manualAttitude.z) > ManualCommandDeadZone ? 0f : 1f);
    }

    private static Vector3 MaskSasForManualAxes(Vector3 sasCommand, Vector3 manualAttitude)
    {
        if (Mathf.Abs(manualAttitude.x) > ManualCommandDeadZone)
        {
            sasCommand.x = 0f;
        }

        if (Mathf.Abs(manualAttitude.y) > ManualCommandDeadZone)
        {
            sasCommand.y = 0f;
        }

        if (Mathf.Abs(manualAttitude.z) > ManualCommandDeadZone)
        {
            sasCommand.z = 0f;
        }

        return sasCommand;
    }

    private static RcsThrusterBlock FindNozzleBlock(Transform nozzle)
    {
        Transform current = nozzle;
        while (current != null)
        {
            var block = current.GetComponent<RcsThrusterBlock>();
            if (block != null)
            {
                return block;
            }

            current = current.parent;
        }

        return null;
    }

    private static float GetNozzleThrust(RcsNozzle nozzle, float fallbackForceScale)
    {
        if (nozzle != null && nozzle.block != null)
        {
            return nozzle.block.Thrust;
        }

        return Mathf.Max(0f, fallbackForceScale);
    }


    private static Vector3 GetNozzleForceDirection(Transform nozzle)
    {
        Vector3 direction = nozzle.forward;
        if (direction.sqrMagnitude <= 0.0001f)
        {
            direction = nozzle.parent != null ? nozzle.parent.forward : Vector3.forward;
        }

        return direction.normalized;
    }

private void ApplyForceAtNozzle(RcsNozzle nozzle, Vector3 forceWorld, bool translation, bool recordYaw)
    {
        if (shipRigidbody == null || nozzle == null || !IsActiveNozzleTransform(nozzle.transform) || forceWorld.sqrMagnitude <= 0.0001f)
        {
            return;
        }

        Vector3 torque = Vector3.zero;
        if (translation)
        {
            physicsCore.ApplyForceAtCenterOfMass(forceWorld, ForceMode.Force);
            LastTranslationForce += forceWorld;
        }
        else
        {
            Vector3 position = nozzle.transform.position;
            physicsCore.ApplyForceAtPosition(forceWorld, position, ForceMode.Force);
            torque = Vector3.Cross(position - shipRigidbody.worldCenterOfMass, forceWorld);
            LastTorque += torque;
        }

        LastForceAtPositionTotal += forceWorld;
        nozzle.active = true;

        if (recordYaw)
        {
            LastYawForceWorld += forceWorld;
            LastYawTorqueEstimate += torque;
        }
    }

    private void ApplyNozzleVfx()
    {
        ActiveNozzleCount = 0;
        activeNozzleBuilder.Length = 0;

        for (int i = 0; i < nozzles.Count; i++)
        {
            RcsNozzle nozzle = nozzles[i];
            bool active = RcsEnabled && nozzle.active;
            SetActive(nozzle.vfx, active);
            if (!active)
            {
                continue;
            }

            ActiveNozzleCount++;
            if (activeNozzleBuilder.Length > 0)
            {
                activeNozzleBuilder.Append(", ");
            }

            activeNozzleBuilder.Append(nozzle.id);
        }

        ActiveNozzleIds = activeNozzleBuilder.ToString();
    }

    private void ClearNozzleVfx()
    {
        ActiveNozzleCount = 0;
        ActiveNozzleIds = string.Empty;
        for (int i = 0; i < nozzles.Count; i++)
        {
            nozzles[i].active = false;
            SetActive(nozzles[i].vfx, false);
        }
    }

    private static void SetActive(GameObject target, bool active)
    {
        if (target != null && target.activeSelf != active)
        {
            target.SetActive(active);
        }
    }

    private void OnValidate()
    {
        translationForce = Mathf.Max(0f, translationForce);
        attitudeForce = Mathf.Max(0f, attitudeForce);
        sasAuthority = Mathf.Max(0f, sasAuthority);
        sasProportionalGain = Mathf.Max(0f, sasProportionalGain);
        sasDerivativeGain = Mathf.Max(0f, sasDerivativeGain);
        minSelectionDot = Mathf.Clamp(minSelectionDot, 0f, 0.95f);
        nozzleSpoolUpRate = Mathf.Max(0f, nozzleSpoolUpRate);
        nozzleSpoolDownRate = Mathf.Max(0f, nozzleSpoolDownRate);
    }


public void ApplyConfig(PrototypeShipConfig config)
    {
        if (config == null)
        {
            return;
        }

        PrototypeRcsSettings settings = config.Rcs;
        settings.Clamp();
        translationForce = settings.translationForce;
        attitudeForce = settings.attitudeForce;
        sasAuthority = settings.sasAuthority;
        sasDerivativeGain = settings.sasAuthority;
        minSelectionDot = settings.minSelectionDot;
        nozzleSpoolUpRate = settings.nozzleSpoolUpRate;
        nozzleSpoolDownRate = settings.nozzleSpoolDownRate;
        RefreshNozzles();
    }


private void AllocateAndApplyRcs(Vector3 desiredForceWorld, Vector3 desiredTorqueWorld, Vector3 manualAttitude, float deltaTime)
    {
        if (desiredForceWorld.sqrMagnitude <= 0.0001f && desiredTorqueWorld.sqrMagnitude <= 0.0001f)
        {
            return;
        }

        RcsAllocation[] allocations = BuildAllocationData();
        if (allocations.Length == 0)
        {
            return;
        }

        float forceWeight;
        float torqueWeight;
        GetAllocatorWeights(desiredForceWorld, desiredTorqueWorld, out forceWeight, out torqueWeight);
        AllocateThrottleGreedy(allocations, desiredForceWorld, desiredTorqueWorld, forceWeight, torqueWeight);
        ApplyAllocatedForces(allocations, desiredForceWorld, manualAttitude, deltaTime);
    }

    private RcsAllocation[] BuildAllocationData()
    {
        var allocations = new System.Collections.Generic.List<RcsAllocation>(nozzles.Count);
        for (int i = 0; i < nozzles.Count; i++)
        {
            RcsNozzle nozzle = nozzles[i];
            if (!IsActiveNozzleTransform(nozzle.transform))
            {
                continue;
            }

            float maxThrust = GetNozzleThrust(nozzle, Mathf.Max(attitudeForce, translationForce));
            if (maxThrust <= 0.0001f)
            {
                continue;
            }

            Vector3 forceAtFull = GetNozzleForceDirection(nozzle.transform) * maxThrust;
            Vector3 position = nozzle.transform.position;
            Vector3 lever = position - shipRigidbody.worldCenterOfMass;
            allocations.Add(new RcsAllocation
            {
                nozzle = nozzle,
                position = position,
                forceAtFull = forceAtFull,
                torqueAtFull = Vector3.Cross(lever, forceAtFull),
                maxThrust = maxThrust,
                throttle = 0f
            });
        }

        return allocations.ToArray();
    }

    private float GetTorqueAuthority()
    {
        float representativeLever = 0f;
        int leverCount = 0;
        if (shipRigidbody != null)
        {
            Vector3 centerOfMass = shipRigidbody.worldCenterOfMass;
            for (int i = 0; i < nozzles.Count; i++)
            {
                RcsNozzle nozzle = nozzles[i];
                if (!IsActiveNozzleTransform(nozzle.transform))
                {
                    continue;
                }

                representativeLever += (nozzle.transform.position - centerOfMass).magnitude;
                leverCount++;
            }
        }

        if (leverCount > 0)
        {
            representativeLever /= leverCount;
        }

        representativeLever = Mathf.Max(0.25f, representativeLever);
        return Mathf.Max(0f, attitudeForce) * representativeLever;
    }

    private static void GetAllocatorWeights(Vector3 desiredForceWorld, Vector3 desiredTorqueWorld, out float forceWeight, out float torqueWeight)
    {
        bool wantsForce = desiredForceWorld.sqrMagnitude > 0.0001f;
        bool wantsTorque = desiredTorqueWorld.sqrMagnitude > 0.0001f;
        if (wantsForce && !wantsTorque)
        {
            forceWeight = 1f;
            torqueWeight = 3f;
            return;
        }

        if (!wantsForce && wantsTorque)
        {
            forceWeight = 3f;
            torqueWeight = 1f;
            return;
        }

        forceWeight = 1.5f;
        torqueWeight = 1.5f;
    }

    private static void AllocateThrottleGreedy(RcsAllocation[] allocations, Vector3 desiredForceWorld, Vector3 desiredTorqueWorld, float forceWeight, float torqueWeight)
    {
        const int MaxPasses = 32;
        const float MinImprovement = 0.0001f;

        Vector3 residualForce = desiredForceWorld;
        Vector3 residualTorque = desiredTorqueWorld;
        for (int pass = 0; pass < MaxPasses; pass++)
        {
            int bestIndex = -1;
            float bestDelta = 0f;
            float bestImprovement = 0f;

            for (int i = 0; i < allocations.Length; i++)
            {
                RcsAllocation allocation = allocations[i];
                float remainingThrottle = 1f - allocation.throttle;
                if (remainingThrottle <= 0.0001f)
                {
                    continue;
                }

                float denominator = WeightedMagnitudeSquared(allocation.forceAtFull, allocation.torqueAtFull, forceWeight, torqueWeight);
                if (denominator <= 0.0001f)
                {
                    continue;
                }

                float numerator = forceWeight * Vector3.Dot(residualForce, allocation.forceAtFull)
                    + torqueWeight * Vector3.Dot(residualTorque, allocation.torqueAtFull);
                float delta = Mathf.Clamp(numerator / denominator, 0f, remainingThrottle);
                if (delta <= 0.0001f)
                {
                    continue;
                }

                Vector3 newResidualForce = residualForce - allocation.forceAtFull * delta;
                Vector3 newResidualTorque = residualTorque - allocation.torqueAtFull * delta;
                float improvement = WeightedMagnitudeSquared(residualForce, residualTorque, forceWeight, torqueWeight)
                    - WeightedMagnitudeSquared(newResidualForce, newResidualTorque, forceWeight, torqueWeight);
                if (improvement > bestImprovement)
                {
                    bestImprovement = improvement;
                    bestDelta = delta;
                    bestIndex = i;
                }
            }

            if (bestIndex < 0 || bestImprovement <= MinImprovement)
            {
                break;
            }

            allocations[bestIndex].throttle = Mathf.Clamp01(allocations[bestIndex].throttle + bestDelta);
            residualForce -= allocations[bestIndex].forceAtFull * bestDelta;
            residualTorque -= allocations[bestIndex].torqueAtFull * bestDelta;
        }
    }

    private static float WeightedMagnitudeSquared(Vector3 force, Vector3 torque, float forceWeight, float torqueWeight)
    {
        return force.sqrMagnitude * forceWeight + torque.sqrMagnitude * torqueWeight;
    }

    private void ApplyAllocatedForces(RcsAllocation[] allocations, Vector3 desiredForceWorld, Vector3 manualAttitude, float deltaTime)
    {
        bool recordYaw = Mathf.Abs(manualAttitude.y) > ManualCommandDeadZone || Mathf.Abs(LastSasCommand.y) > SasCommandDeadZone;
        float totalAllocatedThrottle = 0f;
        for (int i = 0; i < allocations.Length; i++)
        {
            totalAllocatedThrottle += Mathf.Clamp01(allocations[i].throttle);
        }

        LastAllocatedNozzleThrottleTotal = totalAllocatedThrottle;
        float fuelFraction = ConsumeFuelForAllocatedThrottle(totalAllocatedThrottle, deltaTime);
        if (fuelFraction <= 0f)
        {
            return;
        }

        for (int i = 0; i < allocations.Length; i++)
        {
            RcsAllocation allocation = allocations[i];
            float throttle = Mathf.Clamp01(allocation.throttle) * fuelFraction;
            if (throttle <= 0.0001f)
            {
                continue;
            }

            Vector3 force = allocation.forceAtFull * throttle;
            physicsCore.ApplyForceAtPosition(force, allocation.position, ForceMode.Force);
            Vector3 torque = allocation.torqueAtFull * throttle;
            LastForceAtPositionTotal += force;
            LastTorque += torque;
            LastNozzleApplicationCount++;
            LastMaxNozzleThrottle = Mathf.Max(LastMaxNozzleThrottle, throttle);
            allocation.nozzle.active = true;

            if (recordYaw)
            {
                LastYawForceWorld += force;
                LastYawTorqueEstimate += torque;
            }
        }

        LastTranslationForce = desiredForceWorld * fuelFraction;
    }

    private float ConsumeFuelForAllocatedThrottle(float totalAllocatedThrottle, float deltaTime)
    {
        totalAllocatedThrottle = Mathf.Max(0f, totalAllocatedThrottle);
        if (totalAllocatedThrottle <= 0f)
        {
            return 1f;
        }

        if (shipStats != null)
        {
            LastFuelRequestedKg = shipStats.FuelConsumptionKgPerSecond * totalAllocatedThrottle * Mathf.Max(0f, deltaTime);
            LastFuelConsumedKg = shipStats.ConsumeFuelForThrust(totalAllocatedThrottle, deltaTime, out float fuelFraction);
            LastAppliedFuelFraction = fuelFraction;
            return fuelFraction;
        }

        LastFuelRequestedKg = 0f;
        LastFuelConsumedKg = 0f;
        LastAppliedFuelFraction = 1f;
        return 1f;
    }
}
