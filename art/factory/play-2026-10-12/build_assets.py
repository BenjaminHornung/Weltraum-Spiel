"""Part-bound visual derivatives; native Factory geometry remains authoritative."""
from pathlib import Path
import hashlib
import json
import math
import shutil
import struct
import subprocess
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tools/blender"))
from hestia_asset_authoring.model import CanonicalAsset, CanonicalPart, ThinFeature, Transform, ValidationOptions
from hestia_asset_authoring.validation import validate_asset


def validate_binding(value):
    """Reuse the existing canonical derivative gate before source admission."""
    asset = CanonicalAsset(asset_id="play_binding", asset_revision=1, representation_mode="Decorative",
        parts=tuple(CanonicalPart(part_id=node["extras"]["playBinding"]["partId"], representation_mode="Decorative",
            destructible=False, collision_policy="None", navigation_policy="None",
            thin_feature=ThinFeature(policy="DecorativeOnly", declared_minimum_thickness_m=.01),
            transform=Transform(scale=tuple(node.get("scale", [1, 1, 1])))) for node in value["nodes"]))
    errors = [item.code for item in validate_asset(asset, ValidationOptions(unapplied_scale_policy="error")) if item.severity.value == "error"]
    expected = {part["partId"] for part in value["source"]["parts"]}
    actual = [node["extras"]["playBinding"]["partId"] for node in value["nodes"]]
    if set(actual) != expected or len(actual) != len(expected):
        errors.append("part-set-mismatch")
    for node in value["nodes"]:
        binding = node["extras"]["playBinding"]
        if binding["sourceSHA256"] != value["sourceSHA256"] or binding["sourceAssetId"] != value["source"]["assetId"]:
            errors.append("source-binding-mismatch")
        if binding["definitionId"] != value["source"]["definitionId"] or value["definitionRef"]["sourceId"] != value["source"]["definitionId"]:
            errors.append("definition-binding-mismatch")
        if node["name"] != binding["partId"] or binding.get("parentPartId") is not None:
            errors.append("part-node-mismatch")
        if node.get("scale", [1, 1, 1]) != [1, 1, 1] or node.get("translation", [0, 0, 0]) != [0, 0, 0] or node.get("rotation", [0, 0, 0, 1]) != [0, 0, 0, 1] or "matrix" in node:
            errors.append("non-neutral-transform")
    errors = sorted(set(errors))
    return {"valid": not errors, "errors": errors}


ART = ROOT / "art/factory/play-2026-10-12"
PUBLIC = ROOT / "apps/weltraum-browser/public/factory/play-2026-10-12"
SOURCE_HEAD = "96cced23cd285b57f8a557d01ac9ed8a158c927f"
BASE_ART_COMMIT = "e752cc7fce43a50b4bcb4800d9d27584b44b6a0e"
EXPECTED_CATALOG_DIGEST = "fnv1a:f3a8c642"
PALETTE = {"EX-STRUCT": "30383D", "EX-SHELL": "B6BDB8", "EX-FUNCTION": "407A79", "EX-HAZARD": "D8A94E", "EX-PV": "1D2E3C"}
FROZEN = {
    "art/factory/fp02/cutter/source.scene.json": "abd1ce25fd19ad61a9cb65de9f5ba10c303aa5c1a1aa16260de9dce9534fa5fd",
    "art/factory/fp02/former/source.scene.json": "4e27abd922e46516d1db0307b8dfb5edaf1b8c6807e80006781344b9dfcf535d",
    "art/factory/fp01/power-kit/source.scene.json": "bb131bb9b03f2e76abf1ba4ad25fe7d228ecf19b70ec9910e491c03dd1ab256c",
    "apps/weltraum-browser/src/factory/presentation/factoryAssets.ts": "a9d707c53d8ae401e952076007aff523bcec127f4c0b58d37020aaea9ced973c",
    "apps/weltraum-browser/src/factory/construction/cargoHandlingProfile.ts": "04e3f16fdc073414c5d02ef58082cfe9f959663a597e2d1d689206e892a92fcd",
    "apps/weltraum-browser/src/factory/fixtures/cargoSite.ts": "83fa38b62b88c8f0c7f9351a1d30617b2704d4c04a21bb64fcc5084e8739ef0c",
    "apps/weltraum-browser/src/factory/catalog/fp02Catalog.ts": "e746f2408314511a9e82315734fc78993b13ddc2627216b72dc0aa2c35d73fd3",
}


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def record(path):
    return {"path": str(path.relative_to(ROOT)), "sha256": sha(path), "bytes": path.stat().st_size}


def check_sources():
    for path, expected in FROZEN.items():
        if sha(ROOT / path) != expected:
            raise ValueError(f"Frozen source changed: {path}")


