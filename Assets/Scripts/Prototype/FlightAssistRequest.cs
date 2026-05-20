using UnityEngine;

public enum FlightAssistMode
{
    Simulation,
    AssistedFlight,
    DebugAssist
}

public enum FlightAssistRequestSource
{
    None,
    Manual,
    Sas,
    FlightAssist,
    MomentumAssist,
    Docking,
    WaypointAutopilot,
    DebugOnly
}

[System.Serializable]
public struct FlightAssistRequest
{
    public FlightAssistMode mode;
    public FlightAssistRequestSource source;
    public Vector3 forceWorld;
    public Vector3 torqueLocal;
    public float mainThrottle;
    public bool debugOnlyNonPhysical;

    public FlightAssistRequest(
        FlightAssistMode mode,
        FlightAssistRequestSource source,
        Vector3 forceWorld,
        Vector3 torqueLocal,
        bool debugOnlyNonPhysical)
        : this(mode, source, forceWorld, torqueLocal, 0f, debugOnlyNonPhysical)
    {
    }

    public FlightAssistRequest(
        FlightAssistMode mode,
        FlightAssistRequestSource source,
        Vector3 forceWorld,
        Vector3 torqueLocal,
        float mainThrottle,
        bool debugOnlyNonPhysical)
    {
        this.mode = mode;
        this.source = source;
        this.forceWorld = forceWorld;
        this.torqueLocal = torqueLocal;
        this.mainThrottle = Mathf.Clamp01(mainThrottle);
        this.debugOnlyNonPhysical = debugOnlyNonPhysical;
    }

    public static FlightAssistRequest None => new FlightAssistRequest(
        FlightAssistMode.Simulation,
        FlightAssistRequestSource.None,
        Vector3.zero,
        Vector3.zero,
        false);

    public bool HasPhysicalRequest => !debugOnlyNonPhysical
        && (forceWorld.sqrMagnitude > 0.0001f || torqueLocal.sqrMagnitude > 0.0001f);

    public bool HasAnyRequest => forceWorld.sqrMagnitude > 0.0001f || torqueLocal.sqrMagnitude > 0.0001f || mainThrottle > 0.0001f;
}
