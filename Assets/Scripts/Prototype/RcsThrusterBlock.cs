using UnityEngine;

public class RcsThrusterBlock : MonoBehaviour
{
    [SerializeField] private float thrust = 6500f;
    [SerializeField] private PrototypeModuleDamageState damageState;

    public float UndamagedThrust => Mathf.Max(0f, thrust);
    public float DamageCapabilityMultiplier
    {
        get
        {
            ResolveReferences();
            return damageState != null ? damageState.CapabilityMultiplier : 1f;
        }
    }
    public float Thrust => UndamagedThrust * DamageCapabilityMultiplier;
    public PrototypeModuleDamageState DamageState
    {
        get
        {
            ResolveReferences();
            return damageState;
        }
    }

    private void Awake()
    {
        ResolveReferences();
    }

    private void OnValidate()
    {
        thrust = Mathf.Max(0f, thrust);
    }


    public void ConfigureDefault(float defaultThrust)
    {
        if (thrust <= 0f)
        {
            thrust = Mathf.Max(0f, defaultThrust);
        }
    }


public void ConfigureThrust(float configuredThrust)
    {
        thrust = Mathf.Max(0f, configuredThrust);
    }


public void ApplyConfig(PrototypeShipConfig config)
    {
        PrototypeRcsSettings settings = config != null ? config.Rcs : PrototypeRcsSettings.Default;
        settings.Clamp();
        thrust = settings.blockThrust;
    }


public void ConfigureDamageState(PrototypeModuleDamageState state)
    {
        damageState = state != null ? state : damageState;
        ResolveReferences();
    }


private void ResolveReferences()
    {
        if (damageState == null)
        {
            damageState = GetComponent<PrototypeModuleDamageState>();
        }
    }
}
