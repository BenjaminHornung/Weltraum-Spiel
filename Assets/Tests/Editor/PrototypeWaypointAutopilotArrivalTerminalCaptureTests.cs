using System.Reflection;
using NUnit.Framework;
using UnityEngine;

public class PrototypeWaypointAutopilotArrivalTerminalCaptureTests
{
    private const BindingFlags PrivateInstance = BindingFlags.Instance | BindingFlags.NonPublic;

    [Test]
    public void HoldCaptureRejectsFarTerminalLatch()
    {
        var autopilot = CreateAutopilot();
        try
        {
            SetMetrics(autopilot, 80f, 4f, 2f, 4.5f);
            SetPrivateField(autopilot, "arrivalTerminalCaptureActive", true);

            bool allowed = InvokePrivate<bool>(autopilot, "ShouldAllowHoldPositionCapture");

            Assert.False(allowed, "terminal latches must not enter HoldPosition far outside the capture zone.");
        }
        finally
        {
            Object.DestroyImmediate(autopilot.gameObject);
        }
    }

    [Test]
    public void DirectFastTransferTerminalBrakeTapersInsideCaptureZone()
    {
        var autopilot = CreateAutopilot();
        try
        {
            SetMetrics(autopilot, 12f, 4.2f, 0.2f, 4.2f);
            float taperedThrottle = InvokePrivate<float>(autopilot, "GetDirectFastTransferTerminalBrakeThrottle");

            SetMetrics(autopilot, 12f, 12f, 0.2f, 12f);
            float fullThrottle = InvokePrivate<float>(autopilot, "GetDirectFastTransferTerminalBrakeThrottle");

            Assert.That(taperedThrottle, Is.GreaterThan(0f));
            Assert.That(taperedThrottle, Is.LessThan(1f));
            Assert.That(fullThrottle, Is.EqualTo(1f).Within(0.0001f));
        }
        finally
        {
            Object.DestroyImmediate(autopilot.gameObject);
        }
    }

    [Test]
    public void NearTerminalReacquireKeepsFinalApproachInsteadOfAccelerate()
    {
        var autopilot = CreateAutopilot();
        try
        {
            SetMetrics(autopilot, 18f, 3f, 0.3f, 3f);
            SetPrivateField(autopilot, "directFastTransferTerminalReacquireActive", true);

            InvokePrivate<object>(autopilot, "ApplyDirectFastTransferTerminalReacquire");

            Assert.That(autopilot.CurrentState, Is.Not.EqualTo(PrototypeWaypointAutopilotState.Accelerate));
            Assert.That(autopilot.NavigationPhase, Is.EqualTo(PrototypeWaypointAutopilotNavigationPhase.FinalApproach));
        }
        finally
        {
            Object.DestroyImmediate(autopilot.gameObject);
        }
    }

    private static PrototypeWaypointAutopilot CreateAutopilot()
    {
        var host = new GameObject("AutopilotArrivalTerminalCaptureTest");
        return host.AddComponent<PrototypeWaypointAutopilot>();
    }

    private static void SetMetrics(
        PrototypeWaypointAutopilot autopilot,
        float distance,
        float relativeSpeed,
        float lateralSpeed,
        float closingSpeed)
    {
        var metrics = new PrototypeWaypointAutopilotMetrics
        {
            directionToTarget = Vector3.forward,
            lateralVelocity = Vector3.right * lateralSpeed,
            distance = distance,
            closingSpeed = closingSpeed,
            lateralSpeed = lateralSpeed,
            relativeSpeed = relativeSpeed,
            maxDeceleration = 8f,
            stoppingDistance = relativeSpeed * relativeSpeed / 16f,
            etaSeconds = closingSpeed > 0.01f ? distance / closingSpeed : float.PositiveInfinity,
            shouldBrake = true,
            isFinite = true
        };
        SetPrivateField(autopilot, "<LastMetrics>k__BackingField", metrics);
    }

    private static T InvokePrivate<T>(object target, string methodName)
    {
        MethodInfo method = target.GetType().GetMethod(methodName, PrivateInstance);
        Assert.NotNull(method, methodName);
        object result = method.Invoke(target, null);
        return result is T value ? value : default;
    }

    private static void SetPrivateField<T>(object target, string fieldName, T value)
    {
        FieldInfo field = target.GetType().GetField(fieldName, PrivateInstance);
        Assert.NotNull(field, fieldName);
        field.SetValue(target, value);
    }
}
