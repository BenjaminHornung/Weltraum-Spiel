using UnityEngine;

public class PrototypeTurretMount : MonoBehaviour
{
    [SerializeField] private Transform mountRoot;
    [SerializeField] private Transform yawPivot;
    [SerializeField] private Transform pitchPivot;
    [SerializeField] private Transform muzzle;
    [SerializeField] private Transform muzzleFlashMarker;
    [SerializeField] private Collider hullSafetyCollider = null;
    [SerializeField] private Renderer hullSafetyRenderer = null;
    [SerializeField] private bool useManualLocalSafetyBounds = false;
    [SerializeField] private Bounds manualLocalSafetyBounds = new Bounds(Vector3.zero, Vector3.one);
    [SerializeField] private int safetyYawSamples = 5;
    [SerializeField] private int safetyPitchSamples = 5;
    [SerializeField] private float safetyRayDistanceMeters = 4f;
    [SerializeField] private bool drawDebugGizmos = true;

    private PrototypeTurretArcSafetyResult lastArcSafetyResult;

    public Transform MountRoot => mountRoot != null ? mountRoot : transform;
    public Transform YawPivot => yawPivot;
    public Transform PitchPivot => pitchPivot;
    public Transform Muzzle => muzzle;
    public Transform MuzzleFlashMarker => muzzleFlashMarker;
    public PrototypeTurretArcSafetyResult LastArcSafetyResult => lastArcSafetyResult;

    private void Awake()
    {
        ResolveMissingReferences();
    }

    public void Configure(
        Transform root,
        Transform yaw,
        Transform pitch,
        Transform muzzleTransform,
        Transform flashMarker = null)
    {
        mountRoot = root != null ? root : mountRoot;
        yawPivot = yaw != null ? yaw : yawPivot;
        pitchPivot = pitch != null ? pitch : pitchPivot;
        muzzle = muzzleTransform != null ? muzzleTransform : muzzle;
        muzzleFlashMarker = flashMarker != null ? flashMarker : muzzleFlashMarker;
    }

    public void ResolveMissingReferences()
    {
        if (mountRoot == null)
        {
            mountRoot = transform;
        }

        if (yawPivot == null)
        {
            yawPivot = PrototypeShipSocketUtility.FindBestSocketTransform(transform, PrototypeShipSocketType.TurretYawPivot);
        }

        if (pitchPivot == null)
        {
            pitchPivot = PrototypeShipSocketUtility.FindBestSocketTransform(transform, PrototypeShipSocketType.TurretPitchPivot);
        }

        if (muzzle == null)
        {
            muzzle = PrototypeShipSocketUtility.FindBestSocketTransform(transform, PrototypeShipSocketType.WeaponMuzzle);
        }

        if (yawPivot == null)
        {
            yawPivot = FindByNameToken("YAW");
        }

        if (pitchPivot == null)
        {
            pitchPivot = FindByNameToken("PITCH");
        }

        if (muzzle == null)
        {
            muzzle = FindMuzzleByName();
        }

        if (muzzleFlashMarker == null)
        {
            muzzleFlashMarker = FindByNameToken("MUZZLE_FLASH");
        }
    }

    public PrototypeTurretArcSafetyResult ValidateArcSafety(float yawMinDegrees, float yawMaxDegrees, float pitchMinDegrees, float pitchMaxDegrees)
    {
        ResolveMissingReferences();
        if (muzzle == null || yawPivot == null || pitchPivot == null || !HasSafetyData())
        {
            lastArcSafetyResult = PrototypeTurretArcSafetyResult.MissingData();
            return lastArcSafetyResult;
        }

        int yawCount = Mathf.Max(2, safetyYawSamples);
        int pitchCount = Mathf.Max(2, safetyPitchSamples);
        int sampleCount = 0;
        for (int yawIndex = 0; yawIndex < yawCount; yawIndex++)
        {
            float yaw = Mathf.Lerp(yawMinDegrees, yawMaxDegrees, yawIndex / (float)(yawCount - 1));
            for (int pitchIndex = 0; pitchIndex < pitchCount; pitchIndex++)
            {
                float pitch = Mathf.Lerp(pitchMinDegrees, pitchMaxDegrees, pitchIndex / (float)(pitchCount - 1));
                sampleCount++;
                if (!IsFinite(yaw) || !IsFinite(pitch) || yaw < yawMinDegrees - 0.01f || yaw > yawMaxDegrees + 0.01f || pitch < pitchMinDegrees - 0.01f || pitch > pitchMaxDegrees + 0.01f)
                {
                    lastArcSafetyResult = Unsafe(sampleCount, "sample outside configured limits", muzzle.position, yaw, pitch);
                    return lastArcSafetyResult;
                }

                Vector3 sampledForward = MountRoot.TransformDirection(Quaternion.Euler(-pitch, yaw, 0f) * Vector3.forward).normalized;
                Vector3 sampledMuzzlePosition = EstimateSampledMuzzlePosition(yaw, pitch);
                if (IsInsideSafetyBounds(sampledMuzzlePosition) || RayIntersectsSafetyBounds(sampledMuzzlePosition, sampledForward))
                {
                    lastArcSafetyResult = Unsafe(sampleCount, "sample intersects hull safety bounds", sampledMuzzlePosition, yaw, pitch);
                    return lastArcSafetyResult;
                }
            }
        }

        lastArcSafetyResult = new PrototypeTurretArcSafetyResult
        {
            hasSafetyData = true,
            isSafe = true,
            sampledYawPitchPairs = sampleCount,
            message = "safe",
            firstUnsafeWorldPosition = Vector3.zero,
            firstUnsafeYawDegrees = 0f,
            firstUnsafePitchDegrees = 0f
        };
        return lastArcSafetyResult;
    }

