#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;
using UnityEngine;

public class CelestialOrbitMapValidationTests
{
    [Test]
    public void StarterOrbitMapSnapshotIncludesRequiredBodiesAndIsDeterministic()
    {
        List<CelestialBodyDefinition> definitions = CelestialStarterCatalog.CreateDefinitions();
        Assert.True(CelestialOrbitMapSnapshotBuilder.TryBuildSnapshot(definitions, 0d, out CelestialOrbitMapSnapshot snapshot, 64));

        CollectionAssert.AreEquivalent(
            new[] { "star.aurelia", "planet.hestia", "moon.hestia.luma", "asteroid.eber" },
            snapshot.Bodies.Select(body => body.BodyId));

        string[] firstReadout = CelestialOrbitMapSnapshotBuilder.BuildDebugReadoutLines(snapshot, 6);
        string[] secondReadout = CelestialOrbitMapSnapshotBuilder.BuildDebugReadoutLines(snapshot, 6);
        CollectionAssert.AreEqual(firstReadout, secondReadout);
    }

    [Test]
    public void CircularBodyReturnsSameRelativePositionAfterOnePeriod()
    {
        List<CelestialBodyDefinition> definitions = CelestialStarterCatalog.CreateDefinitions();
        CelestialBodyDefinition star = definitions.First(body => body.id == "star.aurelia");
        CelestialBodyDefinition hestia = definitions.First(body => body.id == "planet.hestia");

        double periodSeconds = CelestialOrbitSolver.OrbitalPeriodSeconds(hestia.orbit.semiMajorAxisMeters, star.EffectiveMu);
        Assert.True(double.IsFinite(periodSeconds) && periodSeconds > 0d);

        Assert.True(CelestialOrbitSolver.TryComputeStateAtTime(in hestia.orbit, star.EffectiveMu, 12.5d, out CelestialOrbitState initial));
        Assert.True(CelestialOrbitSolver.TryComputeStateAtTime(in hestia.orbit, star.EffectiveMu, 12.5d + periodSeconds, out CelestialOrbitState replayed));

        AssertLargeWorldVectorApproximately(
            initial.RelativePositionMeters,
            replayed.RelativePositionMeters,
            1e-3d);
    }

    [Test]
    public void EberSamplesRespectPeriapsisAndApoapsisBounds()
    {
        List<CelestialBodyDefinition> definitions = CelestialStarterCatalog.CreateDefinitions();
        CelestialBodyDefinition star = definitions.First(body => body.id == "star.aurelia");
        CelestialBodyDefinition eber = definitions.First(body => body.id == "asteroid.eber");
        LargeWorldVector3d[] samples = CelestialOrbitSolver.SampleOrbitPath(in eber.orbit, star.EffectiveMu, 0d, 256);

        Assert.That(samples.Length, Is.EqualTo(256));
        Assert.That(samples.Length, Is.GreaterThan(8));

        double minRadius = double.PositiveInfinity;
        double maxRadius = 0d;
        for (int i = 0; i < samples.Length; i++)
        {
            double radius = samples[i].Magnitude;
            minRadius = Math.Min(minRadius, radius);
            maxRadius = Math.Max(maxRadius, radius);
        }

        Assert.That(minRadius, Is.GreaterThan(0d));
        Assert.That(maxRadius, Is.GreaterThan(minRadius * 1.01d));
        Assert.That(maxRadius, Is.EqualTo(minRadius * (1d + 2d * eber.orbit.eccentricity)).Within(2d).Percent);
    }

    [Test]
    public void HighEccentricitySolverConvergesWithoutNaN()
    {
        var highEccentricOrbit = new OrbitDefinition
        {
            parentBodyId = "star.parent",
            semiMajorAxisMeters = 8.0e10d,
            eccentricity = 0.95d,
            inclinationDegrees = 7.5d,
            longitudeOfAscendingNodeDegrees = 12d,
            argumentOfPeriapsisDegrees = 33d,
            meanAnomalyAtEpochDegrees = 0d,
            epochSeconds = 0d,
            isAnalytical = true
        };

        Assert.True(CelestialOrbitSolver.TryComputeStateAtTime(
            in highEccentricOrbit,
            3.986004418e14d,
            1000d,
            out CelestialOrbitState state));

        LargeWorldVector3d[] samples = CelestialOrbitSolver.SampleOrbitPath(
            in highEccentricOrbit,
            3.986004418e14d,
            1000d,
            64);

        Assert.That(samples.Length, Is.EqualTo(64));
        Assert.That(state.RelativePositionMeters.Magnitude, Is.GreaterThan(0d));
        Assert.That(double.IsFinite(state.RelativeVelocityMetersPerSecond.Magnitude), Is.True);
    }

