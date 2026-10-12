"""Render the actual source-backed Blender shadow material on the native reference room."""
import bpy
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT / 'art-source/blender'))
from shadow_planes import add_shadows

directory = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x, scene.render.resolution_y = 420, 280
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.render.image_settings.color_depth = '8'
scene.render.film_transparent = False
scene.render.dither_intensity = 0
scene.render.filter_size = .01
scene.frame_start, scene.frame_end = 1, 144
scene.render.fps = 24
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1
scene.world.color = (0, 0, 0)
def xy(point, depth=0):
    return ((point[0]-768)*4.2/1536, (512-point[1])*4.2/1536, depth)
art_path = directory / 'reference-input.png'
art = bpy.data.images.load(str(art_path))
material = bpy.data.materials.new('REFERENCE / original native pixels')
material.use_nodes = True
nodes, links = material.node_tree.nodes, material.node_tree.links
nodes.clear()
output = nodes.new('ShaderNodeOutputMaterial')
texture = nodes.new('ShaderNodeTexImage')
texture.image, texture.interpolation = art, 'Closest'
emission = nodes.new('ShaderNodeEmission')
links.new(texture.outputs['Color'], emission.inputs['Color'])
links.new(emission.outputs[0], output.inputs['Surface'])
corners = [(0, 0), (1536, 0), (1536, 1024), (0, 1024)]
mesh = bpy.data.meshes.new('REFERENCE / exact native room')
mesh.from_pydata([xy(point) for point in corners], [], [(0, 1, 2, 3)])
obj = bpy.data.objects.new('REFERENCE / room plane', mesh)
scene.collection.objects.link(obj)
obj.data.materials.append(material)
uv = mesh.uv_layers.new()
uv_corners = [(0, 1), (1, 1), (1, 0), (0, 0)]
for loop in mesh.loops:
    uv.data[loop.index].uv = uv_corners[loop.vertex_index]
add_shadows(scene, directory / 'intro-shadows.json', xy, 24, art_path=art_path)
camera_data = bpy.data.cameras.new('REFERENCE / native orthographic camera')
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 4.2
camera = bpy.data.objects.new('REFERENCE / camera', camera_data)
scene.collection.objects.link(camera)
camera.location = (0, 0, 10)
scene.camera = camera
scene.frame_set(49)
scene.render.filepath = str(directory / 'reference-blender-shadowed.png')
bpy.ops.render.render(write_still=True)
