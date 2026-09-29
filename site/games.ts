// Список игр лендинга. Новая игра = новый элемент массива + скриншот/гифка в site/img/.
// `href` — относительная ссылка от корня сайта (сборка кладёт игру в dist/<папка>/), поэтому
// работает под любым base path (GitHub Pages /<репозиторий>/, локальный сервер и т.д.).
import snakeGif from './img/snake.gif'

export interface GameEntry {
  readonly title: string
  readonly blurb: string
  readonly href: string
  /** Картинка карточки: гифка геймплея (16:10, как рамка карточки) или статичный кадр. */
  readonly media: string
  readonly mediaAlt: string
}

export const GAMES: readonly GameEntry[] = [
  {
    title: 'Snake 3D',
    blurb: 'Snake in a cube. It starts flat, then the camera moves behind the head and you steer in 3D. Score is apples eaten; there is no win, only a record.',
    href: './snake/',
    media: snakeGif,
    mediaAlt: 'Snake 3D: a flat-looking snake game, then the camera swings behind the snake head and the field turns into a 3D cube',
  },
]
