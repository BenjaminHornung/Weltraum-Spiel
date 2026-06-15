using System;
using NUnit.Framework;
using Weltraum.Navigation;

namespace Weltraum.Tests.EditMode.Navigation
{
    public sealed class RouteScoreTests
    {
        [Test]
        public void Constructor_CreatesValidScore()
        {
            var score = new RouteScore(42f, 7f, 0.25f, 0.1f);

            Assert.That(score.DistanceMeters, Is.EqualTo(42f));
            Assert.That(score.FuelCost, Is.EqualTo(7f));
            Assert.That(score.RiskScore, Is.EqualTo(0.25f));
            Assert.That(score.AuthorityPenalty, Is.EqualTo(0.1f));
        }

        [Test]
        public void Constructor_RejectsNaNAndNegativeValues()
        {
            Assert.That(
                () => new RouteScore(float.NaN, 7f, 0.25f, 0.1f),
                Throws.TypeOf<ArgumentOutOfRangeException>());

            Assert.That(
                () => new RouteScore(42f, float.PositiveInfinity, 0.25f, 0.1f),
                Throws.TypeOf<ArgumentOutOfRangeException>());

            Assert.That(
                () => new RouteScore(42f, -1f, 0.25f, 0.1f),
                Throws.TypeOf<ArgumentOutOfRangeException>());
        }

        [Test]
        public void Equality_IsDeterministic()
        {
            var left = new RouteScore(42f, 7f, 0.25f, 0.1f);
            var right = new RouteScore(42f, 7f, 0.25f, 0.1f);

            Assert.That(left, Is.EqualTo(right));
        }
    }
}
