// Окно мини-карты по одной оси: чистая арифметика без Three.js.
// Окно (windowCells клеток) следует за головой, но упирается в границы арены:
// у стены стоит, метка ходит внутри окна; в середине большой арены метка в центре,
// «мир» проезжает под ней. Шаг дискретный: окно сдвигается на целую клетку вместе с ходом.

/** Длина окна по оси: арена меньше окна — окно равно всей арене. */
export function windowLength(size: number, windowCells: number): number {
  return Math.min(size, windowCells)
}

/** Начало окна по оси = clamp(голова − половина окна, 0, размер − окно). */
export function windowStart(head: number, size: number, windowCells: number): number {
  const max = Math.max(0, size - windowCells)
  const start = head - Math.floor(windowCells / 2)
  return start < 0 ? 0 : start > max ? max : start
}

/** Клетка v в координатах окна (может выйти за 0..len-1, если v вне окна). */
export function inWindow(v: number, start: number): number {
  return v - start
}

/** Клетка v внутри окна [start, start+len)? */
export function isInWindow(v: number, start: number, len: number): boolean {
  return v >= start && v < start + len
}

/** Клетка v в координатах окна, прижатая к его краю (метка «куда идти»). */
export function clampToWindow(v: number, start: number, len: number): number {
  const i = v - start
  return i < 0 ? 0 : i > len - 1 ? len - 1 : i
}

/** Нижний край окна лежит на настоящей стене арены. */
export function touchesLowWall(start: number): boolean {
  return start <= 0
}

/** Верхний край окна лежит на настоящей стене арены. */
export function touchesHighWall(start: number, len: number, size: number): boolean {
  return start + len >= size
}
