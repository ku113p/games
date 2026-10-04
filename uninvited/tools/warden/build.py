"""Uninvited - the warden builds (DESIGN 8): EW1 the sentinel and EW2 the enforcer.

Blender 4.5, headless:
    blender -b --python tools/warden/build.py -- --src <quaternius dir> [--variant sentinel|enforcer]
                                                 [--out assets/models/warden.glb] [--preview <dir>] [--blend <file.blend>]

--variant sentinel (default, assets/models/warden.glb): EW1, a tall slender guard (shown at ~2.1 m): a smooth black suit,
    fitted armor shells, long stiff plates hanging from the shoulders like a coat, a narrow faceless helmet with one
    vertical visor slit, red-orange light along the seams, an energy halberd in the right hand.
--variant enforcer (assets/models/warden-heavy.glb): EW2, the heavy one for waves (~2.2 m): broad armor, a helmet with a
    horizontal visor band, a hex energy shield on the left forearm, a short heavy energy blade in the right hand.

Both are built on the Quaternius Universal Base Characters male body (CC0, 65-bone rig) with the Universal Animation
Library clips (CC0, "Standard", in-place): the body is slimmed (sentinel) or bulked (enforcer) around its bones, its head
removed (our helmet replaces it), decimated, and everything else is generated here:
  * material "Under": the smooth suit; "Armor": shells cut out of the suit surface and lifted with a beveled profile,
  * "Lines": emissive ribbons along the armor outlines and traced over the suit; "Visor"; "Blade" (halberd blade, short
    blade); "Shield" (the hex plane) - the game recolours them by the warden's state,
  * the sentinel's hanging plates (material "Coat", skinned to the spine, pelvis and the thighs), a stand-up collar,
  * the empty "Halberd" (the weapon group) parented to hand_r; the empty "Muzzle" inside it (the bolt starts there).
Clip names are what view/wardens.ts expects (CLIPS). Sampled at 12 fps. Deterministic: a rebuild gives the same file.
"""
import bmesh
import bpy
import math
import os
import sys
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.interpolate import poly_3d_calc

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))

