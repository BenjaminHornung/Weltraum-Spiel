using UnityEngine;

public static class PrototypeModuleColorPalette
{
    public static readonly Color Hull = new Color(0.62f, 0.66f, 0.72f, 1f);
    public static readonly Color Cockpit = new Color(0.95f, 0.28f, 0.18f, 1f);
    public static readonly Color FuelTank = new Color(0.22f, 0.72f, 0.36f, 1f);
    public static readonly Color MainThruster = new Color(0.18f, 0.42f, 0.95f, 1f);
    public static readonly Color RcsBlock = new Color(0.15f, 0.78f, 0.9f, 1f);
    public static readonly Color Gun = new Color(0.95f, 0.84f, 0.22f, 1f);
    public static readonly Color CargoUtility = new Color(0.55f, 0.48f, 0.72f, 1f);
    public static readonly Color Damaged = new Color(0.55f, 0.12f, 0.12f, 1f);
    public static readonly Color RcsVfx = new Color(0.35f, 1f, 0.65f, 0.85f);
    public static readonly Color MarkerForward = Color.cyan;
    public static readonly Color MarkerRight = new Color(0.95f, 0.18f, 0.18f, 1f);
    public static readonly Color MarkerUp = new Color(0.28f, 0.95f, 0.38f, 1f);
    public static readonly Color Target = new Color(0.25f, 0.85f, 1f, 1f);

    public static Color ForMassRole(PrototypeModuleMassRole role)
    {
        switch (role)
        {
            case PrototypeModuleMassRole.Cockpit:
                return Cockpit;
            case PrototypeModuleMassRole.FuelTank:
                return FuelTank;
            case PrototypeModuleMassRole.Custom:
                return CargoUtility;
            default:
                return Hull;
        }
    }
}
