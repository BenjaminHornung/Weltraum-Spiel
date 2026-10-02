"""C3 geometry-only oracles; these do not assert report admission or compilation."""

import copy
import math
import random
import unittest
from unittest.mock import patch

from tools.hestia_asset_compiler.errors import CompilerError
from tools.hestia_asset_compiler.glb import read_glb
from tools.hestia_asset_compiler.geometry import canonicalize_geometry, local_matrix, triangle_key
from tools.hestia_asset_compiler.geometry import world_point
from tools.hestia_asset_compiler.profiles import BUDGETS
from glb_fixtures import box, fixture, glb, part


def cube_document():
    return fixture(*box())


def joined_boxes(first, second, *, reverse_second=False):
    vertices, faces = box(*first)
    more, triangles = box(*second)
    if reverse_second:
        triangles = [(a, c, b) for a, b, c in triangles]
    return fixture(vertices + more, faces + [tuple(i + 8 for i in face) for face in triangles])


class GeometryTests(unittest.TestCase):
    def bake(self, doc, binary):
        return canonicalize_geometry(read_glb(glb(doc, binary)))

    def reject(self, doc, binary, code):
        with self.assertRaises(CompilerError) as error:
            self.bake(doc, binary)
        self.assertEqual(error.exception.code, code)

    def test_G03_G04_negative_and_origin_bounds(self):
        for low, high in [((-3, -2, -1), (-2, -1, 0)), ((-1, -1, -1), (1, 1, 1))]:
            with self.subTest(low=low):
                result = self.bake(*fixture(*box(low, high)))
                self.assertEqual(result.bounds, (low, high))
                self.assertEqual(result.topology[0]["components"], 1)

    def test_G05_quarter_turn_and_column_major_matrix(self):
        doc, binary = cube_document()
        # Exact column-major quarter turn: (x,y,z) -> (-y,x,z).
        doc["nodes"][0]["matrix"] = [0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        result = self.bake(doc, binary)
        self.assertEqual(result.bounds, ((-1, 0, 0), (0, 1, 1)))
        doc["nodes"][0].pop("matrix")
        doc["nodes"][0]["rotation"] = [0, 0, math.sqrt(0.5), math.sqrt(0.5)]
        rotated = self.bake(doc, binary)
        for actual, expected in zip(rotated.bounds[0] + rotated.bounds[1], (-1, 0, 0, 0, 1, 1)):
            self.assertAlmostEqual(actual, expected, places=14)

    def test_G06_TRS_order_and_Float64_translation(self):
        doc, binary = cube_document()
        node = doc["nodes"][0]
        node.update(translation=[10.0000000001, 20, 30], scale=[2, 3, 4])
        result = self.bake(doc, binary)
        self.assertEqual(result.bounds, ((10.0000000001, 20, 30), (12.0000000001, 23, 34)))
        self.assertNotEqual(result.bounds[0][0], 10)

    def test_arbitrary_three_axis_quaternion_TRS(self):
        doc, binary = cube_document()
        doc["nodes"][0].update(rotation=[i / math.sqrt(30) for i in (1, 2, 3, 4)],
                               scale=[2, 3, 4], translation=[5, -6, 7])
        result = self.bake(doc, binary)
        expected = [4/15, 28/15, -2/3, 0, -2, 1, 2, 0, 44/15, 8/15, 8/3, 0, 5, -6, 7, 1]
        for actual, oracle in zip(result.placements[0]["worldMatrix"], expected):
            self.assertAlmostEqual(actual, oracle, places=14)
        self.assertTrue(result.topology[0]["closed"])

    def test_parent_child_shear_retained(self):
        doc, binary = cube_document()
        doc["nodes"].append({"children": [0], "scale": [2, 1, 1], "translation": [3, 0, 0]})
        doc["scenes"][0]["nodes"] = [1]
        doc["nodes"][0]["rotation"] = [0, 0, math.sin(math.pi / 8), math.cos(math.pi / 8)]
        result = self.bake(doc, binary)
        matrix = result.placements[0]["worldMatrix"]
        self.assertAlmostEqual(matrix[0], math.sqrt(2))
        self.assertAlmostEqual(matrix[1], math.sqrt(0.5))
        self.assertAlmostEqual(matrix[4], -math.sqrt(2))
        self.assertAlmostEqual(matrix[5], math.sqrt(0.5))
        self.assertAlmostEqual(sum(matrix[i] * matrix[i + 4] for i in range(3)), -1.5)
        self.assertEqual(matrix[12], 3)

    def test_explicit_shear_and_equivalent_TRS_matrix_hash(self):
        doc, binary = cube_document()
        doc["nodes"][0]["matrix"] = [1, 0, 0, 0, 0.5, 1, 0, 0, 0, 0, 1, 0, -3, 2, 0, 1]
        sheared = self.bake(doc, binary)
        self.assertEqual(sheared.bounds, ((-3, 2, 0), (-1.5, 3, 1)))
        doc["nodes"][0].pop("matrix")
        doc["nodes"][0].update(translation=[-3, 2, 0], scale=[2, 3, 4])
        trs = self.bake(doc, binary)
        doc["nodes"][0].pop("translation")
        doc["nodes"][0].pop("scale")
        doc["nodes"][0]["matrix"] = [2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 4, 0, -3, 2, 0, 1]
        matrix = self.bake(doc, binary)
        self.assertEqual(trs.normalized_geometry_sha256, matrix.normalized_geometry_sha256)
        self.assertEqual(trs.semantics_sha256, matrix.semantics_sha256)

    def test_G07_one_and_two_mirrors(self):
        doc, binary = cube_document()
        original = self.bake(doc, binary)
        doc["nodes"][0]["scale"] = [-1, 1, 1]
        mirrored = self.bake(doc, binary)
        expected = sorted(triangle_key("part.a", "render.a", ((-a[0], a[1], a[2]), (-c[0], c[1], c[2]), (-b[0], b[1], b[2])))
                          for a, b, c in (t.vertices for t in original.triangles))
        self.assertEqual([t.key for t in mirrored.triangles], expected)
        doc["nodes"].append({"children": [0], "scale": [-1, 1, 1]})
        doc["scenes"][0]["nodes"] = [1]
        twice = self.bake(doc, binary)
        self.assertEqual(twice.normalized_geometry_sha256, original.normalized_geometry_sha256)
        self.assertEqual(twice.semantics_sha256, original.semantics_sha256)

    def test_G08_reused_mesh_instances_and_G17_part_parent(self):
        doc, binary = cube_document()
        second = {"mesh": 0, "translation": [3, 0, 0], "extras": {"hestia": part("part.b")}}
        second["extras"]["hestia"]["parentPartId"] = "part.a"
        doc["nodes"].append(second)
        doc["scenes"][0]["nodes"].append(1)
        result = self.bake(doc, binary)
        self.assertEqual(len(result.triangles), 24)
        self.assertEqual(result.bounds, ((0, 0, 0), (4, 1, 1)))
        self.assertEqual([item["partId"] for item in result.topology], ["part.a", "part.b"])
        self.assertEqual(result.placements[1]["worldMatrix"][12], 3)
        self.assertEqual(result.semantics["parts"][1]["parentPartId"], "part.a")

    def test_unused_accessor_rows_not_instance_expanded(self):
        vertices, faces = box()
        doc, binary = fixture(vertices + [(0, 0, 0)] * 992, faces)
        doc["nodes"].append({"mesh": 0, "translation": [3, 0, 0], "extras": {"hestia": part("part.b")}})
        doc["scenes"][0]["nodes"].append(1)
        with patch("tools.hestia_asset_compiler.geometry.world_point", wraps=world_point) as expansion:
            result = self.bake(doc, binary)
        self.assertEqual(len(result.triangles), 24)
        self.assertEqual(expansion.call_count, 18)  # 2 origins + 2*8 used positions, not 2*1000 rows.

    def joint_marker_document(self):
        doc, binary = cube_document()
        doc["nodes"].append({"extras": {"hestia": part("part.b", "StructuralAssembly")}})
        doc["nodes"].append({"translation": [1, 2, 3], "extras": {"hestia": {
            "kind": "joint", "jointId": "joint.a", "parentPartId": "part.a", "childPartId": "part.b",
            "jointType": "Fixed", "breakPolicy": "Never"}}})
        doc["nodes"].append({"translation": [-1, 0, 2], "extras": {"hestia": {
            "kind": "marker", "markerId": "marker.cut", "markerType": "CutInterface",
            "interfaceId": "interface.a", "partId": "part.a"}}})
        doc["nodes"].append({"children": [2, 3], "translation": [10, 0, 0]})
        doc["scenes"][0]["nodes"] = [0, 1, 4]
        return doc, binary

    def test_G18_G19_joint_marker_world_placements(self):
        result = self.bake(*self.joint_marker_document())
        by_id = {entry["id"]: entry for entry in result.placements}
        self.assertEqual(by_id["joint.a"]["worldMatrix"][12:15], [11, 2, 3])
        self.assertEqual(by_id["marker.cut"]["worldMatrix"][12:15], [9, 0, 2])
        self.assertEqual(result.semantics["markers"][0]["interfaceId"], "interface.a")

    def test_invalid_joint_marker_and_ancestor_transforms(self):
        for index, transform in [(2, {"scale": [1, 0, 1]}), (3, {"translation": [float("inf"), 0, 0]}),
                                 (4, {"scale": [0, 1, 1]}), (4, {"rotation": [0, 0, 0, 2]})]:
            with self.subTest(index=index, transform=transform):
                doc, binary = self.joint_marker_document()
                doc["nodes"][index].update(transform)
                # Nonfinite JSON is rejected even earlier by C2.
                self.reject(doc, binary, "json.number" if index == 3 else "geometry.transform")

    def test_nonfinite_composed_matrix_and_baked_point(self):
        doc, binary = cube_document()
        doc["nodes"][0]["scale"] = [1e308, 1, 1]
        doc["nodes"].append({"children": [0], "scale": [1e308, 1, 1]})
        doc["scenes"][0]["nodes"] = [1]
        self.reject(doc, binary, "geometry.transform")
        doc, binary = fixture(*box((0, 0, 0), (2, 1, 1)))
        doc["nodes"][0]["scale"] = [1e308, 1, 1]
        self.reject(doc, binary, "geometry.nonfinite")

    def test_matrix_TRS_affine_finite_and_singular_rejections(self):
        cases = [{"matrix": [1] * 15}, {"scale": [True, 1, 1]}, {"rotation": [0, 0, 0, 0]},
                 {"matrix": [1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]},
                 {"matrix": [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]},
                 {"matrix": [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], "scale": [1, 1, 1]}]
        for transform in cases:
            with self.subTest(transform=transform):
                doc, binary = cube_document()
                doc["nodes"][0].update(transform)
                self.reject(doc, binary, "geometry.transform")
        with self.assertRaises(CompilerError):
            local_matrix({"translation": [float("nan"), 0, 0]})

    def test_G20_open_solid_not_report_counts(self):
        doc, binary = fixture()
        self.reject(doc, binary, "geometry.open-solid")
        doc["nodes"][0]["extras"]["hestia"].update(representation="Shell", shell={
            "thicknessMeters": 0.01, "layers": [{"structuralMaterialId": "steel.a", "thicknessMeters": 0.01}]})
        result = self.bake(doc, binary)
        self.assertEqual(len(result.triangles), 1)
        self.assertFalse(result.topology[0]["closed"])

    def test_G21_nonmanifold_edge_and_vertex_fans(self):
        vertices, faces = box()
        # A distinct third triangle on an existing edge, not a duplicate face.
        vertices.append((0.5, -1, 0))
        self.reject(*fixture(vertices, faces + [(0, 1, 8)]), "geometry.nonmanifold")
        self.reject(*joined_boxes(((-1, -1, -1), (0, 0, 0)), ((0, 0, 0), (1, 1, 1))), "geometry.vertex-fan")

    def test_G22_degenerate_and_duplicate_geometry(self):
        self.reject(*fixture([(0, 0, 0), (1, 0, 0), (2, 0, 0)]), "geometry.degenerate")
        vertices, faces = box()
        for duplicate in [faces[0], tuple(reversed(faces[0]))]:
            with self.subTest(face=duplicate):
                self.reject(*fixture(vertices, faces + [duplicate]), "geometry.duplicate")

    def test_duplicate_faces_across_materials(self):
        doc, binary = cube_document()
        doc["materials"].append({"extras": {"hestia": {"renderMaterialId": "render.b", "structuralMaterialId": "steel.b"}}})
        second = copy.deepcopy(doc["meshes"][0]["primitives"][0])
        second["material"] = 1
        doc["meshes"][0]["primitives"].append(second)
        self.reject(doc, binary, "geometry.duplicate")

    def test_opposite_edge_orientation_required(self):
        vertices, faces = box()
        a, b, c = faces[0]
        faces[0] = (a, c, b)
        self.reject(*fixture(vertices, faces), "geometry.orientation")

    def test_exact_position_join_across_primitive_material_seams(self):
        vertices, faces = box()
        # Separate per-face vertex records, as exported at normal/material seams.
        split_vertices = [vertices[i] for face in faces for i in face]
        split_faces = [tuple(range(i, i + 3)) for i in range(0, 36, 3)]
        doc, binary = fixture(split_vertices, split_faces)
        doc["materials"].append({"extras": {"hestia": {"renderMaterialId": "render.b", "structuralMaterialId": "steel.b"}}})
        doc["accessors"][1]["count"] = 18
        doc["accessors"].append(dict(doc["accessors"][1], byteOffset=36))
        doc["meshes"][0]["primitives"].append({"attributes": {"POSITION": 0}, "indices": 2, "material": 1})
        result = self.bake(doc, binary)
        self.assertEqual(result.topology[0]["vertices"], 8)
        self.assertEqual(result.topology[0]["faces"], 12)
        self.assertEqual({t.material_id for t in result.triangles}, {"render.a", "render.b"})
        doc["meshes"][0]["primitives"].reverse()
        doc["materials"].reverse()
        for primitive in doc["meshes"][0]["primitives"]:
            primitive["material"] = 1 - primitive["material"]
        reordered = self.bake(doc, binary)
        self.assertEqual(result.normalized_geometry_sha256, reordered.normalized_geometry_sha256)
        self.assertEqual(result.semantics_sha256, reordered.semantics_sha256)

    def test_intersecting_and_touching_components_rejected(self):
        for second in [((0.5, 0.5, 0.5), (1.5, 1.5, 1.5)), ((1, 0.25, 0.25), (2, 0.75, 0.75)),
                       ((1, 0.5, 0.5), (2, 1.5, 1.5))]:
            with self.subTest(second=second):
                self.reject(*joined_boxes(((0, 0, 0), (1, 1, 1)), second), "geometry.intersection")

    def test_disconnected_and_nested_cavity_components_accepted(self):
        disconnected = self.bake(*joined_boxes(((0, 0, 0), (1, 1, 1)), ((2, 0, 0), (3, 1, 1))))
        self.assertEqual(disconnected.topology[0]["components"], 2)
        hollow = self.bake(*joined_boxes(((0, 0, 0), (2, 2, 2)), ((0.5, 0.5, 0.5), (1.5, 1.5, 1.5)), reverse_second=True))
        self.assertEqual(hollow.topology[0]["components"], 2)
        # Independent signed-volume oracle: inner winding must not be forced outward.
        volume = sum(a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2])
                     + a[2] * (b[0] * c[1] - b[1] * c[0]) for a, b, c in (t.vertices for t in hollow.triangles)) / 6
        self.assertEqual(volume, 7)

    def test_coplanar_overlap_and_no_epsilon_weld(self):
        doc, binary = fixture([(0, 0, 0), (2, 0, 0), (0, 2, 0), (0.5, 0.5, 0), (1.5, 0.5, 0), (0.5, 1.5, 0)],
                              [(0, 1, 2), (3, 4, 5)])
        doc["nodes"][0]["extras"]["hestia"].update(representation="Shell", shell={
            "thicknessMeters": 0.01, "layers": [{"structuralMaterialId": "steel.a", "thicknessMeters": 0.01}]})
        self.reject(doc, binary, "geometry.intersection")
        vertices, faces = box()
        vertices.append((2**-30, 0, 0))
        faces[0] = (8, 2, 1)
        self.reject(*fixture(vertices, faces), "geometry.open-solid")

    def test_non_coplanar_self_intersection_and_valid_shared_edge(self):
        doc, binary = fixture([(-1, -1, 0), (1, -1, 0), (0, 1, 0), (0, 0, -1), (0, 0, 1), (0, 2, 0)],
                              [(0, 1, 2), (3, 4, 5)])
        doc["nodes"][0]["extras"]["hestia"].update(representation="Shell", shell={
            "thicknessMeters": 0.01, "layers": [{"structuralMaterialId": "steel.a", "thicknessMeters": 0.01}]})
        self.reject(doc, binary, "geometry.intersection")
        doc, binary = fixture([(0, 0, 0), (1, 0, 0), (0, 1, 0), (0, -1, 1)], [(0, 1, 2), (1, 0, 3)])
        doc["nodes"][0]["extras"]["hestia"].update(representation="Shell", shell={
            "thicknessMeters": 0.01, "layers": [{"structuralMaterialId": "steel.a", "thicknessMeters": 0.01}]})
        self.assertEqual(len(self.bake(doc, binary).triangles), 2)
        doc, binary = fixture([(0, 0, 0), (1, 0, 0), (0, 2, 0), (0.125, 0.125, 0)], [(0, 1, 2), (1, 0, 3)])
        doc["nodes"][0]["extras"]["hestia"].update(representation="Shell", shell={
            "thicknessMeters": 0.01, "layers": [{"structuralMaterialId": "steel.a", "thicknessMeters": 0.01}]})
        self.reject(doc, binary, "geometry.intersection")

    def test_G28_list_permutation_cyclic_keys_not_reversal(self):
        vertices, faces = box()
        original = self.bake(*fixture(vertices, faces))
        orders = [list(reversed(faces)), faces.copy()]
        random.Random(20261002).shuffle(orders[1])
        orders.append([(b, c, a) for a, b, c in faces])
        for order in orders:
            with self.subTest(order=order):
                result = self.bake(*fixture(vertices, order))
                self.assertEqual(original.triangles, result.triangles)
                self.assertEqual(original.normalized_geometry_sha256, result.normalized_geometry_sha256)
        a, b, c = ((0, 0, 0), (1, 0, 0), (0, 1, 0))
        self.assertEqual(triangle_key("part.a", "render.a", (a, b, c)), triangle_key("part.a", "render.a", (b, c, a)))
        self.assertNotEqual(triangle_key("part.a", "render.a", (a, b, c)), triangle_key("part.a", "render.a", (a, c, b)))

    def test_G29_node_reordering_and_truthful_source_hash(self):
        doc, binary = self.joint_marker_document()
        first_source = read_glb(glb(doc, binary))
        first = canonicalize_geometry(first_source)
        count = len(doc["nodes"])
        doc["nodes"].reverse()
        doc["scenes"][0]["nodes"] = [count - 1 - i for i in doc["scenes"][0]["nodes"]]
        for node in doc["nodes"]:
            if "children" in node:
                node["children"] = [count - 1 - i for i in reversed(node["children"])]
        second_source = read_glb(glb(doc, binary))
        second = canonicalize_geometry(second_source)
        self.assertNotEqual(first_source.source_sha256, second_source.source_sha256)
        self.assertEqual(first.normalized_geometry_sha256, second.normalized_geometry_sha256)
        self.assertEqual(first.semantics_sha256, second.semantics_sha256)
        self.assertEqual(first.placements, second.placements)

    def test_G30_world_and_topology_work_limits_before_expansion(self):
        doc, binary = cube_document()
        doc["nodes"][0]["translation"] = [BUDGETS["world_coordinate"], 0, 0]
        self.reject(doc, binary, "budget.world_coordinate")
        # 2001 faces exceed the frozen all-pairs ceiling; no exact predicate or topology map allocated.
        doc, binary = fixture(faces=[(0, 1, 2)] * 2001)
        with patch("tools.hestia_asset_compiler.geometry.validate_topology") as topology, \
                patch("tools.hestia_asset_compiler.geometry.world_point") as expansion:
            self.reject(doc, binary, "budget.topology_pairs")
            topology.assert_not_called()
            expansion.assert_not_called()

    def test_empty_solid_rejected_assembly_retained(self):
        doc, binary = cube_document()
        doc["nodes"][0].pop("mesh")
        self.reject(doc, binary, "geometry.empty-solid")
        doc["nodes"][0]["extras"]["hestia"]["representation"] = "StructuralAssembly"
        result = self.bake(doc, binary)
        self.assertIsNone(result.bounds)
        self.assertFalse(result.triangles)
        self.assertEqual(len(result.placements), 1)


if __name__ == "__main__":
    unittest.main()