def read_snapshot_data():
    """Read existing TS projections, without recreating catalog or source authority."""
    check_sources()
    script = '''
import {createServer} from "vite";
const server = await createServer({configFile:false,server:{middlewareMode:true},appType:"custom",logLevel:"silent"});
try {
 const module = await server.ssrLoadModule("/src/factory/presentation/factoryAssets.ts");
 const catalogModule = await server.ssrLoadModule("/src/factory/catalog/fp02Catalog.ts");
 const catalog = catalogModule.loadFactoryCatalog(catalogModule.createFp02CatalogInput());
 const ids = ["B06","B07","B05","B09","fp06.line.belt_4m","fp02.comp.small_brace","fp02.device.wind_pack_6kw","fp02.device.pv_pack_2kwp","fp02.device.battery_4kwh","fp02.device.distribution_40kw"];
 console.log("PLAY_JSON="+JSON.stringify({assets:ids.map(id=>({source:module.getFactoryAssetSource(id),definitionRef:((d)=>({sourceId:d.sourceId,version:d.version,digest:d.digest}))(module.readFactoryAssetDefinition(id))})),catalogDigest:catalog.catalogDigest,items:catalog.items.map(i=>({sourceId:i.sourceId,version:i.version,digest:i.digest}))}));
} finally { await server.close(); }
'''
    result = subprocess.run(["node", "--input-type=module", "-e", script], cwd=ROOT / "apps/weltraum-browser", text=True, capture_output=True, check=True)
    payload = next(line[len("PLAY_JSON="):] for line in result.stdout.splitlines() if line.startswith("PLAY_JSON="))
    data = json.loads(payload)
    if data["catalogDigest"] != EXPECTED_CATALOG_DIGEST:
        raise ValueError("Frozen catalog digest mismatch")
    return data


def snapshot():
    data = read_snapshot_data()
    families = {"B06": "cutter", "B07": "former", "B05": "workbench", "B09": "storage", "fp06.line.belt_4m": "belt", "fp02.comp.small_brace": "brace"}
    primary = {"B06": "art/factory/fp02/cutter/source.scene.json", "B07": "art/factory/fp02/former/source.scene.json"}
    jobs = []
    for item in data["assets"]:
        source = item["source"]
        ident = source["definitionId"]
        family = families.get(ident, "power-kit")
        slug = families.get(ident, ident.removeprefix("fp02.device.").replace("_pack_6kw", "").replace("_pack_2kwp", "").replace("_4kwh", "").replace("_40kw", ""))
        source_path = primary.get(ident, "art/factory/fp01/power-kit/source.scene.json" if family == "power-kit" else "apps/weltraum-browser/src/factory/presentation/factoryAssets.ts")
        jobs.append({"assetId": f"play_{slug.replace('-', '_')}_v1", "family": family, "slug": slug, "source": source,
            "definitionRef": item["definitionRef"], "sourceFile": record(ROOT / source_path), "visualOnlyAnchor": None})
    # Existing carrier payload and supports, same closed dimensions/part IDs as factoryAssets.
    for name, size in [("carrier-heavy", [1, 1, 1.5]), ("carrier-medium", [1, 1, 1]), ("carrier-light", [.5, 1, .5])]:
        offset = .0625 if size[0] == .5 else .25
        parts = [{"partId": "payload", "role": "paid_payload", "boxes": [{"centerM": [0, .75, 0], "sizeM": size, "material": "EX-HAZARD"}]}]
        parts += [{"partId": f"support_{int(x > 0)}_{int(z > 0)}", "role": "support", "boxes": [{"centerM": [x, .125, z], "sizeM": [.125, .25, .125], "material": "EX-STRUCT"}]} for x in [-offset, offset] for z in [-offset, offset]]
        anchor = {"kind": "visual-only-carrier", "owner": "existing Native carrier", "profileSizeMm": [int(v * 1000) for v in size], "quantityAuthority": "closed CargoHandlingProfile and active custody readview"}
        jobs.append(visual_job("carrier", name, parts, "apps/weltraum-browser/src/factory/presentation/factoryAssets.ts", anchor))
    # The only existing wreck geometry is its 1.5 x 1.5 x 1 m local access segment.
    for name in ["wreck-cargo", "wreck-cargo-open"]:
        jobs.append(visual_job("wreck-cargo", name, [{"partId": "cargo_access", "role": "finite_cargo_access", "boxes": [{"centerM": [0, .75, 0], "sizeM": [1.5, 1.5, 1], "material": "EX-SHELL"}]}], "apps/weltraum-browser/src/factory/fixtures/cargoSite.ts",
            {"kind": "visual-only-cargo", "ownerId": "fp02_wreck_owner", "containerId": "fp02_wreck_cargo", "worldCenterMm": [-5500, 2000, 13125], "nativeBoundsMm": {"min": [-6250, 1250, 12625], "max": [-4750, 2750, 13625]}, "quantityAuthority": "existing finite cargo readview", "opened": name.endswith("-open")}))
    for name, item in [("steel", "steel_known"), ("semi", "steel_semi"), ("profile", "steel_profile"), ("sheet", "steel_sheet"), ("offcut", "steel_offcut")]:
        item_id = f"fp02.bulk.{item}"
        # Depiction envelope is explicitly a visual lot anchor, not packed-volume/density data.
        job = visual_job("materials", name, [{"partId": "lot", "role": "actual_finite_lot", "boxes": [{"centerM": [0, .125, 0], "sizeM": [.5, .25, .5], "material": "EX-STRUCT"}]}], "apps/weltraum-browser/src/factory/catalog/fp02Catalog.ts",
            {"kind": "visual-only-material", "itemId": item_id, "catalogDigest": data["catalogDigest"], "quantityAuthority": "existing unique actual lot custody; never a quantity encoded by triangles"})
        match = next((i for i in data["items"] if i["sourceId"] == item_id), None)
        if match is None:
            raise ValueError(f"Unknown existing material item {item_id}")
        job["visualOnlyAnchor"]["itemRef"] = match
        jobs.append(job)
    for name, size in [("cable-end", [.125, .125, .25]), ("cable-link", [.05, .05, 1])]:
        jobs.append(visual_job("power-kit", name, [{"partId": "paid_route", "role": "actual_paid_cable_route", "boxes": [{"centerM": [0, size[1] / 2, 0], "sizeM": size, "material": "EX-STRUCT"}]}], "apps/weltraum-browser/src/factory/construction/cargoHandlingProfile.ts",
            {"kind": "visual-only-cable", "itemId": "fp02.comp.field_cable", "quantityAuthority": "installed_cable routeMm from confirmed paid job", "deformation": "only approved route; visual scale cannot add length, ports, mass or material"}))
    for job in jobs:
        directory = ART / job["family"] / job["slug"]
        write_json(directory / "native-source.json", job["source"])
        job["sourceSnapshot"] = record(directory / "native-source.json")
        # Preserve actual owner source bytes even when unrelated runtime code later evolves.
        owner_blob = directory / "native-owner-source.blob"
        owner_blob.write_bytes((ROOT / job["sourceFile"]["path"]).read_bytes())
        job["sourceBlob"] = record(owner_blob)
        write_json(directory / "model-spec.json", job)
    write_json(ART / "materials/catalog-read.json", {"sourceHead": SOURCE_HEAD, "catalogDigest": data["catalogDigest"], "items": data["items"], "sourceFile": record(ROOT / "apps/weltraum-browser/src/factory/catalog/fp02Catalog.ts")})
    print(f"Snapshotted {len(jobs)} source-bound visual assets")


