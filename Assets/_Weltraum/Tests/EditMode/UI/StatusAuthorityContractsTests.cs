#nullable enable

using System;
using System.Linq;
using NUnit.Framework;
using Weltraum.UI;

namespace Weltraum.Tests.EditMode.UI
{
    public sealed class StatusAuthorityContractsTests
    {
        [Test]
        public void WarningChips_HaveOwnersSeveritiesAndDismissibility()
        {
            var definitions = WarningChipDefinition.All;

            Assert.That(definitions.Count, Is.EqualTo(18));
            Assert.That(definitions.Select(definition => definition.Code).Distinct().Count(), Is.EqualTo(definitions.Count));

            foreach (var definition in definitions)
            {
                Assert.That(Enum.IsDefined(typeof(StatusAuthorityOwner), definition.Owner), Is.True, definition.Code.ToString());
                Assert.That(Enum.IsDefined(typeof(StatusSeverity), definition.Severity), Is.True, definition.Code.ToString());
                Assert.That(definition.ActionHint, Is.Not.EqualTo(default(PlayerActionHint)), definition.Code.ToString());
                Assert.That(definition.FallbackText, Is.Not.Null.And.Not.Empty, definition.Code.ToString());
                Assert.That(definition.IsDismissible, Is.EqualTo(definition.Severity == StatusSeverity.Low), definition.Code.ToString());
            }
        }

        [Test]
        public void FailureReasons_HaveOwnersTextAndActionHints()
        {
            var definitions = FailureReasonDefinition.All;

            Assert.That(definitions.Count, Is.EqualTo(22));
            Assert.That(definitions.Select(definition => definition.Code).Distinct().Count(), Is.EqualTo(definitions.Count));

            foreach (var definition in definitions)
            {
                Assert.That(Enum.IsDefined(typeof(StatusAuthorityOwner), definition.Owner), Is.True, definition.Code.ToString());
                Assert.That(definition.ActionHint, Is.Not.EqualTo(default(PlayerActionHint)), definition.Code.ToString());
                Assert.That(definition.FallbackText, Is.Not.Null.And.Not.Empty, definition.Code.ToString());
            }
        }

        [Test]
        public void AmbiguousOwnershipRows_UsePrimaryDomainOwner()
        {
            Assert.That(
                WarningChipDefinition.GetDefinition(WarningChipCode.NAV_NO_AUTHORITY).Owner,
                Is.EqualTo(StatusAuthorityOwner.NavigationComputer));

            Assert.That(
                FailureReasonDefinition.GetDefinition(FailureReasonCode.BUILDER_NOT_SAFE_STATE).Owner,
                Is.EqualTo(StatusAuthorityOwner.BuilderModeAuthority));
        }

