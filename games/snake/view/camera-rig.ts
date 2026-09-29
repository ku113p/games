// Камера, две фазы. Поза ВСЕГДА выводится из истины ядра каждый кадр
// (viewFrame(s), head(s), фаза из game-mode), а не из числа событий: пропущенное,
// отменённое или удвоенное событие само себя чинит.
//
// plane: ориентация из viewFrame(s); если кадр изменился — переход «текущая
//   ориентация -> цель» (микропауза, затем slerp за config.camera.rollMs).
//   Позиция = центр + depth * distance, смотрит в центр куба.
// free: камера на followDistance позади головы (вдоль -heading = +depth),
//   сдвинута на lateralOffset вправо (frame.right), приподнята на followHeight
//   (frame.up), смотрит в точку на lookAheadDistance впереди головы по ходу и на lookDownOffset ниже линии движения (-up).
//   Позиция, точка взгляда и up берутся прямо из целей; экспоненциальный догон
//   (FOLLOW_SMOOTHING_ENABLED) выключен.
// Привязка к вектору жёсткая: поза считается прямо из viewFrame(s) и клетки
// головы каждый кадр, без догона и инерции. Голова прыгнула на клетку — камера
// прыгнула ровно на столько же, сохранив положение относительно вектора хода.
// Наклон игрока — добавка поверх этой позы (орбита вокруг той же головы), сама
// база из-за него не сдвигается и вектор не теряет.
// Смена фазы (по состоянию, событие modeChanged не нужно): полёт за
//   config.camera.modeSwitchMs из фактически показанной позы в живую целевую
//   позу новой фазы: smootherstep, дуга в сторону (swing), расширение FOV,
//   два запроса глитча (старт и середина). Если фаза сменилась посреди
//   полёта — новый полёт стартует от текущей позы. Кадр без аллокаций.

import { PerspectiveCamera, Vector3, Quaternion, Matrix4, MathUtils } from 'three'
import type { GameState } from '../core/state'
import { viewFrame, cubeSize, head } from '../core/queries'
import type { Config } from '../core/rules'
import { cameraSettings, type CameraSettings } from './camera-config'
import { viewMode, type ViewMode } from './game-mode'

const CAMERA_FOV_DEG = 55
const CAMERA_NEAR = 0.1
const CAMERA_FAR_PADDING = 4 // множитель size, запас за дальней гранью куба
// Кватернионы одной ориентации: |dot| ~ 1. Порог — численный допуск, не баланс.
const SAME_ORIENTATION_DOT = 1 - 1e-6

// Оформительские константы полёта и следования (не числа баланса).
// Сглаживание следования free-камеры за головой. ВЫКЛЮЧЕНО по решению дизайнера:
// поза берётся прямо из состояния (жёсткая привязка к вектору хода). Чтобы вернуть
// инерцию, достаточно поставить FOLLOW_SMOOTHING_ENABLED = true.
const FOLLOW_SMOOTHING_ENABLED = true
const FOLLOW_SMOOTH_MS = 130 // постоянная времени экспоненциального догона (если включено)
const FLIGHT_FOV_KICK_DEG = 22 // на сколько градусов шире FOV в середине полёта
const FLIGHT_SWING_FRAC = 0.35 // боковая дуга полёта, доля размера куба
const FLIGHT_GLITCH_MID = 0.5 // доля полёта, на которой второй глитч

// Наклон от игрока (мышь / два пальца): добавка поверх базовой позы, орбита
// вокруг головы (в plane — вокруг центра куба). Оформительские константы.
const TILT_MAX = 1 // рад, предел по каждой оси (< 90°: камера не переворачивается)
const TILT_FOLLOW_MS = 90 // сглаживание к заданному наклону
const TILT_EPS = 1e-4
const ZOOM_EPS = 1e-4
const ZOOM_FOLLOW_FALLBACK_MS = 120 // если в config.camera нет zoomFollowMs

