"""Uninvited - the hero (H10) build.

Blender 4.5, headless:
    blender -b --python tools/hero/build.py -- --src <quaternius dir> [--out assets/models/hero.glb]
                                                [--preview <dir>] [--blend <file.blend>]

Takes the Quaternius Universal Animation Library 1 + 2 (CC0, "Standard", in-place Unreal-Godot glb files) - one
65-bone rig, the "Mannequin" body and the clips - and builds the H10 hero on top of it procedurally:
  * the segmented mannequin is voxel-remeshed into one smooth, seamless suit (weights carried over and blurred so the
    joints bend softly), with raised armor plates cut out of its surface (shoulders, forearms, knees, shins),
  * a few clean neon lines on the suit (material "NeonLines"),
  * a long open coat with a high stand-up collar, skinned to the spine and to twelve three-bone coat chains
    (coat_l1_a/b/c .. coat_r6_a/b/c) that the game drives at runtime, the hem split into tapering strips, a dim
    glowing trim (material "Trim") along the collar and the front edges,
  * glowing filaments hanging from the strips (mesh "Filaments", per-vertex "_glow" 1 -> 0 toward the tips),
  * a hood (skinned to head / neck / chest) whose lower edge tucks inside the collar, a trim around the face opening
    and a white visor strip inside (material "Visor"),
  * a holographic wrist display on the left forearm (material "Holo"),
  * the gunblade in the right hand: empty "Gunblade" (sword grip) with "GunBody", the glowing "GunCore", the blade
    mesh "Blade" and the empty "Muzzle"; the empty "RifleHold" is the gun's transform for rifle mode (bigger, the game
    blends between the two).
Only the clips the game uses are kept, renamed to the game's names (CLIPS below), and exported as one glb.
Everything is deterministic (seeded random), so a rebuild gives the same file.
"""
import bpy
import bmesh
import math
import os
import random
import sys
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.interpolate import poly_3d_calc

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))

# (name in the glb, source clip, pack)
CLIPS = [
    ('idle', 'Idle_Loop', 1),
    ('idle_rifle', 'Pistol_Idle_Loop', 1),
    ('walk', 'Walk_Loop', 1),
    ('run', 'Jog_Fwd_Loop', 1),
    ('sprint', 'Sprint_Loop', 1),
    ('crouch_idle', 'Crouch_Idle_Loop', 1),
    ('crouch_walk', 'Crouch_Fwd_Loop', 1),
    ('jump_start', 'Jump_Start', 1),
    ('jump_loop', 'Jump_Loop', 1),
    ('jump_land', 'Jump_Land', 1),
    ('dash', 'Sword_Dash', 2),
    ('slash_a', 'Sword_Regular_A', 2),
    ('slash_b', 'Sword_Regular_B', 2),
    ('slash_c', 'Sword_Attack', 1),
    ('aim', 'Pistol_Aim_Neutral', 1),
    ('shoot', 'Pistol_Shoot', 1),
    ('hit', 'Hit_Chest', 1),
    ('death', 'Death01', 1),
    ('hack', 'Spell_Simple_Idle_Loop', 1),
]

