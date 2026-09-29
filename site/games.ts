// Список игр лендинга. Новая игра = новый элемент массива + скриншот/гифка в site/img/.
// `href` — относительная ссылка от корня сайта (сборка кладёт игру в dist/<папка>/), поэтому
// работает под любым base path (GitHub Pages /<репозиторий>/, локальный сервер и т.д.).
import snakeShot from './img/snake.png'

export interface GameEntry {
  readonly title: string
  readonly blurb: string
  readonly href: string
  /** Картинка карточки. TODO(дизайнер): заменить на гифку геймплея (path к .gif подойдёт как есть). */
  readonly media: string
  readonly mediaAlt: string
}

export const GAMES: readonly GameEntry[] = [
  {
    title: 'Snake 3D',
    blurb: 'Looks like classic snake. Then the third axis opens up and the camera turns with you.',
    href: './snake/',
    // TODO(дизайнер): сейчас тут статичный скриншот, а не гифка. Снять гифку и заменить import выше.
    media: snakeShot,
    mediaAlt: 'Snake 3D gameplay screenshot',
  },
]
