"""Reproduce the editable Blacksite Relay 2.5D Blender scene and intro.

Blender 4.5+/5.x: blender --background --python build_blacksite.py -- --render
The original generated artwork remains the texture source; no raster edits.
Projection layers, wall-fan pixels, original phosphor illumination, contacts and
the metadata-driven operator are editable. Optional --operator-metadata selects
the final RGBA atlas; --require-operator fails instead of rendering without it.
"""
import bpy, math, os, sys, argparse
from mathutils import Vector
from pathlib import Path

HERE=Path(__file__).resolve().parent
ROOT=HERE.parent.parent
ART=ROOT/'assets'/'scene'/'blacksite-relay.png'
DEFAULT_MEDIA=ROOT.parent/'relay-shadows'/'media'
W,H=1536,1024
S=16/W
FPS=24
parser=argparse.ArgumentParser()
parser.add_argument('--render',action='store_true')
parser.add_argument('--still',action='store_true')
parser.add_argument('--resolution',type=int,default=480)
parser.add_argument('--operator-metadata',type=Path,default=ROOT/'art-source'/'life'/'intro-operator.json')
parser.add_argument('--require-operator',action='store_true')
parser.add_argument('--pets-metadata',type=Path,default=ROOT/'art-source'/'pets'/'intro-pets.json')
parser.add_argument('--require-pets',action='store_true')
parser.add_argument('--lighting-metadata',type=Path,default=ROOT/'art-source'/'lighting'/'intro-lighting.json')
parser.add_argument('--require-lighting',action='store_true')
parser.add_argument('--electronics-metadata',type=Path,default=ROOT/'art-source'/'electronics'/'intro-electronics.json')
parser.add_argument('--require-electronics',action='store_true')
parser.add_argument('--shadow-metadata',type=Path,default=ROOT/'art-source'/'shadows'/'intro-shadows.json')
parser.add_argument('--require-shadows',action='store_true')
parser.add_argument('--frames-dir',type=Path,default=DEFAULT_MEDIA/'intro-frames')
parser.add_argument('--preview-frames',type=str,default='')
parser.add_argument('--preview-dir',type=Path,default=DEFAULT_MEDIA/'intro-review')
parser.add_argument('--blend-output',type=Path,default=HERE/'Blacksite_Relay.blend')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
FRAMES=args.frames_dir.resolve()
if args.require_operator and not args.operator_metadata.is_file():
    raise FileNotFoundError('Final operator metadata must exist before rendering the living relay intro.')
if args.require_pets and not args.pets_metadata.is_file():
    raise FileNotFoundError('Export the accepted runtime pets before rendering the living relay intro.')
if args.require_lighting and not args.lighting_metadata.is_file():
    raise FileNotFoundError('Export the accepted runtime lighting factors before rendering this intro.')
if args.require_electronics and not args.electronics_metadata.is_file():
    raise FileNotFoundError('Export the accepted runtime electronics before rendering this intro.')
if args.require_shadows and not args.shadow_metadata.is_file():
    raise FileNotFoundError('Export the accepted runtime shadows before rendering this intro.')

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=args.resolution
scene.render.resolution_y=round(args.resolution*9/16)
scene.render.resolution_percentage=100
scene.render.fps=FPS
scene.frame_start=1
scene.frame_end=144
scene.render.image_settings.file_format='PNG'
scene.render.film_transparent=False
scene.world.color=(.001,.003,.004)
scene.view_settings.view_transform='Standard'
scene.view_settings.look='None'
scene.view_settings.exposure=0
scene.view_settings.gamma=1
if hasattr(scene,'eevee'):
    if hasattr(scene.eevee,'taa_render_samples'):scene.eevee.taa_render_samples=16
    if hasattr(scene.eevee,'taa_samples'):scene.eevee.taa_samples=16
scene.render.image_settings.color_mode='RGB'

def xy(p,z=0):return ((p[0]-W/2)*S,(H/2-p[1])*S,z)
def emission(name,color,power=1):
    mat=bpy.data.materials.new(name);mat.use_nodes=True
    nodes=mat.node_tree.nodes;nodes.clear()
    out=nodes.new('ShaderNodeOutputMaterial');shader=nodes.new('ShaderNodeEmission')
    shader.inputs['Color'].default_value=(*color,1);shader.inputs['Strength'].default_value=power
    mat.node_tree.links.new(shader.outputs[0],out.inputs['Surface'])
    return mat
def mesh(name,pts,z,mat):
    data=bpy.data.meshes.new(name);data.from_pydata([xy(p,z) for p in pts],[],[tuple(range(len(pts)))])
    data.update();obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.data.materials.append(mat)
    return obj
