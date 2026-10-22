"""Create the two approved Cargo render-only V2 GLB derivatives from sealed V1 files."""
from __future__ import annotations

import copy
import hashlib
import json
import struct
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
ART = Path(__file__).resolve().parent
V1_PUBLIC = ROOT / "apps/weltraum-browser/public/factory/play-2026-10-12"
V1_MANIFEST = V1_PUBLIC / "manifest.json"
V1_ART_MANIFEST = ROOT / "art/factory/play-2026-10-12/manifest.json"
OUTPUT_PUBLIC = V1_PUBLIC
SOURCE_HEAD = "96cced23cd285b57f8a557d01ac9ed8a158c927f"
MANIFEST_SHA256 = "f76c9cb6e504555446d3bafe7b8ef7a95bdb3b9242df51a2ef836aec548f03e1"
MANIFEST_BYTES = 83_735
FRONT_SURFACE_POLICY = {
    "EX-STRUCT": 1 / 1024,
    "EX-SHELL": 2 / 1024,
}
REAR_SHELL_RECESS = 2 / 1024
EXPECTED_INPUTS = {
    "play_wreck_cargo_v1": ("wreck-cargo.glb", 15_108,
                            "4b16d587014cba2587b8cf7ca34f674f3352c77c25aecfac3dca2073bd17a639"),
    "play_wreck_cargo_open_v1": ("wreck-cargo-open.glb", 13_648,
                                 "304daec645c51a27e1735db2dc0b173cbbd01a8276d5b1862b54049af991c03a"),
}
EXPECTED_FRONT_VERTEX_COUNTS = {"EX-STRUCT": 48, "EX-SHELL": 24}
EXPECTED_REAR_SHELL_VERTEX_COUNT = 12
EXPECTED_BOUNDS_MM = {"min": [-6250, 1250, 12625], "max": [-4750, 2750, 13625]}
PALETTE = {
    "EX-STRUCT": "30383D",
    "EX-SHELL": "B6BDB8",
    "EX-FUNCTION": "407A79",
    "EX-HAZARD": "D8A94E",
    "EX-PV": "1D2E3C",
}


def fail(message: str) -> None:
    raise ValueError(message)


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def record(path: Path) -> dict[str, object]:
    data = path.read_bytes()
    return {"path": path.relative_to(ROOT).as_posix(), "sha256": digest(data), "bytes": len(data)}


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def read_glb(path: Path) -> tuple[dict[str, object], bytearray]:
    data = path.read_bytes()
    if len(data) < 28 or struct.unpack_from("<4sII", data) != (b"glTF", 2, len(data)):
        fail(f"Invalid V1 GLB header: {path}")
    offset = 12
    json_chunk: bytes | None = None
    binary_chunk: bytes | None = None
    while offset < len(data):
        if offset + 8 > len(data):
            fail(f"Truncated GLB chunk header: {path}")
        size, kind = struct.unpack_from("<II", data, offset)
        end = offset + 8 + size
        if end > len(data) or size % 4:
            fail(f"Invalid GLB chunk size: {path}")
        chunk = data[offset + 8:end]
        if kind == 0x4E4F534A and json_chunk is None:
            json_chunk = chunk
        elif kind == 0x004E4942 and binary_chunk is None:
            binary_chunk = chunk
        else:
            fail(f"Unexpected/duplicate GLB chunk: {path}")
        offset = end
    if offset != len(data) or json_chunk is None or binary_chunk is None:
        fail(f"Incomplete GLB chunks: {path}")
    document = json.loads(json_chunk.decode("utf-8"))
    if not isinstance(document, dict):
        fail(f"GLB JSON root must be an object: {path}")
    return document, bytearray(binary_chunk)


def glb_bytes(document: dict[str, object], binary: bytearray) -> bytes:
    encoded = json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    encoded += b" " * ((-len(encoded)) % 4)
    body = (struct.pack("<II", len(encoded), 0x4E4F534A) + encoded
            + struct.pack("<II", len(binary), 0x004E4942) + binary)
    return struct.pack("<4sII", b"glTF", 2, 12 + len(body)) + body


def accessor_values(document: dict[str, object], binary: bytearray, index: int) -> tuple[dict, int, int]:
    accessors = document["accessors"]
    views = document["bufferViews"]
    accessor = accessors[index]
    if accessor.get("componentType") != 5126 or accessor.get("type") != "VEC3" or accessor.get("sparse") is not None:
        fail(f"Expected dense float VEC3 accessor {index}")
    view = views[accessor["bufferView"]]
    if view.get("buffer") != 0 or view.get("byteStride", 12) != 12:
        fail(f"Unexpected Cargo position layout for accessor {index}")
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    end = start + accessor["count"] * 12
    if start < 0 or end > len(binary):
        fail(f"Cargo position accessor {index} exceeds BIN bounds")
    return accessor, start, end


