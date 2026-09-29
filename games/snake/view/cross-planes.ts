// Пространственный крест: две плиты через весь куб, следующие за головой.
// Решение дизайнера: «плоскость горизонтальную как делать туманом чуть серым с гранями сверху и снизу —
// и также вертикально, буквально крест такой от головы пространственный бесконечный, но немного
// тусклее с дальностью». Плоскости те же, что у мини-карт: горизонтальная по осям мира X×Z на высоте
// головы (Y), вертикальная X×Y на текущем Z головы. Что видишь на карте — то видишь вокруг себя.
//
// ФОРМА. Плита — слой ТОЛЩИНОЙ РОВНО В КЛЕТКУ (клетки головы): внутри слабая сероватая дымка, а его
// границы (верхняя и нижняя грань; у вертикальной — две боковые) читаются как тонкие листы. Толщина
// не настраивается: ровно клетка — это и есть «срез карты», и тем же правилом obstacles-view
// решает, какие кубы лежат «в плоскости». Тянется от стены до стены куба.
// Переезд — по клетке, в такт ходу (берём клетку головы, без сглаживания): змейка ходит тактами.
//
// КАК РИСУЕТСЯ. Один меш-бокс на плиту (грани только задние), вся работа — в фрагментном шейдере:
// луч от камеры до задней грани режется по границам плиты, дымка — интеграл плотности вдоль
// отрезка внутри плиты (пара выборок затухания), грани — попадание луча в плоскость слоя.
// Ни новых объектов, ни записи глубины: рисуются только пиксели, накрытые плитами (не весь экран
// дважды), тест глубины включён — препятствия честно перекрывают плиту.
//
// ЗАТУХАНИЕ. То же, что у препятствий и решётки: расстояние от ГОЛОВЫ, кривая (1-t)^2 с теми же
// границами и полом (OBSTACLE_FOG_*), импортированными, чтобы всё в игре тускнело одинаково.
//
// ПОДСВЕТКА. Плиты «чутка» подсвечивают то, что лежит в их плоскости. Куб-препятствие в плоскости
// туманится по дальности на CROSS_LIFT_OBSTACLE меньше (см. obstacles-view.ts, uPlaneLift): далёкий
// куб на «моём уровне» не тонет в тумане так глубоко, как остальные, а вблизи (где туман и так
// нулевой) ничего не меняется. Яблоко в плоскости светлее на CROSS_LIFT_APPLE. Ничего нового не
// показывается: всё это и так видно, разница лишь в читаемости «на моём ли я уровне».
//
// ФАЗА plane. Как у компаса: крест скрыт и проявляется вместе с freeAmount, иначе первая игра
// перестала бы выглядеть обычной 2D-змейкой (вертикальная плита накрыла бы плоскость экрана).
//
// ВЫКЛЮЧАТЕЛИ. CROSS_STRENGTH = 0 — эффект выключен полностью (плиты не рисуются, подсветки нет).
// Игрок отключает всё вместе тумблером «Плоскости» в меню (View.setCrossOn).

import { BoxGeometry, BackSide, Color, Mesh, ShaderMaterial, Vector3, MathUtils, type Scene } from 'three'
import { OBSTACLE_FOG_FAR_CELLS, OBSTACLE_FOG_FLOOR, OBSTACLE_FOG_FULL_CELLS } from './obstacles-view'

// --- Оформительские константы (крутит дизайнер), не числа баланса -----------------
/** Общий множитель всего эффекта (дымка, грани, подсветка). 0 — крест выключен целиком. */
export const CROSS_STRENGTH = 1
/** Цвет плит: чуть сероватый, холодный (чтобы не спорить с бирюзой змейки и фиолетом препятствий). */
export const CROSS_COLOR = new Color(0.62, 0.68, 0.8)
/** Плотность дымки на клетку пути внутри плиты. Взгляд вдоль плиты копит её на 20 клетках. Главный ручник «не мутнеет ли кадр». */
export const CROSS_HAZE_DENSITY = 0.0007
/** Непрозрачность граней слоя (каждой из двух) вблизи головы; вдали гаснет по кривой затухания. */
export const CROSS_FACE_ALPHA = 0.011
/** Непрозрачность тонких линий по границам клеток на гранях слоя (грани читаются как грани, а не заливка). 0 — без линий. */
export const CROSS_GRID_ALPHA = 0.03
/** Подсветка препятствий в плоскости: доля пути «до полной яркости», на которую туман ослаблен (0..1; 0 — нет). */
export const CROSS_LIFT_OBSTACLE = 0.22
/** Подсветка яблока в плоскости: прибавка к яркости (0.12 — на 12% ярче; 0 — нет). */
export const CROSS_LIFT_APPLE = 0.12

