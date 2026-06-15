#nullable enable

using System;
using System.Collections.Generic;

namespace Weltraum.UI
{
    public enum StatusAuthorityOwner
    {
        NavigationComputer = 1,
        CargoService = 2,
        ScannerService = 3,
        FactionLegalService = 4,
        ShipAuthority = 5,
        SuitVitalsService = 6,
        BuilderModeAuthority = 7
    }

    public enum StatusSeverity
    {
        Low = 1,
        Medium = 2,
        High = 3,
        Critical = 4
    }

    public enum WarningChipCode
    {
        NAV_FUEL_INSUFFICIENT = 1,
        NAV_NO_AUTHORITY = 2,
        NAV_NO_BRAKE_RESERVE = 3,
        NAV_PLAN_INVALIDATED = 4,
        NAV_UNSAFE_TARGET = 5,
        NAV_LIMITED_AUTHORITY = 6,
        CARGO_TOO_HEAVY = 7,
        CARGO_TRANSFER_BLOCKED = 8,
        CARGO_CONTAINMENT_VIOLATION = 9,
        SCAN_HAZARD_LOCAL = 10,
        SCAN_CONFIDENCE_LOW = 11,
        LEGAL_NO_LICENSE = 12,
        LEGAL_ILLEGAL_ACTION = 13,
        LEGAL_ENFORCEMENT_RISK = 14,
        SHIP_AUTOFIRE_BLOCKED = 15,
        SUIT_OXYGEN_LOW = 16,
        SUIT_HAZARD_EXPOSURE = 17,
        SUIT_INTEGRITY_CRITICAL = 18
    }

    public enum FailureReasonCode
    {
        ROUTE_TARGET_INSIDE_BODY = 1,
        ROUTE_FUEL_INSUFFICIENT = 2,
        ROUTE_NO_BRAKE_RESERVE = 3,
        ROUTE_CLEARANCE_VIOLATION = 4,
        ROUTE_NO_AUTHORITY = 5,
        ROUTE_TIMEWARP_UNSTABLE = 6,
        PLAN_INVALIDATED_OBSTACLE = 7,
        PLAN_INVALIDATED_FUEL = 8,
        CARGO_CAPACITY_FULL = 9,
        CARGO_CONTAINMENT_MISMATCH = 10,
        CARGO_TOO_HEAVY_FOR_SHIP = 11,
        CARGO_TRANSFER_NO_ACCESS = 12,
        LEGAL_NO_PERMIT = 13,
        LEGAL_CONTRABAND = 14,
        LEGAL_FACTION_HOSTILE = 15,
        SCAN_NO_DETECTION = 16,
        SCAN_CONFIDENCE_TOO_LOW = 17,
        SHIP_NO_MUZZLE = 18,
        SHIP_OUT_OF_ARC = 19,
        SHIP_COOLDOWN = 20,
        SUIT_OXYGEN_DEPLETED = 21,
        BUILDER_NOT_SAFE_STATE = 22
    }

    public enum PlayerActionHint
    {
        RefuelOrShortenRoute = 1,
        CheckRcsThrustersOrRepairShip = 2,
        RepairShip = 3,
        ShortenRouteOrReduceSpeed = 4,
        CreateNewPlan = 5,
        CheckTarget = 6,
        ManeuverCarefully = 7,
        ReduceMass = 8,
        CheckCapacityOrContainment = 9,
        MoveResourceToPermittedContainer = 10,
        AvoidHazard = 11,
        ScanCloserOrProceedCautiously = 12,
        MoveCloserOrUpgradeScanner = 13,
        AcquireLicense = 14,
        AbortActionOrAcceptConsequence = 15,
        AcceptRiskOrAbort = 16,
        MoveTargetIntoArcOrWaitForCooldown = 17,
        ReturnToShipOrOutpostImmediately = 18,
        LeaveHazardZone = 19,
        SeekRepair = 20,
        RefuelOrReplan = 21,
        ChooseAnotherContainerOrOffload = 22,
        ChoosePermittedContainer = 23,
        AcquirePermit = 24,
        OffloadOrLeaveZone = 25,
        Wait = 26,
        ReturnToShipImmediately = 27,
        DockOrLandFirst = 28,
        MoveTargetIntoArc = 29,
        AdjustRoute = 30,
        SimplifyRoute = 31,
        MoveTarget = 32,
        ScanCloser = 33,
        WaitForCooldown = 34
    }

