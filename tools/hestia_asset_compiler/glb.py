"""Strict, bounded GLB2 subset. Report binding/compilation is deliberately later."""

from dataclasses import dataclass
import json
import math
from pathlib import Path
import struct

from tools.blender.hestia_asset_authoring.canonical import canonical_json_bytes, sha256_bytes
from tools.blender.hestia_asset_authoring import schema as vocabulary
from .errors import CompilerError
from .profiles import BUDGETS, check_budget


def fail(code, message):
    raise CompilerError(code, message)


def integer(value, minimum=0, maximum=2**53 - 1, code="glb.integer"):
    if type(value) is not int or not minimum <= value <= maximum:
        fail(code, "integer out of range")
    return value


def shape(value, allowed, required=(), code="glb.structure"):
    if not isinstance(value, dict) or set(value) - set(allowed) or set(required) - set(value):
        fail(code, "unsupported, missing, or malformed object fields")
    return value


def sequence(value, code="glb.structure"):
    if not isinstance(value, list):
        fail(code, "array required")
    return value


def finite_vector(value, size, code="glb.structure"):
    if not isinstance(value, list) or len(value) != size:
        fail(code, "wrong vector size")
    if any(type(x) not in (int, float) or not math.isfinite(x) for x in value):
        fail(code, "finite numeric vector required")
    return value


def strict_json(raw):
    check_budget("json_bytes", len(raw))
    depth = tokens = 0
    quoted = escaped = False
    for byte in raw:
        if quoted:
            if escaped:
                escaped = False
            elif byte == 92:
                escaped = True
            elif byte == 34:
                quoted = False
        elif byte == 34:
            quoted = True
        elif byte in (91, 123):
            depth += 1
            tokens += 1
            check_budget("json_depth", depth)
        elif byte in (93, 125):
            depth -= 1
            if depth < 0:
                fail("json.syntax", "unbalanced container")
        elif byte in (44, 58):
            tokens += 1
        if tokens > BUDGETS["json_tokens"]:
            check_budget("json_tokens", tokens)

    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                fail("json.duplicate-key", "duplicate object key")
            result[key] = value
        return result

    def number(text):
        value = float(text)
        if not math.isfinite(value):
            fail("json.number", "nonfinite JSON number")
        return value

    def whole(text):
        if len(text) > 17:
            fail("json.number", "unsafe JSON integer")
        return integer(int(text), -(2**53 - 1), code="json.number")

    try:
        text = raw.decode("utf-8", errors="strict")
        return json.loads(text, object_pairs_hook=pairs, parse_float=number, parse_int=whole,
                          parse_constant=lambda _: fail("json.number", "nonstandard number"))
    except (UnicodeError, json.JSONDecodeError, RecursionError) as exc:
        raise CompilerError("json.syntax", "invalid UTF-8 JSON") from exc


def bounded_read(path, budget):
    with Path(path).open("rb") as stream:
        check_budget(budget, stream.seek(0, 2))
        stream.seek(0)
        raw = stream.read(BUDGETS[budget] + 1)
    check_budget(budget, len(raw))
    return raw


def read_report(path):
    raw = bounded_read(path, "report_bytes")
    return strict_json(raw), sha256_bytes(raw)


def load_glb(path):
    return read_glb(bounded_read(path, "glb_bytes"))


@dataclass(frozen=True)
class Primitive:
    positions: tuple
    indices: tuple
    material_id: str


@dataclass(frozen=True)
class GLB:
    document: dict
    primitives: tuple
    reachable: tuple
    parents: tuple
    semantics: dict
    source_sha256: str