def derive(input_path: Path, original: dict[str, object], output_id: str) -> tuple[bytes, dict[str, object]]:
    document, binary = read_glb(input_path)
    metadata = document.get("asset", {}).get("extras", {}).get("hestia", {})
    if metadata.get("assetId") != original["assetId"] or metadata.get("assetRevision") != 1:
        fail(f"V1 GLB identity/revision mismatch: {input_path}")
    if document.get("nodes", [{}])[0].get("name") != "cargo_access" or len(document.get("nodes", [])) != 1:
        fail(f"Cargo V1 node identity changed: {input_path}")

    front_changed: dict[str, int] = {role: 0 for role in FRONT_SURFACE_POLICY}
    rear_shell_changed = 0
    accessors_seen: set[int] = set()
    vertex_total = 0
    index_total = 0
    primitive_total = 0
    materials = document["materials"]
    for mesh in document["meshes"]:
        for primitive in mesh["primitives"]:
            material = materials[primitive["material"]]["name"]
            if material not in PALETTE:
                fail(f"Unexpected Cargo material role: {material}")
            position_index = primitive["attributes"]["POSITION"]
            normal_index = primitive["attributes"]["NORMAL"]
            position_accessor, start, _ = accessor_values(document, binary, position_index)
            normal_accessor, _, _ = accessor_values(document, binary, normal_index)
            if position_accessor["count"] != normal_accessor["count"]:
                fail(f"Cargo position/normal vertex count mismatch: {material}")
            vertex_total += position_accessor["count"]
            index_total += document["accessors"][primitive["indices"]]["count"]
            primitive_total += 1
            if material not in FRONT_SURFACE_POLICY:
                continue
            if position_index in accessors_seen:
                fail(f"Cargo V1 shares a target role position accessor: {material}")
            accessors_seen.add(position_index)
            delta = FRONT_SURFACE_POLICY[material]
            for vertex in range(position_accessor["count"]):
                z_offset = start + vertex * 12 + 8
                z = struct.unpack_from("<f", binary, z_offset)[0]
                if z == -0.5:
                    struct.pack_into("<f", binary, z_offset, z + delta)
                    front_changed[material] += 1
                elif material == "EX-SHELL" and z == 0.5:
                    struct.pack_into("<f", binary, z_offset, z - REAR_SHELL_RECESS)
                    rear_shell_changed += 1
            actual_min = [float("inf")] * 3
            actual_max = [float("-inf")] * 3
            for vertex in range(position_accessor["count"]):
                point = struct.unpack_from("<3f", binary, start + vertex * 12)
                for axis, value in enumerate(point):
                    actual_min[axis] = min(actual_min[axis], value)
                    actual_max[axis] = max(actual_max[axis], value)
            position_accessor["min"] = actual_min
            position_accessor["max"] = actual_max

    if (len(accessors_seen) != len(FRONT_SURFACE_POLICY)
            or front_changed != EXPECTED_FRONT_VERTEX_COUNTS
            or rear_shell_changed != EXPECTED_REAR_SHELL_VERTEX_COUNT):
        fail(f"Unexpected Cargo target vertex counts: front={front_changed}, rearShell={rear_shell_changed}")
    metadata["assetId"] = output_id
    metadata["assetRevision"] = 1
    output = glb_bytes(document, binary)
    repair = {
        "version": 2,
        "kind": "bounded-render-surface-coplanarity-repair",
        "originalAssetId": original["assetId"],
        "nativeAuthority": "unchanged original source only",
        "frontPlaneFromM": -0.5,
        "frontPlaneToMByRole": {role: -0.5 + amount for role, amount in FRONT_SURFACE_POLICY.items()},
        "frontRecessMByRole": FRONT_SURFACE_POLICY,
        "rearPlaneFromM": 0.5,
        "rearPlaneToMByRole": {"EX-SHELL": 0.5 - REAR_SHELL_RECESS},
        "rearRecessMByRole": {"EX-SHELL": REAR_SHELL_RECESS},
        "frontChangedVertexCountByRole": front_changed,
        "rearChangedVertexCountByRole": {"EX-SHELL": rear_shell_changed},
        "changedVertexCountByRole": {"EX-STRUCT": front_changed["EX-STRUCT"],
                                      "EX-SHELL": front_changed["EX-SHELL"] + rear_shell_changed},
        "changedVertexCount": sum(front_changed.values()) + rear_shell_changed,
        "maxVertexDisplacementM": max((*FRONT_SURFACE_POLICY.values(), REAR_SHELL_RECESS)),
        "topology": "same indexed triangles, materials, nodes and primitives",
        "meshCensus": {"vertices": vertex_total, "indices": index_total, "primitives": primitive_total},
        "nativeBoundsMm": copy.deepcopy(EXPECTED_BOUNDS_MM),
    }
    return output, repair


