#if UNITY_EDITOR || UNITY_INCLUDE_TESTS
using System;
using System.Collections.Generic;
using UnityEngine;

public sealed class PrototypeScenarioBuilder : IDisposable
{
    private readonly List<GameObject> ownedObjects = new List<GameObject>();
    private bool disposed;

    public PrototypeShipRig CreateShip(string name = "HeadlessSimulationShip")
    {
        GameObject ship = Track(new GameObject(name));
        ship.transform.SetPositionAndRotation(Vector3.zero, Quaternion.identity);

        ShipStats stats = ship.AddComponent<ShipStats>();
        Rigidbody body = ship.AddComponent<Rigidbody>();
        body.useGravity = false;
        body.linearDamping = 0f;
        body.angularDamping = 0f;

        ShipPhysicsCore physicsCore = ship.AddComponent<ShipPhysicsCore>();
        physicsCore.Configure(body);

        GunModule gun = ship.AddComponent<GunModule>();
        MainThrusterBank mainThruster = ship.AddComponent<MainThrusterBank>();
        ship.AddComponent<EngineVfxController>();
        RcsThrusterController rcs = ship.AddComponent<RcsThrusterController>();
        MainThrusterModule mainModule = ship.AddComponent<MainThrusterModule>();
        PlayerShipController controller = ship.AddComponent<PlayerShipController>();

        Transform mainNozzle = CreateMainNozzle(ship.transform);
        mainModule.Configure(mainNozzle, body, stats, physicsCore);
        mainThruster.Configure(new[] { mainModule }, body, stats, physicsCore);

        ConfigureRcsNozzles(ship.transform, rcs, body, physicsCore);
        stats.ApplyMassProperties(body);
        controller.ResetStartupFlightControls(ship.transform.position, ship.transform.rotation);

        return new PrototypeShipRig(ship, body, stats, physicsCore, mainThruster, mainModule, rcs, gun, controller);
    }

    public PrototypeAutopilotRig CreateAutopilotRig(
        string shipName = "HeadlessAutopilotShip",
        Vector3? targetPosition = null,
        float arrivalRadius = 10f)
    {
        PrototypeShipRig ship = CreateShip(shipName);
        PrototypeNavigationTarget target = CreateTarget("HeadlessAutopilotTarget", targetPosition ?? Vector3.forward * 150f, arrivalRadius);
        PrototypeWaypointAutopilot autopilot = ship.Ship.GetComponent<PrototypeWaypointAutopilot>();
        if (autopilot == null)
        {
            autopilot = ship.Ship.AddComponent<PrototypeWaypointAutopilot>();
        }

        autopilot.Bind(null, ship.Controller, ship.Stats, ship.Body);
        autopilot.SelectTarget(target);
        return new PrototypeAutopilotRig(ship, autopilot, target);
    }

    public PrototypeCombatRig CreateCombatRig(string shipName = "HeadlessCombatShip")
    {
        PrototypeShipRig ship = CreateShip(shipName);
        Transform baseMarker = CreateChild(ship.Ship.transform, "WEAPON_TURRET_BASE_HEADLESS");
        Transform yaw = CreateChild(baseMarker, "WEAPON_TURRET_YAW_HEADLESS");
        Transform pitch = CreateChild(yaw, "WEAPON_TURRET_PITCH_HEADLESS");
        Transform muzzle = CreateChild(pitch, "WEAPON_MUZZLE_HEADLESS");
        muzzle.localPosition = Vector3.forward;

        PrototypeTurretMount mount = baseMarker.gameObject.AddComponent<PrototypeTurretMount>();
        mount.Configure(baseMarker, yaw, pitch, muzzle, null);

        PrototypeTurretWeapon weapon = baseMarker.gameObject.AddComponent<PrototypeTurretWeapon>();
        weapon.Configure(ship.Stats, ship.Body, ship.PhysicsCore, mount);

        PrototypeWeaponComputer computer = ship.Ship.GetComponent<PrototypeWeaponComputer>();
        if (computer == null)
        {
            computer = ship.Ship.AddComponent<PrototypeWeaponComputer>();
        }

        computer.Bind(ship.Ship.transform, ship.Stats, weapon);
        computer.ClearSelection();
        return new PrototypeCombatRig(ship, mount, weapon, computer, muzzle);
    }

