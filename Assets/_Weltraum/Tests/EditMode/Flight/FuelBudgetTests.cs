using System;
using NUnit.Framework;
using Weltraum.Flight;

namespace Weltraum.Tests.EditMode.Flight
{
    public sealed class FuelBudgetTests
    {
        [Test]
        public void Constructor_CreatesValidBudget()
        {
            var budget = new FuelBudget(100f, 60f, 20f);

            Assert.That(budget.AvailableFuelUnits, Is.EqualTo(100f));
            Assert.That(budget.RequiredFuelUnits, Is.EqualTo(60f));
            Assert.That(budget.ReserveFuelUnits, Is.EqualTo(20f));
            Assert.That(budget.RemainingFuelUnits, Is.EqualTo(20f));
        }

        [Test]
        public void Constructor_RejectsNegativeOrInsufficientFuel()
        {
            Assert.That(
                () => new FuelBudget(-1f, 60f, 20f),
                Throws.TypeOf<ArgumentOutOfRangeException>());

            Assert.That(
                () => new FuelBudget(100f, 60f, 50f),
                Throws.TypeOf<ArgumentOutOfRangeException>());
        }

        [Test]
        public void Constructor_RejectsNaNAndInfinityForFuelValues()
        {
            Assert.That(
                () => new FuelBudget(float.NaN, 60f, 20f),
                Throws.TypeOf<ArgumentOutOfRangeException>());

            Assert.That(
                () => new FuelBudget(100f, float.PositiveInfinity, 20f),
                Throws.TypeOf<ArgumentOutOfRangeException>());

            Assert.That(
                () => new FuelBudget(100f, 60f, float.NaN),
                Throws.TypeOf<ArgumentOutOfRangeException>());
        }

        [Test]
        public void Equality_IsDeterministic()
        {
            var left = new FuelBudget(100f, 60f, 20f);
            var right = new FuelBudget(100f, 60f, 20f);

            Assert.That(left, Is.EqualTo(right));
        }
    }
}