def snapshot_storage_open():
    """Prepare only the granted inspection pose, retaining the original native definition."""
    data = read_snapshot_data()
    closed_path = ART / "storage/storage/model-spec.json"
    job = json.loads(closed_path.read_text())
    native = next(a for a in data["assets"] if a["source"]["definitionId"] == "B09")
    if native["source"] != job["source"] or native["definitionRef"] != job["definitionRef"]:
        raise ValueError("Storage inspection native definition mismatch")
    directory = ART / "storage/storage-open"
    directory.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(ROOT / job["sourceSnapshot"]["path"], directory / "native-source.json")
    shutil.copyfile(ROOT / job["sourceBlob"]["path"], directory / "native-owner-source.blob")
    job.update({"assetId": "play_storage_inspection_open_v1", "slug": "storage-open",
        "sourceSnapshot": record(directory / "native-source.json"), "sourceBlob": record(directory / "native-owner-source.blob"),
        "visualVariant": {"baseAssetId": "play_storage_v1", "kind": "confirmed-local-inventory-inspection", "pose": "access-open", "requiresConfirmedLocalAccess": True}})
    write_json(directory / "model-spec.json", job)
    print("Snapshotted only storage-open; native parts/ports/supports/definition unchanged")


def visual_job(family, slug, parts, source_path, anchor):
    ident = "visual_anchor_" + slug.replace("-", "_")
    source = {"assetId": ident, "definitionId": ident, "revision": 1, "kind": "visual-only-derived", "origin": "ground-center", "metersPerUnit": 1,
        "parts": parts, "ports": [], "joints": [], "supportsM": [], "supportPatchesM": [], "serviceBoundsM": None}
    return {"assetId": "play_" + slug.replace("-", "_") + "_v1", "family": family, "slug": slug, "source": source,
        "definitionRef": {"sourceId": ident, "version": 1, "digest": "visual-anchor-no-catalog-definition"}, "sourceFile": record(ROOT / source_path), "visualOnlyAnchor": anchor}


