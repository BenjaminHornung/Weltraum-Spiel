using UnityEngine;

public class ShipStats : MonoBehaviour
{
    [Header("Module Masses (kg)")]
    [SerializeField] private float cockpitMass = 800f;
    [SerializeField] private float hullMass = 1000f;
    [SerializeField] private float fuelTankDryMass = 400f;
    [SerializeField] private float engineMass = 700f;
    [SerializeField] private float gunMass = 250f;
    [SerializeField] private float rcsBlockMass = 80f;

    [Header("Fuel (kg)")]
    [SerializeField] private float maxFuelKg = 300f;
    [SerializeField] private float currentFuelKg = 300f;
    [SerializeField] private float fullThrottleFuelKgPerSecond = 0.6f;

    [Header("Thrust")]
    [SerializeField] private float thrustForce = 45000f;
    [SerializeField] private float reverseThrustMultiplier = 0.35f;

    [Header("Projectiles")]
    [SerializeField] private float projectileSpeed = 1500f;
    [Range(0.1f, 20f)]
    [SerializeField] private float projectileFireRate = 4f;
    [SerializeField] private float projectileLifetime = 3f;
    [SerializeField] private float projectileMass = 0.12f;
    [SerializeField] private bool projectileRecoilEnabled = true;

    [Header("Camera")]
    [Range(10f, 25f)]
    [SerializeField] private float followDistance = 18f;
    [Range(3f, 10f)]
    [SerializeField] private float followHeight = 6f;

    private ShipMassProperties lastMassProperties;
    private bool hasMassProperties;

    public float CockpitMass => Mathf.Max(0f, cockpitMass);
    public float HullMass => Mathf.Max(0f, hullMass);
    public float FuelTankDryMass => Mathf.Max(0f, fuelTankDryMass);
    public float EngineMass => Mathf.Max(0f, engineMass);
    public float GunMass => Mathf.Max(0f, gunMass);
    public float RcsBlockMass => Mathf.Max(0f, rcsBlockMass);

    public float DryMass => Mathf.Max(0.1f, CockpitMass + HullMass + FuelTankDryMass + EngineMass + GunMass + (RcsBlockMass * 4f));
    public float MaxFuelKg => Mathf.Max(0.01f, maxFuelKg);
    public float CurrentFuelKg => Mathf.Clamp(currentFuelKg, 0f, MaxFuelKg);
    public float CurrentMass => hasMassProperties && lastMassProperties.HasDescriptors ? lastMassProperties.TotalMassKg : DryMass + CurrentFuelKg;
    public ShipMassProperties LastMassProperties => hasMassProperties ? lastMassProperties : ShipMassProperties.Fallback(DryMass + CurrentFuelKg);
    public float Thrust => Mathf.Max(0f, thrustForce);
    public float ReverseThrustMultiplier => Mathf.Clamp01(reverseThrustMultiplier);
    public float FuelConsumptionKgPerSecond => Mathf.Max(0f, fullThrottleFuelKgPerSecond);
    public float ProjectileSpeed => Mathf.Max(0f, projectileSpeed);
    public float ProjectileFireRate => Mathf.Max(0.1f, projectileFireRate);
    public float ProjectileLifetime => Mathf.Max(0.1f, projectileLifetime);
    public float ProjectileMass => Mathf.Max(0.001f, projectileMass);
    public bool ProjectileRecoilEnabled => projectileRecoilEnabled;
    public float FollowDistance => Mathf.Clamp(followDistance, 10f, 25f);
    public float FollowHeight => Mathf.Clamp(followHeight, 3f, 10f);

    public float LastThrottle { get; private set; }
    public float LastAppliedThrust { get; private set; }
    public float LastAcceleration { get; private set; }
    public float LastFuelRequestedKg { get; private set; }
    public float LastFuelConsumedKg { get; private set; }
    public float LastAppliedFuelFraction { get; private set; } = 1f;

    public bool HasFuel => CurrentFuelKg > 0f;

    public void ResetFuelFlowTelemetry()
    {
        LastFuelRequestedKg = 0f;
        LastFuelConsumedKg = 0f;
        LastAppliedFuelFraction = 1f;
    }

    public float ConsumeFuelForThrust(float normalizedThrottle, float deltaTime)
    {
        float appliedFuelFraction;
        return ConsumeFuelForThrust(normalizedThrottle, deltaTime, out appliedFuelFraction);
    }

