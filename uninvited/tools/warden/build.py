"""Uninvited - the warden build (a walking sentinel program, DESIGN 8).

Blender 4.5, headless:
    blender -b --python tools/warden/build.py -- --src <quaternius dir> [--out assets/models/warden.glb]
                                                 [--preview <dir>] [--blend <file.blend>]

Takes the Quaternius Universal Animation Library 1 + 2 (CC0, "Standard", in-place Unreal-Godot glb files) - the
65-bone rig, the "Mannequin" body and the clips - and builds the warden on top of it procedurally:
  * the segmented mannequin, decimated and flat shaded (a faceted dark under-suit, material "Under"), its head removed,
  * angular armor (material "Armor"): faceted prisms rigidly bound to one bone each - a broad chest and a back unit,
    big shoulder plates, forearm guards, thigh and shin guards, boots, a waist ring - for a heavy silhouette that reads
    from far away and is clearly not the hero,
  * a tall faceted "lantern" helmet with a wrap-around visor slit (material "Visor": the glow that shows where it looks)
    and a crest,
  * hostile light lines along the plates and a ring at the waist (material "Lines"), a chest core and an emitter ring
    on the right wrist (material "Core": the arm shot comes from there).
Only the clips the game uses are kept (CLIPS), finger tracks are dropped (the hands stay open plates), and the
animation is sampled at 12 fps, so the file stays small. Deterministic: a rebuild gives the same file.
"""
import bpy
import math
import os
import sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))

# (name in the glb, source clip, pack)
CLIPS = [
    ('idle', 'Idle_Loop', 1),
    ('post', 'Idle_FoldArms_Loop', 2),
    ('walk', 'Walk_Formal_Loop', 1),
    ('search_walk', 'Walk_Loop', 1),
    ('run', 'Jog_Fwd_Loop', 1),
    ('scan', 'Idle_Torch_Loop', 1),
    ('check', 'Interact', 1),
    ('alert', 'Sword_Idle', 1),
    ('strike', 'Melee_Hook', 2),
    ('shoot', 'Spell_Simple_Shoot', 1),
    ('hit', 'Hit_Chest', 1),
    ('death', 'Death01', 1),
]
FINGERS = ('thumb_', 'index_', 'middle_', 'ring_', 'pinky_')
BODY_RATIO = 0.3     # the mannequin is decimated to this share of its faces
FRAME_STEP = 2       # export every 2nd frame (24 fps clips -> 12 fps)


def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    opts = {'src': os.environ.get('QUATERNIUS_DIR', ''), 'out': os.path.join(ROOT, 'assets', 'models', 'warden.glb'),
            'preview': '', 'blend': ''}
    i = 0
    while i < len(argv):
        opts[argv[i].lstrip('-')] = argv[i + 1]
        i += 2
    if not opts['src']:
        raise SystemExit('pass --src <folder with UAL1_Standard.glb and UAL2_Standard.glb> (or set QUATERNIUS_DIR)')
    return opts


def find_file(src, name):
    for d, _, files in os.walk(src):
        if name in files:
            return os.path.join(d, name)
    raise SystemExit('not found under %s: %s' % (src, name))


def material(name, base, rough=0.5, metal=0.0, emit=None, strength=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*base, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if emit:
        bsdf.inputs['Emission Color'].default_value = (*emit, 1.0)
        bsdf.inputs['Emission Strength'].default_value = strength
    return m


def make_materials():
    return {
        'Under': material('Under', (0.01, 0.011, 0.013), rough=0.55, metal=0.3),
        'Armor': material('Armor', (0.03, 0.028, 0.03), rough=0.3, metal=0.75),
        'Lines': material('Lines', (0, 0, 0), emit=(1.0, 0.25, 0.06), strength=4.0),
        'Visor': material('Visor', (0, 0, 0), emit=(1.0, 0.35, 0.08), strength=6.0),
        'Core': material('Core', (0, 0, 0), emit=(1.0, 0.2, 0.05), strength=5.0),
    }


# ----------------------------------------------------------------------------------------------- the base
def load_base(src):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 24
    bpy.ops.import_scene.gltf(filepath=find_file(src, 'UAL1_Standard.glb'))
    pack1 = {a.name: a for a in bpy.data.actions}
    keep = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=find_file(src, 'UAL2_Standard.glb'))
    pack2 = {a.name.split('.')[0]: a for a in bpy.data.actions if a.name not in pack1 or a.name.endswith('.001')}
    for o in list(bpy.data.objects):
        if o not in keep:
            bpy.data.objects.remove(o)
    bpy.data.objects.remove(bpy.data.objects['Icosphere'])
    arm = bpy.data.objects['Armature']
    body = bpy.data.objects['Mannequin']
    wanted = {}
    for out, name, pack in CLIPS:
        act = (pack1 if pack == 1 else pack2).get(name)
        if act is None:
            raise SystemExit('clip not found: %s (pack %d)' % (name, pack))
        wanted[act.name] = out
    for a in list(bpy.data.actions):
        if a.name not in wanted:
            bpy.data.actions.remove(a)
    for a in list(bpy.data.actions):
        a.name = wanted[a.name]
        a.use_fake_user = True
        drop_finger_tracks(a)
    arm.animation_data.action = None
    for tr in list(arm.animation_data.nla_tracks):
        arm.animation_data.nla_tracks.remove(tr)
    arm.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    return arm, body