def semantic(value, kind):
    """Validate raw transport fields before canonicalization (never strip unknowns)."""
    code = "glb.semantics"
    fields = {
        "asset": ("assetId assetRevision representation metersPerUnit coordinateFrame", "defaultStructuralMaterialId tags schema"),
        "part": ("partId representation destructible collisionPolicy navigationPolicy thinFeature", "parentPartId defaultRenderMaterialId structuralMaterialId shell tags kind"),
        "joint": ("jointId parentPartId childPartId jointType breakPolicy", "breakForceNewtons breakTorqueNewtonMeters tags kind"),
        "marker": ("markerId markerType", "partId interfaceId tags kind"),
        "material": ("renderMaterialId", "structuralMaterialId paletteIndex tags"),
    }
    required, optional = fields[kind]
    shape(value, (required + " " + optional).split(), required.split(), code)
    for key, item in value.items():
        if key.endswith("Id") and not vocabulary.is_valid_id(item):
            fail(code, "invalid stable ID")
    if "tags" in value:
        tags = sequence(value["tags"], code)
        if any(not vocabulary.is_valid_id(x) for x in tags) or len(set(tags)) != len(tags):
            fail(code, "invalid or duplicate tags")
    for field, choices in [("representation", vocabulary.REPRESENTATION_MODES), ("collisionPolicy", vocabulary.COLLISION_POLICIES),
                           ("navigationPolicy", vocabulary.NAVIGATION_POLICIES), ("jointType", vocabulary.JOINT_TYPES),
                           ("breakPolicy", vocabulary.BREAK_POLICIES), ("markerType", vocabulary.MARKER_TYPES)]:
        if field in value and value[field] not in choices:
            fail(code, "invalid semantic enum")
    if kind == "asset":
        if value.get("schema") != vocabulary.SCHEMA_ID or type(value["metersPerUnit"]) not in (int, float) or value["metersPerUnit"] != 1:
            fail(code, "unsupported authoring schema or units")
        integer(value["assetRevision"], 0, 2147483647, code)
        if value["coordinateFrame"] != {"upAxis": "+Y", "forwardAxis": "+Z", "handedness": "RIGHT"}:
            fail(code, "unsupported coordinate frame")
    elif kind == "part":
        if type(value["destructible"]) is not bool:
            fail(code, "destructible must be boolean")
        thin = shape(value["thinFeature"], ["policy", "declaredMinimumThicknessMeters"], ["policy", "declaredMinimumThicknessMeters"], code)
        if thin["policy"] not in vocabulary.THIN_FEATURE_POLICIES:
            fail(code, "invalid thin policy")
        positive(thin["declaredMinimumThicknessMeters"], code)
        if value["representation"] in ("Shell", "LayeredShell") and "shell" not in value:
            fail(code, "shell data required")
        if "shell" in value:
            shell = shape(value["shell"], ["thicknessMeters", "layers"], ["thicknessMeters", "layers"], code)
            positive(shell["thicknessMeters"], code)
            if not sequence(shell["layers"], code):
                fail(code, "empty shell layers")
            for layer in shell["layers"]:
                shape(layer, ["structuralMaterialId", "thicknessMeters"], ["structuralMaterialId", "thicknessMeters"], code)
                if not vocabulary.is_valid_id(layer["structuralMaterialId"]):
                    fail(code, "invalid layer material ID")
                positive(layer["thicknessMeters"], code)
        if value["representation"] == "Decorative" and (value["destructible"] or value["collisionPolicy"] not in ("None", "AuthoredMesh")):
            fail(code, "invalid Decorative policy")
    elif kind == "joint":
        for field in ("breakForceNewtons", "breakTorqueNewtonMeters"):
            if field in value:
                positive(value[field], code)
        if value["breakPolicy"] == "Threshold" and not ({"breakForceNewtons", "breakTorqueNewtonMeters"} & set(value)):
            fail(code, "threshold value required")
    elif kind == "marker":
        if (value["markerType"] == "CutInterface") != ("interfaceId" in value):
            fail(code, "interfaceId required only for CutInterface")
    elif "paletteIndex" in value:
        integer(value["paletteIndex"], 0, 65535, code)
    return {key: item for key, item in value.items() if key not in ("kind", "schema")}


def positive(value, code):
    if type(value) not in (int, float) or not math.isfinite(value) or value <= 0:
        fail(code, "positive finite number required")


