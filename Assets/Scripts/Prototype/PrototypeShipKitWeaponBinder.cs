using System.Collections.Generic;
using UnityEngine;

[DisallowMultipleComponent]
public sealed class PrototypeShipKitWeaponBinder : MonoBehaviour
{
    public const string MuzzleFlashVfxChildName = "PrototypeMuzzleFlashVfx";

    [SerializeField] private Transform markerRoot;
    [SerializeField] private bool bindOnAwake;
    [SerializeField] private bool createMissingRuntimeComponents = true;
    [SerializeField] private bool createMuzzleFlashVfxChild = true;

    public BindReport LastReport { get; private set; }

    private void Awake()
    {
        if (bindOnAwake)
        {
            BindNow();
        }
    }

    public BindReport BindNow()
    {
        Transform root = markerRoot != null ? markerRoot : transform;
        var report = new BindReport();
        if (root == null)
        {
            report.warnings.Add("No weapon marker root available.");
            LastReport = report;
            return report;
        }

        report.addedSocketComponents = PrototypeShipSocketUtility.EnsureSocketsInHierarchy(root);
        List<WeaponMarkerSet> markerSets = DiscoverMarkerSets(root, report);
        report.weaponGroups = markerSets.Count;

        if (report.foundBases == 0)
        {
            report.missingRequiredMarkers.Add(PrototypeShipSocketUtility.WeaponTurretBasePrefix + "*");
        }

        if (report.foundYawPivots == 0)
        {
            report.missingRequiredMarkers.Add(PrototypeShipSocketUtility.WeaponTurretYawPrefix + "*");
        }

        if (report.foundPitchPivots == 0)
        {
            report.missingRequiredMarkers.Add(PrototypeShipSocketUtility.WeaponTurretPitchPrefix + "*");
        }

        if (report.foundMuzzles == 0)
        {
            report.missingRequiredMarkers.Add(PrototypeShipSocketUtility.WeaponMuzzlePrefix + "*");
            report.warnings.Add("No weapon muzzle marker found; turret binding will not create a ship-center muzzle fallback.");
        }

        Rigidbody shipRigidbody = GetOrAddComponent<Rigidbody>(gameObject, createMissingRuntimeComponents);
        ShipStats shipStats = GetOrAddComponent<ShipStats>(gameObject, createMissingRuntimeComponents);
        ShipPhysicsCore physicsCore = GetOrAddComponent<ShipPhysicsCore>(gameObject, createMissingRuntimeComponents);
        if (physicsCore != null && shipRigidbody != null)
        {
            physicsCore.Configure(shipRigidbody);
        }

        PrototypeTurretWeapon primaryWeapon = null;
        for (int i = 0; i < markerSets.Count; i++)
        {
            WeaponMarkerSet set = markerSets[i];
            if (!set.HasRequiredMarkers)
            {
                report.warnings.Add("Incomplete weapon marker group " + set.DisplayName + "; base/yaw/pitch/muzzle are required.");
                continue;
            }

            PrototypeTurretMount mount = GetOrAddComponent<PrototypeTurretMount>(set.Base.gameObject, createMissingRuntimeComponents);
            PrototypeTurretWeapon turretWeapon = GetOrAddComponent<PrototypeTurretWeapon>(set.Base.gameObject, createMissingRuntimeComponents);
            if (mount == null || turretWeapon == null)
            {
                report.warnings.Add("Could not create turret runtime components for " + set.DisplayName + ".");
                continue;
            }

            mount.Configure(set.Base, set.Yaw, set.Pitch, set.Muzzle, set.MuzzleFlash);
            turretWeapon.Configure(shipStats, shipRigidbody, physicsCore, mount);
            report.boundTurretMounts++;
            report.boundTurretWeapons++;
            report.boundMuzzleName = string.IsNullOrEmpty(report.boundMuzzleName) ? set.Muzzle.name : report.boundMuzzleName;

            if (set.MuzzleFlash != null && createMuzzleFlashVfxChild && EnsureMuzzleFlashVfx(set.MuzzleFlash))
            {
                report.createdMuzzleFlashVfxChildren++;
            }

            if (primaryWeapon == null)
            {
                primaryWeapon = turretWeapon;
            }
        }

        BindRootRuntimeComponents(root, shipStats, shipRigidbody, physicsCore, primaryWeapon, report);
        LastReport = report;
        return report;
    }

