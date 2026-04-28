from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import bpy

try:
    import MaterialX as mx
except ImportError as exc:  # pragma: no cover - exercised inside Blender prerequisite checks.
    raise RuntimeError("Blender's bundled MaterialX Python module is required.") from exc


@dataclass
class MaterialImportResult:
    material: bpy.types.Material
    warnings: list[str] = field(default_factory=list)


def load_materialx_as_blender_material(mtlx_path: str) -> MaterialImportResult:
    document = mx.createDocument()
    _load_standard_libraries(document)
    mx.readFromXmlFile(document, mtlx_path)

    warnings: list[str] = []
    surface_node = _find_surface_shader(document)
    if surface_node is None:
        warnings.append("No supported standard_surface or gltf_pbr node found; using fallback material.")
        return MaterialImportResult(_create_fallback_material("MaterialX_Fallback"), warnings)

    material_name = _safe_name(surface_node.getName() or Path(mtlx_path).stem)
    material = bpy.data.materials.new(name=material_name)
    material.use_nodes = True
    principled = _get_principled_node(material)
    if principled is None:
        warnings.append("Unable to find Blender Principled BSDF node; using fallback material.")
        return MaterialImportResult(material, warnings)

    base_dir = Path(mtlx_path).resolve().parent
    _apply_surface_inputs(document, surface_node, material, principled, base_dir, warnings)
    return MaterialImportResult(material, warnings)


def _load_standard_libraries(document: Any) -> None:
    libraries = mx.createDocument()
    search_path = mx.getDefaultDataSearchPath()
    library_folders = mx.getDefaultDataLibraryFolders()
    mx.loadLibraries(library_folders, search_path, libraries)
    document.importLibrary(libraries)


def _find_surface_shader(document: Any) -> Any | None:
    material_nodes = _call_list(document, "getMaterialNodes")
    for material_node in material_nodes:
        surface_input = _get_input(material_node, "surfaceshader")
        if surface_input is None:
            continue
        surface_node = _connected_node(document, surface_input)
        if surface_node is not None and _category(surface_node) in {"standard_surface", "gltf_pbr"}:
            return surface_node

    for node in _call_list(document, "getNodes"):
        if _category(node) in {"standard_surface", "gltf_pbr"}:
            return node
    return None


def _apply_surface_inputs(
    document: Any,
    surface_node: Any,
    material: bpy.types.Material,
    principled: bpy.types.Node,
    base_dir: Path,
    warnings: list[str],
) -> None:
    category = _category(surface_node)
    if category == "standard_surface":
        scalar_inputs = {
            "metalness": "Metallic",
            "specular_roughness": "Roughness",
            "specular": "Specular IOR Level",
            "specular_ior": "IOR",
            "emission": "Emission Strength",
        }
        color_inputs = {
            "base_color": "Base Color",
            "emission_color": "Emission Color",
        }
    elif category == "gltf_pbr":
        scalar_inputs = {
            "metallic": "Metallic",
            "roughness": "Roughness",
        }
        color_inputs = {
            "base_color": "Base Color",
            "emissive": "Emission Color",
        }
    else:
        warnings.append(f"Unsupported surface shader category: {category}")
        return

    for input_name, socket_name in color_inputs.items():
        input_element = _get_input(surface_node, input_name)
        if input_element is None:
            continue
        if _try_link_image(document, input_element, material, principled, socket_name, base_dir, warnings):
            continue
        value = _input_value(input_element)
        if value is not None:
            _set_color_socket(principled, socket_name, _parse_color(value))
        elif _is_connected(input_element):
            warnings.append(f"Unsupported connected color input: {input_name}")

    for input_name, socket_name in scalar_inputs.items():
        input_element = _get_input(surface_node, input_name)
        if input_element is None:
            continue
        value = _input_value(input_element)
        if value is not None:
            _set_scalar_socket(principled, socket_name, _parse_float(value))
        elif _is_connected(input_element):
            warnings.append(f"Unsupported connected scalar input: {input_name}")

    opacity = _get_input(surface_node, "opacity")
    if opacity is not None:
        value = _input_value(opacity)
        if value is not None:
            alpha = _parse_color(value)[0]
            _set_scalar_socket(principled, "Alpha", alpha)
            material.blend_method = "BLEND"
            if hasattr(material, "use_screen_refraction"):
                material.use_screen_refraction = True
        elif _is_connected(opacity):
            warnings.append("Unsupported connected opacity input.")


def _try_link_image(
    document: Any,
    input_element: Any,
    material: bpy.types.Material,
    principled: bpy.types.Node,
    socket_name: str,
    base_dir: Path,
    warnings: list[str],
) -> bool:
    image_node = _resolve_image_node(document, input_element)
    if image_node is None:
        return False

    file_input = _get_input(image_node, "file")
    file_value = _input_value(file_input) if file_input is not None else None
    if not file_value:
        warnings.append(f"Image node {image_node.getName()} has no file input.")
        return False

    image_path = _resolve_asset_path(base_dir, str(file_value))
    if not image_path.exists():
        warnings.append(f"Image file not found for {socket_name}: {image_path}")
        return False

    try:
        image = bpy.data.images.load(str(image_path), check_existing=True)
    except RuntimeError as exc:
        warnings.append(f"Failed to load image for {socket_name}: {exc}")
        return False

    nodes = material.node_tree.nodes
    links = material.node_tree.links
    texture_node = nodes.new(type="ShaderNodeTexImage")
    texture_node.image = image
    texture_node.label = f"MaterialX {socket_name}"
    output_socket = texture_node.outputs.get("Color")
    input_socket = principled.inputs.get(socket_name)
    if output_socket is None or input_socket is None:
        warnings.append(f"Unable to connect image to Blender socket {socket_name}.")
        return False
    links.new(output_socket, input_socket)
    return True


