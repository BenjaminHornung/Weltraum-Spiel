"""Tests for the Blender-to-Hestia handoff contract."""

from __future__ import annotations

import dataclasses
import inspect
import math
import os
import re
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from tools.blender.hestia_asset_authoring.canonical import (
    canonical_json,
    canonical_json_bytes,
    canonicalize,
    sha256_bytes,
    sha256_file,
)
from tools.blender.hestia_asset_authoring.model import (
    AuthoringInput,
    BreakPolicy,
    CanonicalAsset,
    CanonicalJoint,
    CanonicalMarker,
    CanonicalMaterial,
    CanonicalPart,
    CollisionPolicy,
    Diagnostic,
    DiagnosticSeverity,
    GeometryInventory,
    JointType,
    MarkerType,
    MaterialInventory,
    MeshInventory,
    MeshTopology,
    NavigationPolicy,
    PrimitiveInventory,
    RepresentationMode,
    Shell,
    ShellLayer,
    ThinFeature,
    ThinFeaturePolicy,
    Transform,
    UnappliedScalePolicy,
    ValidationOptions,
)
from tools.blender.hestia_asset_authoring.report import build_report
from tools.blender.hestia_asset_authoring.schema import ID_PATTERN, SCHEMA_ID, is_valid_id, validate_id
from tools.blender.hestia_asset_authoring.validation import is_exportable, validate_asset


