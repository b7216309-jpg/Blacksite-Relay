"""Render the exact exported420×280 room through the proposed compositor."""
import bpy
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'blender'))
from lighting_passes import lighting_transform

export = Path(sys.argv[sys.argv.index('--') + 1]).resolve() if '--' in sys.argv else HERE
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.render.resolution_x, scene.render.resolution_y = 420, 280
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.render.image_settings.color_depth = '8'
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1
if hasattr(scene, 'compositing_node_group'):
    tree = bpy.data.node_groups.new('Lighting factor numerical verification', 'CompositorNodeTree')
    scene.compositing_node_group = tree
    tree.interface.new_socket(name='Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    output = tree.nodes.new('NodeGroupOutput')
else:
    scene.use_nodes = True
    tree = scene.node_tree
    tree.nodes.clear()
    output = tree.nodes.new('CompositorNodeComposite')
inputs = []
for name, color_space in [('reference-input.png', 'sRGB'), ('shade.png', 'Non-Color'), ('reference-irradiance.png', 'Non-Color')]:
    image = bpy.data.images.load(str(export / name))
    image.colorspace_settings.name = color_space
    node = tree.nodes.new('CompositorNodeImage')
    node.image = image
    inputs.append(node.outputs['Image'])
tree.links.new(lighting_transform(tree, *inputs), output.inputs['Image'])
scene.render.filepath = str(export / 'reference-blender-lit.png')
bpy.ops.render.render(write_still=True)
print('LIGHTING_FACTOR_TEST_READY', scene.render.filepath)
