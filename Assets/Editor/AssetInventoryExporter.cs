#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using Newtonsoft.Json;
using UnityEditor;
using UnityEditor.PackageManager;
using UnityEngine;

public static class AssetInventoryExporter
{
    [MenuItem("Tools/Asset Inventory/Export Weltraum-Spiel Inventory")]
    public static void ExportWeltraumSpielInventory()
    {
        var inventory = BuildInventory();
        var outputDirectory = Path.Combine(inventory.project.rootPath, "docs", "asset-inventory");
        Directory.CreateDirectory(outputDirectory);

        var jsonPath = Path.Combine(outputDirectory, "unity-assets-inventory.json");
        var markdownPath = Path.Combine(outputDirectory, "unity-assets-inventory.md");
        var recommendationsPath = Path.Combine(outputDirectory, "recommended-assets-for-weltraum-spiel.md");

        File.WriteAllText(jsonPath, JsonConvert.SerializeObject(inventory, Formatting.Indented), Encoding.UTF8);
        File.WriteAllText(markdownPath, BuildInventoryMarkdown(inventory), Encoding.UTF8);
        File.WriteAllText(recommendationsPath, BuildRecommendationsMarkdown(inventory), Encoding.UTF8);

        Debug.Log("Asset inventory exported to " + NormalizePath(outputDirectory));
    }

