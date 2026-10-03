"""Actual section witnesses and reconstructable replacements, not metadata/AABBs."""

import math
import unittest
from unittest.mock import patch

from tools.hestia_asset_compiler.errors import CompilerError
from tools.hestia_asset_compiler.geometry import canonicalize_geometry
from tools.hestia_asset_compiler.glb import read_glb
from tools.hestia_asset_compiler.thin import thin_gate
from glb_fixtures import box, combine_meshes, fixture, glb, orthogonal_union
from test_classification import tunnel
from test_surface import MICRO, STANDARD


def geometry(doc, binary):
    return canonicalize_geometry(read_glb(glb(doc, binary)))


class ThinTests(unittest.TestCase):
    def test_cube_hollow_L_axis_section_proofs_both_profiles(self):
        shapes = [box(), combine_meshes([box((0, 0, 0), (2, 2, 2)), box((.5,) * 3, (1.5,) * 3)]),
                  orthogonal_union((0, .5, 1), (0, .5, 1), (0, .5), {(0, 0, 0), (1, 0, 0), (0, 1, 0)})]
        for shape, measured in zip(shapes, (1, .5, .5)):
            for profile in (MICRO, STANDARD):
                decisions, _, _ = thin_gate(geometry(*fixture(*shape)), profile)
                self.assertEqual(decisions[0]["outcome"], "Voxelized")
                self.assertEqual(decisions[0]["proof"]["minimumAxisSectionMeters"], measured)
                self.assertEqual(decisions[0]["proof"]["samplingThresholdMeters"], 2 * (0.125 if profile == MICRO else .25))

    def test_overdeclared_plate_actual_thin_witness_rejects(self):
        doc, binary = fixture(*box((0, 0, 0), (1, 1, .0625)))
        doc["nodes"][0]["extras"]["hestia"]["thinFeature"]["declaredMinimumThicknessMeters"] = 100
        with self.assertRaises(CompilerError) as error:
            thin_gate(geometry(doc, binary), MICRO)
        self.assertEqual(error.exception.decisions[0]["outcome"], "RejectedTooThin")
        self.assertEqual(error.exception.decisions[0]["proof"]["minimumAxisSectionMeters"], .0625)
        self.assertEqual(doc["nodes"][0]["extras"]["hestia"]["thinFeature"]["declaredMinimumThicknessMeters"], 100)

    def test_dyadic_just_under_threshold_not_rounded_to_safe(self):
        doc, binary = fixture(*box((0, 0, 2 ** -55), (.5, .5, .5)))
        with self.assertRaises(CompilerError) as error:
            thin_gate(geometry(doc, binary), STANDARD)
        self.assertEqual(error.exception.decisions[0]["outcome"], "RejectedTooThin")

    def test_beam_parameters_reconstruct_actual_world_box(self):
        doc, binary = fixture(*box((0, 0, 0), (2, .0625, .125)))
        doc["nodes"][0]["translation"] = [-3, 2, -1]
        doc["nodes"][0]["extras"]["hestia"]["thinFeature"]["policy"] = "PreserveAsBeam"
        decisions, projected, _ = thin_gate(geometry(doc, binary), STANDARD)
        decision = decisions[0]
        self.assertEqual(decision["outcome"], "PreservedSemantic")
        self.assertEqual(decision["replacement"]["boundsMinMeters"], [-3, 2, -1])
        self.assertEqual(decision["replacement"]["boundsMaxMeters"], [-1, 2.0625, -.875])
        self.assertEqual(decision["replacement"]["lengthMeters"], 2)
        self.assertEqual(decision["replacement"]["crossSectionMeters"], [.0625, .125])
        self.assertEqual(projected.triangles, ())

    def test_tube_is_not_a_rod_and_arbitrary_TRS_bakes_but_blocks_compile(self):
        doc, binary = fixture(*tunnel(.0625, .9375))
        doc["nodes"][0]["extras"]["hestia"]["thinFeature"]["policy"] = "PreserveAsRod"
        with self.assertRaises(CompilerError) as error:
            thin_gate(geometry(doc, binary), MICRO)
        self.assertEqual(error.exception.decisions[0]["outcome"], "RejectedUnprovenThickness")
        doc, binary = fixture(*box())
        doc["nodes"][0]["rotation"] = [0, 0, math.sin(math.pi / 4), math.cos(math.pi / 4)]
        baked = geometry(doc, binary)
        self.assertEqual(len(baked.triangles), 12)
        with self.assertRaises(CompilerError) as error:
            thin_gate(baked, MICRO)
        self.assertEqual(error.exception.decisions[0]["outcome"], "RejectedUnprovenThickness")

    def test_rectangular_single_layer_shell_replacement_and_layer_order(self):
        doc, binary = fixture([(0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0)], [(0, 1, 2), (0, 2, 3)])
        record = doc["nodes"][0]["extras"]["hestia"]
        record.update(representation="Shell", shell={"thicknessMeters": .0625,
                      "layers": [{"structuralMaterialId": "steel.a", "thicknessMeters": .0625}]})
        record["thinFeature"]["policy"] = "PreserveAsShell"
        decisions, projection, _ = thin_gate(geometry(doc, binary), MICRO)
        self.assertEqual(decisions[0]["outcome"], "PreservedSemantic")
        self.assertEqual(decisions[0]["replacement"]["kind"], "RectangularSingleLayerMidplaneShell")
        self.assertEqual(decisions[0]["replacement"]["layerIntent"], record["shell"]["layers"])
        self.assertEqual(projection.triangles, ())
        doc["materials"].append({"extras": {"hestia": {"renderMaterialId": "render.b", "structuralMaterialId": "steel.b"}}})
        record["representation"] = "LayeredShell"
        record["shell"]["layers"].append({"structuralMaterialId": "steel.b", "thicknessMeters": .03125})
        with self.assertRaises(CompilerError) as error:
            thin_gate(geometry(doc, binary), MICRO)
        self.assertEqual(error.exception.decisions[0]["outcome"], "RejectedUnprovenThickness")

    def test_decorative_and_geometryless_assembly_retained_no_payload(self):
        doc, binary = fixture(*box())
        record = doc["nodes"][0]["extras"]["hestia"]
        record.update(representation="Decorative", destructible=False, collisionPolicy="None", navigationPolicy="None")
        decisions, projection, _ = thin_gate(geometry(doc, binary), MICRO)
        self.assertEqual(decisions[0]["outcome"], "DecorativeOnly")
        self.assertEqual(projection.triangles, ())
        record.update(representation="StructuralAssembly")
        del doc["nodes"][0]["mesh"]
        decisions, projection, _ = thin_gate(geometry(doc, binary), MICRO)
        self.assertEqual(decisions[0]["replacement"]["kind"], "SemanticAssemblyGraph")

    def test_whole_asset_material_conflict_and_preallocation_guards(self):
        doc, binary = fixture(*box())
        doc["materials"].append({"extras": {"hestia": {"renderMaterialId": "render.b", "structuralMaterialId": "steel.b"}}})
        doc["nodes"][0]["extras"]["hestia"]["structuralMaterialId"] = "steel.b"
        with self.assertRaises(CompilerError):
            thin_gate(geometry(doc, binary), MICRO)
        doc, binary = fixture(*box((0, 0, 0), (100, 100, 100)))
        with patch("tools.hestia_asset_compiler.thin.source_cells") as allocating:
            with self.assertRaises(CompilerError):
                thin_gate(geometry(doc, binary), MICRO)
            allocating.assert_not_called()