def rect(name,x,y,w,h,z,mat):return mesh(name,[(x,y),(x+w,y),(x+w,y+h),(x,y+h)],z,mat)
def linear(obj):
    if obj.animation_data and obj.animation_data.action:
        action=obj.animation_data.action
        try:
            for curve in action.fcurves:
                for key in curve.keyframe_points:key.interpolation='LINEAR'
        except AttributeError:pass

image=bpy.data.images.load(str(ART));image.pack()
art_mat=bpy.data.materials.new('Original Blacksite pixel artwork / unmodified packed image');art_mat.use_nodes=True
nodes=art_mat.node_tree.nodes;nodes.clear();out=nodes.new('ShaderNodeOutputMaterial')
shader=nodes.new('ShaderNodeEmission');tex=nodes.new('ShaderNodeTexImage');tex.image=image;tex.interpolation='Closest'
art_mat.node_tree.links.new(tex.outputs['Color'],shader.inputs['Color']);art_mat.node_tree.links.new(shader.outputs[0],out.inputs['Surface'])
def art_layer(name,pts,z):
    obj=mesh(name,pts,z,art_mat);uv=obj.data.uv_layers.new(name='Original art registration')
    for loop in obj.data.loops:
        px,py=pts[loop.vertex_index];uv.data[loop.index].uv=(px/W,1-py/H)
    return obj
art_layer('00 / complete original room',[(0,0),(W,0),(W,H),(0,H)],0)
art_layer('10 / left server rack',[(278,364),(354,320),(484,352),(480,675),(393,715),(285,672)],.014)
art_layer('11 / right server rack',[(1090,391),(1182,345),(1316,388),(1302,678),(1211,735),(1098,682)],.02)
art_layer('20 / relay central machine',[(638,273),(754,209),(1001,259),(1018,354),(1001,413),(1057,526),(1075,648),(987,718),(793,750),(561,643),(554,514),(594,454),(640,405)],.032)
art_layer('30 / floor cable trench',[(683,781),(844,709),(1173,819),(1021,932),(924,1024),(546,1024),(582,889)],.045)

def translucent(name,color,opacity):
    mat=bpy.data.materials.new(name);mat.use_nodes=True
    try:mat.surface_render_method='DITHERED'
    except AttributeError:pass
    nodes=mat.node_tree.nodes;nodes.clear();out=nodes.new('ShaderNodeOutputMaterial')
    mix=nodes.new('ShaderNodeMixShader');transparent=nodes.new('ShaderNodeBsdfTransparent');em=nodes.new('ShaderNodeEmission')
    em.inputs[0].default_value=(*color,1);mix.inputs[0].default_value=opacity
    mat.node_tree.links.new(transparent.outputs[0],mix.inputs[1]);mat.node_tree.links.new(em.outputs[0],mix.inputs[2]);mat.node_tree.links.new(mix.outputs[0],out.inputs[0])
    return mat

if args.operator_metadata.is_file():
    sys.path.insert(0,str(HERE))
    from operator_planes import add_operator
    operator_info=add_operator(scene,args.operator_metadata,xy,mesh,translucent,FPS)
else:
    operator_info=None

if args.pets_metadata.is_file():
    sys.path.insert(0,str(HERE))
    from pets_planes import add_pets
    pets_info=add_pets(scene,args.pets_metadata,xy,FPS)
else:
    pets_info=None

teal=translucent('TEAL / translucent contact light',(.24,.91,.68),.32)
amber=translucent('AMBER / translucent contact light',(1,.53,.16),.32)
fan_dark=translucent('Fan / inner aperture shadow',(.003,.012,.010),.23)
fan_light=translucent('Fan / inner blade reflection',(.10,.20,.14),.20)
scan_mat=translucent('CRT / narrow refresh',(.60,1,.82),.11)

# The lower circular fitting (878,611) is a solid pipe endcap, never an animated fan.
# The real wall fan keeps its original rim, hub and grille; two-pixel clusters rotate behind it.
for py in range(-35,36,2):
    for px in range(-27,28,2):
        nx,ny=px/27,py/35;r=math.hypot(nx,ny);a=math.atan2(ny,nx)
        if r<.23 or r>.91 or abs(math.sin(a*4))<.16:continue
        for bright,mat in [(False,fan_dark),(True,fan_light)]:
            ob=rect(f'Wall fan / pixel {px} {py} / {bright}',1426+px,271+py,2,2,.006,mat)
            driver=ob.driver_add('hide_render').driver
            driver.expression=f'cos({a*6}-frame*0.525-{r*.6}) '+('< 0.32' if bright else '>= 0.32')

