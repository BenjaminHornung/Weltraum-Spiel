using System;
using System.Collections.Generic;
using NUnit.Framework;
using Weltraum.Navigation;
using Weltraum.Simulation;

namespace Weltraum.Tests.EditMode.Navigation
{
    public sealed class RouteCandidateTests
    {
        [Test]
        public void Constructor_CreatesValidCandidate()
        {
            var segments = new List<RouteSegment>
            {
                new RouteSegment(SegmentKind.Cruise, new SpatialVector3(0f, 0f, 0f), new SpatialVector3(1f, 1f, 1f), 12f, 3f)
            };

            var diagnostics = new List<string> { "authority-ok" };
            var score = new RouteScore(12f, 3f, 0.25f, 0.05f);
            var candidate = new RouteCandidate("direct-route", RouteOptimizationMode.Direct, RouteRiskLevel.Low, score, segments, diagnostics, PlanInvalidationReason.None);

            Assert.That(candidate.CandidateName, Is.EqualTo("direct-route"));
            Assert.That(candidate.Score, Is.EqualTo(score));
            Assert.That(candidate.Segments.Count, Is.EqualTo(1));
            Assert.That(candidate.Diagnostics.Count, Is.EqualTo(1));
            Assert.That(candidate.RejectionReason, Is.EqualTo(PlanInvalidationReason.None));

            segments[0] = new RouteSegment(SegmentKind.Brake, new SpatialVector3(2f, 2f, 2f), new SpatialVector3(3f, 3f, 3f), 9f, 2f);
            diagnostics[0] = "mutated";

            Assert.That(candidate.Segments[0], Is.Not.EqualTo(segments[0]));
            Assert.That(candidate.Diagnostics[0], Is.EqualTo("authority-ok"));
        }

        [Test]
        public void Constructor_RejectsEmptyCandidateNameAndEmptySegments()
        {
            var score = new RouteScore(12f, 3f, 0.25f, 0.05f);

            Assert.That(
                () => new RouteCandidate(string.Empty, RouteOptimizationMode.Direct, RouteRiskLevel.Low, score, Array.Empty<RouteSegment>(), Array.Empty<string>(), PlanInvalidationReason.None),
                Throws.TypeOf<ArgumentException>());

            Assert.That(
                () => new RouteCandidate("candidate-001", RouteOptimizationMode.Direct, RouteRiskLevel.Low, score, Array.Empty<RouteSegment>(), Array.Empty<string>(), PlanInvalidationReason.None),
                Throws.TypeOf<ArgumentException>());
        }

        [Test]
        public void Constructor_RejectsNullOrInvalidDiagnostics()
        {
            var score = new RouteScore(12f, 3f, 0.25f, 0.05f);
            var segments = new[]
            {
                new RouteSegment(SegmentKind.Cruise, new SpatialVector3(0f, 0f, 0f), new SpatialVector3(1f, 1f, 1f), 12f, 3f)
            };

            Assert.That(
                () => new RouteCandidate("candidate-001", RouteOptimizationMode.Direct, RouteRiskLevel.Low, score, segments, null, PlanInvalidationReason.None),
                Throws.TypeOf<ArgumentNullException>());

            Assert.That(
                () => new RouteCandidate("candidate-001", RouteOptimizationMode.Direct, RouteRiskLevel.Low, score, segments, new[] { "ok", null }, PlanInvalidationReason.None),
                Throws.TypeOf<ArgumentException>());
        }

        [Test]
        public void Constructor_RejectsUnknownOptimizationAndRiskModes()
        {
            var score = new RouteScore(12f, 3f, 0.25f, 0.05f);
            var segments = new[]
            {
                new RouteSegment(SegmentKind.Cruise, new SpatialVector3(0f, 0f, 0f), new SpatialVector3(1f, 1f, 1f), 12f, 3f)
            };

            Assert.That(
                () => new RouteCandidate("candidate-001", RouteOptimizationMode.Unknown, RouteRiskLevel.Low, score, segments, Array.Empty<string>(), PlanInvalidationReason.None),
                Throws.TypeOf<ArgumentOutOfRangeException>());

            Assert.That(
                () => new RouteCandidate("candidate-001", RouteOptimizationMode.Direct, RouteRiskLevel.Unknown, score, segments, Array.Empty<string>(), PlanInvalidationReason.None),
                Throws.TypeOf<ArgumentOutOfRangeException>());
        }

        [Test]
        public void Equality_IsDeterministic()
        {
            var score = new RouteScore(12f, 3f, 0.25f, 0.05f);
            var segments = new[]
            {
                new RouteSegment(SegmentKind.Cruise, new SpatialVector3(0f, 0f, 0f), new SpatialVector3(1f, 1f, 1f), 12f, 3f)
            };

            var left = new RouteCandidate("candidate-001", RouteOptimizationMode.Direct, RouteRiskLevel.Low, score, segments, Array.Empty<string>(), PlanInvalidationReason.None);
            var right = new RouteCandidate("candidate-001", RouteOptimizationMode.Direct, RouteRiskLevel.Low, score, segments, Array.Empty<string>(), PlanInvalidationReason.None);

            Assert.That(left, Is.EqualTo(right));
        }
    }
}
