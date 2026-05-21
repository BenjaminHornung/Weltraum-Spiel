#if UNITY_EDITOR || UNITY_INCLUDE_TESTS
using UnityEngine;

public sealed class AutopilotDriver
{
    public AutopilotDriver(PrototypeAutopilotRig rig)
        : this(rig.Autopilot, rig.Ship.Controller, rig.Ship.Body)
    {
    }

    public AutopilotDriver(PrototypeWaypointAutopilot autopilot, PlayerShipController controller, Rigidbody body)
    {
        Autopilot = autopilot;
        Controller = controller;
        Body = body;
    }

    public PrototypeWaypointAutopilot Autopilot { get; }
    public PlayerShipController Controller { get; }
    public Rigidbody Body { get; }

    public void SelectTarget(PrototypeNavigationTarget target)
    {
        Autopilot.SelectTarget(target);
    }

    public void Engage()
    {
        if (!Autopilot.AutopilotEngaged)
        {
            Autopilot.ToggleAutopilot();
        }
    }

    public void Abort(string reason = "test abort")
    {
        Autopilot.Abort(reason);
    }

    public void Replan()
    {
        Autopilot.ReplanNow();
    }

    public bool RunUntilState(HeadlessSimulationRunner runner, PrototypeWaypointAutopilotState expectedState, int maxSteps)
    {
        return RunUntil(runner, () => Autopilot.CurrentState == expectedState, maxSteps);
    }

    public bool RunUntilArrived(HeadlessSimulationRunner runner, int maxSteps)
    {
        return RunUntil(
            runner,
            () => Autopilot.CurrentState == PrototypeWaypointAutopilotState.Complete
                || Autopilot.CurrentState == PrototypeWaypointAutopilotState.HoldPosition,
            maxSteps);
    }

    public AutopilotSimulationSnapshot Snapshot(HeadlessSimulationRunner runner = null)
    {
        return SimulationSnapshots.CaptureAutopilot(Autopilot, Body, runner);
    }

    private static bool RunUntil(HeadlessSimulationRunner runner, System.Func<bool> predicate, int maxSteps)
    {
        if (runner == null)
        {
            throw new System.ArgumentNullException(nameof(runner));
        }

        int safeMaxSteps = Mathf.Max(0, maxSteps);
        for (int i = 0; i < safeMaxSteps; i++)
        {
            if (predicate())
            {
                return true;
            }

            runner.Step();
        }

        return predicate();
    }
}
#endif
