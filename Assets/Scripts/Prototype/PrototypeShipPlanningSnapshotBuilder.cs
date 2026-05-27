using UnityEngine;

public static class PrototypeShipPlanningSnapshotBuilder
{
    public static PrototypeShipPlanningSnapshot Build(GameObject ship)
    {
        return Build(ship != null ? ship.transform : null);
    }

    public static PrototypeShipPlanningSnapshot Build(Transform shipRoot)
    {
        Rigidbody body = ResolveComponent<Rigidbody>(shipRoot, null);
        ShipStats stats = ResolveComponent<ShipStats>(shipRoot, null);
        PlayerShipController controller = ResolveComponent<PlayerShipController>(shipRoot, null);
        ShipPhysicsCore physicsCore = ResolveComponent<ShipPhysicsCore>(shipRoot, null);
        MainThrusterBank mainThruster = ResolveComponent<MainThrusterBank>(shipRoot, null);
        RcsThrusterController rcs = ResolveComponent<RcsThrusterController>(shipRoot, null);
        return Build(shipRoot, body, stats, controller, physicsCore, mainThruster, rcs);
    }

    public static PrototypeShipPlanningSnapshot Build(
        Transform shipRoot,
        Rigidbody body,
        ShipStats stats,
        PlayerShipController controller,
        ShipPhysicsCore physicsCore,
        MainThrusterBank mainThruster,
        RcsThrusterController rcs)
    {
        Transform resolvedRoot = ResolveRoot(shipRoot, body, stats, controller, physicsCore, mainThruster, rcs);
        body = ResolveComponent(resolvedRoot, body);
        stats = ResolveComponent(resolvedRoot, stats);
        controller = ResolveComponent(resolvedRoot, controller);
        physicsCore = ResolveComponent(resolvedRoot, physicsCore);
        mainThruster = ResolveComponent(resolvedRoot, mainThruster);
        rcs = ResolveComponent(resolvedRoot, rcs);

        int mainNozzleCount = CountMainNozzles(resolvedRoot, controller, mainThruster);
        float mainThrottleScale = ResolveMainThrottleScale(resolvedRoot, controller, mainThruster);
        float mainThrustNewtons = stats != null && mainNozzleCount > 0
            ? stats.Thrust * mainNozzleCount * mainThrottleScale
            : 0f;
        float mainFuelKgPerSecond = stats != null && mainNozzleCount > 0
            ? stats.FuelConsumptionKgPerSecond * mainNozzleCount * mainThrottleScale
            : 0f;

        return new PrototypeShipPlanningSnapshot(
            TrajectoryPredictionState.FromRigidbody(body, stats),
            body != null ? body.worldCenterOfMass : (resolvedRoot != null ? resolvedRoot.position : Vector3.zero),
            body != null ? body.centerOfMass : Vector3.zero,
            body != null ? body.inertiaTensor : Vector3.one,
            body != null ? body.inertiaTensorRotation : Quaternion.identity,
            body != null ? body.mass : (stats != null ? stats.CurrentMass : 0f),
            stats != null ? stats.CurrentFuelKg : 0f,
            stats != null ? stats.MaxFuelKg : 0f,
            mainThrustNewtons,
            mainFuelKgPerSecond,
            stats != null ? stats.ReverseThrustMultiplier : 0f,
            ResolveMainThrottleSpoolUpRate(resolvedRoot, controller, mainThruster),
            ResolveMainThrottleSpoolDownRate(resolvedRoot, controller, mainThruster),
            ResolveMainGimbalLimitDegrees(resolvedRoot, controller, mainThruster),
            ResolveMainGimbalSlewRateDegreesPerSecond(resolvedRoot, controller, mainThruster),
            ResolveRcsTranslationForce(controller, rcs),
            ResolveRcsAttitudeForce(controller, rcs),
            ResolveRcsNozzleSpoolUpRate(controller, rcs),
            ResolveRcsNozzleSpoolDownRate(controller, rcs),
            rcs != null && rcs.UseImportedFunctionalSockets,
            ResolveMainThrustMode(controller, mainThruster) == MainThrustMode.FullyPhysicalNozzleForce,
            rcs != null && rcs.SolverMode == RcsSolverMode.ExperimentalPhysicalNozzles,
            physicsCore != null && physicsCore.CentralGravityEnabled,
            physicsCore != null && physicsCore.AtmosphereVolume != null && physicsCore.AtmosphereVolume.IsActiveAtmosphere,
            mainNozzleCount,
            rcs != null ? rcs.InstalledNozzleCount : 0,
            CountMassDescriptors(resolvedRoot));
    }

    private static Transform ResolveRoot(
        Transform shipRoot,
        Rigidbody body,
        ShipStats stats,
        PlayerShipController controller,
        ShipPhysicsCore physicsCore,
        MainThrusterBank mainThruster,
        RcsThrusterController rcs)
    {
        if (shipRoot != null)
        {
            return shipRoot;
        }

        if (body != null)
        {
            return body.transform;
        }

        if (stats != null)
        {
            return stats.transform;
        }

        if (controller != null)
        {
            return controller.transform;
        }

        if (physicsCore != null)
        {
            return physicsCore.transform;
        }

        if (mainThruster != null)
        {
            return mainThruster.transform;
        }

        return rcs != null ? rcs.transform : null;
    }

