"""Build sealed render-only V2 derivatives for the two existing B09 poses."""
from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
import math
import struct
from pathlib import Path
from types import ModuleType


ROOT = Path(__file__).resolve().parents[3]
ART = Path(__file__).resolve().parent
PUBLIC = ROOT / "apps/weltraum-browser/public/factory/play-2026-10-12"
V1_PUBLIC_MANIFEST = PUBLIC / "manifest.json"
V1_ART_MANIFEST = ROOT / "art/factory/play-2026-10-12/manifest.json"
HELPER_PATH = ROOT / "art/factory/play-cargo-surface-v2-2026-10-19/build_cargo_surface_v2.py"
SOURCE_HEAD = "96cced23cd285b57f8a557d01ac9ed8a158c927f"
V1_MANIFEST_BYTES = 83_735
V1_MANIFEST_SHA256 = "f76c9cb6e504555446d3bafe7b8ef7a95bdb3b9242df51a2ef836aec548f03e1"
HELPER_BYTES = 17_844
HELPER_SHA256 = "7f68693c9bbd8eb4299f56b0573b793ed908b5215c45783a3f2ba06ae4fdf96c"
SURFACE_GAP_M = 1 / 1024
NATIVE_BOUNDS_M = {"min": [-1.0, 0.0, -1.0], "max": [1.0, 1.5, 1.0]}
PALETTE = {
    "EX-STRUCT": "30383D",
    "EX-SHELL": "B6BDB8",
    "EX-FUNCTION": "407A79",
    "EX-HAZARD": "D8A94E",
    "EX-PV": "1D2E3C",
}
OUTPUTS = {
    "play_storage_v1": ("play_storage_v2", "storage-v2", "storage-v2.glb"),
    "play_storage_inspection_open_v1": (
        "play_storage_inspection_open_v2", "storage-open-v2", "storage-open-v2.glb"
    ),
}
MAX_GLB_BYTES = 108_824


def fail(message: str) -> None:
    raise ValueError(message)


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def record(path: Path, data: bytes) -> dict[str, object]:
    return {"path": path.relative_to(ROOT).as_posix(), "sha256": digest(data), "bytes": len(data)}