// Выборок затухания вдоль луча внутри плиты (дымка): больше — гладче на скользящих взглядах, дороже.
const HAZE_SAMPLES = 4
// Запас меша над границами слоя, клетки: чтобы задние грани гарантированно накрывали слой.
const MESH_MARGIN = 0.05

const VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

const FRAG = /* glsl */ `
uniform vec3 uMin;
uniform vec3 uMax;
uniform vec3 uNormal;   // единичная нормаль плиты: (0,1,0) горизонтальной, (0,0,1) вертикальной
uniform vec3 uHead;
uniform vec3 uColor;
uniform float uHaze;
uniform float uFaceAlpha;
uniform float uGridAlpha;
uniform float uAmount;  // сила эффекта 0..1 (фаза и тумблер)
uniform float uFogFull;
uniform float uFogFar;
uniform float uFloor;
varying vec3 vWorld;

// Та же кривая, что fadeAt в obstacles-view.ts.
float fadeAt(vec3 world) {
  float t = clamp((distance(world, uHead) - uFogFull) / (uFogFar - uFogFull), 0.0, 1.0);
  return uFloor + (1.0 - uFloor) * (1.0 - t) * (1.0 - t);
}

// Тонкая сетка по границам клеток на грани в точке h: ширина растёт с расстоянием до камеры,
// чтобы вдали линии не рассыпались в муар.
float faceLines(vec3 h, float camDist) {
  vec3 dd = abs(fract(h) - 0.5);
  dd = mix(dd, vec3(1.0), abs(uNormal));   // вдоль нормали клеточных границ на грани нет
  float w = 0.025 + 0.004 * camDist;
  float m = min(min(dd.x, dd.y), dd.z);
  return 1.0 - smoothstep(0.0, w, m);
}

void main() {
  vec3 o = cameraPosition;
  vec3 d = vWorld - o;
  vec3 safe = mix(vec3(1e-5), d, step(vec3(1e-5), abs(d)));
  vec3 t1 = (uMin - o) / safe;
  vec3 t2 = (uMax - o) / safe;
  vec3 tlo = min(t1, t2);
  vec3 thi = max(t1, t2);
  float tNear = max(max(max(tlo.x, tlo.y), tlo.z), 0.0);
  float tFar = min(min(min(thi.x, thi.y), thi.z), 1.0);
  if (tFar <= tNear) discard;

  // Дымка: плотность * длина пути, с затуханием по расстоянию от головы в нескольких точках отрезка.
  float len = (tFar - tNear) * length(d);
  float fadeSum = 0.0;
  for (int i = 0; i < ${HAZE_SAMPLES}; i++) {
    float t = mix(tNear, tFar, (float(i) + 0.5) / ${HAZE_SAMPLES}.0);
    fadeSum += fadeAt(o + d * t);
  }
  float haze = 1.0 - exp(-uHaze * len * fadeSum / ${HAZE_SAMPLES}.0);

  // Грани слоя: где луч пересекает плоскости на границах слоя внутри отрезка.
  float na = dot(uNormal, o);
  float da = dot(uNormal, safe);
  float tLo = (dot(uNormal, uMin) - na) / da;
  float tHi = (dot(uNormal, uMax) - na) / da;
  float face = 0.0;
  if (tLo >= tNear - 1e-4 && tLo <= tFar + 1e-4 && tLo > 0.0) {
    vec3 h = o + d * tLo;
    face += (uFaceAlpha + uGridAlpha * faceLines(h, tLo * length(d))) * fadeAt(h);
  }
  if (tHi >= tNear - 1e-4 && tHi <= tFar + 1e-4 && tHi > 0.0) {
    vec3 h = o + d * tHi;
    face += (uFaceAlpha + uGridAlpha * faceLines(h, tHi * length(d))) * fadeAt(h);
  }

  float a = (haze + face) * uAmount;
  gl_FragColor = vec4(uColor, a);
}
`