        [Test]
        public void PlayerFacingStatusSnapshot_SortsWarningsFromCriticalToLow()
        {
            var snapshot = new PlayerFacingStatusSnapshot(
                navigation: new NavigationStatusSnapshot(
                    isRouteValid: true,
                    routeValidityCode: "VALID",
                    arrivalStateCode: "EN_ROUTE",
                    etaSeconds: 300d,
                    fuelEstimate: 42d,
                    brakeReserve: 8d,
                    warningChipCodes: new[] { WarningChipCode.SCAN_CONFIDENCE_LOW, WarningChipCode.NAV_FUEL_INSUFFICIENT }),
                cargo: new CargoStatusSnapshot(
                    currentMass: 12.5d,
                    maxMass: 20d,
                    currentVolume: 3.75d,
                    maxVolume: 10d,
                    transferFeasible: true,
                    transferFeasibilityCode: "OK",
                    containmentCode: "OK",
                    warningChipCodes: new[] { WarningChipCode.CARGO_TRANSFER_BLOCKED, WarningChipCode.NAV_FUEL_INSUFFICIENT }),
                scanner: new ScannerStatusSnapshot(
                    detectionConfidenceCode: "LOW",
                    hazardObservationCodes: Array.Empty<string>(),
                    ownershipHintCodes: Array.Empty<string>()),
                factionLegal: new FactionLegalStatusSnapshot(
                    hasLicenseOrPermit: false,
                    licenseOrPermitCode: "NONE",
                    actionLegalityCode: "RESTRICTED",
                    enforcementRiskCode: "MEDIUM"),
                shipAuthority: new ShipAuthorityStatusSnapshot(
                    hasFlightAuthority: false,
                    hasManualOverride: false,
                    autopilotStateCode: "BLOCKED",
                    warningChipCodes: new[] { WarningChipCode.NAV_PLAN_INVALIDATED }),
                suitVitals: new SuitVitalsStatusSnapshot(
                    healthPercent: 1d,
                    oxygenPercent: 0.2d,
                    energyPercent: 0.9d,
                    temperatureCode: "NORMAL",
                    radiationCode: "LOW",
                    pressureCode: "NORMAL",
                    toolStatusCode: "READY",
                    hasShipBeacon: true));

            var ordered = snapshot.GetOrderedWarningChipCodes().ToArray();

            Assert.That(ordered, Is.EqualTo(new[]
            {
                WarningChipCode.NAV_FUEL_INSUFFICIENT,
                WarningChipCode.NAV_PLAN_INVALIDATED,
                WarningChipCode.CARGO_TRANSFER_BLOCKED,
                WarningChipCode.SCAN_CONFIDENCE_LOW
            }));
        }

        [Test]
        public void ScannerStatusSnapshot_FiltersWhitespaceCodes()
        {
            var snapshot = new ScannerStatusSnapshot(
                detectionConfidenceCode: "  LOW  ",
                hazardObservationCodes: new[] { " HAZARD_A ", " ", null!, "\t", "HAZARD_B" },
                ownershipHintCodes: new[] { null!, "  OWNERSHIP  ", "" });

            Assert.That(snapshot.DetectionConfidenceCode, Is.EqualTo("LOW"));
            Assert.That(snapshot.HazardObservationCodes, Is.EqualTo(new[] { "HAZARD_A", "HAZARD_B" }));
            Assert.That(snapshot.OwnershipHintCodes, Is.EqualTo(new[] { "OWNERSHIP" }));
        }

        [Test]
        public void DefinitionConstructors_NormalizePlayerTextKeys()
        {
            var warningDefinition = new WarningChipDefinition(
                WarningChipCode.NAV_FUEL_INSUFFICIENT,
                StatusAuthorityOwner.NavigationComputer,
                StatusSeverity.Critical,
                PlayerActionHint.RefuelOrShortenRoute,
                "Fuel insufficient",
                "  ui.warning.fuel  ");

            var failureDefinition = new FailureReasonDefinition(
                FailureReasonCode.ROUTE_FUEL_INSUFFICIENT,
                StatusAuthorityOwner.NavigationComputer,
                PlayerActionHint.RefuelOrShortenRoute,
                "Not enough fuel",
                "\tui.failure.fuel\n");

            Assert.That(warningDefinition.PlayerTextKey, Is.EqualTo("ui.warning.fuel"));
            Assert.That(failureDefinition.PlayerTextKey, Is.EqualTo("ui.failure.fuel"));
        }

        [Test]
        public void DomainSnapshots_ExposeExpectedAuthorityOwners()
        {
            Assert.That(new NavigationStatusSnapshot(isRouteValid: true).Owner, Is.EqualTo(StatusAuthorityOwner.NavigationComputer));
            Assert.That(new CargoStatusSnapshot(currentMass: 1d).Owner, Is.EqualTo(StatusAuthorityOwner.CargoService));
            Assert.That(new ScannerStatusSnapshot().Owner, Is.EqualTo(StatusAuthorityOwner.ScannerService));
            Assert.That(new FactionLegalStatusSnapshot(hasLicenseOrPermit: true).Owner, Is.EqualTo(StatusAuthorityOwner.FactionLegalService));
            Assert.That(new ShipAuthorityStatusSnapshot(hasFlightAuthority: true, hasManualOverride: false).Owner, Is.EqualTo(StatusAuthorityOwner.ShipAuthority));
            Assert.That(new SuitVitalsStatusSnapshot().Owner, Is.EqualTo(StatusAuthorityOwner.SuitVitalsService));
        }

