using System;
using System.Reflection;
using UnityEngine;

public static class PhysicsValidationProbe
{
    public const float ForceTolerance = 1f;
    public const float RcsResidualForceTolerance = 2f;
    public const float TorqueTolerance = 1f;
    public const float NozzleThrottleTolerance = 0.0001f;
    public const float FuelTolerance = 0.01f;
    public const float TimestepImpulseTolerance = 0.01f;
    public const float CenterOfMassTolerance = 0.0001f;
    public const float InertiaTolerance = 0.01f;

    public sealed class GeneratedShipFixture : IDisposable
    {
        public readonly GameObject Ship;
        public readonly Rigidbody Rigidbody;
        public readonly ShipStats Stats;
        public readonly ShipPhysicsCore PhysicsCore;
        public readonly MainThrusterModule MainThruster;
        public readonly PrototypeThermalModule MainThermal;
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
            MainThermal = nozzle.parent.gameObject.AddComponent<PrototypeThermalModule>();
            MainThermal.Configure(
                "Main Thruster",
                false,
                180f,
                85f,
                450f,
                6f,
                120f,
                20f,
                true,
                PrototypeThermalModule.OverheatEffect.DisableModule);
            CreateRcsBlock(Ship.transform, "RCS_Top", new Vector3(0f, 0.7f, 0f), new Vector3(0.55f, 0.22f, 0.55f), Vector3.down);
            CreateRcsBlock(Ship.transform, "RCS_Bottom", new Vector3(0f, -0.7f, 0f), new Vector3(0.55f, 0.22f, 0.55f), Vector3.up);
            CreateRcsBlock(Ship.transform, "RCS_Left", new Vector3(-1.02f, 0f, 0f), new Vector3(0.22f, 0.55f, 0.55f), Vector3.right);
            CreateRcsBlock(Ship.transform, "RCS_Right", new Vector3(1.02f, 0f, 0f), new Vector3(0.22f, 0.55f, 0.55f), Vector3.left);
            CreateMassPart(Ship.transform, "Hull", Vector3.zero, new Vector3(1.8f, 1.1f, 6.0f));
            CreateMassPart(Ship.transform, "Cockpit", new Vector3(0f, 0.45f, 2.05f), new Vector3(1.0f, 0.45f, 1.0f));
            CreateMassPart(Ship.transform, "FuelTank", new Vector3(0f, -0.45f, 0.1f), new Vector3(1.2f, 0.35f, 2.1f));
            CreateMassPart(Ship.transform, "Gun", new Vector3(0f, 0.1f, 3.25f), new Vector3(0.32f, 0.22f, 0.65f));
            PrototypeModuleMassLayout.ConfigureGeneratedPrototypeDescriptors(Ship.transform, Stats);
            Stats.ApplyMassProperties(Rigidbody);

            MainThruster.Configure(nozzle, Rigidbody, Stats, PhysicsCore, MainThermal);
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
        public MainThrustMode mode;
        public float appliedThrust;
        public Vector3 forceWorld;
        public Vector3 straightForce;
        public Vector3 steeringForce;
        public Vector3 forcePositionWorld;
        public Vector3 estimatedTorque;
        public Vector3 netForce;
        public Vector3 netTorque;
        public int applications;
    }

    public struct GimbalResult
    {
        public MainThrustMode mode;
        public Vector3 forceWorld;
        public Vector3 steeringForce;
        public Vector3 forcePositionWorld;
        public Vector3 expectedTorque;
        public Vector3 estimatedTorque;
        public Vector3 netTorque;
    }

    public struct RcsResult
    {
        public Vector3 force;
        public Vector3 torque;
        public Vector3 desiredForce;
        public Vector3 actualForce;
        public Vector3 residualForce;
        public Vector3 desiredTorque;
        public Vector3 actualTorque;
        public Vector3 residualTorque;
        public int activeNozzles;
        public int applications;
        public int installedNozzles;
        public float maxNozzleThrottle;
        public float allocatedThrottleTotal;
        public float fuelRequested;
        public float fuelConsumed;
        public float fuelFraction;
    }

    public struct ProjectileMassResult
    {
        public float configuredMass;
        public float projectileSpeed;
        public float rigidbodyMass;
        public float projectileMass;
        public Vector3 muzzleForward;
        public Vector3 recoilImpulse;
        public Vector3 netImpulse;
        public Vector3 netForce;
        public float impactImpulseMagnitude;
        public bool createdProjectileGameObject;
        public bool fired;
    }

