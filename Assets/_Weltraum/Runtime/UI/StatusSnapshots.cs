#nullable enable

using System;
using System.Collections.Generic;
namespace Weltraum.UI
{
    public sealed class NavigationStatusSnapshot
    {
        private const StatusAuthorityOwner ExpectedOwner = StatusAuthorityOwner.NavigationComputer;
        private readonly IReadOnlyList<WarningChipCode> _warningChipCodes;

        public StatusAuthorityOwner Owner { get; }
        public bool IsRouteValid { get; }
        public string? RouteValidityCode { get; }
        public string? ArrivalStateCode { get; }
        public double? EtaSeconds { get; }
        public double? FuelEstimate { get; }
        public double? BrakeReserve { get; }
        public FailureReasonCode? FailureReasonCode { get; }
        public IReadOnlyList<WarningChipCode> WarningChipCodes => _warningChipCodes;

        public NavigationStatusSnapshot(
            bool isRouteValid,
            string? routeValidityCode = null,
            string? arrivalStateCode = null,
            double? etaSeconds = null,
            double? fuelEstimate = null,
            double? brakeReserve = null,
            IReadOnlyList<WarningChipCode>? warningChipCodes = null,
            FailureReasonCode? failureReasonCode = null,
            StatusAuthorityOwner owner = ExpectedOwner)
        {
            Owner = StatusAuthorityContractGuards.RequireExpectedEnum(owner, ExpectedOwner, nameof(owner));
            IsRouteValid = isRouteValid;
            RouteValidityCode = StatusAuthorityContractGuards.NormalizeOptionalText(routeValidityCode);
            ArrivalStateCode = StatusAuthorityContractGuards.NormalizeOptionalText(arrivalStateCode);
            EtaSeconds = etaSeconds;
            FuelEstimate = fuelEstimate;
            BrakeReserve = brakeReserve;
            _warningChipCodes = StatusAuthorityContractGuards.RequireKnownWarningChipCodes(warningChipCodes);
            FailureReasonCode = StatusAuthorityContractGuards.RequireKnownFailureReasonCode(failureReasonCode);
        }
    }

    public sealed class CargoStatusSnapshot
    {
        private const StatusAuthorityOwner ExpectedOwner = StatusAuthorityOwner.CargoService;
        private readonly IReadOnlyList<WarningChipCode> _warningChipCodes;

        public StatusAuthorityOwner Owner { get; }
        public double CurrentMass { get; }
        public double? MaxMass { get; }
        public double CurrentVolume { get; }
        public double? MaxVolume { get; }
        public bool? TransferFeasible { get; }
        public string? TransferFeasibilityCode { get; }
        public string? ContainmentCode { get; }
        public FailureReasonCode? FailureReasonCode { get; }
        public IReadOnlyList<WarningChipCode> WarningChipCodes => _warningChipCodes;

        public CargoStatusSnapshot(
            double currentMass,
            double? maxMass = null,
            double currentVolume = 0d,
            double? maxVolume = null,
            bool? transferFeasible = null,
            string? transferFeasibilityCode = null,
            string? containmentCode = null,
            IReadOnlyList<WarningChipCode>? warningChipCodes = null,
            FailureReasonCode? failureReasonCode = null,
            StatusAuthorityOwner owner = ExpectedOwner)
        {
            Owner = StatusAuthorityContractGuards.RequireExpectedEnum(owner, ExpectedOwner, nameof(owner));
            CurrentMass = currentMass;
            MaxMass = maxMass;
            CurrentVolume = currentVolume;
            MaxVolume = maxVolume;
            TransferFeasible = transferFeasible;
            TransferFeasibilityCode = StatusAuthorityContractGuards.NormalizeOptionalText(transferFeasibilityCode);
            ContainmentCode = StatusAuthorityContractGuards.NormalizeOptionalText(containmentCode);
            _warningChipCodes = StatusAuthorityContractGuards.RequireKnownWarningChipCodes(warningChipCodes);
            FailureReasonCode = StatusAuthorityContractGuards.RequireKnownFailureReasonCode(failureReasonCode);
        }
    }

    public sealed class ScannerStatusSnapshot
    {
        private const StatusAuthorityOwner ExpectedOwner = StatusAuthorityOwner.ScannerService;
        private readonly string[] _hazardObservationCodes;
        private readonly string[] _ownershipHintCodes;
        private readonly IReadOnlyList<WarningChipCode> _warningChipCodes;

        public StatusAuthorityOwner Owner { get; }
        public string? DetectionConfidenceCode { get; }
        public IReadOnlyList<string> HazardObservationCodes => _hazardObservationCodes;
        public IReadOnlyList<string> OwnershipHintCodes => _ownershipHintCodes;
        public FailureReasonCode? FailureReasonCode { get; }
        public IReadOnlyList<WarningChipCode> WarningChipCodes => _warningChipCodes;

