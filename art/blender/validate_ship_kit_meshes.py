import json
import os

import bmesh
import bpy


REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
REPORT_PATH = os.path.join(os.path.dirname(__file__), "ship_kit_mesh_validation_report.md")
MANIFEST_PATH = os.path.join(
    REPO_ROOT,
    "art",
    "source",
    "ships",
    "prototype-ship-kit",
    "metadata",
    "prototype_ship_kit_manifest.json",
)


def collect_collection_objects(collection_name):
    collection = bpy.data.collections.get(collection_name)
    if collection is None:
        return list(bpy.context.scene.objects)

    objects = []
    seen = set()

    def walk(current):
        for obj in current.objects:
            if obj.name not in seen:
                objects.append(obj)
                seen.add(obj.name)
        for child in current.children:
            walk(child)

    walk(collection)
    return objects


def mesh_stats(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.verts.ensure_lookup_table()
    bm.edges.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    loose_vertices = len([vert for vert in bm.verts if not vert.link_edges])
    loose_edges = len([edge for edge in bm.edges if len(edge.link_faces) == 0])
    loose_faces = len([face for face in bm.faces if len(face.verts) == 0])
    non_manifold_edges = len([edge for edge in bm.edges if not edge.is_manifold])
    boundary_edges = len([edge for edge in bm.edges if edge.is_boundary])
    zero_area_faces = len([face for face in bm.faces if face.calc_area() <= 0.000001])
    bm.free()
    return {
        "looseVertices": loose_vertices,
        "looseEdges": loose_edges,
        "looseFaces": loose_faces,
        "nonManifoldEdges": non_manifold_edges,
        "boundaryEdges": boundary_edges,
        "zeroAreaFaces": zero_area_faces,
    }


def material_is_opaque(material):
    if material is None:
        return False
    if material.diffuse_color[3] < 0.999:
        return False
    blend_method = getattr(material, "blend_method", "OPAQUE")
    surface_method = getattr(material, "surface_render_method", "OPAQUE")
    if blend_method in ("BLEND", "CLIP"):
        return False
    if surface_method == "BLENDED":
        return False
    return True


def path_exists(repo_relative_path):
    return os.path.exists(os.path.join(REPO_ROOT, repo_relative_path.replace("/", os.sep)))


def load_manifest():
    with open(MANIFEST_PATH, "r", encoding="utf-8") as handle:
        return json.load(handle)


def collect_descendants(root_name):
    root = bpy.data.objects.get(root_name)
    if root is None:
        return []

    objects = []

    def walk(current):
        objects.append(current)
        for child in current.children:
            walk(child)

    walk(root)
    return objects


def is_runtime_marker(obj):
    return obj is not None and obj.type == "EMPTY" and "VIS_PART" not in obj.name


def has_descendant_or_self(candidate, ancestor):
    current = candidate
    while current is not None:
        if current == ancestor:
            return True
        current = current.parent
    return False


def validate_demo_scout_functional_markers():
    objects = collect_descendants("DEMO_Scout_Mk1")
    names = {obj.name for obj in objects}
    runtime_empties = [obj for obj in objects if is_runtime_marker(obj)]
    missing = []
    hierarchy_issues = []

    required_weapon_markers = [
        "WEAPON_TURRET_BASE_PRIMARY",
        "WEAPON_TURRET_YAW_PRIMARY",
        "WEAPON_TURRET_PITCH_PRIMARY",
        "WEAPON_MUZZLE_PRIMARY",
        "WEAPON_MUZZLE_FLASH_PRIMARY",
    ]
    for marker in required_weapon_markers:
        if marker not in names:
            missing.append(marker)

    if not any("THRUST_NOZZLE_MAIN" in obj.name for obj in runtime_empties):
        missing.append("THRUST_NOZZLE_MAIN*")

    required_rcs_directions = ["FORWARD", "BACK", "LEFT", "RIGHT", "UP", "DOWN"]
    for direction in required_rcs_directions:
        if not any("RCS_NOZZLE_" in obj.name and direction in obj.name.upper() for obj in runtime_empties):
            missing.append("RCS_NOZZLE_" + direction + "_*")

    base = bpy.data.objects.get("WEAPON_TURRET_BASE_PRIMARY")
    yaw = bpy.data.objects.get("WEAPON_TURRET_YAW_PRIMARY")
    pitch = bpy.data.objects.get("WEAPON_TURRET_PITCH_PRIMARY")
    muzzle = bpy.data.objects.get("WEAPON_MUZZLE_PRIMARY")
    flash = bpy.data.objects.get("WEAPON_MUZZLE_FLASH_PRIMARY")
    barrel = bpy.data.objects.get("DEMO_Scout_Mk1_GEO_Gun_Barrel")
    yaw_mesh = bpy.data.objects.get("DEMO_Scout_Mk1_GEO_Gun_Mount_Base")
    muzzle_mesh = bpy.data.objects.get("DEMO_Scout_Mk1_GEO_Gun_Muzzle_Red")

    if yaw is not None and base is not None and yaw.parent != base:
        hierarchy_issues.append("WEAPON_TURRET_YAW_PRIMARY must be child of WEAPON_TURRET_BASE_PRIMARY.")
    if pitch is not None and yaw is not None and pitch.parent != yaw:
        hierarchy_issues.append("WEAPON_TURRET_PITCH_PRIMARY must be child of WEAPON_TURRET_YAW_PRIMARY.")
    if muzzle is not None and pitch is not None and muzzle.parent != pitch:
        hierarchy_issues.append("WEAPON_MUZZLE_PRIMARY must be child of WEAPON_TURRET_PITCH_PRIMARY.")
    if flash is not None and muzzle is not None and not has_descendant_or_self(flash, muzzle):
        hierarchy_issues.append("WEAPON_MUZZLE_FLASH_PRIMARY must follow WEAPON_MUZZLE_PRIMARY.")
    if barrel is not None and pitch is not None and not has_descendant_or_self(barrel, pitch):
        hierarchy_issues.append("Gun barrel mesh must be below WEAPON_TURRET_PITCH_PRIMARY.")
    if muzzle_mesh is not None and pitch is not None and not has_descendant_or_self(muzzle_mesh, pitch):
        hierarchy_issues.append("Gun muzzle mesh must be below WEAPON_TURRET_PITCH_PRIMARY.")
    if yaw_mesh is not None and yaw is not None and not has_descendant_or_self(yaw_mesh, yaw):
        hierarchy_issues.append("Visible yaw assembly mesh must be below WEAPON_TURRET_YAW_PRIMARY.")

    return {
        "missingFunctionalMarkers": missing,
        "functionalMarkerMissingCount": len(missing),
        "turretHierarchyIssues": hierarchy_issues,
        "turretHierarchyIssueCount": len(hierarchy_issues),
    }


def validate():
    objects = collect_collection_objects("ModularShipKit")
    mesh_objects = [obj for obj in objects if obj.type == "MESH"]
    empty_objects = [obj for obj in objects if obj.type == "EMPTY"]
    connector_empties = [
        obj
        for obj in empty_objects
        if "CONN_" in obj.name or "NOZZLE" in obj.name or "MUZZLE" in obj.name
    ]

    negative_scale = []
    missing_materials = []
    transparent_materials = []
    total = {
        "looseVertices": 0,
        "looseEdges": 0,
        "looseFaces": 0,
        "nonManifoldEdges": 0,
        "boundaryEdges": 0,
        "zeroAreaFaces": 0,
    }
    per_mesh_issues = []

    for obj in mesh_objects:
        if obj.scale.x < 0 or obj.scale.y < 0 or obj.scale.z < 0:
            negative_scale.append(obj.name)
        if not obj.data.materials:
            missing_materials.append(obj.name)
        for material in obj.data.materials:
            if material is not None and not material_is_opaque(material):
                transparent_materials.append(material.name)

        stats = mesh_stats(obj)
        for key in total:
            total[key] += stats[key]
        if any(stats[key] for key in stats):
            per_mesh_issues.append({"name": obj.name, **stats})

    manifest = load_manifest()
    expected_exports = []
    for part in manifest.get("parts", []):
        expected_exports.append(part.get("exportPath", ""))
        if part.get("unityModelPath"):
            expected_exports.append(part.get("unityModelPath"))
    for demo in manifest.get("demoShips", []):
        expected_exports.append(demo.get("exportPath", ""))
        if demo.get("unityModelPath"):
            expected_exports.append(demo.get("unityModelPath"))
    missing_exports = [path for path in expected_exports if path and not path_exists(path)]
    functional_marker_result = validate_demo_scout_functional_markers()

    result = {
        "objectCount": len(objects),
        "meshCount": len(mesh_objects),
        "materialCount": len(bpy.data.materials),
        "meshObjectsWithMaterials": len([obj for obj in mesh_objects if obj.data.materials]),
        "negativeScaleCount": len(negative_scale),
        "missingMaterialMeshCount": len(missing_materials),
        "transparentMaterialCount": len(set(transparent_materials)),
        "connectorEmptyCount": len(connector_empties),
        "looseVertices": total["looseVertices"],
        "looseEdges": total["looseEdges"],
        "looseFaces": total["looseFaces"],
        "nonManifoldEdges": total["nonManifoldEdges"],
        "boundaryEdges": total["boundaryEdges"],
        "zeroAreaFaces": total["zeroAreaFaces"],
        "missingExportCount": len(missing_exports),
        "negativeScaleObjects": negative_scale,
        "missingMaterialMeshes": missing_materials,
        "transparentMaterials": sorted(set(transparent_materials)),
        "missingExports": missing_exports,
        "meshIssues": per_mesh_issues[:80],
        **functional_marker_result,
    }
    result["ok"] = (
        result["meshCount"] > 0
        and result["connectorEmptyCount"] > 0
        and result["negativeScaleCount"] == 0
        and result["missingMaterialMeshCount"] == 0
        and result["transparentMaterialCount"] == 0
        and result["looseVertices"] == 0
        and result["looseEdges"] == 0
        and result["looseFaces"] == 0
        and result["nonManifoldEdges"] == 0
        and result["zeroAreaFaces"] == 0
        and result["missingExportCount"] == 0
        and result["functionalMarkerMissingCount"] == 0
        and result["turretHierarchyIssueCount"] == 0
    )
    return result


def write_report(result):
    lines = [
        "# Ship Kit Mesh Validation Report",
        "",
        f"- Result: {'PASS' if result['ok'] else 'FAIL'}",
        f"- Object count: {result['objectCount']}",
        f"- Mesh count: {result['meshCount']}",
        f"- Material count: {result['materialCount']}",
        f"- Meshes with material assignment: {result['meshObjectsWithMaterials']}",
        f"- Connector/nozzle/muzzle empties: {result['connectorEmptyCount']}",
        f"- Negative scale objects: {result['negativeScaleCount']}",
        f"- Meshes missing materials: {result['missingMaterialMeshCount']}",
        f"- Non-opaque materials: {result['transparentMaterialCount']}",
        f"- Loose vertices: {result['looseVertices']}",
        f"- Loose edges: {result['looseEdges']}",
        f"- Loose faces: {result['looseFaces']}",
        f"- Non-manifold edges: {result['nonManifoldEdges']}",
        f"- Boundary edges: {result['boundaryEdges']}",
        f"- Zero-area faces: {result['zeroAreaFaces']}",
        f"- Missing exports: {result['missingExportCount']}",
        f"- Missing Demo Scout functional markers: {result['functionalMarkerMissingCount']}",
        f"- Demo Scout turret hierarchy issues: {result['turretHierarchyIssueCount']}",
        "",
        "## Notes",
        "",
        "- Materials are expected to be opaque for this prototype, including the dark-blue canopy.",
        "- Blender 5 reports alpha-1 materials as HASHED/DITHERED; this report treats them as opaque-compatible when alpha is 1 and surface mode is not BLENDED.",
        "- Connector, nozzle, and muzzle empties are intentionally counted as builder/gameplay metadata.",
        "- Demo Scout runtime markers are required: main/RCS nozzles and WEAPON_* turret/muzzle markers fail this report when missing.",
        "- Marker axes: Unity forward is force/projectile direction; plume VFX renders opposite the nozzle forward axis.",
        "- Boundary edge count is expected to remain zero for the current solid low-poly kit.",
        "",
    ]

    if result["negativeScaleObjects"]:
        lines.extend(["## Negative Scale Objects", ""])
        lines.extend(f"- {name}" for name in result["negativeScaleObjects"])
        lines.append("")
    if result["missingMaterialMeshes"]:
        lines.extend(["## Meshes Missing Materials", ""])
        lines.extend(f"- {name}" for name in result["missingMaterialMeshes"])
        lines.append("")
    if result["transparentMaterials"]:
        lines.extend(["## Non-Opaque Materials", ""])
        lines.extend(f"- {name}" for name in result["transparentMaterials"])
        lines.append("")
    if result["missingExports"]:
        lines.extend(["## Missing Exports", ""])
        lines.extend(f"- {path}" for path in result["missingExports"])
        lines.append("")
    if result["missingFunctionalMarkers"]:
        lines.extend(["## Missing Demo Scout Functional Markers", ""])
        lines.extend(f"- {name}" for name in result["missingFunctionalMarkers"])
        lines.append("")
    if result["turretHierarchyIssues"]:
        lines.extend(["## Demo Scout Turret Hierarchy Issues", ""])
        lines.extend(f"- {issue}" for issue in result["turretHierarchyIssues"])
        lines.append("")
    if result["meshIssues"]:
        lines.extend(["## Mesh Issue Samples", ""])
        for issue in result["meshIssues"]:
            lines.append(
                f"- {issue['name']}: looseV={issue['looseVertices']}, looseE={issue['looseEdges']}, "
                f"nonManifold={issue['nonManifoldEdges']}, boundary={issue['boundaryEdges']}, "
                f"zeroArea={issue['zeroAreaFaces']}"
            )
        lines.append("")

    with open(REPORT_PATH, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines))


if __name__ == "__main__":
    validation_result = validate()
    write_report(validation_result)
    print(json.dumps(validation_result, indent=2))
