using System.Collections.Generic;
using UnityEngine;

[CreateAssetMenu(menuName = "Prototype/Celestial Body Catalog", fileName = "AureliaSystemCelestialCatalog")]
public class CelestialBodyCatalog : ScriptableObject
{
    public const string AssetPath = "Assets/Resources/Prototype/Celestial/AureliaSystemCelestialCatalog.asset";
    public const string ResourcePath = "Prototype/Celestial/AureliaSystemCelestialCatalog";

    [SerializeField] private List<CelestialBodyDefinition> bodies = new List<CelestialBodyDefinition>();

    public IReadOnlyList<CelestialBodyDefinition> Bodies => bodies;

    public void SetBodies(IEnumerable<CelestialBodyDefinition> definitions)
    {
        bodies.Clear();
        if (definitions == null)
        {
            return;
        }

        foreach (CelestialBodyDefinition definition in definitions)
        {
            bodies.Add(definition != null ? definition.Clone() : null);
        }
    }
}
