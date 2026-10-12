"""Runtime-equivalent sRGB lighting after the unchanged Blender beauty render.

Only lighting data textures and compositor nodes are added. The original room,
operator and pet textures/materials remain unchanged. Data planes use the same
camera and original room registration, so light follows the cinematic reveal.
"""
import bpy
import json
from pathlib import Path


def _math(tree, operation, first, second=0):
    # Blender5 unified compositor math with ShaderNodeMath. Keep4.x support.
    try:
        node = tree.nodes.new('ShaderNodeMath')
    except RuntimeError:
        node = tree.nodes.new('CompositorNodeMath')
    node.operation = operation
    for index, value in enumerate([first, second]):
        if isinstance(value, (int, float)):
            node.inputs[index].default_value = value
        else:
            tree.links.new(value, node.inputs[index])
    return node.outputs[0]


def _clamp(tree, value):
    return _math(tree, 'MINIMUM', _math(tree, 'MAXIMUM', value, 0), 1)


def _srgb_encode(tree, linear):
    value = _clamp(tree, linear)
    low = _math(tree, 'MULTIPLY', value, 12.92)
    high = _math(tree, 'SUBTRACT', _math(tree, 'MULTIPLY', _math(tree, 'POWER', value, 1 / 2.4), 1.055), .055)
    selector = _math(tree, 'LESS_THAN', value, .0031308)
    return _math(tree, 'ADD', _math(tree, 'MULTIPLY', selector, low), _math(tree, 'MULTIPLY', _math(tree, 'SUBTRACT', 1, selector), high))


def _srgb_decode(tree, encoded):
    value = _clamp(tree, encoded)
    low = _math(tree, 'DIVIDE', value, 12.92)
    high = _math(tree, 'POWER', _math(tree, 'DIVIDE', _math(tree, 'ADD', value, .055), 1.055), 2.4)
    selector = _math(tree, 'LESS_THAN', value, .04045)
    return _math(tree, 'ADD', _math(tree, 'MULTIPLY', selector, low), _math(tree, 'MULTIPLY', _math(tree, 'SUBTRACT', 1, selector), high))


def lighting_transform(tree, beauty, shade, irradiance):
    """Return linear output for clamp(sRGB(beauty) * S * (1 + I))."""
    channels = []
    for label, image in [('Beauty', beauty), ('Shade data', shade), ('Incident light data', irradiance)]:
        separate = tree.nodes.new('CompositorNodeSeparateColor')
        separate.mode = 'RGB'
        separate.label = 'LIGHTING / ' + label
        tree.links.new(image, separate.inputs[0])
        channels.append(separate.outputs)
    combined = tree.nodes.new('CompositorNodeCombineColor')
    combined.mode = 'RGB'
    combined.label = 'LIGHTING / exact sRGB factor result'
    for channel in range(3):
        encoded = _srgb_encode(tree, channels[0][channel])
        shaded = _math(tree, 'MULTIPLY', encoded, channels[1][channel])
        incident = _math(tree, 'ADD', channels[2][channel], 1)
        lit = _clamp(tree, _math(tree, 'MULTIPLY', shaded, incident))
        tree.links.new(_srgb_decode(tree, lit), combined.inputs[channel])
    tree.links.new(channels[0][3], combined.inputs[3])
    return combined.outputs[0]


