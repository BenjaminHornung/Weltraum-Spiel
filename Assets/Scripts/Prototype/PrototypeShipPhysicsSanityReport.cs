using System.Collections.Generic;
using UnityEngine;

public struct PrototypeShipPhysicsSanityReport
{
    public float mass;
    public Vector3 centerOfMass;
    public Vector3 worldCenterOfMass;
    public Vector3 inertiaTensor;
    public Quaternion inertiaTensorRotation;
    public bool automaticCenterOfMass;
    public bool automaticInertiaTensor;
    public bool hasModuleMassDescriptors;
    public int moduleMassDescriptorCount;

    public PrototypeShipBuildMode buildMode;
    public PrototypeShipVisualMode visualMode;
    public float importedVisualLocalScale;
    public Vector3 functionalSocketRigLocalScale;
    public float maxFunctionalSocketDistanceFromCom;
    public float maxRcsNozzleLeverArm;
    public float averageRcsNozzleLeverArm;
    public float maxMuzzleLeverArm;
    public float maxMainNozzleLeverArm;

    public RcsSolverMode solverMode;
    public float computedTorqueAuthority;
    public Vector3 manualDesiredTorqueLocal;
    public Vector3 sasDesiredTorqueLocal;
    public Vector3 desiredTorqueWorld;
    public Vector3 actualTorqueWorld;
    public Vector3 angularVelocityBefore;
    public Vector3 angularVelocityAfter;

    public Vector3 muzzleWorldPosition;
    public float muzzleLeverArm;
    public Vector3 recoilImpulseWorld;
    public Vector3 recoilAngularImpulseWorld;
    public Vector3 postFireAngularVelocity;
}

public static class PrototypeShipPhysicsSanity
{
    private static readonly List<RcsNozzleData> NozzleSnapshotBuffer = new List<RcsNozzleData>(32);

    public static PrototypeShipPhysicsSanityReport Capture(GameObject ship)
    {
        var report = new PrototypeShipPhysicsSanityReport
        {
            buildMode = ResolveBuildMode(),
            visualMode = ResolveVisualMode()
        };

        if (ship == null)
        {
            return report;
        }

        Transform shipTransform = ship.transform;
        Rigidbody body = ship.GetComponent<Rigidbody>();
        ShipStats stats = ship.GetComponent<ShipStats>();
        RcsThrusterController rcs = ship.GetComponent<RcsThrusterController>();
        GunModule gun = ship.GetComponent<GunModule>();
        PrototypeTurretWeapon turret = ship.GetComponentInChildren<PrototypeTurretWeapon>();

        if (body != null)
        {
            report.mass = body.mass;
            report.centerOfMass = body.centerOfMass;
            report.worldCenterOfMass = body.worldCenterOfMass;
            report.inertiaTensor = body.inertiaTensor;
            report.inertiaTensorRotation = body.inertiaTensorRotation;
            report.automaticCenterOfMass = body.automaticCenterOfMass;
            report.automaticInertiaTensor = body.automaticInertiaTensor;
            report.angularVelocityBefore = body.angularVelocity;
            report.angularVelocityAfter = body.angularVelocity;
            report.postFireAngularVelocity = body.angularVelocity;
        }

        if (stats != null)
        {
            ShipMassProperties properties = stats.LastMassProperties;
            report.hasModuleMassDescriptors = properties.HasDescriptors;
            report.moduleMassDescriptorCount = properties.ModuleCount;
        }

        Transform visualRoot = shipTransform.Find(PrototypeFunctionalShipBinder.ImportedVisualRootName);
        Transform activeVisual = FindActiveChild(visualRoot);
        report.importedVisualLocalScale = activeVisual != null ? MaxComponent(activeVisual.localScale) : 0f;

        Transform functionalRig = shipTransform.Find(PrototypeFunctionalShipBinder.FunctionalSocketRigName);
        report.functionalSocketRigLocalScale = functionalRig != null ? functionalRig.localScale : Vector3.zero;
        report.maxFunctionalSocketDistanceFromCom = MaxFunctionalSocketDistance(functionalRig, report.worldCenterOfMass);
        report.maxMainNozzleLeverArm = MaxSocketLeverArm(functionalRig, PrototypeShipSocketType.MainThrusterNozzle, report.worldCenterOfMass);

        if (rcs != null)
        {
            report.solverMode = rcs.SolverMode;
            report.computedTorqueAuthority = rcs.ComputeEffectiveTorqueAuthorityForDiagnostics();
            report.manualDesiredTorqueLocal = rcs.LastManualDesiredTorqueLocal;
            report.sasDesiredTorqueLocal = rcs.LastSasDesiredTorqueLocal;
            report.desiredTorqueWorld = rcs.LastDesiredRcsTorqueWorld;
            report.actualTorqueWorld = rcs.LastActualRcsTorqueWorld;
            PopulateRcsLeverArms(rcs, report.worldCenterOfMass, ref report);
        }

        Transform muzzle = ResolveMuzzle(gun, turret);
        report.muzzleWorldPosition = muzzle != null ? muzzle.position : Vector3.zero;
        report.muzzleLeverArm = muzzle != null ? Vector3.Distance(report.muzzleWorldPosition, report.worldCenterOfMass) : 0f;
        report.maxMuzzleLeverArm = report.muzzleLeverArm;

        if (turret != null && turret.LastRecoilApplied)
        {
            report.recoilImpulseWorld = turret.LastRecoilImpulseWorld;
            report.recoilAngularImpulseWorld = turret.LastRecoilAngularImpulseWorld;
            report.muzzleWorldPosition = turret.LastMuzzleWorldPosition;
            report.muzzleLeverArm = turret.LastMuzzleLeverArm;
            report.maxMuzzleLeverArm = Mathf.Max(report.maxMuzzleLeverArm, turret.LastMuzzleLeverArm);
        }
        else if (gun != null)
        {
            report.recoilImpulseWorld = gun.LastRecoilImpulseWorld;
            report.recoilAngularImpulseWorld = gun.LastRecoilAngularImpulseWorld;
            if (gun.LastMuzzleWorldPosition != Vector3.zero)
            {
                report.muzzleWorldPosition = gun.LastMuzzleWorldPosition;
            }

            report.muzzleLeverArm = Mathf.Max(report.muzzleLeverArm, gun.LastMuzzleLeverArm);
            report.maxMuzzleLeverArm = Mathf.Max(report.maxMuzzleLeverArm, gun.LastMuzzleLeverArm);
        }

        return report;
    }

