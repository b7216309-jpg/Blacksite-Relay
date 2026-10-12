"""Editable, foot-anchored pixel operator planes for the Blacksite projection.

Metadata is shared with the runtime atlas. Frames may be a name->rect object or a
list containing {name,x,y,w,h,anchor:[x,y]}. Anchor values in0..1 are normalized;
larger values are source pixels. No image pixels are generated or modified here.
"""
import bpy
import json
import math
from pathlib import Path


def read_operator(path):
    path = Path(path).resolve()
    data = json.loads(path.read_text(encoding='utf-8'))
    atlas = data.get('image') or data.get('atlas') or data.get('texture')
    if isinstance(atlas, dict):
        atlas = atlas.get('image') or atlas.get('path')
    if not isinstance(atlas, str):
        raise ValueError('Operator metadata needs a local atlas image path.')
    image_path = (path.parent / atlas).resolve()
    if not image_path.is_file():
        image_path = (Path(__file__).resolve().parents[2] / atlas).resolve()
    if not image_path.is_file():
        raise FileNotFoundError('Operator atlas was not found: ' + str(image_path))
    source = data.get('frames') or data.get('poses')
    frames = []
    pairs = source.items() if isinstance(source, dict) else enumerate(source or [])
    for key, item in pairs:
        if isinstance(item, (list, tuple)):
            item = dict(zip(['x', 'y', 'w', 'h'], item))
        rect = item.get('frame') or item.get('rect') or item
        if isinstance(rect, (list, tuple)):
            rect = dict(zip(['x', 'y', 'w', 'h'], rect))
        frame = {field: int(rect.get(field, rect.get({'w': 'width', 'h': 'height'}.get(field, field), 0))) for field in ['x', 'y', 'w', 'h']}
        if frame['w'] <= 0 or frame['h'] <= 0:
            raise ValueError('Operator frames must have positive dimensions.')
        frame['name'] = str(item.get('name', key))
        frame['anchor'] = item.get('anchor') or item.get('pivot') or ([item['pivotX'], item['pivotY']] if 'pivotX' in item and 'pivotY' in item else None) or data.get('anchor') or [.5, 1]
        frames.append(frame)
    if not frames:
        raise ValueError('Operator metadata contains no frames.')
    return data, image_path, frames