def illuminated_art(name,pts,z,expression):
    ob=art_layer(name,pts,z);mat=art_mat.copy();mat.name=name+' / original pixel exposure'
    ob.data.materials.clear();ob.data.materials.append(mat)
    shader=next(n for n in mat.node_tree.nodes if n.type=='EMISSION')
    driver=shader.inputs['Strength'].driver_add('default_value').driver;driver.expression=expression
    return ob

GLASS=[(684,324),(771,346),(771,412),(684,390)]
COIL=[(691,533),(757,550),(751,574),(685,557)]
illuminated_art('CRT / original phosphor inside glass',GLASS,.034,'1.05+0.10*sin(frame*0.10)')
illuminated_art('Reactor / original filament exposure',COIL,.034,'1.08+0.18*(0.5+0.5*sin(frame*0.19))')

def glass_point(u,v):return (684+87*u,324+22*u+66*v)
def glass_rect(name,u,v,w,h,mat):return mesh(name,[glass_point(u,v),glass_point(u+w,v),glass_point(u+w,v+h),glass_point(u,v+h)],.035,mat)
for row in range(24):
    ob=glass_rect(f'CRT / refresh band {row:02}',0,row/24,1,.023,scan_mat)
    ob.driver_add('hide_render').driver.expression=f'floor(frame*0.18)%24 != {row}'
for i in range(14):
    ob=glass_rect(f'CRT / status activity {i:02}',.30+i*.043,.718,.027,.024,teal)
    ob.driver_add('hide_render').driver.expression=f'floor(frame*0.30)%14 < {i}'

# Register actual source phosphor pixels; no independently positioned replacement LEDs.
pixels=list(image.pixels)
regions=[(356,426,94,218),(1124,449,95,221),(1266,461,40,143),(856,378,24,37),(897,391,18,15),(898,548,21,50),(706,91,63,31)]
for ri,(x,y,w,h) in enumerate(regions):
    for py in range(y,y+h):
        start=None
        for px in range(x,x+w+1):
            k=((H-1-py)*W+px)*4;r,g,b=pixels[k:k+3]
            # Blender image pixels are scene-linear: thresholds match the runtime's sRGB mask.
            lit=px<x+w and g>.088 and b>.058 and g>r*1.45 and b>r*1.2
            if lit and start is None:start=px
            if not lit and start is not None:
                z=.034 if ri in (3,4,5) else .022 if ri in (1,2) else .016 if ri==0 else .002
                illuminated_art(f'Server {ri} / original light run {start} {py}',[(start,py),(px,py),(px,py+1),(start,py+1)],z,f'0.76+0.40*(0.5+0.5*sin(frame*0.11+{ri*2.9+(py-y)//18*.8}))')
                start=None

contacts=[[(632,352),(613,359),(587,373),(573,389),(568,407),(575,429),(592,448)],[(955,393),(976,400),(995,417),(1004,439),(1001,461),(984,475),(963,475)],[(899,417),(917,429),(934,445),(944,465),(936,485),(916,497),(899,483)]]
for route,points in enumerate(contacts):
    for i,(x,y) in enumerate(points):
        ob=rect(f'Cable {route} / fixed coupling {i}',x,y,2,2,.034,amber if route==0 else teal)
        ob.driver_add('hide_render').driver.expression=f'floor(frame*0.20+{route*2})%{len(points)} != {i}'

# Steam is translucent, stepped geometry, without generated or edited texture maps.
vapor=bpy.data.materials.new('Vent / translucent vapor');vapor.use_nodes=True
try:vapor.surface_render_method='DITHERED'
except AttributeError:pass
nodes=vapor.node_tree.nodes;nodes.clear();out=nodes.new('ShaderNodeOutputMaterial')
mix=nodes.new('ShaderNodeMixShader');transparent=nodes.new('ShaderNodeBsdfTransparent');em=nodes.new('ShaderNodeEmission')
em.inputs[0].default_value=(.22,.34,.29,1);mix.inputs[0].default_value=.19
vapor.node_tree.links.new(transparent.outputs[0],mix.inputs[1]);vapor.node_tree.links.new(em.outputs[0],mix.inputs[2]);vapor.node_tree.links.new(mix.outputs[0],out.inputs[0])
for v,(x,y) in enumerate([(252,735)]):
    for i in range(7):
        obj=rect(f'Vent {v} / steam cluster {i}',-4,-3,8,6,.105,vapor)
        for vert in obj.data.vertices:vert.co-=Vector(xy((0,0),0))
        for f in range(1,146):
            age=((f-1)/144+i/7)%1
            obj.location=xy((x+math.sin(age*4+i)*5+age*5,y-age*92),0)
            size=.35+age*.70;obj.scale=(size,size,size);obj.keyframe_insert('location',frame=f);obj.keyframe_insert('scale',frame=f)
        linear(obj)

