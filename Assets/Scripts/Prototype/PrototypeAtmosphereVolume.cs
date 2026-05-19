using UnityEngine;

[System.Serializable]
public struct ShipAtmosphereSample
{
    public bool active;
    public float densityKgPerCubicMeter;
    public float dragCoefficient;
    public float referenceAreaSquareMeters;
    public Vector3 relativeVelocity;
    public Vector3 dragForce;
    public Vector3 liftForce;
    public Vector3 heatingForce;

    public ShipAtmosphereSample(
        bool active,
        float densityKgPerCubicMeter,
        float dragCoefficient,
        float referenceAreaSquareMeters,
        Vector3 relativeVelocity,
        Vector3 dragForce,
        Vector3 liftForce,
        Vector3 heatingForce)
    {
        this.active = active;
        this.densityKgPerCubicMeter = densityKgPerCubicMeter;
        this.dragCoefficient = dragCoefficient;
        this.referenceAreaSquareMeters = referenceAreaSquareMeters;
        this.relativeVelocity = relativeVelocity;
        this.dragForce = dragForce;
        this.liftForce = liftForce;
        this.heatingForce = heatingForce;
    }

    public static ShipAtmosphereSample Zero => new ShipAtmosphereSample(
        false,
        0f,
        0f,
        0f,
        Vector3.zero,
        Vector3.zero,
        Vector3.zero,
        Vector3.zero);
}

public class PrototypeAtmosphereVolume : MonoBehaviour
{
    private const float MinimumVelocitySqr = 0.000001f;

    [Header("Atmosphere")]
    [SerializeField] private bool simulationEnabled;
    [SerializeField] private float densityKgPerCubicMeter;
    [SerializeField] private Vector3 windVelocity;

    [Header("Drag")]
    [SerializeField] private float dragCoefficient = 0.8f;
    [SerializeField] private float referenceAreaSquareMeters = 6f;

    [Header("Volume")]
    [SerializeField] private bool useSphericalVolume = true;
    [SerializeField] private float radiusMeters = 100f;

    public bool SimulationEnabled => simulationEnabled;
    public float DensityKgPerCubicMeter => Mathf.Max(0f, densityKgPerCubicMeter);
    public float DragCoefficient => Mathf.Max(0f, dragCoefficient);
    public float ReferenceAreaSquareMeters => Mathf.Max(0f, referenceAreaSquareMeters);
    public Vector3 WindVelocity => windVelocity;
    public bool UseSphericalVolume => useSphericalVolume;
    public float RadiusMeters => Mathf.Max(0f, radiusMeters);
    public bool IsActiveAtmosphere => simulationEnabled && DensityKgPerCubicMeter > 0f;

    public void Configure(
        bool enabled,
        float density,
        float configuredDragCoefficient,
        float configuredReferenceArea,
        float configuredRadiusMeters)
    {
        simulationEnabled = enabled;
        densityKgPerCubicMeter = density;
        dragCoefficient = configuredDragCoefficient;
        referenceAreaSquareMeters = configuredReferenceArea;
        radiusMeters = configuredRadiusMeters;
        ClampValues();
    }

    public bool ContainsWorldPosition(Vector3 worldPosition)
    {
        if (!useSphericalVolume)
        {
            return true;
        }

        float radius = RadiusMeters;
        if (radius <= 0f)
        {
            return false;
        }

        return (worldPosition - transform.position).sqrMagnitude <= radius * radius;
    }

    public bool TrySample(Vector3 worldPosition, Vector3 bodyVelocity, out ShipAtmosphereSample sample)
    {
        sample = ShipAtmosphereSample.Zero;
        if (!IsActiveAtmosphere || !ContainsWorldPosition(worldPosition))
        {
            return false;
        }

        Vector3 relativeVelocity = bodyVelocity - windVelocity;
        Vector3 dragForce = CalculateDragForce(
            relativeVelocity,
            DensityKgPerCubicMeter,
            DragCoefficient,
            ReferenceAreaSquareMeters);

        sample = new ShipAtmosphereSample(
            true,
            DensityKgPerCubicMeter,
            DragCoefficient,
            ReferenceAreaSquareMeters,
            relativeVelocity,
            dragForce,
            Vector3.zero,
            Vector3.zero);
        return true;
    }

    public static Vector3 CalculateDragForce(
        Vector3 relativeVelocity,
        float densityKgPerCubicMeter,
        float dragCoefficient,
        float referenceAreaSquareMeters)
    {
        float speedSquared = relativeVelocity.sqrMagnitude;
        float density = Mathf.Max(0f, densityKgPerCubicMeter);
        float coefficient = Mathf.Max(0f, dragCoefficient);
        float area = Mathf.Max(0f, referenceAreaSquareMeters);
        if (speedSquared <= MinimumVelocitySqr || density <= 0f || coefficient <= 0f || area <= 0f)
        {
            return Vector3.zero;
        }

        float magnitude = 0.5f * density * speedSquared * coefficient * area;
        return -relativeVelocity.normalized * magnitude;
    }

    private void OnValidate()
    {
        ClampValues();
    }

    private void ClampValues()
    {
        densityKgPerCubicMeter = Mathf.Max(0f, densityKgPerCubicMeter);
        dragCoefficient = Mathf.Max(0f, dragCoefficient);
        referenceAreaSquareMeters = Mathf.Max(0f, referenceAreaSquareMeters);
        radiusMeters = Mathf.Max(0f, radiusMeters);
    }
}
