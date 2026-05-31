using UnityEngine;

public class CelestialRegistryDebugComponent : MonoBehaviour
{
    [SerializeField] private CelestialBodyCatalog catalog;
    [SerializeField, TextArea(3, 12)] private string lastDebugSummary;

    public CelestialBodyCatalog Catalog => catalog;
    public string LastDebugSummary => lastDebugSummary;

    private void Awake()
    {
        if (catalog == null)
        {
            LoadDefaultCatalog();
            return;
        }

        RebuildDebugSummary();
    }

    private void OnValidate()
    {
        if (catalog != null)
        {
            RebuildDebugSummary();
        }
    }

    public void LoadDefaultCatalog()
    {
        catalog = Resources.Load<CelestialBodyCatalog>(CelestialBodyCatalog.ResourcePath);
        RebuildDebugSummary();
    }

    public string RebuildDebugSummary()
    {
        if (!CelestialBodyRegistry.TryCreate(catalog, out CelestialBodyRegistry registry, out CelestialCatalogValidationResult validation))
        {
            lastDebugSummary = validation != null && validation.Issues.Count > 0
                ? $"Celestial Registry invalid: {validation.Issues[0].Code} {validation.Issues[0].BodyId}"
                : "Celestial Registry unavailable.";
            return lastDebugSummary;
        }

        lastDebugSummary = registry.BuildDebugSummary();
        return lastDebugSummary;
    }
}
