"""Project unchanged native-grid runtime pet frames into the editable room.

The atlas contains full-room RGBA views of the pets only. Geometry, nearest
sampling, visibility and room registration are editable; motion comes only from
the game's deterministic exporter. No texture pixels are generated or edited.
"""
import bpy
import json
from pathlib import Path


def add_pets(scene, metadata_path, xy, fps=24):
    metadata_path = Path(metadata_path).resolve()
    data = json.loads(metadata_path.read_text(encoding='utf-8'))
    image_path = (metadata_path.parent / data['image']).resolve()
    if not image_path.is_file():
        raise FileNotFoundError('Export the accepted runtime pet atlas first: ' + str(image_path))
    atlas = bpy.data.images.load(str(image_path), check_existing=True)
    atlas.alpha_mode = 'STRAIGHT'
    atlas.pack()
    width, height = atlas.size
    room_width, room_height = data['roomWidth'], data['roomHeight']
    corners = [(0, 0), (room_width, 0), (room_width, room_height), (0, room_height)]
    depth = float(data.get('depth', .04))
    frames = data['frames']
    animation = data['introAnimation']
    sequence = animation['sequence']
    hold_frames = max(1, round(float(animation['holdSeconds']) * fps))
    objects = {}
    for frame in frames:
        x, y, w, h = (int(frame[key]) for key in ('x', 'y', 'w', 'h'))
        if x < 0 or y < 0 or w <= 0 or h <= 0 or x + w > width or y + h > height:
            raise ValueError('Pet atlas crop exceeds its texture bounds.')
        name = frame['name']
        material = bpy.data.materials.new('PETS / ' + name + ' / original runtime RGBA')
        material.use_nodes = True
        try:
            material.surface_render_method = 'DITHERED'
        except AttributeError:
            material.blend_method = 'BLEND'
        nodes = material.node_tree.nodes
        nodes.clear()
        output = nodes.new('ShaderNodeOutputMaterial')
        texture = nodes.new('ShaderNodeTexImage')
        texture.name = 'Packed runtime pet frame / nearest native pixels'
        texture.image = atlas
        texture.interpolation = 'Closest'
        texture.extension = 'CLIP'
        emission = nodes.new('ShaderNodeEmission')
        emission.inputs['Strength'].default_value = 1
        transparent = nodes.new('ShaderNodeBsdfTransparent')
        mix = nodes.new('ShaderNodeMixShader')
        links = material.node_tree.links
        links.new(texture.outputs['Color'], emission.inputs['Color'])
        links.new(texture.outputs['Alpha'], mix.inputs[0])
        links.new(transparent.outputs[0], mix.inputs[1])
        links.new(emission.outputs[0], mix.inputs[2])
        links.new(mix.outputs[0], output.inputs['Surface'])
        geometry = bpy.data.meshes.new('PETS / ' + name + ' / full-room projection')
        geometry.from_pydata([xy(p, depth) for p in corners], [], [(0, 1, 2, 3)])
        geometry.update()
        obj = bpy.data.objects.new('PETS / runtime frame ' + name, geometry)
        scene.collection.objects.link(obj)
        obj.data.materials.append(material)
        uv = geometry.uv_layers.new(name='Native-grid full-room registration')
        crop_corners = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
        for loop in geometry.loops:
            u, v = crop_corners[loop.vertex_index]
            uv.data[loop.index].uv = (u / width, 1 - v / height)
        obj['source_frame'] = name
        obj['native_pixel_size'] = [w, h]
        obj['room_registration'] = [room_width, room_height]
        objects[name] = obj
    if not sequence or any(name not in objects for name in sequence):
        raise ValueError('Pet animation references an absent frame.')
    for name, obj in objects.items():
        for frame in range(scene.frame_start, scene.frame_end + 1):
            active = sequence[((frame - scene.frame_start) // hold_frames) % len(sequence)]
            obj.hide_render = name != active
            obj.hide_viewport = name != active
            obj.keyframe_insert('hide_render', frame=frame)
            obj.keyframe_insert('hide_viewport', frame=frame)
    scene['pet_atlas'] = image_path.name + ' / unmodified runtime RGBA frames packed, nearest sampling'
    scene['pet_registration'] = str([room_width, room_height]) + ' original room coordinates'
    scene['pet_source'] = json.dumps(data.get('source', {}))
    return {'image': str(image_path), 'frames': len(frames), 'nativeFrame': [data['frameWidth'], data['frameHeight']], 'room': [room_width, room_height], 'depth': depth}
