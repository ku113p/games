// Палитра освещения.
//
// ЦВЕТА — ДАННЫЕ. Наборы цветов лежат в config.json (palettes.sets.<id>, hex-строки), какой из них надет — решает магазин.
// Здесь живут ЖИВЫЕ объекты Color: остальной view импортирует их по прежним именам (SNAKE_BODY_COLOR, APPLE_COLOR, ...),
// а applyPalette() при старте партии перезаписывает их на месте. Это холодный путь: в кадре ничего не создаётся и не читается из
// конфига. Смена набора на лету не поддерживается (материалы копируют цвет при создании): только между партиями, до createView.
//
// ЯРКОСТЬ СВЕЧЕНИЯ ТОЖЕ СЧИТАЕТСЯ САМА. Bloom берёт линейную яркость 0.299R+0.587G+0.114B выше порога BLOOM_THRESHOLD.
// В наборе хранится только оттенок; множитель для каждой роли = целевая яркость (config.palettes.glow) / яркость оттенка,
// с потолком maxBoost. Так любой набор светится одинаково, а «сигналы горят, тихое не светится» выполняется без подбора ×3.0 руками.
// Оформительские константы ниже (альфы, пороги) — не числа баланса; по AGENTS.md баланс живёт в config.json, а не они.
// Проверка различимости сигналов головы — palette-math.ts (checkPalette) и palette.test.ts: набор, не прошедший её, в конфиг не попадает.

import { Color, FogExp2, UniformsLib, UniformsUtils, type IUniform } from 'three'
import configJson from '../config.json'
import { boostsFor, type GlowTargets, type PaletteSet } from './palette-math'

export type { GlowTargets, PaletteSet } from './palette-math'

/** Раздел config.palettes. */
export interface PalettesConfig {
  glow: GlowTargets
  sets: Readonly<Record<string, PaletteSet>>
}

/** Набор по умолчанию и запасной, если выбранного нет в конфиге. */
export const DEFAULT_PALETTE_ID = 'neon'

/** Фон сцены и мини-карты (живой объект, см. applyPalette). */
export const BACKGROUND_COLOR = new Color()
// Цвет тумана: не чёрный фон, а видимый фон сцены (слабая вуаль стенок куба + bloom ≈ sRGB 30,34,58 у «Ночного неона»):
// иначе дальние блоки чернеют дырами на светлой вуали, а не растворяются в ней.
export const FOG_COLOR = new Color()

// ТУМАН СЦЕНЫ. Единственный механизм затухания по дальности от КАМЕРЫ: экспоненциальный
// FogExp2 (exp(-(ρ·d)²), d — глубина в кадре), цвет тумана = цвет фона, поэтому далёкое не
// сереет, а растворяется в фон. Плотность ρ живёт в config.json (fog.density, 0 — туман выключен
// целиком), в кадре её выставляет view/index.ts: ρ·smoothstep(freeAmount), чтобы в фазе plane
// (камера далеко снаружи) первая игра оставалась плоской, и 0 при выключенном тумблере «Туман».
// Штатные материалы (змейка, луч направления) туманятся сами (fog: true по умолчанию); кастомные
// шейдеры берут те же uniform'ы через fogUniforms() + material.fog = true и считают по той же формуле:
// непрозрачные — стандартными чанками fog_*, прозрачные точки — через fogVisibility (множитель альфы).
// Вне тумана намеренно: яблоко (должно быть видно на любой дистанции), компас, ближние маркеры головы
// (near-cells: ≤ 2 клеток), стенки куба, их сетка и проекция головы (у них своё затухание по камере:
// FALLOFF_* в cube-frame.ts — оно работает и в фазе plane, где общий туман выключен).
export function createFog(): FogExp2 {
  return new FogExp2(FOG_COLOR, 0)
}
/** Униформы тумана для ShaderMaterial с fog: true (значения обновляет рендерер из scene.fog). Новый набор на материал. */
export function fogUniforms(): Record<string, IUniform> {
  return UniformsUtils.merge([UniformsLib.fog])
}
/** GLSL: видимость (1 — чисто, 0 — туман) для прозрачных шейдеров; та же формула, что у FogExp2. Нужен fogUniforms(). */
export const FOG_VISIBILITY_GLSL = /* glsl */ `
uniform float fogDensity;
float fogVisibility(float viewDepth) {
  return exp(-fogDensity * fogDensity * viewDepth * viewDepth);
}
`

