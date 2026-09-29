// Неоновая палитра. Это оформительские константы (не числа баланса игры),
// поэтому по правилам AGENTS.md/CONTRACT.md они не обязаны жить в config.json —
// там только числа, влияющие на баланс/тайминги геймплея.

import { Color } from 'three'

export const BACKGROUND_COLOR = 0x02030a

// Рёбра куба-арены. Множитель умеренный: светятся, но не заливают (bloom-порог 0.8).
export const CUBE_EDGE_COLOR = new Color(0x1fb6ff).multiplyScalar(1.6)
// Толщина ребра в клетках: size * k, в пределах [min, max].
export const CUBE_EDGE_THICKNESS_PER_SIZE = 0.004
export const CUBE_EDGE_THICKNESS_MIN = 0.07
export const CUBE_EDGE_THICKNESS_MAX = 0.2

// Проекция головы на стенки: очень тихая, заметно тусклее рёбер и змейки.
// Яркость (линейный цвет * альфа) ниже порога bloom 0.25.
export const MARK_COLOR = new Color(0xd9b84a)
export const MARK_LINE_ALPHA = 0.12
export const MARK_SQUARE_ALPHA = 0.2

// Читаемость: тело и хвост яркие (сине-зелёный неон, яркость не падает ниже
// уровня яркого сегмента), голова тёплая и ярче тела — не спутать ни с телом,
// ни с яблоком (розовый).
export const SNAKE_BODY_COLOR = new Color(0x3dffa6)
export const SNAKE_TAIL_COLOR = new Color(0x18c8ff)
export const SNAKE_HEAD_COLOR = new Color(0xfff27a)
// Множитель яркости головы (>1 — уходит в bloom и светится).
export const SNAKE_HEAD_BOOST = 1.7
// Чётные/нечётные сегменты чуть различаются по яркости — видно длину и движение.
export const SNAKE_STRIPE_DIM = 0.72

export const APPLE_COLOR = new Color(0xff2d78)
export const APPLE_EMISSIVE_PULSE_MIN = 0.6
export const APPLE_EMISSIVE_PULSE_MAX = 1.35

// Контуры препятствий: тусклый фиолетовый неон, линейная яркость ниже порога bloom.
export const OBSTACLE_COLOR = new Color(0x8f5cff)

// Сетка на стенках: тусклая, ниже порога bloom; каждая 5-я линия ярче.
export const GRID_COLOR = new Color(0x2a8cff)
export const GRID_MINOR_ALPHA = 0.1
export const GRID_MAJOR_ALPHA = 0.3

// Мини-карта: приглушённая подсказка боковым зрением.
export const MINIMAP_BG_COLOR = new Color(0x02030a)
export const MINIMAP_BG_ALPHA = 0.4
export const MINIMAP_BORDER_COLOR = new Color(0x1fb6ff)
export const MINIMAP_BORDER_ALPHA = 0.5
export const MINIMAP_HEAD_ALPHA = 0.9
export const MINIMAP_APPLE_ALPHA = 0.85

// Лучи направления. Яркость (линейная) ниже порога bloom 0.8 с запасом:
// пять лучей вместо одного не должны добавить гало.
export const RAY_MAIN_BRIGHTNESS = 0.48
export const RAY_SIDE_BRIGHTNESS = 0.2
// Подсветка того, во что упрётся основной луч (стенка, препятствие, тело):
// тёплый красно-оранжевый, линейная яркость ~0.35 ниже порога bloom.
export const RAY_DANGER_COLOR = new Color(0xff5a30)
// Заливка грани удара сплошная и потому визуально тяжелее прежней рамки: яркость снижена,
// линейная яркость цвета остаётся ниже порога bloom 0.8 (сейчас ~0.16).
export const RAY_HIT_FILL_BRIGHTNESS = 0.5
// Яблоко под прицелом основного луча: янтарно-золотой вместо розового.
export const APPLE_TARGET_COLOR = new Color(0xffd23a).multiplyScalar(0.7)

// Грани препятствий: сплошные, непрозрачные (с записью глубины). Яркость граней
// — доля цвета рёбер (рёбра 1.0, грани 0.3): куб читается объёмом с контуром, а не
// сплошной заливкой. Оттенок по оси нормали (свет фиксирован в мире) даёт форму
// даже там, где соседние грани одного цвета: +y светлее всего, z темнее всего,
// отрицательные стороны ещё на NEG_SHADE тусклее.
export const OBSTACLE_FACE_BRIGHTNESS = 0.3
export const OBSTACLE_FACE_SHADE_X = 0.85
export const OBSTACLE_FACE_SHADE_Y = 1.0
export const OBSTACLE_FACE_SHADE_Z = 0.65
export const OBSTACLE_FACE_NEG_SHADE = 0.8
// Прозрачность грани препятствия, которое мешает обзору (между камерой и головой).
export const OBSTACLE_GHOST_ALPHA = 0.08

// Bloom: порог поднят до 0.8 вместе с яркостью точек, чтобы белые точки были
// честно белыми (иначе они серые). См. postprocessing.ts, там же сила.
export const BLOOM_THRESHOLD = 0.8
export const BLOOM_STRENGTH = 0.22

// Решётка-подсказка: белые точки, линейная яркость 0.9 (после sRGB ~0.95, белые)
// при пороге bloom 0.8: гало не даёт. Альфа считается в яркость: 1.0 * 0.9.
export const DOT_BASE_COLOR = new Color(1, 1, 1)
export const DOT_BASE_ALPHA = 0.9

// Ближний слой подсказки (углы клеток на две клетки вперёд). Ниже порога bloom.
// Ближняя клетка ярче, дальняя — доля от неё (размер и альфа).
export const NEAR_FORWARD_BRIGHTNESS = 0.9
export const NEAR_SIDE_BRIGHTNESS = 0.72
export const NEAR_BLOCKED_BRIGHTNESS = 0.75
export const NEAR_FAR_SIZE = 0.4
export const NEAR_FAR_ALPHA = 0.38

// Мини-карта: препятствия тише головы и яблока (фон, а не фигура).
export const MINIMAP_OBSTACLE_COLOR = new Color(0x8f5cff)
export const MINIMAP_OBSTACLE_ALPHA = 0.4
// Тело змейки на карте: зелёно-голубой градиент как в игре (цвета SNAKE_*), ярче препятствий
// и другого оттенка, но тише головы (жёлтый треугольник, alpha 0.9, поверх всего).
export const MINIMAP_BODY_ALPHA = 0.7
