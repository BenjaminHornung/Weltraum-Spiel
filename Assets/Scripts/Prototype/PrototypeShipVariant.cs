using System;
using UnityEngine;

[Serializable]
public sealed class PrototypeShipVariant
{
    [SerializeField] private string variantId = "baseline-balanced";
    [SerializeField] private string displayName = "Baseline Balanced";
    [SerializeField] private PrototypeShipConfig config;
    [SerializeField] private PrototypeShipMassSettings masses = PrototypeShipMassSettings.Default;
    [SerializeField] private PrototypeShipFuelSettings fuel = PrototypeShipFuelSettings.Default;
    [SerializeField] private PrototypeMainThrusterSettings mainThruster = PrototypeMainThrusterSettings.Default;
    [SerializeField] private PrototypeRcsSettings rcs = PrototypeRcsSettings.Default;
    [SerializeField] private PrototypeGunSettings gun = PrototypeGunSettings.Default;
    [SerializeField] private PrototypeCameraSettings camera = PrototypeCameraSettings.Default;
    [SerializeField] private PrototypeShipLayout layout = PrototypeShipLayout.Baseline();

    public string VariantId => string.IsNullOrWhiteSpace(variantId) ? "baseline-balanced" : variantId;
    public string DisplayName => string.IsNullOrWhiteSpace(displayName) ? VariantId : displayName;
    public PrototypeShipConfig Config => config;
    public PrototypeShipMassSettings Masses => config != null ? config.Masses : masses;
    public PrototypeShipFuelSettings Fuel => config != null ? config.Fuel : fuel;
    public PrototypeMainThrusterSettings MainThruster => config != null ? config.MainThruster : mainThruster;
    public PrototypeRcsSettings Rcs => config != null ? config.Rcs : rcs;
    public PrototypeGunSettings Gun => config != null ? config.Gun : gun;
    public PrototypeCameraSettings Camera => config != null ? config.Camera : camera;
    public PrototypeShipLayout Layout => layout ?? PrototypeShipLayout.Baseline();

    public static PrototypeShipVariant Baseline()
    {
        return Create("baseline-balanced", "Baseline Balanced", PrototypeShipLayout.Baseline());
    }

    public static PrototypeShipVariant DualMainThruster()
    {
        PrototypeMainThrusterSettings main = PrototypeMainThrusterSettings.Default;
        main.thrustForce *= 0.55f;
        return Create("dual-main-thruster", "Dual Main Thruster", PrototypeShipLayout.DualMainThruster(), main);
    }

    public static PrototypeShipVariant OffCenterMainThruster()
    {
        return Create("off-center-main-thruster", "Off-Center Main Thruster", PrototypeShipLayout.OffCenterMainThruster());
    }

    public static PrototypeShipVariant OneSidedRcs()
    {
        return Create("one-sided-rcs", "One-Sided RCS", PrototypeShipLayout.OneSidedRcs());
    }

    public static PrototypeShipVariant HeavyCargo()
    {
        PrototypeShipMassSettings mass = PrototypeShipMassSettings.Default;
        mass.hullMass += 900f;

        PrototypeMainThrusterSettings main = PrototypeMainThrusterSettings.Default;
        main.thrustForce *= 0.85f;

        return Create("heavy-cargo", "Heavy Cargo", PrototypeShipLayout.HeavyCargo(), main, null, null, null, mass);
    }

    public static PrototypeShipVariant NoRcs()
    {
        return Create("no-rcs", "No-RCS", PrototypeShipLayout.NoRcs());
    }

    public static PrototypeShipVariant[] BuiltIns()
    {
        return new[]
        {
            Baseline(),
            DualMainThruster(),
            OffCenterMainThruster(),
            OneSidedRcs(),
            HeavyCargo(),
            NoRcs()
        };
    }

    private static PrototypeShipVariant Create(
        string id,
        string name,
        PrototypeShipLayout shipLayout,
        PrototypeMainThrusterSettings? mainSettings = null,
        PrototypeRcsSettings? rcsSettings = null,
        PrototypeGunSettings? gunSettings = null,
        PrototypeCameraSettings? cameraSettings = null,
        PrototypeShipMassSettings? massSettings = null,
        PrototypeShipFuelSettings? fuelSettings = null)
    {
        return new PrototypeShipVariant
        {
            variantId = id,
            displayName = name,
            config = null,
            masses = massSettings ?? PrototypeShipMassSettings.Default,
            fuel = fuelSettings ?? PrototypeShipFuelSettings.Default,
            mainThruster = mainSettings ?? PrototypeMainThrusterSettings.Default,
            rcs = rcsSettings ?? PrototypeRcsSettings.Default,
            gun = gunSettings ?? PrototypeGunSettings.Default,
            camera = cameraSettings ?? PrototypeCameraSettings.Default,
            layout = shipLayout ?? PrototypeShipLayout.Baseline()
        };
    }
}