    public struct ImpulseDiagnosticsResult
    {
        public Vector3 force;
        public Vector3 torque;
        public Vector3 impulse;
        public Vector3 angularImpulse;
        public int forceCount;
        public int impulseCount;
    }

    public struct ManualPriorityResult
    {
        public Vector3 manualTorqueLocal;
        public Vector3 sasTorqueLocal;
        public Vector3 desiredTorqueLocal;
    }

    public struct ConfigDefaultsResult
    {
        public float projectileMass;
        public float projectileSpeed;
        public float mainThrottleScale;
        public float rcsTranslationForce;
        public float rcsBlockThrust;
    }

    public struct FuelPartialResult
    {
        public float appliedThrust;
        public float expectedThrust;
        public float remainingFuel;
    }

    public struct MainFuelScalingResult
    {
        public float fullThrottleFuel;
        public float halfThrottleFuel;
        public float zeroThrottleFuel;
        public float zeroCostThrust;
        public float zeroCostFuel;
    }

    public struct TimestepResult
    {
        public float impulseAt002;
        public float impulseAt001;
        public float fuelAt002;
        public float fuelAt001;
    }

    public struct MassPropertiesResult
    {
        public float totalMass;
        public float expectedMass;
        public Vector3 centerOfMass;
        public Vector3 expectedCenterOfMass;
        public Vector3 inertiaTensor;
        public int moduleCount;
    }

    public struct FuelMassConsumptionResult
    {
        public float initialMass;
        public float finalMass;
        public float fuelConsumed;
        public float expectedMassDrop;
    }

    public struct InertiaComparisonResult
    {
        public float compactInertiaZ;
        public float wideInertiaZ;
        public float compactAngularAcceleration;
        public float wideAngularAcceleration;
    }

    public struct ThermalStepResult
    {
        public float initialTemperature;
        public float finalTemperature;
        public float appliedThrust;
        public float powerDrawKw;
        public bool overheated;
        public bool disabledByOverheat;
    }

    public struct GravityResult
    {
        public bool applied;
        public string bodyName;
        public float distance;
        public Vector3 acceleration;
        public Vector3 force;
        public Vector3 netTorque;
        public int applications;
    }

    public static GeneratedShipFixture CreateGeneratedShip()
    {
        return new GeneratedShipFixture();
    }

    public static MainThrustResult RunMainThrust(GeneratedShipFixture fixture, float throttle, float deltaTime)
    {
        return RunMainThrustWithMode(fixture, MainThrustMode.ComSafeSteeringOnly, throttle, 0f, 0f, deltaTime);
    }

    public static MainThrustResult RunMainThrustWithMode(
        GeneratedShipFixture fixture,
        MainThrustMode mode,
        float throttle,
        float yawCommand,
        float pitchCommand,
        float deltaTime)
    {
        fixture.MainThruster.SetThrustMode(mode);
        fixture.PhysicsCore.BeginPhysicsStep();
        float applied = fixture.MainThruster.Fire(throttle, yawCommand, pitchCommand, deltaTime);
        return new MainThrustResult
        {
            mode = fixture.MainThruster.ThrustMode,
            appliedThrust = applied,
            forceWorld = fixture.MainThruster.LastForceWorld,
            straightForce = fixture.MainThruster.LastStraightForceWorld,
            steeringForce = fixture.MainThruster.LastSteeringForceWorld,
            forcePositionWorld = fixture.MainThruster.LastForcePositionWorld,
            estimatedTorque = fixture.MainThruster.LastEstimatedTorque,
            netForce = fixture.PhysicsCore.NetAppliedForce,
            netTorque = fixture.PhysicsCore.NetAppliedTorque,
            applications = fixture.PhysicsCore.AppliedForceCount
        };
    }

    public static GimbalResult RunGimbal(GeneratedShipFixture fixture, float yawCommand, float pitchCommand, float deltaTime)
    {
        return RunGimbalWithMode(fixture, MainThrustMode.ComSafeSteeringOnly, yawCommand, pitchCommand, deltaTime);
    }

