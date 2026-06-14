using System.Reflection;
using NUnit.Framework;
using UnityEngine;

public class PrototypeWaypointAutopilotObstacleReplanStabilityTests
{
    private const BindingFlags PrivateInstance = BindingFlags.Instance | BindingFlags.NonPublic;

    [Test]
    public void StableAvoidanceSurvivesTransientClearBeforeDebounce()
    {
        var autopilot = CreateAutopilot();
        try
        {
            MethodInfo method = typeof(PrototypeWaypointAutopilot).GetMethod("UpdateAvoidanceClearDebounce", PrivateInstance);

            Assert.NotNull(method);
            Assert.False((bool)method.Invoke(autopilot, new object[] { true, false, true, 100f }));

            SetPrivateField(autopilot, "avoidanceClearStartedAtTime", 99f);
            Assert.True((bool)method.Invoke(autopilot, new object[] { true, false, true, 100f }));

            Assert.False((bool)method.Invoke(autopilot, new object[] { true, true, true, 100f }));
            Assert.That(GetPrivateField<float>(autopilot, "avoidanceClearStartedAtTime"), Is.EqualTo(-1f));
        }
        finally
        {
            Object.DestroyImmediate(autopilot.gameObject);
        }
    }

    [Test]
    public void CoveredAvoidanceSuppressesPlanDirectionReplanButKeepsCollisionImmediate()
    {
        var autopilot = CreateAutopilot();
        try
        {
            SetStableAvoidance(autopilot, PrototypeAutopilotNavigationPhase.Avoiding);
            MethodInfo method = typeof(PrototypeWaypointAutopilot)
                .GetMethod("SuppressCoveredAvoidanceFlightPlanDivergence", PrivateInstance);
            var avoidanceSegment = new PrototypeManeuverSegment
            {
                phase = PrototypeManeuverPhase.AvoidanceBurn
            };
        var invalidDirectionReport = new PrototypeFlightPlanDivergenceReport(
            PrototypeFlightPlanAbortReplanReason.InvalidPlanDirection,
            true,
            false,
            "Replan: InvalidPlanDirection");
        var planExpiredReport = new PrototypeFlightPlanDivergenceReport(
            PrototypeFlightPlanAbortReplanReason.PlanExpired,
            true,
            false,
            "Replan: PlanExpired");

            Assert.NotNull(method);
            var suppressed = (PrototypeFlightPlanDivergenceReport)method.Invoke(
                autopilot,
                new object[] { default(PrototypeFlightPlan), avoidanceSegment, invalidDirectionReport });

            Assert.False(suppressed.HasDivergence);
            Assert.False(suppressed.requiresReplan);

            var expiredSuppressed = (PrototypeFlightPlanDivergenceReport)method.Invoke(
                autopilot,
                new object[] { default(PrototypeFlightPlan), avoidanceSegment, planExpiredReport });

            Assert.False(expiredSuppressed.HasDivergence);
            Assert.False(expiredSuppressed.requiresReplan);

            var collisionReport = new PrototypeFlightPlanDivergenceReport(
                PrototypeFlightPlanAbortReplanReason.InvalidPlanDirection
                    | PrototypeFlightPlanAbortReplanReason.CollisionPredicted,
                true,
                false,
                "Replan: CollisionPredicted|InvalidPlanDirection");
            var stillImmediate = (PrototypeFlightPlanDivergenceReport)method.Invoke(
                autopilot,
                new object[] { default(PrototypeFlightPlan), avoidanceSegment, collisionReport });

            Assert.True(stillImmediate.HasDivergence);
            Assert.True(stillImmediate.requiresReplan);
            Assert.True((stillImmediate.reasons & PrototypeFlightPlanAbortReplanReason.CollisionPredicted) != 0);
        }
        finally
        {
            Object.DestroyImmediate(autopilot.gameObject);
        }
    }