    public PrototypeNavigationTarget CreateTarget(string name, Vector3 position, float arrivalRadius = 10f)
    {
        GameObject targetObject = Track(new GameObject(name));
        targetObject.transform.position = position;
        PrototypeNavigationTarget target = targetObject.AddComponent<PrototypeNavigationTarget>();
        target.Configure(name, arrivalRadius);
        return target;
    }

    public PrototypeNavigationObstacle CreateObstacle(
        string name,
        Vector3 position,
        float radius,
        float clearanceMeters = 8f,
        bool blocksAutopilot = true,
        bool withCollider = true)
    {
        GameObject obstacleObject = withCollider
            ? GameObject.CreatePrimitive(PrimitiveType.Sphere)
            : new GameObject(name);
        Track(obstacleObject);
        obstacleObject.name = name;
        obstacleObject.transform.position = position;
        obstacleObject.transform.localScale = Vector3.one * Mathf.Max(0.1f, radius) * 2f;

        Collider obstacleCollider = obstacleObject.GetComponent<Collider>();
        if (obstacleCollider != null)
        {
            obstacleCollider.isTrigger = true;
        }

        PrototypeNavigationObstacle obstacle = obstacleObject.AddComponent<PrototypeNavigationObstacle>();
        obstacle.Configure(radius, clearanceMeters, blocksAutopilot);
        obstacle.SetDebugGizmoVisible(false);
        return obstacle;
    }

    public Transform CreateWeaponTarget(
        string name,
        Vector3 position,
        float maxIntegrity = 100f,
        float integrityFraction = 1f)
    {
        GameObject target = Track(new GameObject(name));
        target.transform.position = position;
        Rigidbody body = target.AddComponent<Rigidbody>();
        body.useGravity = false;
        target.AddComponent<PrototypeWeaponTargetMarker>().Configure(target.transform);

        GameObject module = new GameObject(name + "_Damage");
        module.transform.SetParent(target.transform, false);
        PrototypeModuleDamageState damageState = module.AddComponent<PrototypeModuleDamageState>();
        damageState.Configure(name, maxIntegrity, 0f);
        damageState.SetIntegrityFraction(integrityFraction);

        return target.transform;
    }

    public PrototypeProjectileSimulation CreateProjectileSimulation()
    {
        bool hadExistingSimulation = PrototypeProjectileSimulation.Instance != null;
        PrototypeProjectileSimulation simulation = PrototypeProjectileSimulation.GetOrCreateDefault();
        if (!hadExistingSimulation && simulation != null)
        {
            Track(simulation.gameObject);
        }

        simulation.ClearRuntime();
        return simulation;
    }

    public void Dispose()
    {
        if (disposed)
        {
            return;
        }

        if (PrototypeProjectileSimulation.Instance != null)
        {
            PrototypeProjectileSimulation.Instance.ClearRuntime();
        }

        PrototypeWeaponTargetRegistry.ClearForTests();
        for (int i = ownedObjects.Count - 1; i >= 0; i--)
        {
            DestroyGameObject(ownedObjects[i]);
        }

        ownedObjects.Clear();
        disposed = true;
    }

    private GameObject Track(GameObject gameObject)
    {
        if (gameObject != null && !ownedObjects.Contains(gameObject))
        {
            ownedObjects.Add(gameObject);
        }

        return gameObject;
    }

    private static Transform CreateMainNozzle(Transform ship)
    {
        Transform gimbal = CreateChild(ship, "MainThrusterGimbal");
        gimbal.localPosition = new Vector3(0f, 0f, -3.35f);
        Transform nozzle = CreateChild(gimbal, "MainThrusterNozzle");
        nozzle.localPosition = new Vector3(0f, 0f, -0.55f);
        return nozzle;
    }

