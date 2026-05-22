using UnityEngine;

public enum PrototypeTurretFireBlockReason
{
    None,
    NoMuzzle,
    NoAuthority,
    OutOfArc,
    Cooldown,
    OutOfRange,
    Aligning,
    MissingImportedMarker,
    SafetyDataMissing,
    SafetyUnsafe,
    LineBlocked
}

[System.Serializable]
public struct PrototypeTurretFireStatus
{
    public bool canFire;
    public PrototypeTurretFireBlockReason blockReason;
    public string message;
    public float requestedYawDegrees;
    public float requestedPitchDegrees;
    public float appliedYawDegrees;
    public float appliedPitchDegrees;
    public float cooldownRemainingSeconds;
    public float distanceMeters;
    public bool hasSelectedTarget;
    public bool intendedHit;

    public static PrototypeTurretFireStatus Ready(
        float requestedYawDegrees,
        float requestedPitchDegrees,
        float appliedYawDegrees,
        float appliedPitchDegrees,
        float distanceMeters,
        bool hasSelectedTarget)
    {
        return new PrototypeTurretFireStatus
        {
            canFire = true,
            blockReason = PrototypeTurretFireBlockReason.None,
            message = hasSelectedTarget ? "in arc" : "boresight",
            requestedYawDegrees = requestedYawDegrees,
            requestedPitchDegrees = requestedPitchDegrees,
            appliedYawDegrees = appliedYawDegrees,
            appliedPitchDegrees = appliedPitchDegrees,
            cooldownRemainingSeconds = 0f,
            distanceMeters = distanceMeters,
            hasSelectedTarget = hasSelectedTarget,
            intendedHit = true
        };
    }

    public static PrototypeTurretFireStatus Blocked(
        PrototypeTurretFireBlockReason reason,
        string message,
        float requestedYawDegrees = 0f,
        float requestedPitchDegrees = 0f,
        float appliedYawDegrees = 0f,
        float appliedPitchDegrees = 0f,
        float cooldownRemainingSeconds = 0f,
        float distanceMeters = 0f,
        bool hasSelectedTarget = false)
    {
        return new PrototypeTurretFireStatus
        {
            canFire = false,
            blockReason = reason,
            message = message,
            requestedYawDegrees = requestedYawDegrees,
            requestedPitchDegrees = requestedPitchDegrees,
            appliedYawDegrees = appliedYawDegrees,
            appliedPitchDegrees = appliedPitchDegrees,
            cooldownRemainingSeconds = Mathf.Max(0f, cooldownRemainingSeconds),
            distanceMeters = Mathf.Max(0f, distanceMeters),
            hasSelectedTarget = hasSelectedTarget,
            intendedHit = false
        };
    }
}

[System.Serializable]
public struct PrototypeTurretArcSafetyResult
{
    public bool hasSafetyData;
    public bool isSafe;
    public int sampledYawPitchPairs;
    public string message;
    public Vector3 firstUnsafeWorldPosition;
    public float firstUnsafeYawDegrees;
    public float firstUnsafePitchDegrees;

    public static PrototypeTurretArcSafetyResult MissingData()
    {
        return new PrototypeTurretArcSafetyResult
        {
            hasSafetyData = false,
            isSafe = false,
            sampledYawPitchPairs = 0,
            message = "missing safety data",
            firstUnsafeWorldPosition = Vector3.zero,
            firstUnsafeYawDegrees = 0f,
            firstUnsafePitchDegrees = 0f
        };
    }
}
