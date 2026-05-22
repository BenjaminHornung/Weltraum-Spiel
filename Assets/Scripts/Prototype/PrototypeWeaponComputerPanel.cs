using System;
using UnityEngine;

[RequireComponent(typeof(Camera))]
public class PrototypeWeaponComputerPanel : MonoBehaviour
{
    [SerializeField] private Transform shipRoot;
    [SerializeField] private ShipStats shipStats;
    [SerializeField] private PrototypeWeaponComputer weaponComputer;
    [SerializeField] private PrototypeTurretWeapon turretWeapon;

    private GUIStyle labelStyle;
    private GUIStyle headingStyle;
    private Vector2 scrollPosition;
    private PrototypeUiWindowState windowState;

    public bool IsWindowVisible => ResolveWindowState().Visible;
    public bool IsWindowCollapsed => ResolveWindowState().Collapsed;

    private void Start()
    {
        ResolveReferences();
    }

    private void OnGUI()
    {
        ResolveWindowState();
        if (!windowState.Visible)
        {
            return;
        }

        EnsureStyles();
        if (!windowState.Collapsed && HasMissingReferences())
        {
            ResolveReferences();
        }

        windowState.SetSize(420f, windowState.Collapsed ? 58f : Mathf.Clamp(Screen.height - 96f, 300f, 620f));
        windowState.Rect = GUI.Window(windowState.WindowId, windowState.Rect, DrawWindow, "Weapon Computer");
        windowState.ClampToScreen();
        windowState.TrySaveToPrefsThrottled();
    }

    public void Bind(Transform root, ShipStats stats, PrototypeWeaponComputer computer, PrototypeTurretWeapon weapon)
    {
        shipRoot = root != null ? root : shipRoot;
        shipStats = stats != null ? stats : shipStats;
        weaponComputer = computer != null ? computer : weaponComputer;
        turretWeapon = weapon != null ? weapon : turretWeapon;
        ResolveReferences();
    }

    public void SetWindowVisible(bool visible)
    {
        ResolveWindowState().Visible = visible;
    }

    public void SetWindowCollapsed(bool collapsed)
    {
        ResolveWindowState().Collapsed = collapsed;
    }

    private PrototypeUiWindowState ResolveWindowState()
    {
        if (windowState == null)
        {
            windowState = PrototypeUiLayoutManager.GetWindow(
                PrototypeUiLayoutManager.WeaponComputerWindowId,
                new Rect(16f, 96f, 420f, 520f),
                true,
                false);
        }

        return windowState;
    }

    private void ResolveReferences()
    {
        if (shipRoot != null)
        {
            if (shipStats == null)
            {
                shipStats = shipRoot.GetComponent<ShipStats>();
            }

            if (weaponComputer == null)
            {
                weaponComputer = shipRoot.GetComponent<PrototypeWeaponComputer>();
            }

            if (turretWeapon == null)
            {
                turretWeapon = shipRoot.GetComponentInChildren<PrototypeTurretWeapon>();
            }
        }

        if (weaponComputer != null && turretWeapon == null)
        {
            turretWeapon = weaponComputer.TurretWeapon;
        }
    }

    private bool HasMissingReferences()
    {
        return shipRoot != null && (shipStats == null || weaponComputer == null || turretWeapon == null);
    }

    private void EnsureStyles()
    {
        if (labelStyle != null)
        {
            return;
        }

        labelStyle = PrototypeUiStyle.CreateLabelStyle();
        headingStyle = PrototypeUiStyle.CreateSectionHeadingStyle();
    }

    private void DrawWindow(int id)
    {
        GUILayout.BeginVertical();
        GUILayout.BeginHorizontal();
        if (GUILayout.Button(windowState.Collapsed ? "Open" : "Collapse", GUILayout.Width(76f)))
        {
            windowState.Collapsed = !windowState.Collapsed;
        }

        GUILayout.EndHorizontal();

        if (!windowState.Collapsed)
        {
            scrollPosition = GUILayout.BeginScrollView(scrollPosition);
            DrawComputerControls();
            DrawTargetList();
            DrawTurretStatus();
            DrawDebugValues();
            GUILayout.EndScrollView();
        }

        GUILayout.EndVertical();
        GUI.DragWindow(new Rect(0f, 0f, 10000f, 24f));
    }

    private void DrawComputerControls()
    {
        GUILayout.Label("Targeting", headingStyle);
        if (weaponComputer == null)
        {
            GUILayout.Label("Weapon computer unavailable.", labelStyle);
            return;
        }

        bool autoFire = GUILayout.Toggle(weaponComputer.AutoFireEnabled, "Auto Fire");
        if (autoFire != weaponComputer.AutoFireEnabled)
        {
            weaponComputer.SetAutoFireEnabled(autoFire);
        }

        PrototypeWeaponTargetPriorityMode nextMode = DrawPrioritySelector(weaponComputer.PriorityMode);
        if (nextMode != weaponComputer.PriorityMode)
        {
            weaponComputer.SetPriorityMode(nextMode);
        }

        GUILayout.BeginHorizontal();
        if (GUILayout.Button("Refresh Targets"))
        {
            weaponComputer.RefreshTargets();
        }

        if (GUILayout.Button("Clear Selection"))
        {
            weaponComputer.ClearSelection();
        }
        GUILayout.EndHorizontal();

        PrototypeWeaponTarget active = weaponComputer.ActiveTarget;
        GUILayout.Label("Active: " + (active != null && active.IsValid ? active.Label : "none"), labelStyle);
    }