/**
 * Камера, как её выставил игрок: наклон (рад, ±TILT_MAX), зум — множитель дистанции от головы
 * (1 — ровно тот вид, что настроен в config.camera; < 1 ближе, > 1 дальше). Держится до явного сброса
 * (resetUserCamera), сам не возвращается. Общий объект модуля, а не поле View: пишет main.ts из ввода,
 * читает риг каждый кадр (без аллокаций); риг создаётся заново на каждую партию, а этот объект main сбрасывает
 * на старте партии. Пределы зума (config.camera.zoomMin/zoomMax) зажимает тот, кто пишет.
 */
export const userCamera = { yaw: 0, pitch: 0, zoom: 1 }

export function resetUserCamera(): void {
  userCamera.yaw = 0
  userCamera.pitch = 0
  userCamera.zoom = 1
}

type Phase = 'idle' | 'pause' | 'rolling'

export class CameraRig {
  readonly camera: PerspectiveCamera

  private cameraConfig: Config['camera']
  private settings: CameraSettings
  private aspect = 1
  private size = -1

  private center = new Vector3()
  private offset = new Vector3()
  private basis = new Matrix4()
  private lookM = new Matrix4()
  private tmpRight = new Vector3()
  private tmpUp = new Vector3()
  private tmpDepth = new Vector3()

  private fromQ = new Quaternion()
  private toQ = new Quaternion()
  private curQ = new Quaternion()
  private nextQ = new Quaternion()

  private phase: Phase = 'idle'
  private pauseElapsed = 0
  private rollElapsed = 0
  private glitchRequested = false

  // Фаза, в которой камера "живёт" (или в которую летит).
  private mode: ViewMode = 'plane'
  private flying = false
  private flightElapsed = 0
  private flightMidDone = false
  private flightFromPos = new Vector3()
  private flightFromQ = new Quaternion()
  private flightToPos = new Vector3()
  private flightToQ = new Quaternion()

  // Сглаженное состояние free-камеры и цели.
  private fPos = new Vector3()
  private fAim = new Vector3()
  /** Голова, сглаженная тем же догоном, что и поза. Центр орбиты наклона:
   *  если брать сырую клетку головы, она прыгает мгновенно, а поза отстаёт —
   *  камера вращается вокруг рассинхронизированной точки и теряет вектор. */
  private fHead = new Vector3()
  private headT = new Vector3()
  private fUp = new Vector3(0, 1, 0)
  private posT = new Vector3()
  private aimT = new Vector3()
  private upT = new Vector3()
  private fwdT = new Vector3()
  private tmpV = new Vector3()

  private tiltYaw = 0
  private tiltPitch = 0
  private zoom = 1
  private zoomFollowMs: number
  private zoomMax: number
  private tiltPivot = new Vector3()
  private tiltAxis = new Vector3()
  private tiltQ = new Quaternion()
  private tiltQ2 = new Quaternion()

  /** 0 — плоскость, 1 — полностью free (для fade ближних сегментов). */
  freeAmount = 0

  constructor(config: Config) {
    this.cameraConfig = config.camera
    this.settings = cameraSettings(config)
    const zc = config.camera as { zoomFollowMs?: number; zoomMax?: number }
    this.zoomFollowMs = zc.zoomFollowMs ?? ZOOM_FOLLOW_FALLBACK_MS
    this.zoomMax = Math.max(1, zc.zoomMax ?? 1)
    this.camera = new PerspectiveCamera(CAMERA_FOV_DEG, this.aspect, CAMERA_NEAR, 1000)
  }

  resize(width: number, height: number): void {
    this.aspect = width > 0 && height > 0 ? width / height : 1
    this.camera.aspect = this.aspect
    this.camera.updateProjectionMatrix()
  }

  /** Холодный путь: мгновенно встать в позу состояния, сбросив переходы. */
  syncImmediate(s: GameState): void {
    this.applySize(s)
    this.resetTurn()
    this.mode = viewMode(s)
    this.readTarget(s, this.toQ)
    this.curQ.copy(this.toQ)
    this.fromQ.copy(this.toQ)
    if (this.mode === 'free') {
      this.computeFreeTargets(s)
      this.fPos.copy(this.posT)
      this.fAim.copy(this.aimT)
      this.fUp.copy(this.upT)
      this.freeAmount = 1
      this.placeFree()
    } else {
      this.freeAmount = 0
      this.placePlane()
    }
  }

