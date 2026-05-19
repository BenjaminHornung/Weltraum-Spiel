using System;
using System.Reflection;
using UnityEngine;

public static class PhysicsValidationProbe
{
    public const float ForceTolerance = 1f;
    public const float TorqueTolerance = 1f;
    public const float NozzleThrottleTolerance = 0.0001f;
    public const float FuelTolerance = 0.01f;
    public const float TimestepImpulseTolerance = 0.01f;

    public sealed class GeneratedShipFixture : IDisposable
    {
        public readonly GameObject Ship;
        public readonly Rigidbody Rigidbody;
        public readonly ShipStats Stats;
        public readonly ShipPhysicsCore PhysicsCore;
        public readonly MainThrusterModule MainThruster;
        public readonly RcsThrusterController Rcs;
        public readonly GunModule Gun;

        public GeneratedShipFixture()
        {
            Ship = new GameObject("PhysicsValidationShip");
            Ship.transform.position = Vector3.zero;
            Ship.transform.rotation = Quaternion.identity;

            Stats = Ship.AddComponent<ShipStats>();
            Rigidbody = Ship.AddComponent<Rigidbody>();
            Rigidbody.useGravity = false;
            Rigidbody.mass = Stats.CurrentMass;
            Rigidbody.linearDamping = 0f;
            Rigidbody.angularDamping = 0f;

            PhysicsCore = Ship.AddComponent<ShipPhysicsCore>();
            PhysicsCore.Configure(Rigidbody);

            Gun = Ship.AddComponent<GunModule>();
            MainThruster = Ship.AddComponent<MainThrusterModule>();
            Rcs = Ship.AddComponent<RcsThrusterController>();

            Transform nozzle = CreateMainNozzle(Ship.transform);
            CreateRcsBlock(Ship.transform, "RCS_Top", new Vector3(0f, 0.7f, 0f), new Vector3(0.55f, 0.22f, 0.55f), Vector3.down);
            CreateRcsBlock(Ship.transform, "RCS_Bottom", new Vector3(0f, -0.7f, 0f), new Vector3(0.55f, 0.22f, 0.55f), Vector3.up);
            CreateRcsBlock(Ship.transform, "RCS_Left", new Vector3(-1.02f, 0f, 0f), new Vector3(0.22f, 0.55f, 0.55f), Vector3.right);
            CreateRcsBlock(Ship.transform, "RCS_Right", new Vector3(1.02f, 0f, 0f), new Vector3(0.22f, 0.55f, 0.55f), Vector3.left);

            MainThruster.Configure(nozzle, Rigidbody, Stats, PhysicsCore);
            Rcs.ConfigureThrusters(
                Ship.transform.Find("RCS_Top"),
                Ship.transform.Find("RCS_Bottom"),
                Ship.transform.Find("RCS_Left"),
                Ship.transform.Find("RCS_Right"),
                null,
                null,
                Rigidbody,
                PhysicsCore);
        }

        public void Dispose()
        {
            DestroyGameObject(Ship);
        }
    }

    public struct MainThrustResult
    {
        public float appliedThrust;
        public Vector3 netForce;
        public Vector3 netTorque;
        public int applications;
    }

    public struct GimbalResult
    {
        public Vector3 steeringForce;
        public Vector3 expectedTorque;
        public Vector3 estimatedTorque;
        public Vector3 netTorque;
    }

    public struct RcsResult
    {
        public Vector3 force;
        public Vector3 torque;
        public int activeNozzles;
        public int applications;
        public int installedNozzles;
        public float maxNozzleThrottle;
    }

    public struct FuelPartialResult
    {
        public float appliedThrust;
        public float expectedThrust;
        public float remainingFuel;
    }

    public struct TimestepResult
    {
        public float impulseAt002;
        public float impulseAt001;
        public float fuelAt002;
        public float fuelAt001;
    }

    public static GeneratedShipFixture CreateGeneratedShip()
    {
        return new GeneratedShipFixture();
    }

    public static MainThrustResult RunMainThrust(GeneratedShipFixture fixture, float throttle, float deltaTime)
    {
        fixture.PhysicsCore.BeginPhysicsStep();
        float applied = fixture.MainThruster.Fire(throttle, 0f, 0f, deltaTime);
        return new MainThrustResult
        {
            appliedThrust = applied,
            netForce = fixture.PhysicsCore.NetAppliedForce,
            netTorque = fixture.PhysicsCore.NetAppliedTorque,
            applications = fixture.PhysicsCore.AppliedForceCount
        };
    }

    public static GimbalResult RunGimbal(GeneratedShipFixture fixture, float yawCommand, float pitchCommand, float deltaTime)
    {
        fixture.PhysicsCore.BeginPhysicsStep();
        fixture.MainThruster.Fire(1f, yawCommand, pitchCommand, deltaTime);
        Vector3 expectedTorque = Vector3.Cross(
            fixture.MainThruster.LastForcePositionWorld - fixture.Rigidbody.worldCenterOfMass,
            fixture.MainThruster.LastSteeringForceWorld);

        return new GimbalResult
        {
            steeringForce = fixture.MainThruster.LastSteeringForceWorld,
            expectedTorque = expectedTorque,
            estimatedTorque = fixture.MainThruster.LastEstimatedTorque,
            netTorque = fixture.PhysicsCore.NetAppliedTorque
        };
    }

    public static RcsResult RunRcs(GeneratedShipFixture fixture, Vector3 translationCommand, Vector3 attitudeCommand)
    {
        fixture.PhysicsCore.BeginPhysicsStep();
        fixture.Rcs.ApplyControls(translationCommand, attitudeCommand, false, 0.02f);
        return new RcsResult
        {
            force = fixture.PhysicsCore.NetAppliedForce,
            torque = fixture.PhysicsCore.NetAppliedTorque,
            activeNozzles = fixture.Rcs.ActiveNozzleCount,
            applications = fixture.Rcs.LastNozzleApplicationCount,
            installedNozzles = fixture.Rcs.InstalledNozzleCount,
            maxNozzleThrottle = fixture.Rcs.LastMaxNozzleThrottle
        };
    }

