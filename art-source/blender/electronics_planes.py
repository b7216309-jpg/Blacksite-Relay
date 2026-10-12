"""Project the actual CRT, reactor and server activity as one native-grid atlas."""
import bpy
import json
from pathlib import Path


def add_electronics(scene, metadata_path, xy, fps):
    metadata_path = Path(metadata_path).resolve()
    data = json.loads(metadata_path.read_text(encoding='utf-8-sig'))
    columns = data['width'] // data['frameWidth']
    rows = data['height'] // data['frameHeight']
    count = len(data['frames'])
    if (data['frameWidth'], data['frameHeight']) != (420, 280) or count != 72:
        raise ValueError('Expected 72 native full-room electronics frames.')
    # Replace earlier independent CRT/reactor/server animation, preserving source geometry.
    removed = []
    for obj in list(scene.objects):
        if obj.name.startswith(('CRT /', 'Reactor /', 'Server ')):
            removed.append(obj.name)
            bpy.data.objects.remove(obj, do_unlink=True)
    image_path = metadata_path.parent / data['image']
    image = bpy.data.images.load(str(image_path), check_existing=True)
    image.alpha_mode = 'STRAIGHT'
    image.pack()
    material = bpy.data.materials.new('ELECTRONICS / exact runtime display patches')
    material.use_nodes = True
    try:
        material.surface_render_method = 'DITHERED'
    except AttributeError:
        material.blend_method = 'BLEND'
    nodes, links = material.node_tree.nodes, material.node_tree.links
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    emission = nodes.new('ShaderNodeEmission')
    transparent = nodes.new('ShaderNodeBsdfTransparent')
    mix = nodes.new('ShaderNodeMixShader')
    texture = nodes.new('ShaderNodeTexImage')
    texture.image, texture.interpolation, texture.extension = image, 'Closest', 'CLIP'
    links.new(texture.outputs['Color'], emission.inputs['Color'])
    links.new(texture.outputs['Alpha'], mix.inputs[0])
    links.new(transparent.outputs[0], mix.inputs[1])
    links.new(emission.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], output.inputs['Surface'])
    uv = nodes.new('ShaderNodeUVMap')
    scale = nodes.new('ShaderNodeVectorMath')
    scale.operation = 'MULTIPLY'
    scale.inputs[1].default_value = (1 / columns, 1 / rows, 1)
    offset = nodes.new('ShaderNodeVectorMath')
    offset.operation = 'ADD'
    links.new(uv.outputs[0], scale.inputs[0])
    links.new(scale.outputs[0], offset.inputs[0])
    links.new(offset.outputs[0], texture.inputs['Vector'])
    hold = max(1, round(float(data['introAnimation']['holdSeconds']) * fps))
    index = f'(floor((frame-{scene.frame_start})/{hold})%{count})'
    offset.inputs[1].driver_add('default_value', 0).driver.expression = f'({index}%{columns})/{columns}'
    offset.inputs[1].driver_add('default_value', 1).driver.expression = f'1-(floor({index}/{columns})+1)/{rows}'
    w, h = data['roomWidth'], data['roomHeight']
    corners = [(0, 0), (w, 0), (w, h), (0, h)]
    mesh = bpy.data.meshes.new('ELECTRONICS / original room registration')
    mesh.from_pydata([xy(point, data.get('depth', .038)) for point in corners], [], [(0, 1, 2, 3)])
    mesh.update()
    obj = bpy.data.objects.new('ELECTRONICS / native runtime display plane', mesh)
    scene.collection.objects.link(obj)
    obj.data.materials.append(material)
    uv_layer = mesh.uv_layers.new(name='Original room UV')
    uv_corners = [(0, 1), (1, 1), (1, 0), (0, 0)]
    for loop in mesh.loops:
        uv_layer.data[loop.index].uv = uv_corners[loop.vertex_index]
    scene['electronics_source'] = json.dumps(data['source'])
    scene['electronics_animation'] = '72 baked runtime frames / 12 fps / nearest native pixel sampling'
    scene['electronics_replaced_overlay_count'] = len(removed)
    return {'image': str(image_path), 'frames': count, 'nativeFrame': [420, 280], 'removedIndependentOverlays': len(removed)}
