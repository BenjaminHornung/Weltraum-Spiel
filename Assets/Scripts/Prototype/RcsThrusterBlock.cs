using UnityEngine;

public class RcsThrusterBlock : MonoBehaviour
{
    [SerializeField] private float thrust = 6500f;

    public float Thrust => Mathf.Max(0f, thrust);

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
        if (config == null)
        {
            return;
        }

        PrototypeRcsSettings settings = config.Rcs;
        settings.Clamp();
        thrust = settings.blockThrust;
    }
}
