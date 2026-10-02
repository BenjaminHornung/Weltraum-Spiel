"""Research-only resolutions and pre-allocation limits, frozen at C2."""

from types import MappingProxyType

from .errors import CompilerError

BUDGET_VERSION = "spike-budgets-v1"
PROFILES = MappingProxyType({"micro-0125-research-v1": 0.125, "standard-025-v1": 0.25})
BUDGETS = MappingProxyType({
    "glb_bytes": 32 * 1024 * 1024,
    "report_bytes": 4 * 1024 * 1024,
    "json_bytes": 4 * 1024 * 1024,
    "json_depth": 64,
    "json_tokens": 250000,
    "nodes": 2048,
    "edges": 2047,
    "graph_depth": 64,
    "meshes": 1024,
    "primitives": 4096,
    "materials": 1024,
    "accessors": 4096,
    "buffer_views": 4096,
    "accessor_elements": 262144,
    "decoded_bytes": 32 * 1024 * 1024,
    "instance_triangles": 20000,
    "world_coordinate": 1000000,
    "grid_coordinate": 8000000,
    "grid_cells": 2000000,
    "flood_cells": 2000000,
    "candidate_work": 10000000,
    "topology_pairs": 2000000,
    "bricks": 8192,
    "output_bytes": 64 * 1024 * 1024,
})


def check_budget(name, value):
    if type(value) is not int or value < 0 or value > BUDGETS[name]:
        raise CompilerError("budget." + name, "pre-allocation limit exceeded or invalid count")
    return value


def check_grid(minimum, maximum):
    """Guard inclusive, already-padded integer bounds; no cells are allocated."""
    if len(minimum) != 3 or len(maximum) != 3:
        raise CompilerError("grid.bounds", "three axes required")
    cells = bricks = 1
    for lo, hi in zip(minimum, maximum):
        if type(lo) is not int or type(hi) is not int or lo > hi:
            raise CompilerError("grid.bounds", "invalid integer interval")
        check_budget("grid_coordinate", max(abs(lo), abs(hi)))
        cells *= hi - lo + 1
        bricks *= hi // 16 - lo // 16 + 1
    check_budget("grid_cells", cells)
    check_budget("flood_cells", cells)
    check_budget("bricks", bricks)
    check_budget("output_bytes", bricks * 4096)
    return cells
