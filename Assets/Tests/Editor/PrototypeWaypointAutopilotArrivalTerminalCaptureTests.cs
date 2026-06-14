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
    public void HoldCaptureRejectsTerminalRangeBeforeFinishedDistance()
    {
        var autopilot = CreateAutopilot();
        try
        {
            SetMetrics(autopilot, 18f, 2.6f, 0.2f, 0.1f);
            SetPrivateField(autopilot, "arrivalTerminalCaptureActive", true);
            SetPrivateField(autopilot, "arrivalBrakeCommitted", true);

            bool allowed = InvokePrivate<bool>(autopilot, "ShouldAllowHoldPositionCapture");

            Assert.False(allowed, "terminal brake/capture may continue controlling, but HoldPosition must wait for the finished-distance envelope.");
        }
        finally
        {
            Object.DestroyImmediate(autopilot.gameObject);
        }
    }

    [Test]
    public void TerminalCaptureEntryRequiresStableWindow()
    {
        var autopilot = CreateAutopilot();
        try
        {
            SetPrivateField(autopilot, "autopilotElapsedSeconds", 4f);

            Assert.False(InvokePrivate<bool>(autopilot, "UpdateArrivalTerminalCaptureEntry", true));
            Assert.False(GetPrivateField<bool>(autopilot, "arrivalTerminalCaptureActive"));

            SetPrivateField(autopilot, "autopilotElapsedSeconds", 4.06f);
            Assert.False(InvokePrivate<bool>(autopilot, "UpdateArrivalTerminalCaptureEntry", true));

            SetPrivateField(autopilot, "autopilotElapsedSeconds", 4.08f);
            Assert.False(InvokePrivate<bool>(autopilot, "UpdateArrivalTerminalCaptureEntry", false));

            SetPrivateField(autopilot, "autopilotElapsedSeconds", 4.2f);
            Assert.False(
                InvokePrivate<bool>(autopilot, "UpdateArrivalTerminalCaptureEntry", true),
                "a transient false tick must restart the terminal capture entry window.");

            SetPrivateField(autopilot, "autopilotElapsedSeconds", 4.35f);
            Assert.True(InvokePrivate<bool>(autopilot, "UpdateArrivalTerminalCaptureEntry", true));
            Assert.True(GetPrivateField<bool>(autopilot, "arrivalTerminalCaptureActive"));
        }
        finally
        {
            Object.DestroyImmediate(autopilot.gameObject);
        }
    }

    [Test]
    public void TerminalCaptureReleaseRequiresStableOutsideWindow()
    {
        var autopilot = CreateAutopilot();
        GameObject targetHost = null;
        try
        {
            targetHost = AttachTargetContext(autopilot, 10f);
            SetPrivateField(autopilot, "arrivalTerminalCaptureActive", true);
            SetPrivateField(autopilot, "directFastTransferTerminalCaptureActive", true);
            SetMetrics(autopilot, 80f, 0.2f, 0.02f, -0.02f);
            SetPrivateField(autopilot, "autopilotElapsedSeconds", 8f);

            Assert.False(InvokePrivate<bool>(autopilot, "UpdateArrivalTerminalCaptureRelease"));
            Assert.True(GetPrivateField<bool>(autopilot, "arrivalTerminalCaptureActive"));

            SetPrivateField(autopilot, "autopilotElapsedSeconds", 8.1f);
            Assert.False(InvokePrivate<bool>(autopilot, "UpdateArrivalTerminalCaptureRelease"));

            SetMetrics(autopilot, 11f, 0.2f, 0.02f, -0.02f);
            SetPrivateField(autopilot, "autopilotElapsedSeconds", 8.16f);
            Assert.False(
                InvokePrivate<bool>(autopilot, "UpdateArrivalTerminalCaptureRelease"),
                "a return inside the terminal range must cancel the release window.");
            Assert.True(GetPrivateField<bool>(autopilot, "arrivalTerminalCaptureActive"));

            SetMetrics(autopilot, 80f, 0.2f, 0.02f, -0.02f);
            SetPrivateField(autopilot, "autopilotElapsedSeconds", 8.32f);
            Assert.False(InvokePrivate<bool>(autopilot, "UpdateArrivalTerminalCaptureRelease"));

            SetPrivateField(autopilot, "autopilotElapsedSeconds", 8.6f);
            Assert.True(InvokePrivate<bool>(autopilot, "UpdateArrivalTerminalCaptureRelease"));
            Assert.False(GetPrivateField<bool>(autopilot, "arrivalTerminalCaptureActive"));
            Assert.False(GetPrivateField<bool>(autopilot, "directFastTransferTerminalCaptureActive"));
        }
        finally
        {
            if (targetHost != null)
            {
                Object.DestroyImmediate(targetHost);
            }

            Object.DestroyImmediate(autopilot.gameObject);
        }
    }

    [Test]
    public void ActiveTerminalCaptureAllowsSmallFinishedDistanceSlackForSlowHold()
    {
        var autopilot = CreateAutopilot();
        GameObject targetHost = null;
        try
        {
            targetHost = AttachTargetContext(autopilot, 10f);
            SetMetrics(autopilot, 11.8f, 0.3f, 0.05f, 0.01f);
            SetPrivateField(autopilot, "arrivalTerminalCaptureActive", true);
            SetPrivateField(autopilot, "directFastTransferTerminalCaptureActive", true);
            SetPrivateField(autopilot, "arrivalBrakeCommitted", true);

            bool allowed = InvokePrivate<bool>(autopilot, "ShouldAllowHoldPositionCapture");

            Assert.True(allowed, "active terminal capture may enter HoldPosition for a settled fine approach just outside the finished-distance edge.");
        }
        finally
        {
            if (targetHost != null)
            {
                Object.DestroyImmediate(targetHost);
            }

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
    public void TerminalBrakeReleasesToFineApproachNearFinishedDistance()
    {
        var autopilot = CreateAutopilot();
        try
        {
            AttachRcsAuthority(autopilot);
            SetMetrics(autopilot, 11.8f, 0.4f, 0.25f, 0.2f);
            SetPrivateField(autopilot, "arrivalBrakeCommitted", true);

            bool release = InvokePrivate<bool>(
                autopilot,
                "ShouldReleaseTerminalBrakeForFineApproach",
                0.95f,
                0.3f);

            Assert.True(release, "near-finished slow terminal capture should hand off from Brake to FineApproach instead of hovering outside Hold.");
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

    private static GameObject AttachTargetContext(PrototypeWaypointAutopilot autopilot, float arrivalRadius)
    {
        var targetHost = new GameObject("ArrivalTerminalCaptureTarget");
        targetHost.transform.position = Vector3.forward * 30f;
        var target = targetHost.AddComponent<PrototypeNavigationTarget>();
        target.Configure("Arrival Target", arrivalRadius);
        var body = autopilot.GetComponent<Rigidbody>();
        if (body == null)
        {
            body = autopilot.gameObject.AddComponent<Rigidbody>();
        }

        SetPrivateField(autopilot, "shipRigidbody", body);
        SetPrivateField(autopilot, "currentTarget", target);
        return targetHost;
    }

    private static void AttachRcsAuthority(PrototypeWaypointAutopilot autopilot)
    {
        var body = autopilot.GetComponent<Rigidbody>();
        var physicsCore = autopilot.gameObject.AddComponent<ShipPhysicsCore>();
        var rcs = autopilot.gameObject.AddComponent<RcsThrusterController>();
        Transform up = CreateNozzle(autopilot.transform, "RCS_Up", Vector3.up);
        Transform down = CreateNozzle(autopilot.transform, "RCS_Down", Vector3.down);
        Transform left = CreateNozzle(autopilot.transform, "RCS_Left", Vector3.left);
        Transform right = CreateNozzle(autopilot.transform, "RCS_Right", Vector3.right);
        Transform forward = CreateNozzle(autopilot.transform, "RCS_Forward", Vector3.forward);
        Transform back = CreateNozzle(autopilot.transform, "RCS_Back", Vector3.back);
        rcs.ConfigureThrusters(up, down, left, right, forward, back, body, physicsCore);
        SetPrivateField(autopilot, "cachedRcsThrusters", rcs);
    }

    private static Transform CreateNozzle(Transform parent, string name, Vector3 localPosition)
    {
        var nozzle = new GameObject(name);
        nozzle.transform.SetParent(parent, false);
        nozzle.transform.localPosition = localPosition;
        return nozzle.transform;
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

    private static T InvokePrivate<T>(object target, string methodName, params object[] args)
    {
        MethodInfo method = target.GetType().GetMethod(methodName, PrivateInstance);
        Assert.NotNull(method, methodName);
        object result = method.Invoke(target, args);
        return result is T value ? value : default;
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
        object value = field.GetValue(target);
        return value is T typed ? typed : default;
    }
}
