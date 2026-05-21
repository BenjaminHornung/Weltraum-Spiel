#if UNITY_EDITOR || UNITY_INCLUDE_TESTS
using UnityEngine;

public struct ShipSimulationSnapshot
{
    public int step;
    public float time;
    public Vector3 position;
    public Vector3 linearVelocity;
    public Vector3 angularVelocity;
    public float fuelKg;
    public float mainThrottle;
    public float mainThrustCommand;
    public Vector3 rcsTranslationCommand;
    public Vector3 rcsAttitudeCommand;
    public bool rcsEnabled;
    public bool sasEnabled;
    public FlightControlMode controlMode;
    public Vector3 netAppliedForce;
    public Vector3 netAppliedTorque;
    public Vector3 netAppliedImpulse;
    public Vector3 lastDesiredRcsForce;
    public Vector3 lastActualRcsForce;
    public Vector3 lastResidualRcsForce;
}

public struct AutopilotSimulationSnapshot
{
    public int step;
    public float time;
    public bool engaged;
    public PrototypeWaypointAutopilotState state;
    public PrototypeWaypointAutopilotArrivalPhase arrivalPhase;
    public PrototypeTrajectoryPhase trajectoryPhase;
    public float distance;
    public float closingSpeed;
    public float lateralSpeed;
    public float requestedMainThrottle;
    public Vector3 requestedRcsTranslation;
    public Vector3 requestedAcceleration;
    public bool obstacleDetected;
    public bool avoidanceActive;
    public Vector3 avoidanceWaypoint;
    public Vector3 avoidanceVector;
    public string status;
    public string failureReason;
}

public struct CombatSimulationSnapshot
{
    public int step;
    public float time;
    public bool autoFireEnabled;
    public string activeTargetName;
    public bool canFire;
    public PrototypeTurretFireBlockReason blockReason;
    public string status;
    public bool lastShotFired;
    public WeaponProjectileMode lastProjectileMode;
    public Vector3 lastProjectileVelocity;
    public Vector3 lastRecoilImpulse;
    public int activeProjectileCount;
    public int totalShotsProcessed;
}

public static class SimulationSnapshots
{
    public static ShipSimulationSnapshot CaptureShip(
        PlayerShipController controller,
        Rigidbody body,
        ShipStats stats,
        ShipPhysicsCore physicsCore,
        RcsThrusterController rcs,
        HeadlessSimulationRunner runner = null)
    {
        return new ShipSimulationSnapshot
        {
            step = runner != null ? runner.StepCount : 0,
            time = runner != null ? runner.ElapsedTime : Time.time,
            position = body != null ? body.position : Vector3.zero,
            linearVelocity = body != null ? body.linearVelocity : Vector3.zero,
            angularVelocity = body != null ? body.angularVelocity : Vector3.zero,
            fuelKg = stats != null ? stats.CurrentFuelKg : 0f,
            mainThrottle = controller != null ? controller.MainThrottle : 0f,
            mainThrustCommand = controller != null ? controller.MainThrustCommand : 0f,
            rcsTranslationCommand = controller != null ? controller.RcsTranslationCommand : Vector3.zero,
            rcsAttitudeCommand = controller != null ? controller.RcsAttitudeCommand : Vector3.zero,
            rcsEnabled = controller != null && controller.RcsEnabled,
            sasEnabled = controller != null && controller.EffectiveSasEnabled,
            controlMode = controller != null ? controller.ControlMode : FlightControlMode.Normal,
            netAppliedForce = physicsCore != null ? physicsCore.NetAppliedForce : Vector3.zero,
            netAppliedTorque = physicsCore != null ? physicsCore.NetAppliedTorque : Vector3.zero,
            netAppliedImpulse = physicsCore != null ? physicsCore.NetAppliedImpulse : Vector3.zero,
            lastDesiredRcsForce = rcs != null ? rcs.LastDesiredRcsForceWorld : Vector3.zero,
            lastActualRcsForce = rcs != null ? rcs.LastActualRcsForceWorld : Vector3.zero,
            lastResidualRcsForce = rcs != null ? rcs.LastResidualRcsForceWorld : Vector3.zero
        };
    }

    public static AutopilotSimulationSnapshot CaptureAutopilot(
        PrototypeWaypointAutopilot autopilot,
        Rigidbody body,
        HeadlessSimulationRunner runner = null)
    {
        if (autopilot == null)
        {
            return default;
        }

        PrototypeWaypointAutopilotMetrics metrics = autopilot.LastMetrics;
        return new AutopilotSimulationSnapshot
        {
            step = runner != null ? runner.StepCount : 0,
            time = runner != null ? runner.ElapsedTime : Time.time,
            engaged = autopilot.AutopilotEngaged,
            state = autopilot.CurrentState,
            arrivalPhase = autopilot.ArrivalPhase,
            trajectoryPhase = autopilot.LastTrajectoryPhase,
            distance = metrics.distance,
            closingSpeed = metrics.closingSpeed,
            lateralSpeed = metrics.lateralSpeed,
            requestedMainThrottle = autopilot.RequestedMainThrottle,
            requestedRcsTranslation = autopilot.RequestedRcsTranslation,
            requestedAcceleration = autopilot.RequestedAcceleration,
            obstacleDetected = autopilot.NavigationObstacleDetected,
            avoidanceActive = autopilot.AvoidanceActive,
            avoidanceWaypoint = autopilot.AvoidanceWaypoint,
            avoidanceVector = autopilot.AvoidanceVectorWorld,
            status = autopilot.ArrivalStatus,
            failureReason = autopilot.FailureReason
        };
    }

    public static CombatSimulationSnapshot CaptureCombat(
        PrototypeWeaponComputer computer,
        PrototypeTurretWeapon weapon,
        PrototypeProjectileSimulation simulation,
        HeadlessSimulationRunner runner = null)
    {
        PrototypeTurretFireStatus status = weapon != null ? weapon.LastFireStatus : default;
        PrototypeProjectileFireResult fireResult = weapon != null ? weapon.LastFireResult : default;
        return new CombatSimulationSnapshot
        {
            step = runner != null ? runner.StepCount : 0,
            time = runner != null ? runner.ElapsedTime : Time.time,
            autoFireEnabled = computer != null && computer.AutoFireEnabled,
            activeTargetName = computer != null && computer.ActiveTargetTransform != null ? computer.ActiveTargetTransform.name : string.Empty,
            canFire = status.canFire,
            blockReason = status.blockReason,
            status = !string.IsNullOrWhiteSpace(status.message) ? status.message : (status.canFire ? "ready" : "blocked"),
            lastShotFired = fireResult.fired,
            lastProjectileMode = fireResult.mode,
            lastProjectileVelocity = fireResult.projectileVelocityWorld,
            lastRecoilImpulse = weapon != null ? weapon.LastRecoilImpulseWorld : Vector3.zero,
            activeProjectileCount = simulation != null ? simulation.ActiveProjectileCount : 0,
            totalShotsProcessed = simulation != null ? simulation.TotalShotsProcessed : 0
        };
    }
}
#endif