    public static GimbalResult RunGimbalWithMode(
        GeneratedShipFixture fixture,
        MainThrustMode mode,
        float yawCommand,
        float pitchCommand,
        float deltaTime)
    {
        fixture.MainThruster.SetThrustMode(mode);
        fixture.PhysicsCore.BeginPhysicsStep();
        fixture.MainThruster.Fire(1f, yawCommand, pitchCommand, deltaTime);
        Vector3 torqueForce = fixture.MainThruster.ThrustMode == MainThrustMode.FullyPhysicalNozzleForce
            ? fixture.MainThruster.LastForceWorld
            : fixture.MainThruster.LastSteeringForceWorld;
        Vector3 expectedTorque = Vector3.Cross(
            fixture.MainThruster.LastForcePositionWorld - fixture.Rigidbody.worldCenterOfMass,
            torqueForce);

        return new GimbalResult
        {
            mode = fixture.MainThruster.ThrustMode,
            forceWorld = fixture.MainThruster.LastForceWorld,
            steeringForce = fixture.MainThruster.LastSteeringForceWorld,
            forcePositionWorld = fixture.MainThruster.LastForcePositionWorld,
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
            desiredForce = fixture.Rcs.LastDesiredRcsForceWorld,
            actualForce = fixture.Rcs.LastActualRcsForceWorld,
            residualForce = fixture.Rcs.LastResidualRcsForceWorld,
            desiredTorque = fixture.Rcs.LastDesiredRcsTorqueWorld,
            actualTorque = fixture.Rcs.LastActualRcsTorqueWorld,
            residualTorque = fixture.Rcs.LastResidualRcsTorqueWorld,
            activeNozzles = fixture.Rcs.ActiveNozzleCount,
            applications = fixture.Rcs.LastNozzleApplicationCount,
            installedNozzles = fixture.Rcs.InstalledNozzleCount,
            maxNozzleThrottle = fixture.Rcs.LastMaxNozzleThrottle,
            allocatedThrottleTotal = fixture.Rcs.LastAllocatedNozzleThrottleTotal,
            fuelRequested = fixture.Rcs.LastFuelRequestedKg,
            fuelConsumed = fixture.Rcs.LastFuelConsumedKg,
            fuelFraction = fixture.Rcs.LastAppliedFuelFraction
        };
    }

    public static ProjectileMassResult RunProjectileMassConsistency(float projectileMass, float projectileSpeed)
    {
        using (GeneratedShipFixture fixture = CreateGeneratedShip())
        {
            SetPrivateFloat(fixture.Gun, "projectileMass", projectileMass);
            SetPrivateFloat(fixture.Stats, "projectileSpeed", projectileSpeed);
            fixture.PhysicsCore.BeginPhysicsStep();
            bool fired = fixture.Gun.TryFire();
            Projectile projectile = UnityEngine.Object.FindAnyObjectByType<Projectile>();
            Rigidbody projectileBody = projectile != null ? projectile.GetComponent<Rigidbody>() : null;
            float runtimeProjectileMass = projectile != null ? projectile.ProjectileMassKg : fixture.Gun.ProjectileMass;
            float impactImpulse = PrototypeImpactEventData.EstimateImpulse(
                fixture.Gun.LastProjectileVelocityWorld - fixture.Rigidbody.linearVelocity,
                runtimeProjectileMass).magnitude;

            ProjectileMassResult result = new ProjectileMassResult
            {
                configuredMass = projectileMass,
                projectileSpeed = projectileSpeed,
                rigidbodyMass = projectileBody != null ? projectileBody.mass : 0f,
                projectileMass = runtimeProjectileMass,
                muzzleForward = fixture.Gun.LastProjectileVelocityWorld.normalized,
                recoilImpulse = fixture.Gun.LastRecoilImpulseWorld,
                netImpulse = fixture.PhysicsCore.NetAppliedImpulse,
                netForce = fixture.PhysicsCore.NetAppliedForce,
                impactImpulseMagnitude = impactImpulse,
                createdProjectileGameObject = projectile != null,
                fired = fired
            };

            if (projectile != null)
            {
                DestroyGameObject(projectile.gameObject);
            }

            return result;
        }
    }