    public float ConsumeFuelForThrust(float normalizedThrottle, float deltaTime, out float appliedFuelFraction)
    {
        float fuelUse = FuelConsumptionKgPerSecond * Mathf.Clamp01(normalizedThrottle) * Mathf.Max(0f, deltaTime);
        LastFuelRequestedKg = fuelUse;
        if (fuelUse <= 0f)
        {
            appliedFuelFraction = 1f;
            LastFuelConsumedKg = 0f;
            LastAppliedFuelFraction = appliedFuelFraction;
            return 0f;
        }

        float previousFuel = CurrentFuelKg;
        if (previousFuel <= 0f)
        {
            appliedFuelFraction = 0f;
            LastFuelConsumedKg = 0f;
            LastAppliedFuelFraction = appliedFuelFraction;
            return 0f;
        }

        appliedFuelFraction = Mathf.Clamp01(previousFuel / fuelUse);
        float consumedFuel = Mathf.Min(previousFuel, fuelUse);
        currentFuelKg = previousFuel - consumedFuel;
        LastFuelConsumedKg = consumedFuel;
        LastAppliedFuelFraction = appliedFuelFraction;
        return consumedFuel;
    }

    public void RecordFlightTelemetry(float throttle, float appliedThrust, float acceleration)
    {
        LastThrottle = Mathf.Clamp01(throttle);
        LastAppliedThrust = Mathf.Max(0f, appliedThrust);
        LastAcceleration = acceleration;
    }

    public void RefillFuelFull()
    {
        currentFuelKg = MaxFuelKg;
    }

    public ShipMassProperties RecalculateMassProperties()
    {
        ModuleMassDescriptor[] descriptors = GetComponentsInChildren<ModuleMassDescriptor>(false);
        lastMassProperties = ShipMassProperties.Calculate(transform, descriptors, CurrentFuelKg, DryMass + CurrentFuelKg);
        hasMassProperties = true;
        return lastMassProperties;
    }

    public ShipMassProperties ApplyMassProperties(Rigidbody body)
    {
        ShipMassProperties properties = RecalculateMassProperties();
        if (body == null)
        {
            return properties;
        }

        body.mass = properties.TotalMassKg;

        if (properties.HasDescriptors)
        {
            body.automaticCenterOfMass = false;
            body.centerOfMass = properties.LocalCenterOfMass;
            body.automaticInertiaTensor = false;
            body.inertiaTensorRotation = Quaternion.identity;
            body.inertiaTensor = properties.InertiaTensor;
        }

        return properties;
    }

    private void OnValidate()
    {
        cockpitMass = Mathf.Max(0f, cockpitMass);
        hullMass = Mathf.Max(0f, hullMass);
        fuelTankDryMass = Mathf.Max(0f, fuelTankDryMass);
        engineMass = Mathf.Max(0f, engineMass);
        gunMass = Mathf.Max(0f, gunMass);
        rcsBlockMass = Mathf.Max(0f, rcsBlockMass);
        maxFuelKg = Mathf.Max(0.01f, maxFuelKg);
        currentFuelKg = Mathf.Clamp(currentFuelKg, 0f, maxFuelKg);
        fullThrottleFuelKgPerSecond = Mathf.Max(0f, fullThrottleFuelKgPerSecond);
        thrustForce = Mathf.Max(0f, thrustForce);
        projectileLifetime = Mathf.Max(0.1f, projectileLifetime);
        projectileMass = Mathf.Max(0.001f, projectileMass);
    }


public void ApplyConfig(PrototypeShipConfig config)
    {
        if (config == null)
        {
            return;
        }

        PrototypeShipMassSettings massSettings = config.Masses;
        massSettings.Clamp();
        cockpitMass = massSettings.cockpitMass;
        hullMass = massSettings.hullMass;
        fuelTankDryMass = massSettings.fuelTankDryMass;
        engineMass = massSettings.engineMass;
        gunMass = massSettings.gunMass;
        rcsBlockMass = massSettings.rcsBlockMass;

        PrototypeShipFuelSettings fuelSettings = config.Fuel;
        fuelSettings.Clamp();
        maxFuelKg = fuelSettings.maxFuelKg;
        currentFuelKg = fuelSettings.currentFuelKg;
        fullThrottleFuelKgPerSecond = fuelSettings.fullThrottleFuelKgPerSecond;

        PrototypeMainThrusterSettings thrusterSettings = config.MainThruster;
        thrusterSettings.Clamp();
        thrustForce = thrusterSettings.thrustForce;
        reverseThrustMultiplier = thrusterSettings.reverseThrustMultiplier;

        PrototypeGunSettings gunSettings = config.Gun;
        gunSettings.Clamp();
        projectileSpeed = gunSettings.projectileSpeed;
        projectileFireRate = gunSettings.projectileFireRate;
        projectileLifetime = gunSettings.projectileLifetime;
        projectileMass = gunSettings.projectileMass;
        projectileRecoilEnabled = gunSettings.recoilEnabled;

        PrototypeCameraSettings cameraSettings = config.Camera;
        cameraSettings.Clamp();
        followDistance = cameraSettings.followDistance;
        followHeight = cameraSettings.followHeight;
    }
}