def add_operator(scene, metadata_path, xy, mesh, translucent, fps=24):
    data, image_path, frames = read_operator(metadata_path)
    atlas = bpy.data.images.load(str(image_path), check_existing=True)
    atlas.alpha_mode = 'STRAIGHT'
    atlas.pack()
    width, height = atlas.size
    for frame in frames:
        if frame['x'] < 0 or frame['y'] < 0 or frame['x'] + frame['w'] > width or frame['y'] + frame['h'] > height:
            raise ValueError('Operator crop exceeds the atlas bounds.')
    placement = data.get('world') or data.get('placement') or {}
    foot = placement.get('foot') or data.get('foot') or [placement.get('footX', 560), placement.get('footY', 710)]
    if isinstance(foot, dict):
        foot = [foot['x'], foot['y']]
    reference_width = max(frame['w'] for frame in frames)
    reference_height = max(frame['h'] for frame in frames)
    scale_x = float(data['scale']) if 'scale' in data else placement.get('width', 115) / reference_width
    scale_y = float(data['scale']) if 'scale' in data else placement.get('height', 210) / reference_height
    z = float(placement.get('depth', .038))
    pixel_unit = xy((1, 0))[0] - xy((0, 0))[0]
    tint = data.get('tint') or [.88, .96, .90]

    material = bpy.data.materials.new('OPERATOR / nearest atlas / binary alpha / room tint')
    material.use_nodes = True
    try:
        material.surface_render_method = 'DITHERED'
    except AttributeError:
        material.blend_method = 'CLIP'
        material.alpha_threshold = .5
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    texture = nodes.new('ShaderNodeTexImage')
    texture.name = 'Operator atlas sampler'
    texture.image = atlas
    texture.interpolation = 'Closest'
    texture.extension = 'CLIP'
    color = nodes.new('ShaderNodeMixRGB')
    color.blend_type = 'MULTIPLY'
    color.inputs[0].default_value = 1
    color.inputs[2].default_value = (*tint[:3], 1)
    light = nodes.new('ShaderNodeEmission')
    light.inputs['Strength'].default_value = 1
    threshold = nodes.new('ShaderNodeMath')
    threshold.operation = 'GREATER_THAN'
    threshold.inputs[1].default_value = float(data.get('alphaCutoff', .5))
    transparent = nodes.new('ShaderNodeBsdfTransparent')
    mix = nodes.new('ShaderNodeMixShader')
    links = material.node_tree.links
    links.new(texture.outputs['Color'], color.inputs[1])
    links.new(color.outputs[0], light.inputs['Color'])
    links.new(texture.outputs['Alpha'], threshold.inputs[0])
    matte = data.get('matte') or {}
    if matte.get('method') == 'minimum-channel':
        # Texture RGB is scene-linear in Blender. Convert the supplied sRGB
        # threshold; a monotonic transform preserves the minimum-channel test.
        cutoff = float(matte.get('threshold', 190)) / 255
        linear_cutoff = cutoff / 12.92 if cutoff <= .04045 else ((cutoff + .055) / 1.055) ** 2.4
        channels = nodes.new('ShaderNodeSeparateColor')
        channels.mode = 'RGB'
        minimum_rg = nodes.new('ShaderNodeMath'); minimum_rg.operation = 'MINIMUM'
        minimum_rgb = nodes.new('ShaderNodeMath'); minimum_rgb.operation = 'MINIMUM'
        keep = nodes.new('ShaderNodeMath'); keep.operation = 'LESS_THAN'; keep.inputs[1].default_value = linear_cutoff
        mask = nodes.new('ShaderNodeMath'); mask.operation = 'MULTIPLY'
        links.new(texture.outputs['Color'], channels.inputs[0])
        links.new(channels.outputs[0], minimum_rg.inputs[0]); links.new(channels.outputs[1], minimum_rg.inputs[1])
        links.new(minimum_rg.outputs[0], minimum_rgb.inputs[0]); links.new(channels.outputs[2], minimum_rgb.inputs[1])
        links.new(minimum_rgb.outputs[0], keep.inputs[0])
        links.new(keep.outputs[0], mask.inputs[0]); links.new(texture.outputs['Alpha'], mask.inputs[1])
        links.new(mask.outputs[0], threshold.inputs[0])
    links.new(threshold.outputs[0], mix.inputs[0])
    links.new(transparent.outputs[0], mix.inputs[1])
    links.new(light.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs['Surface'])

    # This shadow is a floor contact shape, rather than a floating sprite drop
    # shadow. Two stepped polygons stay fixed under both feet across all poses.
    contact = translucent('OPERATOR / floor contact', (.003, .008, .007), .57)
    skirt = translucent('OPERATOR / soft floor contact', (.005, .015, .012), .22)
    for name, offsets, layer, mat in [
        ('outer', [(-34, -4), (-19, -11), (16, -9), (35, 0), (24, 7), (-16, 10)], z - .002, skirt),
        ('feet', [(-23, -2), (-12, -6), (18, -4), (25, 2), (14, 6), (-15, 5)], z - .001, contact),
    ]:
        mesh('OPERATOR / ' + name + ' floor contact', [(foot[0] + x, foot[1] + y) for x, y in offsets], layer, mat)

    objects = {}
    for frame in frames:
        anchor = frame['anchor']
        if isinstance(anchor, dict):
            anchor = [anchor.get('x', .5), anchor.get('y', 1)]
        anchor_x = anchor[0] * frame['w'] if 0 <= anchor[0] <= 1 else anchor[0]
        anchor_y = anchor[1] * frame['h'] if 0 <= anchor[1] <= 1 else anchor[1]
        corners = [(0, 0), (frame['w'], 0), (frame['w'], frame['h']), (0, frame['h'])]
        vertices = [((x - anchor_x) * scale_x * pixel_unit, -(y - anchor_y) * scale_y * pixel_unit, 0) for x, y in corners]
        geometry = bpy.data.meshes.new('OPERATOR / ' + frame['name'] + ' geometry')
        geometry.from_pydata(vertices, [], [(0, 1, 2, 3)])
        geometry.update()
        obj = bpy.data.objects.new('OPERATOR / pose ' + frame['name'], geometry)
        scene.collection.objects.link(obj)
        obj.location = xy(foot, z)
        pose_material = material.copy()
        pose_material.name = 'OPERATOR / ' + frame['name'] + ' / keyed four-pixel atlas'
        obj.data.materials.append(pose_material)
        pixel_step = max(1, int(data.get('pixelStep', 1)))
        if pixel_step > 1:
            # Quantize UVs in the pose's source crop, matching the runtime's
            # nearest four-source-pixel sampling without editing the PNG.
            pn = pose_material.node_tree.nodes; pl = pose_material.node_tree.links
            uv_node = pn.new('ShaderNodeUVMap')
            previous = uv_node.outputs[0]
            operations = [('MULTIPLY', (width, -height, 1)), ('ADD', (-frame['x'], height - frame['y'], 0)),
                          ('DIVIDE', (pixel_step, pixel_step, 1)), ('FLOOR', None),
                          ('MULTIPLY', (pixel_step, pixel_step, 1)), ('ADD', (frame['x'] + pixel_step / 2, frame['y'] + pixel_step / 2, 0)),
                          ('MULTIPLY', (1 / width, -1 / height, 1)), ('ADD', (0, 1, 0))]
            for operation, vector in operations:
                node = pn.new('ShaderNodeVectorMath'); node.operation = operation
                pl.new(previous, node.inputs[0])
                if vector is not None: node.inputs[1].default_value = vector
                previous = node.outputs[0]
            pl.new(previous, pn.get('Operator atlas sampler').inputs['Vector'])
        uv = geometry.uv_layers.new(name='Packed operator atlas crop')
        for loop in geometry.loops:
            px, py = corners[loop.vertex_index]
            u = frame['x'] + (.5 if px == 0 else frame['w'] - .5)
            v = frame['y'] + (.5 if py == 0 else frame['h'] - .5)
            uv.data[loop.index].uv = (u / width, 1 - v / height)
        obj['source_pose'] = frame['name']
        obj['foot_anchor_pixels'] = list(foot)
        # All connected motion is baked by the runtime export. Geometry stays
        # fixed at the foot pivot; never add a second breathing deformation.
        objects[frame['name']] = obj

    animation = data.get('introAnimation') or data.get('intro') or {}
    if not isinstance(animation, dict):
        animation = {}
    sequence = animation.get('sequence') or animation.get('poses')
    if not sequence:
        names = [frame['name'] for frame in frames]
        idle = next((name for name in names if name.lower() in ['idle', 'idle-1', 'idle1', 'idle_1']), names[0])
        typing = next((name for name in names if 'typ' in name.lower()), idle)
        sequence = [idle, typing, idle, typing]
    sequence = [str(name) for name in sequence if str(name) in objects]
    if not sequence:
        raise ValueError('Operator intro animation does not reference a valid pose.')
    hold_frames = max(1, round(float(animation.get('holdSeconds', .45)) * fps))
    for name, obj in objects.items():
        for frame in range(scene.frame_start, scene.frame_end + 1):
            active = sequence[((frame - scene.frame_start) // hold_frames) % len(sequence)]
            obj.hide_render = name != active
            obj.hide_viewport = name != active
            obj.keyframe_insert('hide_render', frame=frame)
            obj.keyframe_insert('hide_viewport', frame=frame)
    scene['operator_atlas'] = image_path.name + ' / runtime-connected frames packed unchanged; binary alpha, nearest sampling'
    scene['operator_placement'] = 'Foot ' + str(foot) + '; source scale ' + str([scale_x, scale_y])
    scene['operator_pose_sequence'] = json.dumps(sequence)
    return {'image': str(image_path), 'poses': len(frames), 'foot': foot, 'sequence': sequence}
