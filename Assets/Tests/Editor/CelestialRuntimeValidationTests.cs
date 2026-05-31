#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;
using UnityEditor;
using UnityEngine;

public class CelestialRuntimeValidationTests
{
    [Test]
    public void StarterCatalogAssetLoadsAndValidates()
    {
        CelestialBodyCatalog catalog = LoadStarterCatalog();

        CelestialCatalogValidationResult validation = CelestialBodyCatalogValidator.Validate(catalog);

        Assert.That(validation.IsValid, Is.True, DescribeIssues(validation));
        Assert.That(catalog.Bodies.Count, Is.EqualTo(4));
        Assert.True(CelestialBodyRegistry.TryCreate(catalog, out CelestialBodyRegistry registry, out validation), DescribeIssues(validation));
        Assert.True(registry.TryGetBody("star.aurelia", out _));
        Assert.True(registry.TryGetBody("planet.hestia", out _));
        Assert.True(registry.TryGetBody("moon.hestia.luma", out _));
        Assert.True(registry.TryGetBody("asteroid.eber", out _));
    }

    [Test]
    public void BodyTypeEnumCoversConceptContract()
    {
        string[] names = Enum.GetNames(typeof(CelestialBodyType));

        CollectionAssert.IsSupersetOf(names, new[]
        {
            "Star",
            "RockyPlanet",
            "SuperEarth",
            "GasGiant",
            "IceGiant",
            "Moon",
            "Asteroid",
            "Comet",
            "Station",
            "ArtificialStructure"
        });
    }

    [Test]
    [TestCase("PLANET.AURELIA")]
    [TestCase("planetaurelia")]
    [TestCase("")]
    public void ValidatorRejectsInvalidBodyId(string invalidBodyId)
    {
        List<CelestialBodyDefinition> definitions = CelestialStarterCatalog.CreateDefinitions();
        definitions[0].id = invalidBodyId;

        CelestialCatalogValidationResult validation = CelestialBodyCatalogValidator.Validate(definitions);

        Assert.False(validation.IsValid);
        Assert.That(validation.Issues.Any(issue => issue.Code == CelestialCatalogValidationCode.InvalidId), Is.True, DescribeIssues(validation));
    }

    [Test]
    public void ValidatorRejectsInvalidVisualScale()
    {
        List<CelestialBodyDefinition> definitions = CelestialStarterCatalog.CreateDefinitions();
        definitions[1].visualScale.mapRadiusScale = 0d;

        CelestialCatalogValidationResult validation = CelestialBodyCatalogValidator.Validate(definitions);

        Assert.False(validation.IsValid);
        Assert.That(validation.Issues.Any(issue => issue.Code == CelestialCatalogValidationCode.InvalidVisualScale), Is.True, DescribeIssues(validation));
    }

    [Test]
    public void ValidatorRejectsMissingOrbit()
    {
        List<CelestialBodyDefinition> definitions = CelestialStarterCatalog.CreateDefinitions();
        CelestialBodyDefinition moon = definitions.First(body => body.id == "moon.hestia.luma");
        moon.hasOrbit = false;

        CelestialCatalogValidationResult validation = CelestialBodyCatalogValidator.Validate(definitions);

        Assert.False(validation.IsValid);
        Assert.That(validation.Issues.Any(issue => issue.Code == CelestialCatalogValidationCode.MissingOrbit), Is.True, DescribeIssues(validation));
    }

    [Test]
    public void ValidatorRejectsInvalidOrbit()
    {
        List<CelestialBodyDefinition> definitions = CelestialStarterCatalog.CreateDefinitions();
        CelestialBodyDefinition moon = definitions.First(body => body.id == "moon.hestia.luma");
        moon.orbit.eccentricity = 1.5d;

        CelestialCatalogValidationResult validation = CelestialBodyCatalogValidator.Validate(definitions);

        Assert.False(validation.IsValid);
        Assert.That(validation.Issues.Any(issue => issue.Code == CelestialCatalogValidationCode.InvalidOrbit), Is.True, DescribeIssues(validation));
    }

    [Test]
    public void ValidatorRejectsParentMismatch()
    {
        List<CelestialBodyDefinition> definitions = CelestialStarterCatalog.CreateDefinitions();
        CelestialBodyDefinition moon = definitions.First(body => body.id == "moon.hestia.luma");
        moon.parentBodyId = "planet.hestia";
        moon.orbit.parentBodyId = "star.aurelia";

        CelestialCatalogValidationResult validation = CelestialBodyCatalogValidator.Validate(definitions);

        Assert.False(validation.IsValid);
        Assert.That(validation.Issues.Any(issue => issue.Code == CelestialCatalogValidationCode.ParentMismatch), Is.True, DescribeIssues(validation));
    }