def json_bytes(value: object) -> bytes:
    return (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode("utf-8")


def write_json(path: Path, value: object) -> bytes:
    data = json_bytes(value)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return data


def load_binary_helpers() -> ModuleType:
    helper_bytes = HELPER_PATH.read_bytes()
    if len(helper_bytes) != HELPER_BYTES or digest(helper_bytes) != HELPER_SHA256:
        fail("Pinned Cargo V2 GLB helper changed")
    spec = importlib.util.spec_from_file_location("fp06_pinned_storage_glb_helpers", HELPER_PATH)
    if spec is None or spec.loader is None:
        fail("Could not load the pinned Cargo V2 GLB helper")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def checked_record(entry: dict, key: str) -> tuple[Path, bytes]:
    ref = entry[key]
    path = ROOT / ref["path"]
    raw = path.read_bytes()
    if len(raw) != ref["bytes"] or digest(raw) != ref["sha256"]:
        fail(f"Sealed B09 source changed: {ref['path']}")
    return path, raw


def read_historical_blob(entry: dict) -> tuple[bytes, str]:
    ref = entry["sourceBlob"]
    raw = (ROOT / ref["path"]).read_bytes()
    if len(raw) == ref["bytes"] and digest(raw) == ref["sha256"]:
        return raw, "none"
    normalized = raw.replace(b"\r\n", b"\n")
    if len(normalized) != ref["bytes"] or digest(normalized) != ref["sha256"]:
        fail("Historical B09 Native source blob is not recoverable by CRLF-to-LF normalization")
    return normalized, "CRLF-to-LF checkout normalization only"


def read_historical_license(ref: dict) -> tuple[bytes, str]:
    raw = (ROOT / ref["path"]).read_bytes()
    try:
        raw.decode("utf-8")
    except UnicodeDecodeError:
        fail("Historical B09 license is not valid UTF-8")
    if len(raw) == ref["bytes"] and digest(raw) == ref["sha256"]:
        return raw, "none"
    if b"\r" in raw.replace(b"\r\n", b""):
        fail("Historical B09 license has line endings other than CRLF")
    normalized = raw.replace(b"\r\n", b"\n")
    if len(normalized) != ref["bytes"] or digest(normalized) != ref["sha256"]:
        fail("Historical B09 license does not normalize to its sealed bytes")
    return normalized, "CRLF-to-LF checkout normalization only"


def role_name(value: str) -> str:
    aliases = {
        "play_ex_struct": "EX-STRUCT",
        "play_ex_shell": "EX-SHELL",
        "play_ex_function": "EX-FUNCTION",
        "play_ex_hazard": "EX-HAZARD",
        "play_ex_pv": "EX-PV",
    }
    return aliases.get(value, value)


def source_part_bounds(source_snapshot: dict) -> dict[str, dict[str, list[float]]]:
    """Derive position-axis bounds from frozen B09 source boxes, not report axes."""
    parts = source_snapshot.get("parts")
    if not isinstance(parts, list):
        fail("B09 Native source snapshot has no parts list")
    result: dict[str, dict[str, list[float]]] = {}
    for part in parts:
        part_id = part.get("partId")
        boxes = part.get("boxes")
        if not isinstance(part_id, str) or part_id in result or not isinstance(boxes, list) or not boxes:
            fail("B09 Native source snapshot has an invalid part/box set")
        low = [float("inf")] * 3
        high = [float("-inf")] * 3
        for box in boxes:
            center, size = box.get("centerM"), box.get("sizeM")
            if (not isinstance(center, list) or len(center) != 3 or not isinstance(size, list)
                    or len(size) != 3 or box.get("rotationZRadians", 0) != 0):
                fail(f"B09 part {part_id} needs a closed axis-aligned source box")
            for axis in range(3):
                minimum = center[axis] - size[axis] / 2
                maximum = center[axis] + size[axis] / 2
                low[axis] = min(low[axis], minimum)
                high[axis] = max(high[axis], maximum)
        result[part_id] = {"min": low, "max": high}
    return result


def read_indices(document: dict, binary: bytearray, index: int) -> list[int]:
    accessor = document["accessors"][index]
    if accessor.get("type") != "SCALAR" or accessor.get("sparse") is not None:
        fail(f"Expected a dense scalar index accessor {index}")
    widths = {5123: (2, "H"), 5125: (4, "I")}
    spec = widths.get(accessor.get("componentType"))
    if spec is None:
        fail(f"Unsupported B09 index component type at accessor {index}")
    width, format_code = spec
    view = document["bufferViews"][accessor["bufferView"]]
    if view.get("buffer") != 0:
        fail(f"Unexpected B09 index buffer at accessor {index}")
    stride = view.get("byteStride", width)
    if stride != width:
        fail(f"Unexpected B09 index stride at accessor {index}")
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    end = start + accessor["count"] * width
    if start < 0 or end > len(binary):
        fail(f"B09 index accessor {index} exceeds BIN bounds")
    return [struct.unpack_from("<" + format_code, binary, start + offset * width)[0]
            for offset in range(accessor["count"])]


def position_values(helper: ModuleType, document: dict, binary: bytearray, accessor_index: int) -> tuple[dict, int, list[tuple[float, float, float]]]:
    accessor, start, _ = helper.accessor_values(document, binary, accessor_index)
    points = [struct.unpack_from("<3f", binary, start + vertex * 12)
              for vertex in range(accessor["count"])]
    return accessor, start, points


def project(point: tuple[float, float, float], normal_axis: int) -> tuple[float, float]:
    axes = [axis for axis in range(3) if axis != normal_axis]
    return point[axes[0]], point[axes[1]]


def overlap_area(subject: list[tuple[float, float]], clip: list[tuple[float, float]]) -> float:
    def cross(a: tuple[float, float], b: tuple[float, float], point: tuple[float, float]) -> float:
        return (b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0])

    orientation = math.copysign(1.0, cross(clip[0], clip[1], clip[2]))
    if cross(clip[0], clip[1], clip[2]) == 0:
        return 0.0
    polygon = subject
    for edge in range(3):
        if not polygon:
            return 0.0
        a, b = clip[edge], clip[(edge + 1) % 3]
        incoming = polygon
        polygon = []
        for index, start in enumerate(incoming):
            end = incoming[(index + 1) % len(incoming)]
            start_distance = orientation * cross(a, b, start)
            end_distance = orientation * cross(a, b, end)
            start_inside = start_distance >= -1e-12
            end_inside = end_distance >= -1e-12
            if start_inside != end_inside:
                amount = start_distance / (start_distance - end_distance)
                polygon.append((start[0] + amount * (end[0] - start[0]),
                                start[1] + amount * (end[1] - start[1])))
            if end_inside:
                polygon.append(end)
    if len(polygon) < 3:
        return 0.0
    return abs(sum(point[0] * polygon[(index + 1) % len(polygon)][1]
                   - point[1] * polygon[(index + 1) % len(polygon)][0]
                   for index, point in enumerate(polygon))) / 2


