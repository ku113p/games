// List of landing-page games. A new game = a new array element + a screenshot/gif in site/img/.
// `href` is a relative link from the site root (the build puts the game in dist/<folder>/), so it
// works under any base path (GitHub Pages /<repository>/, a local server, etc.).
import snakeGif from './img/snake.gif'

export interface GameEntry {
  readonly title: string
  readonly blurb: string
  readonly href: string
  /** Card image: a gameplay gif (16:10, like the card frame) or a still frame. */
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