ARM_GROUPS = ('upperarm', 'lowerarm', 'hand', 'thumb', 'index', 'middle', 'ring', 'pinky')
HAND_GROUPS = ('hand_', 'thumb_', 'index_', 'middle_', 'ring_', 'pinky_')
TORSO_ALLOWED = ('pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'clavicle_l', 'clavicle_r')

# the smooth suit
BODY_VOXEL = 0.006   # voxel remesh size: closes the gaps between the mannequin's segments
BODY_SMOOTH = 30     # smoothing iterations after the remesh (the hands are left alone)
BODY_TRIS = 20000    # decimated to about this many triangles
WEIGHT_BLUR = 5      # neighbour-averaging passes over the carried-over weights (soft joints)

rng = random.Random(1031)


# ----------------------------------------------------------------------------------------------- small helpers
def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    opts = {'src': os.environ.get('QUATERNIUS_DIR', ''), 'out': os.path.join(ROOT, 'assets', 'models', 'hero.glb'),
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


def smoothstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def dir_at(theta_deg):
    """Horizontal direction around the body: 0 = front (-Y), 90 = the hero's left (+X), 180 = back (+Y)."""
    t = math.radians(theta_deg)
    return Vector((math.sin(t), -math.cos(t), 0.0))


def theta_of(v):
    """Inverse of dir_at for a horizontal vector, degrees 0..360."""
    return math.degrees(math.atan2(v.x, -v.y)) % 360.0


def material(name, base, rough=0.5, metal=0.0, emit=None, strength=1.0, alpha=1.0, double=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*base, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if emit:
        bsdf.inputs['Emission Color'].default_value = (*emit, 1.0)
        bsdf.inputs['Emission Strength'].default_value = strength
    if alpha < 1.0:
        bsdf.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'BLENDED'
    m.use_backface_culling = not double
    return m


def new_object(name, verts, faces, mats, face_mats=None, smooth=True, parent=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    for m in mats:
        me.materials.append(m)
    if face_mats:
        for p, mi in zip(me.polygons, face_mats):
            p.material_index = mi
    for p in me.polygons:
        p.use_smooth = smooth
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    if parent:
        ob.parent = parent
    return ob


def add_groups(ob, weights):
    """weights: one {bone: w} dict per vertex; limited to the 4 strongest, normalized."""
    groups = {}
    for i, w in enumerate(weights):
        top = sorted(w.items(), key=lambda kv: -kv[1])[:4]
        s = sum(v for _, v in top) or 1.0
        for bone, v in top:
            if v / s < 1e-3:
                continue
            g = groups.get(bone) or ob.vertex_groups.get(bone) or ob.vertex_groups.new(name=bone)
            groups[bone] = g
            g.add([i], v / s, 'REPLACE')


def bind(ob, arm):
    mod = ob.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm
    ob.parent = arm


def skin(ob, arm, weights):
    add_groups(ob, weights)
    bind(ob, arm)


def set_attr(ob, name, values):
    a = ob.data.attributes.new(name=name, type='FLOAT', domain='POINT')
    for i, v in enumerate(values):
        a.data[i].value = v


def apply_modifier(ob, mod_name):
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.selected_objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.ops.object.modifier_apply(modifier=mod_name)


def ribbon(points, normals, width, taper=0.25):
    """A flat strip along a polyline, lying on the surface given by the normals. Returns verts, faces."""
    n = len(points)
    verts, faces = [], []
    for i in range(n):
        t = (points[min(n - 1, i + 1)] - points[max(0, i - 1)]).normalized()
        side = normals[i].cross(t).normalized()
        k = min(1.0, min(i, n - 1 - i) / 2.0)  # rounded ends
        w = width * (taper + (1 - taper) * k) / 2
        verts += [points[i] + side * w, points[i] - side * w]
    for i in range(n - 1):
        a = i * 2
        faces.append((a, a + 1, a + 3, a + 2))
    return verts, faces


def mesh_tris(me):
    """Fan-triangulated polygons of a mesh, as vertex index triples."""
    tris = []
    for p in me.polygons:
        vs = list(p.vertices)
        for k in range(1, len(vs) - 1):
            tris.append((vs[0], vs[k], vs[k + 1]))
    return tris


def mesh_bvh(*obs):
    verts, polys = [], []
    for ob in obs:
        base = len(verts)
        verts += [v.co.copy() for v in ob.data.vertices]
        polys += [[base + i for i in p.vertices] for p in ob.data.polygons]
    return BVHTree.FromPolygons(verts, polys)


# ----------------------------------------------------------------------------------------------- the base
def load_base(src):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 24
    ual1 = find_file(src, 'UAL1_Standard.glb')
    ual2 = find_file(src, 'UAL2_Standard.glb')
    bpy.ops.import_scene.gltf(filepath=ual1)
    pack1 = {a.name: a for a in bpy.data.actions}
    keep = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=ual2)
    pack2 = {a.name.split('.')[0]: a for a in bpy.data.actions if a.name not in pack1 or a.name.endswith('.001')}
    for o in list(bpy.data.objects):
        if o not in keep:
            bpy.data.objects.remove(o)
    bpy.data.objects.remove(bpy.data.objects['Icosphere'])
    arm = bpy.data.objects['Armature']
    body = bpy.data.objects['Mannequin']
    # clips: keep and rename the ones the game uses, drop the rest
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
    arm.animation_data.action = None
    for tr in list(arm.animation_data.nla_tracks):  # the importer stacks every clip as an NLA track
        arm.animation_data.nla_tracks.remove(tr)
    arm.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    return arm, body


class Body:
    """A rest-pose body mesh: BVH for ray casts and nearest points, per-vertex bone weights and normals."""

    def __init__(self, ob):
        me = ob.data
        self.v = [v.co.copy() for v in me.vertices]
        self.n = [v.normal.copy() for v in me.vertices]
        self.polys = [list(p.vertices) for p in me.polygons]
        self.mat = [p.material_index for p in me.polygons]
        self.bvh = BVHTree.FromPolygons(self.v, self.polys)
        names = [g.name for g in ob.vertex_groups]
        self.w = [{names[g.group]: g.weight for g in v.groups if g.weight > 0} for v in me.vertices]
        self.dom = [max(w, key=w.get) if w else '' for w in self.w]

    def weights_at(self, p, allowed=None):
        loc, _, idx, _ = self.bvh.find_nearest(p)
        poly = self.polys[idx]
        bary = poly_3d_calc([self.v[i] for i in poly], loc)
        acc = {}
        for vi, b in zip(poly, bary):
            for g, w in self.w[vi].items():
                if allowed and not g.startswith(allowed):
                    continue
                acc[g] = acc.get(g, 0.0) + w * b
        return acc

    def dom_at(self, p):
        _, _, idx, _ = self.bvh.find_nearest(p)
        return self.dom[self.polys[idx][0]]

    def is_arm(self, i):
        return self.dom[i].startswith(ARM_GROUPS)


# ----------------------------------------------------------------------------------------------- the smooth suit
def smooth_body(arm, body, B, mats):
    """Remesh the segmented mannequin into one closed surface, smooth it, decimate it, carry the weights over."""
    for m in list(body.modifiers):
        body.modifiers.remove(m)
    body.vertex_groups.clear()
    me = body.data
    while me.uv_layers:
        me.uv_layers.remove(me.uv_layers[0])
    rem = body.modifiers.new('Remesh', 'REMESH')
    rem.mode = 'VOXEL'
    rem.voxel_size = BODY_VOXEL
    rem.use_smooth_shade = True
    apply_modifier(body, 'Remesh')
    me = body.data
    keep = body.vertex_groups.new(name='_smooth')  # the hands keep their fingers
    for v in me.vertices:
        keep.add([v.index], 0.0 if B.dom_at(v.co).startswith(HAND_GROUPS) else 1.0, 'REPLACE')
    sm = body.modifiers.new('Smooth', 'SMOOTH')
    sm.iterations = BODY_SMOOTH
    sm.factor = 0.6
    sm.vertex_group = '_smooth'
    apply_modifier(body, 'Smooth')
    body.vertex_groups.clear()
    dec = body.modifiers.new('Decimate', 'DECIMATE')
    dec.ratio = BODY_TRIS / max(1.0, 2.0 * len(body.data.polygons))
    apply_modifier(body, 'Decimate')
    me = body.data
    me.materials.clear()
    me.materials.append(mats['Suit'])
    me.materials.append(mats['SuitJoints'])
    # weights: from the source surface, then blurred over the new mesh so the joints bend softly
    weights = [B.weights_at(v.co) for v in me.vertices]
    nbr = [[] for _ in me.vertices]
    for e in me.edges:
        a, b = e.vertices
        nbr[a].append(b)
        nbr[b].append(a)
    for _ in range(WEIGHT_BLUR):
        nxt = []
        for i, w in enumerate(weights):
            acc = dict(w)
            for j in nbr[i]:
                for g, x in weights[j].items():
                    acc[g] = acc.get(g, 0.0) + x
            s = sum(acc.values()) or 1.0
            nxt.append({g: x / s for g, x in acc.items() if x / s > 1e-3})
        weights = nxt
    # the joint material where the mannequin had it (the darker, glossier bands)
    for p in me.polygons:
        _, _, idx, _ = B.bvh.find_nearest(p.center)
        p.material_index = B.mat[idx]
        p.use_smooth = True
    skin(body, arm, weights)
    body.name = 'Body'
    me.name = 'Body'
    bpy.context.view_layer.update()
    return Body(body)


# ----------------------------------------------------------------------------------------------- armor plates
# (bone, s0, s1, reference direction (rest pose, left side), half-angle at s0, at s1 (deg), max distance from the bone)
PLATES = [
    ('upperarm_l', -0.16, 0.40, (0.0, 0.15, 1.0), 80, 62, 0.085),   # shoulder
    ('lowerarm_l', 0.14, 0.70, (0.0, 0.45, 1.0), 58, 46, 0.07),     # forearm guard
    ('thigh_l', 0.88, 1.10, (0.0, -1.0, 0.05), 52, 52, 0.1),        # knee cap
    ('calf_l', 0.16, 0.80, (0.15, -1.0, 0.0), 62, 34, 0.09),        # shin guard
    ('thigh_l', 0.18, 0.62, (1.0, -0.15, 0.0), 40, 30, 0.12),       # outer thigh
]
ARMOR_LIFT = 0.0045
ARMOR_THICK = 0.0045


def plate_field(bones, plate, side):
    """A scalar field over the body, > 0 inside the plate, in metres to its edge."""
    name, s0, s1, ref, h0, h1, rmax = plate
    if side < 0:
        name = name[:-2] + '_r'
        ref = (-ref[0], ref[1], ref[2])
    b = bones[name]
    h, t = b.head_local, b.tail_local
    u = (t - h)
    L = u.length
    u = u / L
    refv = Vector(ref)
    refv = (refv - u * refv.dot(u)).normalized()

    def f(p):
        s = (p - h).dot(u) / L
        q = p - (h + u * (s * L))
        r = q.length
        if r > rmax or r < 1e-6:
            return -1.0
        ang = q.angle(refv)
        half = math.radians(lerp(h0, h1, max(0.0, min(1.0, (s - s0) / (s1 - s0)))))
        ends = min((s - s0) * L, (s1 - s) * L)
        # chamfered corners: the edge distance also limited by a diagonal
        return min(ends, (half - ang) * r, 0.7 * (ends + (half - ang) * r))
    return f


def build_armor(arm, B, mats):
    """Plates cut out of the smooth suit along clean outlines, lifted off it and given a thickness."""
    bones = arm.data.bones
    tris = []
    for p in B.polys:
        for k in range(1, len(p) - 1):
            tris.append((p[0], p[k], p[k + 1]))
    verts, faces, weights, nrms = [], [], [], []
    for side in (1, -1):
        for plate in PLATES:
            f = plate_field(bones, plate, side)
            fv = {}
            vmap = {}

            def fval(i):
                if i not in fv:
                    fv[i] = f(B.v[i])
                return fv[i]

            def vert(i):
                key = ('v', i)
                if key not in vmap:
                    vmap[key] = len(verts)
                    verts.append(B.v[i].copy())
                    nrms.append(B.n[i].copy())
                    weights.append(dict(B.w[i]))
                return vmap[key]

            def edge(i, j):
                a, b = min(i, j), max(i, j)
                key = ('e', a, b)
                if key not in vmap:
                    fa, fb = fval(a), fval(b)
                    t = fa / (fa - fb)
                    vmap[key] = len(verts)
                    verts.append(B.v[a].lerp(B.v[b], t))
                    nrms.append(B.n[a].lerp(B.n[b], t).normalized())
                    w = {}
                    for g, x in B.w[a].items():
                        w[g] = w.get(g, 0.0) + x * (1 - t)
                    for g, x in B.w[b].items():
                        w[g] = w.get(g, 0.0) + x * t
                    weights.append(w)
                return vmap[key]

            for tri in tris:
                if all(fval(i) <= 0 for i in tri):
                    continue
                poly = []
                for k in range(3):
                    i, j = tri[k], tri[(k + 1) % 3]
                    if fval(i) > 0:
                        poly.append(vert(i))
                    if (fval(i) > 0) != (fval(j) > 0):
                        poly.append(edge(i, j))
                if len(poly) >= 3:
                    faces.append(poly)
    verts = [v + n * ARMOR_LIFT for v, n in zip(verts, nrms)]
    ob = new_object('Armor', verts, faces, [mats['Armor']])
    add_groups(ob, weights)
    sol = ob.modifiers.new('Solid', 'SOLIDIFY')
    sol.thickness = ARMOR_THICK
    sol.offset = 1.0
    sol.use_even_offset = True
    sol.use_rim = True
    apply_modifier(ob, 'Solid')
    for p in ob.data.polygons:
        p.use_smooth = True
    bind(ob, arm)
    return ob


# ----------------------------------------------------------------------------------------------- neon lines
def neon_lines(arm, B, bvh, mats):
    """Ribbons traced on the suit (and over the armor plates): rays come from outside, so they ride the top surface."""
    bones = arm.data.bones

    def axis(name, t):
        b = bones[name]
        return b.head_local.lerp(b.tail_local, t)

    def cast(o, d, reach):
        hit, n, _, _ = bvh.ray_cast(o + d * reach, -d, reach * 1.5)
        return hit, n

    def trace(samples, reach, off=0.0035):
        pts, dirs = [], []
        for o, d in samples:
            d = d.normalized()
            hit, _ = cast(o, d, reach)
            if hit is not None:
                pts.append(hit)
                dirs.append(d)
        # smooth the faceted path, then put it back on the surface
        for _ in range(3):
            pts = [pts[0]] + [(pts[i - 1] + pts[i] * 2 + pts[i + 1]) / 4 for i in range(1, len(pts) - 1)] + [pts[-1]]
        out_p, out_n = [], []
        for p, d in zip(pts, dirs):
            hit, n = cast(p, d, 0.04)
            if hit is None:
                hit, n, _, _ = bvh.find_nearest(p)
            out_p.append(hit + n * off)
            out_n.append(n)
        for _ in range(2):
            out_n = [out_n[0]] + [(out_n[i - 1] + out_n[i] + out_n[i + 1]).normalized() for i in range(1, len(out_n) - 1)] + [out_n[-1]]
        return out_p, out_n

    paths = []
    n = 60
    # legs: down the outer side of the thigh, turning to the front of the shin
    leg = []
    for i in range(n + 1):
        s = i / n
        o = axis('thigh_l', 0.1 + s / 0.5 * 0.9) if s < 0.5 else axis('calf_l', (s - 0.5) / 0.5 * 0.86)
        d = Vector((1.0, -0.2, 0.0)).lerp(Vector((0.25, -1.0, 0.0)), smoothstep(0.25, 0.8, s))
        leg.append((o, d, 0.16))
    paths.append(leg)
    # arms: along the top-back of the arm (the outer back side once the arm hangs), shoulder to wrist
    armp = []
    for i in range(n + 1):
        s = i / n
        o = axis('upperarm_l', 0.12 + s / 0.5 * 0.88) if s < 0.5 else axis('lowerarm_l', (s - 0.5) / 0.5 * 0.9)
        armp.append((o, Vector((0.0, 0.55, 1.0)), 0.14))
    paths.append(armp)
    # chest: from the collarbone down to the belt (seen through the open coat)
    chest = []
    for i in range(40 + 1):
        s = i / 40
        z = lerp(1.43, 1.0, s)
        x = lerp(0.105, 0.04, smoothstep(0.0, 1.0, s))
        chest.append((Vector((x, 0.02, z)), Vector((0.0, -1.0, 0.0)), 0.25))
    paths.append(chest)

    verts, faces, weights = [], [], []
    for path in paths:
        for side in (1, -1):
            samples = [(Vector((o.x * side, o.y, o.z)), Vector((d.x * side, d.y, d.z))) for o, d, _ in path]
            pts, nrm = trace(samples, path[0][2])
            v, f = ribbon(pts, nrm, 0.010)
            if side < 0:  # mirrored: keep the faces pointing out
                f = [tuple(reversed(face)) for face in f]
            base = len(verts)
            verts += v
            faces += [tuple(base + k for k in face) for face in f]
            weights += [B.weights_at(p) for p in v]
    ob = new_object('SuitLines', verts, faces, [mats['NeonLines']])
    skin(ob, arm, weights)
    return ob


# ----------------------------------------------------------------------------------------------- the coat
GAP = 30.0          # half-angle of the open front, degrees
TRIM_DEG = 2.2      # width of the glowing trim along the front edges, degrees
TRIM_H = 0.008      # height of the trim along the collar's top edge, m
Z_HIP = 0.98        # the skirt starts below this
Z_CUT = 0.80        # the hem splits into strips below this
Z_SHOULDER = 1.42   # above: the collar rows (their top follows collar_top), below: even rows
ROW_STEP = 0.025
COLLAR_ROWS = 9
COLS = 104          # columns around the coat (plus the trim and seam columns)
STRIP_COLS = 6      # columns per hem strip
CHAINS = [('l1', 40.0), ('l2', 66.0), ('l3', 94.0), ('l4', 122.0), ('l5', 148.0), ('l6', 170.0),
          ('r6', 190.0), ('r5', 212.0), ('r4', 238.0), ('r3', 266.0), ('r2', 294.0), ('r1', 320.0)]
CHAIN_Z = (Z_HIP - 0.01, 0.74, 0.53, 0.31)  # coat bone joints: a, b, c; a leaf d marks where c points
CHAIN_OUT = (0.0, 0.08, 0.125, 0.155)        # how far each joint sits out from the hip ring
LINE_THETAS = (152.0, 208.0)  # the coat's two back seams
LINE_HALF = 1.2
GUN_SCALE = 1.25    # the gunblade is modelled at 1:1 and shown a bit larger
RIFLE_SCALE = 1.75  # and larger still in rifle mode, so it reads from the third-person camera
FLARE = 0.42        # how fast the skirt widens going down (m per m)


def collar_top(theta):
    """Height of the collar's top edge: high at the back, sloping down to the open front."""
    f = 1.0 - abs(theta - 180.0) / (180.0 - GAP)
    return 1.50 + 0.135 * smoothstep(0.0, 1.0, f ** 0.75)


def collar_r(z, theta):
    """The stand-up collar: a wide, slightly flared ring around the neck that the hood tucks into."""
    back = 0.5 - 0.5 * math.cos(math.radians(theta))
    return lerp(0.125, 0.19, smoothstep(1.46, 1.64, z)) * (0.95 + 0.07 * back)


def hull2d(pts):
    pts = sorted(set((round(p[0], 5), round(p[1], 5)) for p in pts))
    if len(pts) < 3:
        return pts

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def hull_radius(hull, cx, cy, theta):
    """Distance from (cx, cy) to the hull boundary along the direction theta."""
    d = dir_at(theta)
    best = 0.0
    n = len(hull)
    for i in range(n):
        ax, ay = hull[i][0] - cx, hull[i][1] - cy
        bx, by = hull[(i + 1) % n][0] - cx, hull[(i + 1) % n][1] - cy
        ex, ey = bx - ax, by - ay
        den = d.x * ey - d.y * ex
        if abs(den) < 1e-9:
            continue
        t = (ax * ey - ay * ex) / den
        u = (ax * d.y - ay * d.x) / den
        if t > 0 and -1e-6 <= u <= 1 + 1e-6:
            best = max(best, t)
    return best


def coat_columns():
    thetas = [GAP, 360.0 - GAP]
    a0, a1 = GAP + TRIM_DEG, 360.0 - GAP - TRIM_DEG
    for i in range(COLS + 1):
        thetas.append(a0 + (a1 - a0) * i / COLS)
    for lt in LINE_THETAS:
        thetas += [lt - LINE_HALF, lt + LINE_HALF]
    thetas = sorted(thetas)
    # drop uniform columns that crowd a line edge
    out = []
    for t in thetas:
        edge = any(abs(t - (lt + s * LINE_HALF)) < 1e-6 for lt in LINE_THETAS for s in (-1, 1))
        near = any(abs(t - lt) < LINE_HALF + 1.2 for lt in LINE_THETAS)
        if near and not edge:
            continue
        out.append(t)
    return out


def coat_profile(B, thetas):
    """Radius table r[row][col] and the axis center per row, from the body's convex cross-sections."""
    zs = []
    z = 1.65
    while z > 0.18:
        zs.append(round(z, 4))
        z -= 0.025 if z > 1.38 else 0.035
    rows = []
    for z in zs:
        band = 0.03
        pts = [(p.x, p.y) for i, p in enumerate(B.v) if abs(p.z - z) < band and not B.is_arm(i)
               and not (B.dom[i] == 'Head' and z < 1.62)]
        rows.append((z, pts))
    centers, radii = [], []
    for z, pts in rows:
        if len(pts) < 3:
            pts = rows[-1][1]
        h = hull2d(pts)
        cy = 0.012
        r = [hull_radius(h, 0.0, cy, t) for t in thetas]
        if z >= Z_HIP:
            r = [x + 0.02 + 0.01 * smoothstep(1.38, 1.48, z) for x in r]
        else:
            r = [x + 0.045 for x in r]
        if z >= 1.44:
            k = smoothstep(1.44, 1.52, z)
            r = [lerp(x, max(x, collar_r(z, t)), k) for x, t in zip(r, thetas)]
        centers.append(Vector((0.0, cy, z)))
        radii.append(r)
    # smooth across the columns and the rows
    for _ in range(4):
        radii = [[(row[max(0, i - 1)] + 2 * row[i] + row[min(len(row) - 1, i + 1)]) / 4 for i in range(len(row))] for row in radii]
    for _ in range(2):
        radii = [[(radii[max(0, j - 1)][i] + 2 * radii[j][i] + radii[min(len(radii) - 1, j + 1)][i]) / 4
                  for i in range(len(thetas))] for j in range(len(radii))]
    # the skirt never tucks in going down and flares out
    for j in range(1, len(zs)):
        if zs[j] < Z_HIP:
            dz = zs[j - 1] - zs[j]
            radii[j] = [max(radii[j][i], radii[j - 1][i] + FLARE * dz) for i in range(len(thetas))]
    return zs, centers, radii


def chain_blend(theta):
    """(chain a, chain b, t) for a coat angle."""
    if theta <= CHAINS[0][1]:
        return CHAINS[0][0], CHAINS[0][0], 0.0
    if theta >= CHAINS[-1][1]:
        return CHAINS[-1][0], CHAINS[-1][0], 0.0
    for (na, ta), (nb, tb) in zip(CHAINS, CHAINS[1:]):
        if ta <= theta <= tb:
            return na, nb, (theta - ta) / (tb - ta)
    return CHAINS[0][0], CHAINS[0][0], 0.0


def skirt_weights(theta, z):
    wp = smoothstep(0.86, Z_HIP - 0.01, z)
    # along the chain: bone a above CHAIN_Z[1], b down to CHAIN_Z[2], c below, with soft overlaps at the joints
    x = 0.06
    ka = smoothstep(CHAIN_Z[1] - x, CHAIN_Z[1] + x, z)
    kb = (1 - ka) * smoothstep(CHAIN_Z[2] - x, CHAIN_Z[2] + x, z)
    kc = 1 - ka - kb
    na, nb, t = chain_blend(theta)
    w = {}

    def add(k, v):
        if v > 1e-4:
            w[k] = w.get(k, 0.0) + v

    add('pelvis', wp)
    for seg, ks in (('a', ka), ('b', kb), ('c', kc)):
        add('coat_%s_%s' % (na, seg), (1 - wp) * ks * (1 - t))
        add('coat_%s_%s' % (nb, seg), (1 - wp) * ks * t)
    return w


def blend_weights(a, b, t):
    out = {}
    for k, v in a.items():
        out[k] = out.get(k, 0.0) + v * (1 - t)
    for k, v in b.items():
        out[k] = out.get(k, 0.0) + v * t
    return out


def push_out(B, p, margin, skip_arms=True):
    loc, n, idx, d = B.bvh.find_nearest(p)
    if loc is None:
        return p
    if skip_arms and B.is_arm(B.polys[idx][0]):
        return p
    inside = (p - loc).dot(n) < 0
    if inside or d < margin:
        return loc + n * margin
    return p


def build_coat(arm, B, mats):
    thetas = coat_columns()
    zs, centers, radii = coat_profile(B, thetas)
    nc = len(thetas)

    def radius(z, col_f):
        """Radius at height z for a fractional column index."""
        j = 0
        while j < len(zs) - 2 and zs[j + 1] > z:
            j += 1
        tz = max(0.0, min(1.0, (zs[j] - z) / (zs[j] - zs[j + 1])))
        i = max(0, min(nc - 2, int(col_f)))
        ti = col_f - i
        r0 = lerp(radii[j][i], radii[j][i + 1], ti)
        r1 = lerp(radii[j + 1][i], radii[j + 1][i + 1], ti)
        return lerp(r0, r1, tz), lerp(centers[j], centers[j + 1], tz)

    def pos(z, col_f, theta):
        r, c = radius(z, col_f)
        return c + dir_at(theta) * r

    verts, faces, fmat, weights, glow = [], [], [], [], []
    # --- the continuous part: collar to Z_CUT. Rows above Z_SHOULDER follow the sloping collar top per column.
    even = []
    z = Z_SHOULDER
    while z > Z_CUT + ROW_STEP * 0.5:
        even.append(z)
        z -= ROW_STEP
    even.append(Z_CUT)
    nrows = 2 + COLLAR_ROWS + len(even)

    def col_rows(theta):
        top = collar_top(theta)
        rows = [top, top - TRIM_H]
        for k in range(1, COLLAR_ROWS + 1):
            rows.append(lerp(top - TRIM_H, Z_SHOULDER, k / (COLLAR_ROWS + 1)))
        return rows + even

    grid = [[0] * nc for _ in range(nrows)]
    zgrid = [[0.0] * nc for _ in range(nrows)]
    for i, t in enumerate(thetas):
        for j, z in enumerate(col_rows(t)):
            p = pos(z, i, t)
            grid[j][i] = len(verts)
            zgrid[j][i] = z
            verts.append(p)
            if z >= Z_HIP + 0.04:
                w = B.weights_at(p, TORSO_ALLOWED)
                s_ = sum(w.values())
                if s_ < 0.5:  # next to the arms: hold on to the chest instead
                    w['spine_03' if z > 1.3 else 'spine_02'] = w.get('spine_03' if z > 1.3 else 'spine_02', 0.0) + 0.5 - s_
                if 'neck_01' in w and z > 1.5:  # the collar stands with the neck but not with the head
                    w['spine_03'] = w.get('spine_03', 0.0) + w['neck_01'] * 0.4
                    w['neck_01'] *= 0.6
            elif z >= Z_HIP - 0.04:
                k = smoothstep(Z_HIP + 0.04, Z_HIP - 0.04, z)
                w = blend_weights(B.weights_at(p, TORSO_ALLOWED), skirt_weights(t, z), k)
            else:
                w = skirt_weights(t, z)
            weights.append(w)
            glow.append(0.0)

    def is_line(t0, t1, z):
        mid = (t0 + t1) / 2
        return any(abs(mid - lt) < LINE_HALF for lt in LINE_THETAS) and 0.7 < z < 1.43

    def is_trim(i, j):
        return j == 0 or i == 0 or i == nc - 2

    for j in range(nrows - 1):
        for i in range(nc - 1):
            faces.append((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
            zm = (zgrid[j][i] + zgrid[j + 1][i]) / 2
            fmat.append(2 if is_trim(i, j) and zm > Z_CUT + 0.02 else 1 if is_line(thetas[i], thetas[i + 1], zm) else 0)

    # --- the strips: split below Z_CUT, each tapering to its own tip
    bounds = [0]
    i = 0
    while i < nc - 1:
        nxt = min(nc - 1, i + STRIP_COLS)
        # keep each back-seam line column inside one strip
        for lt in LINE_THETAS:
            for k in range(i + 1, nxt + 1):
                if abs(thetas[k] - (lt + LINE_HALF)) < 1e-6 or abs(thetas[k] - (lt - LINE_HALF)) < 1e-6:
                    nxt = max(nxt, k + 1 if thetas[k] < lt else k)
        nxt = min(nc - 1, nxt)
        if nc - 1 - nxt < 3:
            nxt = nc - 1
        bounds.append(nxt)
        i = nxt
    strips = []
    for c0, c1 in zip(bounds, bounds[1:]):
        tc = (thetas[c0] + thetas[c1]) / 2
        from_back = abs(180.0 - tc) / (180.0 - GAP)
        hem = 0.33 + 0.15 * from_back ** 2 + rng.uniform(-0.05, 0.05)
        strips.append((c0, c1, tc, hem))
    tips = []
    for c0, c1, tc, hem in strips:
        rows = [Z_CUT]
        z = Z_CUT
        while z - 0.03 > hem + 0.008:
            z -= 0.032 if z > hem + 0.15 else 0.018
            rows.append(z)
        rows.append(hem)
        cols = list(range(c0, c1 + 1))
        sgrid = [[grid[-1][i] for i in cols]]  # the top row is the continuous part's bottom row
        for j, z in enumerate(rows):
            if j == 0:
                continue
            s = (Z_CUT - z) / (Z_CUT - hem)
            wf = 1.0 - 0.8 * smoothstep(0.45, 1.0, s)
            row = []
            for i in cols:
                t = lerp(tc, thetas[i], wf)
                cf = c0 + (i - c0) * wf + (c1 - c0) * (1 - wf) / 2  # fractional column for the radius lookup
                row.append(len(verts))
                verts.append(pos(z, cf, t))
                k = smoothstep(Z_CUT, Z_CUT - 0.1, z)
                weights.append(skirt_weights(lerp(thetas[i], tc, k), z))
                edge = 1.0 if i in (c0, c1) else 0.35
                glow.append(smoothstep(0.25, 1.0, s) ** 2 * (0.4 + 0.6 * edge))
            sgrid.append(row)
        for j in range(len(sgrid) - 1):
            for i in range(len(cols) - 1):
                faces.append((sgrid[j][i], sgrid[j][i + 1], sgrid[j + 1][i + 1], sgrid[j + 1][i]))
                fmat.append(1 if is_line(thetas[cols[i]], thetas[cols[i + 1]], (rows[j] + rows[j + 1]) / 2) else 0)
        tips.append((sgrid, cols, rows, tc))
    ob = new_object('Coat', verts, faces, [mats['Coat'], mats['NeonLines'], mats['Trim']], fmat)
    me = ob.data
    # keep the coat off the body (rest pose)
    for i, v in enumerate(me.vertices):
        v.co = push_out(B, v.co.copy(), 0.012 if v.co.z > Z_HIP else 0.03)
    for p in me.polygons:
        p.use_smooth = True
    skin(ob, arm, weights)
    set_attr(ob, '_glow', glow)

    def coat_r(z, theta):
        """The coat's rest radius at a height and angle (the collar ring inside the open front)."""
        if theta <= thetas[0] or theta >= thetas[-1]:
            return collar_r(z, theta)
        i = 0
        while thetas[i + 1] < theta:
            i += 1
        return radius(z, i + (theta - thetas[i]) / (thetas[i + 1] - thetas[i]))[0]
    return ob, tips, coat_r


def build_filaments(arm, coat_tips, coat_pts, mats):
    """Fine glowing filaments hanging from the lower edge of every strip (one ribbon each; "_glow" is 1 at the root
    and fades to 0 at the tip, the game's shader uses it for the fade and for a gentle sway)."""
    verts, faces, weights, glow = [], [], [], []
    for sgrid, cols, rows, tc in coat_tips:
        last, prev = sgrid[-1], sgrid[max(0, len(sgrid) - 2)]
        for f in range(4):
            u = (f + 0.5) / 4 + rng.uniform(-0.08, 0.08)
            x = u * (len(last) - 1)
            i = min(len(last) - 2, int(x))
            k = x - i
            lo = coat_pts[last[i]].lerp(coat_pts[last[i + 1]], k)
            hi = coat_pts[prev[i]].lerp(coat_pts[prev[i + 1]], k)
            root = lo.lerp(hi, rng.uniform(0.0, 0.5) if f in (1, 2) else rng.uniform(0.3, 0.9))
            length = min(rng.uniform(0.14, 0.38), root.z - 0.03)
            if length < 0.06:
                continue
            out = Vector((root.x, root.y - 0.012, 0.0)).normalized()
            side = Vector((0, 0, 1)).cross(out)
            amp = rng.uniform(0.008, 0.025)
            ph = rng.uniform(0, math.tau)
            freq = rng.uniform(0.8, 1.8)
            segs = 10
            pts = [root + Vector((0, 0, -length * t)) + side * (amp * math.sin(ph + t * freq * math.pi) * t)
                   + out * (0.035 * t * t) for t in (s_ / segs for s_ in range(segs + 1))]
            ww = skirt_weights(tc, min(root.z, CHAIN_Z[2] - 0.08))
            n = len(pts)
            base = len(verts)
            for i in range(n):
                tdir = (pts[min(n - 1, i + 1)] - pts[max(0, i - 1)]).normalized()
                sd = out.cross(tdir).normalized()
                t = i / (n - 1)
                w = lerp(0.009, 0.002, t) / 2
                verts += [pts[i] + sd * w, pts[i] - sd * w]
                g = (1 - t) ** 1.3
                glow += [g, g]
                weights += [ww, ww]
            for i in range(n - 1):
                a_ = base + i * 2
                faces.append((a_, a_ + 1, a_ + 3, a_ + 2))
    ob = new_object('Filaments', verts, faces, [mats['Filaments']], smooth=False)
    skin(ob, arm, weights)
    set_attr(ob, '_glow', glow)
    return ob


def add_coat_bones(arm):
    """Twelve three-bone chains around the hips, parented to the pelvis; the game swings them so the skirt hangs,
    trails and clears the legs. Each chain ends in a non-deforming leaf so the game knows where the last bone points."""
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.data.edit_bones
    pelvis = eb['pelvis']
    for name, theta in CHAINS:
        d = dir_at(theta)
        r_hip = 0.15 if 60 < theta < 300 else 0.13
        joints = [Vector((0, 0.012, z)) + d * (r_hip + o) for z, o in zip(CHAIN_Z, CHAIN_OUT)]
        parent = pelvis
        for k, seg in enumerate('abc'):
            b = eb.new('coat_%s_%s' % (name, seg))
            b.head, b.tail, b.roll = joints[k], joints[k + 1], 0.0
            b.parent = parent
            b.use_connect = k > 0
            b.use_deform = True
            parent = b
        tip = joints[-1]
        leaf = eb.new('coat_%s_d' % name)
        leaf.head, leaf.tail, leaf.roll = tip, tip + (tip - joints[-2]).normalized() * 0.05, 0.0
        leaf.parent = parent
        leaf.use_connect = True
        leaf.use_deform = False
    bpy.ops.object.mode_set(mode='OBJECT')


# ----------------------------------------------------------------------------------------------- hood and visor
HOOD_C = Vector((0.0, 0.012, 1.69))
Z_TUCK = 1.495      # the hood's lower edge, inside the collar
TUCK_GAP = 0.025    # how far inside the collar it sits


def build_hood(arm, B, mats, coat_r):
    ax, ay_f, ay_b, az = 0.13, 0.205, 0.17, 0.195
    g0 = math.radians(50)  # the face opening, around the forward axis
    nu, nv = 60, 30
    fwd, up, side = Vector((0, -1, 0)), Vector((0, 0, 1)), Vector((1, 0, 0))
    verts, depth = [], []
    for j in range(nv + 1):
        g = g0 + (math.pi * 0.985 - g0) * j / nv
        for i in range(nu):
            psi = math.tau * i / nu
            d = fwd * math.cos(g) + (up * math.cos(psi) + side * math.sin(psi)) * math.sin(g)
            # the head part: an ellipsoid with a pointed top swept back
            p = Vector((d.x * ax, d.y * (ay_f if d.y < 0 else ay_b), d.z * az))
            u = max(0.0, d.z - 0.55) / 0.45
            p.z += 0.06 * u * u
            p.y += 0.045 * u * u
            p = HOOD_C + p
            # the lower part narrows down into the collar and ends inside it in a clean ring
            e = max(0.0, -d.z)
            depth.append(e)
            k = smoothstep(0.2, 0.8, e)
            if k > 0:
                h = Vector((d.x, d.y, 0.0))
                h = h.normalized() if h.length > 1e-6 else Vector((0, 1, 0))
                th = theta_of(h)
                zt = lerp(HOOD_C.z - 0.12, Z_TUCK, smoothstep(0.35, 0.9, e))
                rt = coat_r(zt, th) - TUCK_GAP
                tuck = Vector((0.0, 0.012, zt)) + h * rt
                p = p.lerp(tuck, k)
            verts.append(p)
    faces = []
    for j in range(nv):
        for i in range(nu):
            a = j * nu + i
            b = j * nu + (i + 1) % nu
            faces.append((a, b, b + nu, a + nu))
    # the back cap
    pole = len(verts)
    verts.append(sum((verts[nv * nu + i] for i in range(nu)), Vector()) / nu)
    depth.append(0.0)
    for i in range(nu):
        faces.append((nv * nu + i, nv * nu + (i + 1) % nu, pole))
    # drop the closed bottom (the hood ends inside the collar)
    keep_f = [f for f in faces if not all(depth[k] > 0.9 for k in f)]
    ob = new_object('Hood', verts, keep_f, [mats['Coat'], mats['Trim']])
    for v, e in zip(ob.data.vertices, depth):
        if e < 0.3:  # the head part keeps off the head; the tucked part lives inside the collar
            v.co = push_out(B, v.co.copy(), 0.02, skip_arms=True)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-4)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # outward: the face normals should point away from the head
    out = sum(((f.calc_center_median() - HOOD_C).dot(f.normal) for f in bm.faces), 0.0)
    if out < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()
    sol = ob.modifiers.new('Solid', 'SOLIDIFY')
    sol.thickness = 0.011
    sol.offset = 1.0
    sol.material_offset_rim = 1  # the rim (the face opening's edge) glows faintly
    apply_modifier(ob, 'Solid')
    for p in ob.data.polygons:
        p.use_smooth = True
    ws = []
    for v in ob.data.vertices:
        z = v.co.z
        wh = smoothstep(1.55, 1.63, z)
        rest = 1 - wh
        wn = smoothstep(1.47, 1.55, z)
        ws.append({'Head': wh, 'neck_01': rest * wn, 'spine_03': rest * (1 - wn)})
    skin(ob, arm, ws)
    return ob


def build_visor(arm, B, mats):
    pts, nrm = [], []
    for i in range(25):
        a = -42 + 84 * i / 24
        z = 1.70 - 0.004 * (abs(a) / 42) ** 2
        o = Vector((0, 0.0, z))
        d = Vector((math.sin(math.radians(a)), -math.cos(math.radians(a)), 0))
        hit, n, _, _ = B.bvh.ray_cast(o, d, 1.0)
        if hit is None:
            continue
        pts.append(hit + n * 0.004)
        nrm.append(n)
    verts, faces = [], []
    for i, (p, n) in enumerate(zip(pts, nrm)):
        k = min(1.0, min(i, len(pts) - 1 - i) / 3.0)
        h = 0.0075 * (0.4 + 0.6 * k)
        verts += [p + Vector((0, 0, h)), p - Vector((0, 0, h))]
    for i in range(len(pts) - 1):
        a = i * 2
        faces.append((a, a + 2, a + 3, a + 1))
    ob = new_object('Visor', verts, faces, [mats['Visor']])
    skin(ob, arm, [{'Head': 1.0}] * len(verts))
    return ob


# ----------------------------------------------------------------------------------------------- wrist display
def build_wrist(arm, B, mats):
    b = arm.data.bones['lowerarm_l']
    h, t = b.head_local, b.tail_local
    along = (t - h).normalized()
    up = Vector((0, 0.25, 1)).normalized()  # top-back of the forearm (outer side when the arm hangs)
    up = (up - along * up.dot(along)).normalized()
    across = along.cross(up)
    verts, faces, fmat = [], [], []

    def quad(c, ex, ey, mi):
        base = len(verts)
        verts.extend([c - ex - ey, c + ex - ey, c + ex + ey, c - ex + ey])
        faces.append((base, base + 1, base + 2, base + 3))
        fmat.append(mi)

    # the device: a band around the wrist
    c = h.lerp(t, 0.84)
    hit, _, _, _ = B.bvh.ray_cast(c, up, 0.3)
    r = (hit - c).length + 0.008 if hit else 0.04
    seg = 20
    base = len(verts)
    for k in range(seg):
        a = math.tau * k / seg
        rad = up * math.cos(a) + across * math.sin(a)
        verts += [c + rad * r - along * 0.02, c + rad * r + along * 0.02]
    for k in range(seg):
        a0, a1 = base + k * 2, base + ((k + 1) % seg) * 2
        faces.append((a0, a1, a1 + 1, a0 + 1))
        fmat.append(0)
    # the hologram: a small tilted panel above the forearm, with a frame and a few bars of "text"
    tilt = Matrix.Rotation(math.radians(-25), 3, along)
    pu = tilt @ up
    pa = tilt @ across
    pc = h.lerp(t, 0.6) + pu * (r + 0.045)
    quad(pc, along * 0.055, pa * 0.035, 1)
    for k, (y, wdt) in enumerate([(0.018, 0.04), (0.006, 0.03), (-0.006, 0.036), (-0.018, 0.022)]):
        quad(pc + pa * y - along * (0.04 - wdt) + pu * 0.001, along * wdt, pa * 0.0025, 1)
    ob = new_object('Wrist', verts, faces, [mats['Gun'], mats['Holo'], mats['NeonLines']], fmat, smooth=False)
    skin(ob, arm, [{'lowerarm_l': 1.0}] * len(verts))
    return ob


# ----------------------------------------------------------------------------------------------- gunblade
def box(bm, x0, x1, y0, y1, z0, z1):
    vs = [bm.verts.new(Vector((x, y, z))) for z in (z0, z1) for y in (y0, y1) for x in (x0, x1)]
    idx = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    for f in idx:
        bm.faces.new([vs[i] for i in f])
    return vs


def tube(verts, faces, y0, y1, r, cx, cz, seg=12, rings=2):
    """A capped cylinder along Y."""
    base = len(verts)
    for k in range(rings):
        y = lerp(y0, y1, k / (rings - 1))
        for s in range(seg):
            a = math.tau * s / seg
            verts.append(Vector((cx + math.cos(a) * r, y, cz + math.sin(a) * r)))
    for k in range(rings - 1):
        for s in range(seg):
            a0 = base + k * seg + s
            a1 = base + k * seg + (s + 1) % seg
            faces.append((a0, a0 + seg, a1 + seg, a1))
    faces.append(tuple(base + s for s in range(seg)))
    faces.append(tuple(base + (rings - 1) * seg + s for s in reversed(range(seg))))


def build_gunblade(arm, mats):
    """Gun space: +Y forward (barrel / blade), +Z up (top of the gun), grip below. Units: metres."""
    root = bpy.data.objects.new('Gunblade', None)
    root.empty_display_size = 0.1
    bpy.context.scene.collection.objects.link(root)
    # body
    bm = bmesh.new()
    box(bm, -0.021, 0.021, -0.12, 0.2, 0.0, 0.064)
    box(bm, -0.017, 0.017, 0.2, 0.255, 0.008, 0.056)
    for sx in (-1, 1):  # the channel the core sits in
        box(bm, sx * 0.0155, sx * 0.0105, -0.17, 0.15, 0.062, 0.08)
    box(bm, -0.018, 0.018, -0.19, -0.12, 0.012, 0.056)
    g = box(bm, -0.016, 0.016, -0.075, -0.03, -0.105, 0.002)
    for v in g:
        if v.co.z < -0.05:
            v.co.y -= 0.028
    me = bpy.data.meshes.new('GunBody')
    bm.to_mesh(me)
    bm.free()
    body = bpy.data.objects.new('GunBody', me)
    bpy.context.scene.collection.objects.link(body)
    me.materials.append(mats['Gun'])
    me.materials.append(mats['NeonLines'])
    bev = body.modifiers.new('Bevel', 'BEVEL')
    bev.width = 0.004
    bev.segments = 2
    apply_modifier(body, 'Bevel')
    # neon: side lines and the emitter ring at the front
    bm = bmesh.new()
    bm.from_mesh(me)
    for sx in (-1, 1):
        x = sx * 0.0215
        vs = [bm.verts.new(Vector((x, y, z))) for (y, z) in ((-0.11, 0.029), (0.19, 0.029), (0.19, 0.035), (-0.11, 0.035))]
        f = bm.faces.new(vs if sx > 0 else list(reversed(vs)))
        f.material_index = 1
    # the emitter ring (built face by face: bmesh ops return their faces in an unstable order)
    seg = 24
    outer, inner = [], []
    for k in range(seg):
        t = math.tau * k / seg
        outer.append(bm.verts.new(Vector((math.cos(t) * 0.024, 0.257, 0.032 + math.sin(t) * 0.024))))
        inner.append(bm.verts.new(Vector((math.cos(t) * 0.0149, 0.257, 0.032 + math.sin(t) * 0.0149))))
    for k in range(seg):
        k1 = (k + 1) % seg
        f = bm.faces.new((outer[k], inner[k], inner[k1], outer[k1]))
        f.material_index = 1
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = False
    body.parent = root
    # the core: a glowing tube in the top channel and a lit cell on the back (what the camera behind the hero sees)
    cv, cf = [], []
    tube(cv, cf, -0.168, 0.148, 0.0085, 0.0, 0.071, seg=12, rings=2)
    tube(cv, cf, -0.197, -0.189, 0.02, 0.0, 0.034, seg=16, rings=2)
    core = new_object('GunCore', cv, cf, [mats['Core']], smooth=True, parent=root)
    # the blade: a thin diamond from the emitter to a point
    verts, faces = [], []
    n = 8
    for i in range(n + 1):
        t = i / n
        y = lerp(0.262, 1.02, t)
        hz = 0.02 * (1 - smoothstep(0.75, 1.0, t)) + 0.0015
        hx = 0.0045 * (1 - smoothstep(0.85, 1.0, t)) + 0.001
        zc = 0.032 - 0.004 * t
        verts += [Vector((0, y, zc + hz)), Vector((hx, y, zc)), Vector((0, y, zc - hz)), Vector((-hx, y, zc))]
    for i in range(n):
        for k in range(4):
            a, b = i * 4 + k, i * 4 + (k + 1) % 4
            faces.append((a, b, b + 4, a + 4))
    faces.append((0, 3, 2, 1))
    blade = new_object('Blade', verts, faces, [mats['Blade']], smooth=False, parent=root)
    muzzle = bpy.data.objects.new('Muzzle', None)
    muzzle.empty_display_size = 0.03
    bpy.context.scene.collection.objects.link(muzzle)
    muzzle.parent = root
    muzzle.location = (0.0, 0.27, 0.032)

    # the holds, computed in the rest (T) pose from the right hand's bones
    bones = arm.data.bones
    H = bones['hand_r'].head_local
    M = bones['middle_01_r'].head_local
    I = bones['index_01_r'].head_local
    P = bones['pinky_01_r'].head_local
    f = (M - H).normalized()            # toward the fingers
    a = (I - P).normalized()            # through the fist, out of the thumb side
    a = (a - f * a.dot(f)).normalized()
    palm = a.cross(f).normalized()      # the palm side
    C = H + f * 0.085 + palm * 0.028    # where a handle sits in the closed fist

    def hold(Y, Z, grip, scale):
        Y = Y.normalized()
        Z = (Z - Y * Z.dot(Y)).normalized()
        X = Y.cross(Z)
        R = Matrix((X, Y, Z)).transposed().to_4x4()
        return Matrix.Translation(C) @ R @ Matrix.Scale(scale, 4) @ Matrix.Translation(-grip)

    # sword: the fist closes on the gun's rear like a hilt, the blade out of the thumb side, the grip along the forearm
    sword_y = (a * 0.7 + f * 0.7).normalized()
    m_sword = hold(sword_y, f, Vector((0.0, -0.07, 0.032)), GUN_SCALE)
    # rifle: the fist holds the pistol grip, the barrel along the hand, the top of the gun up
    m_rifle = hold((f - a * 0.3).normalized(), a, Vector((0.0, -0.06, -0.05)), RIFLE_SCALE)

    rifle = bpy.data.objects.new('RifleHold', None)
    rifle.empty_display_size = 0.05
    bpy.context.scene.collection.objects.link(rifle)
    for ob, m in ((root, m_sword), (rifle, m_rifle)):
        ob.parent = arm
        ob.parent_type = 'BONE'
        ob.parent_bone = 'hand_r'
        bpy.context.view_layer.update()
        ob.matrix_world = m
    bpy.context.view_layer.update()
    return root, blade


# ----------------------------------------------------------------------------------------------- materials, export
def make_materials():
    return {
        'Suit': material('Suit', (0.012, 0.013, 0.016), rough=0.62, metal=0.25),
        'SuitJoints': material('SuitJoints', (0.03, 0.033, 0.04), rough=0.45, metal=0.5),
        'Armor': material('Armor', (0.035, 0.038, 0.045), rough=0.3, metal=0.7),
        'Coat': material('Coat', (0.016, 0.018, 0.022), rough=0.75, metal=0.05, double=True),
        'Gun': material('Gun', (0.03, 0.032, 0.036), rough=0.35, metal=0.7),
        'NeonLines': material('NeonLines', (0, 0, 0), emit=(1, 1, 1), strength=4.0),
        'Trim': material('Trim', (0, 0, 0), emit=(0.75, 0.8, 0.9), strength=1.2, double=True),
        'Core': material('Core', (0, 0, 0), emit=(1, 1, 1), strength=6.0),
        'Visor': material('Visor', (0, 0, 0), emit=(1, 1, 1), strength=5.0),
        'Blade': material('Blade', (0, 0, 0), emit=(1, 1, 1), strength=6.0, double=True),
        'Holo': material('Holo', (0, 0, 0), emit=(0.35, 0.9, 1.0), strength=2.0, alpha=0.55, double=True),
        'Filaments': material('Filaments', (0, 0, 0), emit=(1, 1, 1), strength=3.0, alpha=0.9, double=True),
    }


def export(path, arm):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    arm.data.pose_position = 'POSE'
    arm.animation_data.action = None
    # every clip as its own NLA track, so the exporter writes each one as a glTF animation
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
        export_attributes=True,
        export_materials='EXPORT',
        export_skins=True,
        export_influence_nb=4,
        export_def_bones=False,
        export_morph=False,
        export_animations=True,
        export_animation_mode='NLA_TRACKS',
        export_force_sampling=True,
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
    """A few Cycles stills: a turntable in the idle pose and some action poses, on a dark background with a cool
    back light like the game's corridors."""
    os.makedirs(outdir, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 24
    sc.render.resolution_x, sc.render.resolution_y = 560, 760
    sc.render.film_transparent = False
    w = bpy.data.worlds.new('preview')
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.008, 0.01, 0.014, 1)
    w.node_tree.nodes['Background'].inputs[1].default_value = 1.0
    for loc, energy, col in (((-2.5, -3.0, 3.0), 260.0, (1, 1, 1)), ((3.0, 2.5, 2.5), 200.0, (0.6, 0.85, 1.0)),
                             ((0.0, 4.0, 1.0), 160.0, (0.6, 0.85, 1.0))):
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

    def shoot(name, action, frac, angle, dist=3.6, height=1.0):
        act = bpy.data.actions[action]
        arm.animation_data.action = act
        if act.slots:
            arm.animation_data.action_slot = act.slots[0]
        f0, f1 = act.frame_range
        fr = f0 + (f1 - f0) * frac
        sc.frame_set(int(fr), subframe=fr - int(fr))
        a = math.radians(angle)
        co.location = (math.sin(a) * dist, -math.cos(a) * dist, height + 0.25)
        co.rotation_euler = (math.radians(86), 0, a)
        sc.render.filepath = os.path.join(outdir, name + '.png')
        bpy.ops.render.render(write_still=True)

    for ang in (0, 45, 90, 160, 180, 220, 270):
        shoot('turn_%03d' % ang, 'idle', 0.0, ang)
    shoot('pose_sprint', 'sprint', 0.25, 150)
    shoot('pose_crouch_walk', 'crouch_walk', 0.3, 150, height=0.7)
    shoot('pose_slash_a', 'slash_a', 0.6, 160)
    shoot('pose_aim', 'aim', 0.5, 160)
    shoot('pose_hack', 'hack', 0.3, 120)
    shoot('close_back', 'idle', 0.0, 170, dist=1.6, height=1.35)
    shoot('close_front', 'idle', 0.0, 20, dist=1.6, height=1.35)
    arm.animation_data.action = None


def main():
    opts = parse_args()
    arm, body_ob = load_base(opts['src'])
    mats = make_materials()
    B0 = Body(body_ob)
    B = smooth_body(arm, body_ob, B0, mats)
    add_coat_bones(arm)
    armor = build_armor(arm, B, mats)
    neon_lines(arm, B, mesh_bvh(body_ob, armor), mats)
    coat, tips, coat_r = build_coat(arm, B, mats)
    build_filaments(arm, tips, [v.co.copy() for v in coat.data.vertices], mats)
    build_hood(arm, B, mats, coat_r)
    build_visor(arm, B, mats)
    build_wrist(arm, B, mats)
    build_gunblade(arm, mats)
    if opts['blend']:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(opts['blend']))
    if opts['preview']:
        preview(os.path.abspath(opts['preview']), arm)
    export(os.path.abspath(opts['out']), arm)


if __name__ == '__main__':
    main()
