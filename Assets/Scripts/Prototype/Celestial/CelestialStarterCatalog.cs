using System;
using System.Collections.Generic;

public static class CelestialStarterCatalog
{
    public const double AstronomicalUnitMeters = 149597870700d;
    public const double EarthMassKg = 5.972e24d;
    public const double SolarMassKg = 1.98847e30d;
    public const double LunarMassKg = 7.342e22d;
    public const double SolarRadiusMeters = 695700000d;

    public static List<CelestialBodyDefinition> CreateDefinitions()
    {
        const double aureliaMass = 0.78d * SolarMassKg;
        const double aureliaMu = 1.035e20d;
        const double hestiaMass = 2.03d * EarthMassKg;
        const double hestiaMu = 8.09e14d;
        const double lumaMass = 0.049d * LunarMassKg;
        double lumaMu = CelestialBodyCatalogValidator.GravitationalConstant * lumaMass;
        const double eberMass = 5.0e20d;
        double eberMu = CelestialBodyCatalogValidator.GravitationalConstant * eberMass;

        var definitions = new List<CelestialBodyDefinition>
        {
            CreateBody(
                "star.aurelia",
                "Aurelia",
                CelestialBodyType.Star,
                string.Empty,
                0.75d * SolarRadiusMeters,
                aureliaMass,
                aureliaMu,
                false,
                default,
                CreateVisualScale(48d, 1800d, 24d, true, "star.aurelia.warm-orange", "star")),
            CreateBody(
                "planet.hestia",
                "Hestia",
                CelestialBodyType.SuperEarth,
                "star.aurelia",
                8282000d,
                hestiaMass,
                hestiaMu,
                true,
                CreateOrbit("star.aurelia", 0.60d * AstronomicalUnitMeters, 0d, 0d, 0d),
                CreateVisualScale(12d, 820d, 8d, true, "planet.hestia.bluegreen", "planet")),
            CreateBody(
                "moon.hestia.luma",
                "Luma",
                CelestialBodyType.Moon,
                "planet.hestia",
                650000d,
                lumaMass,
                lumaMu,
                true,
                CreateOrbit("planet.hestia", 100000000d, 0d, 0d, 0d),
                CreateVisualScale(4d, 180d, 3d, true, "moon.luma.pale", "moon")),
            CreateBody(
                "asteroid.eber",
                "Eber",
                CelestialBodyType.Asteroid,
                "star.aurelia",
                390000d,
                eberMass,
                eberMu,
                true,
                CreateOrbit("star.aurelia", 1.32d * AstronomicalUnitMeters, 0.04d, 2.5d, 0d),
                CreateVisualScale(3d, 120d, 2d, true, "asteroid.eber.stone", "asteroid"))
        };

        ApplyGravity(definitions);
        return definitions;
    }

    private static CelestialBodyDefinition CreateBody(
        string id,
        string displayName,
        CelestialBodyType bodyType,
        string parentBodyId,
        double radiusMeters,
        double massKg,
        double mu,
        bool hasOrbit,
        OrbitDefinition orbit,
        VisualScaleProfile visualScale)
    {
        return new CelestialBodyDefinition
        {
            id = id,
            displayName = displayName,
            bodyType = bodyType,
            parentBodyId = parentBodyId,
            radiusMeters = radiusMeters,
            massKg = massKg,
            gravitationalParameterMu = mu,
            meanDensityKgPerM3 = CalculateMeanDensity(massKg, radiusMeters),
            hasOrbit = hasOrbit,
            orbit = orbit,
            visualScale = visualScale
        };
    }

    private static OrbitDefinition CreateOrbit(
        string parentBodyId,
        double semiMajorAxisMeters,
        double eccentricity,
        double inclinationDegrees,
        double epochSeconds)
    {
        return new OrbitDefinition
        {
            parentBodyId = parentBodyId,
            semiMajorAxisMeters = semiMajorAxisMeters,
            eccentricity = eccentricity,
            inclinationDegrees = inclinationDegrees,
            longitudeOfAscendingNodeDegrees = 0d,
            argumentOfPeriapsisDegrees = 0d,
            meanAnomalyAtEpochDegrees = 0d,
            epochSeconds = epochSeconds,
            isAnalytical = true
        };
    }

    private static VisualScaleProfile CreateVisualScale(
        double mapRadiusScale,
        double localSpaceRadiusScale,
        double impostorRadiusScale,
        bool exaggerateInSystemMap,
        string materialProfileId,
        string iconId)
    {
        return new VisualScaleProfile
        {
            mapRadiusScale = mapRadiusScale,
            localSpaceRadiusScale = localSpaceRadiusScale,
            impostorRadiusScale = impostorRadiusScale,
            exaggerateInSystemMap = exaggerateInSystemMap,
            materialProfileId = materialProfileId,
            iconId = iconId
        };
    }

    private static void ApplyGravity(List<CelestialBodyDefinition> definitions)
    {
        var massesById = new Dictionary<string, double>(StringComparer.Ordinal);
        for (int i = 0; i < definitions.Count; i++)
        {
            massesById[definitions[i].id] = definitions[i].massKg;
        }

        for (int i = 0; i < definitions.Count; i++)
        {
            CelestialBodyDefinition body = definitions[i];
            body.gravity = new GravityDefinition
            {
                mu = body.gravitationalParameterMu,
                surfaceGravityMetersPerSecondSquared = body.gravitationalParameterMu / (body.radiusMeters * body.radiusMeters),
                escapeVelocityMetersPerSecond = Math.Sqrt(2d * body.gravitationalParameterMu / body.radiusMeters),
                sphereOfInfluenceMeters = EstimateSphereOfInfluence(body, massesById),
                canBeDominantGravitySource = body.bodyType != CelestialBodyType.Asteroid || body.massKg >= 1.0e20d
            };
        }
    }

    private static double EstimateSphereOfInfluence(CelestialBodyDefinition body, Dictionary<string, double> massesById)
    {
        if (!body.hasOrbit || string.IsNullOrWhiteSpace(body.parentBodyId) || body.massKg <= 0d)
        {
            return 0d;
        }

        double parentMass;
        if (!massesById.TryGetValue(body.parentBodyId, out parentMass) || parentMass <= 0d)
        {
            return 0d;
        }

        return body.orbit.semiMajorAxisMeters * Math.Pow(body.massKg / parentMass, 0.4d);
    }

    private static double CalculateMeanDensity(double massKg, double radiusMeters)
    {
        if (massKg <= 0d || radiusMeters <= 0d)
        {
            return 0d;
        }

        double volume = (4d / 3d) * Math.PI * radiusMeters * radiusMeters * radiusMeters;
        return massKg / volume;
    }
}
