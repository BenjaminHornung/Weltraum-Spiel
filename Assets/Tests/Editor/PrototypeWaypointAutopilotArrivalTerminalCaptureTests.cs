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
    public void StrictArrivalCompletionRejectsLooseRadius()
    {
        var autopilot = CreateAutopilot();
        GameObject targetHost = null;
        try
        {
            targetHost = AttachTargetContext(autopilot, 10f);
            SetMetrics(autopilot, 11f, 0.03f, 0.02f, 0.01f);
            var body = autopilot.GetComponent<Rigidbody>();
            body.angularVelocity = Vector3.zero;

            bool hasArrived = InvokePrivate<bool>(autopilot, "HasArrived");

            Assert.False(hasArrived, "old slack-style arrival windows should not pass strict completion.");
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
    public void StrictArrivalCompletionRejectsTooFast()
    {
        var autopilot = CreateAutopilot();
        GameObject targetHost = null;
        try
        {
            targetHost = AttachTargetContext(autopilot, 10f);
            SetMetrics(autopilot, 0.7f, 0.2f, 0.05f, 0.02f);
            var body = autopilot.GetComponent<Rigidbody>();
            body.angularVelocity = Vector3.zero;

            bool hasArrived = InvokePrivate<bool>(autopilot, "HasArrived");

            Assert.False(hasArrived, "strict completion should reject high-speed cases at near-target distance.");
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
    public void StrictArrivalCompletionRejectsHighAngularRate()
    {
        var autopilot = CreateAutopilot();
        GameObject targetHost = null;
        try
        {
            targetHost = AttachTargetContext(autopilot, 10f);
            SetMetrics(autopilot, 0.5f, 0.07f, 0.04f, 0.03f);
            var body = autopilot.GetComponent<Rigidbody>();
            body.angularVelocity = Vector3.up * 0.2f;

            bool hasArrived = InvokePrivate<bool>(autopilot, "HasArrived");

            Assert.False(hasArrived, "angular rate above the strict envelope should block completion.");
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
    public void StrictArrivalCompletionAcceptsExactSettledState()
    {
        var autopilot = CreateAutopilot();
        GameObject targetHost = null;
        try
        {
            targetHost = AttachTargetContext(autopilot, 10f);
            SetMetrics(autopilot, 0.74f, 0.1f, 0.05f, 0.02f);
            var body = autopilot.GetComponent<Rigidbody>();
            body.angularVelocity = Vector3.up * 0.1f;

            bool hasArrived = InvokePrivate<bool>(autopilot, "HasArrived");

            Assert.True(hasArrived, "exact settled state should pass strict completion.");
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
    public void HoldPositionCorrectionStillTargetsStrictArrivalPoint()
    {
        var autopilot = CreateAutopilot();
        GameObject targetHost = null;
        try
        {
            targetHost = AttachTargetContext(autopilot, 10f);
            AttachRcsAuthority(autopilot);
            SetMetrics(autopilot, 8f, 0.2f, 0.2f, 0.2f);
            Vector3 holdCorrection = InvokePrivate<Vector3>(autopilot, "ComputeHoldPositionCorrectionForceWorld", 0f);

            Assert.That(holdCorrection.magnitude, Is.GreaterThan(0.0001f), "hold damping should keep driving inside loose terminal radius.");
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

    [Test]
    public void TerminalReacquireWithBrakeOwnershipNoTerminalMomentumKeepsTerminalControl()
    {
        var autopilot = CreateAutopilot();
        try
        {
            SetMetrics(autopilot, 60f, 0.06f, 0.01f, 0f);
            SetPrivateField(autopilot, "arrivalBrakeCommitted", true);
            SetPrivateField(autopilot, "directFastTransferTerminalReacquireActive", true);

            InvokePrivate<object>(autopilot, "ApplyDirectFastTransferTerminalReacquire");

            Assert.That(autopilot.CurrentState, Is.Not.EqualTo(PrototypeWaypointAutopilotState.Accelerate));
            Assert.That(autopilot.NavigationPhase, Is.EqualTo(PrototypeWaypointAutopilotNavigationPhase.FinalApproach));
            Assert.That(autopilot.RequestedMainThrottle, Is.EqualTo(0f).Within(0.0001f));
            Assert.That(autopilot.NavigationPhase, Is.Not.EqualTo(PrototypeWaypointAutopilotNavigationPhase.ReacquireDirectPath));
        }
        finally
        {
            Object.DestroyImmediate(autopilot.gameObject);
        }
    }

    [Test]
    public void FarTerminalRecoveryWithoutOwnershipIsRejected()
    {
        var autopilot = CreateAutopilot();
        try
        {
            SetMetrics(autopilot, 500f, 0.5f, 0.4f, -0.1f);
            PrototypeFlightPlanAbortReplanReason reasons =
                PrototypeFlightPlanAbortReplanReason.PositionDivergence
                | PrototypeFlightPlanAbortReplanReason.InvalidPlanDirection
                | PrototypeFlightPlanAbortReplanReason.TrackingDiverged;

            bool canOwnRecovery = InvokePrivate<bool>(
                autopilot,
                "CanDirectFastTransferTerminalRecoveryOwnCurrentState");
            bool shouldRecover = InvokePrivate<bool>(
                autopilot,
                "ShouldRecoverStrictDirectFastTransferTerminalDivergence",
                reasons);

            Assert.False(canOwnRecovery, "far no-obstacle drift should stay in nominal tracking, not terminal recovery.");
            Assert.False(shouldRecover, "far invalid plan direction must not become a false Reacquire profile.");
        }
        finally
        {
            Object.DestroyImmediate(autopilot.gameObject);
        }
    }

    [Test]
    public void ExistingTerminalRecoveryRetainsOwnership()
    {
        var autopilot = CreateAutopilot();
        try
        {
            SetMetrics(autopilot, 500f, 0.5f, 0.4f, -0.1f);
            SetPrivateField(autopilot, "directFastTransferTerminalReacquireActive", true);
            PrototypeFlightPlanAbortReplanReason reasons =
                PrototypeFlightPlanAbortReplanReason.PositionDivergence
                | PrototypeFlightPlanAbortReplanReason.InvalidPlanDirection
                | PrototypeFlightPlanAbortReplanReason.TrackingDiverged;

            bool canOwnRecovery = InvokePrivate<bool>(
                autopilot,
                "CanDirectFastTransferTerminalRecoveryOwnCurrentState");
            bool shouldRecover = InvokePrivate<bool>(
                autopilot,
                "ShouldRecoverStrictDirectFastTransferTerminalDivergence",
                reasons);

            Assert.True(canOwnRecovery, "an explicit terminal recovery should keep control once entered.");
            Assert.True(shouldRecover, "executor-owned terminal recovery may continue correcting its intentional off-plan path.");
        }
        finally
        {
            Object.DestroyImmediate(autopilot.gameObject);
        }
    }

    [Test]
    public void FlightPlanHoldFallbackWithBrakeOwnershipStaysFinalApproach()
    {
        var autopilot = CreateAutopilot();
        try
        {
            SetMetrics(autopilot, 120f, 0.06f, 0.02f, 0f);
            SetPrivateField(autopilot, "arrivalBrakeCommitted", true);
            SetPrivateField(
                autopilot,
                "<LastTrajectoryPlan>k__BackingField",
                PrototypeTrajectoryPlan.Clear(Vector3.forward));

            var holdSegment = new PrototypeManeuverSegment
            {
                phase = PrototypeManeuverPhase.Hold,
                commandMode = PrototypeManeuverCommandMode.MainThrottle,
                mainThrottle = 0f
            };

            var trackingCommand = new PrototypeFlightPlanTrackingCommand
            {
                hasCommand = true,
                mainThrottleAllowed = true,
                mainDirectionWorld = Vector3.forward,
                mainThrottle = 0f,
                rcsAccelerationWorld = Vector3.zero,
                rcsForceWorld = Vector3.zero,
                accelerationDotPlannedTangent = 1f,
                mainDirectionDotVelocityBrake = 1f
            };

            InvokePrivate<bool>(autopilot, "ApplyFlightPlanSegment", holdSegment, trackingCommand);

            Assert.That(autopilot.CurrentState, Is.Not.EqualTo(PrototypeWaypointAutopilotState.Accelerate));
            Assert.That(autopilot.NavigationPhase, Is.EqualTo(PrototypeWaypointAutopilotNavigationPhase.FinalApproach));
            Assert.That(autopilot.NavigationPhase, Is.Not.EqualTo(PrototypeWaypointAutopilotNavigationPhase.ReacquireDirectPath));
            Assert.That(autopilot.RequestedMainThrottle, Is.EqualTo(0f).Within(0.0001f));
        }
        finally
        {
            Object.DestroyImmediate(autopilot.gameObject);
        }
    }

    [Test]
    public void TerminalControlClearAvoidanceRouteDropsStableAvoidanceAndReacquire()
    {
        var autopilot = CreateAutopilot();
        try
        {
            SetMetrics(autopilot, 2f, 0.05f, 0.02f, 0f);
            SetPrivateField(autopilot, "arrivalTerminalCaptureActive", true);
            SetPrivateField(autopilot, "hasStableAvoidance", true);
            SetPrivateField(autopilot, "stableAvoidanceWaypoint", Vector3.right * 20f);
            SetPrivateField(autopilot, "stableAvoidanceDirection", Vector3.right);
            SetPrivateField(autopilot, "avoidanceHoldExpireTime", 42f);
            SetPrivateField(autopilot, "avoidanceClearStartedAtTime", 12f);
            SetPrivateField(autopilot, "reacquireDirectPathUntilTime", 42f);
            SetPrivateField(autopilot, "coveredAvoidanceSafetyReplanUntilTime", 42f);

            Assert.True(InvokePrivate<bool>(autopilot, "ShouldTerminalControlClearAvoidanceRoute"));

            InvokePrivate<object>(autopilot, "ClearStableAvoidanceRoute", true);

            Assert.False(GetPrivateField<bool>(autopilot, "hasStableAvoidance"));
            Assert.That(GetPrivateField<Vector3>(autopilot, "stableAvoidanceWaypoint").sqrMagnitude, Is.EqualTo(0f).Within(0.0001f));
            Assert.That(GetPrivateField<Vector3>(autopilot, "stableAvoidanceDirection").sqrMagnitude, Is.EqualTo(0f).Within(0.0001f));
            Assert.That(GetPrivateField<float>(autopilot, "avoidanceHoldExpireTime"), Is.EqualTo(0f).Within(0.0001f));
            Assert.That(GetPrivateField<float>(autopilot, "avoidanceClearStartedAtTime"), Is.EqualTo(-1f).Within(0.0001f));
            Assert.That(GetPrivateField<float>(autopilot, "reacquireDirectPathUntilTime"), Is.EqualTo(0f).Within(0.0001f));
            Assert.That(GetPrivateField<float>(autopilot, "coveredAvoidanceSafetyReplanUntilTime"), Is.EqualTo(0f).Within(0.0001f));
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
        var physicsCore = autopilot.GetComponent<ShipPhysicsCore>() ?? autopilot.gameObject.AddComponent<ShipPhysicsCore>();
        var rcs = autopilot.GetComponent<RcsThrusterController>() ?? autopilot.gameObject.AddComponent<RcsThrusterController>();
        var controller = autopilot.GetComponent<PlayerShipController>() ?? autopilot.gameObject.AddComponent<PlayerShipController>();
        Transform up = CreateNozzle(autopilot.transform, "RCS_Nozzle_Up", Vector3.up);
        Transform down = CreateNozzle(autopilot.transform, "RCS_Nozzle_Down", Vector3.down);
        Transform left = CreateNozzle(autopilot.transform, "RCS_Nozzle_Left", Vector3.left);
        Transform right = CreateNozzle(autopilot.transform, "RCS_Nozzle_Right", Vector3.right);
        Transform forward = CreateNozzle(autopilot.transform, "RCS_Nozzle_Forward", Vector3.forward);
        Transform back = CreateNozzle(autopilot.transform, "RCS_Nozzle_Back", Vector3.back);
        rcs.ConfigureThrusters(up, down, left, right, forward, back, body, physicsCore);
        controller.SetRcsEnabled(true);
        SetPrivateField(autopilot, "shipController", controller);
        SetPrivateField(autopilot, "cachedRcsThrusters", rcs);
    }

    private static Transform CreateNozzle(Transform parent, string name, Vector3 localPosition)
    {
        var nozzle = new GameObject(name);
        nozzle.transform.SetParent(parent, false);
        nozzle.transform.localPosition = localPosition;
        var socket = nozzle.AddComponent<PrototypeShipSocket>();
        socket.Configure(new PrototypeShipSocketDescriptor
        {
            SocketId = name,
            SocketType = PrototypeShipSocketType.RcsNozzle,
            LocalAxisRole = PrototypeShipSocketAxisRole.ForceDirection,
            Direction = InferSocketDirection(localPosition),
            IsRuntimeSocket = true
        });
        return nozzle.transform;
    }

    private static PrototypeShipSocketDirection InferSocketDirection(Vector3 localPosition)
    {
        if (localPosition == Vector3.forward)
        {
            return PrototypeShipSocketDirection.Forward;
        }

        if (localPosition == Vector3.back)
        {
            return PrototypeShipSocketDirection.Back;
        }

        if (localPosition == Vector3.left)
        {
            return PrototypeShipSocketDirection.Left;
        }

        if (localPosition == Vector3.right)
        {
            return PrototypeShipSocketDirection.Right;
        }

        if (localPosition == Vector3.up)
        {
            return PrototypeShipSocketDirection.Up;
        }

        if (localPosition == Vector3.down)
        {
            return PrototypeShipSocketDirection.Down;
        }

        return PrototypeShipSocketDirection.Unknown;
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
