"""Source-backed sRGB shadow alpha before the unchanged actor and lighting layers."""
import bpy
import json
from pathlib import Path
from lighting_passes import _math, _srgb_encode, _srgb_decode


def shadow_color(tree, original_linear, alpha):
    separate = tree.nodes.new('ShaderNodeSeparateColor')
    separate.mode = 'RGB'
    tree.links.new(original_linear, separate.inputs[0])
    combined = tree.nodes.new('ShaderNodeCombineColor')
    combined.mode = 'RGB'
    transmission = _math(tree, 'SUBTRACT', 1, alpha)
    for channel in range(3):
        encoded = _srgb_encode(tree, separate.outputs[channel])
        darkened = _math(tree, 'MULTIPLY', encoded, transmission)
        tree.links.new(_srgb_decode(tree, darkened), combined.inputs[channel])
    return combined.outputs[0]


def add_shadows(scene, metadata_path, xy, fps, art_path=None):
    metadata_path = Path(metadata_path).resolve()
    data = json.loads(metadata_path.read_text(encoding='utf-8-sig'))
    if (data['frameWidth'], data['frameHeight']) != (420, 280) or data['frameCount'] != 72:
        raise ValueError('Expected 72 native shadow masks on the shared six-second clock.')
    removed = []
    for obj in list(scene.objects):
        if obj.name.startswith('OPERATOR /') and 'floor contact' in obj.name:
            removed.append(obj.name)
            bpy.data.objects.remove(obj, do_unlink=True)
    image_path = metadata_path.parent / data['image']
    image = bpy.data.images.load(str(image_path), check_existing=True)
    image.colorspace_settings.name = 'Non-Color'
    image.alpha_mode = 'STRAIGHT'
    image.pack()
    if art_path is None:
        art_path = Path(__file__).resolve().parents[2] / 'assets/scene/blacksite-relay.png'
    art = bpy.data.images.load(str(art_path), check_existing=True)
    art.pack()
    material = bpy.data.materials.new('SHADOWS / exact sRGB source-over / preserved soft alpha')
    material.use_nodes = True
    try:
        material.surface_render_method = 'DITHERED'
    except AttributeError:
        material.blend_method = 'BLEND'
    tree = material.node_tree
    nodes, links = tree.nodes, tree.links
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    emission = nodes.new('ShaderNodeEmission')
    transparent = nodes.new('ShaderNodeBsdfTransparent')
    mix = nodes.new('ShaderNodeMixShader')
    mask = nodes.new('ShaderNodeTexImage')
    mask.name = 'Native continuous alpha / unchanged runtime mask'
    mask.image, mask.interpolation, mask.extension = image, 'Closest', 'CLIP'
    original = nodes.new('ShaderNodeTexImage')
    original.name = 'Unmodified original room pixels'
    original.image, original.interpolation, original.extension = art, 'Closest', 'CLIP'
    uv = nodes.new('ShaderNodeUVMap')
    links.new(uv.outputs[0], original.inputs['Vector'])
    scale = nodes.new('ShaderNodeVectorMath')
    scale.operation = 'MULTIPLY'
    scale.inputs[1].default_value = (1 / data['columns'], 1 / data['rows'], 1)
    offset = nodes.new('ShaderNodeVectorMath')
    offset.operation = 'ADD'
    links.new(uv.outputs[0], scale.inputs[0])
    links.new(scale.outputs[0], offset.inputs[0])
    links.new(offset.outputs[0], mask.inputs['Vector'])
    hold = max(1, round(float(data['holdSeconds']) * fps))
    index = f'(floor((frame-{scene.frame_start})/{hold})%{data["frameCount"]})'
    offset.inputs[1].driver_add('default_value', 0).driver.expression = f'({index}%{data["columns"]})/{data["columns"]}'
    offset.inputs[1].driver_add('default_value', 1).driver.expression = f'1-(floor({index}/{data["columns"]})+1)/{data["rows"]}'
    # Evaluate soft opacity within the source color, then use transparent geometry
    # outside the ink. This retains Canvas's sRGB blend instead of linear darkening.
    links.new(shadow_color(tree, original.outputs['Color'], mask.outputs['Alpha']), emission.inputs['Color'])
    links.new(_math(tree, 'GREATER_THAN', mask.outputs['Alpha'], 0), mix.inputs[0])
    links.new(transparent.outputs[0], mix.inputs[1])
    links.new(emission.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs['Surface'])
    w, h = data['roomWidth'], data['roomHeight']
    corners = [(0, 0), (w, 0), (w, h), (0, h)]
    mesh = bpy.data.meshes.new('SHADOWS / original room registration')
    mesh.from_pydata([xy(point, data.get('depth', .036)) for point in corners], [], [(0, 1, 2, 3)])
    mesh.update()
    obj = bpy.data.objects.new('SHADOWS / native runtime ink plane', mesh)
    scene.collection.objects.link(obj)
    obj.data.materials.append(material)
    uv_layer = mesh.uv_layers.new(name='Original room UV')
    uv_corners = [(0, 1), (1, 1), (1, 0), (0, 0)]
    for loop in mesh.loops:
        uv_layer.data[loop.index].uv = uv_corners[loop.vertex_index]
    scene['shadow_source'] = json.dumps(data['source'])
    scene['shadow_formula'] = 'Decode(sRGB(original room) * (1 - native shadow alpha)), transparent outside ink; actors and lighting follow.'
    scene['shadow_removed_operator_contacts'] = len(removed)
    return {'image': str(image_path), 'frames': data['frameCount'], 'nativeFrame': [420, 280], 'removedOperatorContacts': len(removed)}