def action_fcurves(act):
    """The F-curves of an action (Blender 4.4+ keeps them per slot in a channel bag)."""
    try:
        bags = [s.channelbag(act.slots[0]) for l in act.layers for s in l.strips] if act.slots else []
        for bag in bags:
            if bag is not None:
                return bag.fcurves
    except (AttributeError, TypeError):
        pass
    return act.fcurves


def drop_finger_tracks(act):
    fcs = action_fcurves(act)
    for fc in list(fcs):
        name = fc.data_path.split('"')[1] if '"' in fc.data_path else ''
        if name.startswith(FINGERS):
            fcs.remove(fc)


def bone_head(arm, name):
    return arm.matrix_world @ arm.data.bones[name].head_local


# ----------------------------------------------------------------------------------------------- the under-suit
def build_body(arm, body, mats):
    """The mannequin, decimated and flat shaded; the head is removed (the helmet replaces it)."""
    me = body.data
    while me.uv_layers:
        me.uv_layers.remove(me.uv_layers[0])
    names = {g.index: g.name for g in body.vertex_groups}
    drop = set()
    for v in me.vertices:
        best, bw = '', 0.0
        for g in v.groups:
            if g.weight > bw:
                best, bw = names[g.group], g.weight
        if best == 'Head' and v.co.z > 1.585:
            drop.add(v.index)
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.verts[i] for i in drop], context='VERTS')
    bm.to_mesh(me)
    bm.free()
    for m in list(body.modifiers):
        if m.type != 'ARMATURE':
            body.modifiers.remove(m)
    dec = body.modifiers.new('Decimate', 'DECIMATE')
    dec.ratio = BODY_RATIO
    bpy.context.view_layer.objects.active = body
    for o in bpy.context.selected_objects:
        o.select_set(False)
    body.select_set(True)
    # the decimate must run before the armature modifier
    bpy.ops.object.modifier_move_to_index(modifier='Decimate', index=0)
    bpy.ops.object.modifier_apply(modifier='Decimate')
    me = body.data
    me.materials.clear()
    me.materials.append(mats['Under'])
    for p in me.polygons:
        p.material_index = 0
        p.use_smooth = False
    body.name = 'Body'
    me.name = 'Body'


# ----------------------------------------------------------------------------------------------- armor pieces
class Parts:
    """Accumulates faceted pieces per material, each vertex bound rigidly to one bone."""

    def __init__(self):
        self.data = {}  # material -> (verts, faces, bones)

    def add(self, mat, verts, faces, bone):
        vs, fs, bs = self.data.setdefault(mat, ([], [], []))
        base = len(vs)
        vs.extend(verts)
        fs.extend(tuple(base + i for i in f) for f in faces)
        bs.extend([bone] * len(verts))

    def build(self, arm, mats):
        for mat, (vs, fs, bs) in self.data.items():
            me = bpy.data.meshes.new(mat)
            me.from_pydata([tuple(v) for v in vs], [], fs)
            me.update()
            me.materials.append(mats[mat])
            for p in me.polygons:
                p.use_smooth = False
            ob = bpy.data.objects.new(mat, me)
            bpy.context.scene.collection.objects.link(ob)
            groups = {}
            for i, b in enumerate(bs):
                g = groups.get(b) or ob.vertex_groups.new(name=b)
                groups[b] = g
                g.add([i], 1.0, 'REPLACE')
            mod = ob.modifiers.new('Armature', 'ARMATURE')
            mod.object = arm
            ob.parent = arm


