using UnityEngine;

[RequireComponent(typeof(Rigidbody))]
public class GunModule : MonoBehaviour
{
    [SerializeField] private ShipStats shipStats;
    [SerializeField] private Rigidbody shipRigidbody;
    [SerializeField] private ShipPhysicsCore physicsCore;
    [SerializeField] private Transform muzzleTransform;
    [SerializeField] private PrototypeTurretWeapon turretWeapon;
    [SerializeField] private WeaponRecoilStabilizer recoilStabilizer;
    [SerializeField] private float projectileScale = 0.24f;
    [SerializeField] private float projectileMass = 0.12f;
    [SerializeField] private bool recoilEnabled = true;
    [SerializeField] private bool allowMuzzleFallback = true;

    private float nextFireTime;

    public float ProjectileMass => Mathf.Max(PrototypeGunSettings.MinimumProjectileMass, projectileMass);
    public float ProjectileDiameter => Mathf.Max(PrototypeGunSettings.MinimumProjectileDiameter, projectileScale);
    public bool RecoilEnabled => recoilEnabled;
    public Vector3 LastProjectileVelocityWorld { get; private set; }
    public Vector3 LastRecoilImpulseWorld { get; private set; }
    public Vector3 LastRecoilPositionWorld { get; private set; }
    public bool LastRecoilApplied { get; private set; }
    public PrototypeProjectileFireResult LastFireResult { get; private set; }
    public Transform MuzzleTransform => muzzleTransform;
    public PrototypeTurretWeapon TurretWeapon => turretWeapon;
    public bool AllowMuzzleFallback => allowMuzzleFallback;

    private void Awake()
    {
        ResolveReferences();
        if (turretWeapon == null)
        {
            EnsureMuzzleTransform();
        }
    }

    private void ResolveReferences()
    {
        if (shipRigidbody == null)
        {
            shipRigidbody = GetComponent<Rigidbody>();
        }

        if (shipStats == null)
        {
            shipStats = GetComponentInParent<ShipStats>();
        }

        if (physicsCore == null)
        {
            physicsCore = GetComponent<ShipPhysicsCore>();
        }

        if (turretWeapon == null)
        {
            turretWeapon = GetComponent<PrototypeTurretWeapon>();
            if (turretWeapon == null)
            {
                turretWeapon = GetComponentInChildren<PrototypeTurretWeapon>();
            }
        }

        if (recoilStabilizer == null)
        {
            recoilStabilizer = GetComponentInParent<WeaponRecoilStabilizer>();
        }
    }

    private void EnsureMuzzleTransform()
    {
        if (muzzleTransform != null)
        {
            return;
        }

        muzzleTransform = PrototypeShipSocketUtility.FindBestSocketTransform(transform, PrototypeShipSocketType.WeaponMuzzle);
        if (muzzleTransform != null)
        {
            return;
        }

        foreach (Transform child in transform.GetComponentsInChildren<Transform>())
        {
            if (child != transform && PrototypeShipSocketUtility.IsWeaponMuzzleName(child.name))
            {
                muzzleTransform = child;
                return;
            }
        }

        if (allowMuzzleFallback)
        {
            var fallback = new GameObject("Muzzle");
            fallback.transform.SetParent(transform, false);
            fallback.transform.localPosition = Vector3.zero;
            fallback.transform.localRotation = Quaternion.identity;
            muzzleTransform = fallback.transform;
        }
    }

    public void SetAllowMuzzleFallback(bool allowFallback)
    {
        allowMuzzleFallback = allowFallback;
        if (!allowMuzzleFallback && muzzleTransform != null && muzzleTransform.parent == transform && muzzleTransform.name == "Muzzle")
        {
            var fallback = muzzleTransform.gameObject;
            muzzleTransform = null;
            DestroyGameObject(fallback);
        }
    }

    public bool TryFire()
    {
        ResolveReferences();
        if (turretWeapon != null)
        {
            PrototypeWeaponComputer weaponComputer = GetComponentInParent<PrototypeWeaponComputer>();
            Transform activeTarget = weaponComputer != null ? weaponComputer.ActiveTargetTransform : null;
            bool firedByTurret = activeTarget != null ? turretWeapon.TryFireAt(activeTarget) : turretWeapon.TryFire();
            LastProjectileVelocityWorld = turretWeapon.LastProjectileVelocityWorld;
            LastRecoilImpulseWorld = turretWeapon.LastRecoilImpulseWorld;
            LastRecoilPositionWorld = turretWeapon.LastRecoilPositionWorld;
            LastRecoilApplied = turretWeapon.LastRecoilApplied;
            return firedByTurret;
        }

        if (shipStats == null || shipRigidbody == null || muzzleTransform == null)
        {
            EnsureMuzzleTransform();
        }

        if (shipStats == null || shipRigidbody == null || muzzleTransform == null)
        {
            return false;
        }

        float delay = 1f / shipStats.ProjectileFireRate;
        if (Time.time < nextFireTime)
        {
            return false;
        }

        nextFireTime = Time.time + delay;
        FireRuntimeProjectile();
        return true;
    }

