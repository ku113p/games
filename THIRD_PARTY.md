# Сторонние компоненты

Собственный код репозитория распространяется по лицензии MIT (см. `LICENSE`).
Ниже — то, что взято у других авторов.

## three.js 0.186.1 (MIT)

Сайт: https://threejs.org/ — пакет `three@0.186.1`. Уведомление об авторских правах
и текст лицензии, как в `node_modules/three/LICENSE`:

```text
The MIT License

Copyright © 2010-2026 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## Музыка: Cyber Runner (CC0 1.0)

- Трек: *Cyber Runner Music* (`cyber-runner.mp3`)
- Автор: Luis Zuno («ansimuz»)
- Источник: https://opengameart.org/content/cyber-runner-music
- Лицензия: CC0 1.0 Universal (Public Domain Dedication), https://creativecommons.org/publicdomain/zero/1.0/
- Указание автора лицензией не требуется (по желанию: «Music: Cyber Runner by Luis Zuno (ansimuz) — CC0»).
- Изменения: оригинал `cyber_runner.ogg` (48 кГц, стерео, 98 с) перекодирован для игры
  в моно, 24 кГц, MP3 48 кбит/с (`ffmpeg -ac 1 -ar 24000 -c:a libmp3lame -b:a 48k`);
  содержание не менялось. Подробности: `games/snake/assets/music/LICENSE.txt`.
