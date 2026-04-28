from __future__ import annotations

from typing import Any

import bpy

from ..blender_nodes import constant_socket, input_socket, math_socket
from ..types import CompileContext, CompiledSocket


def register(registry) -> None:
    registry.register_many({"texcoord", "position", "normal"}, compile_geometry)
    registry.register("frame", compile_frame)
    registry.register("time", compile_time)


def compile_geometry(context: CompileContext, node: Any, output_name: str, scope: Any | None) -> CompiledSocket | None:
    return compile_geometry_category(context, node.getCategory())


def compile_geometry_category(context: CompileContext, category: str) -> CompiledSocket | None:
    nodes = context.material.node_tree.nodes
    if category == "texcoord":
        node = nodes.new(type="ShaderNodeTexCoord")
        socket = node.outputs.get("UV")
        return CompiledSocket(socket, "vector2") if socket is not None else None
    if category == "normal":
        node = nodes.new(type="ShaderNodeNewGeometry")
        socket = node.outputs.get("Normal")
        return CompiledSocket(socket, "vector3") if socket is not None else None
    node = nodes.new(type="ShaderNodeNewGeometry")
    socket = node.outputs.get("Position")
    return CompiledSocket(socket, "vector3") if socket is not None else None


def compile_frame(context: CompileContext, node: Any, output_name: str, scope: Any | None) -> CompiledSocket | None:
    return constant_socket(context, float(bpy.context.scene.frame_current), "float")


def compile_time(context: CompileContext, node: Any, output_name: str, scope: Any | None) -> CompiledSocket | None:
    frame_offset = constant_socket(context, float(bpy.context.scene.frame_current - 1), "float")
    fps = input_socket(context, node, "fps", 24.0, scope)
    return CompiledSocket(math_socket(context, "DIVIDE", frame_offset.socket, fps.socket), "float")
