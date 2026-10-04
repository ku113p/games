// Obstacles - a neon OUTER shell: solid opaque faces + edges
// (four meshes per chunk: opaque faces, opaque edges, and the transparent faces and edges of cubes that occlude the view).
// DRAW ORDER RULE: everything solid writes depth, so a thing in front hides a thing behind it (view/obstacles-view.test.ts pins it).
// Edges must NOT be transparent: transparent objects are drawn after every opaque one, and the lattice stars and near-cell arrows
// (transparent, no depth writes) would then be painted over by far edges. A face is drawn only
// if the neighbouring cell on its side is free; an edge only for a real bend
// of the outline (see obstacle-shell.ts), so a merged group reads as a single
// volume rather than a pile of wireframe boxes. The shell is computed once on
// 'started' (cold path) and is not touched per frame.
// Instancing: one instance per face (aCell + aFace) and per edge (aCenter + aAxis),
// the geometry is shared by all (quad / segment), positions are built by the vertex shader.
// The shell is cut into chunks of OBSTACLE_CHUNK_CELLS^3 cells (obstacle-chunks.ts): each has its own four meshes and bounding
// sphere, so the stock frustum culling keeps the invisible part of the arena away from the GPU; the quad is indexed (4 vertices).
// Distant ones dissolve in the scene's shared fog (palette.ts: createFog/fogUniforms) so that a dense forest
// does not blur into mush: near ones read as danger, far ones as depth. There is no falloff curve of its own.

import {
  BufferGeometry,
  BufferAttribute,
  Float32BufferAttribute,
  Sphere,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  InstancedBufferGeometry,
  InstancedBufferAttribute,
  DataTexture,
  DoubleSide,
  Mesh,
  NearestFilter,
  RedFormat,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  Vector3,
  type Scene,
} from 'three'
import type { GameState } from '../core/state'
import { cameraFrame, cubeSize, forEachObstacle, gameMode, head } from '../core/queries'
import { computeShell } from './obstacle-shell'
import { chunkShell } from './obstacle-chunks'
import {
  OBSTACLE_COLOR,
  OBSTACLE_FACE_BRIGHTNESS,
  OBSTACLE_FACE_NEG_SHADE,
  OBSTACLE_FACE_SHADE_X,
  OBSTACLE_FACE_SHADE_Y,
  OBSTACLE_FACE_SHADE_Z,
  OBSTACLE_GHOST_ALPHA,
  fogUniforms,
} from './palette'

// Obstacle cell footprint; slightly under 1 so the shell does not coincide with the cube wall plane.
// This is the footprint of the face and outline-edge PLANES. The gap between neighbours is closed not by it,
// but by the face rims overhanging toward the neighbour (obstacle-shell.ts): the outline and a lone cube do not change.
const OBSTACLE_SCALE = 0.98
// Width of the outline edges (presentation numbers). Minimum in CSS pixels: it used to be a 1 px GL line, the designer
// complained about thin, breaking faces. World width in cells - so that up close an edge is bulkier.
const OBSTACLE_EDGE_MIN_PX = 2.2
const OBSTACLE_EDGE_WORLD_W = 0.04
// Ribbon shift toward the camera in depth, in its world widths: 0 - no shift (edges get eaten by faces).
// Edge opacity of a fading (ghost) cell; for faces it is OBSTACLE_GHOST_ALPHA.
const OBSTACLE_EDGE_GHOST_ALPHA = 0.15
const OBSTACLE_EDGE_DEPTH_K = 1.5
const COMMON = /* glsl */ `
uniform float uHalf;
uniform vec3 uHead;
#include <fog_pars_vertex>
`

