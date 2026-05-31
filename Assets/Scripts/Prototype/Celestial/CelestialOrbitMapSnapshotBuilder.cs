using System;
using System.Collections.Generic;

public static class CelestialOrbitMapSnapshotBuilder
{
    public const int DefaultOrbitSampleCount = 64;
    public const int DefaultMaxReadoutRows = 6;
    public const double DefaultMapCoordinateScale = 1d;

    public static bool TryBuildSnapshot(
        IReadOnlyList<CelestialBodyDefinition> definitions,
        double epochSeconds,
        out CelestialOrbitMapSnapshot snapshot,
        int orbitSampleCount = DefaultOrbitSampleCount)
    {
        snapshot = null;
        if (definitions == null || orbitSampleCount <= 1)
        {
            return false;
        }

        var byId = new Dictionary<string, CelestialBodyDefinition>(StringComparer.Ordinal);
        for (int i = 0; i < definitions.Count; i++)
        {
            CelestialBodyDefinition body = definitions[i];
            if (body == null || string.IsNullOrWhiteSpace(body.id))
            {
                return false;
            }

            if (byId.ContainsKey(body.id))
            {
                return false;
            }

            byId.Add(body.id, body);
        }

        var resolved = new Dictionary<string, CelestialOrbitMapBodySnapshot>(StringComparer.Ordinal);
        var inFlight = new HashSet<string>(StringComparer.Ordinal);
        List<string> orderedIds = new List<string>(byId.Keys);
        orderedIds.Sort(StringComparer.Ordinal);

        var orderedSnapshots = new List<CelestialOrbitMapBodySnapshot>(orderedIds.Count);
        for (int i = 0; i < orderedIds.Count; i++)
        {
            string bodyId = orderedIds[i];
            if (!TryResolveBodySnapshot(
                bodyId,
                byId,
                epochSeconds,
                orbitSampleCount,
                resolved,
                inFlight,
                orderedSnapshots))
            {
                return false;
            }
        }

        snapshot = new CelestialOrbitMapSnapshot(
            "Celestial Catalog Snapshot",
            epochSeconds,
            orderedSnapshots.ToArray());
        return true;
    }

    public static bool TryBuildSnapshot(
        CelestialBodyCatalog catalog,
        double epochSeconds,
        out CelestialOrbitMapSnapshot snapshot,
        int orbitSampleCount = DefaultOrbitSampleCount)
    {
        if (catalog == null || catalog.Bodies == null)
        {
            snapshot = null;
            return false;
        }

        return TryBuildSnapshot(catalog.Bodies, epochSeconds, out snapshot, orbitSampleCount);
    }

    public static string[] BuildDebugReadoutLines(CelestialOrbitMapSnapshot snapshot, int maxRows = DefaultMaxReadoutRows)
    {
        if (snapshot == null || snapshot.Bodies == null)
        {
            return Array.Empty<string>();
        }

        int rowLimit = maxRows <= 0 ? DefaultMaxReadoutRows : maxRows;
        int count = Math.Min(snapshot.Bodies.Count, rowLimit);
        var rows = new string[count];
        for (int i = 0; i < count; i++)
        {
            rows[i] = BuildReadoutLine(snapshot.Bodies[i]);
        }

        return rows;
    }

    private static string BuildReadoutLine(CelestialOrbitMapBodySnapshot body)
    {
        return string.Concat(
            body.BodyId,
            " | ",
            body.BodyType,
            " | r=",
            FormatWithSiSuffix(body.RealRadiusMeters),
            " | a=",
            FormatWithSiSuffix(body.SemiMajorAxisMeters),
            " | mu=",
            FormatWithSiSuffix(body.BodyMu),
            " | parent=",
            body.ParentBodyIdOrNone,
            " | mapScale=",
            body.VisualMapScale.ToString("0.###"),
            " | samples=",
            body.OrbitSampleCount);
    }