    private void FireRuntimeProjectile()
    {
        Vector3 shotDirection = ApplySpread(muzzleTransform.forward, shipStats.ProjectileSpreadDegrees);
        PrototypeProjectileFireRequest request = PrototypeProjectileFireRequest.FromWeapon(
            shipStats.ProjectileMode,
            shipRigidbody != null ? shipRigidbody.transform : transform,
            muzzleTransform,
            shotDirection,
            shipRigidbody != null ? shipRigidbody.linearVelocity : Vector3.zero,
            shipStats.ProjectileSpeed,
            shipStats.ProjectileRadius,
            ProjectileMass,
            shipStats.ProjectileLifetime,
            Mathf.Max(shipStats.EngagementRangeMeters, shipStats.ProjectileSpeed * shipStats.ProjectileLifetime),
            shipStats.TracerEveryNthShot);

        LastFireResult = PrototypeProjectileSimulation.GetOrCreateDefault().Fire(request);
        LastProjectileVelocityWorld = LastFireResult.projectileVelocityWorld;
        ApplyRecoilImpulse(shotDirection);
    }

    private bool ApplyRecoilImpulse(Vector3 projectileDirectionWorld)
    {
        LastRecoilApplied = false;
        LastRecoilImpulseWorld = Vector3.zero;
        LastRecoilPositionWorld = muzzleTransform != null ? muzzleTransform.position : transform.position;

        if (!recoilEnabled || physicsCore == null || muzzleTransform == null || shipStats == null || !shipStats.ProjectileRecoilEnabled)
        {
            return false;
        }

        Vector3 recoilDirection = projectileDirectionWorld.sqrMagnitude > 0.0001f
            ? projectileDirectionWorld.normalized
            : muzzleTransform.forward;
        Vector3 projectileMomentum = recoilDirection * (ProjectileMass * shipStats.ProjectileSpeed);
        Vector3 recoilImpulse = -projectileMomentum;
        if (!physicsCore.ApplyForceAtPosition(recoilImpulse, LastRecoilPositionWorld, ForceMode.Impulse))
        {
            return false;
        }

        LastRecoilImpulseWorld = recoilImpulse;
        LastRecoilApplied = true;
        if (recoilStabilizer != null)
        {
            recoilStabilizer.RecordRecoilImpulse(recoilImpulse, LastRecoilPositionWorld);
        }

        return true;
    }

    public void ApplyConfig(PrototypeShipConfig config)
    {
        PrototypeGunSettings settings = config != null ? config.Gun : PrototypeGunSettings.Default;
        ApplySettings(settings);
    }

    public void ApplySettings(PrototypeGunSettings settings)
    {
        settings.Clamp();
        projectileScale = settings.projectileDiameter;
        projectileMass = settings.projectileMass;
        recoilEnabled = settings.recoilEnabled;
    }

    public void ConfigureMuzzle(Transform muzzle)
    {
        if (muzzle != null)
        {
            muzzleTransform = muzzle;
        }

        ResolveReferences();
        EnsureMuzzleTransform();
    }

    public void ConfigureTurretWeapon(PrototypeTurretWeapon weapon)
    {
        turretWeapon = weapon;
        ResolveReferences();
    }

    private static Vector3 ApplySpread(Vector3 direction, float spreadDegrees)
    {
        Vector3 normalized = direction.sqrMagnitude > 0.0001f ? direction.normalized : Vector3.forward;
        float spread = Mathf.Max(0f, spreadDegrees);
        if (spread <= 0.0001f)
        {
            return normalized;
        }

        Vector2 offset = Random.insideUnitCircle * spread;
        Vector3 axisA = Vector3.Cross(normalized, Vector3.up);
        if (axisA.sqrMagnitude < 0.0001f)
        {
            axisA = Vector3.Cross(normalized, Vector3.right);
        }

        axisA.Normalize();
        Vector3 axisB = Vector3.Cross(normalized, axisA).normalized;
        Quaternion rotation = Quaternion.AngleAxis(offset.x, axisA) * Quaternion.AngleAxis(offset.y, axisB);
        return (rotation * normalized).normalized;
    }

    private static void DestroyGameObject(GameObject target)
    {
        if (target == null)
        {
            return;
        }

        if (Application.isPlaying)
        {
            Destroy(target);
        }
        else
        {
            DestroyImmediate(target);
        }
    }
}



