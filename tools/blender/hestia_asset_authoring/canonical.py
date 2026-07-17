"""Deterministic JSON and hashing primitives for Hestia handoff artifacts."""

from __future__ import annotations

import dataclasses
import hashlib
import json
import math
from collections.abc import Mapping, Sequence, Set
from enum import Enum
from os import PathLike
from pathlib import Path
from typing import Any


# These fields describe collections whose order is not part of the handoff
# meaning.  Vectors and other ordinary sequences retain their authored order.
_SEMANTIC_COLLECTION_FIELDS = frozenset(
    {
        "child_node_ids",
        "joints",
        "marker_ids",
        "markers",
        "material_ids",
        "materials",
        "meshes",
        "nodes",
        "primitive_ids",
        "primitives",
        "parts",
        "tags",
    }
)

_STABLE_ID_KEYS = (
    "assetId",
    "partId",
    "jointId",
    "markerId",
    "renderMaterialId",
    "materialId",
    "meshId",
    "primitiveId",
)


def _canonical_sort_key(value: Any) -> bytes:
    return canonical_json_bytes(value)


def _canonical_mapping_key(key: object) -> str:
    if not isinstance(key, str):
        raise TypeError("canonical JSON mappings must use string keys")
    return key


def _canonicalize(value: object, *, field_name: str | None = None) -> Any:
    if isinstance(value, Enum):
        return _canonicalize(value.value, field_name=field_name)

    to_contract_dict = getattr(value, "to_contract_dict", None)
    if callable(to_contract_dict):
        return _canonicalize(to_contract_dict(), field_name=field_name)

    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        return {
            item.name: _canonicalize(getattr(value, item.name), field_name=item.name)
            for item in dataclasses.fields(value)
        }

    if isinstance(value, Mapping):
        result: dict[str, Any] = {}
        for key, item in value.items():
            canonical_key = _canonical_mapping_key(key)
            if canonical_key in result:
                raise ValueError(f"duplicate canonical JSON mapping key: {canonical_key!r}")
            result[canonical_key] = _canonicalize(item, field_name=canonical_key)
        return result

    if isinstance(value, (set, frozenset)) or isinstance(value, Set):
        return sorted(
            (_canonicalize(item) for item in value),
            key=_canonical_sort_key,
        )

    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        items = [_canonicalize(item) for item in value]
        if field_name in _SEMANTIC_COLLECTION_FIELDS:
            def stable_key(item: Any) -> bytes:
                if isinstance(item, Mapping):
                    for key in _STABLE_ID_KEYS:
                        if key in item:
                            return str(item[key]).encode("utf-8")
                return _canonical_sort_key(item)

            items.sort(key=stable_key)
        return items

    if isinstance(value, bool) or value is None or isinstance(value, str):
        return value

    if isinstance(value, int):
        return value

    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError("canonical JSON does not allow non-finite numbers")
        return 0 if value == 0.0 else value

    raise TypeError(f"value of type {type(value).__name__} is not canonical JSON data")


def canonicalize(value: object) -> Any:
    """Return a JSON-compatible deterministic representation of *value*.

    Dataclasses and enums are expanded recursively.  Mapping keys are required
    to be strings, authored-order sequences remain ordered unless their field
    is a semantic collection, and set-like collections are sorted by their
    canonical representation.
    """

    return _canonicalize(value)


def canonical_json(value: object) -> str:
    """Serialize *value* as compact, sorted-key, deterministic JSON text."""

    return json.dumps(
        canonicalize(value),
        ensure_ascii=False,
        allow_nan=False,
        sort_keys=True,
        separators=(",", ":"),
    )


def canonical_json_bytes(value: object) -> bytes:
    """Serialize *value* as UTF-8 canonical JSON bytes."""

    return canonical_json(value).encode("utf-8")


def sha256_bytes(value: bytes | bytearray | memoryview) -> str:
    """Return the lowercase hexadecimal SHA-256 digest of byte data."""

    if not isinstance(value, (bytes, bytearray, memoryview)):
        raise TypeError("sha256_bytes requires bytes-like data")
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: str | PathLike[str]) -> str:
    """Return the lowercase hexadecimal SHA-256 digest of a file's bytes."""

    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


__all__ = [
    "canonical_json",
    "canonical_json_bytes",
    "canonicalize",
    "sha256_bytes",
    "sha256_file",
]
