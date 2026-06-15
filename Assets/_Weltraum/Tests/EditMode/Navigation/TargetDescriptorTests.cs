using System;
using NUnit.Framework;
using Weltraum.Navigation;
using Weltraum.Simulation;

namespace Weltraum.Tests.EditMode.Navigation
{
    public sealed class TargetDescriptorTests
    {
        [Test]
        public void Constructor_CreatesValidDescriptor()
        {
            var envelope = new ArrivalEnvelope(0.5f, 0.2f, 1.0f, 3.0f);
            var descriptor = new TargetDescriptor(
                TargetKind.Station,
                NavigationFrameKind.Local,
                new SpatialVector3(10f, 20f, 30f),
                envelope,
                new SpatialVector3(1f, 0f, 0f),
                new SpatialVector3(0f, 1f, 0f));

            Assert.That(descriptor.TargetKind, Is.EqualTo(TargetKind.Station));
            Assert.That(descriptor.FrameKind, Is.EqualTo(NavigationFrameKind.Local));
            Assert.That(descriptor.TargetPosition, Is.EqualTo(new SpatialVector3(10f, 20f, 30f)));
            Assert.That(descriptor.ArrivalEnvelope, Is.EqualTo(envelope));
            Assert.That(descriptor.DesiredVelocity.HasValue, Is.True);
            Assert.That(descriptor.DesiredVelocity.Value, Is.EqualTo(new SpatialVector3(1f, 0f, 0f)));
            Assert.That(descriptor.DesiredAttitude.HasValue, Is.True);
            Assert.That(descriptor.DesiredAttitude.Value, Is.EqualTo(new SpatialVector3(0f, 1f, 0f)));
        }

        [Test]
        public void Constructor_RejectsUnknownTargetKind()
        {
            var envelope = new ArrivalEnvelope(0.5f, 0.2f, 1.0f, 3.0f);

            Assert.That(
                () => new TargetDescriptor(TargetKind.Unknown, NavigationFrameKind.Local, new SpatialVector3(0f, 0f, 0f), envelope),
                Throws.TypeOf<ArgumentOutOfRangeException>());
        }

        [Test]
        public void Constructor_RejectsUnknownNavigationFrameKind()
        {
            var envelope = new ArrivalEnvelope(0.5f, 0.2f, 1.0f, 3.0f);

            Assert.That(
                () => new TargetDescriptor(TargetKind.Position, NavigationFrameKind.Unknown, new SpatialVector3(0f, 0f, 0f), envelope),
                Throws.TypeOf<ArgumentOutOfRangeException>());
        }

        [Test]
        public void Constructor_RejectsNullArrivalEnvelope()
        {
            Assert.That(
                () => new TargetDescriptor(TargetKind.Position, NavigationFrameKind.Local, new SpatialVector3(0f, 0f, 0f), null),
                Throws.TypeOf<ArgumentNullException>());
        }

        [Test]
        public void Constructor_RejectsNonFiniteTargetPosition()
        {
            Assert.That(
                () => new SpatialVector3(float.NaN, 0f, 0f),
                Throws.TypeOf<ArgumentOutOfRangeException>());
        }

        [Test]
        public void Constructor_RejectsInvalidOptionalAttitudeAndVelocityVectors()
        {
            var envelope = new ArrivalEnvelope(0.5f, 0.2f, 1.0f, 3.0f);

            Assert.That(
                () => new TargetDescriptor(TargetKind.Position, NavigationFrameKind.Local, new SpatialVector3(0f, 0f, 0f), envelope, desiredAttitude: new SpatialVector3(0f, 0f, 0f)),
                Throws.TypeOf<ArgumentOutOfRangeException>());

            Assert.That(
                () => new TargetDescriptor(TargetKind.Position, NavigationFrameKind.Local, new SpatialVector3(0f, 0f, 0f), envelope, desiredVelocity: new SpatialVector3(float.PositiveInfinity, 0f, 0f)),
                Throws.TypeOf<ArgumentOutOfRangeException>());
        }

        [Test]
        public void Equality_IsDeterministic()
        {
            var left = new TargetDescriptor(
                TargetKind.Vessel,
                NavigationFrameKind.World,
                new SpatialVector3(1f, 2f, 3f),
                new ArrivalEnvelope(0.5f, 0.25f, 1.0f, 2.0f),
                new SpatialVector3(4f, 5f, 6f),
                new SpatialVector3(0f, 1f, 0f));

            var right = new TargetDescriptor(
                TargetKind.Vessel,
                NavigationFrameKind.World,
                new SpatialVector3(1f, 2f, 3f),
                new ArrivalEnvelope(0.5f, 0.25f, 1.0f, 2.0f),
                new SpatialVector3(4f, 5f, 6f),
                new SpatialVector3(0f, 1f, 0f));

            Assert.That(left, Is.EqualTo(right));
        }
    }
}
