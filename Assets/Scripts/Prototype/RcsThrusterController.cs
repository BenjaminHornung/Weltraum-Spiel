using UnityEngine;
using System.Collections.Generic;

public enum RcsSolverMode
{
    StablePrototype,
    ExperimentalPhysicalNozzles
}

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
        public float actualThrottle;
        public Vector3 baseVfxScale;
        public Color baseVfxColor;
    }


    private struct RcsAllocation
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
    [SerializeField] private RcsSolverMode rcsSolverMode = RcsSolverMode.StablePrototype;

    [Header("Stable Prototype Angular Limits")]
    [SerializeField] private float manualAngularAccelerationLimitRadPerSec2 = 1.25f;
    [SerializeField] private float sasAngularAccelerationLimitRadPerSec2 = 4f;
    [SerializeField] private float maxManualAngularVelocityRadPerSec = 2.2f;
    [SerializeField] private float maxSasAngularVelocityRadPerSec = 3f;
    [SerializeField] private float maxStablePrototypeTorqueNm = 12000f;

    [Header("RCS Response")]
    [SerializeField] private float nozzleSpoolUpRate;
    [SerializeField] private float nozzleSpoolDownRate;

    [Header("RCS Visuals")]
    [SerializeField] private float minRcsNozzleThrottleForVfx = 0.015f;
    [SerializeField] private float activeRcsNozzleScaleBoost = 1.3f;
    [SerializeField] private float idleRcsNozzleScaleBoost = 0.35f;
    [SerializeField] private float vfxEmissiveBoost = 2.2f;

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
    private readonly List<RcsAllocation> allocationScratch = new List<RcsAllocation>(32);
    private readonly System.Text.StringBuilder activeNozzleBuilder = new System.Text.StringBuilder(160);
    private float[] actualThrottleScratch = new float[0];
    private int nozzleRefreshCount;
    private bool nozzlesDirty = true;
    private Transform cachedNozzleSearchRoot;
    private const float ManualCommandDeadZone = 0.05f;
    private const float SasAngularVelocityDeadZone = 0.0025f;
    private const float SasAngularVelocitySettleThreshold = 0.0025f;
    private const string AllocatorStatusIdle = "idle";
    private const string AllocatorStatusSpoolingDown = "spooling-down";
    private const string AllocatorStatusOk = "ok";
    private const string AllocatorStatusLimited = "limited";
    private const string AllocatorStatusResidual = "residual";
    private const string AllocatorStatusLimitedResidual = "limited-residual";
    private const string AllocatorStatusDisabled = "disabled";
    private const string AllocatorStatusNoNozzles = "no nozzles";
    private const string AllocatorStatusNoAuthority = "no authority";
    private const string AllocatorStatusNoSolution = "no solution";
    private const string AllocatorStatusFuelStarved = "no fuel";
    private const string AllocatorStatusComTranslationFallback = "com-translation-fallback";
    private const string AllocatorStatusStablePrototype = "stable-prototype";
    private const float AllocatorResidualForceTolerance = 0.5f;
    private const float AllocatorResidualTorqueTolerance = 0.5f;
    private const float AllocatorResidualLimitRatio = 0.05f;

    private const float SasCommandDeadZone = 0.0001f;
    private const float SasMinimumDampingTime = 0.12f;
    private const float SasHoldAngularVelocityLimit = 3f;
    private const string ImportedShipVisualName = "ImportedShipVisual";

    public float TranslationForce => Mathf.Max(0f, translationForce);
    public float AttitudeForce => Mathf.Max(0f, attitudeForce);
    public float SasAuthority => Mathf.Max(0f, sasAuthority);
    public float SasProportionalGain => Mathf.Max(0f, sasProportionalGain);
    public float SasDerivativeGain => Mathf.Max(0f, sasDerivativeGain);
    public float MinSelectionDot => Mathf.Clamp(minSelectionDot, 0f, 0.95f);
    public float NozzleSpoolUpRate => Mathf.Max(0f, nozzleSpoolUpRate);
    public float NozzleSpoolDownRate => Mathf.Max(0f, nozzleSpoolDownRate);
    public RcsSolverMode SolverMode => rcsSolverMode;
    public bool UseImportedFunctionalSockets { get; private set; }
    public int NozzleRefreshCount => nozzleRefreshCount;
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
    public int CopyNozzleSnapshot(System.Collections.Generic.List<RcsNozzleData> buffer)
    {
        if (buffer == null)
        {
            return 0;
        }

        buffer.Clear();
        int shipId = shipRigidbody != null ? shipRigidbody.GetHashCode() : 0;
        bool snapshotIsDirty = nozzlesDirty;
        for (int i = 0; i < nozzles.Count; i++)
        {
            RcsNozzle nozzle = nozzles[i];
            buffer.Add(CreateNozzleSnapshot(nozzle, i, shipId, nozzleRefreshCount, snapshotIsDirty));
        }

        return buffer.Count;
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
    public float LastComputedTorqueAuthority { get; private set; }
    public float LastPhysicalNozzleTorqueAuthority { get; private set; }
    public float LastStablePrototypeTorqueAuthority { get; private set; }
    public Vector3 LastDesiredRcsForceWorld { get; private set; }
    public Vector3 LastActualRcsForceWorld { get; private set; }
    public Vector3 LastResidualRcsForceWorld { get; private set; }
    public Vector3 LastDesiredRcsTorqueWorld { get; private set; }
    public Vector3 LastActualRcsTorqueWorld { get; private set; }
    public Vector3 LastResidualRcsTorqueWorld { get; private set; }
    public Vector3 LastTranslationForce { get; private set; }
    public Vector3 LastTorque { get; private set; }
    public Vector3 LastForceAtPositionTotal { get; private set; }
    public Vector3 LastYawForceWorld { get; private set; }
    public Vector3 LastYawTorqueEstimate { get; private set; }
    public float LastMaxNozzleThrottle { get; private set; }
    public float LastAllocatedNozzleThrottleTotal { get; private set; }
    public int LastNozzleApplicationCount { get; private set; }
    public int LastSaturatedNozzleCount { get; private set; }
    public string LastAllocatorStatus { get; private set; } = AllocatorStatusIdle;
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
            ResetNozzleRuntimeState();
            ClearNozzleVfx();
        }
    }

    public void SetSolverMode(RcsSolverMode mode)
    {
        rcsSolverMode = mode;
        ClearRuntimeForces();
        ResetNozzleRuntimeState();
        ClearNozzleVfx();
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
        if (nozzlesDirty)
        {
            RefreshNozzles();
        }
    }

    public void RefreshNozzles()
    {
        nozzles.Clear();
        nozzleRefreshCount++;
        Vector3 localSum = Vector3.zero;
        var seenNozzleKeys = new System.Collections.Generic.HashSet<string>();
        Transform searchRoot = ResolveNozzleSearchRoot();
        cachedNozzleSearchRoot = searchRoot;

        foreach (Transform child in searchRoot.GetComponentsInChildren<Transform>(true))
        {
            if (child == searchRoot || !child.gameObject.activeInHierarchy || !IsActiveNozzleTransform(child))
            {
                continue;
            }

            if (!UseImportedFunctionalSockets && IsDescendantOfImportedVisual(child))
            {
                continue;
            }

            if (!seenNozzleKeys.Add(BuildNozzleDedupeKey(child)))
            {
                continue;
            }

            GameObject nozzleVfx = FindNozzleVfx(child);
            NormalizeNozzleVfxTransform(child, nozzleVfx);
            Vector3 vfxScale = nozzleVfx != null ? nozzleVfx.transform.localScale : Vector3.one;
            Color vfxColor = Color.white;
            if (nozzleVfx != null)
            {
                var vfxRenderer = nozzleVfx.GetComponent<Renderer>();
                if (vfxRenderer != null && vfxRenderer.sharedMaterial != null)
                {
                    vfxColor = vfxRenderer.sharedMaterial.color;
                }
            }

            var nozzle = new RcsNozzle
            {
                id = child.name,
                transform = child,
                vfx = nozzleVfx,
                block = FindNozzleBlock(child),
                active = false,
                baseVfxScale = vfxScale,
                baseVfxColor = vfxColor
            };
            nozzles.Add(nozzle);
            localSum += transform.InverseTransformPoint(child.position);
        }

        ControlPivotLocal = nozzles.Count > 0 ? localSum / nozzles.Count : Vector3.zero;
        nozzlesDirty = false;
    }

    public void SetUseImportedFunctionalSockets(bool useImportedFunctionalSockets)
    {
        if (UseImportedFunctionalSockets == useImportedFunctionalSockets)
        {
            return;
        }

        UseImportedFunctionalSockets = useImportedFunctionalSockets;
        MarkNozzlesDirty();
    }

    public void MarkNozzlesDirty()
    {
        nozzlesDirty = true;
    }

    private Transform ResolveNozzleSearchRoot()
    {
        if (!UseImportedFunctionalSockets)
        {
            return transform;
        }

        Transform functionalSocketRig = transform.Find(PrototypeFunctionalShipBinder.FunctionalSocketRigName);
        if (functionalSocketRig != null && functionalSocketRig.gameObject.activeInHierarchy)
        {
            cachedNozzleSearchRoot = functionalSocketRig;
            return cachedNozzleSearchRoot;
        }

        Transform importedVisual = transform.Find(ImportedShipVisualName);
        cachedNozzleSearchRoot = importedVisual != null && importedVisual.gameObject.activeInHierarchy
            ? importedVisual
            : transform;

        return cachedNozzleSearchRoot;
    }

    private bool IsDescendantOfImportedVisual(Transform candidate)
    {
        Transform current = candidate;
        while (current != null)
        {
            if (current.name == ImportedShipVisualName)
            {
                return true;
            }

            current = current.parent;
        }

        return false;
    }

    private static bool IsActiveNozzleTransform(Transform nozzle)
    {
        return PrototypeShipSocketUtility.IsRuntimeRcsNozzle(nozzle);
    }

    private static GameObject FindNozzleVfx(Transform nozzle)
    {
        if (nozzle == null)
        {
            return null;
        }

        string[] childNames =
        {
            "VFX",
            PrototypeShipKitVfxBinder.RcsThrusterVfxChildName,
            "RcsThrusterVfx"
        };

        for (int i = 0; i < childNames.Length; i++)
        {
            Transform vfx = nozzle.Find(childNames[i]);
            if (vfx != null)
            {
                return vfx.gameObject;
            }
        }

        return null;
    }

    private static void NormalizeNozzleVfxTransform(Transform nozzle, GameObject nozzleVfx)
    {
        if (nozzle == null || nozzleVfx == null || nozzleVfx.transform.parent != nozzle)
        {
            return;
        }

        nozzleVfx.transform.localRotation = Quaternion.Euler(0f, 180f, 0f);
    }

    private static string BuildNozzleDedupeKey(Transform nozzle)
    {
        PrototypeShipSocket socket = nozzle != null ? nozzle.GetComponent<PrototypeShipSocket>() : null;
        string direction = socket != null ? socket.Direction.ToString() : InferNozzleDirection(nozzle != null ? nozzle.name : string.Empty);
        Vector3 position = nozzle != null ? nozzle.position : Vector3.zero;
        return direction + "|"
            + Mathf.RoundToInt(position.x * 1000f) + "|"
            + Mathf.RoundToInt(position.y * 1000f) + "|"
            + Mathf.RoundToInt(position.z * 1000f);
    }

    private static string InferNozzleDirection(string name)
    {
        string upper = string.IsNullOrEmpty(name) ? string.Empty : name.ToUpperInvariant();
        if (upper.Contains("FORWARD")) return "Forward";
        if (upper.Contains("BACK")) return "Back";
        if (upper.Contains("LEFT")) return "Left";
        if (upper.Contains("RIGHT")) return "Right";
        if (upper.Contains("UP")) return "Up";
        if (upper.Contains("DOWN")) return "Down";
        return "Unknown";
    }

    public void RecomputeControlPivot()
    {
        RefreshNozzles();
    }

    private static RcsNozzleData CreateNozzleSnapshot(RcsNozzle nozzle, int fallbackId, int shipId, int cacheVersion, bool isCacheDirty)
    {
        if (nozzle == null || nozzle.transform == null)
        {
            return new RcsNozzleData
            {
                nozzleId = fallbackId,
                shipId = shipId,
                snapshotVersion = cacheVersion,
                isActive = 0,
                isSpooling = 0,
                localPosition = Vector3.zero,
                worldPosition = Vector3.zero,
                localForward = Vector3.zero,
                localUp = Vector3.up,
                localRight = Vector3.right,
                baseVfxScale = Vector3.one,
                actualThrottle = 0f,
                cacheVersion = cacheVersion,
                isCacheDirty = isCacheDirty ? 1 : 0
            };
        }

        return new RcsNozzleData
        {
            nozzleId = nozzle.transform.GetHashCode(),
            shipId = shipId,
            snapshotVersion = cacheVersion,
            isActive = nozzle.active ? 1 : 0,
            isSpooling = nozzle.actualThrottle > 0.0001f ? 1 : 0,
            localPosition = nozzle.transform.localPosition,
            worldPosition = nozzle.transform.position,
            localForward = nozzle.transform.localRotation * Vector3.forward,
            localUp = nozzle.transform.localRotation * Vector3.up,
            localRight = nozzle.transform.localRotation * Vector3.right,
            baseVfxScale = nozzle.baseVfxScale,
            actualThrottle = nozzle.actualThrottle,
            cacheVersion = cacheVersion,
            isCacheDirty = isCacheDirty ? 1 : 0
        };
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

        float torqueAuthority = GetEffectiveTorqueAuthority();
        LastManualDesiredTorqueLocal = rcsSolverMode == RcsSolverMode.StablePrototype
            ? ComputeStableManualDesiredTorqueLocal(manualAttitude)
            : Vector3.ClampMagnitude(manualAttitude, 1f) * torqueAuthority;
        Vector3 assistTorqueLocal = flightAssistRequest.HasPhysicalRequest ? flightAssistRequest.torqueLocal : Vector3.zero;
        Vector3 desiredTorqueLocal = CombineManualPriorityTorque(LastManualDesiredTorqueLocal, LastSasDesiredTorqueLocal + assistTorqueLocal, torqueAuthority);
        LastDesiredTorqueLocal = desiredTorqueLocal;
        Vector3 desiredTorqueWorld = transform.TransformDirection(desiredTorqueLocal);
        LastSasDesiredTorqueWorld = transform.TransformDirection(LastSasDesiredTorqueLocal);
        ClearRuntimeForces();

        if (shipRigidbody == null || physicsCore == null || !CanApplyRcs)
        {
            PreserveUnavailableRcsDiagnostics(desiredForceWorld, desiredTorqueWorld, GetUnavailableRcsStatus());
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

        float torqueAuthority = GetEffectiveSasTorqueAuthority();
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

        float dampingTime = Mathf.Max(SasMinimumDampingTime, 1f / Mathf.Max(0.01f, SasDerivativeGain));
        Vector3 desiredAngularVelocity = sasMode == SasControlMode.HoldAttitude
            ? Vector3.ClampMagnitude(angularError * (SasProportionalGain / dampingTime), GetSasAngularVelocityLimit())
            : Vector3.zero;
        Vector3 desiredAngularAcceleration = (desiredAngularVelocity - localAngularVelocity) / dampingTime;
        desiredAngularAcceleration = ClampStableAngularAcceleration(desiredAngularAcceleration, sasAngularAccelerationLimitRadPerSec2);
        Vector3 desiredTorque = TransformLocalAngularAccelerationToTorque(desiredAngularAcceleration);
        return Vector3.ClampMagnitude(desiredTorque, torqueAuthority);
    }

    private Vector3 ComputeStableManualDesiredTorqueLocal(Vector3 manualAttitude)
    {
        if (shipRigidbody == null)
        {
            return Vector3.zero;
        }

        Vector3 command = Vector3.ClampMagnitude(manualAttitude, 1f);
        if (command.sqrMagnitude <= ManualCommandDeadZone * ManualCommandDeadZone)
        {
            return Vector3.zero;
        }

        Vector3 localAngularVelocity = transform.InverseTransformDirection(shipRigidbody.angularVelocity);
        float maxVelocity = Mathf.Max(0.01f, maxManualAngularVelocityRadPerSec);
        LimitManualAccelerationByVelocity(ref command.x, localAngularVelocity.x, maxVelocity);
        LimitManualAccelerationByVelocity(ref command.y, localAngularVelocity.y, maxVelocity);
        LimitManualAccelerationByVelocity(ref command.z, localAngularVelocity.z, maxVelocity);

        Vector3 desiredAngularAcceleration = command * Mathf.Max(0f, manualAngularAccelerationLimitRadPerSec2);
        desiredAngularAcceleration = ClampStableAngularAcceleration(desiredAngularAcceleration, manualAngularAccelerationLimitRadPerSec2);
        return Vector3.ClampMagnitude(
            TransformLocalAngularAccelerationToTorque(desiredAngularAcceleration),
            GetStablePrototypeTorqueAuthority());
    }

    private static void LimitManualAccelerationByVelocity(ref float commandAxis, float angularVelocityAxis, float maxVelocity)
    {
        if (Mathf.Abs(commandAxis) <= ManualCommandDeadZone)
        {
            commandAxis = 0f;
            return;
        }

        if (Mathf.Sign(commandAxis) == Mathf.Sign(angularVelocityAxis) && Mathf.Abs(angularVelocityAxis) >= maxVelocity)
        {
            commandAxis = 0f;
        }
    }

    private Vector3 ClampStableAngularAcceleration(Vector3 angularAcceleration, float limit)
    {
        if (rcsSolverMode != RcsSolverMode.StablePrototype)
        {
            return angularAcceleration;
        }

        return Vector3.ClampMagnitude(angularAcceleration, Mathf.Max(0f, limit));
    }

    private float GetSasAngularVelocityLimit()
    {
        return rcsSolverMode == RcsSolverMode.StablePrototype
            ? Mathf.Max(0.01f, maxSasAngularVelocityRadPerSec)
            : SasHoldAngularVelocityLimit;
    }

    private Vector3 TransformLocalAngularAccelerationToTorque(Vector3 localAngularAcceleration)
    {
        if (shipRigidbody == null || localAngularAcceleration.sqrMagnitude <= 0.000001f)
        {
            return Vector3.zero;
        }

        Vector3 inertia = shipRigidbody.inertiaTensor;
        if (!IsFinitePositive(inertia.x) || !IsFinitePositive(inertia.y) || !IsFinitePositive(inertia.z))
        {
            return Vector3.zero;
        }

        Quaternion inertiaRotation = shipRigidbody.inertiaTensorRotation;
        Vector3 principalAcceleration = Quaternion.Inverse(inertiaRotation) * localAngularAcceleration;
        Vector3 principalTorque = new Vector3(
            principalAcceleration.x * inertia.x,
            principalAcceleration.y * inertia.y,
            principalAcceleration.z * inertia.z);
        return inertiaRotation * principalTorque;
    }

    private static bool IsFinitePositive(float value)
    {
        return float.IsFinite(value) && value > 0.000001f;
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
        LastDesiredRcsForceWorld = Vector3.zero;
        LastActualRcsForceWorld = Vector3.zero;
        LastResidualRcsForceWorld = Vector3.zero;
        LastDesiredRcsTorqueWorld = Vector3.zero;
        LastActualRcsTorqueWorld = Vector3.zero;
        LastResidualRcsTorqueWorld = Vector3.zero;
        LastForceAtPositionTotal = Vector3.zero;
        LastYawForceWorld = Vector3.zero;
        LastYawTorqueEstimate = Vector3.zero;
        LastMaxNozzleThrottle = 0f;
        LastAllocatedNozzleThrottleTotal = 0f;
        LastNozzleApplicationCount = 0;
        LastSaturatedNozzleCount = 0;
        LastAllocatorStatus = RcsEnabled ? AllocatorStatusIdle : AllocatorStatusDisabled;
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

    private void PreserveUnavailableRcsDiagnostics(Vector3 desiredForceWorld, Vector3 desiredTorqueWorld, string allocatorStatus)
    {
        LastDesiredRcsForceWorld = desiredForceWorld;
        LastDesiredRcsTorqueWorld = desiredTorqueWorld;
        LastActualRcsForceWorld = Vector3.zero;
        LastActualRcsTorqueWorld = Vector3.zero;
        LastResidualRcsForceWorld = desiredForceWorld;
        LastResidualRcsTorqueWorld = desiredTorqueWorld;
        LastMaxNozzleThrottle = 0f;
        LastAllocatedNozzleThrottleTotal = 0f;
        LastNozzleApplicationCount = 0;
        LastSaturatedNozzleCount = 0;
        LastAllocatorStatus = allocatorStatus;
    }

    private string GetUnavailableRcsStatus()
    {
        if (!RcsEnabled)
        {
            return AllocatorStatusDisabled;
        }

        if (!HasRcs)
        {
            return AllocatorStatusNoNozzles;
        }

        if (shipRigidbody == null || physicsCore == null)
        {
            return AllocatorStatusNoAuthority;
        }

        return AllocatorStatusNoSolution;
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
            float throttle = nozzle != null ? Mathf.Clamp01(nozzle.actualThrottle) : 0f;
            bool physicallyActive = RcsEnabled && nozzle != null && nozzle.active && throttle > 0.0001f;
            bool visible = physicallyActive && throttle >= minRcsNozzleThrottleForVfx;
            SetActive(nozzle.vfx, visible);
            UpdateRcsNozzleVfx(nozzle, visible ? throttle : 0f);
            if (!physicallyActive)
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

    private void UpdateRcsNozzleVfx(RcsNozzle nozzle, float throttle)
    {
        if (nozzle == null || nozzle.vfx == null)
        {
            return;
        }

        float scaleBoost = Mathf.Lerp(idleRcsNozzleScaleBoost, activeRcsNozzleScaleBoost, throttle);
        nozzle.vfx.transform.localScale = nozzle.baseVfxScale * scaleBoost;

        var renderer = nozzle.vfx.GetComponent<Renderer>();
        if (renderer == null)
        {
            return;
        }

        var material = Application.isPlaying ? renderer.material : renderer.sharedMaterial;
        if (material == null)
        {
            return;
        }

        float alpha = Mathf.Lerp(0.12f, Mathf.Max(0.65f, nozzle.baseVfxColor.a), throttle);
        material.color = new Color(nozzle.baseVfxColor.r, nozzle.baseVfxColor.g, nozzle.baseVfxColor.b, alpha);
        if (material.HasProperty("_EmissionColor"))
        {
            material.EnableKeyword("_EMISSION");
            material.SetColor("_EmissionColor", new Color(nozzle.baseVfxColor.r, nozzle.baseVfxColor.g, nozzle.baseVfxColor.b, alpha) * (vfxEmissiveBoost * Mathf.Lerp(0.35f, 1f, throttle)));
        }
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

    private void ResetNozzleRuntimeState()
    {
        for (int i = 0; i < nozzles.Count; i++)
        {
            nozzles[i].active = false;
            nozzles[i].actualThrottle = 0f;
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
        PrototypeRcsSettings settings = config != null ? config.Rcs : PrototypeRcsSettings.Default;
        ApplySettings(settings);
    }

    public void ApplySettings(PrototypeRcsSettings settings)
    {
        settings.Clamp();
        translationForce = settings.translationForce;
        attitudeForce = settings.attitudeForce;
        sasAuthority = settings.sasAuthority;
        sasProportionalGain = settings.sasProportionalGain;
        sasDerivativeGain = settings.sasDerivativeGain;
        minSelectionDot = settings.minSelectionDot;
        nozzleSpoolUpRate = settings.nozzleSpoolUpRate;
        nozzleSpoolDownRate = settings.nozzleSpoolDownRate;
        RefreshNozzles();
    }


    private void AllocateAndApplyRcs(Vector3 desiredForceWorld, Vector3 desiredTorqueWorld, Vector3 manualAttitude, float deltaTime)
    {
        if (rcsSolverMode == RcsSolverMode.StablePrototype)
        {
            ApplyStablePrototypeRcs(desiredForceWorld, desiredTorqueWorld, manualAttitude, deltaTime);
            return;
        }

        Vector3 diagnosticDesiredForceWorld = desiredForceWorld;
        Vector3 allocationDesiredForceWorld = desiredForceWorld;
        bool splitImportedTranslation = TryApplyImportedTranslationAtCenterOfMass(diagnosticDesiredForceWorld, deltaTime);
        if (splitImportedTranslation)
        {
            allocationDesiredForceWorld = Vector3.zero;
        }

        LastDesiredRcsForceWorld = diagnosticDesiredForceWorld;
        LastDesiredRcsTorqueWorld = desiredTorqueWorld;
        LastResidualRcsForceWorld = diagnosticDesiredForceWorld - LastActualRcsForceWorld;
        LastResidualRcsTorqueWorld = desiredTorqueWorld;

        int allocationCount = BuildAllocationData();
        bool hasRequest = allocationDesiredForceWorld.sqrMagnitude > 0.0001f || desiredTorqueWorld.sqrMagnitude > 0.0001f;
        if (!hasRequest)
        {
            if (splitImportedTranslation)
            {
                LastResidualRcsForceWorld = diagnosticDesiredForceWorld - LastActualRcsForceWorld;
                LastAllocatorStatus = LastResidualRcsForceWorld.magnitude <= Mathf.Max(AllocatorResidualForceTolerance, diagnosticDesiredForceWorld.magnitude * AllocatorResidualLimitRatio)
                    ? AllocatorStatusComTranslationFallback
                    : AllocatorStatusResidual;
                return;
            }

            ApplySpoolDownForces(allocationScratch, allocationCount, diagnosticDesiredForceWorld, desiredTorqueWorld, manualAttitude, deltaTime, AllocatorStatusSpoolingDown);
            return;
        }

        if (allocationCount == 0)
        {
            LastAllocatorStatus = AllocatorStatusNoNozzles;
            return;
        }

        float forceWeight;
        float torqueWeight;
        GetAllocatorWeights(allocationScratch, allocationCount, allocationDesiredForceWorld, desiredTorqueWorld, out forceWeight, out torqueWeight);
        AllocateThrottleGreedy(allocationScratch, allocationCount, allocationDesiredForceWorld, desiredTorqueWorld, forceWeight, torqueWeight);
        ApplyAllocatedForces(allocationScratch, allocationCount, diagnosticDesiredForceWorld, desiredTorqueWorld, manualAttitude, deltaTime);
    }

    private void ApplyStablePrototypeRcs(Vector3 desiredForceWorld, Vector3 desiredTorqueWorld, Vector3 manualAttitude, float deltaTime)
    {
        bool hasDesiredForce = desiredForceWorld.sqrMagnitude > 0.0001f;
        bool hasDesiredTorque = desiredTorqueWorld.sqrMagnitude > 0.0001f;
        bool recordYaw = Mathf.Abs(manualAttitude.y) > ManualCommandDeadZone || Mathf.Abs(LastSasCommand.y) > SasCommandDeadZone;
        LastDesiredRcsForceWorld = desiredForceWorld;
        LastDesiredRcsTorqueWorld = desiredTorqueWorld;

        LastActualRcsForceWorld = Vector3.zero;
        LastActualRcsTorqueWorld = Vector3.zero;
        LastTorque = Vector3.zero;
        LastTranslationForce = Vector3.zero;
        LastForceAtPositionTotal = Vector3.zero;
        LastResidualRcsForceWorld = desiredForceWorld;
        LastResidualRcsTorqueWorld = desiredTorqueWorld;
        LastNozzleApplicationCount = 0;
        LastSaturatedNozzleCount = 0;

        ResetNozzleRuntimeState();
        if (hasDesiredForce)
        {
            MarkVisualNozzlesForTranslation(desiredForceWorld, 1f);
        }

        if (hasDesiredTorque)
        {
            MarkVisualNozzlesForTorque(desiredTorqueWorld, 1f);
        }

        if (!hasDesiredForce && !hasDesiredTorque)
        {
            LastAllocatorStatus = AllocatorStatusIdle;
            LastAllocatedNozzleThrottleTotal = 0f;
            LastFuelRequestedKg = 0f;
            LastFuelConsumedKg = 0f;
            LastAppliedFuelFraction = 1f;
            return;
        }

        float translationThrottleEquivalent = hasDesiredForce
            ? desiredForceWorld.magnitude / Mathf.Max(0.0001f, TranslationForce)
            : 0f;
        float torqueThrottleEquivalent = hasDesiredTorque
            ? desiredTorqueWorld.magnitude / Mathf.Max(0.0001f, GetEffectiveTorqueAuthority())
            : 0f;

        float requestedThrottleTotal = Mathf.Abs(translationThrottleEquivalent) + Mathf.Abs(torqueThrottleEquivalent);
        float fuelFraction = ConsumeFuelForAllocatedThrottle(requestedThrottleTotal, deltaTime);
        if (fuelFraction <= 0f)
        {
            LastAllocatorStatus = AllocatorStatusFuelStarved;
            LastAllocatedNozzleThrottleTotal = 0f;
            ResetNozzleRuntimeState();
            return;
        }

        LastAllocatedNozzleThrottleTotal = requestedThrottleTotal * fuelFraction;
        if (hasDesiredForce)
        {
            Vector3 desiredForceDelta = desiredForceWorld * fuelFraction;
            if (physicsCore != null && physicsCore.ApplyForceAtCenterOfMass(desiredForceDelta, ForceMode.Force))
            {
                LastActualRcsForceWorld += desiredForceDelta;
                LastTranslationForce = LastActualRcsForceWorld;
                LastForceAtPositionTotal += desiredForceDelta;
            }
        }

        if (hasDesiredTorque)
        {
            Vector3 desiredTorqueDelta = desiredTorqueWorld * fuelFraction;
            if (physicsCore != null && physicsCore.ApplyTorque(desiredTorqueDelta, ForceMode.Force))
            {
                LastActualRcsTorqueWorld += desiredTorqueDelta;
                LastTorque += desiredTorqueDelta;
                if (recordYaw)
                {
                    LastYawTorqueEstimate += desiredTorqueDelta;
                }
            }
        }

        LastResidualRcsForceWorld = desiredForceWorld - LastActualRcsForceWorld;
        LastResidualRcsTorqueWorld = desiredTorqueWorld - LastActualRcsTorqueWorld;

        bool residualForceExists = HasResidualOutsideTolerance(
            desiredForceWorld,
            LastResidualRcsForceWorld,
            AllocatorResidualForceTolerance);
        bool residualTorqueExists = HasResidualOutsideTolerance(
            desiredTorqueWorld,
            LastResidualRcsTorqueWorld,
            AllocatorResidualTorqueTolerance);
        LastAllocatorStatus = residualForceExists || residualTorqueExists
            ? AllocatorStatusResidual
            : AllocatorStatusStablePrototype;

        LastMaxNozzleThrottle = 0f;
        if (translationThrottleEquivalent > 0f)
        {
            LastMaxNozzleThrottle = Mathf.Clamp01(translationThrottleEquivalent * fuelFraction);
        }

        if (torqueThrottleEquivalent > LastMaxNozzleThrottle)
        {
            LastMaxNozzleThrottle = Mathf.Clamp01(torqueThrottleEquivalent * fuelFraction);
        }
    }


    private int BuildAllocationData()
    {
        allocationScratch.Clear();
        if (allocationScratch.Capacity < nozzles.Count)
        {
            allocationScratch.Capacity = nozzles.Count;
        }

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
            allocationScratch.Add(new RcsAllocation
            {
                nozzle = nozzle,
                position = position,
                forceAtFull = forceAtFull,
                torqueAtFull = Vector3.Cross(lever, forceAtFull),
                maxThrust = maxThrust,
                throttle = 0f
            });
        }

        return allocationScratch.Count;
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

    public float ComputePhysicalNozzleTorqueAuthorityForDiagnostics()
    {
        RefreshNozzlesIfNeeded();
        return GetTorqueAuthority();
    }

    public float ComputeEffectiveTorqueAuthorityForDiagnostics()
    {
        RefreshNozzlesIfNeeded();
        return GetEffectiveTorqueAuthority();
    }

    private float GetEffectiveTorqueAuthority()
    {
        LastPhysicalNozzleTorqueAuthority = GetTorqueAuthority();
        LastStablePrototypeTorqueAuthority = GetStablePrototypeTorqueAuthority();
        LastComputedTorqueAuthority = rcsSolverMode == RcsSolverMode.StablePrototype
            ? LastStablePrototypeTorqueAuthority
            : LastPhysicalNozzleTorqueAuthority;
        return LastComputedTorqueAuthority;
    }

    private float GetStablePrototypeTorqueAuthority()
    {
        return Mathf.Max(0.0001f, maxStablePrototypeTorqueNm);
    }

    private float GetSasTorqueAuthority()
    {
        return GetTorqueAuthority() * SasAuthority;
    }

    private float GetEffectiveSasTorqueAuthority()
    {
        return rcsSolverMode == RcsSolverMode.StablePrototype
            ? GetStablePrototypeTorqueAuthority()
            : GetSasTorqueAuthority();
    }

    private static void GetAllocatorWeights(List<RcsAllocation> allocations, int allocationCount, Vector3 desiredForceWorld, Vector3 desiredTorqueWorld, out float forceWeight, out float torqueWeight)
    {
        bool wantsForce = desiredForceWorld.sqrMagnitude > 0.0001f;
        bool wantsTorque = desiredTorqueWorld.sqrMagnitude > 0.0001f;
        float representativeForce = 1f;
        float representativeTorque = 1f;
        if (allocations != null)
        {
            for (int i = 0; i < allocationCount; i++)
            {
                representativeForce = Mathf.Max(representativeForce, allocations[i].forceAtFull.magnitude);
                representativeTorque = Mathf.Max(representativeTorque, allocations[i].torqueAtFull.magnitude);
            }
        }

        float forceScale = Mathf.Max(1f, desiredForceWorld.magnitude, representativeForce);
        float torqueScale = Mathf.Max(1f, desiredTorqueWorld.magnitude, representativeTorque);
        if (wantsForce && !wantsTorque)
        {
            forceWeight = 3f / (forceScale * forceScale);
            torqueWeight = 3f / (torqueScale * torqueScale);
            return;
        }

        if (!wantsForce && wantsTorque)
        {
            forceWeight = 3f / (forceScale * forceScale);
            torqueWeight = 3f / (torqueScale * torqueScale);
            return;
        }

        forceWeight = 1.5f / (forceScale * forceScale);
        torqueWeight = 1.5f / (torqueScale * torqueScale);
    }

    private static void AllocateThrottleGreedy(List<RcsAllocation> allocations, int allocationCount, Vector3 desiredForceWorld, Vector3 desiredTorqueWorld, float forceWeight, float torqueWeight)
    {
        const int MaxPasses = 32;
        const float MinImprovement = 0.0000001f;

        Vector3 residualForce = desiredForceWorld;
        Vector3 residualTorque = desiredTorqueWorld;
        for (int pass = 0; pass < MaxPasses; pass++)
        {
            int bestIndex = -1;
            float bestDelta = 0f;
            float bestImprovement = 0f;

            for (int i = 0; i < allocationCount; i++)
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

            RcsAllocation bestAllocation = allocations[bestIndex];
            bestAllocation.throttle = Mathf.Clamp01(bestAllocation.throttle + bestDelta);
            allocations[bestIndex] = bestAllocation;
            residualForce -= bestAllocation.forceAtFull * bestDelta;
            residualTorque -= bestAllocation.torqueAtFull * bestDelta;
        }
    }

    private static float WeightedMagnitudeSquared(Vector3 force, Vector3 torque, float forceWeight, float torqueWeight)
    {
        return force.sqrMagnitude * forceWeight + torque.sqrMagnitude * torqueWeight;
    }

    private void ApplyAllocatedForces(List<RcsAllocation> allocations, int allocationCount, Vector3 desiredForceWorld, Vector3 desiredTorqueWorld, Vector3 manualAttitude, float deltaTime)
    {
        bool recordYaw = Mathf.Abs(manualAttitude.y) > ManualCommandDeadZone || Mathf.Abs(LastSasCommand.y) > SasCommandDeadZone;
        float requestedThrottleTotal = 0f;
        for (int i = 0; i < allocationCount; i++)
        {
            requestedThrottleTotal += Mathf.Clamp01(allocations[i].throttle);
        }

        if (requestedThrottleTotal <= 0f)
        {
            if (TryApplyPureTranslationCenterOfMassFallback(desiredForceWorld, desiredTorqueWorld, deltaTime, AllocatorStatusNoSolution))
            {
                return;
            }

            ApplySpoolDownForces(allocations, allocationCount, desiredForceWorld, desiredTorqueWorld, manualAttitude, deltaTime, AllocatorStatusNoSolution);
            return;
        }

        EnsureActualThrottleCapacity(allocationCount);
        float actualThrottleTotal = 0f;
        for (int i = 0; i < allocationCount; i++)
        {
            RcsAllocation allocation = allocations[i];
            float throttle = MoveNozzleThrottleTowards(allocation.nozzle, Mathf.Clamp01(allocation.throttle), deltaTime);
            actualThrottleScratch[i] = throttle;
            actualThrottleTotal += throttle;
        }

        float fuelFraction = ConsumeFuelForAllocatedThrottle(actualThrottleTotal, deltaTime);
        if (fuelFraction <= 0f)
        {
            LastAllocatorStatus = AllocatorStatusFuelStarved;
            LastAllocatedNozzleThrottleTotal = 0f;
            LastResidualRcsForceWorld = desiredForceWorld;
            LastResidualRcsTorqueWorld = desiredTorqueWorld;
            ResetNozzleRuntimeState();
            return;
        }

        LastAllocatedNozzleThrottleTotal = actualThrottleTotal * fuelFraction;
        for (int i = 0; i < allocationCount; i++)
        {
            RcsAllocation allocation = allocations[i];
            float throttle = actualThrottleScratch[i] * fuelFraction;
            allocation.nozzle.actualThrottle = throttle;
            if (throttle <= 0.0001f)
            {
                continue;
            }

            Vector3 force = allocation.forceAtFull * throttle;
            physicsCore.ApplyForceAtPosition(force, allocation.position, ForceMode.Force);
            Vector3 torque = allocation.torqueAtFull * throttle;
            LastForceAtPositionTotal += force;
            LastActualRcsForceWorld += force;
            LastTorque += torque;
            LastActualRcsTorqueWorld += torque;
            LastNozzleApplicationCount++;
            if (throttle >= 0.999f)
            {
                LastSaturatedNozzleCount++;
            }
            LastMaxNozzleThrottle = Mathf.Max(LastMaxNozzleThrottle, throttle);
            allocation.nozzle.active = true;

            if (recordYaw)
            {
                LastYawForceWorld += force;
                LastYawTorqueEstimate += torque;
            }
        }

        LastTranslationForce = LastActualRcsForceWorld;
        LastResidualRcsForceWorld = desiredForceWorld - LastActualRcsForceWorld;
        LastResidualRcsTorqueWorld = desiredTorqueWorld - LastActualRcsTorqueWorld;
        NeutralizePureAttitudeLinearResidual(desiredForceWorld, desiredTorqueWorld);
        LastAllocatorStatus = DetermineAllocatorStatus(desiredForceWorld, desiredTorqueWorld, LastResidualRcsForceWorld, LastResidualRcsTorqueWorld);
    }

    private bool TryApplyPureTranslationCenterOfMassFallback(Vector3 desiredForceWorld, Vector3 desiredTorqueWorld, float deltaTime, string fallbackStatus)
    {
        if (desiredForceWorld.sqrMagnitude <= 0.0001f
            || desiredTorqueWorld.sqrMagnitude > 0.0001f
            || !UseImportedFunctionalSockets
            || physicsCore == null
            || shipRigidbody == null
            || !CanApplyRcs)
        {
            return false;
        }

        float throttleEquivalent = Mathf.Clamp01(desiredForceWorld.magnitude / Mathf.Max(0.0001f, TranslationForce));
        float fuelFraction = ConsumeFuelForAllocatedThrottle(throttleEquivalent, deltaTime);
        if (fuelFraction <= 0f)
        {
            LastAllocatorStatus = AllocatorStatusFuelStarved;
            LastAllocatedNozzleThrottleTotal = 0f;
            LastResidualRcsForceWorld = desiredForceWorld;
            LastResidualRcsTorqueWorld = desiredTorqueWorld;
            ResetNozzleRuntimeState();
            return true;
        }

        Vector3 appliedForce = desiredForceWorld * fuelFraction;
        physicsCore.ApplyForceAtCenterOfMass(appliedForce, ForceMode.Force);
        LastActualRcsForceWorld += appliedForce;
        LastTranslationForce = LastActualRcsForceWorld;
        LastResidualRcsForceWorld = desiredForceWorld - LastActualRcsForceWorld;
        LastResidualRcsTorqueWorld = desiredTorqueWorld - LastActualRcsTorqueWorld;
        LastAllocatedNozzleThrottleTotal = throttleEquivalent * fuelFraction;
        LastAllocatorStatus = LastResidualRcsForceWorld.magnitude <= Mathf.Max(AllocatorResidualForceTolerance, desiredForceWorld.magnitude * AllocatorResidualLimitRatio)
            ? AllocatorStatusComTranslationFallback
            : fallbackStatus;
        return true;
    }

    private bool TryApplyImportedTranslationAtCenterOfMass(Vector3 desiredForceWorld, float deltaTime)
    {
        if (!UseImportedFunctionalSockets
            || desiredForceWorld.sqrMagnitude <= 0.0001f
            || physicsCore == null
            || shipRigidbody == null
            || !CanApplyRcs)
        {
            return false;
        }

        float throttleEquivalent = Mathf.Clamp01(desiredForceWorld.magnitude / Mathf.Max(0.0001f, TranslationForce));
        float fuelFraction = ConsumeFuelForAllocatedThrottle(throttleEquivalent, deltaTime);
        if (fuelFraction <= 0f)
        {
            LastAllocatorStatus = AllocatorStatusFuelStarved;
            LastResidualRcsForceWorld = desiredForceWorld;
            ResetNozzleRuntimeState();
            return true;
        }

        Vector3 appliedForce = desiredForceWorld * fuelFraction;
        physicsCore.ApplyForceAtCenterOfMass(appliedForce, ForceMode.Force);
        LastActualRcsForceWorld += appliedForce;
        LastTranslationForce = LastActualRcsForceWorld;
        LastResidualRcsForceWorld = desiredForceWorld - LastActualRcsForceWorld;
        LastAllocatedNozzleThrottleTotal += throttleEquivalent * fuelFraction;
        MarkVisualNozzlesForTranslation(desiredForceWorld, throttleEquivalent * fuelFraction);
        return true;
    }

    private void MarkVisualNozzlesForTranslation(Vector3 desiredForceWorld, float throttle)
    {
        if (desiredForceWorld.sqrMagnitude <= 0.0001f || throttle <= 0.0001f)
        {
            return;
        }

        Vector3 desiredDirection = desiredForceWorld.normalized;
        float selectionDot = Mathf.Clamp(minSelectionDot, 0f, 0.95f);
        for (int i = 0; i < nozzles.Count; i++)
        {
            RcsNozzle nozzle = nozzles[i];
            if (!IsActiveNozzleTransform(nozzle.transform))
            {
                continue;
            }

            float alignment = Vector3.Dot(GetNozzleForceDirection(nozzle.transform), desiredDirection);
            if (alignment <= selectionDot)
            {
                continue;
            }

            nozzle.active = true;
            nozzle.actualThrottle = Mathf.Max(nozzle.actualThrottle, Mathf.Clamp01(throttle * alignment));
            LastMaxNozzleThrottle = Mathf.Max(LastMaxNozzleThrottle, nozzle.actualThrottle);
        }
    }

    private void MarkVisualNozzlesForTorque(Vector3 desiredTorqueWorld, float throttle)
    {
        if (shipRigidbody == null || desiredTorqueWorld.sqrMagnitude <= 0.0001f || throttle <= 0.0001f)
        {
            return;
        }

        Vector3 desiredDirection = desiredTorqueWorld.normalized;
        float selectionDot = Mathf.Clamp(minSelectionDot, 0f, 0.95f);
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

            float alignment = Vector3.Dot(torqueAxis.normalized, desiredDirection);
            if (alignment <= selectionDot)
            {
                continue;
            }

            nozzle.active = true;
            nozzle.actualThrottle = Mathf.Max(nozzle.actualThrottle, Mathf.Clamp01(throttle * alignment));
            LastMaxNozzleThrottle = Mathf.Max(LastMaxNozzleThrottle, nozzle.actualThrottle);
        }
    }

    private void NeutralizePureAttitudeLinearResidual(Vector3 desiredForceWorld, Vector3 desiredTorqueWorld)
    {
        Vector3 undesiredForceWorld = LastActualRcsForceWorld - desiredForceWorld;
        if (physicsCore == null
            || desiredTorqueWorld.sqrMagnitude <= 0.0001f
            || undesiredForceWorld.sqrMagnitude <= 0.0001f)
        {
            return;
        }

        Vector3 counterForce = -undesiredForceWorld;
        if (!physicsCore.ApplyForceAtCenterOfMass(counterForce, ForceMode.Force))
        {
            return;
        }

        LastForceAtPositionTotal += counterForce;
        LastActualRcsForceWorld += counterForce;
        LastTranslationForce = LastActualRcsForceWorld;
        LastResidualRcsForceWorld = desiredForceWorld - LastActualRcsForceWorld;
    }

    private void ApplySpoolDownForces(
        List<RcsAllocation> allocations,
        int allocationCount,
        Vector3 desiredForceWorld,
        Vector3 desiredTorqueWorld,
        Vector3 manualAttitude,
        float deltaTime,
        string inactiveStatus)
    {
        if (allocations == null || allocationCount == 0)
        {
            LastAllocatorStatus = inactiveStatus == AllocatorStatusSpoolingDown ? AllocatorStatusIdle : inactiveStatus;
            return;
        }

        bool recordYaw = Mathf.Abs(manualAttitude.y) > ManualCommandDeadZone || Mathf.Abs(LastSasCommand.y) > SasCommandDeadZone;
        EnsureActualThrottleCapacity(allocationCount);
        float actualThrottleTotal = 0f;
        for (int i = 0; i < allocationCount; i++)
        {
            float throttle = MoveNozzleThrottleTowards(allocations[i].nozzle, 0f, deltaTime);
            actualThrottleScratch[i] = throttle;
            actualThrottleTotal += throttle;
        }

        if (actualThrottleTotal <= 0.0001f)
        {
            LastAllocatorStatus = inactiveStatus == AllocatorStatusSpoolingDown ? AllocatorStatusIdle : inactiveStatus;
            LastResidualRcsForceWorld = desiredForceWorld;
            LastResidualRcsTorqueWorld = desiredTorqueWorld;
            return;
        }

        float fuelFraction = ConsumeFuelForAllocatedThrottle(actualThrottleTotal, deltaTime);
        if (fuelFraction <= 0f)
        {
            LastAllocatorStatus = AllocatorStatusFuelStarved;
            LastAllocatedNozzleThrottleTotal = 0f;
            LastResidualRcsForceWorld = desiredForceWorld;
            LastResidualRcsTorqueWorld = desiredTorqueWorld;
            ResetNozzleRuntimeState();
            return;
        }

        LastAllocatedNozzleThrottleTotal = actualThrottleTotal * fuelFraction;
        for (int i = 0; i < allocationCount; i++)
        {
            RcsAllocation allocation = allocations[i];
            float throttle = actualThrottleScratch[i] * fuelFraction;
            allocation.nozzle.actualThrottle = throttle;
            if (throttle <= 0.0001f)
            {
                continue;
            }

            Vector3 force = allocation.forceAtFull * throttle;
            physicsCore.ApplyForceAtPosition(force, allocation.position, ForceMode.Force);
            Vector3 torque = allocation.torqueAtFull * throttle;
            LastForceAtPositionTotal += force;
            LastActualRcsForceWorld += force;
            LastTorque += torque;
            LastActualRcsTorqueWorld += torque;
            LastNozzleApplicationCount++;
            if (throttle >= 0.999f)
            {
                LastSaturatedNozzleCount++;
            }
            LastMaxNozzleThrottle = Mathf.Max(LastMaxNozzleThrottle, throttle);
            allocation.nozzle.active = true;

            if (recordYaw)
            {
                LastYawForceWorld += force;
                LastYawTorqueEstimate += torque;
            }
        }

        LastTranslationForce = LastActualRcsForceWorld;
        LastResidualRcsForceWorld = desiredForceWorld - LastActualRcsForceWorld;
        LastResidualRcsTorqueWorld = desiredTorqueWorld - LastActualRcsTorqueWorld;
        LastAllocatorStatus = desiredForceWorld.sqrMagnitude <= 0.0001f && desiredTorqueWorld.sqrMagnitude <= 0.0001f
            ? AllocatorStatusSpoolingDown
            : DetermineAllocatorStatus(desiredForceWorld, desiredTorqueWorld, LastResidualRcsForceWorld, LastResidualRcsTorqueWorld);
    }

    private void EnsureActualThrottleCapacity(int requiredCount)
    {
        if (actualThrottleScratch.Length >= requiredCount)
        {
            return;
        }

        actualThrottleScratch = new float[Mathf.Max(requiredCount, actualThrottleScratch.Length * 2, 8)];
    }

    private string DetermineAllocatorStatus(Vector3 desiredForceWorld, Vector3 desiredTorqueWorld, Vector3 residualForceWorld, Vector3 residualTorqueWorld)
    {
        bool hasResidual = HasResidualOutsideTolerance(
            desiredForceWorld,
            residualForceWorld,
            AllocatorResidualForceTolerance)
            || HasResidualOutsideTolerance(
                desiredTorqueWorld,
                residualTorqueWorld,
                AllocatorResidualTorqueTolerance);
        bool hasLimitedNozzle = LastSaturatedNozzleCount > 0 || LastMaxNozzleThrottle >= 0.999f;

        if (hasLimitedNozzle && hasResidual)
        {
            return AllocatorStatusLimitedResidual;
        }

        if (hasLimitedNozzle)
        {
            return AllocatorStatusLimited;
        }

        if (hasResidual)
        {
            return AllocatorStatusResidual;
        }

        return AllocatorStatusOk;
    }

    private static bool HasResidualOutsideTolerance(Vector3 desired, Vector3 residual, float absoluteTolerance)
    {
        if (desired.sqrMagnitude <= 0.0001f)
        {
            return false;
        }

        float desiredMagnitude = desired.magnitude;
        float tolerance = Mathf.Max(absoluteTolerance, desiredMagnitude * AllocatorResidualLimitRatio);
        return residual.magnitude > tolerance;
    }

    private float MoveNozzleThrottleTowards(RcsNozzle nozzle, float targetThrottle, float deltaTime)
    {
        if (nozzle == null)
        {
            return Mathf.Clamp01(targetThrottle);
        }

        float rate = targetThrottle >= nozzle.actualThrottle ? NozzleSpoolUpRate : NozzleSpoolDownRate;
        if (rate <= 0f)
        {
            nozzle.actualThrottle = Mathf.Clamp01(targetThrottle);
            return nozzle.actualThrottle;
        }

        nozzle.actualThrottle = Mathf.MoveTowards(nozzle.actualThrottle, Mathf.Clamp01(targetThrottle), rate * Mathf.Max(0f, deltaTime));
        return nozzle.actualThrottle;
    }

    private void SpoolNozzlesDown(float deltaTime)
    {
        for (int i = 0; i < nozzles.Count; i++)
        {
            MoveNozzleThrottleTowards(nozzles[i], 0f, deltaTime);
        }
    }

    private static Vector3 CombineManualPriorityTorque(Vector3 manualTorqueLocal, Vector3 secondaryTorqueLocal, float torqueAuthority)
    {
        if (torqueAuthority <= 0.0001f)
        {
            return Vector3.zero;
        }

        Vector3 manual = Vector3.ClampMagnitude(manualTorqueLocal, torqueAuthority);
        float remainingAuthority = Mathf.Max(0f, torqueAuthority - manual.magnitude);
        Vector3 secondary = Vector3.ClampMagnitude(secondaryTorqueLocal, remainingAuthority);
        return manual + secondary;
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