    public static FuelPartialResult RunFuelPartialStep()
    {
        using (GeneratedShipFixture fixture = CreateGeneratedShip())
        {
            SetPrivateFloat(fixture.Stats, "currentFuelKg", 0.3f);
            SetPrivateFloat(fixture.Stats, "fullThrottleFuelKgPerSecond", 0.6f);
            fixture.PhysicsCore.BeginPhysicsStep();
            float applied = fixture.MainThruster.Fire(1f, 0f, 0f, 1f);
            return new FuelPartialResult
            {
                appliedThrust = applied,
                expectedThrust = fixture.Stats.Thrust * 0.5f,
                remainingFuel = fixture.Stats.CurrentFuelKg
            };
        }
    }

    public static TimestepResult CompareMainThrustTimesteps()
    {
        float impulseAt002;
        float fuelAt002;
        RunMainThrustSteps(0.02f, 50, out impulseAt002, out fuelAt002);

        float impulseAt001;
        float fuelAt001;
        RunMainThrustSteps(0.01f, 100, out impulseAt001, out fuelAt001);

        return new TimestepResult
        {
            impulseAt002 = impulseAt002,
            impulseAt001 = impulseAt001,
            fuelAt002 = fuelAt002,
            fuelAt001 = fuelAt001
        };
    }

    public static bool HasProjectileRecoilPath()
    {
        const BindingFlags flags = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;
        foreach (FieldInfo field in typeof(GunModule).GetFields(flags))
        {
            if (field.Name.IndexOf("recoil", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                return true;
            }
        }

        foreach (MethodInfo method in typeof(GunModule).GetMethods(flags))
        {
            if (method.Name.IndexOf("recoil", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                return true;
            }
        }

        return false;
    }

    private static void RunMainThrustSteps(float deltaTime, int steps, out float impulse, out float remainingFuel)
    {
        using (GeneratedShipFixture fixture = CreateGeneratedShip())
        {
            impulse = 0f;
            for (int i = 0; i < steps; i++)
            {
                fixture.PhysicsCore.BeginPhysicsStep();
                float applied = fixture.MainThruster.Fire(1f, 0f, 0f, deltaTime);
                impulse += applied * deltaTime;
            }

            remainingFuel = fixture.Stats.CurrentFuelKg;
        }
    }

    private static Transform CreateMainNozzle(Transform ship)
    {
        var gimbal = new GameObject("MainThrusterGimbal");
        gimbal.transform.SetParent(ship, false);
        gimbal.transform.localPosition = new Vector3(0f, 0f, -3.35f);
        gimbal.transform.localRotation = Quaternion.identity;

        var nozzle = new GameObject("MainThrusterNozzle");
        nozzle.transform.SetParent(gimbal.transform, false);
        nozzle.transform.localPosition = new Vector3(0f, 0f, -0.55f);
        nozzle.transform.localRotation = Quaternion.identity;
        return nozzle.transform;
    }

    private static void CreateRcsBlock(Transform ship, string blockName, Vector3 localPosition, Vector3 localScale, Vector3 blockedDirection)
    {
        var block = GameObject.CreatePrimitive(PrimitiveType.Cube);
        block.name = blockName;
        block.transform.SetParent(ship, false);
        block.transform.localPosition = localPosition;
        block.transform.localScale = localScale;

        var thrusterBlock = block.AddComponent<RcsThrusterBlock>();
        thrusterBlock.ConfigureDefault(6500f);

        Vector3[] directions = { Vector3.forward, Vector3.back, Vector3.left, Vector3.right, Vector3.up, Vector3.down };
        for (int i = 0; i < directions.Length; i++)
        {
            Vector3 direction = directions[i];
            if (Vector3.Dot(direction, blockedDirection) > 0.95f)
            {
                continue;
            }

            CreateRcsNozzle(block.transform, blockName, DirectionName(direction), direction);
        }
    }

    private static void CreateRcsNozzle(Transform block, string blockName, string directionName, Vector3 localDirection)
    {
        var nozzle = new GameObject("RCS_Nozzle_" + blockName + "_" + directionName);
        nozzle.transform.SetParent(block, false);
        nozzle.transform.localPosition = localDirection.normalized * 0.38f;
        nozzle.transform.localRotation = LookRotationLocal(localDirection.normalized);

        var vfx = new GameObject("VFX");
        vfx.transform.SetParent(nozzle.transform, false);
        vfx.SetActive(false);
    }

    private static Quaternion LookRotationLocal(Vector3 localDirection)
    {
        Vector3 up = Mathf.Abs(Vector3.Dot(localDirection, Vector3.up)) > 0.9f ? Vector3.forward : Vector3.up;
        return Quaternion.LookRotation(localDirection, up);
    }

    private static string DirectionName(Vector3 direction)
    {
        if (direction == Vector3.forward) return "Forward";
        if (direction == Vector3.back) return "Back";
        if (direction == Vector3.left) return "Left";
        if (direction == Vector3.right) return "Right";
        if (direction == Vector3.up) return "Up";
        return "Down";
    }

    private static void SetPrivateFloat(object target, string fieldName, float value)
    {
        FieldInfo field = target.GetType().GetField(fieldName, BindingFlags.Instance | BindingFlags.NonPublic);
        if (field == null)
        {
            throw new MissingFieldException(target.GetType().Name, fieldName);
        }

        field.SetValue(target, value);
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
