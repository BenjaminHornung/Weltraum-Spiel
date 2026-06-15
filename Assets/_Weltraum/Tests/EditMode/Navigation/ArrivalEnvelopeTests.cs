using System;
using NUnit.Framework;
using Weltraum.Navigation;

namespace Weltraum.Tests.EditMode.Navigation
{
    public sealed class ArrivalEnvelopeTests
    {
        [Test]
        public void Constructor_CreatesValidEnvelope()
        {
            var envelope = new ArrivalEnvelope(0.01f, 0.2f, 1.5f, 3.0f);

            Assert.That(envelope.PositionToleranceMeters, Is.EqualTo(0.01f));
            Assert.That(envelope.SpeedToleranceMetersPerSecond, Is.EqualTo(0.2f));
            Assert.That(envelope.AngularSpeedToleranceDegreesPerSecond, Is.EqualTo(1.5f));
            Assert.That(envelope.HoldDurationSeconds, Is.EqualTo(3.0f));
        }

        [Test]
        public void Constructor_RejectsTooSmallPositionGate()
        {
            Assert.That(
                () => new ArrivalEnvelope(0.009f, 0.2f, 1.5f, 3.0f),
                Throws.TypeOf<ArgumentOutOfRangeException>());
        }

        [Test]
        public void Constructor_RejectsNegativeToleranceValues()
        {
            Assert.That(
                () => new ArrivalEnvelope(0.1f, -0.2f, 1.5f, 3.0f),
                Throws.TypeOf<ArgumentOutOfRangeException>());
        }

        [Test]
        public void Constructor_RejectsNaNAndInfinityForEnvelopeGates()
        {
            Assert.That(
                () => new ArrivalEnvelope(float.NaN, 0.2f, 1.5f, 3.0f),
                Throws.TypeOf<ArgumentOutOfRangeException>());

            Assert.That(
                () => new ArrivalEnvelope(0.1f, float.PositiveInfinity, 1.5f, 3.0f),
                Throws.TypeOf<ArgumentOutOfRangeException>());

            Assert.That(
                () => new ArrivalEnvelope(0.1f, 0.2f, float.NaN, 3.0f),
                Throws.TypeOf<ArgumentOutOfRangeException>());

            Assert.That(
                () => new ArrivalEnvelope(0.1f, 0.2f, 1.5f, float.PositiveInfinity),
                Throws.TypeOf<ArgumentOutOfRangeException>());
        }

        [Test]
        public void Equality_IsDeterministic()
        {
            var left = new ArrivalEnvelope(0.5f, 0.25f, 1.0f, 2.0f);
            var right = new ArrivalEnvelope(0.5f, 0.25f, 1.0f, 2.0f);

            Assert.That(left, Is.EqualTo(right));
        }
    }
}
