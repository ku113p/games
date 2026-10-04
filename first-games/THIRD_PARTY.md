# Third-party components

The repository's own code is distributed under the MIT license (see `LICENSE`).
Below is what was taken from other authors.

## three.js 0.186.1 (MIT)

Website: https://threejs.org/ - package `three@0.186.1`. Copyright notice
and license text, as in `node_modules/three/LICENSE`:

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

## Music: Cyber Runner (CC0 1.0)

- Track: *Cyber Runner Music* (`cyber-runner.mp3`)
- Author: Luis Zuno («ansimuz»)
- Source: https://opengameart.org/content/cyber-runner-music
- License: CC0 1.0 Universal (Public Domain Dedication), https://creativecommons.org/publicdomain/zero/1.0/
- Attribution is not required by the license (optional: "Music: Cyber Runner by Luis Zuno (ansimuz) — CC0").
- Changes: the original `cyber_runner.ogg` (48 kHz, stereo, 98 s) was re-encoded for the game
  to mono, 24 kHz, MP3 48 kbit/s (`ffmpeg -ac 1 -ar 24000 -c:a libmp3lame -b:a 48k`);
  the content was not changed. Details: `games/snake/assets/music/LICENSE.txt`.