  /** Холодный путь: сброс анимаций (новая игра). Позу не трогает. */
  resetTurn(): void {
    this.phase = 'idle'
    this.pauseElapsed = 0
    this.rollElapsed = 0
    this.glitchRequested = false
    this.flying = false
    this.flightElapsed = 0
    this.endFlightFov()
  }

  /** true один раз — когда нужно запустить глитч (начало поворота, начало и середина полёта). */
  consumeGlitchRequest(): boolean {
    const value = this.glitchRequested
    this.glitchRequested = false
    return value
  }

  /** Задать наклон камеры (рад, ±1). Держится, пока не сбросят (userCamera). Оставлено для совместимости с View. */
  setTilt(yaw: number, pitch: number): void {
    userCamera.yaw = MathUtils.clamp(yaw, -TILT_MAX, TILT_MAX)
    userCamera.pitch = MathUtils.clamp(pitch, -TILT_MAX, TILT_MAX)
  }

  /** Кадр: без аллокаций. */
  update(dtMs: number, s: GameState): void {
    if (cubeSize(s) !== this.size) this.applySize(s)

    const mode = viewMode(s)
    if (this.flying ? mode !== this.flightTo : mode !== this.mode) {
      this.startFlight(mode)
    }

    if (this.flying) {
      this.updateFlight(dtMs, s)
    } else if (this.mode === 'free') {
      this.updateFree(dtMs, s)
    } else {
      this.updatePlane(dtMs, s)
    }
    this.applyUserCamera(dtMs)
  }

  /**
   * Добавка поверх базовой позы: орбита вокруг pivot осями самой камеры (наклон) и масштаб расстояния
   * от pivot (зум). И то и другое догоняет userCamera экспоненциально, как и поза камеры.
   */
  private applyUserCamera(dtMs: number): void {
    const kTilt = 1 - Math.exp(-dtMs / TILT_FOLLOW_MS)
    this.tiltYaw += (userCamera.yaw - this.tiltYaw) * kTilt
    this.tiltPitch += (userCamera.pitch - this.tiltPitch) * kTilt
    const kZoom = 1 - Math.exp(-dtMs / Math.max(1, this.zoomFollowMs))
    this.zoom += (userCamera.zoom - this.zoom) * kZoom
    const tilted = Math.abs(this.tiltYaw) >= TILT_EPS || Math.abs(this.tiltPitch) >= TILT_EPS
    const zoomed = Math.abs(this.zoom - 1) >= ZOOM_EPS
    if (!tilted && !zoomed) return

    // Центр орбиты берётся из того же сглаженного источника, что и поза камеры.
    this.tiltPivot.copy(this.fHead).lerp(this.center, 1 - this.freeAmount)
    this.tmpV.copy(this.camera.position).sub(this.tiltPivot)
    if (tilted) {
      const cq = this.camera.quaternion
      this.tiltAxis.set(0, 1, 0).applyQuaternion(cq)
      this.tiltQ.setFromAxisAngle(this.tiltAxis, this.tiltYaw)
      this.tiltAxis.set(1, 0, 0).applyQuaternion(cq)
      this.tiltQ2.setFromAxisAngle(this.tiltAxis, this.tiltPitch)
      this.tiltQ.multiply(this.tiltQ2)
      this.tmpV.applyQuaternion(this.tiltQ)
      cq.premultiply(this.tiltQ)
    }
    // Зум множит базовое расстояние (а не заменяет): единица — ровно тот вид, что задан в конфиге.
    if (zoomed) this.tmpV.multiplyScalar(this.zoom)
    this.camera.position.copy(this.tiltPivot).add(this.tmpV)
  }

  // ---- plane ----