// Edges: aCenter - center of a cell-long segment, aAxis - along which axis (0/1/2).
// NOT GL lines (those are always 1 px and on distant obstacles they break up and flicker), but a screen-space ribbon:
// per edge instance a quad position = (along [-0.5, 0.5], side ±1). The segment ends are converted
// to pixels, the ribbon is widened by the half-width across and slightly along (corner joints are covered).
// Width is no less than uMinPx (in physical pixels: OBSTACLE_EDGE_MIN_PX * pixelRatio) and no less than
// the world uWorldW projected to the screen: up close the edge is thicker, far away no thinner than the pixels
// that the composer's MSAA can smooth. The segment is clipped at the near plane.
const VERT = /* glsl */ `
attribute vec3 aCenter;
attribute float aAxis;
attribute float aId;
uniform sampler2D uGhostTex;
uniform float uTexW;
uniform vec3 uDepthAxis;
uniform float uFree;
uniform float uLayerReach;
uniform float uEdgeGhostAlpha;
uniform float uGhostPass;   // 0 - opaque pass (solid edges, write depth), 1 - transparent (edges of fading cubes)
varying float vAlpha;
uniform vec2 uRes;
uniform float uMinPx;
uniform float uWorldW;
uniform float uDepthK;
${COMMON}
void main() {
  // Ghost level of the owner cell (same as for faces): edges of fading cubes fade with the faces,
  // otherwise all the cube's edges show through a transparent face, including the back side.
  // Flat opening: only the head's layer is drawn (uLayerReach is about half a cell); the reveal widens it, in the game it is huge.
  // Done per cell here rather than by the camera's clipping planes: this shader clamps edge ribbons that reach the near plane onto it
  // (so they are not eaten close to the camera), which would draw the edges of nearer layers instead of dropping them.
  float layerDist = dot(floor(aCenter + 0.5) - uHead, uDepthAxis);
  if (abs(layerDist) > uLayerReach) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vAlpha = 0.0;
    return;
  }
  int id = int(aId + 0.5);
  int wtex = int(uTexW);
  int row = id / wtex;
  float g = texelFetch(uGhostTex, ivec2(id - row * wtex, row), 0).r;
  float front = step(0.5, layerDist);
  g = max(g, front * (1.0 - uFree));
  // Same split as for the faces: a solid cube's edges go in the opaque pass, a fading one's in the transparent pass.
  if ((g > 0.001) != (uGhostPass > 0.5)) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vAlpha = 0.0;
    return;
  }
  vAlpha = mix(1.0, uEdgeGhostAlpha, g);
  vec3 dirv = aAxis < 0.5 ? vec3(1.0, 0.0, 0.0) : (aAxis < 1.5 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0));
  // Ends sit at the true outline corners (uHalf), not at the cell boundary (0.5): otherwise each end sticks out past the footprint.
  // The joint of corners and adjacent segments is covered by an extension of half the ribbon width (below).
  vec3 wa = aCenter - uHalf * dirv;
  vec3 wb = aCenter + uHalf * dirv;
  vec4 ca = projectionMatrix * (viewMatrix * vec4(wa, 1.0));
  vec4 cb = projectionMatrix * (viewMatrix * vec4(wb, 1.0));
  const float NEAR_W = 0.05;
  const float EDGE_END_EXT = 0.5; // end extension in fractions of half-width: covers the joint but does not stick out like a whisker
  if (ca.w < NEAR_W && cb.w < NEAR_W) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec4 ca0 = ca;
  if (ca.w < NEAR_W) ca = mix(ca, cb, (NEAR_W - ca.w) / (cb.w - ca.w));
  if (cb.w < NEAR_W) cb = mix(cb, ca0, (NEAR_W - cb.w) / (ca0.w - cb.w));
  vec2 half_ = 0.5 * uRes;
  vec2 sa = ca.xy / ca.w * half_;
  vec2 sb = cb.xy / cb.w * half_;
  vec2 d = sb - sa;
  float dl = length(d);
  d = dl > 1e-4 ? d / dl : vec2(1.0, 0.0);
  vec2 nrm = vec2(-d.y, d.x);
  bool atB = position.x > 0.0;
  vec4 c = atB ? cb : ca;
  vec2 sc = atB ? sb : sa;
  float wpx = max(uMinPx, uWorldW * projectionMatrix[1][1] * half_.y / c.w);
  vec2 sp = sc + d * ((atB ? 0.5 : -0.5) * wpx * EDGE_END_EXT) + nrm * (position.y * 0.5 * wpx);
  // The edge lies on the seam of faces, but the ribbon is wider than a line: half of it ends up "inside" the cube or behind a
  // face that, at a concave bend or a grazing corner, is nearer to the camera in depth, and the depth test
  // eats the ribbon. polygonOffset depends on the slope of the face polygons and does not help across the ribbon width,
  // so the ribbon is shifted toward the camera by a view-space depth proportional to its width
  // in the world (uDepthK widths): far away the world width is larger, and the margin grows with it.
  float bias = uDepthK * wpx * c.w / (half_.y * projectionMatrix[1][1]);
  float wv = max(c.w - bias, 0.02);
  float zc = max((c.z + projectionMatrix[2][2] * bias) / wv, -1.0) * c.w;
  gl_Position = vec4(sp / half_ * c.w, zc, c.w);
  vec4 mvPosition = viewMatrix * vec4(atB ? wb : wa, 1.0);
  #include <fog_vertex>
}
`

const FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
#include <fog_pars_fragment>
void main() {
  gl_FragColor = vec4(uColor, vAlpha);
  #include <fog_fragment>
}
`

// Faces: a quad per face. aFace: 0 +x, 1 -x, 2 +y, 3 -y, 4 +z, 5 -z; position = (u, v, 0) in ±1.
// Tangents are the cyclic axes (a+1, a+2); for the negative side u is mirrored,
// so the winding stays counter-clockwise from outside (FrontSide culls back faces).
//
// Opacity and "occluding" cubes. Two meshes on the same instances:
//   opaque - solid faces with depth writes (the opaque pass);
//   ghost  - the same faces transparent, no depth writes, drawn AFTER the opaque ones
//            (transparent: true, higher renderOrder) - depth is already there, the order
//            among transparent ones does not matter, there are only a few.
// A cell's "ghost level" g (0..1) comes from the uGhostTex texture (one byte per shell
// cell; written by the CPU only for cells near the camera-head line) and, while the camera
// has not yet flown behind the head, from plane mode: cells nearer the camera than the head layer
// are transparent by weight (1 - freeAmount). The opaque mesh hides a face at g > 0, ghost at
// g == 0; at the boundary ghost alpha = mix(1, GHOST_ALPHA, g) ~ 1, so the transition
// is seamless: a cell smoothly melts out of solid.
const FACE_VERT = /* glsl */ `
attribute vec3 aCell;
attribute float aFace;
attribute float aId;
uniform sampler2D uGhostTex;
uniform float uTexW;
uniform vec3 uDepthAxis;
uniform float uFree;
uniform float uLayerReach;
uniform float uGhostPass;   // 0 - opaque pass, 1 - transparent
uniform float uGhostAlpha;
uniform vec3 uShade;        // brightness multipliers per axis x, y, z
uniform float uNegShade;
varying float vShade;
varying float vAlpha;
${COMMON}
// Face rim overhang from the cell center: convex - uHalf, flat - 0.5, concave - 1 - uHalf.
float reachOf(float st) {
  return st < 0.5 ? uHalf : (st < 1.5 ? 0.5 : 1.0 - uHalf);
}
void main() {
  // Flat opening: only the head's layer is drawn, see uLayerReach in the edge shader.
  float layerDist = dot(aCell - uHead, uDepthAxis);
  if (abs(layerDist) > uLayerReach) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vShade = 0.0;
    vAlpha = 0.0;
    return;
  }
  int id = int(aId + 0.5);
  int w = int(uTexW);
  int row = id / w;
  float g = texelFetch(uGhostTex, ivec2(id - row * w, row), 0).r;
  float front = step(0.5, layerDist);
  g = max(g, front * (1.0 - uFree));
  bool isGhost = g > 0.001;
  if (isGhost != (uGhostPass > 0.5)) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vShade = 0.0;
    vAlpha = 0.0;
    return;
  }
  // aFace = face + 6 * (four rim states in base 3), see obstacle-shell.ts.
  float code = floor((aFace + 0.5) / 6.0);
  float face = aFace - 6.0 * code;
  float a = floor(face * 0.5);
  float s = mod(face, 2.0) < 0.5 ? 1.0 : -1.0;
  vec3 e0 = a < 0.5 ? vec3(1.0, 0.0, 0.0) : (a < 1.5 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0));
  vec3 e1 = a < 0.5 ? vec3(0.0, 1.0, 0.0) : (a < 1.5 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0));
  vec3 e2 = a < 0.5 ? vec3(0.0, 0.0, 1.0) : (a < 1.5 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0));
  // Face plane at uHalf from the center; rims extend toward the neighbour (see reachOf) so that
  // adjacent cubes join without a gap. wu - the sign along e1 in the world (mirrored for s < 0).
  float wu = s * position.x;
  float wv = position.y;
  float r1 = reachOf(wu > 0.0 ? mod(code, 3.0) : mod(floor(code / 3.0), 3.0));
  float r2 = reachOf(wv > 0.0 ? mod(floor(code / 9.0), 3.0) : floor(code / 27.0));
  vec3 world = aCell + uHalf * s * e0 + wu * r1 * e1 + wv * r2 * e2;
  vShade = (a < 0.5 ? uShade.x : (a < 1.5 ? uShade.y : uShade.z)) * (s > 0.0 ? 1.0 : uNegShade);
  vAlpha = mix(1.0, uGhostAlpha, g);
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`
const FACE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uFaceK;
varying float vShade;
varying float vAlpha;
#include <fog_pars_fragment>
void main() {
  gl_FragColor = vec4(uColor * (uFaceK * vShade), vAlpha);
  #include <fog_fragment>
}
`

// Presentation constants of the "occluding" cubes (not balance values).
const OCCLUDER_RADIUS = 1.0 // cells whose centers are closer than this radius to the line of sight
const OCCLUDER_START = 1.0 // offset from the head toward the camera: the head itself and its neighbours do not fade
const OCCLUDER_STEP = 0.5 // sampling step along the camera-head segment
const OCCLUDER_REACH = 24 // we do not search farther than this from the head (in plane mode the mode weight does the work)
const OCCLUDER_MAX_ACTIVE = 2048 // cap on simultaneously fading cells
const GHOST_FADE_MS = 140 // time constant of the smooth transition
const GHOST_TEX_W = 256
// The shell is cut into chunks of this many cells: each chunk has its own meshes and bounding sphere, and stock frustum culling
// keeps the GPU from processing what is definitely off screen. The picture does not change. A smaller chunk means
// more precise culling but more draw calls (at 100^3 with 25 - up to 64 chunks of 4 meshes each).
// 0 - do not cut (one chunk for the whole arena, as it was: pixel-identical picture, but no culling). When split into chunks,
// in ~0.3-0.6% of pixels (thin 1-2 px spots where edge ribbons overlap) which ribbon lies on top changes: before, it was
// decided by the order in the shared buffer, now by the chunk order.
const OBSTACLE_CHUNK_CELLS = 25
// Chunk draw order is fixed (renderOrder = layer + chunk index * step). Without it, objects with equal
// renderOrder are sorted by three.js by distance to the camera, so the order of two chunks could flip as the camera moves.
// That matters where fragments are equal in depth (seams of joining faces) or edge ribbons overlap: the winner is
// decided by draw order, so a depth-sorted order would make the winning side switch as the camera moves.
// Order: opaque list (faces, then solid edges of the same chunk; depth decides who hides whom) always before the transparent list
// (transparent faces < near-cells (2) < edges of fading cubes).
const CHUNK_ORDER_STEP = 0.001
const GHOST_ORDER = 1
const EDGES_ORDER = 3
// Solid edges sit in the opaque list right after the faces of their chunk (the depth test does the hiding, the order is only for ties).
const EDGES_SOLID_OFFSET = CHUNK_ORDER_STEP / 2
// Shared indexed quad (4 vertices, 2 triangles instead of 6 vertices): the vertex shader computes the unique vertices.
const QUAD_INDEX = [0, 1, 2, 0, 2, 3]
// true - always run the transparent pass over all faces (as it was); false - only when there is something to draw.
const GHOST_PASS_ALWAYS = false