def triangles_by_role(helper: ModuleType, document: dict, binary: bytearray) -> tuple[list[dict], dict[int, dict[str, set[int]]], dict[int, tuple[dict, int, list[tuple[float, float, float]]]]]:
    triangles: list[dict] = []
    references: dict[int, dict[str, set[int]]] = {}
    positions: dict[int, tuple[dict, int, list[tuple[float, float, float]]]] = {}
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            attributes = primitive.get("attributes", {})
            if "POSITION" not in attributes or "NORMAL" not in attributes:
                fail("Every B09 surface primitive must retain POSITION and NORMAL")
            role = role_name(document["materials"][primitive["material"]]["name"])
            if role not in PALETTE:
                fail(f"Unexpected B09 surface material role: {role}")
            accessor_index = attributes["POSITION"]
            if accessor_index not in positions:
                positions[accessor_index] = position_values(helper, document, binary, accessor_index)
            accessor, _, points = positions[accessor_index]
            normal_accessor = document["accessors"][attributes["NORMAL"]]
            if normal_accessor.get("count") != accessor.get("count"):
                fail(f"B09 position/normal vertex count mismatch for {role}")
            indices = read_indices(document, binary, primitive["indices"])
            if len(indices) % 3:
                fail(f"B09 primitive has a non-triangular index count: {role}")
            references.setdefault(accessor_index, {}).setdefault(role, set()).update(indices)
            for offset in range(0, len(indices), 3):
                vertex_ids = tuple(indices[offset:offset + 3])
                if any(vertex_id >= len(points) for vertex_id in vertex_ids):
                    fail(f"B09 primitive index exceeds POSITION accessor for {role}")
                triangles.append({"role": role, "accessor": accessor_index, "vertices": vertex_ids,
                                  "points": tuple(points[vertex_id] for vertex_id in vertex_ids)})
    if not triangles:
        fail("B09 GLB has no indexed triangles")
    return triangles, references, positions


def coplanar_axis(point_triangle: tuple[tuple[float, float, float], ...]) -> tuple[int, float] | None:
    for axis in range(3):
        coordinate = point_triangle[0][axis]
        if all(point[axis] == coordinate for point in point_triangle[1:]):
            return axis, coordinate
    return None


def find_overlaps(triangles: list[dict]) -> dict[tuple[int, float], list[tuple[dict, dict]]]:
    shells = [triangle for triangle in triangles if triangle["role"] == "EX-SHELL"]
    structures = [triangle for triangle in triangles if triangle["role"] == "EX-STRUCT"]
    overlaps: dict[tuple[int, float], list[tuple[dict, dict]]] = {}
    for shell in shells:
        shell_plane = coplanar_axis(shell["points"])
        if shell_plane is None:
            continue
        axis, plane = shell_plane
        shell_2d = [project(point, axis) for point in shell["points"]]
        for structure in structures:
            structure_plane = coplanar_axis(structure["points"])
            if structure_plane != shell_plane:
                continue
            structure_2d = [project(point, axis) for point in structure["points"]]
            if overlap_area(shell_2d, structure_2d) > 1e-10:
                overlaps.setdefault((axis, plane), []).append((shell, structure))
    return overlaps