    [ContextMenu("Validate Arc Safety")]
    public void ValidateArcSafetyFromCurrentStats()
    {
        var stats = GetComponentInParent<ShipStats>();
        float yawMin = stats != null ? stats.YawLimitLeftDegrees : -35f;
        float yawMax = stats != null ? stats.YawLimitRightDegrees : 35f;
        float pitchMin = stats != null ? stats.PitchMinDegrees : -10f;
        float pitchMax = stats != null ? stats.PitchMaxDegrees : 35f;
        ValidateArcSafety(yawMin, yawMax, pitchMin, pitchMax);
    }

    private Transform FindByNameToken(string token)
    {
        Transform[] transforms = GetComponentsInChildren<Transform>(true);
        for (int i = 0; i < transforms.Length; i++)
        {
            Transform candidate = transforms[i];
            if (candidate != transform && candidate.name.ToUpperInvariant().Contains(token))
            {
                return candidate;
            }
        }

        return null;
    }

    private Transform FindMuzzleByName()
    {
        Transform[] transforms = GetComponentsInChildren<Transform>(true);
        for (int i = 0; i < transforms.Length; i++)
        {
            Transform candidate = transforms[i];
            if (candidate != transform && PrototypeShipSocketUtility.IsWeaponMuzzleName(candidate.name))
            {
                return candidate;
            }
        }

        return null;
    }

    private bool HasSafetyData()
    {
        return hullSafetyCollider != null || hullSafetyRenderer != null || useManualLocalSafetyBounds;
    }

    private Vector3 EstimateSampledMuzzlePosition(float yaw, float pitch)
    {
        Vector3 mountLocalMuzzle = MountRoot.InverseTransformPoint(muzzle.position);
        Quaternion localRotation = Quaternion.Euler(-pitch, yaw, 0f);
        return MountRoot.TransformPoint(localRotation * mountLocalMuzzle);
    }

    private bool IsInsideSafetyBounds(Vector3 worldPosition)
    {
        if (hullSafetyCollider != null && hullSafetyCollider.bounds.Contains(worldPosition))
        {
            return true;
        }

        if (hullSafetyRenderer != null && hullSafetyRenderer.bounds.Contains(worldPosition))
        {
            return true;
        }

        return useManualLocalSafetyBounds && manualLocalSafetyBounds.Contains(MountRoot.InverseTransformPoint(worldPosition));
    }

    private bool RayIntersectsSafetyBounds(Vector3 worldPosition, Vector3 worldDirection)
    {
        float rayDistance = Mathf.Max(0.01f, safetyRayDistanceMeters);
        Ray ray = new Ray(worldPosition, worldDirection);
        if (hullSafetyCollider != null && hullSafetyCollider.Raycast(ray, out _, rayDistance))
        {
            return true;
        }

        if (hullSafetyRenderer != null && hullSafetyRenderer.bounds.IntersectRay(ray, out float rendererDistance) && rendererDistance <= rayDistance)
        {
            return true;
        }

        if (!useManualLocalSafetyBounds)
        {
            return false;
        }

        Ray localRay = new Ray(MountRoot.InverseTransformPoint(worldPosition), MountRoot.InverseTransformDirection(worldDirection));
        return manualLocalSafetyBounds.IntersectRay(localRay, out float manualDistance) && manualDistance <= rayDistance;
    }

    private static PrototypeTurretArcSafetyResult Unsafe(int samples, string message, Vector3 worldPosition, float yaw, float pitch)
    {
        return new PrototypeTurretArcSafetyResult
        {
            hasSafetyData = true,
            isSafe = false,
            sampledYawPitchPairs = samples,
            message = message,
            firstUnsafeWorldPosition = worldPosition,
            firstUnsafeYawDegrees = yaw,
            firstUnsafePitchDegrees = pitch
        };
    }

    private static bool IsFinite(float value)
    {
        return !float.IsNaN(value) && !float.IsInfinity(value);
    }

    private void OnDrawGizmosSelected()
    {
        if (!drawDebugGizmos)
        {
            return;
        }

        ResolveMissingReferences();
        Transform root = MountRoot;
        Gizmos.color = Color.yellow;
        Gizmos.DrawWireSphere(root.position, 0.25f);

        if (muzzle != null)
        {
            Gizmos.color = Color.red;
            Gizmos.DrawWireSphere(muzzle.position, 0.12f);
            Gizmos.DrawLine(muzzle.position, muzzle.position + muzzle.forward * 2f);
        }
    }
}