    [Test]
    public void InclinedOrbitProducesOutOfPlanePosition()
    {
        var inclinedOrbit = new OrbitDefinition
        {
            parentBodyId = "star.parent",
            semiMajorAxisMeters = 9.0e6d,
            eccentricity = 0.12d,
            inclinationDegrees = 66d,
            longitudeOfAscendingNodeDegrees = 5d,
            argumentOfPeriapsisDegrees = 88d,
            meanAnomalyAtEpochDegrees = 0d,
            epochSeconds = 0d,
            isAnalytical = true
        };

        Assert.True(CelestialOrbitSolver.TryComputeStateAtTime(
            in inclinedOrbit,
            3.986004418e14d,
            7d,
            out CelestialOrbitState state));

        Assert.That(Math.Abs(state.RelativePositionMeters.z), Is.GreaterThan(0d));
        Assert.That(state.RelativePositionMeters.Magnitude, Is.GreaterThan(1_000d));
    }

    [Test]
    public void LumaAbsolutePositionEqualsParentPlusRelative()
    {
        List<CelestialBodyDefinition> definitions = CelestialStarterCatalog.CreateDefinitions();
        Assert.True(CelestialOrbitMapSnapshotBuilder.TryBuildSnapshot(definitions, 128d, out CelestialOrbitMapSnapshot snapshot, 64));

        CelestialOrbitMapBodySnapshot hestia = FindBody(snapshot, "planet.hestia");
        CelestialOrbitMapBodySnapshot luma = FindBody(snapshot, "moon.hestia.luma");

        LargeWorldVector3d expectedAbsolute = hestia.AbsolutePositionMeters + luma.RelativePositionMeters;
        LargeWorldVector3d expectedAbsoluteMap = hestia.AbsolutePositionMapMeters + luma.RelativePositionMapMeters;
        AssertLargeWorldVectorApproximately(luma.AbsolutePositionMeters, expectedAbsolute, 1e-6d);
        AssertLargeWorldVectorApproximately(luma.AbsolutePositionMapMeters, expectedAbsoluteMap, 1e-6d);
        Assert.That(luma.OrbitLineSamplesMeters.Count, Is.GreaterThan(0));
        Assert.That(luma.OrbitLineSamplesMapMeters.Count, Is.EqualTo(luma.OrbitLineSamplesMeters.Count));
        AssertLargeWorldVectorApproximately(luma.OrbitLineSamplesMeters[0], luma.AbsolutePositionMeters, 1e-6d);
        AssertLargeWorldVectorApproximately(luma.OrbitLineSamplesMapMeters[0], luma.AbsolutePositionMapMeters, 1e-6d);
    }

    [Test]
    public void BuilderResolvesParentsInOrderIndependentlyOfInputSequence()
    {
        List<CelestialBodyDefinition> canonical = CelestialStarterCatalog.CreateDefinitions();
        List<CelestialBodyDefinition> reordered = new List<CelestialBodyDefinition>
        {
            canonical[2],
            canonical[0],
            canonical[1],
            canonical[3]
        };

        Assert.True(CelestialOrbitMapSnapshotBuilder.TryBuildSnapshot(canonical, 3d, out CelestialOrbitMapSnapshot canonicalSnapshot, 32));
        Assert.True(CelestialOrbitMapSnapshotBuilder.TryBuildSnapshot(reordered, 3d, out CelestialOrbitMapSnapshot reorderedSnapshot, 32));

        Assert.That(canonicalSnapshot.Bodies.Count, Is.EqualTo(reorderedSnapshot.Bodies.Count));
        for (int i = 0; i < canonicalSnapshot.Bodies.Count; i++)
        {
            CelestialOrbitMapBodySnapshot canonicalBody = canonicalSnapshot.Bodies[i];
            CelestialOrbitMapBodySnapshot reorderedBody = FindBody(reorderedSnapshot, canonicalBody.BodyId);
            AssertLargeWorldVectorApproximately(canonicalBody.AbsolutePositionMeters, reorderedBody.AbsolutePositionMeters, 1e-6d);
            AssertLargeWorldVectorApproximately(canonicalBody.AbsolutePositionMapMeters, reorderedBody.AbsolutePositionMapMeters, 1e-6d);
            Assert.That(canonicalBody.ParentBodyId, Is.EqualTo(reorderedBody.ParentBodyId));
            Assert.That(canonicalBody.OrbitSampleCount, Is.EqualTo(reorderedBody.OrbitSampleCount));
        }
    }