    public static BindReport BindHierarchy(Transform root, bool createMissingRuntimeComponents = true, bool createMuzzleFlashVfxChild = true)
    {
        if (root == null)
        {
            var empty = new BindReport();
            empty.warnings.Add("No weapon marker root available.");
            return empty;
        }

        PrototypeShipKitWeaponBinder binder = root.GetComponent<PrototypeShipKitWeaponBinder>();
        if (binder == null && createMissingRuntimeComponents)
        {
            binder = root.gameObject.AddComponent<PrototypeShipKitWeaponBinder>();
        }

        if (binder == null)
        {
            var report = new BindReport();
            report.warnings.Add("Weapon binder component is missing and creation is disabled.");
            return report;
        }

        binder.markerRoot = root;
        binder.createMissingRuntimeComponents = createMissingRuntimeComponents;
        binder.createMuzzleFlashVfxChild = createMuzzleFlashVfxChild;
        return binder.BindNow();
    }

    private void BindRootRuntimeComponents(
        Transform root,
        ShipStats shipStats,
        Rigidbody shipRigidbody,
        ShipPhysicsCore physicsCore,
        PrototypeTurretWeapon primaryWeapon,
        BindReport report)
    {
        if (root == null || primaryWeapon == null)
        {
            return;
        }

        GunModule gun = GetOrAddComponent<GunModule>(gameObject, createMissingRuntimeComponents);
        if (gun != null)
        {
            gun.ConfigureMuzzle(primaryWeapon.Muzzle);
            gun.ConfigureTurretWeapon(primaryWeapon);
            report.boundGunModules = 1;
        }

        PrototypeWeaponComputer weaponComputer = GetOrAddComponent<PrototypeWeaponComputer>(gameObject, createMissingRuntimeComponents);
        if (weaponComputer != null)
        {
            weaponComputer.Bind(transform, shipStats, primaryWeapon);
            report.boundWeaponComputers = 1;
        }
    }

    private static List<WeaponMarkerSet> DiscoverMarkerSets(Transform root, BindReport report)
    {
        var sets = new List<WeaponMarkerSet>();
        if (root == null)
        {
            return sets;
        }

        Transform[] transforms = root.GetComponentsInChildren<Transform>(true);
        var bases = new List<Transform>();
        var yaws = new List<Transform>();
        var pitches = new List<Transform>();
        var muzzles = new List<Transform>();
        var flashes = new List<Transform>();

        for (int i = 0; i < transforms.Length; i++)
        {
            Transform current = transforms[i];
            string currentName = current.name;
            if (PrototypeShipSocketUtility.IsWeaponMuzzleFlashName(currentName))
            {
                flashes.Add(current);
                report.foundMuzzleFlashes++;
            }
            else if (PrototypeShipSocketUtility.IsWeaponTurretBaseName(currentName))
            {
                bases.Add(current);
                report.foundBases++;
            }
            else if (PrototypeShipSocketUtility.IsWeaponTurretYawName(currentName))
            {
                yaws.Add(current);
                report.foundYawPivots++;
            }
            else if (PrototypeShipSocketUtility.IsWeaponTurretPitchName(currentName))
            {
                pitches.Add(current);
                report.foundPitchPivots++;
            }
            else if (IsWeaponMuzzleMarkerName(currentName))
            {
                muzzles.Add(current);
                report.foundMuzzles++;
            }
            else if (PrototypeShipSocketUtility.IsWeaponSafetyMarkerName(currentName))
            {
                report.foundSafetyMarkers++;
            }
        }

        for (int i = 0; i < bases.Count; i++)
        {
            Transform baseMarker = bases[i];
            string key = SuffixAfterPrefix(baseMarker.name, PrototypeShipSocketUtility.WeaponTurretBasePrefix);
            sets.Add(new WeaponMarkerSet
            {
                Key = key,
                Base = baseMarker,
                Yaw = FindByKeyOrClosest(baseMarker, yaws, key, PrototypeShipSocketUtility.WeaponTurretYawPrefix),
                Pitch = FindByKeyOrClosest(baseMarker, pitches, key, PrototypeShipSocketUtility.WeaponTurretPitchPrefix),
                Muzzle = FindByKeyOrClosest(baseMarker, muzzles, key, PrototypeShipSocketUtility.WeaponMuzzlePrefix),
                MuzzleFlash = FindByKeyOrClosest(baseMarker, flashes, key, PrototypeShipSocketUtility.WeaponMuzzleFlashPrefix)
            });
        }

        return sets;
    }