    private static PrototypeShipBuildMode ResolveBuildMode()
    {
        PrototypeBootstrap bootstrap = Object.FindAnyObjectByType<PrototypeBootstrap>();
        return bootstrap != null ? bootstrap.BuildMode : PrototypeShipBuildMode.ImportedDemoScoutFunctionalDefault;
    }

    private static PrototypeShipVisualMode ResolveVisualMode()
    {
        PrototypeShipVisualSwitcher switcher = Object.FindAnyObjectByType<PrototypeShipVisualSwitcher>();
        return switcher != null ? switcher.SelectedVisualMode : PrototypeShipVisualMode.ImportedDemoScout;
    }

    private static Transform FindActiveChild(Transform root)
    {
        if (root == null)
        {
            return null;
        }

        for (int i = 0; i < root.childCount; i++)
        {
            Transform child = root.GetChild(i);
            if (child != null && child.gameObject.activeInHierarchy)
            {
                return child;
            }
        }

        return null;
    }

    private static float MaxComponent(Vector3 value)
    {
        return Mathf.Max(Mathf.Abs(value.x), Mathf.Abs(value.y), Mathf.Abs(value.z));
    }

    private static float MaxFunctionalSocketDistance(Transform rig, Vector3 centerOfMass)
    {
        if (rig == null)
        {
            return 0f;
        }

        PrototypeShipSocket[] sockets = rig.GetComponentsInChildren<PrototypeShipSocket>(true);
        float maxDistance = 0f;
        for (int i = 0; i < sockets.Length; i++)
        {
            if (sockets[i] == null || !sockets[i].IsRuntimeSocket)
            {
                continue;
            }

            maxDistance = Mathf.Max(maxDistance, Vector3.Distance(sockets[i].transform.position, centerOfMass));
        }

        return maxDistance;
    }

    private static float MaxSocketLeverArm(Transform rig, PrototypeShipSocketType socketType, Vector3 centerOfMass)
    {
        List<PrototypeShipSocket> sockets = PrototypeShipSocketUtility.FindSockets(rig, socketType, false);
        float maxDistance = 0f;
        for (int i = 0; i < sockets.Count; i++)
        {
            if (sockets[i] == null)
            {
                continue;
            }

            maxDistance = Mathf.Max(maxDistance, Vector3.Distance(sockets[i].transform.position, centerOfMass));
        }

        return maxDistance;
    }

    private static void PopulateRcsLeverArms(RcsThrusterController rcs, Vector3 centerOfMass, ref PrototypeShipPhysicsSanityReport report)
    {
        NozzleSnapshotBuffer.Clear();
        rcs.CopyNozzleSnapshot(NozzleSnapshotBuffer);
        float totalDistance = 0f;
        int count = 0;
        float maxDistance = 0f;
        for (int i = 0; i < NozzleSnapshotBuffer.Count; i++)
        {
            RcsNozzleData nozzle = NozzleSnapshotBuffer[i];
            if (nozzle.worldPosition == Vector3.zero)
            {
                continue;
            }

            float distance = Vector3.Distance(nozzle.worldPosition, centerOfMass);
            totalDistance += distance;
            maxDistance = Mathf.Max(maxDistance, distance);
            count++;
        }

        report.maxRcsNozzleLeverArm = maxDistance;
        report.averageRcsNozzleLeverArm = count > 0 ? totalDistance / count : 0f;
    }

    private static Transform ResolveMuzzle(GunModule gun, PrototypeTurretWeapon turret)
    {
        if (turret != null && turret.Muzzle != null)
        {
            return turret.Muzzle;
        }

        return gun != null ? gun.MuzzleTransform : null;
    }
}