class Mesh:
    """Closed hard cuboids are combined into one native-part mesh, without bevels."""
    def __init__(self):
        self.vertices, self.faces, self.materials = [], [], []

    def box(self, center, size, material, source_box):
        origin = source_box["centerM"]
        angle = source_box.get("rotationZRadians", 0)
        c, s = math.cos(angle), math.sin(angle)
        first = len(self.vertices)
        for x, y, z in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]:
            local = [center[0] + x * size[0] / 2, center[1] + y * size[1] / 2, center[2] + z * size[2] / 2]
            if any(abs(v) > source_box["sizeM"][i] / 2 + 1e-8 for i, v in enumerate(local)):
                raise ValueError("Decorative vertex escaped its frozen native box")
            runtime = [origin[0] + c * local[0] - s * local[1], origin[1] + s * local[0] + c * local[1], origin[2] + local[2]]
            # Blender +Z up, glTF export converts this exactly back to runtime XYZ.
            self.vertices.append((runtime[0], -runtime[2], runtime[1]))
        for face in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)]:
            self.faces.append(tuple(first + v for v in face))
            self.materials.append(material)


def decorate(mesh, box, role, slug, part_id):
    size = box["sizeM"]
    x, y, z = size
    add = lambda center, dims, material: mesh.box(center, dims, material, box)
    base = box["material"]
    if slug == "workbench" and part_id == "body":
        add([0, -.05, 0], [x, .1, z], "EX-STRUCT")
        add([0, .015, 0], [x, .03, z], "EX-SHELL")
        # Vise and tools fit inside the original shallow tabletop part envelope.
        add([-.55, .05, -.20], [.45, .04, .3], "EX-FUNCTION")
        for jaw in [-.72, -.38]:
            add([jaw, .075, -.20], [.07, .05, .3], "EX-STRUCT")
        add([.5, .042, .1], [.36, .025, .06], "EX-STRUCT")
        add([.63, .054, .1], [.1, .05, .16], "EX-FUNCTION")
        return
    if slug in ["storage", "storage-open"] and part_id == "body":
        # Empty shell: contents are supplied only by a current actual lot readview.
        for xx in [-x/2+.06, x/2-.06]:
            for zz in [-z/2+.06, z/2-.06]:
                add([xx, 0, zz], [.12, y, .12], "EX-STRUCT")
        for yy in [-y/2+.035, y/2-.035]:
            add([0, yy, 0], [x, .07, z], "EX-SHELL")
        add([0, 0, -z/2+.045], [x-.15, y-.12, .09], "EX-SHELL")
        if slug == "storage-open":
            # Fold each leaf +90 degrees about its upper horizontal edge, inside
            # the existing body envelope; original side material ports stay clear.
            for xx in [-.475, .475]:
                add([xx, .565, .390], [.925, .07, 1.13], "EX-SHELL")
                add([xx, .525, .365], [.775, .01, .4], "EX-FUNCTION")
            for xx in [-.125, .125]:
                add([xx, .528, .440], [.075, .016, .2], "EX-STRUCT")
        else:
            for xx in [-.475, .475]:
                add([xx, 0, z/2-.045], [.925, y-.12, .07], "EX-SHELL")
                add([xx, -.025, z/2-.005], [.775, .4, .01], "EX-FUNCTION")
            for xx in [-.125, .125]:
                add([xx, .05, z/2-.008], [.075, .2, .016], "EX-STRUCT")
        # Side MAT-IN/MAT-OUT openings retain exactly the source port planes.
        for xx in [-x/2+.03, x/2-.03]:
            for yy in [-.48, .53]:
                add([xx, yy, 0], [.06, .17, z-.2], "EX-SHELL")
            for zz in [-.69, .69]:
                add([xx, .125, zz], [.06, .75, .45], "EX-SHELL")
        return
    if slug.startswith("wreck-cargo"):
        # Torn cargo access casing in the single existing native segment.
        for xx in [-x/2+.075, x/2-.075]:
            add([xx, 0, 0], [.15, y, z], "EX-STRUCT")
        for yy in [-y/2+.06, y/2-.06]:
            add([0, yy, 0], [x, .12, z], "EX-STRUCT")
        add([0, 0, z/2-.04], [x-.25, y-.12, .08], "EX-SHELL")
        for yy, width in [(-.5, 1.12), (-.25, 1.25), (0, .98), (.25, 1.12), (.5, .875)]:
            add([-.025, yy, z/2-.10], [width, .23, .055], "EX-FUNCTION" if yy == 0 else "EX-SHELL")
        if not slug.endswith("-open"):
            for xx in [-.28, .28]:
                add([xx, 0, -z/2+.05], [.53, y-.24, .1], "EX-SHELL")
                add([xx, -.12, -z/2+.004], [.45, .12, .008], "EX-FUNCTION")
        else:
            # Access mouth is exposed; no new native clearance is claimed.
            for xx in [-.56, .56]:
                add([xx, -.10, -z/2+.05], [.12, y-.26, .1], "EX-SHELL")
        add([0, -y/2+.08, -z/2+.035], [x-.3, .035, .07], "EX-HAZARD")
        return
    if slug.startswith("carrier") and part_id == "payload":
        # A locked finite load assembly, not an extra free cargo/hover rig.
        add([0, -.015, 0], [x*.94, y*.94, z*.94], "EX-SHELL")
        for xx in [-x/2+.035, x/2-.035]:
            for zz in [-z/2+.035, z/2-.035]:
                add([xx, 0, zz], [.07, y, .07], "EX-STRUCT")
        for yy in [-y/2+.04, y/2-.04]:
            add([0, yy, 0], [x, .08, z], "EX-STRUCT")
        for xx in [-x*.27, x*.27]:
            add([xx, 0, z/2-.018], [.05, y-.1, .036], "EX-FUNCTION")
            add([xx, -.1, z/2-.005], [.1, .1, .01], "EX-HAZARD")
        return
    if slug in ["steel", "semi", "profile", "sheet", "offcut"]:
        if slug == "steel":
            for xx in [-.125, .125]:
                add([xx, 0, 0], [.24, y, z], "EX-STRUCT")
                add([xx, .11, .19], [.24, .03, .04], "EX-SHELL")
        elif slug == "semi":
            for zz in [-.19, -.065, .065, .19]:
                add([0, -.015, zz], [x, .22, .12], "EX-SHELL")
        elif slug == "profile":
            for zz in [-.16, .16]:
                for yy in [-.105, .105]:
                    add([0, yy, zz], [x, .04, .17], "EX-SHELL")
                add([0, 0, zz], [x, y-.07, .035], "EX-STRUCT")
        elif slug == "sheet":
            for i in range(5):
                add([0, -(y-.032)/2 + i*(y-.032)/4, 0], [x, .032, z], "EX-SHELL")
        else:
            # Reusable empty tray plus small offcut shapes belong to this ONE actual lot.
            add([0, -.1, 0], [x, .05, z], "EX-FUNCTION")
            for xx in [-.235, .235]:
                add([xx, 0, 0], [.03, y, z], "EX-STRUCT")
            for zz in [-.235, .235]:
                add([0, 0, zz], [x, y, .03], "EX-STRUCT")
            for i in range(4):
                add([-.12+i*.08, -.025+i*.015, -.12+i*.065], [.14, .045, .16], "EX-SHELL")
        return
    if slug == "brace" and part_id == "body":
        for yy in [-y/2+.025, y/2-.025]:
            add([0, yy, 0], [x, .05, z], "EX-STRUCT")
        add([0, 0, 0], [x, y-.06, .065], "EX-FUNCTION")
        return
    if slug == "cable-end":
        add([0, 0, .025], [x*.85, y*.85, z*.8], "EX-FUNCTION")
        add([0, 0, -.105], [x, y, .04], "EX-STRUCT")
        add([0, 0, -.085], [x*.9, y*.9, .015], "EX-HAZARD")
        return
    if slug == "cable-link":
        add([0, 0, 0], size, "EX-STRUCT")
        return
    if role in ["support"] and y > .4:
        # Folded channel legs, shoe and internal hinge stay inside each original leg.
        for xx in [-x/2+.025, x/2-.025]:
            add([xx, 0, 0], [.05, y, z*.7], "EX-STRUCT")
        add([0, -y/2+.045, 0], [x, .09, z], "EX-STRUCT")
        add([0, y/2-.045, 0], [x, .09, z], "EX-FUNCTION")
        add([0, 0, 0], [x*.6, .09, z], "EX-SHELL")
        return
    if slug == "belt" and part_id.startswith("segment_"):
        for zz in [-z/2+.03, z/2-.03]:
            add([0, 0, zz], [x, y, .06], "EX-STRUCT")
        add([0, -.025, 0], [x, .075, z-.12], "EX-PV")
        for i in range(5):
            add([-.45+i*.225, .035, 0], [.09, .055, z-.125], "EX-STRUCT")
        return
    if role in ["infeed-housing", "outfeed-housing", "infeed", "outfeed", "work-bed"] and y <= .5 and z >= .5:
        add([0, -.02, 0], [x, y-.04, z], "EX-FUNCTION")
        for i in range(4):
            add([-x/2+x*(i+.5)/4, y/2-.02, 0], [x/5, .04, z], "EX-STRUCT")
        return
    if base == "EX-PV":
        add([0, 0, 0], size, "EX-STRUCT")
        for i in range(8):
            for k in range(4):
                add([-x/2+x*(i+.5)/8, y/2-.015, -z/2+z*(k+.5)/4], [x/8-.015, .03, z/4-.015], "EX-PV")
        return
    if base in ["EX-SHELL", "EX-FUNCTION", "EX-HAZARD"] and x >= .5 and y >= .5 and z >= .5:
        # Recessed casing + raised hard panels/vents, no rounded generic housing.
        add([0, 0, -.015], [x, y, z-.03], "EX-STRUCT")
        for xx in [-x*.24, x*.24]:
            add([xx, 0, z/2-.03], [x*.46, y-.05, .06], "EX-SHELL")
        if role in ["service", "status-marker", "finite_material_storage"]:
            add([0, .06, z/2-.009], [x*.7, y*.36, .018], "EX-FUNCTION")
            for i in range(4):
                add([-x*.3+i*x*.2, .06, z/2-.003], [x*.07, y*.21, .006], "EX-STRUCT")
        return
    if z <= .25 and x >= .5 and y >= .5 and role in ["guard", "service", "status-marker"]:
        add([0, 0, -.01], [x, y, z-.02], "EX-STRUCT")
        for xx in [-x*.245, x*.245]:
            add([xx, 0, z/2-.012], [x*.47, y, .024], base)
        if role in ["service", "status-marker"]:
            add([0, 0, z/2-.005], [x*.65, y*.4, .01], "EX-FUNCTION")
            for i in range(3):
                add([-x*.18+i*x*.18, 0, z/2-.002], [x*.08, y*.22, .004], "EX-STRUCT")
        return
    # Preserve the useful original force paths and tools; introduce hard surface bands.
    add([0, 0, 0], size, base if base != "EX-HAZARD" else "EX-FUNCTION")
    if base == "EX-HAZARD":
        # Small inset physical warning plates, not a completely yellow machine/load.
        add([0, 0, z/2-.002], [x*.65, y*.25, .004], "EX-HAZARD")


