using System;
using System.Collections.Generic;
using NUnit.Framework;
using Weltraum.Navigation;
using Weltraum.Simulation;

namespace Weltraum.Tests.EditMode.Navigation
{
    public sealed class RoutePlanTests
    {
        [Test]
        public void Constructor_CreatesValidPlan()
        {
            var segments = new List<RouteSegment>
            {
                new RouteSegment(SegmentKind.Cruise, new SpatialVector3(0f, 0f, 0f), new SpatialVector3(1f, 1f, 1f), 12f, 3f)
            };

            var diagnostics = new List<string> { "start-check" };
            var target = new TargetDescriptor(TargetKind.Position, NavigationFrameKind.Local, new SpatialVector3(5f, 6f, 7f), new ArrivalEnvelope(0.5f, 0.2f, 1.0f, 3.0f));
            var score = new RouteScore(12f, 3f, 0.25f, 0.05f);
            var plan = new RoutePlan("plan-001", target, RouteOptimizationMode.Direct, RouteRiskLevel.Low, score, segments, diagnostics);

            Assert.That(plan.PlanHash, Is.EqualTo("plan-001"));
            Assert.That(plan.Target, Is.EqualTo(target));
            Assert.That(plan.Score, Is.EqualTo(score));
            Assert.That(plan.Segments.Count, Is.EqualTo(1));
            Assert.That(plan.Diagnostics.Count, Is.EqualTo(1));

            segments[0] = new RouteSegment(SegmentKind.Brake, new SpatialVector3(2f, 2f, 2f), new SpatialVector3(3f, 3f, 3f), 9f, 2f);
            diagnostics[0] = "mutated";

            Assert.That(plan.Segments[0], Is.Not.EqualTo(segments[0]));
            Assert.That(plan.Diagnostics[0], Is.EqualTo("start-check"));
        }

        [Test]
        public void Constructor_RejectsEmptyPlanHashAndEmptySegments()
        {
            var target = new TargetDescriptor(TargetKind.Position, NavigationFrameKind.Local, new SpatialVector3(5f, 6f, 7f), new ArrivalEnvelope(0.5f, 0.2f, 1.0f, 3.0f));
            var score = new RouteScore(12f, 3f, 0.25f, 0.05f);

            Assert.That(
                () => new RoutePlan(string.Empty, target, RouteOptimizationMode.Direct, RouteRiskLevel.Low, score, Array.Empty<RouteSegment>(), Array.Empty<string>()),
                Throws.TypeOf<ArgumentException>());

            Assert.That(
                () => new RoutePlan("plan-001", target, RouteOptimizationMode.Direct, RouteRiskLevel.Low, score, Array.Empty<RouteSegment>(), Array.Empty<string>()),
                Throws.TypeOf<ArgumentException>());
        }

        [Test]
        public void Constructor_RejectsUnknownOptimizationAndRiskModes()
        {
            var target = new TargetDescriptor(TargetKind.Position, NavigationFrameKind.Local, new SpatialVector3(5f, 6f, 7f), new ArrivalEnvelope(0.5f, 0.2f, 1.0f, 3.0f));
            var score = new RouteScore(12f, 3f, 0.25f, 0.05f);
            var segments = new[]
            {
                new RouteSegment(SegmentKind.Cruise, new SpatialVector3(0f, 0f, 0f), new SpatialVector3(1f, 1f, 1f), 12f, 3f)
            };

            Assert.That(
                () => new RoutePlan("plan-001", target, RouteOptimizationMode.Unknown, RouteRiskLevel.Low, score, segments, Array.Empty<string>()),
                Throws.TypeOf<ArgumentOutOfRangeException>());

            Assert.That(
                () => new RoutePlan("plan-001", target, RouteOptimizationMode.Direct, RouteRiskLevel.Unknown, score, segments, Array.Empty<string>()),
                Throws.TypeOf<ArgumentOutOfRangeException>());
        }

        [Test]
        public void Equality_IsDeterministic()
        {
            var target = new TargetDescriptor(TargetKind.Position, NavigationFrameKind.Local, new SpatialVector3(5f, 6f, 7f), new ArrivalEnvelope(0.5f, 0.2f, 1.0f, 3.0f));
            var score = new RouteScore(12f, 3f, 0.25f, 0.05f);
            var segments = new[]
            {
                new RouteSegment(SegmentKind.Cruise, new SpatialVector3(0f, 0f, 0f), new SpatialVector3(1f, 1f, 1f), 12f, 3f)
            };

            var left = new RoutePlan("plan-001", target, RouteOptimizationMode.Direct, RouteRiskLevel.Low, score, segments, Array.Empty<string>());
            var right = new RoutePlan("plan-001", target, RouteOptimizationMode.Direct, RouteRiskLevel.Low, score, segments, Array.Empty<string>());

            Assert.That(left, Is.EqualTo(right));
        }
    }
}
