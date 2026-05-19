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

    [Header("RCS Tuning")]
    [SerializeField] private float translationForce = 9000f;
    [SerializeField] private float attitudeForce = 6500f;
    [SerializeField] private float sasAuthority = 1.8f;
    [SerializeField] private float minSelectionDot = 0.25f;
    [SerializeField] private Rigidbody shipRigidbody;

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
    private const float SasResponseMultiplier = 48f;
    private const float MinSasBrakingCommand = 0.06f;

        public float TranslationForce => Mathf.Max(0f, translationForce);
    public float AttitudeForce => Mathf.Max(0f, attitudeForce);
    public float SasAuthority => Mathf.Max(0f, sasAuthority);
    public float MinSelectionDot => Mathf.Clamp(minSelectionDot, 0f, 0.95f);
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
    public Vector3 LastTranslationForce { get; private set; }
    public Vector3 LastTorque { get; private set; }
    public Vector3 LastForceAtPositionTotal { get; private set; }
    public Vector3 LastYawForceWorld { get; private set; }
    public Vector3 LastYawTorqueEstimate { get; private set; }

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
        upThruster = up != null ? up : upThruster;
        downThruster = down != null ? down : downThruster;
        leftThruster = left != null ? left : leftThruster;
        rightThruster = right != null ? right : rightThruster;
        forwardThruster = forward != null ? forward : forwardThruster;
        backThruster = back != null ? back : backThruster;
        shipRigidbody = body != null ? body : shipRigidbody;
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
        ResolveReferences();
        ResolveLegacyBlockReferences();
        RefreshNozzlesIfNeeded();

        LastTranslationCommand = Vector3.ClampMagnitude(translationCommand, 1f);
        Vector3 manualAttitude = Vector3.ClampMagnitude(attitudeCommand, 1f);
        Vector3 sasCommand = stabilizeAngular && shipRigidbody != null ? ComputeSasCommand(deltaTime) : Vector3.zero;
        LastRawSasCommand = sasCommand;
        LastSasReleasedAxes = GetSasReleasedAxes(manualAttitude);
        LastSasCommand = MaskSasForManualAxes(sasCommand, manualAttitude);
        if (stabilizeAngular && shipRigidbody != null)
        {
            SettleTinySasAngularVelocity(manualAttitude);
        }

        LastAttitudeCommand = Vector3.ClampMagnitude(manualAttitude + LastSasCommand, 1f);
        ClearRuntimeForces();

        if (shipRigidbody == null || !CanApplyRcs)
        {
            ClearNozzleVfx();
            return;
        }

        ApplyTranslationForces();
        ApplyAttitudeForces(manualAttitude);
        ApplyNozzleVfx();
    }

    private Vector3 ComputeSasCommand(float deltaTime)
    {
        if (shipRigidbody == null)
        {
            return Vector3.zero;
        }

        Vector3 localAngularVelocity = transform.InverseTransformDirection(shipRigidbody.angularVelocity);
        localAngularVelocity.x = ApplySasAngularVelocityDeadZone(localAngularVelocity.x);
        localAngularVelocity.y = ApplySasAngularVelocityDeadZone(localAngularVelocity.y);
        localAngularVelocity.z = ApplySasAngularVelocityDeadZone(localAngularVelocity.z);

        float scale = Mathf.Max(0f, sasAuthority) * Mathf.Max(deltaTime, 0.02f) * SasResponseMultiplier;
        Vector3 command = -localAngularVelocity * scale;
        command.x = ApplyMinimumSasCommand(command.x);
        command.y = ApplyMinimumSasCommand(command.y);
        command.z = ApplyMinimumSasCommand(command.z);
        return Vector3.ClampMagnitude(command, 1f);
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

    private static float ApplyMinimumSasCommand(float command)
    {
        return Mathf.Abs(command) <= 0f ? 0f : Mathf.Sign(command) * Mathf.Max(Mathf.Abs(command), MinSasBrakingCommand);
    }

    private void ClearRuntimeForces()
    {
        LastTranslationForce = Vector3.zero;
        LastTorque = Vector3.zero;
        LastForceAtPositionTotal = Vector3.zero;
        LastYawForceWorld = Vector3.zero;
        LastYawTorqueEstimate = Vector3.zero;
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
        }
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

        Vector3 position = nozzle.transform.position;
        shipRigidbody.AddForceAtPosition(forceWorld, position, ForceMode.Force);
        Vector3 torque = Vector3.Cross(position - shipRigidbody.worldCenterOfMass, forceWorld);
        LastForceAtPositionTotal += forceWorld;
        LastTorque += torque;
        nozzle.active = true;

        if (translation)
        {
            LastTranslationForce += forceWorld;
        }

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
        minSelectionDot = Mathf.Clamp(minSelectionDot, 0f, 0.95f);
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
        minSelectionDot = settings.minSelectionDot;
        RefreshNozzles();
    }
}