def _resolve_image_node(document: Any, input_element: Any) -> Any | None:
    connected = _connected_node(document, input_element)
    if connected is not None and _category(connected) in {"image", "tiledimage"}:
        return connected

    nodegraph_name = _attribute(input_element, "nodegraph")
    output_name = _attribute(input_element, "output") or "out"
    if not nodegraph_name:
        return None

    nodegraph = document.getChild(nodegraph_name)
    if nodegraph is None:
        return None

    output = _get_output(nodegraph, output_name)
    if output is None:
        return None

    connected_output = _connected_node(document, output, scope=nodegraph)
    if connected_output is not None and _category(connected_output) in {"image", "tiledimage"}:
        return connected_output
    return None


def _connected_node(document: Any, input_element: Any, scope: Any | None = None) -> Any | None:
    node_name = _attribute(input_element, "nodename")
    if not node_name:
        return None
    parent = scope if scope is not None else document
    node = parent.getChild(node_name)
    if node is not None:
        return node
    return document.getChild(node_name)


def _get_principled_node(material: bpy.types.Material) -> bpy.types.Node | None:
    nodes = material.node_tree.nodes
    for node in nodes:
        if node.type == "BSDF_PRINCIPLED":
            return node
    return None


def _create_fallback_material(name: str) -> bpy.types.Material:
    material = bpy.data.materials.new(name=name)
    material.use_nodes = True
    principled = _get_principled_node(material)
    if principled is not None:
        _set_color_socket(principled, "Base Color", (1.0, 0.0, 1.0, 1.0))
        _set_scalar_socket(principled, "Roughness", 0.5)
    return material


def _get_input(node: Any, name: str) -> Any | None:
    try:
        return node.getInput(name)
    except AttributeError:
        for input_element in _call_list(node, "getInputs"):
            if input_element.getName() == name:
                return input_element
    return None


def _get_output(node: Any, name: str) -> Any | None:
    try:
        return node.getOutput(name)
    except AttributeError:
        for output_element in _call_list(node, "getOutputs"):
            if output_element.getName() == name:
                return output_element
    return None


def _input_value(input_element: Any | None) -> str | None:
    if input_element is None:
        return None
    value = _attribute(input_element, "value")
    if value is not None:
        return value
    try:
        value_string = input_element.getValueString()
    except Exception:
        return None
    return value_string if value_string else None


def _attribute(element: Any, name: str) -> str | None:
    try:
        value = element.getAttribute(name)
    except Exception:
        return None
    return value if value else None


def _category(element: Any) -> str:
    try:
        return element.getCategory()
    except Exception:
        return ""


def _call_list(element: Any, method_name: str) -> list[Any]:
    method = getattr(element, method_name, None)
    if method is None:
        return []
    try:
        return list(method())
    except Exception:
        return []


def _is_connected(input_element: Any) -> bool:
    return bool(_attribute(input_element, "nodename") or _attribute(input_element, "nodegraph"))


def _parse_float(value: Any) -> float:
    if isinstance(value, (float, int)):
        return float(value)
    try:
        return float(str(value).split(",")[0].strip())
    except ValueError:
        return 0.0


def _parse_color(value: Any) -> tuple[float, float, float, float]:
    if isinstance(value, (list, tuple)):
        pieces = [float(piece) for piece in value]
    else:
        pieces = [float(piece.strip()) for piece in str(value).split(",") if piece.strip()]
    if len(pieces) == 0:
        return (0.0, 0.0, 0.0, 1.0)
    if len(pieces) == 1:
        return (pieces[0], pieces[0], pieces[0], 1.0)
    if len(pieces) == 2:
        return (pieces[0], pieces[1], 0.0, 1.0)
    if len(pieces) == 3:
        return (pieces[0], pieces[1], pieces[2], 1.0)
    return (pieces[0], pieces[1], pieces[2], pieces[3])


def _set_color_socket(node: bpy.types.Node, socket_name: str, value: tuple[float, float, float, float]) -> None:
    socket = node.inputs.get(socket_name)
    if socket is not None:
        socket.default_value = value


def _set_scalar_socket(node: bpy.types.Node, socket_name: str, value: float) -> None:
    socket = node.inputs.get(socket_name)
    if socket is not None:
        socket.default_value = value


def _resolve_asset_path(base_dir: Path, value: str) -> Path:
    candidate = Path(value)
    if candidate.is_absolute():
        return candidate
    return (base_dir / candidate).resolve()


def _safe_name(value: str) -> str:
    return "".join(character if character.isalnum() or character in "_-" else "_" for character in value)