    private PrototypeWeaponTargetPriorityMode DrawPrioritySelector(PrototypeWeaponTargetPriorityMode current)
    {
        Array values = Enum.GetValues(typeof(PrototypeWeaponTargetPriorityMode));
        int currentIndex = Mathf.Max(0, Array.IndexOf(values, current));
        string[] labels = new string[values.Length];
        for (int i = 0; i < values.Length; i++)
        {
            labels[i] = values.GetValue(i).ToString();
        }

        int selectedIndex = GUILayout.SelectionGrid(currentIndex, labels, 2);
        return (PrototypeWeaponTargetPriorityMode)values.GetValue(Mathf.Clamp(selectedIndex, 0, values.Length - 1));
    }

    private void DrawTargetList()
    {
        GUILayout.Label("Targets", headingStyle);
        if (weaponComputer == null)
        {
            GUILayout.Label("No target source.", labelStyle);
            return;
        }

        if (weaponComputer.AvailableTargets == null || weaponComputer.AvailableTargets.Count == 0)
        {
            GUILayout.Label("No available targets.", labelStyle);
            return;
        }

        for (int i = 0; i < weaponComputer.AvailableTargets.Count; i++)
        {
            PrototypeWeaponTarget target = weaponComputer.AvailableTargets[i];
            if (target == null || !target.IsValid)
            {
                continue;
            }

            GUILayout.BeginHorizontal();
            bool selected = GUILayout.Toggle(weaponComputer.IsSelected(target), string.Empty, GUILayout.Width(22f));
            if (selected != weaponComputer.IsSelected(target))
            {
                weaponComputer.ToggleTarget(target);
            }

            GUILayout.Label(BuildTargetLine(target), labelStyle);
            GUILayout.EndHorizontal();
        }
    }

    private void DrawTurretStatus()
    {
        GUILayout.Label("Turret", headingStyle);
        string status = weaponComputer != null ? weaponComputer.TurretStatusLabel : "no authority";
        GUILayout.Label("Status: " + status, labelStyle);

        PrototypeTurretFireStatus fireStatus = weaponComputer != null ? weaponComputer.LastTurretStatus : default;
        GUILayout.Label(
            $"Yaw {fireStatus.appliedYawDegrees:0.0}/{fireStatus.requestedYawDegrees:0.0} | Pitch {fireStatus.appliedPitchDegrees:0.0}/{fireStatus.requestedPitchDegrees:0.0}",
            labelStyle);
        if (shipStats != null)
        {
            GUILayout.Label(
                $"Arc Y {shipStats.YawLimitLeftDegrees:0}/{shipStats.YawLimitRightDegrees:0} | P {shipStats.PitchMinDegrees:0}/{shipStats.PitchMaxDegrees:0}",
                labelStyle);
            GUILayout.Label(
                $"Range {fireStatus.distanceMeters:0}/{shipStats.EngagementRangeMeters:0} m | AutoFire {(weaponComputer != null && weaponComputer.AutoFireEnabled ? "on" : "off")}",
                labelStyle);
        }

        if (fireStatus.cooldownRemainingSeconds > 0f)
        {
            GUILayout.Label("Cooldown: " + fireStatus.cooldownRemainingSeconds.ToString("0.00") + " s", labelStyle);
        }
    }

    private void DrawDebugValues()
    {
        GUILayout.Label("Debug", headingStyle);
        if (shipStats == null)
        {
            GUILayout.Label("No ShipStats bound.", labelStyle);
            return;
        }

        GUILayout.Label($"Range {shipStats.EngagementRangeMeters:0} m | Hit {shipStats.HitChance:0.00}", labelStyle);
        GUILayout.Label($"Projectile {shipStats.ProjectileSpeed:0} m/s | Diameter {shipStats.ProjectileDiameter:0.00} m", labelStyle);
        GUILayout.Label($"Fire rate {shipStats.ProjectileFireRate:0.00}/s | Lead {(shipStats.LeadTargetEnabled ? "on" : "off")}", labelStyle);

        if (turretWeapon == null)
        {
            GUILayout.Label("Recoil: no turret", labelStyle);
            return;
        }

        GUILayout.Label(
            $"Recoil {(turretWeapon.LastRecoilApplied ? "applied" : "idle")} | Impulse {FormatVector(turretWeapon.LastRecoilImpulseWorld)} | Pos {FormatVector(turretWeapon.LastRecoilPositionWorld)}",
            labelStyle);
    }

    private static string BuildTargetLine(PrototypeWeaponTarget target)
    {
        return $"{target.Label} | {target.CurrentHealth:0}/{target.MaxHealth:0} | {target.HealthLabel}";
    }

    private static string FormatVector(Vector3 value)
    {
        return $"({value.x:0.00}, {value.y:0.00}, {value.z:0.00})";
    }
}
