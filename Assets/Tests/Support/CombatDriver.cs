#if UNITY_EDITOR || UNITY_INCLUDE_TESTS
using UnityEngine;

public sealed class CombatDriver
{
    public CombatDriver(PrototypeCombatRig rig)
        : this(rig.Computer, rig.Weapon, rig.Ship.PhysicsCore)
    {
    }

    public CombatDriver(PrototypeWeaponComputer computer, PrototypeTurretWeapon weapon, ShipPhysicsCore physicsCore)
    {
        Computer = computer;
        Weapon = weapon;
        PhysicsCore = physicsCore;
    }

    public PrototypeWeaponComputer Computer { get; }
    public PrototypeTurretWeapon Weapon { get; }
    public ShipPhysicsCore PhysicsCore { get; }

    public void RefreshTargets()
    {
        Computer.RefreshTargets();
    }

    public void SetPriority(PrototypeWeaponTargetPriorityMode mode)
    {
        Computer.SetPriorityMode(mode);
    }

    public void EnableAutoFire(bool enabled)
    {
        Computer.SetAutoFireEnabled(enabled);
    }

    public bool SelectTarget(Transform targetTransform)
    {
        if (targetTransform == null)
        {
            return false;
        }

        Computer.RefreshTargets();
        for (int i = 0; i < Computer.AvailableTargets.Count; i++)
        {
            PrototypeWeaponTarget target = Computer.AvailableTargets[i];
            if (target != null && target.TargetTransform == targetTransform)
            {
                if (!Computer.IsSelected(target))
                {
                    Computer.ToggleTarget(target);
                }

                return true;
            }
        }

        return false;
    }

    public bool TickAutoFire(bool beginPhysicsStep = true)
    {
        if (beginPhysicsStep && PhysicsCore != null)
        {
            PhysicsCore.BeginPhysicsStep();
        }

        Computer.UpdateActiveTargetAndStatus();
        if (!Computer.AutoFireEnabled || Computer.ActiveTargetTransform == null || Weapon == null)
        {
            return false;
        }

        return Weapon.TryFireAt(Computer.ActiveTargetTransform);
    }

    public void StepProjectiles(float deltaTime)
    {
        PrototypeProjectileSimulation simulation = PrototypeProjectileSimulation.Instance;
        if (simulation != null)
        {
            simulation.Simulate(deltaTime);
        }
    }

    public CombatSimulationSnapshot Snapshot(HeadlessSimulationRunner runner = null)
    {
        return SimulationSnapshots.CaptureCombat(Computer, Weapon, PrototypeProjectileSimulation.Instance, runner);
    }
}
#endif