// Рёбра куба-арены: светятся, но не заливают (bloom-порог BLOOM_THRESHOLD, см. блок Bloom ниже).
// Множитель считает applyPalette (у «Ночного неона» 2.2: было 1.6, стало 2.2, ярче линия -> заметный мягкий ореол по рёбрам куба).
export const CUBE_EDGE_COLOR = new Color()
// Толщина ребра в клетках: size * k, в пределах [min, max].
export const CUBE_EDGE_THICKNESS_PER_SIZE = 0.004
export const CUBE_EDGE_THICKNESS_MIN = 0.07
export const CUBE_EDGE_THICKNESS_MAX = 0.2

// Проекция головы на стенки: очень тихая, заметно тусклее рёбер и змейки.
// Яркость (линейный цвет * альфа) ниже порога bloom 0.25.
export const MARK_COLOR = new Color()
export const MARK_LINE_ALPHA = 0.12
export const MARK_SQUARE_ALPHA = 0.2

// Читаемость: тело и хвост яркие (сине-зелёный неон, яркость не падает ниже
// уровня яркого сегмента), голова тёплая и ярче тела — не спутать ни с телом,
// ни с яблоком (розовый).
export const SNAKE_BODY_COLOR = new Color()
export const SNAKE_TAIL_COLOR = new Color()
export const SNAKE_HEAD_COLOR = new Color()
// Чётные/нечётные сегменты чуть различаются по яркости — видно длину и движение.
export const SNAKE_STRIPE_DIM = 0.72
// Множитель яркости тела змейки (только вид змейки, мини-карта его не берёт).
// Неон-проход: было 1.0 (тело не светилось вовсе), стало 1.25 — светятся яркие сегменты,
// тусклые полосы (SNAKE_STRIPE_DIM) остаются ниже порога: полосатость не пропадает.
export let SNAKE_BODY_GLOW_BOOST = 1.25

export const APPLE_COLOR = new Color()
// Множитель яркости яблока (мини-карта его не берёт). Неон-проход: было 1.0 (линейная яркость
// красно-розового ~0.34 — ниже порога, яблоко не светилось), стало 2.5.
export let APPLE_GLOW_BOOST = 2.5
export const APPLE_EMISSIVE_PULSE_MIN = 0.6
export const APPLE_EMISSIVE_PULSE_MAX = 1.35

// Контуры препятствий: фиолетовый неон. Неон-проход: множитель было 1.0, стало 3.2 — тонкая
// линия в 1 px стала яркой, но ореол у неё крошечный: сами грани не светятся.
// Грани берут тот же цвет, поэтому OBSTACLE_FACE_BRIGHTNESS делится на множитель:
// яркость граней осталась прежней (0.3 от прежнего цвета), меняется только линия.
// Цвет линии уже умножен на множитель (applyPalette), OBSTACLE_FACE_BRIGHTNESS делится на него.
export const OBSTACLE_COLOR = new Color()

// Сетка на стенках: тусклая, ниже порога bloom; каждая 5-я линия ярче.
export const GRID_COLOR = new Color()
export const GRID_MINOR_ALPHA = 0.1
export const GRID_MAJOR_ALPHA = 0.3

// Мини-карта: приглушённая подсказка боковым зрением.
export const MINIMAP_BG_COLOR = new Color()
export const MINIMAP_BG_ALPHA = 0.4
export const MINIMAP_BORDER_COLOR = new Color()
// Тихий край окна просмотра (мир за ним продолжается) — заметно тусклее стены.
export const MINIMAP_BORDER_ALPHA = 0.22
// Настоящая стена арены на карте: сплошная толстая линия по той стороне окна, где оно упёрлось.
export const MINIMAP_WALL_COLOR = new Color()
export const MINIMAP_WALL_ALPHA = 0.95
// Подписи осей («XZ» у карты сверху, «Y» у уровнемера).
export const MINIMAP_LABEL_ALPHA = 0.6
// Осевая линия уровнемера (вертикальная полоса «пол — потолок»): тихая, метки поверх.
export const MINIMAP_LEVEL_TRACK_ALPHA = 0.35
// Деления окна полосы (мелкие каждую клетку, крупные каждые N клеток мира) — мимо метки головы они «едут».
export const MINIMAP_LEVEL_TICK_ALPHA = 0.3
export const MINIMAP_LEVEL_TICK_MAJOR_ALPHA = 0.7
// Жёлоб полосы во всю высоту арены: тонкая тихая линия, на ней две точки (я и яблоко).
export const MINIMAP_TROUGH_ALPHA = 0.5
export const MINIMAP_HEAD_ALPHA = 0.9
export const MINIMAP_APPLE_ALPHA = 0.85
// Яблоко вне среза (проекция) и вне окна (стрелка у края) тише «яблока здесь», но заметны.
export const MINIMAP_APPLE_RING_ALPHA = 0.95

