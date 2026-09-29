// Лендинг: рисует карточки из games.ts. Холодный путь (один раз при загрузке).
import { GAMES } from './games'

const list = document.getElementById('games')
if (list) {
  for (const game of GAMES) {
    const li = document.createElement('li')
    li.className = 'card'

    const img = document.createElement('img')
    img.className = 'media'
    img.src = game.media
    img.alt = game.mediaAlt
    img.loading = 'lazy'

    const body = document.createElement('div')
    body.className = 'body'
    const h2 = document.createElement('h2')
    h2.textContent = game.title
    const p = document.createElement('p')
    p.textContent = game.blurb
    const a = document.createElement('a')
    a.className = 'play'
    a.href = game.href
    a.textContent = 'Play'

    body.append(h2, p, a)
    li.append(img, body)
    list.append(li)
  }
}
