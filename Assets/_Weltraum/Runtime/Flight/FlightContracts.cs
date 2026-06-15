using System;
using Weltraum.Simulation;

namespace Weltraum.Flight
{
    [Serializable]
    public sealed class FuelBudget : IEquatable<FuelBudget>
    {
        public FuelBudget(float availableFuelUnits, float requiredFuelUnits, float reserveFuelUnits)
        {
            AvailableFuelUnits = ContractValidation.EnsureFiniteNonNegative(availableFuelUnits, nameof(availableFuelUnits));
            RequiredFuelUnits = ContractValidation.EnsureFiniteNonNegative(requiredFuelUnits, nameof(requiredFuelUnits));
            ReserveFuelUnits = ContractValidation.EnsureFiniteNonNegative(reserveFuelUnits, nameof(reserveFuelUnits));

            if (AvailableFuelUnits < RequiredFuelUnits + ReserveFuelUnits)
            {
                throw new ArgumentOutOfRangeException(nameof(availableFuelUnits), availableFuelUnits, "Available fuel must cover the required amount plus reserve.");
            }

            RemainingFuelUnits = AvailableFuelUnits - RequiredFuelUnits - ReserveFuelUnits;
        }

        public float AvailableFuelUnits { get; }

        public float RequiredFuelUnits { get; }

        public float ReserveFuelUnits { get; }

        public float RemainingFuelUnits { get; }

        public bool Equals(FuelBudget other)
        {
            return other != null
                   && AvailableFuelUnits == other.AvailableFuelUnits
                   && RequiredFuelUnits == other.RequiredFuelUnits
                   && ReserveFuelUnits == other.ReserveFuelUnits
                   && RemainingFuelUnits == other.RemainingFuelUnits;
        }

        public override bool Equals(object obj)
        {
            return obj is FuelBudget other && Equals(other);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                var hash = 17;
                hash = hash * 31 + AvailableFuelUnits.GetHashCode();
                hash = hash * 31 + RequiredFuelUnits.GetHashCode();
                hash = hash * 31 + ReserveFuelUnits.GetHashCode();
                hash = hash * 31 + RemainingFuelUnits.GetHashCode();
                return hash;
            }
        }
    }

    [Serializable]
    public sealed class BrakeReserve : IEquatable<BrakeReserve>
    {
        public BrakeReserve(float availableBrakeUnits, float requiredBrakeUnits, float reserveBrakeUnits)
        {
            AvailableBrakeUnits = ContractValidation.EnsureFiniteNonNegative(availableBrakeUnits, nameof(availableBrakeUnits));
            RequiredBrakeUnits = ContractValidation.EnsureFiniteNonNegative(requiredBrakeUnits, nameof(requiredBrakeUnits));
            ReserveBrakeUnits = ContractValidation.EnsureFiniteNonNegative(reserveBrakeUnits, nameof(reserveBrakeUnits));

            if (AvailableBrakeUnits < RequiredBrakeUnits + ReserveBrakeUnits)
            {
                throw new ArgumentOutOfRangeException(nameof(availableBrakeUnits), availableBrakeUnits, "Available brake capacity must cover the required amount plus reserve.");
            }

            RemainingBrakeUnits = AvailableBrakeUnits - RequiredBrakeUnits - ReserveBrakeUnits;
        }

        public float AvailableBrakeUnits { get; }

        public float RequiredBrakeUnits { get; }

        public float ReserveBrakeUnits { get; }

        public float RemainingBrakeUnits { get; }

        public bool Equals(BrakeReserve other)
        {
            return other != null
                   && AvailableBrakeUnits == other.AvailableBrakeUnits
                   && RequiredBrakeUnits == other.RequiredBrakeUnits
                   && ReserveBrakeUnits == other.ReserveBrakeUnits
                   && RemainingBrakeUnits == other.RemainingBrakeUnits;
        }

        public override bool Equals(object obj)
        {
            return obj is BrakeReserve other && Equals(other);
        }

        public override int GetHashCode()
        {
            unchecked
            {
                var hash = 17;
                hash = hash * 31 + AvailableBrakeUnits.GetHashCode();
                hash = hash * 31 + RequiredBrakeUnits.GetHashCode();
                hash = hash * 31 + ReserveBrakeUnits.GetHashCode();
                hash = hash * 31 + RemainingBrakeUnits.GetHashCode();
                return hash;
            }
        }
    }
}