camera_data=bpy.data.cameras.new('Cinematic lens / 2.5D reveal')
camera=bpy.data.objects.new('CAMERA / six-second relay reveal',camera_data);scene.collection.objects.link(camera);scene.camera=camera
camera_data.type='PERSP';camera_data.lens=45
def pose(frame,position,target):
    camera.location=position
    # Explicit zero roll avoids Euler wrap while a nearly axial camera crosses X=0.
    dx=target[0]-position[0];dy=target[1]-position[1];depth=position[2]-target[2]
    camera.rotation_euler=(math.atan2(dy,depth),-math.atan2(dx,depth),0)
    camera.keyframe_insert('location',frame=frame);camera.keyframe_insert('rotation_euler',frame=frame)
pose(1,(-.24,.09,12.8),(-.15,.25,0))
pose(144,(.16,.16,19.7),(.02,.12,0))

if args.shadow_metadata.is_file():
    sys.path.insert(0,str(HERE))
    from shadow_planes import add_shadows
    shadow_info=add_shadows(scene,args.shadow_metadata,xy,FPS)
else:
    shadow_info=None

if args.electronics_metadata.is_file():
    sys.path.insert(0,str(HERE))
    from electronics_planes import add_electronics
    electronics_info=add_electronics(scene,args.electronics_metadata,xy,FPS)
else:
    electronics_info=None

if args.lighting_metadata.is_file():
    sys.path.insert(0,str(HERE))
    from lighting_passes import add_lighting_passes, add_lighting_composite
    lighting_info=add_lighting_passes(scene,args.lighting_metadata,xy,FPS)
else:
    lighting_info=None

# Soft glow is the only compositing effect; image nearest filtering retains pixel detail.
if hasattr(scene,'compositing_node_group'):
    nt=bpy.data.node_groups.new('Blacksite / restrained phosphor bloom','CompositorNodeTree')
    scene.compositing_node_group=nt
    nt.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
    render=nt.nodes.new('CompositorNodeRLayers');glare=nt.nodes.new('CompositorNodeGlare')
    glare.inputs['Type'].default_value='Fog Glow';glare.inputs['Quality'].default_value='Low'
    glare.inputs['Threshold'].default_value=1.05;glare.inputs['Strength'].default_value=.12;glare.inputs['Size'].default_value=.25
    composite=nt.nodes.new('NodeGroupOutput')
else:
    scene.use_nodes=True;nt=scene.node_tree;nt.nodes.clear();render=nt.nodes.new('CompositorNodeRLayers');glare=nt.nodes.new('CompositorNodeGlare')
    glare.glare_type='FOG_GLOW';glare.quality='LOW';glare.threshold=1.05;glare.size=7;glare.mix=-.88
    composite=nt.nodes.new('CompositorNodeComposite')
lighting_output=add_lighting_composite(nt,lighting_info) if lighting_info else render.outputs['Image']
nt.links.new(lighting_output,glare.inputs['Image']);nt.links.new(glare.outputs['Image'],composite.inputs['Image'])
scene['design']='Blacksite Relay — original art with editable 2.5D projection and animated scene elements.'
scene['original_art']='assets/scene/blacksite-relay.png — packed without raster alteration.'
scene['animation']='Living relay / 144 frames / 24 fps. Unchanged connected operator and registered native-grid runtime pets; actual wall fan, original CRT/LED pixels, fixed cable contacts and confirmed vent.'
scene.frame_set(72)
HERE.mkdir(parents=True,exist_ok=True)
args.blend_output.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(args.blend_output.resolve()))
if args.still:
    args.preview_dir.mkdir(parents=True,exist_ok=True)
    scene.render.filepath=str(args.preview_dir/'blacksite-blender-preview.png');bpy.ops.render.render(write_still=True)
if args.preview_frames:
    args.preview_dir.mkdir(parents=True,exist_ok=True)
    for frame in [int(value) for value in args.preview_frames.split(',')]:
        if not scene.frame_start<=frame<=scene.frame_end:raise ValueError('Preview frame must be in 1..144.')
        scene.frame_set(frame)
        scene.render.filepath=str(args.preview_dir/f'review-{frame:04}.png')
        bpy.ops.render.render(write_still=True)
if args.render:
    FRAMES.mkdir(parents=True,exist_ok=True);scene.render.filepath=str(FRAMES/'relay_');bpy.ops.render.render(animation=True)
print('BLACKSITE_SCENE_READY',args.blend_output.resolve(),'OPERATOR',operator_info,'PETS',pets_info,'SHADOWS',shadow_info,'ELECTRONICS',electronics_info,'LIGHTING',lighting_info)