AXES = {'x': (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))),
        'y': (Vector((0, 1, 0)), Vector((1, 0, 0)), Vector((0, 0, 1))),
        'z': (Vector((0, 0, 1)), Vector((1, 0, 0)), Vector((0, 1, 0)))}


def ring(center, axis, t, ra, rb, sides, phase, scale=1.0):
    """Points of a faceted ring across `axis` at distance t from the centre."""
    a, u, v = AXES[axis]
    out = []
    for k in range(sides):
        ang = phase + 2 * math.pi * k / sides
        out.append(center + a * t + u * (math.cos(ang) * ra * scale) + v * (math.sin(ang) * rb * scale))
    return out


def prism(parts, mat, bone, center, axis, length, ra, rb, sides=6, taper=(1.0, 1.0), phase=None, lines=None, line_mat='Lines',
          band=None, cap=True):
    """A faceted prism along `axis` (radii ra, rb across it), ends scaled by `taper`. `lines`: side faces that get a
    light strip along their middle; `band`: a light ring at this share of the length."""
    if phase is None:
        phase = math.pi / sides
    c = Vector(center)
    r0 = ring(c, axis, -length / 2, ra, rb, sides, phase, taper[0])
    r1 = ring(c, axis, length / 2, ra, rb, sides, phase, taper[1])
    verts = r0 + r1
    faces = [(k, (k + 1) % sides, sides + (k + 1) % sides, sides + k) for k in range(sides)]
    if cap:
        faces.append(tuple(reversed(range(sides))))
        faces.append(tuple(range(sides, 2 * sides)))
    parts.add(mat, verts, faces, bone)
    for k in lines or ():
        # a strip along the middle of side face k, lifted a little off it
        a0, a1, b0, b1 = r0[k], r0[(k + 1) % sides], r1[k], r1[(k + 1) % sides]
        m0 = (a0 + a1) / 2
        m1 = (b0 + b1) / 2
        n = ((a1 - a0).cross(m1 - m0)).normalized()
        side = (a1 - a0).normalized() * 0.008
        lift = n * 0.004
        inset = (m1 - m0) * 0.06
        strip = [m0 + inset - side + lift, m0 + inset + side + lift, m1 - inset + side + lift, m1 - inset - side + lift]
        parts.add(line_mat, strip, [(0, 1, 2, 3)], bone)
    if band is not None:
        t = -length / 2 + length * band
        s = taper[0] + (taper[1] - taper[0]) * band
        lo = ring(c, axis, t - 0.007, ra, rb, sides, phase, s * 1.035)
        hi = ring(c, axis, t + 0.007, ra, rb, sides, phase, s * 1.035)
        parts.add(line_mat, lo + hi, [(k, (k + 1) % sides, sides + (k + 1) % sides, sides + k) for k in range(sides)], bone)


def mirror(p):
    return Vector((-p[0], p[1], p[2]))


