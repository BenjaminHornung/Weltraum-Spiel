using System;
using NUnit.Framework;
using Weltraum.Navigation;
using Weltraum.Simulation;

namespace Weltraum.Tests.EditMode.Navigation
{
    public sealed class RouteSegmentTests
    {
        [Test]
        public void Constructor_CreatesValidSegment()
        {
            var segment = new RouteSegment(
                SegmentKind.Cruise,
                new SpatialVector3(0f, 0f, 0f),
                new SpatialVector3(1f, 2f, 3f),
                42f,
                6f);

            Assert.That(segment.SegmentKind, Is.EqualTo(SegmentKind.Cruise));
            Assert.That(segment.StartPosition, Is.EqualTo(new SpatialVector3(0f, 0f, 0f)));
            Assert.That(segment.EndPosition, Is.EqualTo(new SpatialVector3(1f, 2f, 3f)));
            Assert.That(segment.DistanceMeters, Is.EqualTo(42f));
            Assert.That(segment.DurationSeconds, Is.EqualTo(6f));
        }

        [Test]
        public void Constructor_RejectsNonFiniteVectorComponents()
        {
            Assert.That(
                () => new RouteSegment(SegmentKind.Cruise, new SpatialVector3(float.PositiveInfinity, 0f, 0f), new SpatialVector3(1f, 2f, 3f), 42f, 6f),
                Throws.TypeOf<ArgumentOutOfRangeException>());
        }

        [Test]
        public void Constructor_RejectsNegativeDistanceAndDuration()
        {
            Assert.That(
                () => new RouteSegment(SegmentKind.Cruise, new SpatialVector3(0f, 0f, 0f), new SpatialVector3(1f, 2f, 3f), -1f, 6f),
                Throws.TypeOf<ArgumentOutOfRangeException>());

            Assert.That(
                () => new RouteSegment(SegmentKind.Cruise, new SpatialVector3(0f, 0f, 0f), new SpatialVector3(1f, 2f, 3f), 1f, -6f),
                Throws.TypeOf<ArgumentOutOfRangeException>());
        }

        [Test]
        public void Constructor_RejectsNaNAndInfinityForDistanceOrDuration()
        {
            Assert.That(
                () => new RouteSegment(SegmentKind.Cruise, new SpatialVector3(0f, 0f, 0f), new SpatialVector3(1f, 2f, 3f), float.NaN, 6f),
                Throws.TypeOf<ArgumentOutOfRangeException>());

            Assert.That(
                () => new RouteSegment(SegmentKind.Cruise, new SpatialVector3(0f, 0f, 0f), new SpatialVector3(1f, 2f, 3f), 1f, float.PositiveInfinity),
                Throws.TypeOf<ArgumentOutOfRangeException>());
        }

        [Test]
        public void Constructor_RejectsUnknownSegmentKind()
        {
            Assert.That(
                () => new RouteSegment(SegmentKind.Unknown, new SpatialVector3(0f, 0f, 0f), new SpatialVector3(1f, 2f, 3f), 1f, 6f),
                Throws.TypeOf<ArgumentOutOfRangeException>());
        }

        [Test]
        public void Equality_IsDeterministic()
        {
            var left = new RouteSegment(SegmentKind.Approach, new SpatialVector3(1f, 2f, 3f), new SpatialVector3(4f, 5f, 6f), 10f, 2f);
            var right = new RouteSegment(SegmentKind.Approach, new SpatialVector3(1f, 2f, 3f), new SpatialVector3(4f, 5f, 6f), 10f, 2f);

            Assert.That(left, Is.EqualTo(right));
        }
    }
}