def extras(obj):
    value = obj.get("extras", {})
    if not isinstance(value, dict):
        fail("glb.semantics", "object extras required")
    if "hestia" in value and not isinstance(value["hestia"], dict):
        fail("glb.semantics", "authored extras must be an object")
    return value.get("hestia")


def graph(doc):
    nodes = sequence(doc.get("nodes", []))
    check_budget("nodes", len(nodes))
    parents = [-1] * len(nodes)
    edges = 0
    for i, node in enumerate(nodes):
        shape(node, "name extras extensions children mesh matrix translation rotation scale skin camera weights".split())
        if any(field in node for field in ("skin", "camera", "weights")):
            fail("glb.unsupported", "unsupported node feature")
        children = sequence(node.get("children", []), "glb.graph")
        edges += len(children)
        check_budget("edges", edges)
        for child in children:
            integer(child, 0, len(nodes) - 1, "glb.graph")
            if parents[child] != -1:
                fail("glb.graph", "duplicate child or multiple parents")
            parents[child] = i
    # Validate even disconnected nodes; no recursive walk or expansion before limits.
    finished = set()
    for start in range(len(nodes)):
        trail = set()
        current = start
        while current != -1 and current not in finished:
            if current in trail:
                fail("glb.graph", "node cycle")
            trail.add(current)
            current = parents[current]
        finished.update(trail)
        depth = 0
        current = start
        while current != -1:
            depth += 1
            check_budget("graph_depth", depth)
            current = parents[current]
    scenes = sequence(doc.get("scenes", []), "glb.graph")
    if len(scenes) != 1:
        fail("glb.graph", "exactly one explicit scene required")
    integer(doc.get("scene", 0), 0, 0, "glb.graph")
    shape(scenes[0], ["name", "extras", "nodes"], ["nodes"], "glb.graph")
    roots = sequence(scenes[0]["nodes"], "glb.graph")
    seen = set()
    stack = []
    for root in roots:
        integer(root, 0, len(nodes) - 1, "glb.graph")
        if root in seen or parents[root] != -1:
            fail("glb.graph", "duplicate or parented root")
        seen.add(root)
        stack.append(root)
    order = []
    while stack:
        node = stack.pop()
        order.append(node)
        stack.extend(reversed(nodes[node].get("children", [])))
    return tuple(order), tuple(parents)


