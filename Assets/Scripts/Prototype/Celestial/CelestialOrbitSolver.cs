using System;

public static class CelestialOrbitSolver
{
    public const double RadiansPerDegree = Math.PI / 180d;
    private const double TwoPi = Math.PI * 2d;
    private const int MaxNewtonIterations = 24;
    private const int MaxBisectionIterations = 48;
    private const double AngleToleranceRadians = 1e-13d;

    public static bool TryComputeStateAtTime(
        in OrbitDefinition orbitDefinition,
        double parentMu,
        double timeSeconds,
        out CelestialOrbitState state)
    {
        state = default;

        if (parentMu <= 0d
            || orbitDefinition.semiMajorAxisMeters <= 0d
            || orbitDefinition.eccentricity < 0d
            || orbitDefinition.eccentricity >= 1d
            || double.IsNaN(parentMu)
            || double.IsNaN(timeSeconds))
        {
            return false;
        }

        double semiMajorAxis = orbitDefinition.semiMajorAxisMeters;
        double eccentricity = orbitDefinition.eccentricity;
        double meanMotion = Math.Sqrt(parentMu / (semiMajorAxis * semiMajorAxis * semiMajorAxis));

        double meanAnomalyAtEpochRadians = orbitDefinition.meanAnomalyAtEpochDegrees * RadiansPerDegree;
        double elapsedSeconds = timeSeconds - orbitDefinition.epochSeconds;
        double meanAnomaly = meanAnomalyAtEpochRadians + (meanMotion * elapsedSeconds);
        meanAnomaly = WrapAngle(meanAnomaly);

        double eccentricAnomaly = SolveEccentricAnomaly(meanAnomaly, eccentricity);
        if (double.IsNaN(eccentricAnomaly))
        {
            return false;
        }

        double cosE = Math.Cos(eccentricAnomaly);
        double sinE = Math.Sin(eccentricAnomaly);
        double oneMinusECosE = 1d - (eccentricity * cosE);
        if (Math.Abs(oneMinusECosE) <= double.Epsilon)
        {
            return false;
        }

        double sqrtOneMinusESquared = Math.Sqrt(1d - (eccentricity * eccentricity));
        double orbitPlaneX = semiMajorAxis * (cosE - eccentricity);
        double orbitPlaneY = semiMajorAxis * sqrtOneMinusESquared * sinE;
        double eccentricMotion = meanMotion / oneMinusECosE;
        double orbitVelocityX = -semiMajorAxis * sinE * eccentricMotion;
        double orbitVelocityY = semiMajorAxis * sqrtOneMinusESquared * cosE * eccentricMotion;

        double inclinationRadians = orbitDefinition.inclinationDegrees * RadiansPerDegree;
        double longitudeNodeRadians = orbitDefinition.longitudeOfAscendingNodeDegrees * RadiansPerDegree;
        double argumentOfPeriapsisRadians = orbitDefinition.argumentOfPeriapsisDegrees * RadiansPerDegree;

        double cosArgument = Math.Cos(argumentOfPeriapsisRadians);
        double sinArgument = Math.Sin(argumentOfPeriapsisRadians);
        double cosInclination = Math.Cos(inclinationRadians);
        double sinInclination = Math.Sin(inclinationRadians);
        double cosNode = Math.Cos(longitudeNodeRadians);
        double sinNode = Math.Sin(longitudeNodeRadians);

        double x1 = (orbitPlaneX * cosArgument) - (orbitPlaneY * sinArgument);
        double y1 = (orbitPlaneX * sinArgument) + (orbitPlaneY * cosArgument);
        double vx1 = (orbitVelocityX * cosArgument) - (orbitVelocityY * sinArgument);
        double vy1 = (orbitVelocityX * sinArgument) + (orbitVelocityY * cosArgument);

        double x2 = x1;
        double y2 = y1 * cosInclination;
        double z2 = y1 * sinInclination;
        double vx2 = vx1;
        double vy2 = vy1 * cosInclination;
        double vz2 = vy1 * sinInclination;

        double x = x2 * cosNode - y2 * sinNode;
        double y = x2 * sinNode + y2 * cosNode;
        double z = z2;
        double vx = vx2 * cosNode - vy2 * sinNode;
        double vy = vx2 * sinNode + vy2 * cosNode;
        double vz = vz2;

        state = new CelestialOrbitState(
            new LargeWorldVector3d(x, y, z),
            new LargeWorldVector3d(vx, vy, vz),
            semiMajorAxis * oneMinusECosE,
            meanAnomaly,
            eccentricAnomaly);

        return IsFinite(state.RelativePositionMeters) && IsFinite(state.RelativeVelocityMetersPerSecond);
    }

    public static double OrbitalPeriodSeconds(double semiMajorAxisMeters, double parentMu)
    {
        if (semiMajorAxisMeters <= 0d || parentMu <= 0d || double.IsNaN(semiMajorAxisMeters) || double.IsNaN(parentMu))
        {
            return double.NaN;
        }

        return TwoPi * Math.Sqrt((semiMajorAxisMeters * semiMajorAxisMeters * semiMajorAxisMeters) / parentMu);
    }

