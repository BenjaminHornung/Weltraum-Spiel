using System;
using NUnit.Framework;
using Weltraum.Navigation;

namespace Weltraum.Tests.EditMode.Navigation
{
    public sealed class ShipAuthoritySnapshotTests
    {
        [Test]
        public void Constructor_CreatesValidSnapshot()
        {
            var snapshot = new ShipAuthoritySnapshot(AuthorityState.Ready, 1.0f, 0.75f, 0.5f);

            Assert.That(snapshot.AuthorityState, Is.EqualTo(AuthorityState.Ready));
            Assert.That(snapshot.ThrustAuthority, Is.EqualTo(1.0f));
            Assert.That(snapshot.RotationAuthority, Is.EqualTo(0.75f));
            Assert.That(snapshot.BrakeAuthority, Is.EqualTo(0.5f));
        }

        [Test]
        public void Constructor_RejectsUnknownStateAndOutOfRangeAuthority()
        {
            Assert.That(
                () => new ShipAuthoritySnapshot(AuthorityState.Unknown, 1.0f, 0.75f, 0.5f),
                Throws.TypeOf<ArgumentOutOfRangeException>());

            Assert.That(
                () => new ShipAuthoritySnapshot(AuthorityState.Ready, -0.1f, 0.75f, 0.5f),
                Throws.TypeOf<ArgumentOutOfRangeException>());

            Assert.That(
                () => new ShipAuthoritySnapshot(AuthorityState.Ready, 1.1f, 0.75f, 0.5f),
                Throws.TypeOf<ArgumentOutOfRangeException>());
        }

        [Test]
        public void Equality_IsDeterministic()
        {
            var left = new ShipAuthoritySnapshot(AuthorityState.Limited, 0.8f, 0.5f, 0.25f);
            var right = new ShipAuthoritySnapshot(AuthorityState.Limited, 0.8f, 0.5f, 0.25f);

            Assert.That(left, Is.EqualTo(right));
        }
    }
}
