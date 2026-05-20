using UnityEngine;

[RequireComponent(typeof(Rigidbody))]
public class GunModule : MonoBehaviour
{
    [SerializeField] private ShipStats shipStats;
    [SerializeField] private Rigidbody shipRigidbody;
    [SerializeField] private ShipPhysicsCore physicsCore;
    [SerializeField] private Transform muzzleTransform;
    [SerializeField] private float projectileScale = 0.24f;
    [SerializeField] private float projectileMass = 0.12f;
    [SerializeField] private bool recoilEnabled = true;

    private float nextFireTime;

    public float ProjectileMass => Mathf.Max(0.001f, projectileMass);
    public bool RecoilEnabled => recoilEnabled;
    public Vector3 LastProjectileVelocityWorld { get; private set; }
    public Vector3 LastRecoilImpulseWorld { get; private set; }
    public Vector3 LastRecoilPositionWorld { get; private set; }
    public bool LastRecoilApplied { get; private set; }

    private void Awake()
    {
        ResolveReferences();
        EnsureMuzzleTransform();
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
    }

    private void EnsureMuzzleTransform()
    {
        if (muzzleTransform != null)
        {
            return;
        }

        foreach (Transform child in transform.GetComponentsInChildren<Transform>())
        {
            if (child != transform && child.name == "Muzzle")
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
        if (shipStats == null || shipRigidbody == null || muzzleTransform == null)
        {
            ResolveReferences();
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
        projectileObject.transform.localScale = Vector3.one * projectileScale;

        var rigidbody = projectileObject.GetComponent<Rigidbody>();
        if (rigidbody == null)
        {
            rigidbody = projectileObject.AddComponent<Rigidbody>();
        }

        rigidbody.useGravity = false;
        rigidbody.mass = ProjectileMass;
        rigidbody.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;
        rigidbody.interpolation = RigidbodyInterpolation.Interpolate;

        var projectile = projectileObject.AddComponent<Projectile>();
        LastProjectileVelocityWorld = shipRigidbody.linearVelocity + (muzzleTransform.forward * shipStats.ProjectileSpeed);
        projectile.Initialize(LastProjectileVelocityWorld, shipStats.ProjectileLifetime, ProjectileMass, GetComponentsInChildren<Collider>());
        ApplyRecoilImpulse();
    }

    private bool ApplyRecoilImpulse()
    {
        LastRecoilApplied = false;
        LastRecoilImpulseWorld = Vector3.zero;
        LastRecoilPositionWorld = muzzleTransform != null ? muzzleTransform.position : transform.position;

        if (!recoilEnabled || physicsCore == null || muzzleTransform == null || shipStats == null)
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
        projectileScale = settings.projectileScale;
        projectileMass = settings.projectileMass;
        recoilEnabled = settings.recoilEnabled;
    }

    public void ConfigureMuzzle(Transform muzzle)
    {
        muzzleTransform = muzzle != null ? muzzle : muzzleTransform;
        ResolveReferences();
        EnsureMuzzleTransform();
    }
}
