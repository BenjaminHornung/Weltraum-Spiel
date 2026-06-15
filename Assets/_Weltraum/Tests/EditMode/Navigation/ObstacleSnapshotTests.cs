using System;
using NUnit.Framework;
using Weltraum.Navigation;
using Weltraum.Simulation;

namespace Weltraum.Tests.EditMode.Navigation
{
    public sealed class ObstacleSnapshotTests
    {
        [Test]
        public void Constructor_CreatesValidObstacleSnapshot()
        {
            var obstacle = new ObstacleSnapshot(
                "asteroid-1",
                ObstacleKind.Debris,
                new SpatialVector3(1f, 2f, 3f),
                new SpatialVector3(4f, 5f, 6f),
                new SpatialVector3(0f, 0f, 0f),
                1.5f,
                2.0f,
                0.4f,
                0.8f);

            Assert.That(obstacle.Id, Is.EqualTo("asteroid-1"));
            Assert.That(obstacle.ObstacleKind, Is.EqualTo(ObstacleKind.Debris));
            Assert.That(obstacle.HardRadiusMeters, Is.EqualTo(1.5f));
            Assert.That(obstacle.ClearanceRadiusMeters, Is.EqualTo(2.0f));
        }

        [Test]
        public void Constructor_RejectsEmptyIdAndInvalidRadius()
        {
            Assert.That(
                () => new ObstacleSnapshot(string.Empty, ObstacleKind.Debris, new SpatialVector3(1f, 2f, 3f), new SpatialVector3(4f, 5f, 6f), new SpatialVector3(0f, 0f, 0f), 1.5f, 2.0f, 0.4f, 0.8f),
                Throws.TypeOf<ArgumentException>());

            Assert.That(
                () => new ObstacleSnapshot("asteroid-1", ObstacleKind.Unknown, new SpatialVector3(1f, 2f, 3f), new SpatialVector3(4f, 5f, 6f), new SpatialVector3(0f, 0f, 0f), 1.5f, 2.0f, 0.4f, 0.8f),
                Throws.TypeOf<ArgumentOutOfRangeException>());

            Assert.That(
                () => new ObstacleSnapshot("asteroid-1", ObstacleKind.Debris, new SpatialVector3(1f, 2f, 3f), new SpatialVector3(4f, 5f, 6f), new SpatialVector3(0f, 0f, 0f), 2.0f, 1.5f, 0.4f, 0.8f),
                Throws.TypeOf<ArgumentOutOfRangeException>());
        }

        [Test]
        public void Constructor_RejectsNaNAndInfinityForRadii()
        {
            Assert.That(
                () => new ObstacleSnapshot("asteroid-1", ObstacleKind.Debris, new SpatialVector3(1f, 2f, 3f), new SpatialVector3(4f, 5f, 6f), new SpatialVector3(0f, 0f, 0f), float.NaN, 2.0f, 0.4f, 0.8f),
                Throws.TypeOf<ArgumentOutOfRangeException>());

            Assert.That(
                () => new ObstacleSnapshot("asteroid-1", ObstacleKind.Debris, new SpatialVector3(1f, 2f, 3f), new SpatialVector3(4f, 5f, 6f), new SpatialVector3(0f, 0f, 0f), 1.5f, float.PositiveInfinity, 0.4f, 0.8f),
                Throws.TypeOf<ArgumentOutOfRangeException>());
        }

        [Test]
        public void Constructor_RejectsOutOfRangeHazardAndConfidence()
        {
            Assert.That(
                () => new ObstacleSnapshot("asteroid-1", ObstacleKind.Debris, new SpatialVector3(1f, 2f, 3f), new SpatialVector3(4f, 5f, 6f), new SpatialVector3(0f, 0f, 0f), 1.5f, 2.0f, -0.1f, 0.8f),
                Throws.TypeOf<ArgumentOutOfRangeException>());

            Assert.That(
                () => new ObstacleSnapshot("asteroid-1", ObstacleKind.Debris, new SpatialVector3(1f, 2f, 3f), new SpatialVector3(4f, 5f, 6f), new SpatialVector3(0f, 0f, 0f), 1.5f, 2.0f, 0.4f, 1.1f),
                Throws.TypeOf<ArgumentOutOfRangeException>());
        }

        [Test]
        public void Equality_IsDeterministic()
        {
            var left = new ObstacleSnapshot("asteroid-1", ObstacleKind.Debris, new SpatialVector3(1f, 2f, 3f), new SpatialVector3(4f, 5f, 6f), new SpatialVector3(0f, 0f, 0f), 1.5f, 2.0f, 0.4f, 0.8f);
            var right = new ObstacleSnapshot("asteroid-1", ObstacleKind.Debris, new SpatialVector3(1f, 2f, 3f), new SpatialVector3(4f, 5f, 6f), new SpatialVector3(0f, 0f, 0f), 1.5f, 2.0f, 0.4f, 0.8f);

            Assert.That(left, Is.EqualTo(right));
        }
    }
}
