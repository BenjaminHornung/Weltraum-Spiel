using System.Collections.Generic;
using NUnit.Framework;
using Weltraum.Navigation;
using Weltraum.Simulation;

namespace Weltraum.Tests.EditMode.Navigation
{
    public sealed class NavigationEnvironmentSnapshotTests
    {
        [Test]
        public void Constructor_CreatesValidSnapshot()
        {
            var obstacles = new List<ObstacleSnapshot>
            {
                new ObstacleSnapshot("asteroid-1", ObstacleKind.Debris, new SpatialVector3(1f, 2f, 3f), new SpatialVector3(4f, 5f, 6f), new SpatialVector3(0f, 0f, 0f), 1.5f, 2.0f, 0.4f, 0.8f)
            };

            var snapshot = new NavigationEnvironmentSnapshot(new SpatialVector3(10f, 20f, 30f), new SpatialVector3(1f, 1f, 1f), obstacles);

            Assert.That(snapshot.ReferencePosition, Is.EqualTo(new SpatialVector3(10f, 20f, 30f)));
            Assert.That(snapshot.ReferenceVelocity, Is.EqualTo(new SpatialVector3(1f, 1f, 1f)));
            Assert.That(snapshot.Obstacles.Count, Is.EqualTo(1));

            obstacles[0] = new ObstacleSnapshot("asteroid-2", ObstacleKind.Static, new SpatialVector3(7f, 8f, 9f), new SpatialVector3(7f, 8f, 9f), new SpatialVector3(0f, 0f, 0f), 1f, 1.5f, 0.2f, 0.5f);

            Assert.That(snapshot.Obstacles[0].Id, Is.EqualTo("asteroid-1"));
        }

        [Test]
        public void Equality_IsDeterministic()
        {
            var obstacles = new[]
            {
                new ObstacleSnapshot("asteroid-1", ObstacleKind.Debris, new SpatialVector3(1f, 2f, 3f), new SpatialVector3(4f, 5f, 6f), new SpatialVector3(0f, 0f, 0f), 1.5f, 2.0f, 0.4f, 0.8f)
            };

            var left = new NavigationEnvironmentSnapshot(new SpatialVector3(10f, 20f, 30f), new SpatialVector3(1f, 1f, 1f), obstacles);
            var right = new NavigationEnvironmentSnapshot(new SpatialVector3(10f, 20f, 30f), new SpatialVector3(1f, 1f, 1f), obstacles);

            Assert.That(left, Is.EqualTo(right));
        }
    }
}