    [Test]
    public void StarterCatalogAssetMatchesInMemoryDefinitions()
    {
        CelestialBodyCatalog catalog = LoadStarterCatalog();
        List<CelestialBodyDefinition> inMemoryDefinitions = CelestialStarterCatalog.CreateDefinitions();

        List<string> catalogIds = catalog.Bodies.Select(body => body.id).ToList();
        List<string> inMemoryIds = inMemoryDefinitions.Select(body => body.id).ToList();

        Assert.That(catalogIds.Count, Is.EqualTo(inMemoryIds.Count));
        CollectionAssert.AreEqual(inMemoryIds, catalogIds);
    }

    [Test]
    public void ValidatorRejectsZeroOrNegativeGravityMuEvenWhenGravitationalParameterMuIsSet()
    {
        List<CelestialBodyDefinition> definitions = CelestialStarterCatalog.CreateDefinitions();
        CelestialBodyDefinition hestia = definitions.First(body => body.id == "planet.hestia");
        hestia.gravity.mu = 0d;

        CelestialCatalogValidationResult validation = CelestialBodyCatalogValidator.Validate(definitions);

        Assert.False(validation.IsValid);
        Assert.That(validation.Issues.Any(issue => issue.Code == CelestialCatalogValidationCode.InvalidGravityData), Is.True, DescribeIssues(validation));
    }

    [Test]
    public void HestiaKeepsRealPhysicalValuesSeparateFromVisualScale()
    {
        CelestialBodyCatalog catalog = LoadStarterCatalog();
        Assert.True(CelestialBodyRegistry.TryCreate(catalog, out CelestialBodyRegistry registry, out CelestialCatalogValidationResult validation), DescribeIssues(validation));

        Assert.True(registry.TryGetBody("planet.hestia", out CelestialBodyDefinition hestia));
        Assert.That(hestia.radiusMeters, Is.EqualTo(8282000d).Within(1d));
        Assert.That(hestia.massKg, Is.EqualTo(2.03d * CelestialStarterCatalog.EarthMassKg).Within(1.0e18d));
        Assert.That(hestia.EffectiveMu, Is.EqualTo(8.09e14d).Within(1.0e11d));
        Assert.That(hestia.visualScale.mapRadiusScale, Is.GreaterThan(0d));
        Assert.That(hestia.visualScale.mapRadiusScale, Is.Not.EqualTo(hestia.radiusMeters));
    }

    [Test]
    public void ValidatorRejectsDuplicateIds()
    {
        List<CelestialBodyDefinition> definitions = CelestialStarterCatalog.CreateDefinitions();
        definitions.Add(definitions[0].Clone());

        CelestialCatalogValidationResult validation = CelestialBodyCatalogValidator.Validate(definitions);

        Assert.False(validation.IsValid);
        Assert.That(validation.Issues.Any(issue => issue.Code == CelestialCatalogValidationCode.DuplicateId), Is.True, DescribeIssues(validation));
    }

    [Test]
    public void ValidatorRejectsMissingParent()
    {
        List<CelestialBodyDefinition> definitions = CelestialStarterCatalog.CreateDefinitions();
        definitions.First(body => body.id == "moon.hestia.luma").parentBodyId = "planet.missing";

        CelestialCatalogValidationResult validation = CelestialBodyCatalogValidator.Validate(definitions);

        Assert.False(validation.IsValid);
        Assert.That(validation.Issues.Any(issue => issue.Code == CelestialCatalogValidationCode.MissingParent), Is.True, DescribeIssues(validation));
    }

    [Test]
    public void ValidatorRejectsInvalidPhysicalData()
    {
        List<CelestialBodyDefinition> definitions = CelestialStarterCatalog.CreateDefinitions();
        CelestialBodyDefinition hestia = definitions.First(body => body.id == "planet.hestia");
        hestia.radiusMeters = -1d;
        hestia.massKg = 0d;
        hestia.gravitationalParameterMu = 0d;
        hestia.gravity.mu = 0d;

        CelestialCatalogValidationResult validation = CelestialBodyCatalogValidator.Validate(definitions);

        Assert.False(validation.IsValid);
        Assert.That(validation.Issues.Any(issue => issue.Code == CelestialCatalogValidationCode.InvalidRadius), Is.True, DescribeIssues(validation));
        Assert.That(validation.Issues.Any(issue => issue.Code == CelestialCatalogValidationCode.MissingGravityInput), Is.True, DescribeIssues(validation));
        Assert.That(validation.Issues.Any(issue => issue.Code == CelestialCatalogValidationCode.InvalidGravityData), Is.True, DescribeIssues(validation));
    }

    [Test]
    public void ValidatorRejectsMuMassMismatchBeyondTolerance()
    {
        List<CelestialBodyDefinition> definitions = CelestialStarterCatalog.CreateDefinitions();
        CelestialBodyDefinition hestia = definitions.First(body => body.id == "planet.hestia");
        hestia.gravitationalParameterMu = 1d;
        hestia.gravity.mu = 1d;

        CelestialCatalogValidationResult validation = CelestialBodyCatalogValidator.Validate(definitions);

        Assert.False(validation.IsValid);
        Assert.That(validation.Issues.Any(issue => issue.Code == CelestialCatalogValidationCode.MuMassMismatch), Is.True, DescribeIssues(validation));
    }

