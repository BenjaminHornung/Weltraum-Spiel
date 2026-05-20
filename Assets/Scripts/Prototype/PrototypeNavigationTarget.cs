using UnityEngine;

[DisallowMultipleComponent]
public class PrototypeNavigationTarget : MonoBehaviour
{
    [SerializeField] private string displayName;
    [SerializeField] private float arrivalRadius = 10f;

    public string DisplayName => string.IsNullOrWhiteSpace(displayName) ? gameObject.name : displayName;
    public float ArrivalRadius => Mathf.Max(0.5f, arrivalRadius);
    public Vector3 Position => transform.position;

    public void Configure(string targetName, float radius)
    {
        displayName = string.IsNullOrWhiteSpace(targetName) ? gameObject.name : targetName;
        arrivalRadius = Mathf.Max(0.5f, radius);
    }

    private void OnValidate()
    {
        arrivalRadius = Mathf.Max(0.5f, arrivalRadius);
    }
}