interface ObstacleChunk {
  /** Edges of solid cubes: opaque, write depth. */
  edges: Mesh
  /** Edges of fading cubes: transparent, no depth writes. */
  ghostEdges: Mesh
  opaque: Mesh
  ghost: Mesh
  geometries: BufferGeometry[]
  /** How many cells of this chunk are currently in the fading (active) list. */
  active: number
}

export class ObstaclesView {
  private scene: Scene
  private readonly res = new Vector2(1, 1)
  private material: ShaderMaterial | null = null
  private ghostEdgeMaterial: ShaderMaterial | null = null
  private faceMaterials: ShaderMaterial[] = []
  // Shell chunks: edge/opaque/transparent face meshes and the count of fading cells in each.
  private chunks: ObstacleChunk[] = []
  private chunkOfCell = new Int32Array(0)
  // The flat opening's own shell of the head's layer (see buildFlat): drawn instead of the chunks while flat, absent in the game.
  private flatMeshes: Mesh[] = []
  private flatGeometries: BufferGeometry[] = []
  private flatMaterials: ShaderMaterial[] = []
  private flatTex: DataTexture | null = null
  private solid = new Set<number>()
  private solidSize = 1

  // Shell cells: cell index by key, ghost level, frame stamp, active list.
  private cellId = new Int32Array(0)
  private ghostLevel = new Float32Array(0)
  private stamp = new Int32Array(0)
  private inActive = new Uint8Array(0)
  private active = new Int32Array(OCCLUDER_MAX_ACTIVE)
  private activeCount = 0
  private frameNo = 0
  private ghostTex: DataTexture | null = null
  private ghostBytes = new Uint8Array(0)
  private readonly uHead = new Vector3()
  private readonly uDepthAxis = new Vector3()
  private readonly frameUniforms = {
    uDepthAxis: { value: this.uDepthAxis },
    uFree: { value: 1 },
    uLayerReach: { value: 1e6 },
  }

  /** How many faces and edges are in the shell of the last build (for measurements). */
  shellFaces = 0
  shellEdges = 0
  /** Shell chunks (for measurements). */
  get chunkCount(): number {
    return this.chunks.length
  }
  /** How many cells are currently fading or transparent (for measurements). */
  get ghostCells(): number {
    return this.activeCount
  }

  constructor(scene: Scene) {
    this.scene = scene
  }

