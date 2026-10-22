"""Build the bounded render-only Distributor surface derivative from its sealed V1 GLB."""
from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
import struct
import sys
from pathlib import Path
from types import ModuleType


sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
ART = Path(__file__).resolve().parent
PUBLIC = ROOT / "apps/weltraum-browser/public/factory/play-2026-10-12"
V1_PUBLIC_MANIFEST = PUBLIC / "manifest.json"
V1_ART_MANIFEST = ROOT / "art/factory/play-2026-10-12/manifest.json"
HELPER_PATH = ROOT / "art/factory/play-cargo-surface-v2-2026-10-19/build_cargo_surface_v2.py"
V1_MANIFEST_BYTES = 83_735
V1_MANIFEST_SHA256 = "f76c9cb6e504555446d3bafe7b8ef7a95bdb3b9242df51a2ef836aec548f03e1"
V1_GLB_BYTES = 20_764
V1_GLB_SHA256 = "985f4c5627cc884c549dbe8aed9683798ef7a2d44c2f8340a3c2ef5fd9238b51"
HELPER_BYTES = 17_844
HELPER_SHA256 = "7f68693c9bbd8eb4299f56b0573b793ed908b5215c45783a3f2ba06ae4fdf96c"
OUTPUT_ID = "play_distribution_v2"
OUTPUT_SLUG = "distribution-v2"
OUTPUT_NAME = "distribution-v2.glb"
SIDECAR_NAME = "manifest-distribution-surface-v2.json"
MAX_FILE_BYTES = 108_824
LICENSE_BYTES = 326
LICENSE_SHA256 = "bc5e00789f9e69f40bb76b0db9802fca5122dde6d37f905c700b17febccbb632"
NATIVE_BOUNDS_M = {"min": [-1.0, 0.0, -0.5], "max": [1.0, 2.0, 0.5]}
FRONT_RECESS_M = {"EX-SHELL": 2 / 1024, "EX-FUNCTION": 1 / 1024}
EXPECTED_FRONT_VERTICES = {"EX-SHELL": 24, "EX-FUNCTION": 48}


def fail(message: str) -> None:
    raise ValueError(message)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def record(path: Path, data: bytes) -> dict[str, object]:
    return {"path": path.relative_to(ROOT).as_posix(), "sha256": sha256(data), "bytes": len(data)}


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def checked_record(entry: dict, key: str) -> tuple[Path, bytes]:
    ref = entry[key]
    path = ROOT / ref["path"]
    data = path.read_bytes()
    if len(data) != ref["bytes"] or sha256(data) != ref["sha256"]:
        fail(f"Sealed Distributor source changed: {ref['path']}")
    return path, data


def load_binary_helpers() -> ModuleType:
    helper_bytes = HELPER_PATH.read_bytes()
    if len(helper_bytes) != HELPER_BYTES or sha256(helper_bytes) != HELPER_SHA256:
        fail("Pinned Cargo V2 GLB helper changed")
    spec = importlib.util.spec_from_file_location("fp06_pinned_cargo_glb_helpers", HELPER_PATH)
    if spec is None or spec.loader is None:
        fail("Could not load the pinned Cargo V2 GLB helper")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def read_historical_source_blob(entry: dict) -> tuple[bytes, str]:
    ref = entry["sourceBlob"]
    path = ROOT / ref["path"]
    raw = path.read_bytes()
    if len(raw) == ref["bytes"] and sha256(raw) == ref["sha256"]:
        return raw, "none"
    normalized = raw.replace(b"\r\n", b"\n")
    if len(normalized) != ref["bytes"] or sha256(normalized) != ref["sha256"]:
        fail("Historical Distributor Native source blob is not recoverable by CRLF-to-LF normalization")
    return normalized, "CRLF-to-LF checkout normalization only"


def read_historical_license(ref: dict) -> tuple[bytes, str]:
    """Normalize only this text license when CRLF checkout bytes match its pinned LF record."""
    if ref["bytes"] != LICENSE_BYTES or ref["sha256"] != LICENSE_SHA256:
        fail("V1 Distributor license manifest pin changed")
    path = ROOT / ref["path"]
    raw = path.read_bytes()
    try:
        raw.decode("utf-8")
    except UnicodeDecodeError:
        fail("Historical Distributor license is not valid UTF-8")
    if len(raw) == LICENSE_BYTES and sha256(raw) == LICENSE_SHA256:
        return raw, "none"
    if b"\r" in raw.replace(b"\r\n", b""):
        fail("Historical Distributor license has line endings other than CRLF")
    normalized = raw.replace(b"\r\n", b"\n")
    if len(normalized) != LICENSE_BYTES or sha256(normalized) != LICENSE_SHA256:
        fail("Historical Distributor license does not normalize to the sealed LF bytes")
    return normalized, "CRLF-to-LF checkout normalization only"


