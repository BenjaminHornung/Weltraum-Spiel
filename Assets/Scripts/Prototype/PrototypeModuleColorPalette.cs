using UnityEngine;

public static class PrototypeModuleColorPalette
{
    public static readonly Color Hull = new Color(0.27f, 0.31f, 0.38f, 1f);
    public static readonly Color Cockpit = new Color(1f, 0.35f, 0.16f, 1f);
    public static readonly Color FuelTank = new Color(0.16f, 0.82f, 0.34f, 1f);
    public static readonly Color FuelTankCue = new Color(0.34f, 1f, 0.55f, 1f);
    public static readonly Color MainThruster = new Color(0.10f, 0.48f, 1f, 1f);
    public static readonly Color MainThrusterNozzleRing = new Color(1f, 0.56f, 0.16f, 1f);
    public static readonly Color RcsBlock = new Color(0.10f, 1f, 0.95f, 1f);
    public static readonly Color Gun = new Color(1f, 0.78f, 0.15f, 1f);
    public static readonly Color CargoUtility = new Color(0.86f, 0.57f, 0.22f, 1f);
    public static readonly Color Damaged = new Color(0.24f, 0.06f, 0.06f, 1f);
    public static readonly Color RcsVfx = new Color(0.06f, 1f, 0.92f, 0.95f);
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