def render_data(doc):
    views = doc.get("bufferViews", [])
    images = sequence(doc.get("images", []))
    textures = sequence(doc.get("textures", []))
    samplers = sequence(doc.get("samplers", []))
    for image in images:
        shape(image, ["name", "extras", "bufferView", "mimeType", "uri"])
        if "uri" in image:
            fail("glb.unsupported", "image URI forbidden")
        integer(image.get("bufferView"), 0, len(views) - 1, "glb.render")
        if image.get("mimeType") not in ("image/png", "image/jpeg"):
            fail("glb.render", "unsupported embedded image type")
    for sampler in samplers:
        shape(sampler, "name extras magFilter minFilter wrapS wrapT".split())
        for field, choices in [("magFilter", (9728, 9729)), ("minFilter", (9728, 9729, 9984, 9985, 9986, 9987)),
                               ("wrapS", (33071, 33648, 10497)), ("wrapT", (33071, 33648, 10497))]:
            if field in sampler and (type(sampler[field]) is not int or sampler[field] not in choices):
                fail("glb.render", "invalid sampler")
    for texture in textures:
        shape(texture, ["name", "extras", "source", "sampler"], ["source"])
        integer(texture["source"], 0, len(images) - 1, "glb.render")
        if "sampler" in texture:
            integer(texture["sampler"], 0, len(samplers) - 1, "glb.render")

    def texture_info(value, extra=None):
        shape(value, ["index", "texCoord"] + ([extra] if extra else []), ["index"], "glb.render")
        integer(value["index"], 0, len(textures) - 1, "glb.render")
        integer(value.get("texCoord", 0), 0, 1, "glb.render")
        if extra in value and (type(value[extra]) not in (int, float) or not math.isfinite(value[extra])):
            fail("glb.render", "invalid texture scale")

    materials = sequence(doc.get("materials", []))
    check_budget("materials", len(materials))
    semantics = []
    for material in materials:
        shape(material, "name extras extensions pbrMetallicRoughness normalTexture occlusionTexture emissiveTexture emissiveFactor alphaMode alphaCutoff doubleSided".split())
        semantics.append(semantic(extras(material), "material"))
        pbr = shape(material.get("pbrMetallicRoughness", {}), "baseColorFactor metallicFactor roughnessFactor baseColorTexture metallicRoughnessTexture".split())
        if "baseColorFactor" in pbr:
            finite_vector(pbr["baseColorFactor"], 4, "glb.render")
            if any(not 0 <= x <= 1 for x in pbr["baseColorFactor"]):
                fail("glb.render", "base color range")
        for field in ("metallicFactor", "roughnessFactor"):
            if field in pbr and (type(pbr[field]) not in (int, float) or not 0 <= pbr[field] <= 1):
                fail("glb.render", "PBR factor range")
        for field in ("baseColorTexture", "metallicRoughnessTexture"):
            if field in pbr:
                texture_info(pbr[field])
        for field, extra in [("normalTexture", "scale"), ("occlusionTexture", "strength"), ("emissiveTexture", None)]:
            if field in material:
                texture_info(material[field], extra)
        if "emissiveFactor" in material:
            finite_vector(material["emissiveFactor"], 3, "glb.render")
        if material.get("alphaMode", "OPAQUE") not in ("OPAQUE", "MASK", "BLEND"):
            fail("glb.render", "alpha mode")
        if "alphaCutoff" in material:
            positive(material["alphaCutoff"], "glb.render")
        if "doubleSided" in material and type(material["doubleSided"]) is not bool:
            fail("glb.render", "doubleSided must be boolean")
        ext = material.get("extensions", {})
        for name, value in ext.items():
            if name == "KHR_materials_unlit":
                shape(value, [], code="glb.render")
            else:
                shape(value, ["emissiveStrength"], ["emissiveStrength"], "glb.render")
                positive(value["emissiveStrength"], "glb.render")
    return semantics


def references(semantics):
    code = "glb.semantics"
    maps = {}
    for collection, key in [("parts", "partId"), ("joints", "jointId"), ("markers", "markerId"), ("materials", "renderMaterialId")]:
        items = semantics[collection]
        maps[collection] = {item[key]: item for item in items}
        if len(maps[collection]) != len(items):
            fail(code, "duplicate semantic ID")
    structural = [item["structuralMaterialId"] for item in semantics["materials"] if "structuralMaterialId" in item]

    def ref(item, key, targets):
        if key in item and list(targets).count(item[key]) != 1:
            fail(code, "reference must resolve exactly once")

    ref(semantics["asset"], "defaultStructuralMaterialId", structural)
    for item in semantics["parts"]:
        ref(item, "parentPartId", maps["parts"])
        ref(item, "defaultRenderMaterialId", maps["materials"])
        ref(item, "structuralMaterialId", structural)
        for layer in item.get("shell", {}).get("layers", []):
            ref(layer, "structuralMaterialId", structural)
        trail = set()
        current = item
        while "parentPartId" in current:
            if current["partId"] in trail:
                fail(code, "part parent cycle")
            trail.add(current["partId"])
            current = maps["parts"][current["parentPartId"]]
    for item in semantics["joints"]:
        ref(item, "parentPartId", maps["parts"])
        ref(item, "childPartId", maps["parts"])
    for item in semantics["markers"]:
        ref(item, "partId", maps["parts"])


def read_glb(raw):
    try:
        return _read_glb(raw)
    except (TypeError, KeyError, IndexError, struct.error, OverflowError) as exc:
        raise CompilerError("glb.structure", "malformed GLB structure") from exc


