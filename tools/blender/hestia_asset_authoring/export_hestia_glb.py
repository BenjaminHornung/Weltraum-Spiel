"""Blender CLI entrypoint for the Hestia asset-authoring handoff."""

from __future__ import annotations

import argparse
import hashlib
import importlib
import json
import os
from pathlib import Path
import struct
import sys
import tempfile
from typing import Any, Mapping, Sequence


def _script_arguments(argv: Sequence[str]) -> list[str]:
    """Return only arguments following Blender's ``--`` separator."""

    try:
        separator = argv.index("--")
    except ValueError:
        return []
    return list(argv[separator + 1 :])


def _argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="export_hestia_glb.py")
    parser.add_argument("--output", required=True, type=Path, help="destination GLB path")
    parser.add_argument("--collection", help="named Blender collection to export")
    parser.add_argument(
        "--unapplied-scale",
        choices=("ignore", "warning", "error"),
        default="warning",
        help="policy for non-unit authored scale (default: warning)",
    )
    return parser


def _ensure_package_parent() -> None:
    """Make the package importable when Blender executes this file directly."""

    package_directory = Path(__file__).resolve().parent
    package_name = package_directory.name
    for candidate in (package_directory.parent, *package_directory.parents):
        if (candidate / package_name / "__init__.py").is_file():
            candidate_text = os.fspath(candidate)
            if candidate_text not in sys.path:
                sys.path.insert(0, candidate_text)
            return
    raise ImportError(f"could not locate package parent for {package_name}")


def _load_contract_modules() -> tuple[Any, Any, Any, Any, Any]:
    _ensure_package_parent()
    package = Path(__file__).resolve().parent.name
    adapter = importlib.import_module(f"{package}.blender_adapter")
    model = importlib.import_module(f"{package}.model")
    validation = importlib.import_module(f"{package}.validation")
    report = importlib.import_module(f"{package}.report")
    canonical = importlib.import_module(f"{package}.canonical")
    return adapter, model, validation, report, canonical


class OutputPathError(ValueError):
    """Raised when the requested output is not a safe GLB target."""


def _normalized_path(path: Path | str) -> str:
    return os.path.normcase(os.path.realpath(os.path.abspath(os.path.expanduser(os.fspath(path)))))


def _validate_output_suffix(output: Path) -> None:
    if output.suffix.lower() != ".glb":
        raise OutputPathError("output path must use the .glb extension")


def _validate_output_source(output: Path, blender: Any) -> None:
    data = getattr(blender, "data", None)
    source = getattr(data, "filepath", "") if data is not None else ""
    if isinstance(source, str) and source and _normalized_path(output) == _normalized_path(source):
        raise OutputPathError("output path must not resolve to the loaded Blender source file")


def _sidecar_path(output: Path) -> Path:
    return output.with_name(f"{output.stem}.hestia-authoring-report.json")


def _remove_sidecar(path: Path) -> None:
    try:
        path.unlink()
    except FileNotFoundError:
        return


def _write_atomic(path: Path, data: bytes) -> None:
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="wb",
            dir=os.fspath(path.parent),
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as stream:
            temporary_path = Path(stream.name)
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(os.fspath(temporary_path), os.fspath(path))
        temporary_path = None
    finally:
        if temporary_path is not None:
            try:
                temporary_path.unlink()
            except FileNotFoundError:
                pass


def _canonical_sidecar_bytes(canonical: Any, report: Any) -> bytes:
    """Serialize the sidecar as compact UTF-8 JSON with LF line endings."""

    data = canonical.canonical_json_bytes(report)
    return data.replace(b"\r\n", b"\n").replace(b"\r", b"\n")


_GLB_MAGIC = b"glTF"
_GLB_VERSION = 2
_JSON_CHUNK = 0x4E4F534A
_RENDER_MATERIAL_ID_PROPERTY = "hestia.render_material_id"
_ASSET_EXTRA_FIELDS = (
    "schema",
    "assetId",
    "assetRevision",
    "representation",
    "metersPerUnit",
    "coordinateFrame",
    "defaultStructuralMaterialId",
    "tags",
)