    [Test]
    public void StableAvoidanceSuppressesOnlyNonUrgentObstacleReplan()
    {
        var autopilot = CreateAutopilot();
        var obstacleHost = new GameObject("UnplannedObstacle");
        try
        {
            SetPrivateField(autopilot, "hasStableAvoidance", true);
            SetPrivateField(autopilot, "avoidanceHoldExpireTime", Time.time + 4f);
            MethodInfo method = typeof(PrototypeWaypointAutopilot)
                .GetMethod("ShouldTreatFlightPlanObstacleAsUnplanned", PrivateInstance);

            var obstacle = obstacleHost.AddComponent<PrototypeNavigationObstacle>();
            var farObstacle = PrototypeObstacleDetectionResult.HitFallback(
                obstacle,
                Vector3.forward * 48f,
                Vector3.up,
                48f,
                8f);
            var urgentObstacle = PrototypeObstacleDetectionResult.HitFallback(
                obstacle,
                Vector3.forward * 5f,
                Vector3.up,
                5f,
                8f);

            Assert.NotNull(method);
            Assert.False((bool)method.Invoke(autopilot, new object[] { farObstacle }));
            Assert.True((bool)method.Invoke(autopilot, new object[] { urgentObstacle }));
        }
        finally
        {
            Object.DestroyImmediate(autopilot.gameObject);
            Object.DestroyImmediate(obstacleHost);
        }
    }

    [Test]
    public void CoveredAvoidanceHoldOutsideCaptureRefreshesWithoutSafetyReplan()
    {
        var autopilot = CreateAutopilot();
        try
        {
            SetStableAvoidance(autopilot, PrototypeAutopilotNavigationPhase.Avoiding);
            SetPrivateField(autopilot, "<LastMetrics>k__BackingField", new PrototypeWaypointAutopilotMetrics
            {
                distance = 80f,
                relativeSpeed = 3f,
                closingSpeed = -1f,
                lateralSpeed = 0.5f,
                directionToTarget = Vector3.forward,
                isFinite = true
            });

            MethodInfo method = typeof(PrototypeWaypointAutopilot)
                .GetMethod("TryRefreshCoveredAvoidanceReacquirePlan", PrivateInstance);
            var holdSegment = new PrototypeManeuverSegment
            {
                phase = PrototypeManeuverPhase.Hold
            };

            Assert.NotNull(method);
            bool refreshed = (bool)method.Invoke(
                autopilot,
                new object[]
                {
                    default(PrototypeFlightPlan),
                    holdSegment,
                    PrototypeFlightPlanAbortReplanReason.NonExecutable
                });

            Assert.True(refreshed);
            Assert.That(autopilot.FlightPlanSafetyReplanCount, Is.EqualTo(0));
        }
        finally
        {
            Object.DestroyImmediate(autopilot.gameObject);
        }
    }

    private static PrototypeWaypointAutopilot CreateAutopilot()
    {
        var host = new GameObject("AutopilotObstacleReplanStabilityTest");
        return host.AddComponent<PrototypeWaypointAutopilot>();
    }

    private static void SetStableAvoidance(
        PrototypeWaypointAutopilot autopilot,
        PrototypeAutopilotNavigationPhase navigationPhase)
    {
        var plan = PrototypeTrajectoryPlan.Clear(Vector3.forward);
        plan.phase = PrototypeTrajectoryPhase.Avoidance;
        plan.navigationPhase = navigationPhase;
        plan.avoidanceActive = true;
        plan.obstacleDetected = true;
        plan.directPathBlocked = true;
        SetPrivateField(autopilot, "<LastTrajectoryPlan>k__BackingField", plan);
        SetPrivateField(autopilot, "hasStableAvoidance", true);
        SetPrivateField(autopilot, "avoidanceHoldExpireTime", Time.time + 4f);
    }

    private static void SetPrivateField<T>(object target, string fieldName, T value)
    {
        FieldInfo field = target.GetType().GetField(fieldName, PrivateInstance);
        Assert.NotNull(field, fieldName);
        field.SetValue(target, value);
    }

    private static T GetPrivateField<T>(object target, string fieldName)
    {
        FieldInfo field = target.GetType().GetField(fieldName, PrivateInstance);
        Assert.NotNull(field, fieldName);
        return (T)field.GetValue(target);
    }
}