# (name in the glb, source clip, pack)
CLIPS = [
    ('idle', 'Idle_Loop', 1),
    ('post', 'Idle_Lantern_Loop', 2),
    ('walk', 'Walk_Formal_Loop', 1),
    ('search_walk', 'Walk_Loop', 1),
    ('run', 'Jog_Fwd_Loop', 1),
    ('scan', 'Idle_Torch_Loop', 1),
    ('check', 'Interact', 1),
    ('alert', 'Sword_Idle', 1),
    ('strike', 'Sword_Regular_A', 2),
    ('shoot', 'Pistol_Shoot', 1),
    ('hit', 'Hit_Chest', 1),
    ('death', 'Death01', 1),
]
FRAME_STEP = 2       # export every 2nd frame (24 fps clips -> 12 fps)
BODY_TRIS = 4200     # the body is decimated to about this many triangles
BODY_FILE = ('Superhero_Male_FullBody.gltf', 'SuperHero_Male')
TORSO = ('pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'clavicle_l', 'clavicle_r', 'Head')

# ----------------------------------------------------------------------------------------------- the variants
VARIANTS = {
    'sentinel': {
        'out': 'warden.glb',
        # reshape: torso (x, y) scale about the body axis, then isotropic scales about each limb bone's axis
        'torso': (0.84, 0.86), 'pelvis': (0.9, 0.9),
        'k': {'upperarm': 0.74, 'lowerarm': 0.76, 'thigh': 0.8, 'calf': 0.76, 'foot': 0.88, 'ball': 0.88, 'hand': 0.88},
        'lift': 0.011, 'ramp': 0.02, 'line_w': 0.0065,
    },
    'enforcer': {
        'out': 'warden-heavy.glb',
        'torso': (1.13, 1.15), 'pelvis': (1.1, 1.14),
        'k': {'upperarm': 1.2, 'lowerarm': 1.15, 'thigh': 1.14, 'calf': 1.1, 'foot': 1.12, 'ball': 1.1, 'hand': 1.15},
        'lift': 0.024, 'ramp': 0.03, 'line_w': 0.0115,
    },
}
V = VARIANTS['sentinel']
VARIANT = 'sentinel'


def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    opts = {'src': os.environ.get('QUATERNIUS_DIR', ''), 'out': '', 'preview': '', 'blend': '', 'variant': 'sentinel'}
    i = 0
    while i < len(argv):
        opts[argv[i].lstrip('-')] = argv[i + 1]
        i += 2
    if not opts['src']:
        raise SystemExit('pass --src <folder with UAL1_Standard.glb, UAL2_Standard.glb and the UBC male body> (or set QUATERNIUS_DIR)')
    if opts['variant'] not in VARIANTS:
        raise SystemExit('--variant: %s' % ' | '.join(VARIANTS))
    if not opts['out']:
        opts['out'] = os.path.join(ROOT, 'assets', 'models', VARIANTS[opts['variant']]['out'])
    return opts


def find_file(src, name):
    for d, _, files in os.walk(src):
        if name in files:
            return os.path.join(d, name)
    raise SystemExit('not found under %s: %s' % (src, name))


def lerp(a, b, t):
    return a + (b - a) * t


def clamp01(x):
    return 0.0 if x < 0 else 1.0 if x > 1 else x


def smoothstep(e0, e1, x):
    t = clamp01((x - e0) / (e1 - e0))
    return t * t * (3 - 2 * t)


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


def make_materials():
    return {
        'Under': material('Under', (0.01, 0.011, 0.013), rough=0.55, metal=0.3),
        'Armor': material('Armor', (0.03, 0.028, 0.03), rough=0.3, metal=0.75),
        'Coat': material('Coat', (0.02, 0.02, 0.023), rough=0.4, metal=0.5, double=True),
        'Lines': material('Lines', (0, 0, 0), emit=(1.0, 0.25, 0.06), strength=4.0, double=True),
        'Visor': material('Visor', (0, 0, 0), emit=(1.0, 0.35, 0.08), strength=6.0, double=True),
        'Blade': material('Blade', (0, 0, 0), emit=(1.0, 0.2, 0.05), strength=6.0, double=True),
        'Shield': material('Shield', (0, 0, 0), emit=(1.0, 0.25, 0.06), strength=2.0, alpha=0.5, double=True),
    }


# ----------------------------------------------------------------------------------------------- mesh helpers
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


def apply_modifier(ob, mod_name):
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.selected_objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.ops.object.modifier_apply(modifier=mod_name)


def mesh_bvh(*obs):
    verts, polys = [], []
    for ob in obs:
        base = len(verts)
        verts += [v.co.copy() for v in ob.data.vertices]
        polys += [[base + i for i in p.vertices] for p in ob.data.polygons]
    return BVHTree.FromPolygons(verts, polys)


def ribbon(points, normals, width, closed=False, taper=0.3):
    """A flat strip along a polyline, lying on the surface given by the normals. Returns verts, faces."""
    n = len(points)
    verts, faces = [], []
    for i in range(n):
        if closed:
            t = (points[(i + 1) % n] - points[(i - 1) % n]).normalized()
            k = 1.0
        else:
            t = (points[min(n - 1, i + 1)] - points[max(0, i - 1)]).normalized()
            k = min(1.0, min(i, n - 1 - i) / 2.0)
        side = normals[i].cross(t).normalized()
        w = width * (taper + (1 - taper) * k) / 2
        verts += [points[i] + side * w, points[i] - side * w]
    for i in range(n if closed else n - 1):
        a, b = i * 2, ((i + 1) % n) * 2
        faces.append((a, a + 1, b + 1, b))
    return verts, faces


# ----------------------------------------------------------------------------------------------- the base
def load_base(src):
    """The UAL clips (kept and renamed), then the UBC male body and its armature."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 24
    bpy.ops.import_scene.gltf(filepath=find_file(src, 'UAL1_Standard.glb'))
    pack1 = {a.name: a for a in bpy.data.actions}
    bpy.ops.import_scene.gltf(filepath=find_file(src, 'UAL2_Standard.glb'))
    pack2 = {a.name.split('.')[0]: a for a in bpy.data.actions if a.name not in pack1 or a.name.endswith('.001')}
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
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
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=find_file(src, BODY_FILE[0]))
    new = [o for o in bpy.data.objects if o not in before]
    arm = next(o for o in new if o.type == 'ARMATURE')
    body = next(o for o in new if o.type == 'MESH' and o.name.startswith(BODY_FILE[1]))
    for o in new:
        if o not in (arm, body):
            bpy.data.objects.remove(o)
    arm.name = 'Armature'  # the clips' slots are named after it
    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = None
    for tr in list(arm.animation_data.nla_tracks):
        arm.animation_data.nla_tracks.remove(tr)
    arm.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    return arm, body


class Body:
    """A rest-pose body mesh: BVH for nearest points, per-vertex bone weights and normals."""

    def __init__(self, ob):
        me = ob.data
        self.v = [v.co.copy() for v in me.vertices]
        self.n = [v.normal.copy() for v in me.vertices]
        self.polys = [list(p.vertices) for p in me.polygons]
        self.bvh = BVHTree.FromPolygons(self.v, self.polys)
        names = [g.name for g in ob.vertex_groups]
        self.w = [{names[g.group]: g.weight for g in v.groups if g.weight > 0} for v in me.vertices]

    def weights_at(self, p):
        loc, _, idx, _ = self.bvh.find_nearest(p)
        poly = self.polys[idx]
        bary = poly_3d_calc([self.v[i] for i in poly], loc)
        acc = {}
        for vi, b in zip(poly, bary):
            for g, w in self.w[vi].items():
                acc[g] = acc.get(g, 0.0) + w * b
        return acc


# ----------------------------------------------------------------------------------------------- the under-suit
def bone_class(name):
    base = name[:-2] if name.endswith(('_l', '_r')) else name
    return base.rstrip('0123456789').rstrip('_')


def prepare_body(arm, body, mats):
    """The UBC mesh without its head, reshaped around the bones (slim or bulky), decimated, one smooth 'Under' surface."""
    for m in list(body.modifiers):
        body.modifiers.remove(m)
    me = body.data
    while me.uv_layers:
        me.uv_layers.remove(me.uv_layers[0])
    while me.color_attributes:
        me.color_attributes.remove(me.color_attributes[0])
    names = {g.index: g.name for g in body.vertex_groups}
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z > 1.585], context='VERTS')
    bm.to_mesh(me)
    bm.free()
    # reshape: a weighted blend of per-bone scalings
    bones = arm.data.bones
    kx, ky = V['torso']
    px, py = V['pelvis']
    for v in me.vertices:
        p = v.co.copy()
        acc = Vector((0, 0, 0))
        tot = 0.0
        for g in v.groups:
            nm = names[g.group]
            cls = bone_class(nm)
            if nm in TORSO or nm.startswith('spine'):
                sx, sy = (px, py) if nm == 'pelvis' else (kx, ky)
                q = Vector((p.x * sx, 0.02 + (p.y - 0.02) * sy, p.z))
            elif cls in V['k'] or cls in ('thumb', 'index', 'middle', 'ring', 'pinky'):
                kk = V['k'].get(cls, V['k']['hand'])
                b = bones.get(nm)
                if b is None:
                    q = p
                else:
                    h, t = b.head_local, b.tail_local
                    u = t - h
                    s = clamp01((p - h).dot(u) / max(1e-9, u.length_squared))
                    c = h + u * s
                    q = c + (p - c) * kk
            else:
                q = p
            acc += q * g.weight
            tot += g.weight
        v.co = acc / tot if tot > 0 else p
    orig = Body(body)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    dec = body.modifiers.new('Decimate', 'DECIMATE')
    dec.ratio = BODY_TRIS / max(1.0, len(me.polygons))
    apply_modifier(body, 'Decimate')
    me = body.data
    me.materials.clear()
    me.materials.append(mats['Under'])
    for p in me.polygons:
        p.material_index = 0
        p.use_smooth = True
    body.vertex_groups.clear()
    skin(body, arm, [orig.weights_at(v.co) for v in me.vertices])
    body.name = 'Body'
    me.name = 'Body'
    bpy.context.view_layer.update()
    return Body(body)


# ----------------------------------------------------------------------------------------------- armor shells
def plate_field(bones, plate, side):
    """A scalar field over the body, > 0 inside the plate, in metres to its edge: a bone, a span along it (s0..s1), and
    an angular window around a reference direction (half-angle at s0 and at s1, degrees); `rmax` limits the reach."""
    name, s0, s1, ref, h0, h1, rmax = plate
    if side < 0:
        name = name[:-2] + '_r'
        ref = (-ref[0], ref[1], ref[2])
    b = bones[name]
    h, t = b.head_local, b.tail_local
    u = t - h
    L = u.length
    u = u / L
    refv = Vector(ref)
    refv = (refv - u * refv.dot(u)).normalized()

    def f(p, n):
        s = (p - h).dot(u) / L
        q = p - (h + u * (s * L))
        r = q.length
        if r > rmax or r < 1e-6:
            return -1.0
        ang = q.angle(refv)
        half = math.radians(lerp(h0, h1, clamp01((s - s0) / (s1 - s0))))
        ends = min((s - s0) * L, (s1 - s) * L)
        return min(ends, (half - ang) * r, 0.7 * (ends + (half - ang) * r))
    return f


def blob_field(cx, cz, ax, az, front, ycut, power=2.6, skew=0.0):
    """A rounded shape in the (x, z) plane on the front (y < ycut) or the back of the torso; `skew` widens it upward."""
    def f(p, n):
        side = (ycut - p.y) if front else (p.y - ycut)
        if abs(p.x) > 0.3 or p.z < 0.85 or p.z > 1.55:
            return -1.0
        ax2 = ax * (1.0 + skew * (p.z - cz) / az)
        u = abs(p.x - cx) / max(1e-4, ax2)
        v = abs(p.z - cz) / az
        s = (u ** power + v ** power) ** (1.0 / power)
        return min((1.0 - s) * min(ax2, az) * 0.9, side * 1.2)
    return f


def cut_plate(B, field, l0, l1, ramp):
    """The part of the body surface where field > 0, lifted along the normals with a beveled profile (l0 at the edge, l1
    beyond `ramp` m inside). Returns verts, normals, faces, weights."""
    tris = []
    for p in B.polys:
        for k in range(1, len(p) - 1):
            tris.append((p[0], p[k], p[k + 1]))
    fv = {}
    vmap = {}
    emap = {}
    verts, nrms, weights, dist = [], [], [], []

    def fval(i):
        if i not in fv:
            fv[i] = field(B.v[i], B.n[i])
        return fv[i]

    def vert(i):
        if i not in vmap:
            vmap[i] = len(verts)
            verts.append(B.v[i].copy())
            nrms.append(B.n[i].copy())
            weights.append(dict(B.w[i]))
            dist.append(fval(i))
        return vmap[i]

    def edge(i, j):
        a, b = min(i, j), max(i, j)
        if (a, b) not in emap:
            fa, fb = fval(a), fval(b)
            t = fa / (fa - fb)
            emap[(a, b)] = len(verts)
            verts.append(B.v[a].lerp(B.v[b], t))
            nrms.append(B.n[a].lerp(B.n[b], t).normalized())
            w = {}
            for g, x in B.w[a].items():
                w[g] = w.get(g, 0.0) + x * (1 - t)
            for g, x in B.w[b].items():
                w[g] = w.get(g, 0.0) + x * t
            weights.append(w)
            dist.append(0.0)
        return emap[(a, b)]

    faces = []
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
    out = []
    for v, n, d in zip(verts, nrms, dist):
        s = smoothstep(0.0, ramp, d)
        out.append(v + n * (l0 + (l1 - l0) * s))
    return out, nrms, faces, weights


def boundary_loops(faces):
    """Ordered loops of the edges that belong to one face only."""
    count = {}
    for f in faces:
        for k in range(len(f)):
            a, b = f[k], f[(k + 1) % len(f)]
            key = (min(a, b), max(a, b))
            count[key] = count.get(key, 0) + 1
    adj = {}
    for (a, b), c in count.items():
        if c == 1:
            adj.setdefault(a, []).append(b)
            adj.setdefault(b, []).append(a)
    loops, seen = [], set()
    for start in adj:
        if start in seen:
            continue
        loop = [start]
        seen.add(start)
        cur = start
        while True:
            nxt = [x for x in adj[cur] if x not in seen]
            if not nxt:
                break
            cur = nxt[0]
            seen.add(cur)
            loop.append(cur)
        if len(loop) >= 6:
            loops.append(loop)
    return loops


def armor_specs(bones):
    """(field, lift scale, light line along the outline?) per plate; the sentinel's are slim and fitted, the enforcer's
    big and domed."""
    def pf(plate, side):
        return plate_field(bones, plate, side)
    P = []
    if VARIANT == 'sentinel':
        for s in (1, -1):
            P.append((pf(('upperarm_l', -0.12, 0.34, (0, 0.15, 1), 72, 56, 0.075), s), 1.5, True))     # shoulder cap
            P.append((pf(('upperarm_l', 0.52, 0.94, (0, 0.2, 1), 52, 52, 0.07), s), 0.6, False))       # upper-arm strip
            P.append((pf(('lowerarm_l', 0.08, 0.84, (0, 0.4, 1), 100, 70, 0.062), s), 1.0, True))      # bracer
            P.append((pf(('thigh_l', 0.9, 1.1, (0, -1.0, 0.05), 55, 55, 0.1), s), 1.2, False))         # knee
            P.append((pf(('calf_l', 0.1, 0.8, (0.1, -1.0, 0), 80, 44, 0.085), s), 1.2, True))          # shin
            P.append((pf(('calf_l', 0.8, 1.05, (0, -0.2, 1), 180, 180, 0.1), s), 1.0, False))          # boot top
            P.append((pf(('foot_l', -0.05, 1.05, (0, 0, 1), 180, 180, 0.1), s), 1.0, False))           # boot
        P.append((blob_field(0, 1.385, 0.155, 0.13, True, 0.012, 2.4, 0.18), 1.4, True))   # chest
        P.append((blob_field(0, 1.205, 0.11, 0.065, True, 0.01, 2.6), 1.0, True))          # mid
        P.append((blob_field(0, 1.07, 0.09, 0.06, True, 0.0, 2.6), 1.0, True))             # abdomen
        P.append((blob_field(0, 1.37, 0.14, 0.16, False, 0.03, 2.4, 0.15), 1.2, True))     # back
        P.append((blob_field(0, 1.09, 0.115, 0.07, False, 0.03, 2.6), 1.0, True))          # lower back
    else:
        for s in (1, -1):
            P.append((pf(('upperarm_l', -0.34, 0.5, (0, 0.1, 1), 118, 96, 0.14), s), 2.6, True))   # pauldron
            P.append((pf(('upperarm_l', 0.5, 1.0, (0, 0.2, 1), 90, 90, 0.12), s), 1.0, True))      # upper arm
            P.append((pf(('lowerarm_l', 0.1, 0.9, (0, 0.4, 1), 110, 90, 0.1), s), 1.5, True))      # bracer
            P.append((pf(('thigh_l', 0.1, 0.72, (0.2, -1, 0), 62, 52, 0.15), s), 1.3, True))       # thigh
            P.append((pf(('thigh_l', 0.8, 1.14, (0, -1.0, 0.05), 70, 70, 0.14), s), 2.0, True))    # knee
            P.append((pf(('calf_l', 0.1, 0.84, (0.1, -1.0, 0), 90, 56, 0.12), s), 1.4, True))      # shin
            P.append((pf(('calf_l', 0.78, 1.05, (0, -0.2, 1), 180, 180, 0.13), s), 1.5, False))    # boot top
            P.append((pf(('foot_l', -0.05, 1.05, (0, 0, 1), 180, 180, 0.12), s), 1.5, False))      # boot
        P.append((blob_field(0, 1.39, 0.2, 0.15, True, 0.0, 2.2, 0.12), 1.6, True))        # chest
        P.append((blob_field(0, 1.17, 0.14, 0.1, True, 0.0, 2.6), 1.2, True))              # abdomen
        P.append((blob_field(0, 1.0, 0.2, 0.065, True, 0.0, 3.0), 1.4, True))              # belt
        P.append((blob_field(0, 1.39, 0.2, 0.17, False, 0.04, 2.2, 0.1), 1.6, True))       # back
        P.append((blob_field(0, 1.13, 0.15, 0.1, False, 0.04, 2.6), 1.2, True))            # lower back
    return P


def build_armor(arm, B, mats):
    verts, faces, weights, loops_all = [], [], [], []
    for field, lscale, line in armor_specs(arm.data.bones):
        v, n, f, w = cut_plate(B, field, 0.004 * lscale ** 0.5, V['lift'] * lscale, V['ramp'] * (0.7 + 0.3 * lscale))
        base = len(verts)
        verts += v
        weights += w
        faces += [[base + i for i in poly] for poly in f]
        if line:
            for loop in boundary_loops(f):
                loops_all.append([(base + i, n[i]) for i in loop[::2]])
    ob = new_object('Armor', verts, faces, [mats['Armor']])
    add_groups(ob, weights)
    bind(ob, arm)
    # light lines along the outlines
    lv, lf, lw = [], [], []
    for loop in loops_all:
        pts = [verts[i] + n * 0.0025 for i, n in loop]
        nr = [n for _, n in loop]
        for _ in range(2):
            pts = [(pts[i - 1] + pts[i] * 2 + pts[(i + 1) % len(pts)]) / 4 for i in range(len(pts))]
        v, f = ribbon(pts, nr, V['line_w'], closed=True)
        b = len(lv)
        lv += v
        lf += [tuple(b + k for k in face) for face in f]
        for i, _n in loop:
            lw += [weights[i]] * 2
    lines = new_object('ArmorLines', lv, lf, [mats['Lines']])
    skin(lines, arm, lw)
    return ob


def neon_lines(arm, B, bvh, mats):
    """Ribbons traced over the suit and the armor from outside: the arm and the leg, so the seams read as one system."""
    bones = arm.data.bones

    def axis(name, t):
        b = bones[name]
        return b.head_local.lerp(b.tail_local, t)

    def trace(samples, reach, off=0.0035):
        pts, dirs = [], []
        for o, d in samples:
            d = d.normalized()
            hit, _, _, _ = bvh.ray_cast(o + d * reach, -d, reach * 1.5)
            if hit is not None:
                pts.append(hit)
                dirs.append(d)
        if len(pts) < 4:
            return [], []
        for _ in range(3):
            pts = [pts[0]] + [(pts[i - 1] + pts[i] * 2 + pts[i + 1]) / 4 for i in range(1, len(pts) - 1)] + [pts[-1]]
        out_p, out_n = [], []
        for p, d in zip(pts, dirs):
            hit, n, _, _ = bvh.ray_cast(p + d * 0.03, -d, 0.06)
            if hit is None:
                hit, n, _, _ = bvh.find_nearest(p)
            out_p.append(hit + n * off)
            out_n.append(n)
        return out_p, out_n

    paths = []
    n = 50
    if VARIANT == 'sentinel':
        armp = []
        for i in range(n + 1):
            s = i / n
            o = axis('upperarm_l', 0.1 + s / 0.5 * 0.9) if s < 0.5 else axis('lowerarm_l', (s - 0.5) / 0.5 * 0.92)
            armp.append((o, Vector((0.0, 0.55, 1.0)), 0.14))
        paths.append(armp)
        leg = []
        for i in range(n + 1):
            s = i / n
            o = axis('thigh_l', 0.05 + s / 0.5 * 0.95) if s < 0.5 else axis('calf_l', (s - 0.5) / 0.5 * 0.88)
            d = Vector((1.0, -0.2, 0.0)).lerp(Vector((0.25, -1.0, 0.0)), smoothstep(0.25, 0.8, s))
            leg.append((o, d, 0.16))
        paths.append(leg)
    verts, faces, weights = [], [], []
    for path in paths:
        for side in (1, -1):
            samples = [(Vector((o.x * side, o.y, o.z)), Vector((d.x * side, d.y, d.z))) for o, d, _ in path]
            pts, nrm = trace(samples, path[0][2])
            if not pts:
                continue
            v, f = ribbon(pts, nrm, V['line_w'])
            if side < 0:
                f = [tuple(reversed(face)) for face in f]
            base = len(verts)
            verts += v
            faces += [tuple(base + k for k in face) for face in f]
            weights += [B.weights_at(p) for p in v]
    if verts:
        ob = new_object('SuitLines', verts, faces, [mats['Lines']])
        skin(ob, arm, weights)


# ----------------------------------------------------------------------------------------------- the hanging plates
def torso_radii(z):
    """Half width and half depth of the (slim) torso at height z."""
    pts = [(0.3, 0.19, 0.13), (0.95, 0.19, 0.13), (1.12, 0.14, 0.115), (1.3, 0.175, 0.125), (1.46, 0.17, 0.12), (1.56, 0.12, 0.1)]
    for (z0, x0, y0), (z1, x1, y1) in zip(pts, pts[1:]):
        if z0 <= z <= z1:
            t = (z - z0) / (z1 - z0)
            return lerp(x0, x1, t), lerp(y0, y1, t)
    return pts[-1][1], pts[-1][2]


def panel_weights(z, theta_deg):
    """Skin weights of a hanging plate: the spine at the top, the pelvis at the hips, the thigh of its own side below."""
    th = 'thigh_l' if math.sin(math.radians(theta_deg)) > 0 else 'thigh_r'
    up = smoothstep(1.2, 0.98, z)       # 0 at the chest, 1 at the hips
    low = smoothstep(1.0, 0.45, z)      # 0 at the hips, 1 low down
    if z > 1.2:
        w = {'spine_03': 1.0}
    else:
        w = {'spine_03': (1 - up) * 0.8, 'spine_01': (1 - up) * 0.2, 'pelvis': up * (1 - low * 0.9), th: up * low * 0.9}
    return {k: v for k, v in w.items() if v > 1e-3}


def coat_point(theta_deg, z, lift=0.0, flare=0.34, clear=0.028):
    rx, ry = torso_radii(z)
    f = max(0.0, 0.95 - z) * flare + clear + lift
    a = math.radians(theta_deg)
    return Vector((math.sin(a) * (rx + f), 0.025 - math.cos(a) * (ry + f * 0.8), z)), Vector((math.sin(a), -math.cos(a), 0.0))


# the plates: (theta at the inner edge, theta at the outer edge, top z, hem z at the inner edge, hem z at the outer edge)
COAT = [(11.0, 47.0, 1.5, 0.2, 0.34), (138.0, 178.0, 1.52, 0.3, 0.17)]


def build_coat(arm, mats):
    """Four long stiff plates hanging from the shoulders (two front, two back) with light along their edges."""
    allv, allf, allw = [], [], []
    lv, lf, lw = [], [], []
    cols, rows = 3, 12
    for s in (1, -1):
        for t0, t1, top, hem0, hem1 in COAT:
            ths = (lambda a: a) if s > 0 else (lambda a: 360 - a)
            base = len(allv)
            for r in range(rows + 1):
                for c in range(cols + 1):
                    u = c / cols
                    th = lerp(t0, t1, u)
                    z = lerp(top - 0.03 * u, lerp(hem0, hem1, u), r / rows)
                    p, _ = coat_point(ths(th), z)
                    allv.append(p)
                    allw.append(panel_weights(z, ths(th)))
            for r in range(rows):
                for c in range(cols):
                    a = base + r * (cols + 1) + c
                    allf.append((a, a + 1, a + cols + 2, a + cols + 1))
            # light along the two long edges
            for u in (0.0, 1.0):
                pts, nrm = [], []
                for r in range(14 + 1):
                    th = lerp(t0, t1, u)
                    z = lerp(top - 0.03 * u, lerp(hem0, hem1, u), r / 14)
                    p, nn = coat_point(ths(th), z, lift=0.0045)
                    pts.append(p)
                    nrm.append(nn)
                v, fc = ribbon(pts, nrm, V['line_w'], taper=0.5)
                if s < 0:
                    fc = [tuple(reversed(face)) for face in fc]
                b = len(lv)
                lv += v
                lf += [tuple(b + k for k in face) for face in fc]
                for q in v:
                    lw.append(panel_weights(q.z, ths(lerp(t0, t1, u))))
    ob = new_object('Coat', allv, allf, [mats['Coat']], smooth=True)
    add_groups(ob, allw)
    sol = ob.modifiers.new('Solid', 'SOLIDIFY')
    sol.thickness = 0.007
    sol.offset = 0.0
    sol.use_even_offset = True
    apply_modifier(ob, 'Solid')
    bind(ob, arm)
    lines = new_object('CoatLines', lv, lf, [mats['Lines']])
    skin(lines, arm, lw)


def build_collar(arm, mats):
    """A flared stand-up collar, open at the front, high at the back."""
    cols, rows = 14, 4
    verts, faces, w = [], [], []
    for r in range(rows + 1):
        t = r / rows
        for c in range(cols + 1):
            th = lerp(40.0, 320.0, c / cols)
            a = math.radians(th)
            back = (1 + math.cos(a - math.pi)) / 2
            zt = 1.62 + 0.07 * back ** 1.5
            z = lerp(1.47, zt, t)
            rr = 0.105 + 0.055 * t ** 1.4 + 0.012 * (1 - back)
            verts.append(Vector((math.sin(a) * rr * 1.05, 0.036 - math.cos(a) * rr * 0.95, z)))
            w.append({'spine_03': 1 - t, 'neck_01': t})
    for r in range(rows):
        for c in range(cols):
            a = r * (cols + 1) + c
            faces.append((a, a + 1, a + cols + 2, a + cols + 1))
    ob = new_object('Collar', verts, faces, [mats['Coat']])
    add_groups(ob, w)
    sol = ob.modifiers.new('Solid', 'SOLIDIFY')
    sol.thickness = 0.007
    sol.offset = 0.0
    apply_modifier(ob, 'Solid')
    bind(ob, arm)
    return ob


# ----------------------------------------------------------------------------------------------- the head
def build_helmet(arm, mats):
    """A narrow egg-shaped helmet bound to the Head bone, and its visor (a vertical slit / a horizontal band)."""
    heavy = VARIANT == 'enforcer'
    # z, half width, front depth, back depth
    prof = [(1.555, 0.05, 0.055, 0.058), (1.595, 0.066, 0.074, 0.08), (1.65, 0.077, 0.09, 0.1), (1.72, 0.081, 0.099, 0.108),
            (1.79, 0.073, 0.088, 0.098), (1.84, 0.048, 0.056, 0.064), (1.865, 0.0, 0.0, 0.0)]
    if heavy:
        prof = [(1.55, 0.06, 0.062, 0.066), (1.6, 0.09, 0.098, 0.1), (1.66, 0.103, 0.118, 0.12), (1.73, 0.106, 0.124, 0.124),
                (1.8, 0.09, 0.105, 0.108), (1.845, 0.05, 0.06, 0.07), (1.865, 0.0, 0.0, 0.0)]
    seg = 20
    cy = 0.022
    verts, faces = [], []
    dense = [prof[0]]
    for a, b in zip(prof, prof[1:]):
        dense.append(tuple((x + y) / 2 for x, y in zip(a, b)))
        dense.append(b)
    prof = dense
    for z, hx, fy, by in prof:
        for s in range(seg):
            a = math.tau * s / seg
            ca, sa = math.cos(a), math.sin(a)
            fr = fy if ca > 0 else by
            e = 2.8 if heavy else 2.2
            verts.append(Vector((hx * math.copysign(abs(sa) ** (2 / e), sa), cy - fr * math.copysign(abs(ca) ** (2 / e), ca), z)))
    for r in range(len(prof) - 1):
        for s in range(seg):
            a, b = r * seg + s, r * seg + (s + 1) % seg
            faces.append((a, b, b + seg, a + seg))
    faces.append(tuple(reversed(range(seg))))
    ob = new_object('Helmet', verts, faces, [mats['Armor']])
    skin(ob, arm, [{'Head': 1.0}] * len(ob.data.vertices))
    bvh = mesh_bvh(ob)
    verts2, faces2 = [], []
    if not heavy:
        # one vertical slit
        z0, z1 = 1.655, 1.795
        pts = []
        for i in range(21):
            t = i / 20
            z = lerp(z0, z1, t)
            hit, nn, _, _ = bvh.ray_cast(Vector((0, cy - 0.3, z)), Vector((0, 1, 0)), 1.0)
            if hit is None:
                continue
            p = hit + nn * 0.0025
            w = 0.0085 * math.sin(math.pi * t) ** 0.6 + 0.0008
            verts2 += [p + Vector((w, 0, 0)), p - Vector((w, 0, 0))]
            pts.append(p)
    else:
        # a horizontal band wrapping the front
        pts = []
        for i in range(25):
            ang = -50 + 100 * i / 24
            z = 1.705 - 0.006 * (abs(ang) / 50) ** 2
            d = Vector((math.sin(math.radians(ang)), -math.cos(math.radians(ang)), 0))
            hit, nn, _, _ = bvh.ray_cast(Vector((0, cy, z)) + d * 0.3, -d, 0.5)
            if hit is None:
                continue
            p = hit + nn * 0.003
            h = 0.0115 * (0.5 + 0.5 * smoothstep(0, 0.2, 1 - abs(ang) / 50))
            verts2 += [p + Vector((0, 0, h)), p - Vector((0, 0, h))]
            pts.append(p)
    for i in range(len(pts) - 1):
        a = i * 2
        faces2.append((a, a + 2, a + 3, a + 1))
    vis = new_object('Visor', verts2, faces2, [mats['Visor']])
    skin(vis, arm, [{'Head': 1.0}] * len(verts2))


# ----------------------------------------------------------------------------------------------- weapons
def hand_frame(arm):
    """The rest-pose hand frame: f toward the fingers, a through the fist out of the thumb side, the palm side, and the point
    where a handle sits in the closed fist."""
    bones = arm.data.bones
    H = bones['hand_r'].head_local
    M = bones['middle_01_r'].head_local
    I = bones['index_01_r'].head_local
    P = bones['pinky_01_r'].head_local
    f = (M - H).normalized()
    a = (I - P).normalized()
    a = (a - f * a.dot(f)).normalized()
    palm = a.cross(f).normalized()
    return f, a, palm, H + f * 0.085 + palm * 0.028


def attach_to_hand(ob, arm, matrix):
    ob.parent = arm
    ob.parent_type = 'BONE'
    ob.parent_bone = 'hand_r'
    bpy.context.view_layer.update()
    ob.matrix_world = matrix
    bpy.context.view_layer.update()


def tube(verts, faces, p0, p1, r0, r1, seg=8, cap=True):
    """A (tapered) tube between two points."""
    base = len(verts)
    d = (p1 - p0).normalized()
    u = d.cross(Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))).normalized()
    w = d.cross(u)
    for p, r in ((p0, r0), (p1, r1)):
        for s in range(seg):
            a = math.tau * s / seg
            verts.append(p + u * (math.cos(a) * r) + w * (math.sin(a) * r))
    for s in range(seg):
        a0, a1 = base + s, base + (s + 1) % seg
        faces.append((a0, a1, a1 + seg, a0 + seg))
    if cap:
        faces.append(tuple(reversed([base + s for s in range(seg)])))
        faces.append(tuple(base + seg + s for s in range(seg)))


def blade_mesh(length, width, thick, curve, seg=10):
    """A flat energy blade along +Y from y=0 (diamond cross-section); `curve` bends the tip toward +X."""
    verts, faces = [], []
    for i in range(seg + 1):
        t = i / seg
        taper = 1 - smoothstep(0.7, 1.0, t)
        w = width * (0.35 + 0.65 * math.sin(math.pi * min(1.0, t * 1.1) * 0.5 + 0.2)) * (0.1 + 0.9 * taper) if t < 1.0 else 0.0005
        xc = curve * t * t
        th = thick * (0.4 + 0.6 * taper)
        verts += [Vector((xc - w * 0.5, t * length, 0)), Vector((xc, t * length, th)), Vector((xc + w * 0.5, t * length, 0)), Vector((xc, t * length, -th))]
    for i in range(seg):
        for k in range(4):
            a, b = i * 4 + k, i * 4 + (k + 1) % 4
            faces.append((a, b, b + 4, a + 4))
    last = seg * 4
    faces.append((last, last + 1, last + 2, last + 3))
    faces.append((0, 3, 2, 1))
    return verts, faces


# Where the staff points in the armature's space (+Z up, -Y forward, -X the warden's right) while a clip plays; the clips come
# from a library made for other weapons, so the right hand is re-aimed per frame (bake_staff) to keep the halberd where a
# sentinel would carry it: upright at rest, tilted forward when ready, level when it shoots, swinging when it strikes.
CALM = Vector((-0.04, -0.08, 1.0)).normalized()
READY = Vector((-0.12, -0.62, 0.78)).normalized()
AIM = Vector((-0.04, -1.0, 0.16)).normalized()
RAISE = Vector((-0.45, 0.25, 0.86)).normalized()
SWEEP = Vector((-0.1, -0.85, 0.25)).normalized()
LOW = Vector((0.2, -0.7, -0.5)).normalized()


def staff_target(clip, t):
    """The wanted staff direction at normalized clip time t, or None to leave the clip's own hand alone."""
    if clip in ('idle', 'post', 'walk', 'search_walk', 'scan', 'check', 'hit'):
        return CALM
    if clip in ('alert', 'run'):
        return READY
    if clip == 'shoot':
        k = smoothstep(0.05, 0.4, t) * (1 - smoothstep(0.7, 1.0, t))
        return READY.lerp(AIM, k).normalized()
    if clip == 'strike':
        if t < 0.3:
            return READY.lerp(RAISE, smoothstep(0.0, 0.3, t)).normalized()
        if t < 0.5:
            return RAISE.lerp(SWEEP, smoothstep(0.3, 0.5, t)).normalized()
        if t < 0.65:
            return SWEEP.lerp(LOW, smoothstep(0.5, 0.65, t)).normalized()
        return LOW.lerp(READY, smoothstep(0.65, 1.0, t)).normalized()
    return None


def pose_at(arm, act, frame):
    arm.animation_data.action = act
    if act.slots:
        arm.animation_data.action_slot = act.slots[0]
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()


def staff_rest_dirs(arm):
    """The staff's direction and its flat-face normal in the armature's REST space, such that the idle clip's first frame
    carries it upright with its blade facing forward."""
    act = bpy.data.actions['idle']
    arm.data.pose_position = 'POSE'
    pose_at(arm, act, int(act.frame_range[0]))
    pb = arm.pose.bones['hand_r']
    rb = arm.data.bones['hand_r'].matrix_local.to_3x3()
    D = pb.matrix.to_3x3() @ rb.inverted()
    Dinv = D.inverted()
    out = (Dinv @ CALM, Dinv @ Vector((0, -1, 0)))
    arm.animation_data.action = None
    arm.data.pose_position = 'REST'
    return out


def bake_staff(arm, dirs):
    """Re-aims the right hand of every clip so the halberd (rest-space direction dirs[0]) points where staff_target says."""
    arm.data.pose_position = 'POSE'
    pb = arm.pose.bones['hand_r']
    pb.rotation_mode = 'QUATERNION'
    rb = arm.data.bones['hand_r'].matrix_local.to_3x3()
    s_local = rb.inverted() @ dirs[0]          # in the bone's own frame
    for act in list(bpy.data.actions):
        f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
        targets = []
        for f in range(f0, f1 + 1):
            targets.append((f, staff_target(act.name, (f - f0) / max(1, f1 - f0))))
        if targets[0][1] is None:
            continue
        for f, tgt in targets:
            pose_at(arm, act, f)
            m = pb.matrix.copy()
            cur = (m.to_3x3() @ s_local).normalized()
            q = cur.rotation_difference(tgt)
            rot = q.to_matrix() @ m.to_3x3()
            new = Matrix.Translation(m.translation) @ rot.to_4x4()
            pb.matrix = new
            pb.keyframe_insert('rotation_quaternion', frame=f)
    arm.animation_data.action = None
    arm.data.pose_position = 'REST'


HOLD_DIRS = ()


def build_halberd(arm, mats):
    """The sentinel's energy halberd: a long dark staff with a glowing blade, held in the right hand. Frame: +Y along the
    staff toward the blade, the grip at the origin. The empty Muzzle sits at the blade's tip."""
    f, a, palm, C = hand_frame(arm)
    root = bpy.data.objects.new('Halberd', None)
    root.empty_display_size = 0.1
    bpy.context.scene.collection.objects.link(root)
    below, top = 0.62, 0.82
    verts, faces = [], []
    tube(verts, faces, Vector((0, -below, 0)), Vector((0, top, 0)), 0.0155, 0.0155)
    tube(verts, faces, Vector((0, -below - 0.07, 0)), Vector((0, -below, 0)), 0.003, 0.021)
    tube(verts, faces, Vector((0, top - 0.02, 0)), Vector((0, top + 0.12, 0)), 0.026, 0.02)
    tube(verts, faces, Vector((0, top + 0.12, 0)), Vector((0, top + 0.15, 0)), 0.012, 0.012)
    new_object('HalberdShaft', verts, faces, [mats['Armor']], parent=root)
    lv, lf = [], []
    for y in (-0.4, -0.25, 0.3, 0.68):
        tube(lv, lf, Vector((0, y - 0.006, 0)), Vector((0, y + 0.006, 0)), 0.0185, 0.0185, cap=False)
    tube(lv, lf, Vector((0, -below - 0.06, 0)), Vector((0, -below - 0.015, 0)), 0.0042, 0.0095, seg=6, cap=False)
    new_object('HalberdLights', lv, lf, [mats['Lines']], smooth=False, parent=root)
    bv, bf = blade_mesh(0.5, 0.085, 0.004, 0.03)
    for v in bv:
        v.y += top + 0.13
    new_object('HalberdBlade', bv, bf, [mats['Blade']], smooth=False, parent=root)
    sv, sf = [], []
    tube(sv, sf, Vector((0.034, top + 0.1, 0)), Vector((0.045, top + 0.5, 0)), 0.01, 0.003, seg=6)
    tube(sv, sf, Vector((-0.025, top + 0.03, 0)), Vector((-0.07, top + 0.09, 0)), 0.01, 0.002, seg=6)
    new_object('HalberdSpine', sv, sf, [mats['Armor']], parent=root)
    muzzle = bpy.data.objects.new('Muzzle', None)
    muzzle.empty_display_size = 0.05
    bpy.context.scene.collection.objects.link(muzzle)
    muzzle.parent = root
    muzzle.location = (0.03, top + 0.13 + 0.5, 0)
    Y, Z = (v.normalized() for v in HOLD_DIRS)
    Z = (Z - Y * Z.dot(Y)).normalized()
    R = Matrix((Y.cross(Z), Y, Z)).transposed().to_4x4()
    attach_to_hand(root, arm, Matrix.Translation(C) @ R)
    return root


def build_short_blade(arm, mats):
    """The enforcer's short heavy energy blade, out of the thumb side of the right fist like a sword."""
    f, a, palm, C = hand_frame(arm)
    root = bpy.data.objects.new('Halberd', None)
    root.empty_display_size = 0.1
    bpy.context.scene.collection.objects.link(root)
    verts, faces = [], []
    tube(verts, faces, Vector((0, -0.11, 0)), Vector((0, 0.06, 0)), 0.02, 0.022)
    tube(verts, faces, Vector((0, 0.045, 0)), Vector((0, 0.075, 0)), 0.045, 0.045)
    new_object('BladeHilt', verts, faces, [mats['Armor']], parent=root)
    bv, bf = blade_mesh(0.6, 0.12, 0.012, 0.0, seg=8)
    for v in bv:
        v.y += 0.075
    new_object('BladeEnergy', bv, bf, [mats['Blade']], smooth=False, parent=root)
    muzzle = bpy.data.objects.new('Muzzle', None)
    muzzle.empty_display_size = 0.05
    bpy.context.scene.collection.objects.link(muzzle)
    muzzle.parent = root
    muzzle.location = (0.0, 0.7, 0.0)
    Y = (a * 0.7 + f * 0.7).normalized()
    Z = (f - Y * f.dot(Y)).normalized()
    R = Matrix((Y.cross(Z), Y, Z)).transposed().to_4x4()
    attach_to_hand(root, arm, Matrix.Translation(C) @ R)
    return root


def build_shield(arm, mats):
    """The enforcer's hex energy shield on the left forearm: a stretched hexagonal plane standing off the forearm's outer
    side, a dim fill, a bright rim and a honeycomb of cells."""
    b = arm.data.bones['lowerarm_l']
    h, t = b.head_local, b.tail_local
    along = (t - h).normalized()
    up = Vector((0, 0.1, 1)).normalized()      # the outer side once the arm hangs
    up = (up - along * up.dot(along)).normalized()
    across = along.cross(up)
    c = h.lerp(t, 0.45) + up * 0.1
    length, width = 0.46, 0.17

    def pt(u, w):
        return c + along * u + across * w

    hexp = [(length * math.cos(math.radians(60 * k)), width * math.sin(math.radians(60 * k))) for k in range(6)]
    fill_v = [pt(0, 0)] + [pt(u, w) for u, w in hexp]
    fill_f = [(0, 1 + k, 1 + (k + 1) % 6) for k in range(6)]
    fill = new_object('ShieldFill', fill_v, fill_f, [mats['Shield']], smooth=False)
    skin(fill, arm, [{'lowerarm_l': 1.0}] * len(fill_v))
    lv, lf = [], []

    def line_loop(pts2, wd):
        pts3 = [pt(u, w) for u, w in pts2]
        v, f = ribbon(pts3, [up] * len(pts3), wd, closed=True, taper=1.0)
        base = len(lv)
        lv.extend(v)
        lf.extend([tuple(base + k for k in face) for face in f])

    line_loop(hexp, 0.012)
    line_loop([(u * 0.8, w * 0.8) for u, w in hexp], 0.006)
    r = 0.07
    for cu, cw in ((0, 0), (-0.2, 0), (0.2, 0), (-0.1, 0.095), (0.1, 0.095), (-0.1, -0.095), (0.1, -0.095)):
        line_loop([(cu + r * math.cos(math.radians(60 * k)), cw + r * 0.9 * math.sin(math.radians(60 * k))) for k in range(6)], 0.005)
    lines = new_object('ShieldLines', lv, lf, [mats['Lines']], smooth=False)
    skin(lines, arm, [{'lowerarm_l': 1.0}] * len(lv))
    sv, sf = [], []
    for u in (-0.2, 0.2):
        tube(sv, sf, c + along * u - up * 0.1, c + along * u, 0.012, 0.012, seg=6)
    posts = new_object('ShieldPosts', sv, sf, [mats['Armor']])
    skin(posts, arm, [{'lowerarm_l': 1.0}] * len(sv))


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
                speeds.append((c[2] - a[2]) * sc.render.fps)
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
    tris = 0
    for o in bpy.data.objects:
        if o.type == 'MESH':
            n = sum(len(p.vertices) - 2 for p in o.data.polygons)
            tris += n
            print('  %-16s %5d tris' % (o.name, n))
    print('exported %s (%.2f MB, %d triangles)' % (path, os.path.getsize(path) / 1e6, tris))


def preview(outdir, arm):
    """Quick EEVEE stills: a turntable and a few poses on a dark background."""
    os.makedirs(outdir, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.render.resolution_x, sc.render.resolution_y = 480, 700
    w = bpy.data.worlds.new('preview')
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.012, 0.014, 0.019, 1)
    for loc, energy, col in (((-2.5, -3.0, 3.0), 400.0, (1, 1, 1)), ((3.0, 2.5, 2.5), 300.0, (0.6, 0.85, 1.0)), ((0.0, 3.5, 2.0), 300.0, (0.6, 0.85, 1.0))):
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

    def shoot(name, action, frac, angle, dist=4.4, height=1.1):
        act = bpy.data.actions[action]
        arm.animation_data.action = act
        if act.slots:
            arm.animation_data.action_slot = act.slots[0]
        f0, f1 = act.frame_range
        fr = f0 + (f1 - f0) * frac
        sc.frame_set(int(fr), subframe=fr - int(fr))
        a = math.radians(angle)
        co.location = (math.sin(a) * dist, -math.cos(a) * dist, height + 0.1)
        co.rotation_euler = (math.radians(87), 0, a)
        sc.render.filepath = os.path.join(outdir, name + '.png')
        bpy.ops.render.render(write_still=True)

    for ang in (0, 35, 90, 180, 215):
        shoot('turn_%03d' % ang, 'idle', 0.0, ang)
    for name in ('post', 'walk', 'run', 'alert', 'strike', 'shoot', 'hit', 'death'):
        shoot('pose_' + name, name, 0.5 if name not in ('strike', 'shoot') else 0.45, 30)
    for name in ('strike', 'shoot'):
        for i in range(6):
            shoot('strip_%s_%d' % (name, i), name, i / 5.0 * 0.98, 70)
    shoot('close_front', 'idle', 0.0, 15, dist=1.8, height=1.5)
    shoot('close_back', 'idle', 0.0, 170, dist=1.8, height=1.35)
    arm.animation_data.action = None


def main():
    global V, VARIANT
    opts = parse_args()
    VARIANT = opts['variant']
    V = VARIANTS[VARIANT]
    arm, body_ob = load_base(opts['src'])
    mats = make_materials()
    B = prepare_body(arm, body_ob, mats)
    armor = build_armor(arm, B, mats)
    neon_lines(arm, B, mesh_bvh(body_ob, armor), mats)
    build_helmet(arm, mats)
    if VARIANT == 'sentinel':
        build_coat(arm, mats)
        build_collar(arm, mats)
        global HOLD_DIRS
        HOLD_DIRS = staff_rest_dirs(arm)
        build_halberd(arm, mats)
        bake_staff(arm, HOLD_DIRS)
    else:
        build_short_blade(arm, mats)
        build_shield(arm, mats)
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