def derive(helper: ModuleType, source_path: Path, original: dict) -> tuple[bytes, dict[str, object]]:
    document, binary = helper.read_glb(source_path)
    metadata = document.get("asset", {}).get("extras", {}).get("hestia", {})
    if metadata.get("assetId") != original["assetId"] or metadata.get("assetRevision") != 1:
        fail("V1 Distributor GLB identity/revision mismatch")
    nodes = document.get("nodes", [])
    if sorted(node.get("name") for node in nodes) != sorted(original["partIds"]):
        fail("V1 Distributor render parts differ from Native manifest bindings")

    materials = document.get("materials", [])
    roles_by_accessor: dict[int, set[str]] = {}
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            role = materials[primitive["material"]]["name"]
            positions_index = primitive["attributes"]["POSITION"]
            roles_by_accessor.setdefault(positions_index, set()).add(role)
    seen_targets: dict[int, str] = {}
    changed_by_role = {role: 0 for role in FRONT_RECESS_M}
    changed_accessors: set[int] = set()
    vertex_count = 0
    index_count = 0
    primitive_count = 0

    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            role = materials[primitive["material"]]["name"]
            attributes = primitive["attributes"]
            positions_index = attributes["POSITION"]
            position_accessor, start, _ = helper.accessor_values(document, binary, positions_index)
            normal_accessor, _, _ = helper.accessor_values(document, binary, attributes["NORMAL"])
            if position_accessor["count"] != normal_accessor["count"]:
                fail(f"Distributor position/normal vertex count mismatch for {role}")
            vertex_count += position_accessor["count"]
            index_count += document["accessors"][primitive["indices"]]["count"]
            primitive_count += 1
            if role not in FRONT_RECESS_M:
                continue
            if roles_by_accessor[positions_index] != {role}:
                fail("Distributor target position accessor is shared across material roles")
            previous_role = seen_targets.setdefault(positions_index, role)
            if previous_role != role:
                fail("Distributor target position accessor is shared across material roles")
            if positions_index in changed_accessors:
                continue
            changed_accessors.add(positions_index)
            recess = FRONT_RECESS_M[role]
            for vertex in range(position_accessor["count"]):
                z_offset = start + vertex * 12 + 8
                z = struct.unpack_from("<f", binary, z_offset)[0]
                if z == 0.5:
                    struct.pack_into("<f", binary, z_offset, z - recess)
                    changed_by_role[role] += 1
            actual_min = [float("inf")] * 3
            actual_max = [float("-inf")] * 3
            for vertex in range(position_accessor["count"]):
                point = struct.unpack_from("<3f", binary, start + vertex * 12)
                for axis, value in enumerate(point):
                    actual_min[axis] = min(actual_min[axis], value)
                    actual_max[axis] = max(actual_max[axis], value)
            position_accessor["min"] = actual_min
            position_accessor["max"] = actual_max

    if changed_by_role != EXPECTED_FRONT_VERTICES:
        fail(f"Unexpected Distributor front vertex counts: {changed_by_role}")
    if (vertex_count, index_count, primitive_count) != (480, 720, 7):
        fail("Sealed Distributor GLB geometry census changed")

    metadata["assetId"] = OUTPUT_ID
    metadata["assetRevision"] = 1
    output = helper.glb_bytes(document, binary)
    if len(output) > MAX_FILE_BYTES:
        fail("Distributor V2 GLB exceeds the unchanged per-file budget")
    repair = {
        "version": 1,
        "kind": "bounded-render-surface-coplanarity-repair",
        "originalAssetId": original["assetId"],
        "nativeAuthority": "unchanged original source only",
        "frontPlaneFromM": 0.5,
        "frontPlaneToMByRole": {role: 0.5 - recess for role, recess in FRONT_RECESS_M.items()},
        "frontRecessMByRole": FRONT_RECESS_M,
        "frontChangedVertexCountByRole": changed_by_role,
        "changedVertexCount": sum(changed_by_role.values()),
        "topology": "same indexed triangles, materials, nodes, primitives and Native bindings",
        "meshCensus": {"vertices": vertex_count, "indices": index_count, "primitives": primitive_count},
        "nativeBoundsM": copy.deepcopy(NATIVE_BOUNDS_M),
    }
    return output, repair