    [Test]
    public void RegistryLookupAndDebugSummaryAreDeterministic()
    {
        CelestialBodyCatalog catalog = LoadStarterCatalog();
        Assert.True(CelestialBodyRegistry.TryCreate(catalog, out CelestialBodyRegistry registry, out CelestialCatalogValidationResult validation), DescribeIssues(validation));

        Assert.False(registry.TryGetBody("planet.unknown", out _));
        string summary = registry.BuildDebugSummary();

        int asteroidIndex = FindBodyLineIndex(summary, "asteroid.eber");
        int moonIndex = FindBodyLineIndex(summary, "moon.hestia.luma");
        int planetIndex = FindBodyLineIndex(summary, "planet.hestia");
        int starIndex = FindBodyLineIndex(summary, "star.aurelia");
        Assert.That(asteroidIndex, Is.GreaterThanOrEqualTo(0));
        Assert.That(asteroidIndex, Is.LessThan(moonIndex));
        Assert.That(moonIndex, Is.LessThan(planetIndex));
        Assert.That(planetIndex, Is.LessThan(starIndex));
        StringAssert.Contains("realRadiusMeters", summary);
        StringAssert.Contains("visualMapRadius", summary);
    }

    [Test]
    public void AbsoluteStateUsesLargeWorldVector3dPrecision()
    {
        var state = new AbsoluteState(
            "star.aurelia",
            new LargeWorldVector3d(1.0e12d, -2.0e12d, 3.0e12d),
            new LargeWorldVector3d(12.5d, -6.25d, 3.125d),
            12345d);

        LargeWorldVector3d projected = state.positionMeters + state.velocityMetersPerSecond * 10d;

        Assert.That(projected.x, Is.EqualTo(1.0e12d + 125d).Within(0.001d));
        Assert.That(projected.y, Is.EqualTo(-2.0e12d - 62.5d).Within(0.001d));
        Assert.That(LargeWorldVector3d.Distance(projected, state.positionMeters), Is.EqualTo(state.velocityMetersPerSecond.Magnitude * 10d).Within(0.001d));
        Assert.That(state.referenceFrameId, Is.EqualTo("star.aurelia"));
    }

    [Test]
    public void AbsoluteStateSerializationRoundTripPreservesDoublePrecision()
    {
        var state = new AbsoluteState(
            "star.aurelia",
            new LargeWorldVector3d(1.23456789012345e12d, -9.87654321098765e11d, 4.56789012345678e10d),
            new LargeWorldVector3d(12.1234567890123d, -6.65432109876543d, 3.3333333333333d),
            12345.6789012345d);

        var payload = new AbsoluteStateSerializationWrapper { state = state };
        string json = EditorJsonUtility.ToJson(payload);
        var roundTrip = new AbsoluteStateSerializationWrapper();
        EditorJsonUtility.FromJsonOverwrite(json, roundTrip);

        Assert.That(roundTrip.state.referenceFrameId, Is.EqualTo(state.referenceFrameId));
        Assert.That(roundTrip.state.positionMeters.x, Is.EqualTo(state.positionMeters.x));
        Assert.That(roundTrip.state.positionMeters.y, Is.EqualTo(state.positionMeters.y));
        Assert.That(roundTrip.state.positionMeters.z, Is.EqualTo(state.positionMeters.z));
        Assert.That(roundTrip.state.velocityMetersPerSecond.x, Is.EqualTo(state.velocityMetersPerSecond.x));
        Assert.That(roundTrip.state.velocityMetersPerSecond.y, Is.EqualTo(state.velocityMetersPerSecond.y));
        Assert.That(roundTrip.state.velocityMetersPerSecond.z, Is.EqualTo(state.velocityMetersPerSecond.z));
        Assert.That(roundTrip.state.epochSeconds, Is.EqualTo(state.epochSeconds));
    }

    private static CelestialBodyCatalog LoadStarterCatalog()
    {
        CelestialBodyCatalog catalog = Resources.Load<CelestialBodyCatalog>(CelestialBodyCatalog.ResourcePath);
        if (catalog == null)
        {
            catalog = AssetDatabase.LoadAssetAtPath<CelestialBodyCatalog>(CelestialBodyCatalog.AssetPath);
        }

        Assert.NotNull(catalog, $"Expected catalog asset at {CelestialBodyCatalog.AssetPath}");
        return catalog;
    }

    private static int FindBodyLineIndex(string summary, string bodyId)
    {
        return summary.IndexOf("\n" + bodyId + " |", StringComparison.Ordinal);
    }

    private static string DescribeIssues(CelestialCatalogValidationResult validation)
    {
        if (validation == null || validation.Issues.Count == 0)
        {
            return string.Empty;
        }

        return string.Join("; ", validation.Issues.Select(issue => $"{issue.Code}:{issue.BodyId}:{issue.Message}"));
    }

    [Serializable]
    private sealed class AbsoluteStateSerializationWrapper
    {
        public AbsoluteState state;
    }
}
#endif