def add_lighting_passes(scene, metadata_path, xy, fps=24):
    metadata_path = Path(metadata_path).resolve()
    data = json.loads(metadata_path.read_text(encoding='utf-8'))
    if data['frameWidth'] != 420 or data['frameHeight'] != 280:
        raise ValueError('Lighting data must preserve the native full-room grid.')
    source_collection = bpy.data.collections.new('LIGHTING / unchanged beauty scene')
    scene.collection.children.link(source_collection)
    for obj in list(scene.collection.all_objects):
        if obj.type == 'CAMERA':
            continue
        for collection in list(obj.users_collection):
            collection.objects.unlink(obj)
        source_collection.objects.link(obj)
    beauty_layer = scene.view_layers[0]
    beauty_layer.name = 'Relay Beauty'
    collections = {'beauty': source_collection}
    layers = {'beauty': beauty_layer}
    packed = []
    for key, filename in [('shade', data['shade']), ('irradiance', data['irradianceAtlas'])]:
        collection = bpy.data.collections.new('LIGHTING / ' + key + ' data projection')
        scene.collection.children.link(collection)
        layer = scene.view_layers.new('Relay ' + key.title() + ' Data')
        collections[key], layers[key] = collection, layer
        image = bpy.data.images.load(str(metadata_path.parent / filename), check_existing=True)
        image.colorspace_settings.name = 'Non-Color'
        image.alpha_mode = 'NONE'
        image.pack()
        packed.append(image.name)
        material = bpy.data.materials.new('LIGHTING DATA / ' + key + ' / unmodified runtime RGB')
        material.use_nodes = True
        nodes, links = material.node_tree.nodes, material.node_tree.links
        nodes.clear()
        out = nodes.new('ShaderNodeOutputMaterial')
        emission = nodes.new('ShaderNodeEmission')
        emission.inputs['Strength'].default_value = 1
        texture = nodes.new('ShaderNodeTexImage')
        texture.image, texture.interpolation, texture.extension = image, 'Closest', 'CLIP'
        links.new(texture.outputs['Color'], emission.inputs['Color'])
        links.new(emission.outputs[0], out.inputs['Surface'])
        if key == 'irradiance':
            uv = nodes.new('ShaderNodeUVMap')
            scale = nodes.new('ShaderNodeVectorMath')
            scale.operation = 'MULTIPLY'
            scale.inputs[1].default_value = (1 / data['columns'], 1 / data['rows'], 1)
            offset = nodes.new('ShaderNodeVectorMath')
            offset.operation = 'ADD'
            links.new(uv.outputs[0], scale.inputs[0])
            links.new(scale.outputs[0], offset.inputs[0])
            links.new(offset.outputs[0], texture.inputs['Vector'])
            hold = max(1, round(float(data['holdSeconds']) * fps))
            index = f'(floor((frame-{scene.frame_start})/{hold})%{data["frameCount"]})'
            offset.inputs[1].driver_add('default_value', 0).driver.expression = f'({index}%{data["columns"]})/{data["columns"]}'
            offset.inputs[1].driver_add('default_value', 1).driver.expression = f'1-(floor({index}/{data["columns"]})+1)/{data["rows"]}'
        w, h = data['roomWidth'], data['roomHeight']
        corners = [(0, 0), (w, 0), (w, h), (0, h)]
        geometry = bpy.data.meshes.new('LIGHTING DATA / ' + key + ' / original room registration')
        geometry.from_pydata([xy(point, data.get('depth', 0)) for point in corners], [], [(0, 1, 2, 3)])
        geometry.update()
        obj = bpy.data.objects.new('LIGHTING DATA / ' + key + ' plane', geometry)
        collection.objects.link(obj)
        obj.data.materials.append(material)
        uv_layer = geometry.uv_layers.new(name='Original room UV')
        uv_corners = [(0, 1), (1, 1), (1, 0), (0, 0)]
        for loop in geometry.loops:
            uv_layer.data[loop.index].uv = uv_corners[loop.vertex_index]
        obj['data_formula'] = data['formula']
    for key, layer in layers.items():
        for collection_key, collection in collections.items():
            layer.layer_collection.children[collection.name].exclude = collection_key != key
    scene['lighting_source'] = json.dumps(data['source'])
    scene['lighting_formula'] = 'Encode beauty linear RGB to sRGB; clamp(C * shade * (1 + irradiance)); decode to linear output.'
    scene['lighting_data_textures'] = json.dumps(packed)
    return {'layers': {key: value.name for key, value in layers.items()}, 'data': data, 'packed': packed}


def add_lighting_composite(tree, info):
    sources = {}
    for key, layer_name in info['layers'].items():
        node = tree.nodes.new('CompositorNodeRLayers')
        node.layer = layer_name
        node.label = 'LIGHTING / ' + layer_name
        sources[key] = node.outputs['Image']
    return lighting_transform(tree, sources['beauty'], sources['shade'], sources['irradiance'])
