using UnityEngine;

[DisallowMultipleComponent]
public class PrototypeModuleDamageState : MonoBehaviour
{
    [SerializeField] private string moduleName = "Module";
    [SerializeField] private float maxIntegrity = 100f;
    [SerializeField] private float currentIntegrity = 100f;
    [Range(0f, 1f)]
    [SerializeField] private float minimumCapabilityMultiplier;

    public string ModuleName => string.IsNullOrWhiteSpace(moduleName) ? gameObject.name : moduleName;
    public float MaxIntegrity => Mathf.Max(1f, maxIntegrity);
    public float CurrentIntegrity => Mathf.Clamp(currentIntegrity, 0f, MaxIntegrity);
    public float IntegrityFraction => Mathf.Clamp01(CurrentIntegrity / MaxIntegrity);
    public float DamageFraction => 1f - IntegrityFraction;
    public float CapabilityMultiplier => Mathf.Lerp(Mathf.Clamp01(minimumCapabilityMultiplier), 1f, IntegrityFraction);
    public bool IsDamaged => DamageFraction > 0.0001f;
    public bool IsDestroyed => CurrentIntegrity <= 0.0001f;
    public float LastDamageApplied { get; private set; }
    public PrototypeImpactEventData LastImpactEvent { get; private set; }
    public string StateLabel => IsDestroyed ? "destroyed" : IsDamaged ? "damaged" : "nominal";

    private void Awake()
    {
        ClampState();
        if (string.IsNullOrWhiteSpace(moduleName))
        {
            moduleName = gameObject.name;
        }
    }

    private void OnEnable()
    {
        PrototypeWeaponTargetRegistry.Register(transform);
    }

    private void OnDisable()
    {
        PrototypeWeaponTargetRegistry.Unregister(transform);
    }

    public void Configure(string configuredModuleName, float configuredMaxIntegrity, float configuredMinimumCapabilityMultiplier)
    {
        moduleName = string.IsNullOrWhiteSpace(configuredModuleName) ? gameObject.name : configuredModuleName;
        maxIntegrity = Mathf.Max(1f, configuredMaxIntegrity);
        minimumCapabilityMultiplier = Mathf.Clamp01(configuredMinimumCapabilityMultiplier);
        currentIntegrity = Mathf.Clamp(currentIntegrity, 0f, maxIntegrity);
    }

    public float ApplyDamage(float damage)
    {
        float appliedDamage = Mathf.Max(0f, damage);
        if (appliedDamage <= 0f || CurrentIntegrity <= 0f)
        {
            LastDamageApplied = 0f;
            return 0f;
        }

        float before = CurrentIntegrity;
        currentIntegrity = Mathf.Max(0f, before - appliedDamage);
        LastDamageApplied = before - CurrentIntegrity;
        return LastDamageApplied;
    }

    public float ApplyImpactDamage(PrototypeImpactEventData impactEvent, float damage)
    {
        LastImpactEvent = impactEvent;
        return ApplyDamage(damage);
    }

    public void RepairFull()
    {
        currentIntegrity = MaxIntegrity;
        LastDamageApplied = 0f;
        LastImpactEvent = default;
    }

    public void SetIntegrityFraction(float integrityFraction)
    {
        currentIntegrity = MaxIntegrity * Mathf.Clamp01(integrityFraction);
        LastDamageApplied = 0f;
    }

    private void OnValidate()
    {
        ClampState();
    }

    private void ClampState()
    {
        maxIntegrity = Mathf.Max(1f, maxIntegrity);
        currentIntegrity = Mathf.Clamp(currentIntegrity, 0f, maxIntegrity);
        minimumCapabilityMultiplier = Mathf.Clamp01(minimumCapabilityMultiplier);
    }
}
