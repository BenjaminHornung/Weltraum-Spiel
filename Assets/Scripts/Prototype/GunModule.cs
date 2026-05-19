using UnityEngine;

[RequireComponent(typeof(Rigidbody))]
public class GunModule : MonoBehaviour
{
    [SerializeField] private ShipStats shipStats;
    [SerializeField] private Rigidbody shipRigidbody;
    [SerializeField] private Transform muzzleTransform;
    [SerializeField] private float projectileScale = 0.24f;

    private float nextFireTime;

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
        rigidbody.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;
        rigidbody.interpolation = RigidbodyInterpolation.Interpolate;

        var projectile = projectileObject.AddComponent<Projectile>();
        projectile.Initialize(shipRigidbody.linearVelocity + (muzzleTransform.forward * shipStats.ProjectileSpeed), shipStats.ProjectileLifetime);
    }


public void ApplyConfig(PrototypeShipConfig config)
    {
        if (config == null)
        {
            return;
        }

        PrototypeGunSettings settings = config.Gun;
        settings.Clamp();
        projectileScale = settings.projectileScale;
    }
}