def derive(helper: ModuleType, input_path: Path, original: dict, output_id: str,
           source_snapshot: dict) -> tuple[bytes, dict[str, object]]:
    document, binary = helper.read_glb(input_path)
    metadata = document.get("asset", {}).get("extras", {}).get("hestia", {})
    if metadata.get("assetId") != original["assetId"] or metadata.get("assetRevision") != 1:
        fail(f"B09 V1 GLB identity/revision mismatch: {input_path}")
    if sorted(node.get("name") for node in document.get("nodes", [])) != sorted(original["partIds"]):
        fail(f"B09 V1 GLB part IDs changed: {input_path}")
    bounds_by_part = source_part_bounds(source_snapshot)
    if sorted(bounds_by_part) != sorted(original["partIds"]):
        fail("B09 frozen source part IDs differ from the original manifest")

    # The existing Play loader rejects transformed nodes and compares raw POSITION
    # accessors directly against Native/runtime XYZ bounds. Verify that same basis
    # here before using source-box extrema to select coplanar shell faces.
    for node in document["nodes"]:
        if (node.get("translation", [0, 0, 0]) != [0, 0, 0]
                or node.get("rotation", [0, 0, 0, 1]) != [0, 0, 0, 1]
                or node.get("scale", [1, 1, 1]) != [1, 1, 1]
                or node.get("matrix") not in (None, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
                or node.get("children") is not None):
            fail(f"B09 GLB part transform is not the existing identity contract: {node.get('name')}")
        mesh_index = node.get("mesh")
        part_bounds = bounds_by_part.get(node["name"])
        if not isinstance(mesh_index, int) or part_bounds is None or mesh_index >= len(document["meshes"]):
            fail("B09 GLB mesh/source part binding changed")
        for primitive in document["meshes"][mesh_index]["primitives"]:
            _, _, points = position_values(helper, document, binary, primitive["attributes"]["POSITION"])
            for point in points:
                for axis, value in enumerate(point):
                    if (not math.isfinite(value)
                            or value < part_bounds["min"][axis] - 1e-6
                            or value > part_bounds["max"][axis] + 1e-6
                            or value < original["nativeBoundsM"]["min"][axis] - 1e-6
                            or value > original["nativeBoundsM"]["max"][axis] + 1e-6):
                        fail(f"B09 GLB accessor axis {axis} does not match source/runtime bounds for {node['name']}")

    original_triangles, role_refs, position_accessors = triangles_by_role(helper, document, binary)
    overlap_pairs = find_overlaps(original_triangles)
    if not overlap_pairs:
        fail(f"No proven EX-SHELL/EX-STRUCT coplanar overlap in {original['assetId']}")

    patches: dict[tuple[int, int, int], float] = {}
    plane_records: list[dict[str, object]] = []
    for (axis, plane), pairs in sorted(overlap_pairs.items()):
        body_bounds = bounds_by_part["body"]
        if plane not in (body_bounds["min"][axis], body_bounds["max"][axis]):
            fail(f"Coplanar B09 overlap is outside the frozen body source planes: axis={axis}, plane={plane}")
        centre = (body_bounds["min"][axis] + body_bounds["max"][axis]) / 2
        direction = 1.0 if plane < centre else -1.0
        shifted_plane = plane + direction * SURFACE_GAP_M
        if shifted_plane == plane:
            fail("B09 surface separation is not representable in source float precision")
        touched_vertices: set[tuple[int, int]] = set()
        for shell, _structure in pairs:
            for vertex_id in shell["vertices"]:
                key = (shell["accessor"], vertex_id, axis)
                before = position_accessors[shell["accessor"]][2][vertex_id][axis]
                if before != plane:
                    fail("Coplanar shell triangle changed its plane unexpectedly")
                previous = patches.setdefault(key, shifted_plane)
                if previous != shifted_plane:
                    fail("Conflicting B09 shell plane patches target one vertex")
                touched_vertices.add((shell["accessor"], vertex_id))
        plane_records.append({
            "positionAccessorAxis": ["X", "Y", "Z"][axis],
            "positionPlaneFromM": plane,
            "positionPlaneToM": shifted_plane,
            "inwardOffsetM": SURFACE_GAP_M,
            "overlappingTrianglePairs": len(pairs),
            "changedVertexCount": len(touched_vertices),
        })

    for accessor_index, vertex_id, _axis in patches:
        other_roles = [role for role, vertices in role_refs[accessor_index].items()
                       if role != "EX-SHELL" and vertex_id in vertices]
        if other_roles:
            fail(f"B09 target shell vertex is shared with other material roles: {other_roles}")

    modified_accessors: set[int] = set()
    changed_fields: dict[str, int] = {"positionX": 0, "positionY": 0, "positionZ": 0}
    for (accessor_index, vertex_id, axis), value in patches.items():
        _, start, _points = position_accessors[accessor_index]
        struct.pack_into("<f", binary, start + vertex_id * 12 + axis * 4, value)
        modified_accessors.add(accessor_index)
        axis_name = ("X", "Y", "Z")[axis]
        changed_fields[f"position{axis_name}"] += 1
    for accessor_index in modified_accessors:
        accessor, _, points = position_values(helper, document, binary, accessor_index)
        accessor["min"] = [min(point[axis] for point in points) for axis in range(3)]
        accessor["max"] = [max(point[axis] for point in points) for axis in range(3)]

    corrected_triangles, _, _ = triangles_by_role(helper, document, binary)
    remaining = find_overlaps(corrected_triangles)
    if remaining:
        fail(f"B09 surface correction left coplanar shell/structure overlaps: {list(remaining)}")

    metadata["assetId"] = output_id
    metadata["assetRevision"] = 1
    output = helper.glb_bytes(document, binary)
    if len(output) > MAX_GLB_BYTES:
        fail("B09 V2 GLB exceeds the unchanged per-file budget")
    repair = {
        "version": 1,
        "kind": "bounded-render-surface-coplanarity-repair",
        "originalAssetId": original["assetId"],
        "nativeAuthority": "unchanged original B09 source only",
        "surfaceGapM": SURFACE_GAP_M,
        "positionAccessorAxisMapping": {"X": "Native/runtime X", "Y": "Native/runtime Y", "Z": "Native/runtime Z"},
        "nativeBodyBoundsM": copy.deepcopy(bounds_by_part["body"]),
        "planes": plane_records,
        "changedCoordinateCountByAxis": changed_fields,
        "changedCoordinateCount": len(patches),
        "topology": "same indexed triangles, normals, materials, nodes and Native bindings",
        "meshCensus": {
            "vertices": sum(accessor[0]["count"] for accessor in position_accessors.values()),
            "indices": sum(len(read_indices(document, binary, primitive["indices"]))
                            for mesh in document["meshes"] for primitive in mesh["primitives"]),
            "primitives": sum(len(mesh["primitives"]) for mesh in document["meshes"]),
        },
        "nativeBoundsM": copy.deepcopy(NATIVE_BOUNDS_M),
    }
    return output, repair


def main() -> None:
    manifest_bytes = V1_PUBLIC_MANIFEST.read_bytes()
    if len(manifest_bytes) != V1_MANIFEST_BYTES or digest(manifest_bytes) != V1_MANIFEST_SHA256:
        fail("Original public B09 Play manifest seal changed")
    if V1_ART_MANIFEST.read_bytes() != manifest_bytes:
        fail("Original authoring/public Play manifests differ")
    original_manifest = json.loads(manifest_bytes)
    originals = {entry["assetId"]: entry for entry in original_manifest["assets"]}
    if not all(asset_id in originals for asset_id in OUTPUTS):
        fail("Original closed/open B09 entries are missing")
    helper = load_binary_helpers()
    generator_bytes = Path(__file__).read_bytes()
    generator_record = {"path": Path(__file__).relative_to(ROOT).as_posix(),
                        "sha256": digest(generator_bytes), "bytes": len(generator_bytes)}

    outputs: list[dict[str, object]] = []
    provenance_records: list[dict[str, object]] = []
    archived_blob: bytes | None = None
    blob_normalization = "none"
    license_data: bytes | None = None
    license_normalization = "none"
    for original_id, (output_id, slug, filename) in OUTPUTS.items():
        original = originals[original_id]
        source_path = ROOT / original["runtimeGlb"]["path"]
        source_bytes = source_path.read_bytes()
        if len(source_bytes) != original["runtimeGlb"]["bytes"] or digest(source_bytes) != original["runtimeGlb"]["sha256"]:
            fail(f"Original B09 runtime GLB seal changed: {source_path.name}")
        if original["nativeBoundsM"] != NATIVE_BOUNDS_M or original["definitionRef"] != {
            "sourceId": "B09", "version": 1, "digest": "fnv1a:b4a9402f"
        }:
            fail(f"Original B09 Native identity/bounds changed: {original_id}")
        if (original["sourceFile"]["sha256"] != original["sourceBlob"]["sha256"]
                or original["sourceFile"]["bytes"] != original["sourceBlob"]["bytes"]):
            fail(f"Original B09 source file/blob contract changed: {original_id}")
        _, source_snapshot_bytes = checked_record(original, "sourceSnapshot")
        source_snapshot = json.loads(source_snapshot_bytes.decode("utf-8"))
        for key in ("nativeBlend", "exporterReport", "provenance"):
            checked_record(original, key)
        blob, conversion = read_historical_blob(original)
        if archived_blob is None:
            archived_blob = blob
            blob_normalization = conversion
        elif archived_blob != blob:
            fail("Closed/open B09 historical Native source blobs differ")
        if license_data is None:
            license_data, license_normalization = read_historical_license(original["license"])
        output_bytes, repair = derive(helper, source_path, original, output_id, source_snapshot)
        if len(output_bytes) > MAX_GLB_BYTES:
            fail(f"B09 V2 GLB exceeds the unchanged per-file budget: {filename}")
        outputs.append({
            "original": original,
            "sourcePath": source_path,
            "sourceBytes": source_bytes,
            "outputId": output_id,
            "slug": slug,
            "filename": filename,
            "outputBytes": output_bytes,
            "repair": repair,
            "blob": blob,
            "blobNormalization": conversion,
        })

    assert archived_blob is not None and license_data is not None
    license_ref = copy.deepcopy(originals["play_storage_v1"]["license"])
    license_path = ART / "LICENSE.txt"
    license_ref.update(record(license_path, license_data))
    archive_path = ART / "storage-v1.native-owner-source.blob"
    archive_ref = record(archive_path, archived_blob)
    helper_record = {"path": HELPER_PATH.relative_to(ROOT).as_posix(),
                     "sha256": HELPER_SHA256, "bytes": HELPER_BYTES}
    all_destinations = [
        ART / item["filename"] for item in outputs
    ] + [
        PUBLIC / item["filename"] for item in outputs
    ] + [
        ART / f"{item['slug']}.provenance.json" for item in outputs
    ] + [archive_path, license_path, ART / "manifest.json",
         PUBLIC / "manifest-storage-surface-v2.json"]
    if any(path.exists() for path in all_destinations):
        fail("A B09 V2 output already exists; refusing to overwrite it")

    for item in outputs:
        original = item["original"]
        source_path = item["sourcePath"]
        source_bytes = item["sourceBytes"]
        output_bytes = item["outputBytes"]
        art_glb = ART / item["filename"]
        public_glb = PUBLIC / item["filename"]
        provenance_path = ART / f"{item['slug']}.provenance.json"
        provenance = {
            "schema": "hestia.play-storage-surface-provenance/v1",
            "sourceHead": SOURCE_HEAD,
            "assetId": item["outputId"],
            "originalAssetId": original["assetId"],
            "sourceRuntimeGlb": {"path": source_path.relative_to(ROOT).as_posix(),
                                  "sha256": digest(source_bytes), "bytes": len(source_bytes)},
            "sourceFile": copy.deepcopy(original["sourceFile"]),
            "sourceBlob": copy.deepcopy(original["sourceBlob"]),
            "archivedSourceBlob": {
                **archive_ref,
                "checkoutNormalization": item["blobNormalization"],
                "recordedV1SourceBlob": copy.deepcopy(original["sourceBlob"]),
            },
            "sourceSnapshot": copy.deepcopy(original["sourceSnapshot"]),
            "nativeBoundsM": copy.deepcopy(NATIVE_BOUNDS_M),
            "generator": generator_record,
            "binaryHelper": helper_record,
            "outputAuthoringGlb": record(art_glb, output_bytes),
            "outputPublicGlb": {**record(public_glb, output_bytes),
                                "url": f"/factory/play-2026-10-12/{item['filename']}"},
            "visualRepair": item["repair"],
            "license": license_ref,
            "historicalLicense": copy.deepcopy(original["license"]),
            "licenseNormalization": license_normalization,
            "authority": "render-only B09 surface; original Native source, profile, collision and save authority remain unchanged",
        }
        provenance_bytes = json_bytes(provenance)
        runtime_entry = {key: copy.deepcopy(original[key]) for key in (
            "family", "definitionRef", "visualOnlyAnchor", "sourceHead", "sourceFile", "sourceBlob",
            "sourceSnapshot", "units", "runtimeAxes", "origin", "partIds", "parentPartIds",
            "nativeBoundsM", "nativeReferences", "nativeBlend", "exporterReport", "nodeContract",
        )}
        runtime_entry.update({
            "assetId": item["outputId"],
            "slug": item["slug"],
            "runtimeGlb": {**record(public_glb, output_bytes),
                           "url": f"/factory/play-2026-10-12/{item['filename']}"},
            "sourceRuntimeGlb": {"path": source_path.relative_to(ROOT).as_posix(),
                                  "sha256": digest(source_bytes), "bytes": len(source_bytes)},
            "provenance": record(provenance_path, provenance_bytes),
            "license": license_ref,
            "runtimeAdoption": "PENDING_INTEGRATOR",
            "ownerArtAcceptance": "OWNER_REVIEW_PENDING",
            "visualRepair": item["repair"],
        })
        if original["assetId"] == "play_storage_inspection_open_v1":
            runtime_entry["visualVariant"] = {
                "baseAssetId": "play_storage_v2",
                "kind": "confirmed-local-inventory-inspection",
                "pose": "access-open",
                "requiresConfirmedLocalAccess": True,
            }
        provenance_records.append(provenance)
        item["provenanceBytes"] = provenance_bytes
        item["runtimeEntry"] = runtime_entry

    sidecar = {
        "schema": original_manifest["schema"],
        "sourceHead": SOURCE_HEAD,
        "assets": [item["runtimeEntry"] for item in outputs],
        "palette": PALETTE,
        "authority": "derived B09 render meshes only; original Native source, collision, custody and save authority remain unchanged",
        "knownGaps": ["runtime adoption and actual rendered B09 inspection remain Integrator scope"],
    }
    sidecar_bytes = json_bytes(sidecar)
    sidecar_path = PUBLIC / "manifest-storage-surface-v2.json"
    authoring_manifest = {
        "schema": "hestia.play-storage-surface-derivatives/v1",
        "sourceHead": SOURCE_HEAD,
        "sourceManifest": {"path": V1_PUBLIC_MANIFEST.relative_to(ROOT).as_posix(),
                           "sha256": digest(manifest_bytes), "bytes": len(manifest_bytes)},
        "generator": generator_record,
        "binaryHelper": helper_record,
        "assets": provenance_records,
        "publicManifest": record(sidecar_path, sidecar_bytes),
        "palette": PALETTE,
        "authority": "Render-only B09 correction; no source/native/physics/save authority",
    }

    ART.mkdir(parents=True, exist_ok=True)
    for item in outputs:
        (ART / item["filename"]).write_bytes(item["outputBytes"])
        (PUBLIC / item["filename"]).write_bytes(item["outputBytes"])
        provenance_path = ART / f"{item['slug']}.provenance.json"
        provenance_path.write_bytes(item["provenanceBytes"])
        print(f"B09_SURFACE_V2_BUILT={item['outputId']} bytes={len(item['outputBytes'])} "
              f"changedCoordinates={item['repair']['changedCoordinateCount']}")
    archive_path.write_bytes(archived_blob)
    license_path.write_bytes(license_data)
    write_json(sidecar_path, sidecar)
    write_json(ART / "manifest.json", authoring_manifest)
    print(f"B09_SURFACE_V2_MANIFEST={sidecar_path.relative_to(ROOT).as_posix()} "
          f"bytes={len(sidecar_bytes)} sha256={digest(sidecar_bytes)}")


if __name__ == "__main__":
    main()