def _asset_extras(canonical_asset: Any) -> dict[str, Any]:
    """Project the complete canonical document to the GLB asset payload."""

    document = canonical_asset.to_contract_dict()
    asset = document.get("asset")
    if not isinstance(asset, Mapping):
        raise ValueError("canonical asset document has no asset mapping")
    values = {"schema": document.get("schema"), **asset}
    missing = [name for name in _ASSET_EXTRA_FIELDS[:6] if name not in values]
    if missing:
        raise ValueError(f"canonical asset extras are missing {missing[0]}")
    return {name: values[name] for name in _ASSET_EXTRA_FIELDS if name in values}


def _postprocess_glb(data: bytes, canonical_asset: Any) -> bytes:
    """Validate a GLB v2 and install the canonical top-level asset extras."""

    if len(data) < 12:
        raise ValueError("GLB header is truncated")
    magic, version, declared_length = struct.unpack_from("<4sII", data)
    if magic != _GLB_MAGIC or version != _GLB_VERSION:
        raise ValueError("GLB must have the glTF magic and version 2")
    if declared_length != len(data):
        raise ValueError("GLB header length does not match the file length")

    chunks: list[tuple[int, bytes]] = []
    offset = 12
    while offset < len(data):
        if len(data) - offset < 8:
            raise ValueError("GLB chunk header is truncated")
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        if chunk_length % 4:
            raise ValueError("GLB chunk length is not 4-byte aligned")
        end = offset + chunk_length
        if end > len(data):
            raise ValueError("GLB chunk exceeds the declared file length")
        chunks.append((chunk_type, data[offset:end]))
        offset = end
    if not chunks or chunks[0][0] != _JSON_CHUNK:
        raise ValueError("GLB first chunk must be JSON")
    if sum(chunk_type == _JSON_CHUNK for chunk_type, _ in chunks) != 1:
        raise ValueError("GLB must contain exactly one JSON chunk")

    json_chunk = chunks[0][1]
    unpadded_json = json_chunk.rstrip(b" ")
    try:
        document = json.loads(unpadded_json.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("GLB JSON chunk is not valid UTF-8 JSON") from exc
    if not isinstance(document, dict):
        raise ValueError("GLB JSON document must be an object")
    asset = document.get("asset")
    if not isinstance(asset, dict):
        raise ValueError("GLB JSON document must contain an asset object")
    extras = asset.get("extras", {})
    if not isinstance(extras, dict):
        raise ValueError("GLB asset extras must be an object when present")

    canonical_document = canonical_asset.to_contract_dict()
    canonical_extras = _asset_extras(canonical_asset)
    transport_document = json.loads(json.dumps(canonical_document, ensure_ascii=False))
    transport_extras = json.loads(json.dumps(canonical_extras, ensure_ascii=False))
    updated_extras = dict(extras)
    updated_extras["hestia"] = canonical_extras
    asset["extras"] = updated_extras

    scenes = document.get("scenes", ())
    if isinstance(scenes, list):
        for scene in scenes:
            if not isinstance(scene, dict) or not isinstance(scene.get("extras"), dict):
                continue
            scene_extras = scene["extras"]
            if scene_extras.get("hestia") in (transport_document, transport_extras):
                del scene_extras["hestia"]
                if not scene_extras:
                    del scene["extras"]

    encoded = json.dumps(
        document,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    encoded += b" " * (-len(encoded) % 4)
    chunks[0] = (_JSON_CHUNK, encoded)
    body = b"".join(struct.pack("<II", len(chunk), chunk_type) + chunk for chunk_type, chunk in chunks)
    return struct.pack("<4sII", _GLB_MAGIC, _GLB_VERSION, 12 + len(body)) + body


def _temporary_glb_path(output: Path) -> Path:
    with tempfile.NamedTemporaryFile(
        dir=os.fspath(output.parent),
        prefix=f".{output.name}.",
        suffix=".tmp.glb",
        delete=False,
    ) as stream:
        return Path(stream.name)


def _restore_artifact(path: Path, previous: bytes | None) -> None:
    if previous is None:
        _remove_sidecar(path)
    else:
        _write_atomic(path, previous)


def _replace_handoff(
    output: Path,
    glb_bytes: bytes,
    sidecar: Path,
    sidecar_bytes: bytes,
) -> None:
    """Replace both artifacts, restoring their prior bytes if either replace fails."""

    previous_output = output.read_bytes() if output.is_file() else None
    previous_sidecar = sidecar.read_bytes() if sidecar.is_file() else None
    try:
        _write_atomic(output, glb_bytes)
        _write_atomic(sidecar, sidecar_bytes)
    except Exception:
        restore_failures: list[Exception] = []
        for path, previous in ((output, previous_output), (sidecar, previous_sidecar)):
            try:
                _restore_artifact(path, previous)
            except Exception as exc:
                restore_failures.append(exc)
        if restore_failures:
            raise RuntimeError("handoff replacement failed and prior artifacts could not be restored") from restore_failures[0]
        raise


def _diagnostic_line(diagnostic: Any) -> str:
    location = f" {diagnostic.path}" if diagnostic.path else ""
    return f"{diagnostic.severity.value.upper()} {diagnostic.code}{location}: {diagnostic.message}"


def _print_diagnostics(diagnostics: Sequence[Any]) -> None:
    for diagnostic in sorted(diagnostics, key=lambda item: item.sort_key):
        print(_diagnostic_line(diagnostic))


def _print_error(code: str, message: str) -> None:
    print(f"ERROR {code}: {message}", file=sys.stderr)


def _export_result_failed(result: Any) -> bool:
    if isinstance(result, (set, frozenset)):
        return "FINISHED" not in result
    return False


def _attach_canonical_extras(
    adapter: Any,
    source: Any,
    scene: Any,
    collection: Any | None,
    authoring_input: Any,
) -> None:
    """Attach only the canonical nested extras that the GLB transport permits."""

    canonical_asset = authoring_input.asset
    adapter.attach_hestia_extras(source, _asset_extras(canonical_asset))

    objects = (
        adapter.iter_collection_objects(collection)
        if collection is not None
        else adapter.iter_scene_objects(scene)
    )
    parts = {item.part_id: item for item in canonical_asset.parts}
    joints = {item.joint_id: item for item in canonical_asset.joints}
    markers = {item.marker_id: item for item in canonical_asset.markers}
    materials = {item.render_material_id: item for item in canonical_asset.materials}

    for obj in objects:
        properties = adapter.extract_properties(obj)
        if "hestia.part_id" in properties:
            part = parts.get(properties["hestia.part_id"])
            if part is not None:
                adapter.attach_hestia_extras(obj, part.to_contract_dict(), kind="part")
        if "hestia.joint_id" in properties:
            joint = joints.get(properties["hestia.joint_id"])
            if joint is not None:
                adapter.attach_hestia_extras(obj, joint.to_contract_dict(), kind="joint")
        if "hestia.marker_id" in properties:
            marker = markers.get(properties["hestia.marker_id"])
            if marker is not None:
                adapter.attach_hestia_extras(obj, marker.to_contract_dict(), kind="marker")

        for slot in getattr(obj, "material_slots", ()):
            material = getattr(slot, "material", None)
            if material is None:
                continue
            getter = getattr(material, "get", None)
            material_id = getter(_RENDER_MATERIAL_ID_PROPERTY) if callable(getter) else None
            canonical_material = materials.get(material_id)
            if canonical_material is not None:
                adapter.attach_hestia_extras(material, canonical_material.to_contract_dict())


def _temporary_property_blocks(adapter: Any, source: Any, scene: Any, collection: Any | None) -> tuple[Any, ...]:
    """Return every data block on which this CLI may attach temporary extras."""

    objects = (
        adapter.iter_collection_objects(collection)
        if collection is not None
        else adapter.iter_scene_objects(scene)
    )
    blocks: list[Any] = [source]
    for obj in objects:
        blocks.append(obj)
        for slot in getattr(obj, "material_slots", ()):
            material = getattr(slot, "material", None)
            if material is not None:
                blocks.append(material)
    unique: list[Any] = []
    seen: set[int] = set()
    for block in blocks:
        if id(block) not in seen:
            seen.add(id(block))
            unique.append(block)
    return tuple(unique)


def main(argv: Sequence[str] | None = None) -> int:
    """Validate and export the Blender scene according to the handoff contract."""

    raw_argv = sys.argv if argv is None else argv
    parser = _argument_parser()
    try:
        arguments = parser.parse_args(_script_arguments(raw_argv))
    except SystemExit as exc:
        return 0 if exc.code is None else int(exc.code)

    output = arguments.output
    try:
        _validate_output_suffix(output)
    except OutputPathError as exc:
        _print_error("output.invalid", str(exc))
        return 1
    sidecar = _sidecar_path(output)
    try:
        adapter, model, validation, report, canonical = _load_contract_modules()
        blender = adapter.require_blender()
        _validate_output_source(output, blender)
        scene = blender.context.scene
        collection = (
            adapter.find_named_collection(arguments.collection, scene)
            if arguments.collection is not None
            else None
        )
        asset_source = collection if collection is not None else scene
        if collection is not None and not adapter.iter_collection_objects(collection):
            raise adapter.HestiaContractError(
                f"named collection contains no exportable objects: {arguments.collection!r}"
            )
        asset = adapter.extract_asset(asset_source, collection=collection, scene=scene)
        options = model.ValidationOptions(
            unapplied_scale_policy=model.UnappliedScalePolicy(arguments.unapplied_scale)
        )
        diagnostics = validation.validate_asset(asset, options)
    except Exception as exc:
        _print_error("adapter.failed", f"could not normalize or validate the Blender asset: {exc}")
        return 1

    _print_diagnostics(diagnostics)
    if any(item.severity == model.DiagnosticSeverity.ERROR for item in diagnostics):
        try:
            validation_report = report.build_report(
                asset,
                diagnostics=diagnostics,
                glb_sha256=None,
                options=options,
                output_basename=output.name,
            )
            _write_atomic(sidecar, _canonical_sidecar_bytes(canonical, validation_report))
        except Exception as exc:
            _print_error("validation.failed", f"could not write validation report: {exc}")
        return 1

    temporary_glb: Path | None = None
    try:
        temporary_glb = _temporary_glb_path(output)
        property_blocks = _temporary_property_blocks(adapter, asset_source, scene, collection)
        snapshots = adapter.snapshot_hestia_properties(property_blocks)
        raw_snapshots = adapter.snapshot_hestia_properties(property_blocks, include_root=False)
        try:
            _attach_canonical_extras(adapter, asset_source, scene, collection, asset)
            adapter.clear_hestia_properties(raw_snapshots, include_root=False)
            export_result = adapter.export_glb(
                temporary_glb,
                collection=collection,
            )
        finally:
            adapter.restore_hestia_properties(snapshots)
        if _export_result_failed(export_result):
            result_text = ",".join(sorted(str(item) for item in export_result))
            raise RuntimeError(f"Blender GLB export returned {result_text}")
        if not temporary_glb.is_file():
            raise RuntimeError("Blender GLB export did not create the requested output file")
        glb_bytes = _postprocess_glb(temporary_glb.read_bytes(), asset.asset)
        glb_sha256 = hashlib.sha256(glb_bytes).hexdigest()
        handoff_report = report.build_report(
            asset,
            diagnostics=diagnostics,
            glb_sha256=glb_sha256,
            options=options,
            output_basename=output.name,
        )
        _replace_handoff(
            output,
            glb_bytes,
            sidecar,
            _canonical_sidecar_bytes(canonical, handoff_report),
        )
    except Exception as exc:
        _print_error("export.failed", str(exc))
        return 1
    finally:
        if temporary_glb is not None:
            try:
                temporary_glb.unlink()
            except FileNotFoundError:
                pass

    print(f"Exported GLB and report for {asset.asset.asset_id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