  /** Cold path: call from handle('started', s), not from render(). */
  rebuild(s: GameState): void {
    this.disposeLines()
    const n = cubeSize(s)
    this.solidSize = n
    this.solid.clear()
    forEachObstacle(s, (x, y, z) => {
      this.solid.add(x + n * (y + n * z))
    })
    const half = OBSTACLE_SCALE / 2
    const rawShell = computeShell(this.solid, n, half)
    this.shellFaces = rawShell.faceCount
    this.shellEdges = rawShell.edgeCount
    const parts = chunkShell(rawShell.faces, rawShell.faceCount, rawShell.edges, rawShell.edgeCount, n, OBSTACLE_CHUNK_CELLS > 0 ? OBSTACLE_CHUNK_CELLS : n)

    const uniforms = {
      ...fogUniforms(),
      uColor: { value: OBSTACLE_COLOR },
      uHead: { value: this.uHead },
      uHalf: { value: half },
    }

    // Shell cells: faces of one cell go consecutively (computeShell, order preserved by chunkShell), the cell index is
    // sequential by first appearance; we remember each cell's chunk to count fading cells per chunk.
    const nn = n * n * n
    this.cellId = new Int32Array(nn).fill(-1)
    const faceIds: Float32Array[] = []
    const cellChunk: number[] = []
    let cells = 0
    for (let ci = 0; ci < parts.length; ci++) {
      const part = parts[ci]!
      const ids = new Float32Array(part.faceCount)
      for (let i = 0; i < part.faceCount; i++) {
        const key = part.faces[i * 4]! + n * (part.faces[i * 4 + 1]! + n * part.faces[i * 4 + 2]!)
        let id = this.cellId[key]!
        if (id < 0) {
          id = cells++
          this.cellId[key] = id
          cellChunk.push(ci)
        }
        ids[i] = id
      }
      faceIds.push(ids)
    }
    this.chunkOfCell = Int32Array.from(cellChunk)
    this.ghostLevel = new Float32Array(cells)
    this.stamp = new Int32Array(cells).fill(-1)
    this.inActive = new Uint8Array(cells)
    this.activeCount = 0
    const rows = Math.max(1, Math.ceil(cells / GHOST_TEX_W))
    this.ghostBytes = new Uint8Array(GHOST_TEX_W * rows)
    const tex = new DataTexture(this.ghostBytes, GHOST_TEX_W, rows, RedFormat, UnsignedByteType)
    tex.minFilter = NearestFilter
    tex.magFilter = NearestFilter
    tex.generateMipmaps = false
    tex.needsUpdate = true
    this.ghostTex = tex

    // Outline: an instance per edge, base is a quad (along the segment x side), positions are built by the vertex shader.
    const edgeUniforms = {
      ...uniforms,
      uRes: { value: this.res },
      uMinPx: { value: OBSTACLE_EDGE_MIN_PX },
      uWorldW: { value: OBSTACLE_EDGE_WORLD_W },
      uDepthK: { value: OBSTACLE_EDGE_DEPTH_K },
      uDepthAxis: this.frameUniforms.uDepthAxis,
      uFree: this.frameUniforms.uFree,
      uLayerReach: this.frameUniforms.uLayerReach,
      uGhostTex: { value: tex },
      uTexW: { value: GHOST_TEX_W },
      uEdgeGhostAlpha: { value: OBSTACLE_EDGE_GHOST_ALPHA },
    }
    // Solid edges are OPAQUE and write depth (like the faces): a nearer star, arrow or face then hides a farther edge by the depth test.
    // As transparent edges (the old way) they were drawn after everything and, not knowing about the stars and arrow markers (which
    // are transparent and write no depth), painted the far edges over them. Only the edges of fading cubes stay transparent.
    this.material = new ShaderMaterial({ uniforms: { ...edgeUniforms, uGhostPass: { value: 0 } }, vertexShader: VERT, fragmentShader: FRAG, fog: true, side: DoubleSide })
    this.ghostEdgeMaterial = new ShaderMaterial({ uniforms: { ...edgeUniforms, uGhostPass: { value: 1 } }, vertexShader: VERT, fragmentShader: FRAG, fog: true, side: DoubleSide, transparent: true, depthWrite: false })
    // Frame buffer size (physical px) and pixelRatio - before drawing, without allocations.
    const minPx = edgeUniforms.uMinPx
    const beforeEdges = (renderer: { getDrawingBufferSize(t: Vector2): Vector2; getPixelRatio(): number }): void => {
      renderer.getDrawingBufferSize(this.res)
      minPx.value = OBSTACLE_EDGE_MIN_PX * renderer.getPixelRatio()
    }

    // Faces: an instance per face, base is a quad of two triangles; the chunk geometry is shared by
    // the opaque and transparent meshes.
    const shared = {
      ...uniforms,
      uDepthAxis: this.frameUniforms.uDepthAxis,
      uFree: this.frameUniforms.uFree,
      uLayerReach: this.frameUniforms.uLayerReach,
      uGhostTex: { value: tex },
      uTexW: { value: GHOST_TEX_W },
      uGhostAlpha: { value: OBSTACLE_GHOST_ALPHA },
      uShade: { value: new Vector3(OBSTACLE_FACE_SHADE_X, OBSTACLE_FACE_SHADE_Y, OBSTACLE_FACE_SHADE_Z) },
      uNegShade: { value: OBSTACLE_FACE_NEG_SHADE },
      uFaceK: { value: OBSTACLE_FACE_BRIGHTNESS },
    }
    // polygonOffset: faces slightly deeper so that the edges on their boundaries do not flicker (z-fight).
    const opaqueMat = new ShaderMaterial({
      uniforms: { ...shared, uGhostPass: { value: 0 } },
      vertexShader: FACE_VERT,
      fragmentShader: FACE_FRAG,
      fog: true,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    })
    const ghostMat = new ShaderMaterial({
      uniforms: { ...shared, uGhostPass: { value: 1 } },
      vertexShader: FACE_VERT,
      fragmentShader: FACE_FRAG,
      fog: true,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    })
    this.faceMaterials = [opaqueMat, ghostMat]

    const edgeQuad = new Float32BufferAttribute([-0.5, -1, 0, 0.5, -1, 0, 0.5, 1, 0, -0.5, 1, 0], 3)
    const faceQuad = new Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)

