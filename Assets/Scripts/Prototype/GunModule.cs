using UnityEngine;

[RequireComponent(typeof(Rigidbody))]
public class GunModule : MonoBehaviour
{
    [SerializeField] private ShipStats shipStats;
    [SerializeField] private Rigidbody shipRigidbody;
    [SerializeField] private ShipPhysicsCore physicsCore;
    [SerializeField] private Transform muzzleTransform;
    [SerializeField] private PrototypeTurretWeapon turretWeapon;
    [SerializeField] private float projectileScale = 0.24f;
    [SerializeField] private float projectileMass = 0.12f;
    [SerializeField] private bool recoilEnabled = true;

    private float nextFireTime;

    public float ProjectileMass => Mathf.Max(PrototypeGunSettings.MinimumProjectileMass, projectileMass);
    public float ProjectileDiameter => Mathf.Max(PrototypeGunSettings.MinimumProjectileDiameter, projectileScale);
    public bool RecoilEnabled => recoilEnabled;
    public Vector3 LastProjectileVelocityWorld { get; private set; }
    public Vector3 LastRecoilImpulseWorld { get; private set; }
    public Vector3 LastRecoilPositionWorld { get; private set; }
    public bool LastRecoilApplied { get; private set; }
    public Transform MuzzleTransform => muzzleTransform;
    public PrototypeTurretWeapon TurretWeapon => turretWeapon;

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

        var fallback = new GameObject("Muzzle");
        fallback.transform.SetParent(transform, false);
        fallback.transform.localPosition = Vector3.zero;
        fallback.transform.localRotation = Quaternion.identity;
        muzzleTransform = fallback.transform;
    }

    public bool TryFire()
    {
        ResolveReferences();
        if (turretWeapon != null)
        {
            bool firedByTurret = turretWeapon.TryFire();
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
        SpawnProjectile();
        return true;
    }

    private void SpawnProjectile()
    {
        var projectileObject = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        projectileObject.name = "PrototypeProjectile";
        projectileObject.transform.position = muzzleTransform.position;
        projectileObject.transform.rotation = muzzleTransform.rotation;
        float configuredProjectileMass = ProjectileMass;
        float configuredProjectileDiameter = ProjectileDiameter;
        projectileObject.transform.localScale = Vector3.one * configuredProjectileDiameter;

        var rigidbody = projectileObject.GetComponent<Rigidbody>();
        if (rigidbody == null)
        {
            rigidbody = projectileObject.AddComponent<Rigidbody>();
        }

        rigidbody.useGravity = false;
        rigidbody.mass = configuredProjectileMass;
        rigidbody.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;
        rigidbody.interpolation = RigidbodyInterpolation.Interpolate;

        var projectile = projectileObject.AddComponent<Projectile>();
        LastProjectileVelocityWorld = shipRigidbody.linearVelocity + (muzzleTransform.forward * shipStats.ProjectileSpeed);
        projectile.Initialize(
            LastProjectileVelocityWorld,
            shipStats.ProjectileLifetime,
            configuredProjectileMass,
            configuredProjectileDiameter,
            GetComponentsInChildren<Collider>());
        ApplyRecoilImpulse();
    }

    private bool ApplyRecoilImpulse()
    {
        LastRecoilApplied = false;
        LastRecoilImpulseWorld = Vector3.zero;
        LastRecoilPositionWorld = muzzleTransform != null ? muzzleTransform.position : transform.position;

        if (!recoilEnabled || physicsCore == null || muzzleTransform == null || shipStats == null || !shipStats.ProjectileRecoilEnabled)
        {
            return false;
        }

        Vector3 projectileMomentum = muzzleTransform.forward * (ProjectileMass * shipStats.ProjectileSpeed);
        Vector3 recoilImpulse = -projectileMomentum;
        if (!physicsCore.ApplyForceAtPosition(recoilImpulse, LastRecoilPositionWorld, ForceMode.Impulse))
        {
            return false;
        }

        LastRecoilImpulseWorld = recoilImpulse;
        LastRecoilApplied = true;
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
        muzzleTransform = muzzle != null ? muzzle : muzzleTransform;
        ResolveReferences();
        EnsureMuzzleTransform();
    }

    public void ConfigureTurretWeapon(PrototypeTurretWeapon weapon)
    {
        turretWeapon = weapon;
        ResolveReferences();
    }
}