def build_armor(arm, mats):
    P = Parts()
    # --- torso (front is -Y)
    # chest: an octagonal plate block, broad at the shoulders, a light line down each front facet
    prism(P, 'Armor', 'spine_03', (0, 0.0, 1.36), 'z', 0.3, 0.2, 0.15, sides=8, taper=(0.78, 1.0), lines=(5, 6))
    prism(P, 'Armor', 'spine_03', (0, 0.012, 1.5), 'z', 0.07, 0.12, 0.11, sides=8, taper=(1.0, 0.8))  # gorget
    prism(P, 'Armor', 'spine_03', (0, 0.17, 1.3), 'z', 0.28, 0.12, 0.06, sides=6, taper=(0.8, 1.0), lines=(1,))  # back unit
    prism(P, 'Armor', 'spine_01', (0, 0.012, 1.12), 'z', 0.15, 0.15, 0.12, sides=8, taper=(0.95, 0.85))  # abdomen
    prism(P, 'Armor', 'pelvis', (0, 0.02, 0.97), 'z', 0.12, 0.19, 0.14, sides=8, taper=(0.95, 1.0), band=0.5)  # waist ring
    # chest core: a small diamond
    core = Vector((0, -0.158, 1.37))
    dv = [core + Vector(d) for d in ((0.04, 0, 0), (-0.04, 0, 0), (0, 0, 0.05), (0, 0, -0.05), (0, -0.02, 0))]
    P.add('Core', dv, [(0, 2, 4), (2, 1, 4), (1, 3, 4), (3, 0, 4)], 'spine_03')
    # --- helmet: a tall faceted lantern, a prow at the front, the visor slit wrapping round the front
    hc = Vector((0, -0.006, 1.665))
    prism(P, 'Armor', 'Head', hc, 'z', 0.27, 0.118, 0.13, sides=6, taper=(0.82, 0.72), phase=-math.pi / 2)
    vis = ring(hc, 'z', -0.012, 0.118, 0.13, 6, -math.pi / 2, 0.82 + 0.1 * 0.46)
    vis_hi = ring(hc, 'z', 0.022, 0.118, 0.13, 6, -math.pi / 2, 0.82 + 0.1 * 0.6)
    vv = [p + (p - hc).normalized() * 0.006 for p in vis] + [p + (p - hc).normalized() * 0.006 for p in vis_hi]
    # the two faces either side of the prow (vertex k=0 points to -Y): a slit wrapping the front third
    P.add('Visor', vv, [(k, (k + 1) % 6, 6 + (k + 1) % 6, 6 + k) for k in (5, 0)], 'Head')
    # the lantern's roof: an overhanging cap, and a fin on top
    prism(P, 'Armor', 'Head', (0, -0.006, 1.8), 'z', 0.035, 0.14, 0.155, sides=6, taper=(1.0, 0.8), phase=-math.pi / 2)
    prism(P, 'Armor', 'Head', (0, 0.02, 1.84), 'y', 0.24, 0.014, 0.045, sides=4, taper=(0.5, 1.0), phase=0)
    # --- arms and legs, left side (x > 0), then mirrored
    for side in ('l', 'r'):
        mx = (lambda p: Vector(p)) if side == 'l' else mirror
        b = lambda n: '%s_%s' % (n, side)
        # shoulder plates: big, raised, angled up and out
        prism(P, 'Armor', b('upperarm'), mx((0.25, 0.06, 1.485)), 'x', 0.24, 0.14, 0.12, sides=6, taper=(0.85, 1.05), lines=(1,))
        # forearm guards (the right one carries the emitter)
        prism(P, 'Armor', b('lowerarm'), mx((0.6, 0.066, 1.441)), 'x', 0.24, 0.072, 0.072, sides=6, taper=(0.85, 1.15), lines=(1,))
        if side == 'r':
            prism(P, 'Core', b('lowerarm'), mx((0.73, 0.066, 1.441)), 'x', 0.03, 0.088, 0.088, sides=8)
        # thigh and shin guards, knees, boots
        prism(P, 'Armor', b('thigh'), mx((0.095, 0.0, 0.79)), 'z', 0.26, 0.088, 0.095, sides=6, taper=(0.85, 1.1), lines=(4,))
        prism(P, 'Armor', b('calf'), mx((0.089, -0.012, 0.53)), 'z', 0.09, 0.065, 0.075, sides=6)
        prism(P, 'Armor', b('calf'), mx((0.089, -0.004, 0.31)), 'z', 0.32, 0.068, 0.075, sides=6, taper=(0.8, 1.1), lines=(4,))
        prism(P, 'Armor', b('foot'), mx((0.089, -0.07, 0.055)), 'y', 0.27, 0.068, 0.058, sides=6, taper=(0.7, 1.0))
    P.build(arm, mats)