    public sealed class WarningChipDefinition
    {
        private static readonly WarningChipDefinition[] s_all =
        {
            new WarningChipDefinition(WarningChipCode.NAV_FUEL_INSUFFICIENT, StatusAuthorityOwner.NavigationComputer, StatusSeverity.Critical, PlayerActionHint.RefuelOrShortenRoute, "Fuel insufficient."),
            new WarningChipDefinition(WarningChipCode.NAV_NO_AUTHORITY, StatusAuthorityOwner.NavigationComputer, StatusSeverity.Critical, PlayerActionHint.CheckRcsThrustersOrRepairShip, "No control authority."),
            new WarningChipDefinition(WarningChipCode.NAV_NO_BRAKE_RESERVE, StatusAuthorityOwner.NavigationComputer, StatusSeverity.Critical, PlayerActionHint.ShortenRouteOrReduceSpeed, "No brake reserve."),
            new WarningChipDefinition(WarningChipCode.NAV_PLAN_INVALIDATED, StatusAuthorityOwner.NavigationComputer, StatusSeverity.High, PlayerActionHint.CreateNewPlan, "Plan invalidated."),
            new WarningChipDefinition(WarningChipCode.NAV_UNSAFE_TARGET, StatusAuthorityOwner.NavigationComputer, StatusSeverity.High, PlayerActionHint.CheckTarget, "Unsafe target."),
            new WarningChipDefinition(WarningChipCode.NAV_LIMITED_AUTHORITY, StatusAuthorityOwner.NavigationComputer, StatusSeverity.Medium, PlayerActionHint.ManeuverCarefully, "Limited authority."),
            new WarningChipDefinition(WarningChipCode.CARGO_TOO_HEAVY, StatusAuthorityOwner.CargoService, StatusSeverity.High, PlayerActionHint.ReduceMass, "Cargo too heavy."),
            new WarningChipDefinition(WarningChipCode.CARGO_TRANSFER_BLOCKED, StatusAuthorityOwner.CargoService, StatusSeverity.Medium, PlayerActionHint.CheckCapacityOrContainment, "Cargo transfer blocked."),
            new WarningChipDefinition(WarningChipCode.CARGO_CONTAINMENT_VIOLATION, StatusAuthorityOwner.CargoService, StatusSeverity.High, PlayerActionHint.MoveResourceToPermittedContainer, "Containment violation."),
            new WarningChipDefinition(WarningChipCode.SCAN_HAZARD_LOCAL, StatusAuthorityOwner.ScannerService, StatusSeverity.High, PlayerActionHint.AvoidHazard, "Local hazard detected."),
            new WarningChipDefinition(WarningChipCode.SCAN_CONFIDENCE_LOW, StatusAuthorityOwner.ScannerService, StatusSeverity.Low, PlayerActionHint.ScanCloserOrProceedCautiously, "Low scan confidence."),
            new WarningChipDefinition(WarningChipCode.LEGAL_NO_LICENSE, StatusAuthorityOwner.FactionLegalService, StatusSeverity.High, PlayerActionHint.AcquireLicense, "No license."),
            new WarningChipDefinition(WarningChipCode.LEGAL_ILLEGAL_ACTION, StatusAuthorityOwner.FactionLegalService, StatusSeverity.Critical, PlayerActionHint.AbortActionOrAcceptConsequence, "Illegal action."),
            new WarningChipDefinition(WarningChipCode.LEGAL_ENFORCEMENT_RISK, StatusAuthorityOwner.FactionLegalService, StatusSeverity.Medium, PlayerActionHint.AcceptRiskOrAbort, "Enforcement risk."),
            new WarningChipDefinition(WarningChipCode.SHIP_AUTOFIRE_BLOCKED, StatusAuthorityOwner.ShipAuthority, StatusSeverity.Medium, PlayerActionHint.MoveTargetIntoArcOrWaitForCooldown, "Autofire blocked."),
            new WarningChipDefinition(WarningChipCode.SUIT_OXYGEN_LOW, StatusAuthorityOwner.SuitVitalsService, StatusSeverity.Critical, PlayerActionHint.ReturnToShipOrOutpostImmediately, "Oxygen low."),
            new WarningChipDefinition(WarningChipCode.SUIT_HAZARD_EXPOSURE, StatusAuthorityOwner.SuitVitalsService, StatusSeverity.High, PlayerActionHint.LeaveHazardZone, "Hazard exposure."),
            new WarningChipDefinition(WarningChipCode.SUIT_INTEGRITY_CRITICAL, StatusAuthorityOwner.SuitVitalsService, StatusSeverity.Critical, PlayerActionHint.SeekRepair, "Suit integrity critical.")
        };

