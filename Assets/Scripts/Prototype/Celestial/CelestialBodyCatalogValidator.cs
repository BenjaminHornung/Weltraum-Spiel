using System;
using System.Collections.Generic;

public enum CelestialCatalogValidationCode
{
    EmptyCatalog,
    NullBody,
    InvalidId,
    DuplicateId,
    MissingParent,
    ParentMismatch,
    InvalidRadius,
    MissingGravityInput,
    InvalidGravityData,
    MuMassMismatch,
    MissingOrbit,
    InvalidOrbit,
    InvalidVisualScale
}

public sealed class CelestialCatalogValidationIssue
{
    public CelestialCatalogValidationIssue(CelestialCatalogValidationCode code, string bodyId, string message)
    {
        Code = code;
        BodyId = bodyId;
        Message = message;
    }

    public CelestialCatalogValidationCode Code { get; }
    public string BodyId { get; }
    public string Message { get; }
}

public sealed class CelestialCatalogValidationResult
{
    private readonly List<CelestialCatalogValidationIssue> issues = new List<CelestialCatalogValidationIssue>();

    public IReadOnlyList<CelestialCatalogValidationIssue> Issues => issues;
    public bool IsValid => issues.Count == 0;

    public void Add(CelestialCatalogValidationCode code, string bodyId, string message)
    {
        issues.Add(new CelestialCatalogValidationIssue(code, bodyId, message));
    }
}

public static class CelestialBodyCatalogValidator
{
    public const double GravitationalConstant = 6.67430e-11d;
    public const double MuRelativeTolerance = 0.01d;

    public static CelestialCatalogValidationResult Validate(CelestialBodyCatalog catalog)
    {
        return Validate(catalog != null ? catalog.Bodies : null);
    }

    public static CelestialCatalogValidationResult Validate(IReadOnlyList<CelestialBodyDefinition> bodies)
    {
        var result = new CelestialCatalogValidationResult();
        if (bodies == null || bodies.Count == 0)
        {
            result.Add(CelestialCatalogValidationCode.EmptyCatalog, string.Empty, "Catalog contains no celestial bodies.");
            return result;
        }

        var bodiesById = new Dictionary<string, CelestialBodyDefinition>(StringComparer.Ordinal);
        for (int i = 0; i < bodies.Count; i++)
        {
            CelestialBodyDefinition body = bodies[i];
            if (body == null)
            {
                result.Add(CelestialCatalogValidationCode.NullBody, string.Empty, "Catalog contains a null body definition.");
                continue;
            }

            if (!IsValidBodyId(body.id))
            {
                result.Add(CelestialCatalogValidationCode.InvalidId, body.id, "Body ID must be lowercase ASCII segments separated by dots.");
                continue;
            }

            if (bodiesById.ContainsKey(body.id))
            {
                result.Add(CelestialCatalogValidationCode.DuplicateId, body.id, "Body ID appears more than once.");
                continue;
            }

            bodiesById.Add(body.id, body);
        }

        for (int i = 0; i < bodies.Count; i++)
        {
            CelestialBodyDefinition body = bodies[i];
            if (body == null || string.IsNullOrWhiteSpace(body.id))
            {
                continue;
            }

            ValidateBody(body, bodiesById, result);
        }

        return result;
    }

    private static void ValidateBody(
        CelestialBodyDefinition body,
        Dictionary<string, CelestialBodyDefinition> bodiesById,
        CelestialCatalogValidationResult result)
    {
        if (body.radiusMeters <= 0d)
        {
            result.Add(CelestialCatalogValidationCode.InvalidRadius, body.id, "Body radius must be greater than zero.");
        }

        double effectiveMu = body.EffectiveMu;
        if (body.massKg <= 0d && effectiveMu <= 0d)
        {
            result.Add(CelestialCatalogValidationCode.MissingGravityInput, body.id, "Body requires massKg or gravitationalParameterMu.");
        }

        if (body.gravity.mu <= 0d)
        {
            result.Add(CelestialCatalogValidationCode.InvalidGravityData, body.id, "GravityDefinition.mu must be greater than zero.");
        }

        if (body.massKg > 0d && effectiveMu > 0d)
        {
            double expectedMu = GravitationalConstant * body.massKg;
            double relativeDifference = Math.Abs(effectiveMu - expectedMu) / Math.Max(expectedMu, double.Epsilon);
            if (relativeDifference > MuRelativeTolerance)
            {
                result.Add(CelestialCatalogValidationCode.MuMassMismatch, body.id, "Body mu differs from G * massKg beyond tolerance.");
            }
        }

        ValidateParentAndOrbit(body, bodiesById, result);
        ValidateVisualScale(body, result);
    }

    private static void ValidateParentAndOrbit(
        CelestialBodyDefinition body,
        Dictionary<string, CelestialBodyDefinition> bodiesById,
        CelestialCatalogValidationResult result)
    {
        bool hasParent = !string.IsNullOrWhiteSpace(body.parentBodyId);
        if (!hasParent && body.bodyType != CelestialBodyType.Star)
        {
            result.Add(CelestialCatalogValidationCode.MissingParent, body.id, "Non-star body requires a parent body ID.");
            return;
        }

        if (!hasParent)
        {
            return;
        }

        if (!bodiesById.ContainsKey(body.parentBodyId))
        {
            result.Add(CelestialCatalogValidationCode.MissingParent, body.id, $"Parent body '{body.parentBodyId}' does not exist.");
        }

        if (!body.hasOrbit)
        {
            result.Add(CelestialCatalogValidationCode.MissingOrbit, body.id, "Body with a parent requires an orbit definition.");
            return;
        }

        if (!string.Equals(body.orbit.parentBodyId, body.parentBodyId, StringComparison.Ordinal))
        {
            result.Add(CelestialCatalogValidationCode.ParentMismatch, body.id, "Orbit parentBodyId must match body parentBodyId.");
        }

        if (body.orbit.semiMajorAxisMeters <= 0d || body.orbit.eccentricity < 0d || body.orbit.eccentricity >= 1d)
        {
            result.Add(CelestialCatalogValidationCode.InvalidOrbit, body.id, "Orbit requires positive semi-major axis and 0 <= eccentricity < 1.");
        }
    }

    private static void ValidateVisualScale(CelestialBodyDefinition body, CelestialCatalogValidationResult result)
    {
        if (body.visualScale.mapRadiusScale <= 0d ||
            body.visualScale.localSpaceRadiusScale <= 0d ||
            body.visualScale.impostorRadiusScale <= 0d)
        {
            result.Add(CelestialCatalogValidationCode.InvalidVisualScale, body.id, "Visual scale radii must be greater than zero.");
        }
    }

    private static bool IsValidBodyId(string id)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            return false;
        }

        bool hasDot = false;
        bool previousWasDot = true;
        for (int i = 0; i < id.Length; i++)
        {
            char c = id[i];
            if (c == '.')
            {
                if (previousWasDot)
                {
                    return false;
                }

                hasDot = true;
                previousWasDot = true;
                continue;
            }

            bool valid = (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '_';
            if (!valid)
            {
                return false;
            }

            previousWasDot = false;
        }

        return hasDot && !previousWasDot;
    }
}