    public static ImpulseDiagnosticsResult RunForceImpulseDiagnosticSeparation()
    {
        using (GeneratedShipFixture fixture = CreateGeneratedShip())
        {
            fixture.PhysicsCore.BeginPhysicsStep();
            fixture.PhysicsCore.ApplyForceAtCenterOfMass(new Vector3(10f, 0f, 0f), ForceMode.Force);
            fixture.PhysicsCore.ApplyForceAtPosition(new Vector3(0f, 20f, 0f), fixture.Rigidbody.worldCenterOfMass + Vector3.forward, ForceMode.Impulse);
            return new ImpulseDiagnosticsResult
            {
                force = fixture.PhysicsCore.NetAppliedForce,
                torque = fixture.PhysicsCore.NetAppliedTorque,
                impulse = fixture.PhysicsCore.NetAppliedImpulse,
                angularImpulse = fixture.PhysicsCore.NetAppliedAngularImpulse,
                forceCount = fixture.PhysicsCore.AppliedForceCount,
                impulseCount = fixture.PhysicsCore.AppliedImpulseCount
            };
        }
    }

    public static RcsResult RunRcsWithSpool(float spoolRate, Vector3 translationCommand, Vector3 attitudeCommand, float deltaTime)
    {
        using (GeneratedShipFixture fixture = CreateGeneratedShip())
        {
            SetPrivateFloat(fixture.Rcs, "nozzleSpoolUpRate", spoolRate);
            SetPrivateFloat(fixture.Rcs, "nozzleSpoolDownRate", spoolRate);
            fixture.PhysicsCore.BeginPhysicsStep();
            fixture.Rcs.ApplyControls(translationCommand, attitudeCommand, false, deltaTime);
            return new RcsResult
            {
                force = fixture.PhysicsCore.NetAppliedForce,
                torque = fixture.PhysicsCore.NetAppliedTorque,
                desiredForce = fixture.Rcs.LastDesiredRcsForceWorld,
                actualForce = fixture.Rcs.LastActualRcsForceWorld,
                residualForce = fixture.Rcs.LastResidualRcsForceWorld,
                desiredTorque = fixture.Rcs.LastDesiredRcsTorqueWorld,
                actualTorque = fixture.Rcs.LastActualRcsTorqueWorld,
                residualTorque = fixture.Rcs.LastResidualRcsTorqueWorld,
                activeNozzles = fixture.Rcs.ActiveNozzleCount,
                applications = fixture.Rcs.LastNozzleApplicationCount,
                installedNozzles = fixture.Rcs.InstalledNozzleCount,
                maxNozzleThrottle = fixture.Rcs.LastMaxNozzleThrottle,
                allocatedThrottleTotal = fixture.Rcs.LastAllocatedNozzleThrottleTotal,
                fuelRequested = fixture.Rcs.LastFuelRequestedKg,
                fuelConsumed = fixture.Rcs.LastFuelConsumedKg,
                fuelFraction = fixture.Rcs.LastAppliedFuelFraction
            };
        }
    }

    public static ManualPriorityResult RunManualAttitudePriority()
    {
        using (GeneratedShipFixture fixture = CreateGeneratedShip())
        {
            fixture.Rigidbody.angularVelocity = fixture.Ship.transform.TransformDirection(new Vector3(1f, 0f, 0f));
            fixture.PhysicsCore.BeginPhysicsStep();
            fixture.Rcs.ApplyControls(Vector3.zero, Vector3.up, true, SasControlMode.KillRotation, fixture.Ship.transform.rotation, true, 0.02f);
            return new ManualPriorityResult
            {
                manualTorqueLocal = fixture.Rcs.LastManualDesiredTorqueLocal,
                sasTorqueLocal = fixture.Rcs.LastSasDesiredTorqueLocal,
                desiredTorqueLocal = fixture.Rcs.LastDesiredTorqueLocal
            };
        }
    }

    public static ConfigDefaultsResult RunNullConfigDefaults()
    {
        using (GeneratedShipFixture fixture = CreateGeneratedShip())
        {
            SetPrivateFloat(fixture.Stats, "projectileMass", 9f);
            SetPrivateFloat(fixture.Stats, "projectileSpeed", 9f);
            SetPrivateFloat(fixture.MainThruster, "throttleScale", 0.2f);
            SetPrivateFloat(fixture.Rcs, "translationForce", 123f);
            RcsThrusterBlock block = fixture.Ship.GetComponentInChildren<RcsThrusterBlock>();
            if (block != null)
            {
                block.ConfigureThrust(123f);
            }

            fixture.Stats.ApplyConfig(null);
            fixture.MainThruster.ApplyConfig(null);
            fixture.Rcs.ApplyConfig(null);
            if (block != null)
            {
                block.ApplyConfig(null);
            }

            return new ConfigDefaultsResult
            {
                projectileMass = fixture.Stats.ProjectileMass,
                projectileSpeed = fixture.Stats.ProjectileSpeed,
                mainThrottleScale = fixture.MainThruster.ThrottleScale,
                rcsTranslationForce = fixture.Rcs.TranslationForce,
                rcsBlockThrust = block != null ? block.UndamagedThrust : 0f
            };
        }
    }