    public static LargeWorldVector3d[] SampleOrbitPath(
        in OrbitDefinition orbitDefinition,
        double parentMu,
        double centerTimeSeconds,
        int sampleCount)
    {
        if (sampleCount < 2 || orbitDefinition.eccentricity < 0d || orbitDefinition.eccentricity >= 1d || parentMu <= 0d)
        {
            return Array.Empty<LargeWorldVector3d>();
        }

        double orbitalPeriod = OrbitalPeriodSeconds(orbitDefinition.semiMajorAxisMeters, parentMu);
        if (!double.IsFinite(orbitalPeriod) || orbitalPeriod <= 0d)
        {
            return Array.Empty<LargeWorldVector3d>();
        }

        var samples = new LargeWorldVector3d[sampleCount];
        double stepSeconds = orbitalPeriod / (sampleCount - 1d);
        for (int i = 0; i < sampleCount; i++)
        {
            double sampleTime = centerTimeSeconds + (i * stepSeconds);
            if (!TryComputeStateAtTime(in orbitDefinition, parentMu, sampleTime, out CelestialOrbitState sampleState))
            {
                return Array.Empty<LargeWorldVector3d>();
            }

            samples[i] = sampleState.RelativePositionMeters;
        }

        return samples;
    }

    private static double SolveEccentricAnomaly(double meanAnomalyRadians, double eccentricity)
    {
        double target = WrapAngle(meanAnomalyRadians);
        double estimate = target;
        double lower = 0d;
        double upper = TwoPi;

        for (int i = 0; i < MaxNewtonIterations; i++)
        {
            double f = estimate - (eccentricity * Math.Sin(estimate)) - target;
            if (Math.Abs(f) < AngleToleranceRadians)
            {
                return estimate;
            }

            double fp = 1d - (eccentricity * Math.Cos(estimate));
            if (Math.Abs(fp) <= double.Epsilon)
            {
                break;
            }

            double next = estimate - (f / fp);
            if (!double.IsFinite(next))
            {
                break;
            }

            if (next >= lower && next <= upper)
            {
                estimate = next;
                continue;
            }

            break;
        }

        return SolveEccentricAnomalyByBisection(target, eccentricity, lower, upper);
    }

    private static double SolveEccentricAnomalyByBisection(double meanAnomalyRadians, double eccentricity, double lower, double upper)
    {
        double target = WrapAngle(meanAnomalyRadians);
        double a = lower;
        double b = upper;
        double fa = KeplerResidual(a, eccentricity, target);
        double fb = KeplerResidual(b, eccentricity, target);

        if (!double.IsFinite(fa) || !double.IsFinite(fb))
        {
            return double.NaN;
        }

        if (fa > 0d || fb < 0d)
        {
            return double.NaN;
        }

        double x = (a + b) * 0.5d;
        for (int i = 0; i < MaxBisectionIterations; i++)
        {
            x = (a + b) * 0.5d;
            double fx = KeplerResidual(x, eccentricity, target);
            if (!double.IsFinite(fx))
            {
                return double.NaN;
            }

            if (Math.Abs(fx) < 2d * AngleToleranceRadians)
            {
                return x;
            }

            if (fx > 0d)
            {
                b = x;
                fb = fx;
            }
            else
            {
                a = x;
                fa = fx;
            }
        }

        return x;
    }

    private static double KeplerResidual(double eccentricAnomaly, double eccentricity, double target)
    {
        return eccentricAnomaly - (eccentricity * Math.Sin(eccentricAnomaly)) - target;
    }

    private static double WrapAngle(double angleRadians)
    {
        double value = angleRadians % TwoPi;
        if (value < 0d)
        {
            value += TwoPi;
        }

        return value;
    }

    private static bool IsFinite(LargeWorldVector3d value)
    {
        return double.IsFinite(value.x) && double.IsFinite(value.y) && double.IsFinite(value.z);
    }
}

public readonly struct CelestialOrbitState
{
    public CelestialOrbitState(
        LargeWorldVector3d relativePositionMeters,
        LargeWorldVector3d relativeVelocityMetersPerSecond,
        double radiusMeters,
        double meanAnomalyRadians,
        double eccentricAnomalyRadians)
    {
        RelativePositionMeters = relativePositionMeters;
        RelativeVelocityMetersPerSecond = relativeVelocityMetersPerSecond;
        RadiusMeters = radiusMeters;
        MeanAnomalyRadians = meanAnomalyRadians;
        EccentricAnomalyRadians = eccentricAnomalyRadians;
    }

    public LargeWorldVector3d RelativePositionMeters { get; }
    public LargeWorldVector3d RelativeVelocityMetersPerSecond { get; }
    public double RadiusMeters { get; }
    public double MeanAnomalyRadians { get; }
    public double EccentricAnomalyRadians { get; }
}