    private static void ConfigureRcsNozzles(Transform shipTransform, RcsThrusterController rcs, Rigidbody body, ShipPhysicsCore physicsCore)
    {
        Transform up = CreateRcsNozzle(shipTransform, "RCS_Nozzle_Up", Vector3.up, Vector3.up);
        Transform down = CreateRcsNozzle(shipTransform, "RCS_Nozzle_Down", Vector3.down, Vector3.down);
        Transform left = CreateRcsNozzle(shipTransform, "RCS_Nozzle_Left", Vector3.left, Vector3.left);
        Transform right = CreateRcsNozzle(shipTransform, "RCS_Nozzle_Right", Vector3.right, Vector3.right);
        Transform forward = CreateRcsNozzle(shipTransform, "RCS_Nozzle_Forward", Vector3.forward, Vector3.forward);
        Transform back = CreateRcsNozzle(shipTransform, "RCS_Nozzle_Back", Vector3.back, Vector3.back);

        rcs.ConfigureThrusters(up, down, left, right, forward, back, body, physicsCore);
    }

    private static Transform CreateRcsNozzle(Transform parent, string name, Vector3 localPosition, Vector3 localForward)
    {
        Transform nozzle = CreateChild(parent, name);
        nozzle.localPosition = localPosition;
        nozzle.localRotation = Quaternion.LookRotation(localForward, Mathf.Abs(Vector3.Dot(localForward, Vector3.up)) > 0.9f ? Vector3.forward : Vector3.up);
        return nozzle;
    }

    private static Transform CreateChild(Transform parent, string name)
    {
        GameObject child = new GameObject(name);
        child.transform.SetParent(parent, false);
        return child.transform;
    }

    private static void DestroyGameObject(GameObject target)
    {
        if (target == null)
        {
            return;
        }

        if (Application.isPlaying)
        {
            UnityEngine.Object.Destroy(target);
        }
        else
        {
            UnityEngine.Object.DestroyImmediate(target);
        }
    }
}

public readonly struct PrototypeShipRig
{
    public PrototypeShipRig(
        GameObject ship,
        Rigidbody body,
        ShipStats stats,
        ShipPhysicsCore physicsCore,
        MainThrusterBank mainThruster,
        MainThrusterModule mainThrusterModule,
        RcsThrusterController rcs,
        GunModule gun,
        PlayerShipController controller)
    {
        Ship = ship;
        Body = body;
        Stats = stats;
        PhysicsCore = physicsCore;
        MainThruster = mainThruster;
        MainThrusterModule = mainThrusterModule;
        Rcs = rcs;
        Gun = gun;
        Controller = controller;
    }

    public GameObject Ship { get; }
    public Rigidbody Body { get; }
    public ShipStats Stats { get; }
    public ShipPhysicsCore PhysicsCore { get; }
    public MainThrusterBank MainThruster { get; }
    public MainThrusterModule MainThrusterModule { get; }
    public RcsThrusterController Rcs { get; }
    public GunModule Gun { get; }
    public PlayerShipController Controller { get; }
}

public readonly struct PrototypeAutopilotRig
{
    public PrototypeAutopilotRig(PrototypeShipRig ship, PrototypeWaypointAutopilot autopilot, PrototypeNavigationTarget target)
    {
        Ship = ship;
        Autopilot = autopilot;
        Target = target;
    }

    public PrototypeShipRig Ship { get; }
    public PrototypeWaypointAutopilot Autopilot { get; }
    public PrototypeNavigationTarget Target { get; }
}

public readonly struct PrototypeCombatRig
{
    public PrototypeCombatRig(
        PrototypeShipRig ship,
        PrototypeTurretMount mount,
        PrototypeTurretWeapon weapon,
        PrototypeWeaponComputer computer,
        Transform muzzle)
    {
        Ship = ship;
        Mount = mount;
        Weapon = weapon;
        Computer = computer;
        Muzzle = muzzle;
    }

    public PrototypeShipRig Ship { get; }
    public PrototypeTurretMount Mount { get; }
    public PrototypeTurretWeapon Weapon { get; }
    public PrototypeWeaponComputer Computer { get; }
    public Transform Muzzle { get; }
}
#endif