  private updatePlane(dtMs: number, s: GameState): void {
    // Истина из ядра.
    this.readTarget(s, this.nextQ)
    if (Math.abs(this.nextQ.dot(this.toQ)) < SAME_ORIENTATION_DOT) {
      this.toQ.copy(this.nextQ)
      this.fromQ.copy(this.curQ)
      this.rollElapsed = 0
      this.pauseElapsed = 0
      if (this.phase === 'rolling') {
        // Уже крутимся — не тормозим микропаузой, продолжаем к новой цели.
        this.beginRolling()
      } else {
        this.phase = 'pause'
      }
    }

    if (this.phase === 'pause') {
      this.pauseElapsed += dtMs
      if (this.pauseElapsed >= this.cameraConfig.microPauseMs) {
        this.rollElapsed = this.pauseElapsed - this.cameraConfig.microPauseMs
        this.beginRolling()
      }
    } else if (this.phase === 'rolling') {
      this.rollElapsed += dtMs
    }

    if (this.phase === 'rolling') {
      const t = Math.min(this.rollElapsed / this.cameraConfig.rollMs, 1)
      if (t >= 1) {
        this.curQ.copy(this.toQ)
        this.phase = 'idle'
      } else {
        this.curQ.slerpQuaternions(this.fromQ, this.toQ, MathUtils.smootherstep(t, 0, 1))
      }
    } else if (this.phase === 'idle') {
      this.curQ.copy(this.toQ)
    }
    this.freeAmount = 0
    this.placePlane()
  }

  private beginRolling(): void {
    if (this.phase !== 'rolling') this.glitchRequested = true
    this.phase = 'rolling'
  }

  private readTarget(s: GameState, out: Quaternion): void {
    const f = viewFrame(s)
    this.tmpRight.set(f.right.x, f.right.y, f.right.z)
    this.tmpUp.set(f.up.x, f.up.y, f.up.z)
    this.tmpDepth.set(f.depth.x, f.depth.y, f.depth.z)
    this.basis.makeBasis(this.tmpRight, this.tmpUp, this.tmpDepth)
    out.setFromRotationMatrix(this.basis)
  }

  private placePlane(): void {
    this.camera.quaternion.copy(this.curQ)
    this.offset.set(0, 0, this.distanceFor(this.size)).applyQuaternion(this.curQ)
    this.camera.position.copy(this.center).add(this.offset)
  }

  // ---- free ----

  /** Цели free-камеры из истины: голова, depth (= -heading) и up кадра. */
  private computeFreeTargets(s: GameState): void {
    const f = viewFrame(s)
    const h = head(s)
    this.fwdT.set(-f.depth.x, -f.depth.y, -f.depth.z)
    this.upT.set(f.up.x, f.up.y, f.up.z)
    this.tmpRight.set(f.right.x, f.right.y, f.right.z)
    // Камера чуть правее оси движения и смотрит в точку далеко впереди на линии
    // змейки: ось взгляда и вектор движения сходятся, стена впереди читается
    // перспективой, а не «внезапно упирается».
    this.posT
      .set(h.x, h.y, h.z)
      .addScaledVector(this.fwdT, -this.settings.followDistance)
      .addScaledVector(this.tmpRight, this.settings.lateralOffset)
      .addScaledVector(this.upT, this.settings.followHeight)
    this.aimT.set(h.x, h.y, h.z).addScaledVector(this.fwdT, this.settings.lookAheadDistance)
      .addScaledVector(this.upT, -this.settings.lookDownOffset)
    this.headT.set(h.x, h.y, h.z)
  }

  private updateFree(dtMs: number, s: GameState): void {
    this.computeFreeTargets(s)
    if (FOLLOW_SMOOTHING_ENABLED) {
      const k = 1 - Math.exp(-dtMs / FOLLOW_SMOOTH_MS)
      this.fPos.lerp(this.posT, k)
      this.fAim.lerp(this.aimT, k)
      this.fUp.lerp(this.upT, k).normalize()
      this.fHead.lerp(this.headT, k)
    } else {
      this.fPos.copy(this.posT)
      this.fAim.copy(this.aimT)
      this.fUp.copy(this.upT)
      this.fHead.copy(this.headT)
    }
    this.freeAmount = 1
    this.placeFree()
  }