def checked_record(value: dict, key: str) -> tuple[dict, Path]:
    entry = value[key]
    path = ROOT / entry["path"]
    data = path.read_bytes()
    if len(data) != entry["bytes"] or digest(data) != entry["sha256"]:
        fail(f"V1 sealed source changed: {entry['path']}")
    return entry, path


def read_historical_source_blob(entry: dict) -> tuple[bytes, str]:
    """Undo only checkout CRLF conversion when it exactly recovers the V1 seal."""
    blob_record = entry["sourceBlob"]
    path = ROOT / blob_record["path"]
    raw = path.read_bytes()
    if len(raw) == blob_record["bytes"] and digest(raw) == blob_record["sha256"]:
        archived = raw
        conversion = "none"
    else:
        normalized = raw.replace(b"\r\n", b"\n")
        if len(normalized) != blob_record["bytes"] or digest(normalized) != blob_record["sha256"]:
            fail(f"V1 historical sourceBlob cannot be recovered from line-ending conversion: {path}")
        archived = normalized
        conversion = "CRLF-to-LF checkout normalization only"
    return archived, conversion


def main() -> None:
    manifest_data = V1_MANIFEST.read_bytes()
    if len(manifest_data) != MANIFEST_BYTES or digest(manifest_data) != MANIFEST_SHA256:
        fail("Original public Play manifest seal changed")
    public_manifest = json.loads(manifest_data)
    art_manifest_data = V1_ART_MANIFEST.read_bytes()
    if digest(art_manifest_data) != MANIFEST_SHA256:
        fail("Original authoring Play manifest seal changed")
    art_manifest = json.loads(art_manifest_data)
    if public_manifest.get("assets") != art_manifest.get("assets"):
        fail("Original public/art Play manifest entries differ")

    entries = {entry["assetId"]: entry for entry in public_manifest["assets"]}
    output_entries: list[dict[str, object]] = []
    provenance_records: list[dict[str, object]] = []
    output_assets = {
        "play_wreck_cargo_v1": ("play_wreck_cargo_v2", "wreck-cargo-v2"),
        "play_wreck_cargo_open_v1": ("play_wreck_cargo_open_v2", "wreck-cargo-open-v2"),
    }
    script_record = record(Path(__file__))
    archived_source_blob: dict[str, object] | None = None

    for original_id, (output_id, slug) in output_assets.items():
        original = entries.get(original_id)
        if original is None:
            fail(f"Original Cargo asset missing from sealed manifest: {original_id}")
        filename, expected_bytes, expected_sha = EXPECTED_INPUTS[original_id]
        input_path = V1_PUBLIC / filename
        input_data = input_path.read_bytes()
        if len(input_data) != expected_bytes or digest(input_data) != expected_sha:
            fail(f"Original Cargo GLB seal changed: {filename}")
        source_file = original["sourceFile"]
        source_blob = original["sourceBlob"]
        historical_blob, blob_conversion = read_historical_source_blob(original)
        if archived_source_blob is None:
            archive_path = ART / "cargoSite-v1.native-owner-source.blob"
            archive_path.write_bytes(historical_blob)
            archived_source_blob = {**record(archive_path), "checkoutNormalization": blob_conversion,
                                    "recordedV1SourceBlob": copy.deepcopy(source_blob)}
        elif archive_path.read_bytes() != historical_blob:
            fail("Closed/open Cargo historical sourceBlobs differ")
        source_snapshot, source_snapshot_path = checked_record(original, "sourceSnapshot")
        if source_file["sha256"] != source_blob["sha256"] or source_file["bytes"] != source_blob["bytes"]:
            fail(f"Cargo native source file/blob mismatch: {original_id}")
        snapshot = json.loads(source_snapshot_path.read_text(encoding="utf-8"))
        if snapshot.get("parts", [{}])[0].get("partId") != "cargo_access":
            fail(f"Cargo native source snapshot identity changed: {original_id}")
        if original["nativeBoundsM"] != {"min": [-0.75, 0.0, -0.5], "max": [0.75, 1.5, 0.5]}:
            fail(f"Cargo native render bounds changed: {original_id}")
        if original["visualOnlyAnchor"]["nativeBoundsMm"] != EXPECTED_BOUNDS_MM:
            fail(f"Cargo Native world bounds changed: {original_id}")

        output, repair = derive(input_path, original, output_id)
        art_name = slug + ".glb"
        public_name = art_name
        art_path = ART / art_name
        public_path = OUTPUT_PUBLIC / public_name
        art_path.write_bytes(output)
        public_path.write_bytes(output)
        if len(output) > 108_824:
            fail(f"Cargo V2 output exceeds the existing per-file cap: {public_name}")

        provenance_path = ART / (output_id.removeprefix("play_") + ".provenance.json")
        provenance = {
            "schema": "hestia.play-cargo-surface-provenance/v1",
            "sourceHead": SOURCE_HEAD,
            "assetId": output_id,
            "originalAssetId": original_id,
            "sourceRuntimeGlb": {"path": input_path.relative_to(ROOT).as_posix(), "sha256": digest(input_data), "bytes": len(input_data)},
            "sourceFile": source_file,
            "sourceBlob": source_blob,
            "archivedSourceBlob": {key: copy.deepcopy(archived_source_blob[key])
                                   for key in ("path", "sha256", "bytes")}
                                   | {"checkoutNormalization": blob_conversion,
                                      "recordedV1SourceBlob": copy.deepcopy(source_blob)},
            "sourceSnapshot": source_snapshot,
            "sourceSnapshotBoundsMm": EXPECTED_BOUNDS_MM,
            "generator": script_record,
            "outputAuthoringGlb": record(art_path),
            "outputPublicGlb": {**record(public_path), "url": f"/factory/play-2026-10-12/{public_name}"},
            "visualRepair": repair,
            "license": original["license"],
            "authority": "render-only Cargo display; no Native, collision, quantity, mass, access, visibility or save authority",
        }
        write_json(provenance_path, provenance)

        runtime_entry = {
            key: copy.deepcopy(original[key]) for key in (
                "family", "definitionRef", "visualOnlyAnchor", "sourceHead", "sourceFile", "sourceBlob",
                "sourceSnapshot", "units", "runtimeAxes", "origin", "partIds", "parentPartIds",
                "nativeBoundsM", "nativeReferences", "license", "nodeContract",
            )
        }
        runtime_entry.update({
            "assetId": output_id,
            "slug": slug,
            "runtimeGlb": {**record(public_path), "url": f"/factory/play-2026-10-12/{public_name}"},
            "sourceRuntimeGlb": {"path": input_path.relative_to(ROOT).as_posix(), "sha256": digest(input_data), "bytes": len(input_data)},
            "provenance": record(provenance_path),
            "runtimeAdoption": "PENDING_INTEGRATOR",
            "ownerArtAcceptance": "OWNER_REVIEW_PENDING",
            "visualRepair": repair,
        })
        output_entries.append(runtime_entry)
        provenance_records.append(provenance)
        print(f"CARGO_SURFACE_V2_BUILT={output_id} bytes={len(output)} vertices={repair['meshCensus']['vertices']} "
              f"indices={repair['meshCensus']['indices']} primitives={repair['meshCensus']['primitives']} "
              f"changedVertices={repair['changedVertexCount']}")

    public_sidecar = {
        "schema": "hestia.factory.play-assets/v1",
        "sourceHead": SOURCE_HEAD,
        "assets": output_entries,
        "palette": PALETTE,
        "authority": "derived Cargo render meshes only; original Native Cargo source and S0 witness remain authoritative",
        "knownGaps": ["runtime adoption and actual rendered owner inspection remain Integrator scope"],
    }
    public_sidecar_path = OUTPUT_PUBLIC / "manifest-cargo-surface-v2.json"
    write_json(public_sidecar_path, public_sidecar)
    authoring_manifest = {
        "schema": "hestia.play-cargo-surface-derivatives/v1",
        "sourceHead": SOURCE_HEAD,
        "sourceManifest": {"path": V1_MANIFEST.relative_to(ROOT).as_posix(), "sha256": digest(manifest_data), "bytes": len(manifest_data)},
        "generator": script_record,
        "assets": provenance_records,
        "publicManifest": record(public_sidecar_path),
        "palette": PALETTE,
        "authority": "Render-only Cargo correction; no source/native/physics/save authority",
    }
    write_json(ART / "manifest.json", authoring_manifest)
    print(f"CARGO_SURFACE_V2_MANIFEST={public_sidecar_path.relative_to(ROOT).as_posix()} bytes={public_sidecar_path.stat().st_size} sha256={digest(public_sidecar_path.read_bytes())}")


if __name__ == "__main__":
    main()