        [Test]
        public void DomainSnapshots_RejectWrongOrUnknownAuthorityOwners()
        {
            Assert.That(
                () => new NavigationStatusSnapshot(isRouteValid: true, owner: StatusAuthorityOwner.BuilderModeAuthority),
                Throws.TypeOf<ArgumentException>());

            Assert.That(
                () => new CargoStatusSnapshot(currentMass: 1d, owner: StatusAuthorityOwner.BuilderModeAuthority),
                Throws.TypeOf<ArgumentException>());

            Assert.That(
                () => new ScannerStatusSnapshot(owner: StatusAuthorityOwner.BuilderModeAuthority),
                Throws.TypeOf<ArgumentException>());

            Assert.That(
                () => new FactionLegalStatusSnapshot(hasLicenseOrPermit: true, owner: StatusAuthorityOwner.BuilderModeAuthority),
                Throws.TypeOf<ArgumentException>());

            Assert.That(
                () => new ShipAuthorityStatusSnapshot(hasFlightAuthority: true, hasManualOverride: false, owner: StatusAuthorityOwner.BuilderModeAuthority),
                Throws.TypeOf<ArgumentException>());

            Assert.That(
                () => new SuitVitalsStatusSnapshot(owner: StatusAuthorityOwner.BuilderModeAuthority),
                Throws.TypeOf<ArgumentException>());

            Assert.That(
                () => new NavigationStatusSnapshot(isRouteValid: true, owner: (StatusAuthorityOwner)999),
                Throws.TypeOf<ArgumentOutOfRangeException>());
        }

        [Test]
        public void DomainSnapshots_RejectUnknownWarningAndFailureCodes()
        {
            Assert.That(
                () => new NavigationStatusSnapshot(
                    isRouteValid: true,
                    warningChipCodes: new[] { (WarningChipCode)999 }),
                Throws.TypeOf<ArgumentOutOfRangeException>());

            Assert.That(
                () => new NavigationStatusSnapshot(
                    isRouteValid: true,
                    failureReasonCode: (FailureReasonCode)999),
                Throws.TypeOf<ArgumentOutOfRangeException>());

            Assert.That(
                () => new SuitVitalsStatusSnapshot(
                    warningChipCodes: new[] { (WarningChipCode)999 }),
                Throws.TypeOf<ArgumentOutOfRangeException>());
        }

        [Test]
        public void InvalidOwner_IsRejectedByDefinitionConstructor()
        {
            Assert.That(
                () => new WarningChipDefinition(
                    WarningChipCode.NAV_FUEL_INSUFFICIENT,
                    (StatusAuthorityOwner)999,
                    StatusSeverity.Critical,
                    PlayerActionHint.RefuelOrShortenRoute,
                    "Fuel insufficient"),
                Throws.TypeOf<ArgumentOutOfRangeException>());
        }

        [Test]
        public void Contracts_DoNotReferencePrototypeOrUnityEngineAssemblies()
        {
            var contractTypes = typeof(PlayerFacingStatusSnapshot)
                .Assembly
                .GetTypes()
                .Where(type => type.Namespace == typeof(PlayerFacingStatusSnapshot).Namespace)
                .ToArray();

            Assert.That(contractTypes.Any(type => type.Name.Contains("Prototype", StringComparison.OrdinalIgnoreCase) || (type.FullName?.Contains("Prototype", StringComparison.OrdinalIgnoreCase) ?? false)), Is.False);

            foreach (var type in contractTypes.Where(type => type.IsClass))
            {
                Assert.That(typeof(UnityEngine.MonoBehaviour).IsAssignableFrom(type), Is.False, type.FullName);
                Assert.That(typeof(UnityEngine.Component).IsAssignableFrom(type), Is.False, type.FullName);
            }
        }
    }
}