    private static Inventory BuildInventory()
    {
        var root = Directory.GetParent(Application.dataPath).FullName;
        return new Inventory
        {
            generatedAtUtc = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture),
            project = new ProjectRecord
            {
                name = Application.productName,
                rootPath = NormalizePath(root),
                assetsPath = NormalizePath(Application.dataPath),
                unityVersion = Application.unityVersion,
                platform = Application.platform.ToString()
            },
            limitations = new List<string>
            {
                "Asset Store My Assets is not exposed through Unity MCP here; only assets imported into this project and packages already downloaded in local Unity caches were discoverable.",
                "Local Asset Store archives were not imported, unpacked, copied, or inspected for protected content; only cache folder names, archive names, sizes, and metadata/readme file names are recorded.",
                "Scenes are inventoried by path only. The exporter does not open, save, or modify scene contents.",
                "Prefab inspection reads component type names from prefab assets without instantiating or saving them.",
                "Usefulness and risk values are metadata heuristics to guide manual inspection, not legal, license, or compatibility approval."
            },
            installedPackages = CollectPackages(),
            importedAssets = CollectAssetGroups(),
            localDownloadedPackages = CollectLocalPackages(),
            usefulnessMatrix = BuildUsefulnessMatrix(),
            finalRecommendations = BuildFinalRecommendations()
        };
    }

    private static List<PackageRecord> CollectPackages()
    {
        return UnityEditor.PackageManager.PackageInfo.GetAllRegisteredPackages()
            .OrderBy(p => p.name, StringComparer.OrdinalIgnoreCase)
            .Select(p =>
            {
                var guidance = PackageGuidance(p.name, p.displayName, p.description);
                return new PackageRecord
                {
                    name = p.name,
                    displayName = p.displayName,
                    version = p.version,
                    source = p.source.ToString(),
                    description = Clean(p.description),
                    packagePath = NormalizePath(p.resolvedPath),
                    usefulForWeltraumSpiel = guidance.useful,
                    reason = guidance.reason
                };
            })
            .ToList();
    }

    private static List<AssetGroupRecord> CollectAssetGroups()
    {
        var groups = new Dictionary<string, AssetGroupRecord>(StringComparer.OrdinalIgnoreCase);
        foreach (var guid in AssetDatabase.FindAssets(string.Empty, new[] { "Assets" }))
        {
            var path = AssetDatabase.GUIDToAssetPath(guid);
            if (string.IsNullOrEmpty(path) || AssetDatabase.IsValidFolder(path))
            {
                continue;
            }

            var category = CategorizeAsset(path, AssetDatabase.GetMainAssetTypeAtPath(path));
            var topFolder = TopFolder(path);
            var key = topFolder + "|" + category;
            if (!groups.TryGetValue(key, out var group))
            {
                group = new AssetGroupRecord
                {
                    topLevelFolder = topFolder,
                    category = category,
                    representativeFiles = new List<string>(),
                    dependenciesIfPractical = new List<string>(),
                    componentNames = new List<string>()
                };
                groups.Add(key, group);
            }

            group.assetCount++;
            AddLimited(group.representativeFiles, NormalizePath(path), 8);

            foreach (var dependency in SafeDependencies(path))
            {
                AddLimited(group.dependenciesIfPractical, dependency, 10);
            }

            if (path.EndsWith(".prefab", StringComparison.OrdinalIgnoreCase))
            {
                foreach (var componentName in ReadPrefabComponentNames(path))
                {
                    AddLimited(group.componentNames, componentName, 10);
                }
            }
        }

        foreach (var group in groups.Values)
        {
            var guidance = AssetGroupGuidance(group);
            group.likelyPurpose = guidance.purpose;
            group.recommendation = guidance.recommendation;
        }

        return groups.Values
            .OrderBy(g => g.topLevelFolder, StringComparer.OrdinalIgnoreCase)
            .ThenBy(g => g.category, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static List<LocalPackageRecord> CollectLocalPackages()
    {
        var records = new List<LocalPackageRecord>();
        var assetStoreRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Unity", "Asset Store-5.x");
        if (Directory.Exists(assetStoreRoot))
        {
            foreach (var publisher in SafeDirectories(assetStoreRoot).OrderBy(d => d.Name, StringComparer.OrdinalIgnoreCase))
            {
                var files = SafeFiles(publisher.FullName).ToList();
                var archives = files.Where(f => IsAny(f.Extension, ".unitypackage", ".tgz", ".zip")).OrderBy(f => f.Name, StringComparer.OrdinalIgnoreCase).ToList();
                foreach (var archive in archives)
                {
                    var name = Path.GetFileNameWithoutExtension(archive.Name);
                    var category = LocalPackageCategory(publisher.Name + " " + name + " " + archive.DirectoryName);
                    records.Add(new LocalPackageRecord
                    {
                        source = "Asset Store cache",
                        vendorOrPublisherFolder = publisher.Name,
                        packageOrFolderName = name,
                        rootPath = NormalizePath(publisher.FullName),
                        availableFiles = files.Select(f => NormalizePath(RelativePath(publisher.FullName, f.FullName))).OrderBy(x => x, StringComparer.OrdinalIgnoreCase).Take(40).ToList(),
                        availableFileCount = files.Count,
                        sizeBytes = archive.Length,
                        looksLike = archive.Extension.Equals(".unitypackage", StringComparison.OrdinalIgnoreCase) ? ".unitypackage" : "UPM/archive",
                        readmeOrMetadata = files.Where(f => IsAny(f.Extension, ".json", ".md", ".txt", ".pdf")).Select(f => NormalizePath(RelativePath(publisher.FullName, f.FullName))).Take(10).ToList(),
                        categoryGuess = category,
                        usefulForWeltraumSpiel = LocalPackageUsefulness(name, category),
                        importRisk = LocalPackageRisk(name, category, archive.Extension)
                    });
                }
            }
        }

        var upmRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Unity", "cache", "upm");
        if (Directory.Exists(upmRoot))
        {
            foreach (var packageJson in SafeFiles(upmRoot).Where(f => f.Name.Equals("package.json", StringComparison.OrdinalIgnoreCase)).Take(200))
            {
                var files = SafeFiles(packageJson.DirectoryName).ToList();
                var packageName = packageJson.Directory.Name;
                var displayName = packageName;
                try
                {
                    dynamic package = JsonConvert.DeserializeObject(File.ReadAllText(packageJson.FullName));
                    if (package != null)
                    {
                        packageName = package.name ?? packageName;
                        displayName = package.displayName ?? packageName;
                    }
                }
                catch
                {
                    // Cache metadata is optional.
                }

                var category = LocalPackageCategory(packageName + " " + displayName);
                records.Add(new LocalPackageRecord
                {
                    source = "UPM cache",
                    vendorOrPublisherFolder = "UPM cache",
                    packageOrFolderName = displayName,
                    rootPath = NormalizePath(packageJson.DirectoryName),
                    availableFiles = files.Select(f => NormalizePath(RelativePath(packageJson.DirectoryName, f.FullName))).OrderBy(x => x, StringComparer.OrdinalIgnoreCase).Take(40).ToList(),
                    availableFileCount = files.Count,
                    sizeBytes = files.Sum(f => f.Length),
                    looksLike = "UPM package",
                    readmeOrMetadata = files.Where(f => IsAny(f.Extension, ".json", ".md", ".txt", ".pdf")).Select(f => NormalizePath(RelativePath(packageJson.DirectoryName, f.FullName))).Take(10).ToList(),
                    categoryGuess = category,
                    usefulForWeltraumSpiel = LocalPackageUsefulness(displayName, category),
                    importRisk = LocalPackageRisk(displayName, category, ".upm")
                });
            }
        }

        return records
            .OrderBy(r => r.source, StringComparer.OrdinalIgnoreCase)
            .ThenBy(r => r.vendorOrPublisherFolder, StringComparer.OrdinalIgnoreCase)
            .ThenBy(r => r.packageOrFolderName, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static List<UsefulnessMatrixRecord> BuildUsefulnessMatrix()
    {
        return new List<UsefulnessMatrixRecord>
        {
            Matrix("Player-facing UI/HUD", "PrototypePlayerHud.cs; PrototypeFlightHud.cs; PrototypeMinimapOverlay.cs; PrototypeUiStyle.cs; TextMesh Pro assets; 3D Modern Menu UI; PrimeTween; In-game Debug Console", "Reuse the existing HUD snapshot/rendering, minimap model, and TMP text assets first.", "Test SlimUI/PrimeTween/debug console in a throwaway project for menu polish and debug builds.", "Avoid replacing the current HUD stack with an imported UI kit before input, scaling, and tests are checked."),
            Matrix("Space ships / modular ship parts", "Assets/Art/PrototypeShipKit/Parts; DemoShips; prototype_ship_kit_manifest.json; Sci-Fi Styled Modular Pack", "Reuse imported FBX/GLB parts and manifest for builder/runtime visual modes.", "Inspect the sci-fi modular pack in a throwaway project for alternate hull, station, and hangar pieces.", "Avoid nature/environment packs for ships; they do not cover hardpoints or ship-scale constraints."),
            Matrix("Thruster/RCS VFX", "MainThrusterVfx.prefab; RcsThrusterVfx.prefab; PrototypeShipVfxLibrary.asset; Particle Pack; Free Quick Effects Vol 1; Weather And Elemental VFX Pack", "Use existing VFX prefabs directly for current flight evidence.", "Inspect particle and quick-effect packs in a throwaway project for exhaust, sparks, trails, and impact variants.", "Avoid importing legacy particle content directly until shader/render pipeline compatibility is verified."),
            Matrix("Weapons/projectiles/combat VFX", "gun_mount_light_mk1; PrototypeTurretWeapon.cs; PrototypeProjectileSimulation.cs; War FX; Free Quick Effects Vol 1; Particle Pack", "Reuse weapon binder and projectile runtime systems.", "Adapt imported muzzle flashes, impacts, explosions, and projectile trails after test import.", "Avoid imported projectile scripts that overlap the deterministic combat simulation."),
            Matrix("Space environment/skybox/planets/asteroids", "URP settings; FREE Skybox Extended Shader; Real Stars Skybox Lite; low-poly terrain/tree/environment caches", "Reuse URP settings as the rendering baseline.", "Test skybox shader, Real Stars, terrain, and tree packs as space/planet-surface placeholders.", "Avoid assuming nature packs solve space needs; planets, asteroids, nebulae, and station exteriors are still missing."),
            Matrix("Docking/stations/hangars", "connector_hardpoint_mk1; DockingPort.cs; PrototypeDockingApproachAssist.cs; Sci-Fi Styled Modular Pack; UModeler X; ProBuilder 2x", "Reuse docking code and connector hardpoint art.", "Use sci-fi modular pieces, ProBuilder, or UModeler in a test project for station/hangar grayboxes.", "Avoid importing broad editor modeling tools before licensing and generated-asset workflow are settled."),
            Matrix("Ship builder/UI inventory", "PrototypeShipBlueprint.cs; PrototypeShipLayout.cs; PrototypeShipVariant.cs; PrototypeUiViewModels.cs; 3D Modern Menu UI; PrimeTween", "Reuse blueprint/layout/view-model code.", "Adapt UI animation and menu assets only after the builder flow is stable.", "Avoid adding a second inventory framework before the current model is exhausted."),
            Matrix("Audio/SFX/music", "Unity audio module; FMOD for Unity 202; no discovered SFX/music clip pack", "Use built-in audio support for now.", "Evaluate FMOD in a throwaway project before deciding whether the prototype needs middleware.", "Avoid integrating audio middleware until actual thruster, weapon, impact, docking, alert, ambience, and music clips exist."),
            Matrix("Editor tooling", "MCP for Unity; Test Framework; UModeler X; ProBuilder 2x; Easy Poly Map Creator; Unity Asset Manager package", "Reuse Unity MCP and tests for iteration and evidence.", "Evaluate modeling/terrain/asset-manager tools in a throwaway project.", "Avoid editor extensions that change settings or generate assets without a rollback plan."),
            Matrix("Performance/optimization", "Burst/Collections transitive packages; PrototypeRuntimeJobSystems.cs; URP", "Reuse current job-system and runtime snapshot architecture.", "Consider Burst only for measured hotspots.", "Avoid optimization packages or import-setting changes without profiler evidence."),
            Matrix("Networking/save/persistence", "Multiplayer Center installed; no Netcode or persistence asset found", "Reuse none yet beyond package discovery.", "Evaluate save-game and networking approaches after gameplay contracts stabilize.", "Avoid importing networking frameworks speculatively.")
        };
    }

    private static FinalRecommendations BuildFinalRecommendations()
    {
        return new FinalRecommendations
        {
            top10AssetsOrPackagesToInspectFirst = new List<string>
            {
                "Assets/Art/PrototypeShipKit/Parts plus demo_scout_mk1/demo_cargo_mk1 - current modular ship vocabulary and assembled baselines.",
                "Assets/Art/PrototypeShipKit/VFX/Prefabs/MainThrusterVfx.prefab and RcsThrusterVfx.prefab - already bound to flight evidence.",
                "Assets/Art/PrototypeShipKit/prototype_ship_kit_manifest.json - metadata for parts, sockets, and categories.",
                "PrototypePlayerHud.cs plus PrototypeMinimapOverlay.cs - player-facing HUD and tactical scan surface.",
                "com.unity.render-pipelines.universal and com.unity.inputsystem - active rendering and control baselines.",
                "Real Stars Skybox Lite plus FREE Skybox Extended Shader - candidate space backdrop work, verify URP compatibility first.",
                "War FX, Free Quick Effects Vol 1, Weather And Elemental VFX Pack, and Particle Pack - candidate combat/thruster VFX, throwaway import first.",
                "Sci-Fi Styled Modular Pack - candidate station, hangar, and alternate modular ship kit pieces.",
                "3D Modern Menu UI, PrimeTween, and In-game Debug Console - optional UI/debug polish after throwaway import.",
                "FMOD for Unity 202 - candidate audio middleware only after concrete SFX/music needs are known."
            },
            importIntoThrowawayProjectFirst = new List<string>
            {
                "All local Asset Store .unitypackage archives, especially VFX packs, skyboxes, Sci-Fi Styled Modular Pack, FMOD, SlimUI, UModeler X, ProBuilder 2x, PrimeTween, and In-game Debug Console.",
                "Shader or render-pipeline-affecting packages before they touch URP settings.",
                "Editor extensions and middleware that may add project settings, menu items, generated assets, native plugins, or dependencies.",
                "Large environment/nature packs because they are mostly planet-surface placeholders and can add many materials/textures."
            },
            safeToUseDirectly = new List<string>
            {
                "Imported PrototypeShipKit FBX/GLB parts, materials, demo ships, and VFX prefabs already under Assets/Art.",
                "Installed Unity packages already referenced by the project: URP, Input System, Test Framework, uGUI/UIElements, Physics, Audio, Particle System.",
                "Existing scripts and tests under Assets/Scripts/Prototype and Assets/Tests as project-owned implementation evidence."
            },
            mayConflictWithProjectSettings = new List<string>
            {
                "Skybox, post-processing, or shader packages if they assume Built-in Render Pipeline instead of URP 17.4.",
                "Particle packs that include legacy materials, shaders, or quality settings.",
                "Runtime debug console or UI packages that bind input, canvases, or EventSystem state.",
                "FMOD if it introduces native plugin setup, bank generation, or audio initialization outside the current prototype architecture.",
                "UModeler X or terrain/editor extensions that may add editor settings, generated assets, or paid-license constraints.",
                "Visual Scripting if used as a parallel gameplay logic path without tests."
            },
            missingAssetCategories = new List<string>
            {
                "Purpose-built space skyboxes/starfields/nebulae verified on URP.",
                "Planets, moons, asteroids, debris fields, stations, docking bays, hangars, and cargo props.",
                "Weapon muzzle flashes, projectile trails, shield/impact/explosion VFX tuned for space combat.",
                "Thruster, RCS, weapon, impact, docking, UI alert, ambience, and music audio packs.",
                "Save-game/persistence and networking packages or project-owned implementations."
            }
        };
    }

    private static string BuildInventoryMarkdown(Inventory inventory)
    {
        var sb = new StringBuilder();
        sb.AppendLine("# Unity Asset Inventory - Weltraum-Spiel");
        sb.AppendLine();
        sb.AppendLine("Generated UTC: " + inventory.generatedAtUtc);
        sb.AppendLine();
        sb.AppendLine("## Project");
        sb.AppendLine("- Name: " + inventory.project.name);
        sb.AppendLine("- Unity: " + inventory.project.unityVersion);
        sb.AppendLine("- Root: " + inventory.project.rootPath);
        sb.AppendLine("- Assets: " + inventory.project.assetsPath);
        sb.AppendLine();
        sb.AppendLine("## Limitations");
        foreach (var limitation in inventory.limitations) sb.AppendLine("- " + limitation);

        sb.AppendLine();
        sb.AppendLine("## Installed Unity Packages");
        sb.AppendLine("| Name | Version | Source | Useful | Reason | Package path |");
        sb.AppendLine("|---|---:|---|---|---|---|");
        foreach (var p in inventory.installedPackages)
        {
            sb.AppendLine("| " + Md(p.name) + " | " + Md(p.version) + " | " + Md(p.source) + " | " + Md(p.usefulForWeltraumSpiel) + " | " + Md(p.reason) + " | " + Md(p.packagePath) + " |");
        }

        sb.AppendLine();
        sb.AppendLine("## Imported Project Assets");
        sb.AppendLine("| Top folder | Category | Count | Representative files | Likely purpose | Dependencies/components | Recommendation |");
        sb.AppendLine("|---|---|---:|---|---|---|---|");
        foreach (var g in inventory.importedAssets)
        {
            var dependencies = g.dependenciesIfPractical.Count > 0 ? string.Join("<br>", g.dependenciesIfPractical.Select(Md)) : "";
            if (g.componentNames.Count > 0)
            {
                dependencies += (dependencies.Length > 0 ? "<br>" : "") + "Components: " + string.Join(", ", g.componentNames.Select(Md));
            }

            sb.AppendLine("| " + Md(g.topLevelFolder) + " | " + Md(g.category) + " | " + g.assetCount.ToString(CultureInfo.InvariantCulture) + " | " + string.Join("<br>", g.representativeFiles.Select(Md)) + " | " + Md(g.likelyPurpose) + " | " + dependencies + " | " + Md(g.recommendation) + " |");
        }

        sb.AppendLine();
        sb.AppendLine("## Local Downloaded Asset Store / UPM Packages");
        if (inventory.localDownloadedPackages.Count == 0)
        {
            sb.AppendLine("No downloaded Asset Store or UPM cache packages were discovered in the checked local cache paths.");
        }
        else
        {
            sb.AppendLine("| Source | Publisher | Package/cache item | Files | Type | Metadata/readmes | Category guess | Useful | Import risk |");
            sb.AppendLine("|---|---|---|---:|---|---|---|---|---|");
            foreach (var p in inventory.localDownloadedPackages)
            {
                sb.AppendLine("| " + Md(p.source) + " | " + Md(p.vendorOrPublisherFolder) + " | " + Md(p.packageOrFolderName) + " | " + p.availableFileCount.ToString(CultureInfo.InvariantCulture) + " | " + Md(p.looksLike) + " | " + Md(p.readmeOrMetadata.Count == 0 ? "none found" : string.Join(", ", p.readmeOrMetadata)) + " | " + Md(p.categoryGuess) + " | " + Md(p.usefulForWeltraumSpiel) + " | " + Md(p.importRisk) + " |");
            }
        }

        AppendMatrix(sb, inventory);
        AppendFinalRecommendations(sb, inventory.finalRecommendations);
        return sb.ToString();
    }

    private static string BuildRecommendationsMarkdown(Inventory inventory)
    {
        var sb = new StringBuilder();
        sb.AppendLine("# Recommended Assets for Weltraum-Spiel");
        sb.AppendLine();
        sb.AppendLine("Generated UTC: " + inventory.generatedAtUtc);
        sb.AppendLine();
        sb.AppendLine("This decision aid records metadata and recommendations only. It does not include paid package contents or copied asset files.");
        AppendMatrix(sb, inventory);
        AppendFinalRecommendations(sb, inventory.finalRecommendations);
        return sb.ToString();
    }

    private static void AppendMatrix(StringBuilder sb, Inventory inventory)
    {
        sb.AppendLine();
        sb.AppendLine("## Weltraum-Spiel Usefulness Matrix");
        sb.AppendLine("| Category | Candidate assets | What to reuse | What to adapt | What to avoid |");
        sb.AppendLine("|---|---|---|---|---|");
        foreach (var item in inventory.usefulnessMatrix)
        {
            sb.AppendLine("| " + Md(item.category) + " | " + Md(item.candidateAssets) + " | " + Md(item.whatToReuse) + " | " + Md(item.whatToAdapt) + " | " + Md(item.whatToAvoid) + " |");
        }
    }

    private static void AppendFinalRecommendations(StringBuilder sb, FinalRecommendations r)
    {
        sb.AppendLine();
        sb.AppendLine("## Final Recommendations");
        AppendList(sb, "Top 10 assets/packages to inspect first", r.top10AssetsOrPackagesToInspectFirst);
        AppendList(sb, "Assets that should be imported into a throwaway test project first", r.importIntoThrowawayProjectFirst);
        AppendList(sb, "Assets safe to use directly", r.safeToUseDirectly);
        AppendList(sb, "Assets that may conflict with project settings", r.mayConflictWithProjectSettings);
        AppendList(sb, "Missing asset categories", r.missingAssetCategories);
    }

    private static void AppendList(StringBuilder sb, string title, List<string> items)
    {
        sb.AppendLine();
        sb.AppendLine("### " + title);
        foreach (var item in items) sb.AppendLine("- " + item);
    }

    private static string CategorizeAsset(string path, Type type)
    {
        var lower = path.ToLowerInvariant();
        var extension = Path.GetExtension(lower);
        var typeName = type == null ? "" : type.FullName;
        if (typeName.Contains("SceneAsset") || extension == ".unity") return "scenes";
        if (extension == ".prefab") return lower.Contains("/vfx/") ? "VFX/particle systems" : "prefabs";
        if (IsAny(extension, ".fbx", ".obj", ".blend", ".dae", ".3ds", ".glb", ".gltf")) return "models/meshes";
        if (typeName == typeof(Material).FullName || extension == ".mat") return "materials";
        if (typeName == typeof(Shader).FullName || IsAny(extension, ".shader", ".shadergraph", ".compute")) return "shaders";
        if (typeName.Contains("Texture") || IsAny(extension, ".png", ".jpg", ".jpeg", ".tga", ".psd", ".exr", ".spriteatlas")) return lower.Contains("icon") || lower.Contains("font") || lower.Contains("ui") ? "UI assets/fonts/icons" : "textures/sprites";
        if (typeName == typeof(AudioClip).FullName || IsAny(extension, ".wav", ".mp3", ".ogg", ".aiff")) return "audio";
        if (typeName.Contains("AnimationClip") || IsAny(extension, ".anim", ".controller", ".overridecontroller")) return "animations";
        if (extension == ".cs") return "scripts/editor tools";
        if (IsAny(extension, ".md", ".txt", ".pdf") || lower.Contains("readme")) return "documentation/readmes";
        if (IsAny(extension, ".asset", ".json", ".inputactions", ".wlt")) return lower.Contains("ui") || lower.Contains("icon") ? "UI assets/fonts/icons" : "configuration/data";
        if (lower.Contains("/vfx/") || lower.Contains("particle")) return "VFX/particle systems";
        return "other";
    }

    private static List<string> SafeDependencies(string path)
    {
        try
        {
            return AssetDatabase.GetDependencies(path, false)
                .Where(d => !d.Equals(path, StringComparison.OrdinalIgnoreCase))
                .Where(d => !d.EndsWith(".cs", StringComparison.OrdinalIgnoreCase))
                .Select(NormalizePath)
                .ToList();
        }
        catch (Exception ex)
        {
            return new List<string> { "dependency read failed: " + ex.GetType().Name };
        }
    }

    private static List<string> ReadPrefabComponentNames(string path)
    {
        var names = new List<string>();
        try
        {
            var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(path);
            if (prefab == null) return names;
            foreach (var component in prefab.GetComponentsInChildren<Component>(true))
            {
                AddLimited(names, component == null ? "MissingScript" : component.GetType().Name, 20);
            }
        }
        catch (Exception ex)
        {
            names.Add("component read failed: " + ex.GetType().Name);
        }

        return names;
    }

    private static Guidance PackageGuidance(string name, string displayName, string description)
    {
        var text = ((name ?? "") + " " + (displayName ?? "") + " " + (description ?? "")).ToLowerInvariant();
        if (text.Contains("unity-mcp")) return new Guidance("yes", "Core editor automation and verification tooling for this workflow.");
        if (text.Contains("render-pipelines.universal") || text.Contains("universal render pipeline")) return new Guidance("yes", "Active rendering pipeline; use as shader and post-processing compatibility baseline.");
        if (text.Contains("inputsystem") || text.Contains("input system")) return new Guidance("yes", "Foundation for ship controls, HUD input, and future builder interactions.");
        if (text.Contains("test-framework")) return new Guidance("yes", "Project already relies on Unity tests for regression evidence.");
        if (text.Contains("ugui") || text.Contains("uielements") || text.Contains("ui elements")) return new Guidance("yes", "Useful for HUD, menus, debug panels, and ship-builder UI.");
        if (text.Contains("particle system")) return new Guidance("yes", "Directly relevant to thruster, RCS, weapon, and impact VFX.");
        if (text.Contains("physics")) return new Guidance("yes", "Core to flight, docking, projectile, and collision behavior.");
        if (text.Contains("ai navigation")) return new Guidance("maybe", "Potentially useful for station/interior navigation, less directly useful for free-space flight.");
        if (text.Contains("timeline")) return new Guidance("maybe", "Useful for scripted reveals, tutorials, or evidence captures, not core gameplay yet.");
        if (text.Contains("audio")) return new Guidance("yes", "Required for future thruster, weapon, impact, alert, and ambience audio.");
        if (text.Contains("multiplayer")) return new Guidance("maybe", "May guide future networking decisions, but no Netcode package is installed.");
        if (text.Contains("burst") || text.Contains("collections") || text.Contains("mathematics")) return new Guidance("maybe", "Useful for measured simulation/performance hotspots; adopt only with profiler evidence.");
        if (text.Contains("visual scripting")) return new Guidance("maybe", "Could support prototyping, but avoid parallel gameplay logic without tests.");
        if (text.Contains("rider") || text.Contains("visual studio") || text.Contains("collab")) return new Guidance("no", "Editor integration only; helpful for development but not a reusable game asset.");
        if ((name ?? "").StartsWith("com.unity.modules.", StringComparison.OrdinalIgnoreCase)) return new Guidance("maybe", "Built-in Unity module; infrastructure rather than a standalone asset to inspect.");
        return new Guidance("maybe", "Installed package; inspect when its feature area becomes part of the next milestone.");
    }

    private static AssetGuidance AssetGroupGuidance(AssetGroupRecord group)
    {
        var text = (group.topLevelFolder + " " + group.category + " " + string.Join(" ", group.representativeFiles)).ToLowerInvariant();
        if (text.Contains("_recovery")) return new AssetGuidance("Unity recovery scene data; not intended as production content.", "Avoid using except as emergency reference.");
        if (group.topLevelFolder.Equals("Editor", StringComparison.OrdinalIgnoreCase)) return new AssetGuidance("Editor-only inventory/export tooling.", "Keep editor utilities isolated under Assets/Editor and do not ship them in runtime builds.");
        if (group.topLevelFolder.Equals("Tests", StringComparison.OrdinalIgnoreCase)) return new AssetGuidance("Regression and evidence coverage for prototype systems.", "Keep using for verification before asset or package swaps.");
        if (group.topLevelFolder.Equals("Scripts", StringComparison.OrdinalIgnoreCase)) return new AssetGuidance("Project-owned gameplay, HUD, flight, docking, combat, builder, and validation systems.", "Reuse existing systems instead of importing overlapping gameplay frameworks.");
        if (group.topLevelFolder.Equals("TextMesh Pro", StringComparison.OrdinalIgnoreCase)) return new AssetGuidance("TextMesh Pro font, shader, material, and settings assets for crisp HUD/menu text.", "Reuse directly for player-facing HUD and builder UI text; keep shader/material compatibility in mind.");
        if (text.Contains("prototypeshipkit") && text.Contains("parts")) return new AssetGuidance("Modular ship parts for current ship-builder/runtime visual work.", "Reuse directly and extend metadata before creating duplicate ship-part art.");
        if (text.Contains("demoships")) return new AssetGuidance("Assembled demo ship visuals for scout/cargo baselines.", "Inspect first for player, NPC, and evidence-scene visual baselines.");
        if (group.category == "VFX/particle systems" || text.Contains("/vfx/")) return new AssetGuidance("Thruster/RCS visual effects and material library.", "Reuse directly for flight evidence; adapt for combat variants later.");
        if (text.Contains("materials")) return new AssetGuidance("Prototype ship-kit material palette.", "Reuse as current visual language; normalize before external shader packs.");
        if (text.Contains("scenes")) return new AssetGuidance("Main prototype host, preview, sample, and recovery scenes.", "Use PrototypeBootstrapHost and PrototypeShipKitPreview as inspection entry points.");
        if (text.Contains("settings")) return new AssetGuidance("URP and project rendering settings.", "Keep as compatibility baseline for imported shaders, materials, and VFX.");
        if (text.Contains("tutorialinfo")) return new AssetGuidance("Unity template tutorial/readme assets.", "Low value for Weltraum-Spiel; avoid expanding this area.");
        if (group.category == "documentation/readmes") return new AssetGuidance("Readme or documentation asset metadata.", "Keep as reference only; do not treat Unity template readmes as game content.");
        if (group.category == "configuration/data") return new AssetGuidance("Configuration, manifests, input actions, or ScriptableObject data.", "Inspect before changing because these often bind runtime systems.");
        return new AssetGuidance("Imported project asset group.", "Inspect representatives before creating new assets in the same category.");
    }

    private static string LocalPackageCategory(string text)
    {
        var lower = text.ToLowerInvariant();
        if (lower.Contains("fmod")) return "Audio middleware";
        if (lower.Contains("modern menu") || lower.Contains("slimui")) return "UI/menu";
        if (lower.Contains("debug console")) return "Editor/runtime debug tooling";
        if (lower.Contains("skybox") || lower.Contains("stars")) return "Space environment/skybox";
        if (lower.Contains("particle")) return "Thruster/combat VFX";
        if (lower.Contains("war fx") || lower.Contains("quick effects") || lower.Contains("elemental vfx") || lower.Contains("weather")) return "Thruster/combat VFX";
        if (lower.Contains("tween") || lower.Contains("animation")) return "UI/animation polish";
        if (lower.Contains("umodeler") || lower.Contains("probuilder") || lower.Contains("modeling")) return "Editor tooling/modeling";
        if (lower.Contains("sci-fi") || lower.Contains("modular pack")) return "Ships/stations/modular sci-fi";
        if (lower.Contains("nature") || lower.Contains("terrain") || lower.Contains("environment") || lower.Contains("poly map") || lower.Contains("tree")) return "Planet-surface/environment placeholders";
        if (lower.Contains("human") || lower.Contains("character")) return "Characters/NPC placeholders";
        if (lower.Contains("post processing")) return "Rendering/post-processing";
        return "Unknown";
    }

    private static string LocalPackageUsefulness(string name, string category)
    {
        var lower = (name + " " + category).ToLowerInvariant();
        if (lower.Contains("skybox") || lower.Contains("particle") || lower.Contains("vfx") || lower.Contains("debug") || lower.Contains("tween") || lower.Contains("umodeler") || lower.Contains("probuilder") || lower.Contains("sci-fi") || lower.Contains("modern menu") || lower.Contains("fmod")) return "maybe";
        if (lower.Contains("nature") || lower.Contains("terrain") || lower.Contains("medieval") || lower.Contains("planet-surface") || lower.Contains("environment") || lower.Contains("tree") || lower.Contains("human") || lower.Contains("character")) return "no/maybe";
        return "maybe";
    }

    private static string LocalPackageRisk(string name, string category, string extension)
    {
        var lower = (name + " " + category + " " + extension).ToLowerInvariant();
        if (lower.Contains("fmod")) return "medium/high - middleware and native/plugin setup; test bank workflow outside main first.";
        if (lower.Contains("umodeler") || lower.Contains("probuilder") || lower.Contains("editor extension") || lower.Contains("modeling")) return "medium/high - editor extension and possible generated-asset workflow impact; test outside main first.";
        if (lower.Contains("post processing") || lower.Contains("shader") || lower.Contains("skybox")) return "medium - verify URP 17.4 shader/rendering compatibility first.";
        if (lower.Contains("legacy") || lower.Contains("particle") || lower.Contains("vfx") || lower.Contains("war fx") || lower.Contains("quick effects")) return "medium - may include legacy shaders/materials; import into throwaway first.";
        if (lower.Contains("debug console") || lower.Contains("tween") || lower.Contains("modern menu")) return "medium - runtime code/input/UI dependency; isolate first.";
        if (lower.Contains("sci-fi") || lower.Contains("modular")) return "medium - art pack may add many materials/prefabs; inspect hierarchy and scale outside main first.";
        if (lower.Contains("nature") || lower.Contains("terrain") || lower.Contains("environment") || lower.Contains("tree") || lower.Contains("human") || lower.Contains("character")) return "low/medium - mostly placeholder art, but can add many materials/textures and non-space content.";
        return "medium - package archive should be inspected in a throwaway project first.";
    }

    private static UsefulnessMatrixRecord Matrix(string category, string assets, string reuse, string adapt, string avoid)
    {
        return new UsefulnessMatrixRecord { category = category, candidateAssets = assets, whatToReuse = reuse, whatToAdapt = adapt, whatToAvoid = avoid };
    }

    private static void AddLimited(List<string> values, string value, int limit)
    {
        if (values.Count >= limit || string.IsNullOrEmpty(value)) return;
        if (!values.Contains(value, StringComparer.OrdinalIgnoreCase)) values.Add(value);
    }

    private static string TopFolder(string path)
    {
        var normalized = NormalizePath(path);
        if (!normalized.StartsWith("Assets/", StringComparison.OrdinalIgnoreCase)) return "External";
        var remainder = normalized.Substring("Assets/".Length);
        var slash = remainder.IndexOf('/');
        return slash < 0 ? "_Root" : remainder.Substring(0, slash);
    }

    private static IEnumerable<DirectoryInfo> SafeDirectories(string path)
    {
        try { return new DirectoryInfo(path).EnumerateDirectories("*", SearchOption.TopDirectoryOnly).ToList(); }
        catch { return Enumerable.Empty<DirectoryInfo>(); }
    }

    private static IEnumerable<FileInfo> SafeFiles(string path)
    {
        try { return new DirectoryInfo(path).EnumerateFiles("*", SearchOption.AllDirectories).ToList(); }
        catch { return Enumerable.Empty<FileInfo>(); }
    }

    private static string RelativePath(string root, string fullPath)
    {
        var rootUri = new Uri(root.EndsWith(Path.DirectorySeparatorChar.ToString(), StringComparison.Ordinal) ? root : root + Path.DirectorySeparatorChar);
        return Uri.UnescapeDataString(rootUri.MakeRelativeUri(new Uri(fullPath)).ToString()).Replace('/', Path.DirectorySeparatorChar);
    }

    private static bool IsAny(string value, params string[] candidates)
    {
        return candidates.Any(candidate => string.Equals(value, candidate, StringComparison.OrdinalIgnoreCase));
    }

    private static string NormalizePath(string path)
    {
        return string.IsNullOrEmpty(path) ? "" : path.Replace('\\', '/');
    }

    private static string Clean(string value)
    {
        return string.IsNullOrEmpty(value) ? "" : value.Replace("\r", " ").Replace("\n", " ").Trim();
    }

    private static string Md(string value)
    {
        return Clean(value).Replace("|", "\\|");
    }

    private sealed class Guidance
    {
        public string useful;
        public string reason;
        public Guidance(string useful, string reason) { this.useful = useful; this.reason = reason; }
    }

    private sealed class AssetGuidance
    {
        public string purpose;
        public string recommendation;
        public AssetGuidance(string purpose, string recommendation) { this.purpose = purpose; this.recommendation = recommendation; }
    }

    private sealed class Inventory
    {
        public string generatedAtUtc;
        public ProjectRecord project;
        public List<string> limitations;
        public List<PackageRecord> installedPackages;
        public List<AssetGroupRecord> importedAssets;
        public List<LocalPackageRecord> localDownloadedPackages;
        public List<UsefulnessMatrixRecord> usefulnessMatrix;
        public FinalRecommendations finalRecommendations;
    }

    private sealed class ProjectRecord
    {
        public string name;
        public string rootPath;
        public string assetsPath;
        public string unityVersion;
        public string platform;
    }

    private sealed class PackageRecord
    {
        public string name;
        public string displayName;
        public string version;
        public string source;
        public string description;
        public string packagePath;
        public string usefulForWeltraumSpiel;
        public string reason;
    }

    private sealed class AssetGroupRecord
    {
        public string topLevelFolder;
        public string category;
        public int assetCount;
        public List<string> representativeFiles;
        public string likelyPurpose;
        public List<string> dependenciesIfPractical;
        public List<string> componentNames;
        public string recommendation;
    }

    private sealed class LocalPackageRecord
    {
        public string source;
        public string vendorOrPublisherFolder;
        public string packageOrFolderName;
        public string rootPath;
        public List<string> availableFiles;
        public int availableFileCount;
        public long sizeBytes;
        public string looksLike;
        public List<string> readmeOrMetadata;
        public string categoryGuess;
        public string usefulForWeltraumSpiel;
        public string importRisk;
    }

    private sealed class UsefulnessMatrixRecord
    {
        public string category;
        public string candidateAssets;
        public string whatToReuse;
        public string whatToAdapt;
        public string whatToAvoid;
    }

    private sealed class FinalRecommendations
    {
        public List<string> top10AssetsOrPackagesToInspectFirst;
        public List<string> importIntoThrowawayProjectFirst;
        public List<string> safeToUseDirectly;
        public List<string> mayConflictWithProjectSettings;
        public List<string> missingAssetCategories;
    }
}
#endif