        public ScannerStatusSnapshot(
            string? detectionConfidenceCode = null,
            IReadOnlyList<string>? hazardObservationCodes = null,
            IReadOnlyList<string>? ownershipHintCodes = null,
            IReadOnlyList<WarningChipCode>? warningChipCodes = null,
            FailureReasonCode? failureReasonCode = null,
            StatusAuthorityOwner owner = ExpectedOwner)
        {
            Owner = StatusAuthorityContractGuards.RequireExpectedEnum(owner, ExpectedOwner, nameof(owner));
            DetectionConfidenceCode = StatusAuthorityContractGuards.NormalizeOptionalText(detectionConfidenceCode);
            _hazardObservationCodes = NormalizeCodes(hazardObservationCodes);
            _ownershipHintCodes = NormalizeCodes(ownershipHintCodes);
            _warningChipCodes = StatusAuthorityContractGuards.RequireKnownWarningChipCodes(warningChipCodes);
            FailureReasonCode = StatusAuthorityContractGuards.RequireKnownFailureReasonCode(failureReasonCode);
        }

        private static string[] NormalizeCodes(IReadOnlyList<string>? values)
        {
            if (values == null || values.Count == 0)
            {
                return Array.Empty<string>();
            }

            var copy = new List<string>(values.Count);
            for (var index = 0; index < values.Count; index++)
            {
                var normalized = StatusAuthorityContractGuards.NormalizeOptionalText(values[index]);
                if (normalized != null)
                {
                    copy.Add(normalized);
                }
            }

            return copy.Count == 0 ? Array.Empty<string>() : copy.ToArray();
        }
    }

    public sealed class FactionLegalStatusSnapshot
    {
        private const StatusAuthorityOwner ExpectedOwner = StatusAuthorityOwner.FactionLegalService;
        private readonly IReadOnlyList<WarningChipCode> _warningChipCodes;

        public StatusAuthorityOwner Owner { get; }
        public bool HasLicenseOrPermit { get; }
        public string? LicenseOrPermitCode { get; }
        public string? ActionLegalityCode { get; }
        public string? EnforcementRiskCode { get; }
        public FailureReasonCode? FailureReasonCode { get; }
        public IReadOnlyList<WarningChipCode> WarningChipCodes => _warningChipCodes;

        public FactionLegalStatusSnapshot(
            bool hasLicenseOrPermit,
            string? licenseOrPermitCode = null,
            string? actionLegalityCode = null,
            string? enforcementRiskCode = null,
            IReadOnlyList<WarningChipCode>? warningChipCodes = null,
            FailureReasonCode? failureReasonCode = null,
            StatusAuthorityOwner owner = ExpectedOwner)
        {
            Owner = StatusAuthorityContractGuards.RequireExpectedEnum(owner, ExpectedOwner, nameof(owner));
            HasLicenseOrPermit = hasLicenseOrPermit;
            LicenseOrPermitCode = StatusAuthorityContractGuards.NormalizeOptionalText(licenseOrPermitCode);
            ActionLegalityCode = StatusAuthorityContractGuards.NormalizeOptionalText(actionLegalityCode);
            EnforcementRiskCode = StatusAuthorityContractGuards.NormalizeOptionalText(enforcementRiskCode);
            _warningChipCodes = StatusAuthorityContractGuards.RequireKnownWarningChipCodes(warningChipCodes);
            FailureReasonCode = StatusAuthorityContractGuards.RequireKnownFailureReasonCode(failureReasonCode);
        }
    }

    public sealed class ShipAuthorityStatusSnapshot
    {
        private const StatusAuthorityOwner ExpectedOwner = StatusAuthorityOwner.ShipAuthority;
        private readonly IReadOnlyList<WarningChipCode> _warningChipCodes;

        public StatusAuthorityOwner Owner { get; }
        public bool HasFlightAuthority { get; }
        public bool HasManualOverride { get; }
        public string? AutopilotStateCode { get; }
        public FailureReasonCode? FailureReasonCode { get; }
        public IReadOnlyList<WarningChipCode> WarningChipCodes => _warningChipCodes;

        public ShipAuthorityStatusSnapshot(
            bool hasFlightAuthority,
            bool hasManualOverride,
            string? autopilotStateCode = null,
            IReadOnlyList<WarningChipCode>? warningChipCodes = null,
            FailureReasonCode? failureReasonCode = null,
            StatusAuthorityOwner owner = ExpectedOwner)
        {
            Owner = StatusAuthorityContractGuards.RequireExpectedEnum(owner, ExpectedOwner, nameof(owner));
            HasFlightAuthority = hasFlightAuthority;
            HasManualOverride = hasManualOverride;
            AutopilotStateCode = StatusAuthorityContractGuards.NormalizeOptionalText(autopilotStateCode);
            _warningChipCodes = StatusAuthorityContractGuards.RequireKnownWarningChipCodes(warningChipCodes);
            FailureReasonCode = StatusAuthorityContractGuards.RequireKnownFailureReasonCode(failureReasonCode);
        }
    }

    public sealed class SuitVitalsStatusSnapshot
    {
        private const StatusAuthorityOwner ExpectedOwner = StatusAuthorityOwner.SuitVitalsService;
        private readonly IReadOnlyList<WarningChipCode> _warningChipCodes;

