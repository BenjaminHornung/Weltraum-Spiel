using UnityEngine;

public class PrototypeThermalModule : MonoBehaviour
{
    public enum OverheatEffect
    {
        FlagOnly,
        ThrottleToHalf,
        DisableModule
    }

    [Header("Module")]
    [SerializeField] private string moduleName = "Module";
    [SerializeField] private bool simulationEnabled;

    [Header("Power and Heat")]
    [SerializeField] private float powerDrawKw;
    [SerializeField] private float heatGenerationPerSecond;
    [SerializeField] private float heatCapacity = 100f;
    [SerializeField] private float coolingRate = 1f;
    [SerializeField] private float ambientTemperature = 20f;
    [SerializeField] private float currentTemperature = 20f;
    [SerializeField] private float maxTemperature = 120f;

    [Header("Overheat Hook")]
    [SerializeField] private bool overheatEffectEnabled;
    [SerializeField] private OverheatEffect overheatEffect = OverheatEffect.FlagOnly;

    public string ModuleName => string.IsNullOrWhiteSpace(moduleName) ? name : moduleName;
    public bool SimulationEnabled => simulationEnabled;
    public float PowerDrawKw => Mathf.Max(0f, powerDrawKw);
    public float HeatGenerationPerSecond => Mathf.Max(0f, heatGenerationPerSecond);
    public float HeatCapacity => Mathf.Max(0.0001f, heatCapacity);
    public float CoolingRate => Mathf.Max(0f, coolingRate);
    public float AmbientTemperature => ambientTemperature;
    public float CurrentTemperature => currentTemperature;
    public float MaxTemperature => Mathf.Max(ambientTemperature, maxTemperature);
    public bool IsOverheated { get; private set; }
    public bool OverheatActivatedThisStep { get; private set; }
    public float LastActivityFraction { get; private set; }
    public float LastPowerDrawKw { get; private set; }
    public float LastHeatGeneratedPerSecond { get; private set; }
    public float LastCoolingApplied { get; private set; }
    public float LastTemperatureDelta { get; private set; }
    public OverheatEffect ActiveOverheatEffect => overheatEffect;
    public bool OverheatEffectEnabled => overheatEffectEnabled;
    public bool ShouldDisableModule => simulationEnabled
        && overheatEffectEnabled
        && IsOverheated
        && overheatEffect == OverheatEffect.DisableModule;
    public float EfficiencyScalar
    {
        get
        {
            if (!simulationEnabled || !overheatEffectEnabled || !IsOverheated)
            {
                return 1f;
            }

            return overheatEffect == OverheatEffect.DisableModule ? 0f
                : overheatEffect == OverheatEffect.ThrottleToHalf ? 0.5f
                : 1f;
        }
    }

    public string StateLabel => !simulationEnabled ? "off" : IsOverheated ? "overheat" : "nominal";

    private void Awake()
    {
        ClampValues();
        UpdateOverheatState();
    }

    public void Advance(float activityFraction, float deltaTime)
    {
        OverheatActivatedThisStep = false;
        LastActivityFraction = Mathf.Clamp01(activityFraction);
        LastPowerDrawKw = 0f;
        LastHeatGeneratedPerSecond = 0f;
        LastCoolingApplied = 0f;
        LastTemperatureDelta = 0f;

        if (!simulationEnabled)
        {
            return;
        }

        float previousTemperature = currentTemperature;
        float stepTime = Mathf.Max(0f, deltaTime);
        LastPowerDrawKw = PowerDrawKw * LastActivityFraction;
        LastHeatGeneratedPerSecond = HeatGenerationPerSecond * LastActivityFraction;

        if (stepTime > 0f)
        {
            currentTemperature += (LastHeatGeneratedPerSecond / HeatCapacity) * stepTime;

            if (currentTemperature > ambientTemperature && CoolingRate > 0f)
            {
                float cooling = Mathf.Min(currentTemperature - ambientTemperature, CoolingRate * stepTime);
                currentTemperature -= cooling;
                LastCoolingApplied = cooling;
            }
        }

        currentTemperature = Mathf.Max(ambientTemperature, currentTemperature);
        LastTemperatureDelta = currentTemperature - previousTemperature;
        UpdateOverheatState();
    }

    public void Configure(
        string configuredModuleName,
        bool enabled,
        float configuredPowerDrawKw,
        float configuredHeatGenerationPerSecond,
        float configuredHeatCapacity,
        float configuredCoolingRate,
        float configuredMaxTemperature,
        float configuredAmbientTemperature,
        bool configuredOverheatEffectEnabled,
        OverheatEffect configuredOverheatEffect)
    {
        moduleName = configuredModuleName;
        simulationEnabled = enabled;
        powerDrawKw = configuredPowerDrawKw;
        heatGenerationPerSecond = configuredHeatGenerationPerSecond;
        heatCapacity = configuredHeatCapacity;
        coolingRate = configuredCoolingRate;
        ambientTemperature = configuredAmbientTemperature;
        maxTemperature = configuredMaxTemperature;
        currentTemperature = Mathf.Max(ambientTemperature, currentTemperature);
        overheatEffectEnabled = configuredOverheatEffectEnabled;
        overheatEffect = configuredOverheatEffect;
        ClampValues();
        UpdateOverheatState();
    }

    public void SetSimulationEnabled(bool enabled)
    {
        simulationEnabled = enabled;
        UpdateOverheatState();
    }

    public void SetTemperature(float temperature)
    {
        currentTemperature = Mathf.Max(ambientTemperature, temperature);
        UpdateOverheatState();
    }

    public void ResetToAmbient()
    {
        currentTemperature = ambientTemperature;
        UpdateOverheatState();
    }

    private void OnValidate()
    {
        ClampValues();
        UpdateOverheatState();
    }

    private void ClampValues()
    {
        powerDrawKw = Mathf.Max(0f, powerDrawKw);
        heatGenerationPerSecond = Mathf.Max(0f, heatGenerationPerSecond);
        heatCapacity = Mathf.Max(0.0001f, heatCapacity);
        coolingRate = Mathf.Max(0f, coolingRate);
        maxTemperature = Mathf.Max(ambientTemperature, maxTemperature);
        currentTemperature = Mathf.Max(ambientTemperature, currentTemperature);
    }

    private void UpdateOverheatState()
    {
        bool wasOverheated = IsOverheated;
        IsOverheated = simulationEnabled && currentTemperature >= MaxTemperature;
        OverheatActivatedThisStep = !wasOverheated && IsOverheated;
    }
}