    private static bool IsWeaponMuzzleMarkerName(string transformName)
    {
        if (string.IsNullOrEmpty(transformName) || PrototypeShipSocketUtility.IsWeaponMuzzleFlashName(transformName))
        {
            return false;
        }

        return transformName.ToUpperInvariant().StartsWith(PrototypeShipSocketUtility.WeaponMuzzlePrefix, System.StringComparison.Ordinal);
    }

    private static Transform FindByKeyOrClosest(Transform origin, List<Transform> candidates, string key, string prefix)
    {
        if (candidates == null || candidates.Count == 0)
        {
            return null;
        }

        for (int i = 0; i < candidates.Count; i++)
        {
            Transform candidate = candidates[i];
            if (candidate != null && SuffixAfterPrefix(candidate.name, prefix) == key)
            {
                return candidate;
            }
        }

        if (candidates.Count == 1)
        {
            return candidates[0];
        }

        Transform closest = null;
        float closestDistance = float.MaxValue;
        for (int i = 0; i < candidates.Count; i++)
        {
            Transform candidate = candidates[i];
            if (candidate == null)
            {
                continue;
            }

            float distance = Vector3.SqrMagnitude(candidate.position - origin.position);
            if (closest == null || distance < closestDistance)
            {
                closest = candidate;
                closestDistance = distance;
            }
        }

        return closest;
    }

    private static string SuffixAfterPrefix(string value, string prefix)
    {
        if (string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        string upper = value.ToUpperInvariant();
        return upper.StartsWith(prefix, System.StringComparison.Ordinal) ? upper.Substring(prefix.Length) : upper;
    }

    private static bool EnsureMuzzleFlashVfx(Transform flashMarker)
    {
        if (flashMarker == null || flashMarker.Find(MuzzleFlashVfxChildName) != null)
        {
            return false;
        }

        GameObject vfx = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        vfx.name = MuzzleFlashVfxChildName;
        vfx.transform.SetParent(flashMarker, false);
        vfx.transform.localPosition = Vector3.zero;
        vfx.transform.localRotation = Quaternion.identity;
        vfx.transform.localScale = Vector3.one * 0.16f;
        ApplyMuzzleFlashMaterial(vfx);

        Collider collider = vfx.GetComponent<Collider>();
        if (collider != null)
        {
            if (Application.isPlaying)
            {
                collider.enabled = false;
                Destroy(collider);
            }
            else
            {
                DestroyImmediate(collider);
            }
        }

        vfx.SetActive(false);
        return true;
    }

    private static void ApplyMuzzleFlashMaterial(GameObject target)
    {
        Renderer renderer = target != null ? target.GetComponent<Renderer>() : null;
        if (renderer == null)
        {
            return;
        }

        Shader shader = Shader.Find("Universal Render Pipeline/Lit");
        var material = new Material(shader != null ? shader : Shader.Find("Standard"));
        Color color = new Color(1f, 0.72f, 0.18f, 0.85f);
        material.color = color;
        if (material.HasProperty("_EmissionColor"))
        {
            material.EnableKeyword("_EMISSION");
            material.SetColor("_EmissionColor", color * 2f);
        }

        renderer.sharedMaterial = material;
    }

    private static T GetOrAddComponent<T>(GameObject target, bool mayAdd) where T : Component
    {
        if (target == null)
        {
            return null;
        }

        T component = target.GetComponent<T>();
        if (component == null && mayAdd)
        {
            component = target.AddComponent<T>();
        }

        return component;
    }

    private struct WeaponMarkerSet
    {
        public string Key;
        public Transform Base;
        public Transform Yaw;
        public Transform Pitch;
        public Transform Muzzle;
        public Transform MuzzleFlash;

        public bool HasRequiredMarkers => Base != null && Yaw != null && Pitch != null && Muzzle != null;
        public string DisplayName => string.IsNullOrEmpty(Key) ? "(unnamed)" : Key;
    }

    [System.Serializable]
    public sealed class BindReport
    {
        public int addedSocketComponents;
        public int foundBases;
        public int foundYawPivots;
        public int foundPitchPivots;
        public int foundMuzzles;
        public int foundMuzzleFlashes;
        public int foundSafetyMarkers;
        public int weaponGroups;
        public int boundTurretMounts;
        public int boundTurretWeapons;
        public int boundGunModules;
        public int boundWeaponComputers;
        public int createdMuzzleFlashVfxChildren;
        public string boundMuzzleName;
        public List<string> missingRequiredMarkers = new List<string>();
        public List<string> warnings = new List<string>();
    }
}