    for (let ci = 0; ci < parts.length; ci++) {
      const part = parts[ci]!
      const sphere = new Sphere(new Vector3(part.cx, part.cy, part.cz), part.radius)
      const geoms: BufferGeometry[] = []

      const edgeGeometry = new InstancedBufferGeometry()
      edgeGeometry.setAttribute('position', edgeQuad)
      edgeGeometry.setIndex(new BufferAttribute(new Uint16Array(QUAD_INDEX), 1))
      const edgeBuf = new InstancedInterleavedBuffer(part.edges, 4)
      edgeGeometry.setAttribute('aCenter', new InterleavedBufferAttribute(edgeBuf, 3, 0))
      edgeGeometry.setAttribute('aAxis', new InterleavedBufferAttribute(edgeBuf, 1, 3))
      // The edge owner is the cell whose face produced it: the edge's offsets from its center are ±half on two axes,
      // so rounding the edge center gives its index. Edges fade with their cell (see FACE_VERT).
      const edgeIds = new Float32Array(part.edgeCount)
      for (let i = 0; i < part.edgeCount; i++) {
        const ex = Math.round(part.edges[i * 4]!)
        const ey = Math.round(part.edges[i * 4 + 1]!)
        const ez = Math.round(part.edges[i * 4 + 2]!)
        edgeIds[i] = this.cellId[ex + n * (ey + n * ez)]!
      }
      edgeGeometry.setAttribute('aId', new InstancedBufferAttribute(edgeIds, 1))
      edgeGeometry.instanceCount = part.edgeCount
      edgeGeometry.boundingSphere = sphere
      // Solid edges: in the opaque list (three draws it before every transparent object whatever the renderOrder), after this chunk's faces.
      const edges = new Mesh(edgeGeometry as BufferGeometry, this.material)
      edges.renderOrder = ci * CHUNK_ORDER_STEP + EDGES_SOLID_OFFSET
      edges.onBeforeRender = beforeEdges
      // Edges of fading cubes: transparent, after the transparent faces and the near-cells layer (renderOrder 2), same geometry.
      const ghostEdges = new Mesh(edgeGeometry as BufferGeometry, this.ghostEdgeMaterial)
      ghostEdges.renderOrder = EDGES_ORDER + ci * CHUNK_ORDER_STEP
      ghostEdges.onBeforeRender = beforeEdges
      geoms.push(edgeGeometry as BufferGeometry)

      const fillGeometry = new InstancedBufferGeometry()
      fillGeometry.setAttribute('position', faceQuad)
      fillGeometry.setIndex(new BufferAttribute(new Uint16Array(QUAD_INDEX), 1))
      const faceBuf = new InstancedInterleavedBuffer(part.faces, 4)
      fillGeometry.setAttribute('aCell', new InterleavedBufferAttribute(faceBuf, 3, 0))
      fillGeometry.setAttribute('aFace', new InterleavedBufferAttribute(faceBuf, 1, 3))
      fillGeometry.setAttribute('aId', new InstancedBufferAttribute(faceIds[ci]!, 1))
      fillGeometry.instanceCount = part.faceCount
      fillGeometry.boundingSphere = sphere
      const opaque = new Mesh(fillGeometry as BufferGeometry, opaqueMat)
      opaque.renderOrder = ci * CHUNK_ORDER_STEP
      const ghost = new Mesh(fillGeometry as BufferGeometry, ghostMat)
      ghost.renderOrder = GHOST_ORDER + ci * CHUNK_ORDER_STEP
      geoms.push(fillGeometry as BufferGeometry)

      // frustumCulled (true by default) + the sphere above: chunks outside the frame are not drawn.
      this.scene.add(edges, ghostEdges, opaque, ghost)
      this.chunks.push({ edges, ghostEdges, opaque, ghost, geometries: geoms, active: 0 })
    }

