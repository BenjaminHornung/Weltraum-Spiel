using UnityEngine;

[CreateAssetMenu(fileName = "PrototypeShipConfig", menuName = "Prototype/Ship Config")]
public class PrototypeShipConfig : ScriptableObject
{
    [SerializeField] private PrototypeShipMassSettings masses = PrototypeShipMassSettings.Default;
    [SerializeField] private PrototypeShipFuelSettings fuel = PrototypeShipFuelSettings.Default;
    [SerializeField] private PrototypeMainThrusterSettings mainThruster = PrototypeMainThrusterSettings.Default;
    [SerializeField] private PrototypeRcsSettings rcs = PrototypeRcsSettings.Default;
    [SerializeField] private PrototypeGunSettings gun = PrototypeGunSettings.Default;
    [SerializeField] private PrototypeCameraSettings camera = PrototypeCameraSettings.Default;

    public PrototypeShipMassSettings Masses => masses;
    public PrototypeShipFuelSettings Fuel => fuel;
    public PrototypeMainThrusterSettings MainThruster => mainThruster;
    public PrototypeRcsSettings Rcs => rcs;
    public PrototypeGunSettings Gun => gun;
    public PrototypeCameraSettings Camera => camera;

    private void OnValidate()
    {
        masses.Clamp();
        fuel.Clamp();
        mainThruster.Clamp();
        rcs.Clamp();
        gun.Clamp();
        camera.Clamp();
    }
}

[System.Serializable]
public struct PrototypeShipMassSettings
{
    public float cockpitMass;
    public float hullMass;
    public float fuelTankDryMass;
    public float engineMass;
    public float gunMass;

    public static PrototypeShipMassSettings Default => new PrototypeShipMassSettings
    {
        cockpitMass = 800f,
        hullMass = 1000f,
        fuelTankDryMass = 400f,
        engineMass = 700f,
        gunMass = 250f
    };

    public void Clamp()
    {
        cockpitMass = Mathf.Max(0f, cockpitMass);
        hullMass = Mathf.Max(0f, hullMass);
        fuelTankDryMass = Mathf.Max(0f, fuelTankDryMass);
        engineMass = Mathf.Max(0f, engineMass);
        gunMass = Mathf.Max(0f, gunMass);
    }
}

[System.Serializable]
public struct PrototypeShipFuelSettings
{
    public float maxFuelKg;
    public float currentFuelKg;
    public float fullThrottleFuelKgPerSecond;

    public static PrototypeShipFuelSettings Default => new PrototypeShipFuelSettings
    {
        maxFuelKg = 300f,
        currentFuelKg = 300f,
        fullThrottleFuelKgPerSecond = 0.6f
    };

    public void Clamp()
    {
        maxFuelKg = Mathf.Max(0.01f, maxFuelKg);
        currentFuelKg = Mathf.Clamp(currentFuelKg, 0f, maxFuelKg);
        fullThrottleFuelKgPerSecond = Mathf.Max(0f, fullThrottleFuelKgPerSecond);
    }
}

[System.Serializable]
public struct PrototypeMainThrusterSettings
{
    public float thrustForce;
    [Range(0f, 1f)] public float reverseThrustMultiplier;
    [Range(0f, 1f)] public float throttleScale;
    public bool supportsGimbal;
    [Range(0f, 45f)] public float gimbalLimitDegrees;
    [Range(0f, 1f)] public float gimbalResponseScalar;

    public static PrototypeMainThrusterSettings Default => new PrototypeMainThrusterSettings
    {
        thrustForce = 45000f,
        reverseThrustMultiplier = 0.35f,
        throttleScale = 1f,
        supportsGimbal = true,
        gimbalLimitDegrees = 20f,
        gimbalResponseScalar = 0.35f
    };

    public void Clamp()
    {
        thrustForce = Mathf.Max(0f, thrustForce);
        reverseThrustMultiplier = Mathf.Clamp01(reverseThrustMultiplier);
        throttleScale = Mathf.Clamp01(throttleScale);
        gimbalLimitDegrees = Mathf.Max(0f, gimbalLimitDegrees);
        gimbalResponseScalar = Mathf.Clamp01(gimbalResponseScalar);
    }
}

[System.Serializable]
public struct PrototypeRcsSettings
{
    public float blockThrust;
    public float translationForce;
    public float attitudeForce;
    public float sasAuthority;
    [Range(0f, 0.95f)] public float minSelectionDot;

    public static PrototypeRcsSettings Default => new PrototypeRcsSettings
    {
        blockThrust = 6500f,
        translationForce = 9000f,
        attitudeForce = 6500f,
        sasAuthority = 1.8f,
        minSelectionDot = 0.25f
    };

    public void Clamp()
    {
        blockThrust = Mathf.Max(0f, blockThrust);
        translationForce = Mathf.Max(0f, translationForce);
        attitudeForce = Mathf.Max(0f, attitudeForce);
        sasAuthority = Mathf.Max(0f, sasAuthority);
        minSelectionDot = Mathf.Clamp(minSelectionDot, 0f, 0.95f);
    }
}

[System.Serializable]
public struct PrototypeGunSettings
{
    public float projectileSpeed;
    [Range(0.1f, 20f)] public float projectileFireRate;
    public float projectileLifetime;
    public float projectileScale;
    public float projectileMass;
    public bool recoilEnabled;

    public static PrototypeGunSettings Default => new PrototypeGunSettings
    {
        projectileSpeed = 1500f,
        projectileFireRate = 4f,
        projectileLifetime = 3f,
        projectileScale = 0.24f,
        projectileMass = 0.12f,
        recoilEnabled = true
    };

    public void Clamp()
    {
        projectileSpeed = Mathf.Max(0f, projectileSpeed);
        projectileFireRate = Mathf.Max(0.1f, projectileFireRate);
        projectileLifetime = Mathf.Max(0.1f, projectileLifetime);
        projectileScale = Mathf.Max(0.01f, projectileScale);
        projectileMass = Mathf.Max(0.001f, projectileMass);
    }
}

[System.Serializable]
public struct PrototypeCameraSettings
{
    [Range(10f, 25f)] public float followDistance;
    [Range(3f, 10f)] public float followHeight;

    public static PrototypeCameraSettings Default => new PrototypeCameraSettings
    {
        followDistance = 18f,
        followHeight = 6f
    };

    public void Clamp()
    {
        followDistance = Mathf.Clamp(followDistance, 10f, 25f);
        followHeight = Mathf.Clamp(followHeight, 3f, 10f);
    }
}