        private static readonly IReadOnlyDictionary<WarningChipCode, WarningChipDefinition> s_lookup = BuildLookup(s_all);

        public WarningChipCode Code { get; }
        public StatusAuthorityOwner Owner { get; }
        public StatusSeverity Severity { get; }
        public PlayerActionHint ActionHint { get; }
        public string? PlayerTextKey { get; }
        public string FallbackText { get; }

        public bool IsDismissible => Severity == StatusSeverity.Low;

        public static IReadOnlyList<WarningChipDefinition> All => s_all;

        public WarningChipDefinition(
            WarningChipCode code,
            StatusAuthorityOwner owner,
            StatusSeverity severity,
            PlayerActionHint actionHint,
            string fallbackText,
            string? playerTextKey = null)
        {
            Code = StatusAuthorityContractGuards.RequireDefinedEnum(code, nameof(code));
            Owner = StatusAuthorityContractGuards.RequireDefinedEnum(owner, nameof(owner));
            Severity = StatusAuthorityContractGuards.RequireDefinedEnum(severity, nameof(severity));
            ActionHint = StatusAuthorityContractGuards.RequireDefinedEnum(actionHint, nameof(actionHint));
            FallbackText = StatusAuthorityContractGuards.RequireRequiredText(fallbackText, nameof(fallbackText));
            PlayerTextKey = StatusAuthorityContractGuards.NormalizeOptionalText(playerTextKey);
        }

        public static WarningChipDefinition GetDefinition(WarningChipCode code)
        {
            StatusAuthorityContractGuards.RequireDefinedEnum(code, nameof(code));

            if (s_lookup.TryGetValue(code, out var definition))
            {
                return definition;
            }

            throw new KeyNotFoundException($"Warning chip definition not found for '{code}'.");
        }

        private static IReadOnlyDictionary<WarningChipCode, WarningChipDefinition> BuildLookup(IEnumerable<WarningChipDefinition> definitions)
        {
            var lookup = new Dictionary<WarningChipCode, WarningChipDefinition>();

            foreach (var definition in definitions)
            {
                lookup.Add(definition.Code, definition);
            }

            return lookup;
        }
    }