    private static bool TryResolveBodySnapshot(
        string bodyId,
        IReadOnlyDictionary<string, CelestialBodyDefinition> byId,
        double epochSeconds,
        int orbitSampleCount,
        Dictionary<string, CelestialOrbitMapBodySnapshot> resolved,
        HashSet<string> inFlight,
        List<CelestialOrbitMapBodySnapshot> orderedSnapshots)
    {
        if (resolved.TryGetValue(bodyId, out CelestialOrbitMapBodySnapshot existing))
        {
            return true;
        }

        if (!inFlight.Add(bodyId))
        {
            return false;
        }

        try
        {
            if (!byId.TryGetValue(bodyId, out CelestialBodyDefinition body))
            {
                return false;
            }

            string parentBodyId = body.parentBodyId;
            bool hasParent = !string.IsNullOrWhiteSpace(parentBodyId);
            LargeWorldVector3d parentAbsoluteMeters = LargeWorldVector3d.Zero;
            LargeWorldVector3d parentAbsoluteVelocityMetersPerSecond = LargeWorldVector3d.Zero;
            LargeWorldVector3d parentAbsoluteMapMeters = LargeWorldVector3d.Zero;
            LargeWorldVector3d parentAbsoluteVelocityMapMetersPerSecond = LargeWorldVector3d.Zero;
            double parentMu = 0d;

            if (hasParent)
            {
                if (!body.hasOrbit)
                {
                    return false;
                }

                if (!string.Equals(body.orbit.parentBodyId, parentBodyId, StringComparison.Ordinal))
                {
                    // Accepted definitions can be raw and unvalidated here, so enforce parent/orbit consistency at build time.
                    return false;
                }

                if (!byId.TryGetValue(parentBodyId, out _))
                {
                    return false;
                }

                if (!TryResolveBodySnapshot(
                    parentBodyId,
                    byId,
                    epochSeconds,
                    orbitSampleCount,
                    resolved,
                    inFlight,
                    orderedSnapshots))
                {
                    return false;
                }

                if (!resolved.TryGetValue(parentBodyId, out CelestialOrbitMapBodySnapshot parentSnapshot))
                {
                    return false;
                }

                parentAbsoluteMeters = parentSnapshot.AbsolutePositionMeters;
                parentAbsoluteVelocityMetersPerSecond = parentSnapshot.AbsoluteVelocityMetersPerSecond;
                parentAbsoluteMapMeters = parentSnapshot.AbsolutePositionMapMeters;
                parentAbsoluteVelocityMapMetersPerSecond = parentSnapshot.AbsoluteVelocityMapMetersPerSecond;
                parentMu = parentSnapshot.BodyMu;
            }

            LargeWorldVector3d relativePositionMeters = LargeWorldVector3d.Zero;
            LargeWorldVector3d relativeVelocityMetersPerSecond = LargeWorldVector3d.Zero;
            double relativeRadiusMeters = 0d;
            bool hasValidOrbit = body.hasOrbit
                && body.orbit.semiMajorAxisMeters > 0d
                && body.orbit.eccentricity >= 0d
                && body.orbit.eccentricity < 1d;

            if (hasValidOrbit)
            {
                if (parentMu <= 0d)
                {
                    return false;
                }

                if (!CelestialOrbitSolver.TryComputeStateAtTime(
                    in body.orbit,
                    parentMu,
                    epochSeconds,
                    out CelestialOrbitState state))
                {
                    return false;
                }

                relativePositionMeters = state.RelativePositionMeters;
                relativeVelocityMetersPerSecond = state.RelativeVelocityMetersPerSecond;
                relativeRadiusMeters = state.RadiusMeters;
            }
            else if (body.hasOrbit)
            {
                return false;
            }

            double mapScale = DefaultMapCoordinateScale;
            LargeWorldVector3d relativeMapPositionMeters = relativePositionMeters * mapScale;
            LargeWorldVector3d absolutePositionMeters = parentAbsoluteMeters + relativePositionMeters;
            LargeWorldVector3d absoluteVelocityMetersPerSecond = parentAbsoluteVelocityMetersPerSecond + relativeVelocityMetersPerSecond;
            LargeWorldVector3d absolutePositionMapMeters = parentAbsoluteMapMeters + relativeMapPositionMeters;
            LargeWorldVector3d absoluteVelocityMapMetersPerSecond = parentAbsoluteVelocityMapMetersPerSecond
                + (relativeVelocityMetersPerSecond * mapScale);

            LargeWorldVector3d[] orbitSamplesMeters = Array.Empty<LargeWorldVector3d>();
            LargeWorldVector3d[] orbitSamplesMapMeters = Array.Empty<LargeWorldVector3d>();
            if (hasValidOrbit)
            {
                LargeWorldVector3d[] orbitSamplesRelativeMeters = CelestialOrbitSolver.SampleOrbitPath(
                    in body.orbit,
                    parentMu,
                    epochSeconds,
                    orbitSampleCount);

                if (orbitSamplesRelativeMeters == null || orbitSamplesRelativeMeters.Length == 0)
                {
                    return false;
                }

                orbitSamplesMeters = new LargeWorldVector3d[orbitSamplesRelativeMeters.Length];
                orbitSamplesMapMeters = new LargeWorldVector3d[orbitSamplesRelativeMeters.Length];
                for (int i = 0; i < orbitSamplesRelativeMeters.Length; i++)
                {
                    LargeWorldVector3d relativeSample = orbitSamplesRelativeMeters[i];
                    orbitSamplesMeters[i] = parentAbsoluteMeters + relativeSample;
                    orbitSamplesMapMeters[i] = parentAbsoluteMapMeters + (relativeSample * mapScale);
                }
            }
            var snapshot = new CelestialOrbitMapBodySnapshot(
                body.id,
                body.displayName,
                body.bodyType,
                parentBodyId,
                epochSeconds,
                body.radiusMeters,
                body.orbit.semiMajorAxisMeters,
                body.EffectiveMu,
                body.visualScale.mapRadiusScale,
                mapScale,
                relativePositionMeters,
                relativeVelocityMetersPerSecond,
                relativeRadiusMeters,
                absolutePositionMeters,
                absoluteVelocityMetersPerSecond,
                relativeMapPositionMeters,
                absolutePositionMapMeters,
                absoluteVelocityMapMetersPerSecond,
                orbitSamplesMeters,
                orbitSamplesMapMeters);

            resolved.Add(body.id, snapshot);
            orderedSnapshots.Add(snapshot);
            return true;
        }
        finally
        {
            inFlight.Remove(bodyId);
        }
    }