// Лучи направления. Яркость (линейная) ниже порога bloom 0.8 с запасом:
// пять лучей вместо одного не должны добавить гало.
export const RAY_MAIN_BRIGHTNESS = 0.48
export const RAY_SIDE_BRIGHTNESS = 0.2
// Подсветка того, во что упрётся основной луч (стенка, препятствие, тело):
// тёплый красно-оранжевый, линейная яркость ~0.35 ниже порога bloom.
export const RAY_DANGER_COLOR = new Color()
// Заливка грани удара сплошная и потому визуально тяжелее прежней рамки: яркость снижена,
// линейная яркость цвета остаётся ниже порога bloom 0.8 (сейчас ~0.16).
export const RAY_HIT_FILL_BRIGHTNESS = 0.5
// Сигналы головы. Четыре состояния, читаются ЦВЕТОМ (не пульсом): обычное — спокойный приглушённый
// светло-жёлтый (ниже порога bloom, не светится: голова различима, но не максимум яркости);
// цель (яблоко на курсе) — яркая, как раньше была голова, светится (розовый цвета яблока);
// опасность за 2 хода — оранжевый; за 1 ход — красный. Опасность перебивает цель.
// Множители подобраны с учётом bloom: он берёт яркость 0.299R+0.587G+0.114B > порога BLOOM_THRESHOLD.
// У чистого красного/розового яркость мала, поэтому им нужен множитель >2 (иначе гало нет), а у оранжевого
// множитель поднимает и зелёный канал и сдвигает оттенок к жёлтому, поэтому берём оранжевый с малым G.
// Было: голова 0xfff27a * 1.4 (яркость ~1.18, самое яркое пятно кадра); стало: * 0.7 (~0.59, без гало).
// Множители HEAD_* и цвета опасности считает applyPalette. У «Ночного неона»: обычная ×0.7, цель ×3.0, опасность-2 ×2.0, опасность-1 ×3.6.
export let HEAD_IDLE_BOOST = 0.7
export const HEAD_GOAL_COLOR = APPLE_COLOR
export let HEAD_GOAL_BOOST = 3.0
export const HEAD_DANGER_COLOR_FAR = new Color()
export const HEAD_DANGER_COLOR_NEAR = new Color()

// Грани препятствий: сплошные, непрозрачные (с записью глубины). Яркость граней
// — доля цвета рёбер (рёбра 1.0, грани 0.3): куб читается объёмом с контуром, а не
// сплошной заливкой. Оттенок по оси нормали (свет фиксирован в мире) даёт форму
// даже там, где соседние грани одного цвета: +y светлее всего, z темнее всего,
// отрицательные стороны ещё на NEG_SHADE тусклее.
export const OBSTACLE_FACE_SHARE = 0.3
export let OBSTACLE_FACE_BRIGHTNESS = OBSTACLE_FACE_SHARE
export const OBSTACLE_FACE_SHADE_X = 0.85
export const OBSTACLE_FACE_SHADE_Y = 1.0
export const OBSTACLE_FACE_SHADE_Z = 0.65
export const OBSTACLE_FACE_NEG_SHADE = 0.8
// Прозрачность грани препятствия, которое мешает обзору (между камерой и головой).
export const OBSTACLE_GHOST_ALPHA = 0.08

// Bloom. Дизайнер трижды просил ослабить гало (грани терялись), потом попросил «неоновее,
// но не сильно». Поэтому неон сделан не силой, а яркостью самих линий (*_BOOST выше) и
// РАДИУСОМ: ореол шире и мягче, а не ярче. Откат к прежнему виду — значения «было».
// Порог 0.75: яркие линии проходят с запасом, сетка/лучи/тусклые полосы (яркость ниже 0.5)
// не светятся. Белые точки подсказки (0.9) чуть выше порога и дают крошечную искру — это ок.
// Было 0.8, стало 0.75.
export const BLOOM_THRESHOLD = 0.75
// Было 0.22, стало 0.26: почти не тронута.
export const BLOOM_STRENGTH = 0.26
// Было 0.2, стало 0.45: главный рычаг — ореол шире и мягче при той же силе.
export const BLOOM_RADIUS = 0.45
// Прочие рычаги (пробовалось, не взято): BLOOM_STRENGTH 0.35+ даёт молоко вокруг головы;
// порог ниже 0.7 заставляет светиться и тусклые полосы тела, и грани препятствий.

