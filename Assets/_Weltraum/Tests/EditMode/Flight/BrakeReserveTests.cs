using System;
using NUnit.Framework;
using Weltraum.Flight;

namespace Weltraum.Tests.EditMode.Flight
{
    public sealed class BrakeReserveTests
    {
        [Test]
        public void Constructor_CreatesValidBrakeReserve()
        {
            var reserve = new BrakeReserve(50f, 20f, 10f);

            Assert.That(reserve.AvailableBrakeUnits, Is.EqualTo(50f));
            Assert.That(reserve.RequiredBrakeUnits, Is.EqualTo(20f));
            Assert.That(reserve.ReserveBrakeUnits, Is.EqualTo(10f));
            Assert.That(reserve.RemainingBrakeUnits, Is.EqualTo(20f));
        }

        [Test]
        public void Constructor_RejectsNegativeOrInsufficientBrakeCapacity()
        {
            Assert.That(
                () => new BrakeReserve(-1f, 20f, 10f),
                Throws.TypeOf<ArgumentOutOfRangeException>());

            Assert.That(
                () => new BrakeReserve(50f, 20f, 40f),
                Throws.TypeOf<ArgumentOutOfRangeException>());
        }

        [Test]
        public void Constructor_RejectsNaNAndInfinityForBrakeValues()
        {
            Assert.That(
                () => new BrakeReserve(float.NaN, 20f, 10f),
                Throws.TypeOf<ArgumentOutOfRangeException>());

            Assert.That(
                () => new BrakeReserve(50f, float.PositiveInfinity, 10f),
                Throws.TypeOf<ArgumentOutOfRangeException>());

            Assert.That(
                () => new BrakeReserve(50f, 20f, float.NaN),
                Throws.TypeOf<ArgumentOutOfRangeException>());
        }

        [Test]
        public void Equality_IsDeterministic()
        {
            var left = new BrakeReserve(50f, 20f, 10f);
            var right = new BrakeReserve(50f, 20f, 10f);

            Assert.That(left, Is.EqualTo(right));
        }
    }
}