    public static GravityResult RunDefaultGravityStep()
    {
        using (GeneratedShipFixture fixture = CreateGeneratedShip())
        {
            fixture.PhysicsCore.BeginPhysicsStep();
            bool applied = fixture.PhysicsCore.ApplyEnvironmentForces();
            return CaptureGravityResult(fixture, applied);
        }
    }

    public static GravityResult RunCentralGravityStep(Vector3 shipPosition, Vector3 bodyPosition, float mu, float shipMass)
    {
        using (GeneratedShipFixture fixture = CreateGeneratedShip())
        {
            fixture.Ship.transform.position = shipPosition;
            fixture.Rigidbody.mass = shipMass;
            fixture.Rigidbody.centerOfMass = Vector3.zero;

            var body = new GameObject("GravityBody");
            try
            {
                body.transform.position = bodyPosition;
                fixture.PhysicsCore.ConfigureCentralGravity(body.transform, mu, true);
                fixture.PhysicsCore.BeginPhysicsStep();
                bool applied = fixture.PhysicsCore.ApplyEnvironmentForces();
                return CaptureGravityResult(fixture, applied);
            }
            finally
            {
                DestroyGameObject(body);
            }
        }
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

    public static MainFuelScalingResult RunMainFuelScaling()
    {
        using (GeneratedShipFixture fixture = CreateGeneratedShip())
        {
            SetPrivateFloat(fixture.Stats, "currentFuelKg", 10f);
            SetPrivateFloat(fixture.Stats, "fullThrottleFuelKgPerSecond", 0.6f);
            fixture.PhysicsCore.BeginPhysicsStep();
            fixture.MainThruster.Fire(1f, 0f, 0f, 1f);
            float fullThrottleFuel = fixture.Stats.LastFuelConsumedKg;

            SetPrivateFloat(fixture.Stats, "currentFuelKg", 10f);
            fixture.PhysicsCore.BeginPhysicsStep();
            fixture.MainThruster.Fire(0.5f, 0f, 0f, 1f);
            float halfThrottleFuel = fixture.Stats.LastFuelConsumedKg;

            SetPrivateFloat(fixture.Stats, "currentFuelKg", 10f);
            fixture.PhysicsCore.BeginPhysicsStep();
            fixture.MainThruster.Fire(0f, 0f, 0f, 1f);
            float zeroThrottleFuel = fixture.Stats.LastFuelConsumedKg;

            SetPrivateFloat(fixture.Stats, "currentFuelKg", 0f);
            SetPrivateFloat(fixture.Stats, "fullThrottleFuelKgPerSecond", 0f);
            fixture.PhysicsCore.BeginPhysicsStep();
            float zeroCostThrust = fixture.MainThruster.Fire(1f, 0f, 0f, 1f);

            return new MainFuelScalingResult
            {
                fullThrottleFuel = fullThrottleFuel,
                halfThrottleFuel = halfThrottleFuel,
                zeroThrottleFuel = zeroThrottleFuel,
                zeroCostThrust = zeroCostThrust,
                zeroCostFuel = fixture.Stats.LastFuelConsumedKg
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
        foreach (MethodInfo method in typeof(GunModule).GetMethods(flags))
        {
            if (method.Name.IndexOf("recoil", StringComparison.OrdinalIgnoreCase) >= 0
                && method.Name.IndexOf("enabled", StringComparison.OrdinalIgnoreCase) < 0)
            {
                return true;
            }
        }

        return false;
    }

    public static ThermalStepResult RunThermalHeatRiseStep()
    {
        using (GeneratedShipFixture fixture = CreateGeneratedShip())
        {
            fixture.MainThermal.Configure(
                "Main Thruster",
                true,
                24f,
                50f,
                100f,
                0f,
                100f,
                20f,
                true,
                PrototypeThermalModule.OverheatEffect.DisableModule);
            fixture.MainThermal.ResetToAmbient();
            float initialTemperature = fixture.MainThermal.CurrentTemperature;
            fixture.PhysicsCore.BeginPhysicsStep();
            float applied = fixture.MainThruster.Fire(1f, 0f, 0f, 2f);
            return new ThermalStepResult
            {
                initialTemperature = initialTemperature,
                finalTemperature = fixture.MainThermal.CurrentTemperature,
                appliedThrust = applied,
                powerDrawKw = fixture.MainThermal.LastPowerDrawKw,
                overheated = fixture.MainThermal.IsOverheated,
                disabledByOverheat = fixture.MainThermal.ShouldDisableModule
            };
        }
    }

    public static ThermalStepResult RunThermalCoolingStep()
    {
        using (GeneratedShipFixture fixture = CreateGeneratedShip())
        {
            fixture.MainThermal.Configure(
                "Main Thruster",
                true,
                24f,
                50f,
                100f,
                5f,
                100f,
                20f,
                true,
                PrototypeThermalModule.OverheatEffect.DisableModule);
            fixture.MainThermal.SetTemperature(80f);
            float initialTemperature = fixture.MainThermal.CurrentTemperature;
            fixture.PhysicsCore.BeginPhysicsStep();
            float applied = fixture.MainThruster.Fire(0f, 0f, 0f, 2f);
            return new ThermalStepResult
            {
                initialTemperature = initialTemperature,
                finalTemperature = fixture.MainThermal.CurrentTemperature,
                appliedThrust = applied,
                powerDrawKw = fixture.MainThermal.LastPowerDrawKw,
                overheated = fixture.MainThermal.IsOverheated,
                disabledByOverheat = fixture.MainThermal.ShouldDisableModule
            };
        }
    }

    public static ThermalStepResult RunThermalOverheatStep()
    {
        using (GeneratedShipFixture fixture = CreateGeneratedShip())
        {
            fixture.MainThermal.Configure(
                "Main Thruster",
                true,
                24f,
                1000f,
                100f,
                0f,
                25f,
                20f,
                true,
                PrototypeThermalModule.OverheatEffect.DisableModule);
            fixture.MainThermal.ResetToAmbient();
            fixture.PhysicsCore.BeginPhysicsStep();
            fixture.MainThruster.Fire(1f, 0f, 0f, 1f);
            float overheatedTemperature = fixture.MainThermal.CurrentTemperature;

            fixture.PhysicsCore.BeginPhysicsStep();
            float disabledThrust = fixture.MainThruster.Fire(1f, 0f, 0f, 0.02f);
            return new ThermalStepResult
            {
                initialTemperature = 20f,
                finalTemperature = overheatedTemperature,
                appliedThrust = disabledThrust,
                powerDrawKw = fixture.MainThermal.LastPowerDrawKw,
                overheated = fixture.MainThermal.IsOverheated,
                disabledByOverheat = fixture.MainThermal.ShouldDisableModule
            };
        }
    }

    public static MassPropertiesResult InspectGeneratedMassProperties()
    {
        using (GeneratedShipFixture fixture = CreateGeneratedShip())
        {
            ShipMassProperties properties = fixture.Stats.LastMassProperties;
            return new MassPropertiesResult
            {
                totalMass = fixture.Rigidbody.mass,
                expectedMass = properties.TotalMassKg,
                centerOfMass = fixture.Rigidbody.centerOfMass,
                expectedCenterOfMass = properties.LocalCenterOfMass,
                inertiaTensor = fixture.Rigidbody.inertiaTensor,
                moduleCount = properties.ModuleCount
            };
        }
    }

    public static FuelMassConsumptionResult RunFuelMassConsumptionStep()
    {
        using (GeneratedShipFixture fixture = CreateGeneratedShip())
        {
            float initialMass = fixture.Rigidbody.mass;
            fixture.PhysicsCore.BeginPhysicsStep();
            fixture.MainThruster.Fire(1f, 0f, 0f, 1f);
            float fuelConsumed = fixture.Stats.LastFuelConsumedKg;
            fixture.Stats.ApplyMassProperties(fixture.Rigidbody);

            return new FuelMassConsumptionResult
            {
                initialMass = initialMass,
                finalMass = fixture.Rigidbody.mass,
                fuelConsumed = fuelConsumed,
                expectedMassDrop = fuelConsumed
            };
        }
    }

    public static MassPropertiesResult CalculateSymmetricCenterOfMass()
    {
        GameObject root = new GameObject("SymmetricMassProbe");
        try
        {
            AddDescriptor(root.transform, "Left", new Vector3(-1f, 0f, 0f), 100f, Vector3.one);
            AddDescriptor(root.transform, "Right", new Vector3(1f, 0f, 0f), 100f, Vector3.one);

            ModuleMassDescriptor[] descriptors = root.GetComponentsInChildren<ModuleMassDescriptor>();
            ShipMassProperties properties = ShipMassProperties.Calculate(root.transform, descriptors, 0f, 0f);
            return new MassPropertiesResult
            {
                totalMass = properties.TotalMassKg,
                expectedMass = 200f,
                centerOfMass = properties.LocalCenterOfMass,
                expectedCenterOfMass = Vector3.zero,
                inertiaTensor = properties.InertiaTensor,
                moduleCount = properties.ModuleCount
            };
        }
        finally
        {
            DestroyGameObject(root);
        }
    }

    public static MassPropertiesResult CalculateHeavyModuleShift()
    {
        GameObject root = new GameObject("HeavyModuleShiftProbe");
        try
        {
            AddDescriptor(root.transform, "Light", new Vector3(-1f, 0f, 0f), 100f, Vector3.one);
            AddDescriptor(root.transform, "Heavy", new Vector3(2f, 0f, 0f), 300f, Vector3.one);

            ModuleMassDescriptor[] descriptors = root.GetComponentsInChildren<ModuleMassDescriptor>();
            ShipMassProperties properties = ShipMassProperties.Calculate(root.transform, descriptors, 0f, 0f);
            return new MassPropertiesResult
            {
                totalMass = properties.TotalMassKg,
                expectedMass = 400f,
                centerOfMass = properties.LocalCenterOfMass,
                expectedCenterOfMass = new Vector3(1.25f, 0f, 0f),
                inertiaTensor = properties.InertiaTensor,
                moduleCount = properties.ModuleCount
            };
        }
        finally
        {
            DestroyGameObject(root);
        }
    }

    public static InertiaComparisonResult CompareWideAndCompactInertia()
    {
        ShipMassProperties compact = CalculatePairInertia("CompactInertiaProbe", 0.5f);
        ShipMassProperties wide = CalculatePairInertia("WideInertiaProbe", 2f);
        const float torque = 1000f;

        return new InertiaComparisonResult
        {
            compactInertiaZ = compact.InertiaTensor.z,
            wideInertiaZ = wide.InertiaTensor.z,
            compactAngularAcceleration = torque / compact.InertiaTensor.z,
            wideAngularAcceleration = torque / wide.InertiaTensor.z
        };
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

    private static GravityResult CaptureGravityResult(GeneratedShipFixture fixture, bool applied)
    {
        return new GravityResult
        {
            applied = applied,
            bodyName = fixture.PhysicsCore.LastGravityBodyName,
            distance = fixture.PhysicsCore.LastGravityDistance,
            acceleration = fixture.PhysicsCore.LastGravityAcceleration,
            force = fixture.PhysicsCore.LastGravityForce,
            netTorque = fixture.PhysicsCore.NetAppliedTorque,
            applications = fixture.PhysicsCore.AppliedForceCount
        };
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

    private static GameObject CreateMassPart(Transform ship, string partName, Vector3 localPosition, Vector3 localScale)
    {
        var part = new GameObject(partName);
        part.transform.SetParent(ship, false);
        part.transform.localPosition = localPosition;
        part.transform.localScale = localScale;
        return part;
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

    private static ModuleMassDescriptor AddDescriptor(Transform root, string name, Vector3 localPosition, float massKg, Vector3 boxSize)
    {
        var module = new GameObject(name);
        module.transform.SetParent(root, false);
        module.transform.localPosition = localPosition;
        ModuleMassDescriptor descriptor = module.AddComponent<ModuleMassDescriptor>();
        descriptor.Configure(name, massKg, 0f, false, boxSize);
        return descriptor;
    }

    private static ShipMassProperties CalculatePairInertia(string rootName, float halfWidth)
    {
        GameObject root = new GameObject(rootName);
        try
        {
            AddDescriptor(root.transform, "Left", new Vector3(-halfWidth, 0f, 0f), 100f, Vector3.one);
            AddDescriptor(root.transform, "Right", new Vector3(halfWidth, 0f, 0f), 100f, Vector3.one);
            return ShipMassProperties.Calculate(root.transform, root.GetComponentsInChildren<ModuleMassDescriptor>(), 0f, 0f);
        }
        finally
        {
            DestroyGameObject(root);
        }
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