def native_bounds(source):
    points = []
    for part in source["parts"]:
        for box in part["boxes"]:
            angle = box.get("rotationZRadians", 0)
            c, s = math.cos(angle), math.sin(angle)
            for x in [-1, 1]:
                for y in [-1, 1]:
                    for z in [-1, 1]:
                        xx, yy = x*box["sizeM"][0]/2, y*box["sizeM"][1]/2
                        points.append([box["centerM"][0]+c*xx-s*yy, box["centerM"][1]+s*xx+c*yy, box["centerM"][2]+z*box["sizeM"][2]/2])
    return {"min": [min(p[i] for p in points) for i in range(3)], "max": [max(p[i] for p in points) for i in range(3)]}


def build_blender(only_new=None):
    import bpy
    from hestia_asset_authoring import export_hestia_glb
    check_sources()
    PUBLIC.mkdir(parents=True, exist_ok=True)
    jobs = [json.loads(path.read_text()) for path in sorted(ART.glob("*/*/model-spec.json"))]
    if only_new is not None:
        baseline = json.loads(subprocess.check_output(["git", "show", BASE_ART_COMMIT + ":art/factory/play-2026-10-12/manifest.json"], cwd=ROOT))
        if only_new in {a["slug"] for a in baseline["assets"]}:
            raise ValueError("Only-new export cannot replace a baseline asset")
        jobs = [job for job in jobs if job["slug"] == only_new]
    if not jobs:
        raise ValueError("Run --snapshot before Blender authoring")
    for job in jobs:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.context.preferences.filepaths.save_version = 0
        scene = bpy.context.scene
        scene.unit_settings.system = "METRIC"
        scene.unit_settings.scale_length = 1
        collection = bpy.data.collections.new("hestia_play")
        scene.collection.children.link(collection)
        for key, value in {"hestia.schema_version": "hestia.asset-authoring.v1", "hestia.asset_id": job["assetId"], "hestia.asset_revision": 1, "hestia.representation_mode": "Decorative"}.items():
            collection[key] = value
        materials = {}
        for i, (name, hex_color) in enumerate(PALETTE.items()):
            mat = bpy.data.materials.new(name)
            srgb = [int(hex_color[k:k+2], 16)/255 for k in [0,2,4]]
            rgba = tuple(v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in srgb) + (1,)
            mat.diffuse_color = rgba
            mat.use_nodes = True
            bsdf = mat.node_tree.nodes.get("Principled BSDF")
            bsdf.inputs["Base Color"].default_value = rgba
            bsdf.inputs["Metallic"].default_value = .2
            bsdf.inputs["Roughness"].default_value = .86
            mat["hestia.render_material_id"] = "play_" + name.lower().replace("-", "_")
            mat["hestia.palette_index"] = i
            materials[name] = mat
        source = job["source"]
        for part in source["parts"]:
            geometry = Mesh()
            for box in part["boxes"]:
                decorate(geometry, box, part["role"], job["slug"], part["partId"])
            mesh = bpy.data.meshes.new(part["partId"] + "_geometry")
            mesh.from_pydata(geometry.vertices, [], geometry.faces)
            mesh.update()
            obj = bpy.data.objects.new(part["partId"], mesh)
            collection.objects.link(obj)
            for mat in materials.values():
                mesh.materials.append(mat)
            for polygon, name in zip(mesh.polygons, geometry.materials):
                polygon.material_index = list(materials).index(name)
                polygon.use_smooth = False
            props = {"hestia.part_id": part["partId"], "hestia.representation_mode": "Decorative", "hestia.render_material_id": materials[geometry.materials[0]]["hestia.render_material_id"],
                "hestia.destructible": False, "hestia.collision_policy": "None", "hestia.navigation_policy": "None", "hestia.thin_feature_policy": "DecorativeOnly", "hestia.declared_minimum_thickness_m": .004}
            for key, value in props.items():
                obj[key] = value
            # The exporter preserves this non-authority namespace next to canonical hestia extras.
            obj["playBinding"] = {"partId": part["partId"], "sourceSHA256": job["sourceFile"]["sha256"], "sourceAssetId": source["assetId"], "definitionId": source["definitionId"]}
        # Exact reference witnesses are separate and excluded from exported collection.
        witnesses = bpy.data.collections.new("native_reference_not_exported")
        scene.collection.children.link(witnesses)
        witnesses.hide_render = True
        for part in source["parts"]:
            for i, box in enumerate(part["boxes"]):
                helper = bpy.data.objects.new("native_box_" + part["partId"] + f"_{i}", None)
                witnesses.objects.link(helper)
                helper.empty_display_type = "CUBE"
                helper.empty_display_size = 1
                helper.location = (box["centerM"][0], -box["centerM"][2], box["centerM"][1])
                helper.scale = (box["sizeM"][0]/2, box["sizeM"][2]/2, box["sizeM"][1]/2)
                helper.rotation_euler[1] = -box.get("rotationZRadians", 0)
                helper["nativeBoxJson"] = json.dumps(box, sort_keys=True)
        for kind, references in [("port", source["ports"]), ("pivot", source["joints"]), ("support", source.get("supportPatchesM", []))]:
            for i, reference in enumerate(references):
                helper = bpy.data.objects.new(f"native_{kind}_{i}", None)
                witnesses.objects.link(helper)
                helper.empty_display_type = "ARROWS"
                point = reference.get("centerM", reference.get("pivotM", [0,0,0]))
                helper.location = (point[0], -point[2], point[1])
                helper["nativeReferenceJson"] = json.dumps(reference, sort_keys=True)
        scene["playProvenance"] = json.dumps({"sourceHead": SOURCE_HEAD, "sourceFile": job["sourceFile"], "sourceBlob": job["sourceBlob"], "sourceSnapshot": job["sourceSnapshot"], "generatorSHA256": sha(Path(__file__)), "nativeAuthority": "frozen source; model is visual-only", "visualVariant": job.get("visualVariant"), "blenderAxes": "+X east, +Y south, +Z up", "runtimeAxes": "+X east, +Y up, +Z north"}, sort_keys=True)
        directory = ART / job["family"] / job["slug"]
        blend = directory / (job["slug"] + ".blend")
        bpy.ops.wm.save_as_mainfile(filepath=str(blend), check_existing=False)
        # Real disk reopen, not merely an in-memory export with a save claim.
        bpy.ops.wm.open_mainfile(filepath=str(blend))
        if bpy.data.filepath != str(blend) or len(bpy.data.collections["hestia_play"].objects) != len(source["parts"]):
            raise ValueError("Reopened Blender source lost part identity")
        output = PUBLIC / (job["slug"] + ".glb")
        code = export_hestia_glb.main(["blender", "--", "--output", str(output), "--collection", "hestia_play", "--unapplied-scale", "error"])
        if code:
            raise ValueError(f"Exporter failed for {job['slug']}")
        write_json(directory / "provenance.json", {"schema": "hestia.play-model-provenance/v1", "sourceHead": SOURCE_HEAD, "sourceFile": job["sourceFile"], "sourceBlob": job["sourceBlob"], "sourceSnapshot": job["sourceSnapshot"], "generator": record(Path(__file__)), "nativeBlend": record(blend),
            "reopened": True, "runtimeGlb": record(output), "exporter": record(ROOT / "tools/blender/hestia_asset_authoring/export_hestia_glb.py"), "blenderVersion": bpy.app.version_string, "gltfExporterVersion": "4.3.47", "origin": "project-original hard cuboid modeling; no provider/remote textures", "license": "LicenseRef-Hestia-Project-Original", "assetToVoxelCompiler": "KNOWN_GAP_NOT_DELIVERED"})
        print("PLAY_SAVED_REOPENED_EXPORTED=" + job["slug"])
    manifest(only_new)