class HestiaAssetAuthoringContractTests(unittest.TestCase):
    @staticmethod
    def _thin_feature(policy: ThinFeaturePolicy = ThinFeaturePolicy.REJECT) -> ThinFeature:
        return ThinFeature(policy=policy, declared_minimum_thickness_m=0.01)

    @classmethod
    def _part(
        cls,
        part_id: str = "part-01",
        *,
        parent_part_id: str | None = None,
        representation: RepresentationMode = RepresentationMode.STRUCTURAL_ASSEMBLY,
        destructible: bool = False,
        collision: CollisionPolicy = CollisionPolicy.NONE,
        navigation: NavigationPolicy = NavigationPolicy.NONE,
        transform: Transform | None = None,
        shell: Shell | None = None,
        tags: tuple[str, ...] = (),
    ) -> CanonicalPart:
        return CanonicalPart(
            part_id=part_id,
            representation_mode=representation,
            destructible=destructible,
            collision_policy=collision,
            navigation_policy=navigation,
            thin_feature=cls._thin_feature(),
            parent_part_id=parent_part_id,
            default_render_material_id="mat-render",
            structural_material_id="mat-structural",
            shell=shell,
            tags=tags,
            transform=transform or Transform(),
        )

    @classmethod
    def _marker(
        cls,
        marker_id: str = "marker-01",
        *,
        marker_type: MarkerType = MarkerType.SNAP,
        part_id: str | None = "part-01",
        interface_id: str | None = None,
        tags: tuple[str, ...] = (),
    ) -> CanonicalMarker:
        return CanonicalMarker(
            marker_id=marker_id,
            marker_type=marker_type,
            part_id=part_id,
            interface_id=interface_id,
            tags=tags,
        )

    @staticmethod
    def _joint(
        joint_id: str = "joint-01",
        *,
        child_part_id: str = "part-01",
        parent_part_id: str = "part-01",
        break_policy: BreakPolicy = BreakPolicy.NEVER,
        break_force_n: float | None = None,
        break_torque_nm: float | None = None,
        tags: tuple[str, ...] = (),
    ) -> CanonicalJoint:
        return CanonicalJoint(
            joint_id=joint_id,
            child_part_id=child_part_id,
            parent_part_id=parent_part_id,
            joint_type=JointType.FIXED,
            break_policy=break_policy,
            break_force_n=break_force_n,
            break_torque_nm=break_torque_nm,
            tags=tags,
        )

    @classmethod
    def _asset(
        cls,
        *,
        parts: tuple[CanonicalPart, ...] | None = None,
        joints: tuple[CanonicalJoint, ...] | None = None,
        markers: tuple[CanonicalMarker, ...] | None = None,
        materials: tuple[CanonicalMaterial, ...] | None = None,
        tags: tuple[str, ...] = (),
    ) -> CanonicalAsset:
        return CanonicalAsset(
            asset_id="asset-01",
            asset_revision=1,
            representation_mode=RepresentationMode.STRUCTURAL_ASSEMBLY,
            parts=(cls._part(),) if parts is None else parts,
            joints=(cls._joint(),) if joints is None else joints,
            markers=(cls._marker(),) if markers is None else markers,
            materials=(
                CanonicalMaterial("mat-render", structural_material_id="mat-structural"),
            ) if materials is None else materials,
            default_structural_material_id="mat-structural",
            tags=tags,
        )

    @classmethod
    def _inventory(cls, *, topology: MeshTopology | None = None) -> GeometryInventory:
        mesh = MeshInventory(
            "part-01",
            topology=topology or MeshTopology(vertex_count=8, edge_count=12, polygon_count=6, triangle_count=12),
            bounds_min=(0.0, 0.0, 0.0),
            bounds_max=(1.0, 1.0, 1.0),
            material_ids=("mat-render",),
            primitive_ids=("part-01",),
        )
        return GeometryInventory(
            meshes=(mesh,),
            primitives=(PrimitiveInventory("part-01", "part-01", "mat-render", topology=mesh.topology),),
            materials=(MaterialInventory("mat-render"),),
        )

    @classmethod
    def _authoring_input(cls, asset: CanonicalAsset | None = None) -> AuthoringInput:
        return AuthoringInput(asset or cls._asset(), cls._inventory())

    @staticmethod
    def _codes(asset: object, options: ValidationOptions | None = None) -> set[str]:
        return {item.code for item in validate_asset(asset, options)}

    def test_valid_structural_assembly_is_exportable(self) -> None:
        asset = self._asset()

        self.assertEqual(validate_asset(asset), ())
        self.assertTrue(is_exportable(asset))

    def test_id_pattern_is_exact_lowercase_ascii_colon_and_max_128(self) -> None:
        self.assertTrue(is_valid_id("lowercase:a-01"))
        self.assertTrue(ID_PATTERN.fullmatch("a" * 128))
        for value in ("Uppercase", " asset-01", "asset-01 ", "a" * 129, "", "ümlaut"):
            self.assertFalse(is_valid_id(value), value)
            with self.assertRaises(ValueError):
                validate_id(value, "asset_id")

    def test_canonical_constructors_have_no_asset_revision_or_minimum_thickness_default(self) -> None:
        with self.assertRaises(TypeError):
            CanonicalAsset(asset_id="asset-01", representation_mode=RepresentationMode.STRUCTURAL_ASSEMBLY)
        with self.assertRaises(TypeError):
            CanonicalPart(
                "part-01",
                RepresentationMode.STRUCTURAL_ASSEMBLY,
                False,
                CollisionPolicy.NONE,
                NavigationPolicy.NONE,
            )

    def test_joint_contract_fields_are_required_without_defaults(self) -> None:
        parameters = inspect.signature(CanonicalJoint).parameters
        for name in ("parent_part_id", "child_part_id", "joint_type", "break_policy"):
            self.assertIs(parameters[name].default, inspect.Parameter.empty)
        with self.assertRaises(TypeError):
            CanonicalJoint(joint_id="joint-01")

    def test_duplicate_ids_are_errors_for_parts_joints_markers_and_materials(self) -> None:
        asset = self._asset(
            parts=(self._part(), self._part()),
            joints=(self._joint(), self._joint()),
            markers=(self._marker(), self._marker()),
            materials=(CanonicalMaterial("mat-render"), CanonicalMaterial("mat-render")),
        )

        diagnostics = validate_asset(asset)
        duplicates = [item for item in diagnostics if item.code == "id.duplicate"]
        self.assertEqual(
            {item.path for item in duplicates},
            {"part[part-01]", "joint[joint-01]", "marker[marker-01]", "material[mat-render]"},
        )
        self.assertEqual(len(duplicates), 8)

    def test_parent_and_references_must_resolve_exactly_once(self) -> None:
        asset = self._asset(
            parts=(self._part("part-01"), self._part("part-02", parent_part_id="missing-part")),
            joints=(self._joint(child_part_id="missing-child", parent_part_id="missing-parent"),),
            markers=(self._marker(part_id="missing-marker-part"),),
        )

        diagnostics = validate_asset(asset)
        reference_paths = {item.path for item in diagnostics if item.code == "reference.not-exactly-one"}
        self.assertEqual(
            reference_paths,
            {
                "part[part-02].parentPartId",
                "joint[joint-01].childPartId",
                "joint[joint-01].parentPartId",
                "marker[marker-01].partId",
            },
        )

    def test_material_references_use_separate_render_and_structural_namespaces(self) -> None:
        materials = (CanonicalMaterial("render-a", structural_material_id="structural-a"),)
        valid = self._asset(
            parts=(dataclasses.replace(self._part(), default_render_material_id="render-a", structural_material_id="structural-a"),),
            joints=(),
            markers=(),
            materials=materials,
        )
        valid = dataclasses.replace(valid, default_structural_material_id="structural-a")
        self.assertNotIn("reference.not-exactly-one", self._codes(valid))

        crossed = dataclasses.replace(
            valid,
            parts=(dataclasses.replace(valid.parts[0], default_render_material_id="structural-a", structural_material_id="render-a"),),
        )
        paths = {item.path for item in validate_asset(crossed) if item.code == "reference.not-exactly-one"}
        self.assertEqual(paths, {"part[part-01].defaultRenderMaterialId", "part[part-01].structuralMaterialId"})

    def test_default_render_material_must_be_present_in_semantic_part_primitives(self) -> None:
        asset = self._asset(
            joints=(),
            markers=(),
            materials=(CanonicalMaterial("mat-render"), CanonicalMaterial("accent")),
        )
        topology = MeshTopology(vertex_count=4, edge_count=5, polygon_count=2, triangle_count=2)

        def inventory(material_ids: tuple[str, ...]) -> GeometryInventory:
            return GeometryInventory(
                meshes=(
                    MeshInventory(
                        "part-01",
                        topology=topology,
                        material_ids=tuple(sorted(set(material_ids))),
                        primitive_ids=tuple(f"part-01:{index}" for index in range(len(material_ids))),
                    ),
                ),
                primitives=tuple(
                    PrimitiveInventory(f"part-01:{index}", "part-01", material_id, topology=topology)
                    for index, material_id in enumerate(material_ids)
                ),
                materials=tuple(MaterialInventory(material_id) for material_id in sorted(set(material_ids))),
            )

        valid_codes = self._codes(AuthoringInput(asset, inventory(("accent", "mat-render"))))
        self.assertNotIn("inventory.default-material-not-assigned", valid_codes)
        self.assertNotIn("inventory.missing-material", valid_codes)

        diagnostics = validate_asset(AuthoringInput(asset, inventory(("accent",))))
        mismatch = [item for item in diagnostics if item.code == "inventory.default-material-not-assigned"]
        self.assertEqual(1, len(mismatch))
        self.assertEqual("part[part-01].defaultRenderMaterialId", mismatch[0].path)

    def test_geometryless_parts_keep_representation_specific_inventory_behavior(self) -> None:
        empty = GeometryInventory((), (), ())
        structural = self._asset(parts=(self._part(),), joints=(), markers=())
        structural_codes = self._codes(AuthoringInput(structural, empty))
        self.assertNotIn("inventory.default-material-not-assigned", structural_codes)
        self.assertNotIn("geometry.solid-not-closed", structural_codes)

        solid = self._asset(
            parts=(self._part(representation=RepresentationMode.SOLID),),
            joints=(),
            markers=(),
        )
        self.assertIn("geometry.solid-not-closed", self._codes(AuthoringInput(solid, empty)))

    def test_parent_cycles_are_rejected(self) -> None:
        asset = self._asset(
            parts=(
                self._part("part-a", parent_part_id="part-b"),
                self._part("part-b", parent_part_id="part-a"),
            ),
            joints=(),
            markers=(),
        )

        self.assertIn("structure.part-parent-cycle", self._codes(asset))

    def test_open_solid_is_rejected(self) -> None:
        asset = self._asset(
            parts=(self._part(representation=RepresentationMode.SOLID),),
            joints=(),
            markers=(),
        )
        open_topology = MeshTopology(vertex_count=4, edge_count=5, polygon_count=2, boundary_edge_count=1)

        diagnostics = validate_asset(
            AuthoringInput(asset, self._inventory(topology=open_topology)),
        )
        self.assertEqual(
            {item.code for item in diagnostics if item.path in {"primitive[part-01]", "mesh[part-01]"}},
            {"geometry.open", "geometry.solid-not-closed"},
        )

    def test_shell_requires_positive_thickness_and_shell_representation_requires_shell(self) -> None:
        for value in (0.0, -0.1, math.inf, math.nan):
            with self.assertRaises(ValueError):
                Shell(value, (ShellLayer("mat-structural", 0.01),))

        missing_shell = self._asset(parts=(self._part(representation=RepresentationMode.SHELL),), joints=(), markers=())
        self.assertIn("geometry.shell-required", self._codes(missing_shell))
        shell = Shell(0.02, (ShellLayer("mat-structural", 0.02),))
        valid_shell = self._asset(parts=(self._part(representation=RepresentationMode.SHELL, shell=shell),), joints=(), markers=())
        self.assertNotIn("geometry.shell-required", self._codes(valid_shell))

    def test_thin_feature_requires_explicit_positive_finite_thickness(self) -> None:
        for value in (0.0, -0.1, math.inf, math.nan):
            with self.assertRaises(ValueError):
                ThinFeature(ThinFeaturePolicy.REJECT, value)
        self.assertEqual(self._thin_feature().to_contract_dict()["declaredMinimumThicknessMeters"], 0.01)

    def test_negative_determinant_is_an_error(self) -> None:
        asset = self._asset(parts=(self._part(transform=Transform(scale=(-1.0, 1.0, 1.0))),))

        diagnostics = validate_asset(asset)
        negative = [item for item in diagnostics if item.code == "transform.negative-determinant"]
        self.assertEqual(len(negative), 1)
        self.assertEqual(negative[0].severity, DiagnosticSeverity.ERROR)

    def test_unapplied_scale_policy_controls_warning_and_error(self) -> None:
        asset = self._asset(parts=(self._part(transform=Transform(scale=(2.0, 1.0, 1.0))),))

        warning = [item for item in validate_asset(asset) if item.code == "transform.unapplied-scale"]
        self.assertEqual(len(warning), 1)
        self.assertEqual(warning[0].severity, DiagnosticSeverity.WARNING)
        self.assertTrue(is_exportable(asset))

        error_options = ValidationOptions(unapplied_scale_policy=UnappliedScalePolicy.ERROR)
        error = [item for item in validate_asset(asset, error_options) if item.code == "transform.unapplied-scale"]
        self.assertEqual(len(error), 1)
        self.assertEqual(error[0].severity, DiagnosticSeverity.ERROR)
        self.assertFalse(is_exportable(asset, error_options))

    def test_threshold_cut_interface_and_decorative_rules(self) -> None:
        threshold = self._asset(
            joints=(self._joint(break_policy=BreakPolicy.THRESHOLD),),
        )
        self.assertIn("policy.threshold", self._codes(threshold))
        valid_threshold = self._asset(
            joints=(self._joint(break_policy=BreakPolicy.THRESHOLD, break_force_n=1.0),),
        )
        self.assertNotIn("policy.threshold", self._codes(valid_threshold))

        cut_interface = self._asset(
            markers=(self._marker(marker_type=MarkerType.CUT_INTERFACE),),
            joints=(),
        )
        self.assertIn("schema.cut-interface-id", self._codes(cut_interface))

        decorative = self._asset(
            parts=(
                self._part(
                    representation=RepresentationMode.DECORATIVE,
                    destructible=True,
                    collision=CollisionPolicy.COMPOUND,
                ),
            ),
            joints=(),
            markers=(),
        )
        codes = self._codes(decorative)
        self.assertIn("representation.decorative-destructible", codes)
        self.assertIn("representation.decorative-collision", codes)

    def test_present_break_values_must_be_positive_for_every_policy(self) -> None:
        for policy in BreakPolicy:
            for field_name in ("break_force_n", "break_torque_nm"):
                for value in (0.0, -1.0, math.inf, math.nan):
                    with self.subTest(policy=policy, field=field_name, value=value):
                        with self.assertRaises(ValueError):
                            if field_name == "break_force_n":
                                self._joint(break_policy=policy, break_force_n=value)
                            else:
                                self._joint(break_policy=policy, break_torque_nm=value)

    def test_canonical_output_is_exact_camel_case_and_deterministically_sorted(self) -> None:
        asset = self._asset(
            parts=(self._part("part-b", tags=("z-tag", "a-tag")), self._part("part-a")),
            joints=(self._joint("joint-b"), self._joint("joint-a", child_part_id="part-a")),
            markers=(self._marker("marker-b"), self._marker("marker-a")),
            tags=("z-tag", "a-tag"),
        )
        document = canonicalize(asset)

        self.assertEqual(document["schema"], SCHEMA_ID)
        self.assertEqual(document["asset"], {
            "assetId": "asset-01",
            "assetRevision": 1,
            "coordinateFrame": {"forwardAxis": "+Z", "handedness": "RIGHT", "upAxis": "+Y"},
            "defaultStructuralMaterialId": "mat-structural",
            "metersPerUnit": 1,
            "representation": "StructuralAssembly",
            "tags": ["a-tag", "z-tag"],
        })
        self.assertEqual([part["partId"] for part in document["parts"]], ["part-a", "part-b"])
        self.assertEqual(document["parts"][1]["tags"], ["a-tag", "z-tag"])
        self.assertEqual([joint["jointId"] for joint in document["joints"]], ["joint-a", "joint-b"])
        self.assertEqual([marker["markerId"] for marker in document["markers"]], ["marker-a", "marker-b"])
        self.assertEqual(canonical_json(asset), canonical_json(dataclasses.replace(asset)))
        self.assertNotRegex(canonical_json(asset), r"[A-Za-z0-9]_[A-Za-z0-9]")
        self.assertNotIn('"kind"', canonical_json(asset))

    def test_canonical_schema_shape_is_closed_and_has_no_transforms(self) -> None:
        document = self._asset(tags=()).to_contract_dict()
        self.assertNotIn("transform", document["parts"][0])
        self.assertNotIn("transform", document["markers"][0])

        class PartWithUnknownField(CanonicalPart):
            def to_contract_dict(self) -> dict[str, object]:
                payload = super().to_contract_dict()
                payload["unknownCanonicalField"] = True
                return payload

        malformed_part = PartWithUnknownField(**{
            field.name: getattr(self._part(), field.name)
            for field in dataclasses.fields(CanonicalPart)
        })
        malformed = self._asset(parts=(malformed_part,), joints=(), markers=())
        diagnostics = validate_asset(malformed)
        self.assertIn("schema.unknown-field", {item.code for item in diagnostics})

        asset_without_tags = self._asset(tags=())
        original_serializer = CanonicalAsset.to_contract_dict

        def serialize_without_asset_tags(value: CanonicalAsset) -> dict[str, object]:
            payload = original_serializer(value)
            payload["asset"].pop("tags", None)
            return payload

        with mock.patch.object(CanonicalAsset, "to_contract_dict", serialize_without_asset_tags):
            missing = [item for item in validate_asset(asset_without_tags) if item.code == "schema.missing-field"]
        self.assertEqual(missing, [])

    def test_negative_zero_is_normalized_and_non_finite_values_are_rejected(self) -> None:
        self.assertEqual(canonicalize({"negativeZero": -0.0}), {"negativeZero": 0})
        self.assertEqual(canonical_json({"negativeZero": -0.0}), '{"negativeZero":0}')
        for value in (math.inf, -math.inf, math.nan):
            with self.assertRaises(ValueError):
                canonical_json({"value": value})

    def test_reports_and_hashes_are_repeatable_without_volatile_or_snake_case_metadata(self) -> None:
        inputs = self._authoring_input()
        options = ValidationOptions(unapplied_scale_policy=UnappliedScalePolicy.ERROR)
        glb_sha256 = "ab" * 32
        first = build_report(
            inputs,
            glb_sha256=glb_sha256,
            options=options,
            output_basename=r"C:\machine-specific\asset.glb",
        )
        second = build_report(
            dataclasses.replace(inputs),
            glb_sha256=glb_sha256,
            options=options,
            output_basename="asset.glb",
        )
        first_bytes = canonical_json_bytes(first)
        second_bytes = canonical_json_bytes(second)

        self.assertEqual(first, second)
        self.assertEqual(first_bytes, second_bytes)
        self.assertEqual(sha256_bytes(first_bytes), sha256_bytes(second_bytes))
        self.assertEqual({"payload", "digests"}, set(first))
        self.assertEqual({"glb_sha256", "report_sha256"}, set(first["digests"]))
        self.assertEqual(
            first["digests"]["report_sha256"],
            sha256_bytes(canonical_json_bytes(first["payload"])),
        )
        self.assertEqual(glb_sha256, first["payload"]["glbSha256"])
        self.assertEqual("asset.glb", first["payload"]["outputBasename"])
        self.assertEqual("error", first["payload"]["options"]["unappliedScalePolicy"])
        self.assertIn("semantics", first["payload"])
        self.assertNotIn('"kind"', first_bytes.decode("utf-8"))
        report_text = first_bytes.decode("utf-8")
        self.assertNotRegex(report_text, r"(?:timestamp|locale|random)")
        self.assertNotIn("machine-specific", report_text)
        self.assertNotIn(str(Path.cwd()), report_text)

    def test_file_hash_depends_on_bytes_not_file_time(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            first_path = Path(directory) / "first.bin"
            second_path = Path(directory) / "second.bin"
            first_path.write_bytes(b"stable handoff bytes")
            second_path.write_bytes(b"stable handoff bytes")
            os.utime(first_path, (1, 1))
            os.utime(second_path, (2_000_000_000, 2_000_000_000))
            self.assertEqual(sha256_file(first_path), sha256_file(second_path))


if __name__ == "__main__":
    unittest.main()