  private placeFree(): void {
    this.camera.position.copy(this.fPos)
    this.lookM.lookAt(this.fPos, this.fAim, this.fUp)
    this.camera.quaternion.setFromRotationMatrix(this.lookM)
  }

  // ---- переезд между фазами ----

  private flightTo: ViewMode = 'plane'

  private startFlight(target: ViewMode): void {
    this.flightFromPos.copy(this.camera.position)
    this.flightFromQ.copy(this.camera.quaternion)
    this.flightTo = target
    this.flying = true
    this.flightElapsed = 0
    this.flightMidDone = false
    this.phase = 'idle'
    this.glitchRequested = true
  }

  private updateFlight(dtMs: number, s: GameState): void {
    this.flightElapsed += dtMs
    const t = Math.min(this.flightElapsed / Math.max(1, this.settings.modeSwitchMs), 1)
    const e = MathUtils.smootherstep(t, 0, 1)

    // Живая цель новой фазы: если голова двигается по ходу полёта, камера приходит куда надо.
    if (this.flightTo === 'free') {
      this.computeFreeTargets(s)
      this.fPos.copy(this.posT)
      this.fAim.copy(this.aimT)
      this.fUp.copy(this.upT)
      this.flightToPos.copy(this.posT)
      this.lookM.lookAt(this.posT, this.aimT, this.upT)
      this.flightToQ.setFromRotationMatrix(this.lookM)
      this.freeAmount = e
    } else {
      this.readTarget(s, this.flightToQ)
      this.offset.set(0, 0, this.distanceFor(this.size)).applyQuaternion(this.flightToQ)
      this.flightToPos.copy(this.center).add(this.offset)
      this.freeAmount = 1 - e
    }

    this.camera.position.lerpVectors(this.flightFromPos, this.flightToPos, e)
    // Боковая дуга: полёт не по прямой, а с заходом сбоку — объём читается.
    const swing = Math.sin(Math.PI * t) * this.size * FLIGHT_SWING_FRAC
    this.tmpV.set(1, 0, 0).applyQuaternion(this.flightToQ)
    this.camera.position.addScaledVector(this.tmpV, swing)
    this.camera.quaternion.slerpQuaternions(this.flightFromQ, this.flightToQ, e)

    this.camera.fov = CAMERA_FOV_DEG + FLIGHT_FOV_KICK_DEG * Math.sin(Math.PI * t)
    this.camera.updateProjectionMatrix()

    if (!this.flightMidDone && t >= FLIGHT_GLITCH_MID) {
      this.flightMidDone = true
      this.glitchRequested = true
    }

    if (t >= 1) {
      this.flying = false
      this.mode = this.flightTo
      this.endFlightFov()
      if (this.mode === 'plane') {
        this.toQ.copy(this.flightToQ)
        this.curQ.copy(this.flightToQ)
        this.fromQ.copy(this.flightToQ)
        this.freeAmount = 0
        this.placePlane()
      } else {
        this.freeAmount = 1
        this.placeFree()
      }
    }
  }

  private endFlightFov(): void {
    if (this.camera.fov !== CAMERA_FOV_DEG) {
      this.camera.fov = CAMERA_FOV_DEG
      this.camera.updateProjectionMatrix()
    }
  }

  private applySize(s: GameState): void {
    this.size = cubeSize(s)
    const c = (this.size - 1) / 2
    this.center.set(c, c, c)
    this.camera.far = this.size * CAMERA_FAR_PADDING + this.distanceFor(this.size) * this.zoomMax // зум отодвигает камеру
    this.camera.near = CAMERA_NEAR
    this.camera.updateProjectionMatrix()
  }

  private distanceFor(size: number): number {
    // В портрете (aspect < 1) отодвигаем камеру, чтобы куб не обрезался по
    // горизонтали; distanceFactor — единственное число из конфига.
    return (size * this.cameraConfig.distanceFactor) / Math.min(this.aspect, 1)
  }
}