def main() -> None:
    public_manifest_bytes = V1_PUBLIC_MANIFEST.read_bytes()
    if len(public_manifest_bytes) != V1_MANIFEST_BYTES or sha256(public_manifest_bytes) != V1_MANIFEST_SHA256:
        fail("Original public Play manifest seal changed")
    art_manifest_bytes = V1_ART_MANIFEST.read_bytes()
    if art_manifest_bytes != public_manifest_bytes:
        fail("Original authoring/public Play manifests differ")
    public_manifest = json.loads(public_manifest_bytes)
    entries = [entry for entry in public_manifest["assets"] if entry["assetId"] == "play_distribution_v1"]
    if len(entries) != 1:
        fail("Original Distributor manifest entry is missing or duplicated")
    original = entries[0]

    source_glb = PUBLIC / "distribution.glb"
    source_glb_bytes = source_glb.read_bytes()
    if len(source_glb_bytes) != V1_GLB_BYTES or sha256(source_glb_bytes) != V1_GLB_SHA256:
        fail("Original Distributor runtime GLB seal changed")
    if original["runtimeGlb"]["path"] != source_glb.relative_to(ROOT).as_posix():
        fail("Original Distributor manifest path changed")
    for key in ("sourceFile", "sourceSnapshot", "nativeBlend", "exporterReport"):
        checked_record(original, key)
    source_file = ROOT / original["sourceFile"]["path"]
    source_file_bytes = source_file.read_bytes()
    if (original["sourceFile"]["sha256"] != original["sourceBlob"]["sha256"]
            or original["sourceFile"]["bytes"] != original["sourceBlob"]["bytes"]):
        fail("Distributor Native source file/blob manifest bindings differ")
    archived_blob, normalization = read_historical_source_blob(original)
    canonical_license_bytes, license_normalization = read_historical_license(original["license"])
    source_snapshot_path = ROOT / original["sourceSnapshot"]["path"]
    source_snapshot = json.loads(source_snapshot_path.read_text(encoding="utf-8"))
    if original["nativeBoundsM"] != NATIVE_BOUNDS_M or sorted(p["partId"] for p in source_snapshot["parts"]) != sorted(original["partIds"]):
        fail("Distributor Native source snapshot identity/bounds changed")
    if len(source_file_bytes) != original["sourceFile"]["bytes"] or sha256(source_file_bytes) != original["sourceFile"]["sha256"]:
        fail("Distributor Native source file bytes do not match the sealed manifest")

    helper = load_binary_helpers()
    output_bytes, repair = derive(helper, source_glb, original)
    art_glb = ART / OUTPUT_NAME
    public_glb = PUBLIC / OUTPUT_NAME
    archive_path = ART / "distribution-v1.native-owner-source.blob"
    license_path = ART / "LICENSE.txt"
    provenance_path = ART / "distribution-v2.provenance.json"
    sidecar_path = PUBLIC / SIDECAR_NAME
    authoring_manifest_path = ART / "manifest.json"
    destinations = (art_glb, public_glb, archive_path, license_path, provenance_path, sidecar_path, authoring_manifest_path)
    if any(path.exists() for path in destinations):
        fail("A Distributor V2 output already exists; refusing to overwrite it")

    helper_record = {"path": HELPER_PATH.relative_to(ROOT).as_posix(), "sha256": HELPER_SHA256, "bytes": HELPER_BYTES}
    archived_record = record(archive_path, archived_blob)
    canonical_license = copy.deepcopy(original["license"])
    canonical_license.update(record(license_path, canonical_license_bytes))
    provenance = {
        "schema": "hestia.play-distribution-surface-provenance/v1",
        "sourceHead": original["sourceHead"],
        "assetId": OUTPUT_ID,
        "originalAssetId": original["assetId"],
        "sourceRuntimeGlb": {"path": source_glb.relative_to(ROOT).as_posix(), "sha256": V1_GLB_SHA256, "bytes": len(source_glb_bytes)},
        "sourceFile": copy.deepcopy(original["sourceFile"]),
        "sourceBlob": copy.deepcopy(original["sourceBlob"]),
        "archivedSourceBlob": {**archived_record, "checkoutNormalization": normalization,
                               "recordedV1SourceBlob": copy.deepcopy(original["sourceBlob"])},
        "sourceSnapshot": copy.deepcopy(original["sourceSnapshot"]),
        "nativeBoundsM": copy.deepcopy(NATIVE_BOUNDS_M),
        "generator": {"path": Path(__file__).relative_to(ROOT).as_posix(), "sha256": sha256(Path(__file__).read_bytes()),
                      "bytes": Path(__file__).stat().st_size},
        "binaryHelper": helper_record,
        "outputAuthoringGlb": record(art_glb, output_bytes),
        "outputPublicGlb": {**record(public_glb, output_bytes), "url": f"/factory/play-2026-10-12/{OUTPUT_NAME}"},
        "visualRepair": repair,
        "license": canonical_license,
        "historicalLicense": copy.deepcopy(original["license"]),
        "licenseNormalization": license_normalization,
        "authority": "render-only Distributor surface; original Native source, profile, collision, and save authority remain unchanged",
    }
    runtime_entry = {key: copy.deepcopy(original[key]) for key in (
        "family", "definitionRef", "visualOnlyAnchor", "sourceHead", "sourceFile", "sourceBlob", "sourceSnapshot",
        "units", "runtimeAxes", "origin", "partIds", "parentPartIds", "nativeBoundsM", "nativeReferences",
        "nativeBlend", "exporterReport", "nodeContract",
    )}
    runtime_entry.update({
        "assetId": OUTPUT_ID,
        "slug": OUTPUT_SLUG,
        "runtimeGlb": {**record(public_glb, output_bytes), "url": f"/factory/play-2026-10-12/{OUTPUT_NAME}"},
        "sourceRuntimeGlb": {"path": source_glb.relative_to(ROOT).as_posix(), "sha256": V1_GLB_SHA256, "bytes": len(source_glb_bytes)},
        "runtimeAdoption": "PENDING_INTEGRATOR",
        "ownerArtAcceptance": "OWNER_REVIEW_PENDING",
        "visualRepair": repair,
    })
    runtime_entry["license"] = canonical_license
    write_json(provenance_path, provenance)
    runtime_entry["provenance"] = record(provenance_path, provenance_path.read_bytes())
    runtime_manifest = {
        "schema": public_manifest["schema"],
        "sourceHead": original["sourceHead"],
        "assets": [runtime_entry],
        "palette": copy.deepcopy(public_manifest["palette"]),
        "authority": "render-only Distributor derivative; original Native source and collision remain authoritative",
        "knownGaps": ["runtime adoption and rendered owner inspection remain integrator scope"],
    }
    write_json(sidecar_path, runtime_manifest)
    authoring_manifest = {
        "schema": "hestia.play-distribution-surface-derivative/v1",
        "sourceHead": original["sourceHead"],
        "sourceManifest": {"path": V1_PUBLIC_MANIFEST.relative_to(ROOT).as_posix(),
                           "sha256": V1_MANIFEST_SHA256, "bytes": V1_MANIFEST_BYTES},
        "generator": {"path": Path(__file__).relative_to(ROOT).as_posix(),
                      "sha256": sha256(Path(__file__).read_bytes()),
                      "bytes": Path(__file__).stat().st_size},
        "binaryHelper": helper_record,
        "asset": provenance,
        "publicManifest": record(sidecar_path, sidecar_path.read_bytes()),
        "authority": "render-only Distributor surface correction; Native authority is unchanged",
    }
    write_json(authoring_manifest_path, authoring_manifest)
    archive_path.write_bytes(archived_blob)
    license_path.write_bytes(canonical_license_bytes)
    art_glb.write_bytes(output_bytes)
    public_glb.write_bytes(output_bytes)
    print(f"DISTRIBUTOR_SURFACE_V2_BUILT={OUTPUT_ID} bytes={len(output_bytes)} "
          f"vertices={repair['meshCensus']['vertices']} indices={repair['meshCensus']['indices']} "
          f"primitives={repair['meshCensus']['primitives']} changed={repair['changedVertexCount']}")
    print(f"DISTRIBUTOR_SURFACE_V2_MANIFEST={sidecar_path.relative_to(ROOT).as_posix()} "
          f"bytes={sidecar_path.stat().st_size} sha256={sha256(sidecar_path.read_bytes())}")


if __name__ == "__main__":
    main()
