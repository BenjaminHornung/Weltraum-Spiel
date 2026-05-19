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
}
