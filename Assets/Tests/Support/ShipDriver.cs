#if UNITY_EDITOR || UNITY_INCLUDE_TESTS
using UnityEngine;

public sealed class ShipDriver
{
    public ShipDriver(PrototypeShipRig rig)
        : this(rig.Controller, rig.Body, rig.Stats, rig.PhysicsCore, rig.Rcs)
    {
    }

    public ShipDriver(
        PlayerShipController controller,
        Rigidbody body,
        ShipStats stats,
        ShipPhysicsCore physicsCore,
        RcsThrusterController rcs)
    {
        Controller = controller;
        Body = body;
        Stats = stats;
        PhysicsCore = physicsCore;
        Rcs = rcs;
    }

    public PlayerShipController Controller { get; }
    public Rigidbody Body { get; }
    public ShipStats Stats { get; }
    public ShipPhysicsCore PhysicsCore { get; }
    public RcsThrusterController Rcs { get; }

    public void SetCruiseMode()
    {
        Controller.SetControlMode(FlightControlMode.Normal);
    }

    public void SetPrecisionMode()
    {
        Controller.SetControlMode(FlightControlMode.Precision);
    }

    public void SetTranslationMode()
    {
        Controller.SetControlMode(FlightControlMode.Translation);
    }

    public void SetMainThrottle(float normalizedThrottle)
    {
        Controller.SetMainThrottle(normalizedThrottle);
    }

    public void EnableRcs(bool enabled)
    {
        Controller.SetRcsEnabled(enabled);
    }

    public void EnableSas(bool enabled, SasControlMode mode = SasControlMode.KillRotation)
    {
        Controller.SetSasEnabled(enabled);
        Controller.SetSasMode(mode);
    }

    public void PulseRcsTranslation(Vector3 command)
    {
        Controller.PulseRcsTranslation(command);
    }

    public void PulseRcsAttitude(Vector3 command)
    {
        Controller.PulseRcsAttitude(command);
    }

    public void PulseMainThrust(float normalizedThrottle)
    {
        Controller.PulseMainThrust(normalizedThrottle);
    }

    public void Reset(Vector3 position, Quaternion rotation, bool cutMainThrottle = true)
    {
        Controller.ResetFlightState(position, rotation, cutMainThrottle);
    }

    public ShipSimulationSnapshot Snapshot(HeadlessSimulationRunner runner = null)
    {
        return SimulationSnapshots.CaptureShip(Controller, Body, Stats, PhysicsCore, Rcs, runner);
    }
}
#endif