    public sealed class FailureReasonDefinition
    {
        private static readonly FailureReasonDefinition[] s_all =
        {
            new FailureReasonDefinition(FailureReasonCode.ROUTE_TARGET_INSIDE_BODY, StatusAuthorityOwner.NavigationComputer, PlayerActionHint.MoveTarget, "Target is inside a planet or moon."),
            new FailureReasonDefinition(FailureReasonCode.ROUTE_FUEL_INSUFFICIENT, StatusAuthorityOwner.NavigationComputer, PlayerActionHint.RefuelOrShortenRoute, "Not enough fuel for this route."),
            new FailureReasonDefinition(FailureReasonCode.ROUTE_NO_BRAKE_RESERVE, StatusAuthorityOwner.NavigationComputer, PlayerActionHint.ShortenRouteOrReduceSpeed, "No brake reserve after arrival."),
            new FailureReasonDefinition(FailureReasonCode.ROUTE_CLEARANCE_VIOLATION, StatusAuthorityOwner.NavigationComputer, PlayerActionHint.AdjustRoute, "Route violates clearance."),
            new FailureReasonDefinition(FailureReasonCode.ROUTE_NO_AUTHORITY, StatusAuthorityOwner.NavigationComputer, PlayerActionHint.CheckRcsThrustersOrRepairShip, "Ship has no control authority."),
            new FailureReasonDefinition(FailureReasonCode.ROUTE_TIMEWARP_UNSTABLE, StatusAuthorityOwner.NavigationComputer, PlayerActionHint.SimplifyRoute, "Route is not deterministic at this timewarp."),
            new FailureReasonDefinition(FailureReasonCode.PLAN_INVALIDATED_OBSTACLE, StatusAuthorityOwner.NavigationComputer, PlayerActionHint.CreateNewPlan, "Plan invalid: new obstacle detected."),
            new FailureReasonDefinition(FailureReasonCode.PLAN_INVALIDATED_FUEL, StatusAuthorityOwner.NavigationComputer, PlayerActionHint.RefuelOrReplan, "Plan invalid: fuel exhausted."),
            new FailureReasonDefinition(FailureReasonCode.CARGO_CAPACITY_FULL, StatusAuthorityOwner.CargoService, PlayerActionHint.ChooseAnotherContainerOrOffload, "Target container is full."),
            new FailureReasonDefinition(FailureReasonCode.CARGO_CONTAINMENT_MISMATCH, StatusAuthorityOwner.CargoService, PlayerActionHint.ChoosePermittedContainer, "Resource is not permitted in this container."),
            new FailureReasonDefinition(FailureReasonCode.CARGO_TOO_HEAVY_FOR_SHIP, StatusAuthorityOwner.CargoService, PlayerActionHint.ReduceMass, "Cargo exceeds the ship limit."),
            new FailureReasonDefinition(FailureReasonCode.CARGO_TRANSFER_NO_ACCESS, StatusAuthorityOwner.CargoService, PlayerActionHint.AcquirePermit, "No access to this container."),
            new FailureReasonDefinition(FailureReasonCode.LEGAL_NO_PERMIT, StatusAuthorityOwner.FactionLegalService, PlayerActionHint.AcquirePermit, "No permit for this action in this zone."),
            new FailureReasonDefinition(FailureReasonCode.LEGAL_CONTRABAND, StatusAuthorityOwner.FactionLegalService, PlayerActionHint.OffloadOrLeaveZone, "Resource is prohibited in this zone."),
            new FailureReasonDefinition(FailureReasonCode.LEGAL_FACTION_HOSTILE, StatusAuthorityOwner.FactionLegalService, PlayerActionHint.AcceptRiskOrAbort, "Faction is hostile; action is risky."),
            new FailureReasonDefinition(FailureReasonCode.SCAN_NO_DETECTION, StatusAuthorityOwner.ScannerService, PlayerActionHint.MoveCloserOrUpgradeScanner, "No detection in range."),
            new FailureReasonDefinition(FailureReasonCode.SCAN_CONFIDENCE_TOO_LOW, StatusAuthorityOwner.ScannerService, PlayerActionHint.ScanCloser, "Detection is too uncertain for this action."),
            new FailureReasonDefinition(FailureReasonCode.SHIP_NO_MUZZLE, StatusAuthorityOwner.ShipAuthority, PlayerActionHint.RepairShip, "No functioning muzzle."),
            new FailureReasonDefinition(FailureReasonCode.SHIP_OUT_OF_ARC, StatusAuthorityOwner.ShipAuthority, PlayerActionHint.MoveTargetIntoArc, "Target is outside turret arc."),
            new FailureReasonDefinition(FailureReasonCode.SHIP_COOLDOWN, StatusAuthorityOwner.ShipAuthority, PlayerActionHint.WaitForCooldown, "Weapon is on cooldown."),
            new FailureReasonDefinition(FailureReasonCode.SUIT_OXYGEN_DEPLETED, StatusAuthorityOwner.SuitVitalsService, PlayerActionHint.ReturnToShipImmediately, "Oxygen depleted."),
            new FailureReasonDefinition(FailureReasonCode.BUILDER_NOT_SAFE_STATE, StatusAuthorityOwner.BuilderModeAuthority, PlayerActionHint.DockOrLandFirst, "Builder requires a safe or docked state.")
        };

