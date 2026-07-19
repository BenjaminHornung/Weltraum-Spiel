"""Canonical environment references and runtime-only resolution."""

import re
from pathlib import PurePosixPath, PureWindowsPath

from .redaction import contains_secret_material, is_secret_name
from .paths import contains_absolute_path


_ENVIRONMENT_KEY = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def validate_command_argv(argv: list[str]) -> None:
    for token in argv:
        option = token.split("=", 1)[0]
        if option.startswith(("-", "/")) and is_secret_name(option.lstrip("-/")):
            raise ValueError("command_argv contains inline secret material; use a host-env reference")
        if contains_secret_material(token):
            raise ValueError("command_argv contains inline secret material; use a host-env reference")
    for window_size in range(2, min(5, len(argv)) + 1):
        for start in range(len(argv) - window_size + 1):
            if contains_secret_material(" ".join(argv[start:start + window_size])):
                raise ValueError("command_argv contains inline secret material; use a host-env reference")


def validate_environment(environment: dict) -> dict:
    if not isinstance(environment, dict):
        raise ValueError("environment must be an object")
    validated = {}
    for index, (key, entry) in enumerate(environment.items(), start=1):
        if not isinstance(key, str) or not _ENVIRONMENT_KEY.fullmatch(key):
            raise ValueError(f"invalid environment key at entry {index}")
        if isinstance(entry, str):
            if is_secret_name(key):
                raise ValueError(f"secret environment key must use host-env reference: {key}")
            if contains_secret_material(entry):
                raise ValueError(
                    f"literal environment value contains secret material; use host-env reference: {key}"
                )
            if _is_absolute(entry) or contains_absolute_path(entry):
                raise ValueError(f"absolute environment value must use host-env reference: {key}")
            validated[key] = entry
            continue
        if not isinstance(entry, dict) or set(entry) != {"source", "key"}:
            raise ValueError(f"invalid environment entry for {key}")
        source_key = entry.get("key")
        if entry.get("source") != "host-env" or not isinstance(source_key, str) or not _ENVIRONMENT_KEY.fullmatch(source_key):
            raise ValueError(f"invalid host-env reference for {key}")
        validated[key] = {"source": "host-env", "key": source_key}
    return validated


def is_environment_key(value: str) -> bool:
    return isinstance(value, str) and bool(_ENVIRONMENT_KEY.fullmatch(value))


def resolve_environment(environment: dict, host_environment: dict[str, str]) -> dict[str, str]:
    resolved = {}
    for key, entry in validate_environment(environment).items():
        if isinstance(entry, str):
            resolved[key] = entry
            continue
        source_key = entry["key"]
        if source_key not in host_environment:
            raise ValueError(f"host environment variable is unavailable: {source_key}")
        resolved[key] = str(host_environment[source_key])
    return resolved


def _is_absolute(value: str) -> bool:
    return PureWindowsPath(value).is_absolute() or PurePosixPath(value).is_absolute()
