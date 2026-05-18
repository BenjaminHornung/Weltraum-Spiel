using UnityEngine;

public class ShipStats : MonoBehaviour
{
    [Header("Module Masses (kg)")]
    [SerializeField] private float cockpitMass = 800f;
    [SerializeField] private float hullMass = 1000f;
    [SerializeField] private float fuelTankDryMass = 400f;
    [SerializeField] private float engineMass = 700f;
    [SerializeField] private float gunMass = 250f;

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

    [Header("Camera")]
    [Range(10f, 15f)]
    [SerializeField] private float followDistance = 12f;
    [Range(3f, 5f)]
    [SerializeField] private float followHeight = 4f;

    public float DryMass => Mathf.Max(0.1f, cockpitMass + hullMass + fuelTankDryMass + engineMass + gunMass);
    public float MaxFuelKg => Mathf.Max(0.01f, maxFuelKg);
    public float CurrentFuelKg => Mathf.Clamp(currentFuelKg, 0f, MaxFuelKg);
    public float CurrentMass => DryMass + CurrentFuelKg;
    public float Thrust => Mathf.Max(0f, thrustForce);
    public float ReverseThrustMultiplier => Mathf.Clamp01(reverseThrustMultiplier);
    public float FuelConsumptionKgPerSecond => Mathf.Max(0f, fullThrottleFuelKgPerSecond);
    public float ProjectileSpeed => Mathf.Max(0f, projectileSpeed);
    public float ProjectileFireRate => Mathf.Max(0.1f, projectileFireRate);
    public float ProjectileLifetime => Mathf.Max(0.1f, projectileLifetime);
    public float FollowDistance => Mathf.Clamp(followDistance, 10f, 15f);
    public float FollowHeight => Mathf.Clamp(followHeight, 3f, 5f);

    public float LastThrottle { get; private set; }
    public float LastAppliedThrust { get; private set; }
    public float LastAcceleration { get; private set; }

    public bool HasFuel => CurrentFuelKg > 0f;

    public float ConsumeFuelForThrust(float normalizedThrottle, float deltaTime)
    {
        float fuelUse = FuelConsumptionKgPerSecond * Mathf.Clamp01(normalizedThrottle) * Mathf.Max(0f, deltaTime);
        if (fuelUse <= 0f || CurrentFuelKg <= 0f)
        {
            return 0f;
        }

        float previousFuel = CurrentFuelKg;
        currentFuelKg = Mathf.Max(0f, previousFuel - fuelUse);
        return previousFuel - currentFuelKg;
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

    private void OnValidate()
    {
        cockpitMass = Mathf.Max(0f, cockpitMass);
        hullMass = Mathf.Max(0f, hullMass);
        fuelTankDryMass = Mathf.Max(0f, fuelTankDryMass);
        engineMass = Mathf.Max(0f, engineMass);
        gunMass = Mathf.Max(0f, gunMass);
        maxFuelKg = Mathf.Max(0.01f, maxFuelKg);
        currentFuelKg = Mathf.Clamp(currentFuelKg, 0f, maxFuelKg);
        fullThrottleFuelKgPerSecond = Mathf.Max(0f, fullThrottleFuelKgPerSecond);
        thrustForce = Mathf.Max(0f, thrustForce);
        projectileLifetime = Mathf.Max(0.1f, projectileLifetime);
    }
}