/** Клетка (y, z) лежит в одной из плоскостей креста с головой (hy, hz). Чистая функция. */
export function inCrossPlane(y: number, z: number, hy: number, hz: number): boolean {
  return y === hy || z === hz
}

interface Slab {
  mesh: Mesh
  material: ShaderMaterial
  min: Vector3
  max: Vector3
}

export class CrossPlanes {
  private scene: Scene
  private geometry = new BoxGeometry(1, 1, 1)
  private slabs: Slab[] = []
  private size = 1
  private on = true
  private amount = 0

  constructor(scene: Scene) {
    this.scene = scene
    // 0: горизонтальная (нормаль Y), 1: вертикальная (нормаль Z).
    for (let i = 0; i < 2; i++) {
      const min = new Vector3()
      const max = new Vector3()
      const material = new ShaderMaterial({
        uniforms: {
          uMin: { value: min },
          uMax: { value: max },
          uNormal: { value: new Vector3(0, i === 0 ? 1 : 0, i === 0 ? 0 : 1) },
          uHead: { value: new Vector3() },
          uColor: { value: CROSS_COLOR },
          uHaze: { value: CROSS_HAZE_DENSITY },
          uFaceAlpha: { value: CROSS_FACE_ALPHA },
          uGridAlpha: { value: CROSS_GRID_ALPHA },
          uAmount: { value: 0 },
          uFogFull: { value: OBSTACLE_FOG_FULL_CELLS },
          uFogFar: { value: OBSTACLE_FOG_FAR_CELLS },
          uFloor: { value: OBSTACLE_FOG_FLOOR },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        side: BackSide,
      })
      const mesh = new Mesh(this.geometry, material)
      mesh.frustumCulled = false
      mesh.visible = false
      this.scene.add(mesh)
      this.slabs.push({ mesh, material, min, max })
    }
  }

  /** Холодный путь: размер куба. */
  setSize(size: number): void {
    this.size = size
  }

  /** Тумблер игрока (меню). */
  setOn(on: boolean): void {
    this.on = on
  }

  /** Итоговая сила 0..1 с учётом фазы и тумблера: для подсветки препятствий и яблока. */
  get strength(): number {
    return this.amount
  }

  /** Кадр, без аллокаций. (hx,hy,hz) — клетка головы; freeAmount — 0 в plane, 1 в объёме. */
  update(hx: number, hy: number, hz: number, freeAmount: number): void {
    this.amount = this.on ? CROSS_STRENGTH * MathUtils.smoothstep(freeAmount, 0, 1) : 0
    const visible = this.amount > 0.003
    const lo = -0.5
    const hi = this.size - 0.5
    for (let i = 0; i < 2; i++) {
      const slab = this.slabs[i]!
      slab.mesh.visible = visible
      if (!visible) continue
      if (i === 0) {
        slab.min.set(lo, hy - 0.5, lo)
        slab.max.set(hi, hy + 0.5, hi)
      } else {
        slab.min.set(lo, lo, hz - 0.5)
        slab.max.set(hi, hi, hz + 0.5)
      }
      const m = slab.mesh
      m.position.set((slab.min.x + slab.max.x) / 2, (slab.min.y + slab.max.y) / 2, (slab.min.z + slab.max.z) / 2)
      m.scale.set(
        slab.max.x - slab.min.x + MESH_MARGIN,
        slab.max.y - slab.min.y + MESH_MARGIN,
        slab.max.z - slab.min.z + MESH_MARGIN,
      )
      ;(slab.material.uniforms['uHead']!.value as Vector3).set(hx, hy, hz)
      slab.material.uniforms['uAmount']!.value = this.amount
    }
  }

  dispose(): void {
    for (const s of this.slabs) {
      this.scene.remove(s.mesh)
      s.material.dispose()
    }
    this.slabs.length = 0
    this.geometry.dispose()
  }
}