# ----------------------------------------------------------------------------------------------- measuring, export
def measure_stride(arm, action):
    """Speed (m/s) of the planted foot of an in-place walk clip, and the cycle length (m)."""
    sc = bpy.context.scene
    act = bpy.data.actions[action]
    arm.data.pose_position = 'POSE'
    arm.animation_data.action = act
    if act.slots:
        arm.animation_data.action_slot = act.slots[0]
    f0, f1 = act.frame_range
    samples = []
    for f in range(int(f0), int(f1) + 1):
        sc.frame_set(f)
        for side in ('l', 'r'):
            p = arm.matrix_world @ arm.pose.bones['ball_' + side].head
            samples.append((f, side, p.y, p.z))
    speeds = []
    for side in ('l', 'r'):
        s = [x for x in samples if x[1] == side]
        low = min(x[3] for x in s)
        for a, c in zip(s, s[1:]):
            if a[3] < low + 0.02 and c[3] < low + 0.02:
                speeds.append((c[2] - a[2]) * sc.render.fps)  # the planted foot slides back (+Y) at the walking speed
    arm.animation_data.action = None
    v = sorted(speeds)[len(speeds) // 2] if speeds else 0.0
    dur = (f1 - f0) / sc.render.fps
    return v, v * dur, dur


def export(path, arm):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    arm.data.pose_position = 'POSE'
    arm.animation_data.action = None
    for a in bpy.data.actions:
        tr = arm.animation_data.nla_tracks.new()
        tr.name = a.name
        tr.strips.new(a.name, int(a.frame_range[0]), a)
        tr.mute = True
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        export_texcoords=False,
        export_normals=True,
        export_attributes=False,
        export_materials='EXPORT',
        export_skins=True,
        export_influence_nb=4,
        export_def_bones=False,
        export_morph=False,
        export_animations=True,
        export_animation_mode='NLA_TRACKS',
        export_force_sampling=True,
        export_frame_step=FRAME_STEP,
        export_optimize_animation_size=True,
        export_anim_single_armature=True,
        export_draco_mesh_compression_enable=False,
        export_lights=False,
        export_cameras=False,
        export_yup=True,
        export_apply=False,
    )
    for tr in list(arm.animation_data.nla_tracks):
        arm.animation_data.nla_tracks.remove(tr)
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
    print('exported %s (%.2f MB, %d triangles)' % (path, os.path.getsize(path) / 1e6, tris))


def preview(outdir, arm):
    """Quick Workbench stills: a turntable and a few poses on a dark background."""
    os.makedirs(outdir, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.render.resolution_x, sc.render.resolution_y = 420, 620
    w = bpy.data.worlds.new('preview')
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.01, 0.012, 0.016, 1)
    for loc, energy, col in (((-2.5, -3.0, 3.0), 300.0, (1, 1, 1)), ((3.0, 2.5, 2.5), 250.0, (0.6, 0.85, 1.0))):
        ld = bpy.data.lights.new('l', 'POINT')
        ld.energy = energy
        ld.color = col
        lo = bpy.data.objects.new('l', ld)
        lo.location = loc
        sc.collection.objects.link(lo)
    cam = bpy.data.cameras.new('cam')
    cam.lens = 45
    co = bpy.data.objects.new('cam', cam)
    sc.collection.objects.link(co)
    sc.camera = co
    arm.data.pose_position = 'POSE'

    def shoot(name, action, frac, angle, dist=3.8, height=1.0):
        act = bpy.data.actions[action]
        arm.animation_data.action = act
        if act.slots:
            arm.animation_data.action_slot = act.slots[0]
        f0, f1 = act.frame_range
        fr = f0 + (f1 - f0) * frac
        sc.frame_set(int(fr), subframe=fr - int(fr))
        a = math.radians(angle)
        co.location = (math.sin(a) * dist, -math.cos(a) * dist, height + 0.2)
        co.rotation_euler = (math.radians(86), 0, a)
        sc.render.filepath = os.path.join(outdir, name + '.png')
        bpy.ops.render.render(write_still=True)

    for ang in (20, 120, 200):
        shoot('turn_%03d' % ang, 'idle', 0.0, ang)
    for name in ('post', 'walk', 'search_walk', 'run', 'scan', 'check', 'alert', 'strike', 'shoot', 'hit', 'death'):
        shoot('pose_' + name, name, 0.5 if name not in ('strike', 'shoot') else 0.45, 30)
    shoot('close_front', 'idle', 0.0, 15, dist=1.5, height=1.45)
    arm.animation_data.action = None


def main():
    opts = parse_args()
    arm, body = load_base(opts['src'])
    mats = make_materials()
    build_body(arm, body, mats)
    build_armor(arm, mats)
    for clip in ('walk', 'search_walk', 'run'):
        v, stride, dur = measure_stride(arm, clip)
        print('STRIDE %s: %.3f m/s, %.3f m per %.3f s cycle' % (clip, v, stride, dur))
    arm.data.pose_position = 'REST'
    if opts['blend']:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(opts['blend']))
    if opts['preview']:
        preview(os.path.abspath(opts['preview']), arm)
        arm.data.pose_position = 'REST'
    export(os.path.abspath(opts['out']), arm)


if __name__ == '__main__':
    main()