// Решётка-подсказка: белые точки, линейная яркость 0.9 (после sRGB ~0.95, белые)
// при пороге bloom 0.75 (было 0.8): гало почти нет, только крошечная искра. Альфа считается в яркость: 1.0 * 0.9.
export const DOT_BASE_COLOR = new Color(1, 1, 1)
export const DOT_BASE_ALPHA = 0.9

// Ближний слой подсказки (углы клеток на две клетки вперёд). Ниже порога bloom.
// Ближняя клетка ярче, дальняя — доля от неё (размер и альфа).
export const NEAR_FORWARD_BRIGHTNESS = 0.9
export const NEAR_SIDE_BRIGHTNESS = 0.72
export const NEAR_BLOCKED_BRIGHTNESS = 0.75
export const NEAR_FAR_SIZE = 0.4
export const NEAR_FAR_ALPHA = 0.38
// Метка за препятствием (по глубине дальше того, что перед ней): доля обычной альфы. Читается «за стеной»,
// а не «на стене»; не мигает, статично. NEAR_DEPTH_BIAS — на сколько клеток метка для теста глубины
// подтянута к камере (полудиагональ клетки ~0.87): собственную клетку/грань метки это не считает преградой.
export const NEAR_OCCLUDED_ALPHA = 0.3
export const NEAR_DEPTH_BIAS = 0.9

// Мини-карта: препятствия тише головы и яблока (фон, а не фигура).
export const MINIMAP_OBSTACLE_COLOR = new Color()
export const MINIMAP_OBSTACLE_ALPHA = 0.4
// Тело змейки на карте: зелёно-голубой градиент как в игре (цвета SNAKE_*), ярче препятствий
// и другого оттенка, но тише головы (жёлтый треугольник, alpha 0.9, поверх всего).
export const MINIMAP_BODY_ALPHA = 0.7

/**
 * Применить набор цветов: перезаписать живые Color и множители на месте. Холодный путь, только между партиями (до createView).
 * Ничего не знает о том, откуда взят набор.
 */
export function applyPalette(set: PaletteSet, glow: GlowTargets): void {
  const b = boostsFor(set, glow)
  BACKGROUND_COLOR.set(set.background)
  FOG_COLOR.set(set.fog)
  MINIMAP_BG_COLOR.set(set.background)
  CUBE_EDGE_COLOR.set(set.edge).multiplyScalar(b.edge)
  MARK_COLOR.set(set.mark)
  SNAKE_BODY_COLOR.set(set.body)
  SNAKE_TAIL_COLOR.set(set.tail)
  SNAKE_HEAD_COLOR.set(set.head)
  SNAKE_BODY_GLOW_BOOST = b.body
  APPLE_COLOR.set(set.apple)
  APPLE_GLOW_BOOST = b.apple
  OBSTACLE_COLOR.set(set.obstacle).multiplyScalar(b.obstacleLine)
  OBSTACLE_FACE_BRIGHTNESS = OBSTACLE_FACE_SHARE / b.obstacleLine
  GRID_COLOR.set(set.grid)
  MINIMAP_BORDER_COLOR.set(set.edge)
  MINIMAP_WALL_COLOR.set(set.wall)
  MINIMAP_OBSTACLE_COLOR.set(set.obstacle)
  RAY_DANGER_COLOR.set(set.rayDanger)
  HEAD_IDLE_BOOST = b.headIdle
  HEAD_GOAL_BOOST = b.headGoal
  HEAD_DANGER_COLOR_FAR.set(set.dangerFar).multiplyScalar(b.dangerFar)
  HEAD_DANGER_COLOR_NEAR.set(set.dangerNear).multiplyScalar(b.dangerNear)
}

/**
 * Применить набор по id из config.palettes. Неизвестный id: запасной DEFAULT_PALETTE_ID.
 * Возвращает id, который применён на самом деле.
 */
export function applyPaletteById(given: PalettesConfig | undefined, id: string | undefined): string {
  const palettes = given ?? (configJson.palettes as PalettesConfig) // конфиг без раздела (тестовый) — наборы из config.json
  const want = id !== undefined && palettes.sets[id] !== undefined ? id : DEFAULT_PALETTE_ID
  const set = palettes.sets[want]
  if (set === undefined) return DEFAULT_PALETTE_ID
  applyPalette(set, palettes.glow)
  return want
}

// Цвета не должны быть пустыми до первой партии (модули вида создают материалы и в тестах).
applyPaletteById(configJson.palettes as PalettesConfig, DEFAULT_PALETTE_ID)