        public StatusAuthorityOwner Owner { get; }
        public double? HealthPercent { get; }
        public double? OxygenPercent { get; }
        public double? EnergyPercent { get; }
        public string? TemperatureCode { get; }
        public string? RadiationCode { get; }
        public string? PressureCode { get; }
        public string? ToolStatusCode { get; }
        public bool? HasShipBeacon { get; }
        public FailureReasonCode? FailureReasonCode { get; }
        public IReadOnlyList<WarningChipCode> WarningChipCodes => _warningChipCodes;

        public SuitVitalsStatusSnapshot(
            double? healthPercent = null,
            double? oxygenPercent = null,
            double? energyPercent = null,
            string? temperatureCode = null,
            string? radiationCode = null,
            string? pressureCode = null,
            string? toolStatusCode = null,
            bool? hasShipBeacon = null,
            IReadOnlyList<WarningChipCode>? warningChipCodes = null,
            FailureReasonCode? failureReasonCode = null,
            StatusAuthorityOwner owner = ExpectedOwner)
        {
            Owner = StatusAuthorityContractGuards.RequireExpectedEnum(owner, ExpectedOwner, nameof(owner));
            HealthPercent = healthPercent;
            OxygenPercent = oxygenPercent;
            EnergyPercent = energyPercent;
            TemperatureCode = StatusAuthorityContractGuards.NormalizeOptionalText(temperatureCode);
            RadiationCode = StatusAuthorityContractGuards.NormalizeOptionalText(radiationCode);
            PressureCode = StatusAuthorityContractGuards.NormalizeOptionalText(pressureCode);
            ToolStatusCode = StatusAuthorityContractGuards.NormalizeOptionalText(toolStatusCode);
            HasShipBeacon = hasShipBeacon;
            _warningChipCodes = StatusAuthorityContractGuards.RequireKnownWarningChipCodes(warningChipCodes);
            FailureReasonCode = StatusAuthorityContractGuards.RequireKnownFailureReasonCode(failureReasonCode);
        }
    }

    public sealed class PlayerFacingStatusSnapshot
    {
        public NavigationStatusSnapshot? Navigation { get; }
        public CargoStatusSnapshot? Cargo { get; }
        public ScannerStatusSnapshot? Scanner { get; }
        public FactionLegalStatusSnapshot? FactionLegal { get; }
        public ShipAuthorityStatusSnapshot? ShipAuthority { get; }
        public SuitVitalsStatusSnapshot? SuitVitals { get; }

        public PlayerFacingStatusSnapshot(
            NavigationStatusSnapshot? navigation = null,
            CargoStatusSnapshot? cargo = null,
            ScannerStatusSnapshot? scanner = null,
            FactionLegalStatusSnapshot? factionLegal = null,
            ShipAuthorityStatusSnapshot? shipAuthority = null,
            SuitVitalsStatusSnapshot? suitVitals = null)
        {
            Navigation = navigation;
            Cargo = cargo;
            Scanner = scanner;
            FactionLegal = factionLegal;
            ShipAuthority = shipAuthority;
            SuitVitals = suitVitals;
        }

        public IReadOnlyList<WarningChipCode> GetOrderedWarningChipCodes()
        {
            var warningChipCodes = new List<WarningChipCode>();
            var seenCodes = new HashSet<WarningChipCode>();

            AddWarningCodes(warningChipCodes, seenCodes, Navigation?.WarningChipCodes);
            AddWarningCodes(warningChipCodes, seenCodes, Cargo?.WarningChipCodes);
            AddWarningCodes(warningChipCodes, seenCodes, Scanner?.WarningChipCodes);
            AddWarningCodes(warningChipCodes, seenCodes, FactionLegal?.WarningChipCodes);
            AddWarningCodes(warningChipCodes, seenCodes, ShipAuthority?.WarningChipCodes);
            AddWarningCodes(warningChipCodes, seenCodes, SuitVitals?.WarningChipCodes);

            warningChipCodes.Sort(CompareWarningsBySeverityDescending);
            return warningChipCodes.AsReadOnly();
        }

        private static void AddWarningCodes(List<WarningChipCode> target, HashSet<WarningChipCode> seenCodes, IReadOnlyList<WarningChipCode>? source)
        {
            if (source == null || source.Count == 0)
            {
                return;
            }

            for (var index = 0; index < source.Count; index++)
            {
                var warningChipCode = source[index];
                if (seenCodes.Add(warningChipCode))
                {
                    target.Add(warningChipCode);
                }
            }
        }

        private static int CompareWarningsBySeverityDescending(WarningChipCode left, WarningChipCode right)
        {
            var leftSeverity = WarningChipDefinition.GetDefinition(left).Severity;
            var rightSeverity = WarningChipDefinition.GetDefinition(right).Severity;

            var severityComparison = rightSeverity.CompareTo(leftSeverity);
            if (severityComparison != 0)
            {
                return severityComparison;
            }

            return left.CompareTo(right);
        }
    }
}