def glb_json(path):
    data = path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", data)
    if (magic, version, length) != (b"glTF", 2, len(data)):
        raise ValueError("Invalid GLB header")
    chunk_length, kind = struct.unpack_from("<II", data, 12)
    if kind != 0x4e4f534a:
        raise ValueError("Missing GLB JSON")
    return json.loads(data[20:20+chunk_length])


def manifest(only_new=None):
    check_sources()
    entries = []
    for path in sorted(ART.glob("*/*/model-spec.json")):
        job = json.loads(path.read_text())
        if only_new is not None and job["slug"] != only_new:
            continue
        source = job["source"]
        output = PUBLIC / (job["slug"] + ".glb")
        gltf = glb_json(output)
        nodes = gltf.get("nodes", [])
        result = validate_binding({"source": source, "sourceSHA256": job["sourceFile"]["sha256"], "definitionRef": job["definitionRef"], "nodes": nodes})
        if not result["valid"]:
            raise ValueError(f"GLB source binding rejected: {job['slug']} {result['errors']}")
        bounds = native_bounds(source)
        # Exported accessor positions are in the native runtime XYZ, all meshes have neutral nodes.
        for part, node in zip(sorted(source["parts"], key=lambda p:p["partId"]), sorted(nodes, key=lambda n:n["name"])):
            part_bounds = native_bounds({"parts": [part]})
            for primitive in gltf["meshes"][node["mesh"]]["primitives"]:
                accessor = gltf["accessors"][primitive["attributes"]["POSITION"]]
                if any(accessor["min"][i] < part_bounds["min"][i] - 1e-5 or accessor["max"][i] > part_bounds["max"][i] + 1e-5 for i in range(3)):
                    raise ValueError("GLB escaped exact native part bounds")
        report_path = output.with_name(output.stem + ".hestia-authoring-report.json")
        report = json.loads(report_path.read_text())
        if report["digests"]["glb_sha256"] != sha(output) or any(d["severity"] == "error" for d in report["payload"]["diagnostics"]):
            raise ValueError("Exporter report does not bind an eligible derivative")
        entry = {"assetId": job["assetId"], "family": job["family"], "slug": job["slug"], "definitionRef": job["definitionRef"] if job["visualOnlyAnchor"] is None else None, "visualOnlyAnchor": job["visualOnlyAnchor"],
            "sourceHead": SOURCE_HEAD, "sourceFile": job["sourceFile"], "sourceBlob": job["sourceBlob"], "sourceSnapshot": job["sourceSnapshot"], "units": "meters", "runtimeAxes": "right-handed +X east +Y up +Z north", "origin": "ground-center",
            "partIds": [p["partId"] for p in source["parts"]], "parentPartIds": {p["partId"]: None for p in source["parts"]}, "nativeBoundsM": bounds,
            "nativeReferences": {"snapshotPath": job["sourceSnapshot"]["path"], "boxes": "parts[].boxes", "ports": "ports", "pivots": "joints", "supports": "supportPatchesM", "serviceBounds": "serviceBoundsM", "geometryAuthority": "original frozen native source only"},
            "nativeBlend": record(path.parent / (job["slug"] + ".blend")), "runtimeGlb": {**record(output), "url": "/factory/play-2026-10-12/" + output.name}, "exporterReport": record(report_path), "provenance": record(path.parent / "provenance.json"),
            "license": {"id": "LicenseRef-Hestia-Project-Original", **record(ART / "LICENSE.txt")}, "nodeContract": "one neutral Mesh node per native part; merged detail geometry disappears with that part; extras.hestia.partId + extras.playBinding; absent parentPartId means null",
            "runtimeAdoption": "PENDING_INTEGRATOR", "ownerArtAcceptance": "OWNER_REVIEW_PENDING"}
        if "visualVariant" in job:
            entry["visualVariant"] = job["visualVariant"]
        entries.append(entry)
    document = {"schema": "hestia.factory.play-assets/v1", "sourceHead": SOURCE_HEAD, "assets": entries, "palette": PALETTE, "authority": "derived render meshes only; no collider/material/quantity/energy/save authority", "knownGaps": ["accepted Asset-to-Voxel/Structural-S1 bridge not delivered", "runtime adoption and confirmed animation are Integrator scope", "human Art/usability/hardware acceptance pending"]}
    if only_new is not None:
        document = json.loads((ART / "manifest.json").read_text())
        replacements = {entry["assetId"] for entry in entries}
        document["assets"] = [entry for entry in document["assets"] if entry["assetId"] not in replacements] + entries
        document["generatorReceipts"] = {"baseArtifactCommit": BASE_ART_COMMIT,
            "baseGeneratorSha256": "91978eb6b828bbee9b29e24551c65b22e088c5d97ac0e63e0e18c35ec0fcbde9",
            "correctionGenerator": record(Path(__file__)), "exportSelection": [only_new]}
    write_json(ART / "manifest.json", document)
    shutil.copyfile(ART / "manifest.json", PUBLIC / "manifest.json")
    print(f"Verified manifest: {len(document['assets'])} real saved/reopened GLBs; updated {len(entries)} entries")


if __name__ == "__main__":
    if "--validate-binding" in sys.argv:
        print(json.dumps(validate_binding(json.load(sys.stdin))))
    elif "--snapshot" in sys.argv:
        snapshot()
    elif "--snapshot-storage-open" in sys.argv:
        snapshot_storage_open()
    elif "--build-blender" in sys.argv:
        only_new = sys.argv[sys.argv.index("--only-new") + 1] if "--only-new" in sys.argv else None
        build_blender(only_new)
    elif "--manifest" in sys.argv:
        manifest()
    else:
        raise SystemExit("Use --snapshot, --build-blender, --manifest or --validate-binding")