def _read_glb(raw):
    check_budget("glb_bytes", len(raw))
    if len(raw) < 12 or struct.unpack_from("<4sII", raw) != (b"glTF", 2, len(raw)) or len(raw) % 4:
        fail("glb.container", "invalid GLB2 header")
    chunks = []
    offset = 12
    for expected in (0x4E4F534A, 0x004E4942):
        if offset + 8 > len(raw):
            fail("glb.container", "missing chunk")
        length, kind = struct.unpack_from("<II", raw, offset)
        if kind != expected or length % 4 or offset + 8 + length > len(raw):
            fail("glb.container", "invalid chunk order, alignment, or length")
        if expected == 0x4E4F534A:
            check_budget("json_bytes", length)
        chunks.append(memoryview(raw)[offset + 8:offset + 8 + length])
        offset += 8 + length
    if offset != len(raw):
        fail("glb.container", "extra chunk or trailing bytes")
    doc = strict_json(bytes(chunks[0]))
    shape(doc, "asset scene scenes nodes meshes buffers bufferViews accessors materials images textures samplers extensionsUsed extensionsRequired extras animations skins".split(), ["asset", "buffers"])
    shape(doc["asset"], ["version", "minVersion", "generator", "copyright", "extras"], ["version"])
    if doc["asset"]["version"] != "2.0" or doc["asset"].get("minVersion", "2.0") != "2.0":
        fail("glb.unsupported", "unsupported glTF version")
    allowed = {"KHR_materials_unlit", "KHR_materials_emissive_strength"}
    for field in ("extensionsUsed", "extensionsRequired"):
        names = sequence(doc.get(field, []))
        if any(not isinstance(x, str) or x not in allowed for x in names):
            fail("glb.unsupported", "unsupported extension")
    if "animations" in doc or "skins" in doc:
        fail("glb.unsupported", "animation/skin unsupported")
    stack = [doc]
    while stack:
        value = stack.pop()
        if isinstance(value, dict):
            if "extensions" in value:
                ext = value["extensions"]
                if not isinstance(ext, dict) or set(ext) - allowed or not any(value is material for material in doc.get("materials", [])):
                    fail("glb.unsupported", "unsupported extension location")
            stack.extend(value.values())
        elif isinstance(value, list):
            stack.extend(value)
    binary = chunks[1]
    buffers = sequence(doc["buffers"])
    if len(buffers) != 1:
        fail("glb.buffer", "one internal buffer required")
    if "uri" in buffers[0]:
        fail("glb.unsupported", "buffer URI forbidden")
    shape(buffers[0], ["byteLength", "name", "extras"], ["byteLength"], "glb.buffer")
    declared = integer(buffers[0]["byteLength"], 1, len(binary), "glb.buffer")
    if not 0 <= len(binary) - declared <= 3 or any(binary[declared:]):
        fail("glb.buffer", "invalid BIN alignment slack")
    views = sequence(doc.get("bufferViews", []))
    check_budget("buffer_views", len(views))
    for view in views:
        shape(view, "buffer byteOffset byteLength byteStride target name extras".split(), ["buffer", "byteLength"], "glb.buffer-view")
        integer(view["buffer"], 0, 0, "glb.buffer-view")
        start = integer(view.get("byteOffset", 0), 0, declared, "glb.buffer-view")
        length = integer(view["byteLength"], 1, declared, "glb.buffer-view")
        if start + length > declared:
            fail("glb.buffer-view", "view exceeds declared buffer (padding excluded)")
        if "target" in view and (type(view["target"]) is not int or view["target"] not in (34962, 34963)):
            fail("glb.buffer-view", "invalid target")
    accessors = sequence(doc.get("accessors", []))
    check_budget("accessors", len(accessors))
    layouts = []
    decoded_bytes = 0
    formats = {5121: ("B", 1), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
    widths = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}
    for acc in accessors:
        if "sparse" in acc:
            fail("glb.unsupported", "sparse accessors unsupported")
        shape(acc, "bufferView byteOffset componentType normalized count type min max name extras".split(), ["bufferView", "componentType", "count", "type"], "glb.accessor")
        view = views[integer(acc["bufferView"], 0, len(views) - 1, "glb.accessor")]
        component = integer(acc["componentType"], code="glb.accessor")
        if component not in formats or not isinstance(acc["type"], str) or acc["type"] not in widths:
            fail("glb.accessor", "unsupported accessor type")
        count = integer(acc["count"], 1, code="glb.accessor")
        check_budget("accessor_elements", count)
        fmt, size = formats[component]
        width = widths[acc["type"]]
        element = size * width
        stride = integer(view.get("byteStride", element), element, 252, "glb.accessor")
        start = integer(acc.get("byteOffset", 0), code="glb.accessor")
        absolute = view.get("byteOffset", 0) + start
        if stride % size or start % size or absolute % size or start + (count - 1) * stride + element > view["byteLength"]:
            fail("glb.accessor", "unaligned or out-of-view last access")
        if "byteStride" in view and (stride % 4 or stride < 4):
            fail("glb.accessor", "invalid vertex stride")
        if "normalized" in acc and type(acc["normalized"]) is not bool:
            fail("glb.accessor", "normalized must be boolean")
        for field in ("min", "max"):
            if field in acc:
                finite_vector(acc[field], width, "glb.accessor")
        decoded_bytes += count * width * 8
        check_budget("decoded_bytes", decoded_bytes)
        layouts.append((absolute, stride, count, "<" + fmt * width))
    reachable, parents = graph(doc)
    materials = render_data(doc)
    semantics = {"schema": vocabulary.SCHEMA_ID, "asset": semantic(extras(doc["asset"]), "asset"), "parts": [], "joints": [], "markers": [], "materials": materials}
    for index in reachable:
        node = doc["nodes"][index]
        authored = extras(node)
        if authored is not None:
            if not isinstance(authored, dict) or authored.get("kind") not in ("part", "joint", "marker"):
                fail("glb.semantics", "unknown authored node kind")
            kind = authored["kind"]
            semantics[{"part": "parts", "joint": "joints", "marker": "markers"}[kind]].append(semantic(authored, kind))
        if "mesh" in node and (not isinstance(authored, dict) or authored.get("kind") != "part"):
            fail("glb.semantics", "reachable mesh has no exact authored Part")
    references(semantics)
    meshes = sequence(doc.get("meshes", []))
    check_budget("meshes", len(meshes))
    for node in doc.get("nodes", []):
        if "mesh" in node:
            integer(node["mesh"], 0, len(meshes) - 1, "glb.structure")
    primitive_count = 0
    primitive_index_bytes = 0
    for mesh in meshes:
        shape(mesh, ["name", "extras", "primitives", "weights"], ["primitives"])
        if "weights" in mesh:
            fail("glb.unsupported", "morph weights unsupported")
        prims = sequence(mesh["primitives"])
        if not prims:
            fail("glb.structure", "empty mesh")
        primitive_count += len(prims)
        check_budget("primitives", primitive_count)
        for prim in prims:
            shape(prim, ["attributes", "indices", "material", "mode", "targets", "extensions", "extras"], ["attributes", "material"])
            shape(prim["attributes"], ["POSITION", "NORMAL", "TANGENT", "TEXCOORD_0", "TEXCOORD_1", "COLOR_0"], ["POSITION"], "glb.unsupported")
            index_source = prim.get("indices", prim["attributes"]["POSITION"])
            primitive_index_bytes += accessors[integer(index_source, 0, len(accessors) - 1, "glb.accessor")]["count"] * 8
            # Stored flat indices are per primitive, even for unreachable meshes/shared accessors.
            check_budget("decoded_bytes", decoded_bytes + primitive_index_bytes)
    expanded = 0
    for index in reachable:
        node = doc["nodes"][index]
        if "mesh" in node:
            for primitive in meshes[node["mesh"]]["primitives"]:
                attributes = primitive.get("attributes", {})
                accessor = primitive.get("indices", attributes.get("POSITION"))
                integer(accessor, 0, len(accessors) - 1, "glb.accessor")
                expanded += accessors[accessor]["count"] // 3
                check_budget("instance_triangles", expanded)
    cache = {}

    def decode(index, width, components, normalized=False):
        integer(index, 0, len(accessors) - 1, "glb.accessor")
        acc = accessors[index]
        if widths[acc["type"]] != width or acc["componentType"] not in components or acc.get("normalized", False) != normalized:
            fail("glb.accessor", "wrong attribute/index encoding")
        if index not in cache:
            start, stride, count, fmt = layouts[index]
            result = tuple(struct.unpack_from(fmt, binary, start + i * stride) for i in range(count))
            if any(not math.isfinite(x) for row in result for x in row):
                fail("glb.nonfinite", "nonfinite accessor data")
            cache[index] = result
        return cache[index]

    primitives = []
    for mesh in meshes:
        result = []
        for prim in sequence(mesh["primitives"]):
            if "targets" in prim or type(prim.get("mode", 4)) is not int or prim.get("mode", 4) != 4:
                fail("glb.unsupported", "only TRIANGLES without morph targets supported")
            attrs = shape(prim["attributes"], ["POSITION", "NORMAL", "TANGENT", "TEXCOORD_0", "TEXCOORD_1", "COLOR_0"], ["POSITION"], "glb.unsupported")
            positions = decode(attrs["POSITION"], 3, (5126,))
            pos_start, pos_stride, _, _ = layouts[attrs["POSITION"]]
            if pos_start % 4 or pos_stride % 4:
                fail("glb.accessor", "vertex alignment")
            for name, index in attrs.items():
                if name == "POSITION":
                    continue
                width = {"NORMAL": 3, "TANGENT": 4, "TEXCOORD_0": 2, "TEXCOORD_1": 2}.get(name, widths[accessors[integer(index, 0, len(accessors) - 1, "glb.accessor")]["type"]])
                if name == "COLOR_0" and width not in (3, 4):
                    fail("glb.accessor", "color width")
                component = accessors[index]["componentType"]
                components = (5126,) if name in ("NORMAL", "TANGENT") else (5121, 5123, 5126)
                data = decode(index, width, components, normalized=component != 5126)
                if len(data) != len(positions):
                    fail("glb.accessor", "attribute counts disagree")
            material = materials[integer(prim["material"], 0, len(materials) - 1, "glb.semantics")]["renderMaterialId"]
            if "indices" in prim:
                acc = accessors[integer(prim["indices"], 0, len(accessors) - 1, "glb.accessor")]
                view = views[acc["bufferView"]]
                if "byteStride" in view:
                    fail("glb.accessor", "index buffer must not have stride")
                indices = tuple(row[0] for row in decode(prim["indices"], 1, (5121, 5123, 5125)))
                sentinel = {5121: 255, 5123: 65535, 5125: 4294967295}[acc["componentType"]]
                if any(i == sentinel or i >= len(positions) for i in indices):
                    fail("glb.indices", "sentinel or out-of-range index")
            else:
                indices = tuple(range(len(positions)))
            if len(indices) == 0 or len(indices) % 3:
                fail("glb.indices", "triangle index count")
            result.append(Primitive(positions, indices, material))
        primitives.append(tuple(result))
    for index in reachable:
        node = doc["nodes"][index]
        authored = extras(node)
        if authored and authored.get("kind") == "part" and "defaultRenderMaterialId" in authored and "mesh" in node:
            if authored["defaultRenderMaterialId"] not in {p.material_id for p in primitives[node["mesh"]]}:
                fail("glb.semantics", "default render material not used by part")
    # Existing pure helper is reused read-only; report digests are NOT admitted here.
    canonical_json_bytes(semantics)
    return GLB(doc, tuple(primitives), reachable, parents, semantics, sha256_bytes(raw))