    private static string FormatWithSiSuffix(double value)
    {
        if (!double.IsFinite(value))
        {
            return "n/a";
        }

        if (value == 0d)
        {
            return "0 m";
        }

        double absolute = Math.Abs(value);
        const double thousand = 1000d;
        string[] prefixes = { "", "k", "M", "G", "T", "P", "E", "Z", "Y" };
        int prefixIndex = 0;
        while (absolute >= thousand && prefixIndex < prefixes.Length - 1)
        {
            absolute *= 0.001d;
            prefixIndex++;
        }

        double scaled = value / Math.Pow(thousand, prefixIndex);
        return $"{scaled:0.###} {prefixes[prefixIndex]}m";
    }
}

public sealed class CelestialOrbitMapSnapshot
{
    public CelestialOrbitMapSnapshot(
        string sourceLabel,
        double epochSeconds,
        IReadOnlyList<CelestialOrbitMapBodySnapshot> bodies)
    {
        SourceLabel = sourceLabel;
        EpochSeconds = epochSeconds;
        Bodies = bodies;
        OrbitSampleCount = bodies != null ? ResolveOrbitSampleCount(bodies) : 0;
    }

    public string SourceLabel { get; }
    public double EpochSeconds { get; }
    public IReadOnlyList<CelestialOrbitMapBodySnapshot> Bodies { get; }
    public int OrbitSampleCount { get; }

