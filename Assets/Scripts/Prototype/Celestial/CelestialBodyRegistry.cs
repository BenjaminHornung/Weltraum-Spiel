using System;
using System.Collections.Generic;
using System.Text;

public sealed class CelestialBodyRegistry
{
    private readonly Dictionary<string, CelestialBodyDefinition> bodiesById;
    private readonly List<CelestialBodyDefinition> sortedBodies;

    private CelestialBodyRegistry(IReadOnlyList<CelestialBodyDefinition> bodies)
    {
        bodiesById = new Dictionary<string, CelestialBodyDefinition>(StringComparer.Ordinal);
        sortedBodies = new List<CelestialBodyDefinition>();
        for (int i = 0; i < bodies.Count; i++)
        {
            CelestialBodyDefinition body = bodies[i];
            bodiesById.Add(body.id, body);
            sortedBodies.Add(body);
        }

        sortedBodies.Sort((left, right) => string.CompareOrdinal(left.id, right.id));
    }

    public IReadOnlyList<CelestialBodyDefinition> SortedBodies => sortedBodies;
    public int Count => sortedBodies.Count;

    public static bool TryCreate(
        CelestialBodyCatalog catalog,
        out CelestialBodyRegistry registry,
        out CelestialCatalogValidationResult validation)
    {
        registry = null;
        validation = CelestialBodyCatalogValidator.Validate(catalog);
        if (!validation.IsValid || catalog == null)
        {
            return false;
        }

        registry = new CelestialBodyRegistry(catalog.Bodies);
        return true;
    }

    public bool TryGetBody(string id, out CelestialBodyDefinition body)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            body = null;
            return false;
        }

        return bodiesById.TryGetValue(id, out body);
    }

    public string BuildDebugSummary()
    {
        var builder = new StringBuilder();
        builder.Append("Celestial Registry: ");
        builder.Append(sortedBodies.Count);
        builder.AppendLine(" bodies");
        for (int i = 0; i < sortedBodies.Count; i++)
        {
            CelestialBodyDefinition body = sortedBodies[i];
            builder.Append(body.id);
            builder.Append(" | ");
            builder.Append(body.displayName);
            builder.Append(" | ");
            builder.Append(body.bodyType);
            builder.Append(" | parent ");
            builder.Append(string.IsNullOrWhiteSpace(body.parentBodyId) ? "none" : body.parentBodyId);
            builder.Append(" | realRadiusMeters ");
            builder.Append(body.radiusMeters.ToString("0"));
            builder.Append(" | mu ");
            builder.Append(body.EffectiveMu.ToString("0.###E+0"));
            builder.Append(" | visualMapRadius ");
            builder.Append(body.visualScale.mapRadiusScale.ToString("0.###"));
            builder.Append(" | visualLocalRadius ");
            builder.Append(body.visualScale.localSpaceRadiusScale.ToString("0.###"));
            builder.AppendLine();
        }

        return builder.ToString().TrimEnd();
    }
}