        private static readonly IReadOnlyDictionary<FailureReasonCode, FailureReasonDefinition> s_lookup = BuildLookup(s_all);

        public FailureReasonCode Code { get; }
        public StatusAuthorityOwner Owner { get; }
        public PlayerActionHint ActionHint { get; }
        public string? PlayerTextKey { get; }
        public string FallbackText { get; }

        public static IReadOnlyList<FailureReasonDefinition> All => s_all;

        public FailureReasonDefinition(
            FailureReasonCode code,
            StatusAuthorityOwner owner,
            PlayerActionHint actionHint,
            string fallbackText,
            string? playerTextKey = null)
        {
            Code = StatusAuthorityContractGuards.RequireDefinedEnum(code, nameof(code));
            Owner = StatusAuthorityContractGuards.RequireDefinedEnum(owner, nameof(owner));
            ActionHint = StatusAuthorityContractGuards.RequireDefinedEnum(actionHint, nameof(actionHint));
            FallbackText = StatusAuthorityContractGuards.RequireRequiredText(fallbackText, nameof(fallbackText));
            PlayerTextKey = StatusAuthorityContractGuards.NormalizeOptionalText(playerTextKey);
        }

        public static FailureReasonDefinition GetDefinition(FailureReasonCode code)
        {
            StatusAuthorityContractGuards.RequireDefinedEnum(code, nameof(code));

            if (s_lookup.TryGetValue(code, out var definition))
            {
                return definition;
            }

            throw new KeyNotFoundException($"Failure reason definition not found for '{code}'.");
        }

        private static IReadOnlyDictionary<FailureReasonCode, FailureReasonDefinition> BuildLookup(IEnumerable<FailureReasonDefinition> definitions)
        {
            var lookup = new Dictionary<FailureReasonCode, FailureReasonDefinition>();

            foreach (var definition in definitions)
            {
                lookup.Add(definition.Code, definition);
            }

            return lookup;
        }
    }

    internal static class StatusAuthorityContractGuards
    {
        public static TEnum RequireDefinedEnum<TEnum>(TEnum value, string paramName)
            where TEnum : struct
        {
            if (!Enum.IsDefined(typeof(TEnum), value))
            {
                throw new ArgumentOutOfRangeException(paramName, value, $"Unknown {typeof(TEnum).Name} value.");
            }

            return value;
        }

        public static TEnum RequireExpectedEnum<TEnum>(TEnum value, TEnum expectedValue, string paramName)
            where TEnum : struct
        {
            RequireDefinedEnum(value, paramName);

            if (!EqualityComparer<TEnum>.Default.Equals(value, expectedValue))
            {
                throw new ArgumentException($"Value must be '{expectedValue}'.", paramName);
            }

            return value;
        }

        public static string RequireRequiredText(string? value, string paramName)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                throw new ArgumentException("Value must be provided.", paramName);
            }

            return value.Trim();
        }

        public static string? NormalizeOptionalText(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            return value.Trim();
        }

        public static IReadOnlyList<WarningChipCode> RequireKnownWarningChipCodes(IReadOnlyList<WarningChipCode>? values)
        {
            if (values == null || values.Count == 0)
            {
                return Array.Empty<WarningChipCode>();
            }

            var copy = new WarningChipCode[values.Count];
            for (var index = 0; index < values.Count; index++)
            {
                var code = values[index];
                WarningChipDefinition.GetDefinition(code);
                copy[index] = code;
            }

            return copy;
        }

        public static FailureReasonCode? RequireKnownFailureReasonCode(FailureReasonCode? value)
        {
            if (!value.HasValue)
            {
                return null;
            }

            FailureReasonDefinition.GetDefinition(value.Value);
            return value;
        }
    }
}
