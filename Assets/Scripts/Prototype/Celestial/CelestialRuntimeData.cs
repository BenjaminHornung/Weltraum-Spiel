using System;

[Serializable]
public struct AbsoluteState
{
    public string referenceFrameId;
    public LargeWorldVector3d positionMeters;
    public LargeWorldVector3d velocityMetersPerSecond;
    public double epochSeconds;

    public AbsoluteState(
        string referenceFrameId,
        LargeWorldVector3d positionMeters,
        LargeWorldVector3d velocityMetersPerSecond,
        double epochSeconds)
    {
        this.referenceFrameId = referenceFrameId;
        this.positionMeters = positionMeters;
        this.velocityMetersPerSecond = velocityMetersPerSecond;
        this.epochSeconds = epochSeconds;
    }
}

[Serializable]
public struct OrbitDefinition
{
    public string parentBodyId;
    public double semiMajorAxisMeters;
    public double eccentricity;
    public double inclinationDegrees;
    public double longitudeOfAscendingNodeDegrees;
    public double argumentOfPeriapsisDegrees;
    public double meanAnomalyAtEpochDegrees;
    public double epochSeconds;
    public bool isAnalytical;
}

[Serializable]
public struct GravityDefinition
{
    public double mu;
    public double surfaceGravityMetersPerSecondSquared;
    public double escapeVelocityMetersPerSecond;
    public double sphereOfInfluenceMeters;
    public bool canBeDominantGravitySource;
}

[Serializable]
public struct VisualScaleProfile
{
    public double mapRadiusScale;
    public double localSpaceRadiusScale;
    public double impostorRadiusScale;
    public bool exaggerateInSystemMap;
    public string materialProfileId;
    public string iconId;
}

[Serializable]
public class CelestialBodyDefinition
{
    public string id;
    public string displayName;
    public CelestialBodyType bodyType;
    public string parentBodyId;
    public double radiusMeters;
    public double massKg;
    public double gravitationalParameterMu;
    public double meanDensityKgPerM3;
    public bool hasOrbit;
    public OrbitDefinition orbit;
    public GravityDefinition gravity;
    public VisualScaleProfile visualScale;

    public double EffectiveMu => gravitationalParameterMu > 0d ? gravitationalParameterMu : gravity.mu;

    public CelestialBodyDefinition Clone()
    {
        return new CelestialBodyDefinition
        {
            id = id,
            displayName = displayName,
            bodyType = bodyType,
            parentBodyId = parentBodyId,
            radiusMeters = radiusMeters,
            massKg = massKg,
            gravitationalParameterMu = gravitationalParameterMu,
            meanDensityKgPerM3 = meanDensityKgPerM3,
            hasOrbit = hasOrbit,
            orbit = orbit,
            gravity = gravity,
            visualScale = visualScale
        };
    }
}