    if (gameMode(s) === 'plane') this.buildFlat(s, n, half, edgeUniforms, shared, beforeEdges)
  }

  /**
   * The flat opening draws the head's layer as a flat board, so its obstacles have to read as solid squares. The shell of the whole arena
   * cannot give that: a cell whose neighbour toward the viewer is also an obstacle has no front face in it (it is an inner face of the
   * 3D volume), and with that neighbour not drawn it would show as a hollow square. So while the game is flat, the layer's cells get a shell of their own
   * (computed from the layer's cells alone, every cell with its front face), and the arena's chunks are hidden; when the reveal starts
   * the chunks take over (update). Cold path; a layer holds a few dozen cells at most.
   */
  private buildFlat(
    s: GameState,
    n: number,
    half: number,
    edgeUniforms: Record<string, { value: unknown }>,
    faceUniforms: Record<string, { value: unknown }>,
    beforeEdges: (renderer: { getDrawingBufferSize(t: Vector2): Vector2; getPixelRatio(): number }) => void,
  ): void {
    const d = cameraFrame(s).depth
    const h = head(s)
    const ax = Math.abs(d.x)
    const ay = Math.abs(d.y)
    const az = Math.abs(d.z)
    const layer = ax * h.x + ay * h.y + az * h.z
    const layerSolid = new Set<number>()
    forEachObstacle(s, (x, y, z) => {
      if (ax * x + ay * y + az * z === layer) layerSolid.add(x + n * (y + n * z))
    })
    if (layerSolid.size === 0) return
    const raw = computeShell(layerSolid, n, half)
    const parts = chunkShell(raw.faces, raw.faceCount, raw.edges, raw.edgeCount, n, n)
    // No ghost levels in the flat opening: a texture of zeros, so the shared shaders see g = 0 everywhere.
    const tex = new DataTexture(new Uint8Array(GHOST_TEX_W), GHOST_TEX_W, 1, RedFormat, UnsignedByteType)
    tex.minFilter = NearestFilter
    tex.magFilter = NearestFilter
    tex.generateMipmaps = false
    tex.needsUpdate = true
    this.flatTex = tex
    const edgeMat = new ShaderMaterial({
      uniforms: { ...edgeUniforms, uGhostTex: { value: tex }, uGhostPass: { value: 0 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      fog: true,
      side: DoubleSide,
    })
    const faceMat = new ShaderMaterial({
      uniforms: { ...faceUniforms, uGhostTex: { value: tex }, uGhostPass: { value: 0 } },
      vertexShader: FACE_VERT,
      fragmentShader: FACE_FRAG,
      fog: true,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    })
    this.flatMaterials = [edgeMat, faceMat]
    const edgeQuad = new Float32BufferAttribute([-0.5, -1, 0, 0.5, -1, 0, 0.5, 1, 0, -0.5, 1, 0], 3)
    const faceQuad = new Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)
    for (const part of parts) {
      const sphere = new Sphere(new Vector3(part.cx, part.cy, part.cz), part.radius)
      const edgeGeometry = new InstancedBufferGeometry()
      edgeGeometry.setAttribute('position', edgeQuad)
      edgeGeometry.setIndex(new BufferAttribute(new Uint16Array(QUAD_INDEX), 1))
      const edgeBuf = new InstancedInterleavedBuffer(part.edges, 4)
      edgeGeometry.setAttribute('aCenter', new InterleavedBufferAttribute(edgeBuf, 3, 0))
      edgeGeometry.setAttribute('aAxis', new InterleavedBufferAttribute(edgeBuf, 1, 3))
      edgeGeometry.setAttribute('aId', new InstancedBufferAttribute(new Float32Array(part.edgeCount), 1))
      edgeGeometry.instanceCount = part.edgeCount
      edgeGeometry.boundingSphere = sphere
      const edges = new Mesh(edgeGeometry as BufferGeometry, edgeMat)
      edges.renderOrder = EDGES_SOLID_OFFSET
      edges.onBeforeRender = beforeEdges

      const fillGeometry = new InstancedBufferGeometry()
      fillGeometry.setAttribute('position', faceQuad)
      fillGeometry.setIndex(new BufferAttribute(new Uint16Array(QUAD_INDEX), 1))
      const faceBuf = new InstancedInterleavedBuffer(part.faces, 4)
      fillGeometry.setAttribute('aCell', new InterleavedBufferAttribute(faceBuf, 3, 0))
      fillGeometry.setAttribute('aFace', new InterleavedBufferAttribute(faceBuf, 1, 3))
      fillGeometry.setAttribute('aId', new InstancedBufferAttribute(new Float32Array(part.faceCount), 1))
      fillGeometry.instanceCount = part.faceCount
      fillGeometry.boundingSphere = sphere
      const fill = new Mesh(fillGeometry as BufferGeometry, faceMat)

      this.scene.add(edges, fill)
      this.flatMeshes.push(edges, fill)
      this.flatGeometries.push(edgeGeometry as BufferGeometry, fillGeometry as BufferGeometry)
    }
  }

  /**
   * Frame, allocation-free: which cubes obstruct the view and how transparent they are.
   * (cx,cy,cz) - camera, (hx,hy,hz) - head, (px,py,pz) - screen depth axis,
   * freeAmount - 0 in plane mode, 1 in free mode.
   * layerReach - how far from the head's layer (cells, along the depth axis) obstacles are drawn: about half a cell in the flat opening
   * (only the layer), widening during the reveal, huge in the game (view/camera-rig.ts layerReach).
   *
   * "Obstructs" is geometric: the cell center is closer than OCCLUDER_RADIUS to the segment from
   * the point OCCLUDER_START from the head toward the camera. The segment is walked with step
   * OCCLUDER_STEP, at each point the 27 neighbouring cells are checked via the cellId array
   * (O(1)), not all obstacles. Level g is pulled toward the target exponentially.
   */
  update(dtMs: number, cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, px: number, py: number, pz: number, freeAmount: number, layerReach: number): void {
    if (!this.ghostTex) return
    this.uHead.set(hx, hy, hz)
    this.uDepthAxis.set(px, py, pz)
    this.frameUniforms.uFree.value = freeAmount
    this.frameUniforms.uLayerReach.value = layerReach
    this.frameNo++
    const n = this.solidSize
    const frameNo = this.frameNo

    // Plane mode: the camera is far away, transparency there comes from the mode weight in the shader.
    if (freeAmount > 0.5) {
      const vx = cx - hx
      const vy = cy - hy
      const vz = cz - hz
      const len = Math.sqrt(vx * vx + vy * vy + vz * vz)
      if (len > OCCLUDER_START) {
        const ux = vx / len
        const uy = vy / len
        const uz = vz / len
        const reach = Math.min(len, OCCLUDER_REACH)
        const r2 = OCCLUDER_RADIUS * OCCLUDER_RADIUS
        for (let t = OCCLUDER_START; t <= reach; t += OCCLUDER_STEP) {
          const x = hx + ux * t
          const y = hy + uy * t
          const z = hz + uz * t
          const ix = Math.round(x)
          const iy = Math.round(y)
          const iz = Math.round(z)
          for (let oz = -1; oz <= 1; oz++) {
            const kz = iz + oz
            if (kz < 0 || kz >= n) continue
            const dz = kz - z
            for (let oy = -1; oy <= 1; oy++) {
              const ky = iy + oy
              if (ky < 0 || ky >= n) continue
              const dy = ky - y
              for (let ox = -1; ox <= 1; ox++) {
                const kx = ix + ox
                if (kx < 0 || kx >= n) continue
                const dx = kx - x
                if (dx * dx + dy * dy + dz * dz > r2) continue
                const id = this.cellId[kx + n * (ky + n * kz)]!
                if (id < 0 || this.stamp[id] === frameNo) continue
                this.stamp[id] = frameNo
                if (this.inActive[id] === 0 && this.activeCount < OCCLUDER_MAX_ACTIVE) {
                  this.inActive[id] = 1
                  this.active[this.activeCount++] = id
                  this.chunks[this.chunkOfCell[id]!]!.active++
                }
              }
            }
          }
        }
      }
    }

    // Smooth transition of active cells; cooled ones drop out of the list.
    const k = 1 - Math.exp(-dtMs / GHOST_FADE_MS)
    let changed = false
    for (let i = 0; i < this.activeCount; ) {
      const id = this.active[i]!
      const target = this.stamp[id] === frameNo ? 1 : 0
      let g = this.ghostLevel[id]! + (target - this.ghostLevel[id]!) * k
      if (target === 0 && g < 0.004) g = 0
      else if (target === 1 && g > 0.996) g = 1
      this.ghostLevel[id] = g
      const byte = Math.round(g * 255)
      if (this.ghostBytes[id] !== byte) {
        this.ghostBytes[id] = byte
        changed = true
      }
      if (g === 0 && target === 0) {
        this.inActive[id] = 0
        this.chunks[this.chunkOfCell[id]!]!.active--
        this.active[i] = this.active[--this.activeCount]!
      } else {
        i++
      }
    }
    if (changed) this.ghostTex.needsUpdate = true
    // The transparent pass runs the vertex shader over all faces of the mesh but draws only a few. While there are no fading cells
    // (g == 0 everywhere) and plane mode gives no weight, it draws nothing. Meshes per chunk: the transparent pass goes
    // only over chunks that have fading cells (before - over the whole shell, as soon as even one was fading).
    const allGhost = GHOST_PASS_ALWAYS || freeAmount < 1
    // Flat opening (layerReach under one cell: only the head's layer): the layer's own shell is drawn, not the arena's chunks.
    const flat = layerReach < 1 && this.flatMeshes.length > 0
    for (let i = 0; i < this.flatMeshes.length; i++) this.flatMeshes[i]!.visible = flat
    for (let i = 0; i < this.chunks.length; i++) {
      const c = this.chunks[i]!
      c.edges.visible = !flat
      c.opaque.visible = !flat
      c.ghost.visible = !flat && (allGhost || c.active > 0)
      c.ghostEdges.visible = c.ghost.visible
    }
  }

  /** Is there an obstacle in the cell (the set is built on 'started'). Allocation-free. */
  isSolid = (x: number, y: number, z: number): boolean =>
    this.solid.has(x + this.solidSize * (y + this.solidSize * z))

  private disposeLines(): void {
    for (const c of this.chunks) {
      this.scene.remove(c.edges, c.ghostEdges, c.opaque, c.ghost)
      for (const g of c.geometries) g.dispose()
    }
    this.chunks = []
    this.scene.remove(...this.flatMeshes)
    for (const g of this.flatGeometries) g.dispose()
    for (const m of this.flatMaterials) m.dispose()
    this.flatTex?.dispose()
    this.flatMeshes = []
    this.flatGeometries = []
    this.flatMaterials = []
    this.flatTex = null
    this.chunkOfCell = new Int32Array(0)
    this.material?.dispose()
    this.material = null
    this.ghostEdgeMaterial?.dispose()
    this.ghostEdgeMaterial = null
    for (const m of this.faceMaterials) m.dispose()
    this.faceMaterials = []
    this.ghostTex?.dispose()
    this.ghostTex = null
    this.activeCount = 0
  }

  dispose(): void {
    this.disposeLines()
  }
}