    private static int ResolveOrbitSampleCount(IReadOnlyList<CelestialOrbitMapBodySnapshot> bodies)
    {
        int sampleCount = 0;
        for (int i = 0; i < bodies.Count; i++)
        {
            int current = bodies[i]?.OrbitSampleCount ?? 0;
            if (current > sampleCount)
            {
                sampleCount = current;
            }
        }

        return sampleCount;
    }
}

public sealed class CelestialOrbitMapBodySnapshot
{
    public CelestialOrbitMapBodySnapshot(
        string bodyId,
        string displayName,
        CelestialBodyType bodyType,
        string parentBodyId,
        double epochSeconds,
        double realRadiusMeters,
        double semiMajorAxisMeters,
        double bodyMu,
        double visualMapScale,
        double mapCoordinateScale,
        LargeWorldVector3d relativePositionMeters,
        LargeWorldVector3d relativeVelocityMetersPerSecond,
        double relativeRadiusMeters,
        LargeWorldVector3d absolutePositionMeters,
        LargeWorldVector3d absoluteVelocityMetersPerSecond,
        LargeWorldVector3d relativePositionMapMeters,
        LargeWorldVector3d absolutePositionMapMeters,
        LargeWorldVector3d absoluteVelocityMapMetersPerSecond,
        IReadOnlyList<LargeWorldVector3d> orbitLineSamplesMeters,
        IReadOnlyList<LargeWorldVector3d> orbitLineSamplesMapMeters)
    {
        BodyId = bodyId;
        DisplayName = displayName;
        BodyType = bodyType;
        ParentBodyId = parentBodyId;
        EpochSeconds = epochSeconds;
        RealRadiusMeters = realRadiusMeters;
        SemiMajorAxisMeters = semiMajorAxisMeters;
        BodyMu = bodyMu;
        VisualMapScale = visualMapScale;
        MapCoordinateScale = mapCoordinateScale;
        RelativePositionMeters = relativePositionMeters;
        RelativeVelocityMetersPerSecond = relativeVelocityMetersPerSecond;
        RelativeRadiusMeters = relativeRadiusMeters;
        AbsolutePositionMeters = absolutePositionMeters;
        AbsoluteVelocityMetersPerSecond = absoluteVelocityMetersPerSecond;
        RelativePositionMapMeters = relativePositionMapMeters;
        AbsolutePositionMapMeters = absolutePositionMapMeters;
        AbsoluteVelocityMapMetersPerSecond = absoluteVelocityMapMetersPerSecond;
        OrbitLineSamplesMeters = orbitLineSamplesMeters ?? Array.Empty<LargeWorldVector3d>();
        OrbitLineSamplesMapMeters = orbitLineSamplesMapMeters ?? Array.Empty<LargeWorldVector3d>();
    }

    public string BodyId { get; }
    public string DisplayName { get; }
    public CelestialBodyType BodyType { get; }
    public string ParentBodyId { get; }
    public string ParentBodyIdOrNone => string.IsNullOrWhiteSpace(ParentBodyId) ? "none" : ParentBodyId;
    public double EpochSeconds { get; }
    public double RealRadiusMeters { get; }
    public double SemiMajorAxisMeters { get; }
    public double BodyMu { get; }
    public double VisualMapScale { get; }
    public double MapCoordinateScale { get; }
    public LargeWorldVector3d RelativePositionMeters { get; }
    public LargeWorldVector3d RelativeVelocityMetersPerSecond { get; }
    public double RelativeRadiusMeters { get; }
    public LargeWorldVector3d AbsolutePositionMeters { get; }
    public LargeWorldVector3d AbsoluteVelocityMetersPerSecond { get; }
    public LargeWorldVector3d RelativePositionMapMeters { get; }
    public LargeWorldVector3d AbsolutePositionMapMeters { get; }
    public LargeWorldVector3d AbsoluteVelocityMapMetersPerSecond { get; }
    public IReadOnlyList<LargeWorldVector3d> OrbitLineSamplesMeters { get; }
    public IReadOnlyList<LargeWorldVector3d> OrbitLineSamplesMapMeters { get; }
    public int OrbitSampleCount => OrbitLineSamplesMeters.Count;
}