    [Test]
    public void RealAndMapValuesRemainSplitWithScalingPreserved()
    {
        List<CelestialBodyDefinition> definitions = CelestialStarterCatalog.CreateDefinitions();
        Assert.True(CelestialOrbitMapSnapshotBuilder.TryBuildSnapshot(definitions, 24d, out CelestialOrbitMapSnapshot snapshot, 32));

        CelestialOrbitMapBodySnapshot hestia = FindBody(snapshot, "planet.hestia");
        CelestialOrbitMapBodySnapshot luma = FindBody(snapshot, "moon.hestia.luma");
        double mapScale = CelestialOrbitMapSnapshotBuilder.DefaultMapCoordinateScale;

        Assert.That(hestia.VisualMapScale, Is.Not.EqualTo(mapScale));
        Assert.That(hestia.MapCoordinateScale, Is.EqualTo(mapScale));
        Assert.That(luma.MapCoordinateScale, Is.EqualTo(mapScale));
        Assert.That(hestia.RelativePositionMapMeters.x, Is.EqualTo(hestia.RelativePositionMeters.x * mapScale).Within(1e-6));
        Assert.That(hestia.RelativePositionMapMeters.y, Is.EqualTo(hestia.RelativePositionMeters.y * mapScale).Within(1e-6));
        Assert.That(hestia.RelativePositionMapMeters.z, Is.EqualTo(hestia.RelativePositionMeters.z * mapScale).Within(1e-6));
        Assert.That(luma.RelativePositionMapMeters.x, Is.EqualTo(luma.RelativePositionMeters.x * mapScale).Within(1e-6));
        Assert.That(luma.RelativePositionMapMeters.y, Is.EqualTo(luma.RelativePositionMeters.y * mapScale).Within(1e-6));
        Assert.That(luma.RelativePositionMapMeters.z, Is.EqualTo(luma.RelativePositionMeters.z * mapScale).Within(1e-6));

        Assert.That(hestia.OrbitLineSamplesMapMeters.Count, Is.GreaterThan(0));
        Assert.That(hestia.OrbitLineSamplesMeters.Count, Is.EqualTo(hestia.OrbitLineSamplesMapMeters.Count));
        Assert.That(hestia.OrbitLineSamplesMapMeters[0].x, Is.EqualTo(hestia.OrbitLineSamplesMeters[0].x * mapScale).Within(1e-6));
        Assert.That(hestia.OrbitLineSamplesMapMeters[0].y, Is.EqualTo(hestia.OrbitLineSamplesMeters[0].y * mapScale).Within(1e-6));
        Assert.That(hestia.OrbitLineSamplesMapMeters[0].z, Is.EqualTo(hestia.OrbitLineSamplesMeters[0].z * mapScale).Within(1e-6));
    }

    [Test]
    public void BuilderRejectsParentMismatchBetweenBodyAndOrbitDefinition()
    {
        List<CelestialBodyDefinition> definitions = CelestialStarterCatalog.CreateDefinitions();
        CelestialBodyDefinition moon = definitions.First(body => body.id == "moon.hestia.luma");
        moon.parentBodyId = "planet.hestia";
        moon.orbit.parentBodyId = "star.aurelia";

        Assert.False(CelestialOrbitMapSnapshotBuilder.TryBuildSnapshot(definitions, 0d, out _, 32));
    }

    [Test]
    public void DebugReadoutContainsRequiredFieldsForEveryBody()
    {
        List<CelestialBodyDefinition> definitions = CelestialStarterCatalog.CreateDefinitions();
        Assert.True(CelestialOrbitMapSnapshotBuilder.TryBuildSnapshot(definitions, 0d, out CelestialOrbitMapSnapshot snapshot, 16));
        string[] rows = CelestialOrbitMapSnapshotBuilder.BuildDebugReadoutLines(snapshot, 6);

        for (int i = 0; i < snapshot.Bodies.Count; i++)
        {
            string row = rows[i];
            CelestialOrbitMapBodySnapshot body = snapshot.Bodies[i];
            Assert.That(row, Does.Contain(body.BodyId));
            Assert.That(row, Does.Contain(body.BodyType.ToString()));
            Assert.That(row, Does.Contain("r="));
            Assert.That(row, Does.Contain("a="));
            Assert.That(row, Does.Contain("mu="));
            Assert.That(row, Does.Contain("parent="));
            Assert.That(row, Does.Contain("mapScale="));
            Assert.That(row, Does.Contain("samples="));
        }
    }

    private static CelestialOrbitMapBodySnapshot FindBody(CelestialOrbitMapSnapshot snapshot, string id)
    {
        foreach (CelestialOrbitMapBodySnapshot body in snapshot.Bodies)
        {
            if (string.Equals(body.BodyId, id, StringComparison.Ordinal))
            {
                return body;
            }
        }

        Assert.Fail("Missing body id: " + id);
        return null;
    }

    private static void AssertLargeWorldVectorApproximately(
        in LargeWorldVector3d expected,
        in LargeWorldVector3d actual,
        double tolerance)
    {
        Assert.That(actual.x, Is.EqualTo(expected.x).Within(tolerance));
        Assert.That(actual.y, Is.EqualTo(expected.y).Within(tolerance));
        Assert.That(actual.z, Is.EqualTo(expected.z).Within(tolerance));
    }
}
#endif