    private static T ResolveComponent<T>(Transform root, T explicitComponent) where T : Component
    {
        if (explicitComponent != null)
        {
            return explicitComponent;
        }

        if (root == null)
        {
            return null;
        }

        T component = root.GetComponent<T>();
        return component != null ? component : root.GetComponentInChildren<T>(true);
    }

    private static int CountMainNozzles(Transform root, PlayerShipController controller, MainThrusterBank mainThruster)
    {
        int count = 0;
        if (controller != null)
        {
            count = Mathf.Max(count, controller.MainThrusterCount);
        }

        if (mainThruster != null)
        {
            count = Mathf.Max(count, mainThruster.ThrusterCount);
        }

        if (root != null)
        {
            count = Mathf.Max(count, root.GetComponentsInChildren<MainThrusterModule>(false).Length);
        }

        return count;
    }

    private static int CountMassDescriptors(Transform root)
    {
        return root != null ? root.GetComponentsInChildren<ModuleMassDescriptor>(false).Length : 0;
    }

    private static MainThrusterModule ResolveFirstMainThrusterModule(Transform root)
    {
        return root != null ? root.GetComponentInChildren<MainThrusterModule>(true) : null;
    }

    private static float ResolveMainThrottleScale(Transform root, PlayerShipController controller, MainThrusterBank mainThruster)
    {
        if (mainThruster != null && mainThruster.ThrusterCount > 0)
        {
            return mainThruster.ThrottleScale;
        }

        if (controller != null && controller.HasMainThruster)
        {
            return controller.MainThrottleScale;
        }

        MainThrusterModule module = ResolveFirstMainThrusterModule(root);
        return module != null ? module.ThrottleScale : 0f;
    }

    private static float ResolveMainThrottleSpoolUpRate(Transform root, PlayerShipController controller, MainThrusterBank mainThruster)
    {
        if (mainThruster != null && mainThruster.ThrusterCount > 0)
        {
            return mainThruster.ThrottleSpoolUpRate;
        }

        if (controller != null && controller.HasMainThruster)
        {
            return controller.MainThrottleSpoolUpRate;
        }

        MainThrusterModule module = ResolveFirstMainThrusterModule(root);
        return module != null ? module.ThrottleSpoolUpRate : 0f;
    }

    private static float ResolveMainThrottleSpoolDownRate(Transform root, PlayerShipController controller, MainThrusterBank mainThruster)
    {
        if (mainThruster != null && mainThruster.ThrusterCount > 0)
        {
            return mainThruster.ThrottleSpoolDownRate;
        }

        if (controller != null && controller.HasMainThruster)
        {
            return controller.MainThrottleSpoolDownRate;
        }

        MainThrusterModule module = ResolveFirstMainThrusterModule(root);
        return module != null ? module.ThrottleSpoolDownRate : 0f;
    }

    private static float ResolveMainGimbalLimitDegrees(Transform root, PlayerShipController controller, MainThrusterBank mainThruster)
    {
        if (mainThruster != null && mainThruster.ThrusterCount > 0)
        {
            return mainThruster.GimbalLimitDegrees;
        }

        if (controller != null && controller.HasMainThruster)
        {
            return controller.GimbalLimitDegrees;
        }

        MainThrusterModule module = ResolveFirstMainThrusterModule(root);
        return module != null ? module.GimbalLimitDegrees : 0f;
    }

    private static float ResolveMainGimbalSlewRateDegreesPerSecond(Transform root, PlayerShipController controller, MainThrusterBank mainThruster)
    {
        if (mainThruster != null && mainThruster.ThrusterCount > 0)
        {
            return mainThruster.GimbalSlewRateDegreesPerSecond;
        }

        if (controller != null && controller.HasMainThruster)
        {
            return controller.GimbalSlewRateDegreesPerSecond;
        }

        MainThrusterModule module = ResolveFirstMainThrusterModule(root);
        return module != null ? module.GimbalSlewRateDegreesPerSecond : 0f;
    }

    private static MainThrustMode ResolveMainThrustMode(PlayerShipController controller, MainThrusterBank mainThruster)
    {
        if (mainThruster != null && mainThruster.ThrusterCount > 0)
        {
            return mainThruster.ThrustMode;
        }

        return controller != null ? controller.MainThrustMode : MainThrustMode.ComSafeSteeringOnly;
    }

    private static float ResolveRcsTranslationForce(PlayerShipController controller, RcsThrusterController rcs)
    {
        if (rcs != null)
        {
            return rcs.TranslationForce;
        }

        return controller != null ? controller.RcsTranslationForceSetting : 0f;
    }

    private static float ResolveRcsAttitudeForce(PlayerShipController controller, RcsThrusterController rcs)
    {
        if (rcs != null)
        {
            return rcs.AttitudeForce;
        }

        return controller != null ? controller.RcsAttitudeForceSetting : 0f;
    }

    private static float ResolveRcsNozzleSpoolUpRate(PlayerShipController controller, RcsThrusterController rcs)
    {
        if (rcs != null)
        {
            return rcs.NozzleSpoolUpRate;
        }

        return controller != null ? controller.RcsNozzleSpoolUpRate : 0f;
    }

    private static float ResolveRcsNozzleSpoolDownRate(PlayerShipController controller, RcsThrusterController rcs)
    {
        if (rcs != null)
        {
            return rcs.NozzleSpoolDownRate;
        }

        return controller != null ? controller.RcsNozzleSpoolDownRate : 0f;
    }
}
