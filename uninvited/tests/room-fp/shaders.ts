// GLSL for the first-person room test. Written GLSL1-style; three.js compiles it as GLSL ES 3.0 on WebGL2
// (texture2D -> texture, gl_FragColor -> output), so textureLod and dFdx are available.
//
// Coordinates used everywhere:
//   screen s : 0..1, y from the TOP
//   image  p : 0..1 over the picture, y from the TOP
//   p = view.xy + (s - 0.5) * fit / view.z    (fit = cover-fit scale, view.z = zoom)

const COMMON = /* glsl */ `
  float hash1(float n) { return fract(sin(n) * 43758.5453123); }
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  vec2 screenToImage(vec2 s, vec3 view, vec2 fit) { return view.xy + (s - 0.5) * fit / view.z; }
  vec2 imageToScreen(vec2 p, vec3 view, vec2 fit) { return (p - view.xy) * view.z / fit + 0.5; }
  vec2 tc(vec2 p) { return vec2(p.x, 1.0 - p.y); }
`

export const QUAD_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

// ------------------------------------------------------------------------------------------------ world pass
// One full-screen quad: the room plate (parallax, depth of field, rain, screens, lamp, hover glow)
// or a flat image (close-up / network) with a Ken Burns view.
export const WORLD_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D tPlate;
  uniform sampler2D tDepth;
  uniform sampler2D tImage;
  uniform vec2 uPlateFit;
  uniform vec3 uPlateView;
  uniform vec2 uImageFit;
  uniform vec3 uImageView;
  uniform float uImageMix;
  uniform vec2 uLook;
  uniform float uPivot;
  uniform float uDepthClamp;
  uniform float uFocus;
  uniform float uAperture;
  uniform float uBlurGain;
  uniform float uDeadZone;
  uniform float uMaxLod;
  uniform vec2 uTexel;
  uniform float uTime;
  uniform vec4 uWindow;
  uniform vec4 uScreens[4];
  uniform vec3 uLamp;
  uniform float uLampLevel;
  uniform vec4 uRain;
  uniform float uNeonForce;
  uniform vec4 uNeon;           // x flicker depth, y mask blur lod, z/w mask brightness range
  uniform vec4 uScreenFx;
  uniform sampler2D tMaskA;     // R window glass, G tablet, B water bottle
  uniform sampler2D tMaskB;     // R noodles, G VR headset
  uniform vec3 uSelA;           // which mask channel is hovered (one-hot over A then B)
  uniform vec3 uSelB;
  uniform vec4 uHoverRect;
  uniform float uHover;
  uniform float uHoverGain;
  uniform vec3 uHoverColor;
  uniform float uRimPx;
  uniform vec3 uHoverFx;        // x lift, y rim, z dim of everything else
  uniform vec4 uEdge;           // parallax: x near cap, y edge fade width, z strength at the frame edge
  uniform vec3 uRainMask;       // x feather lod, y/z smoothstep range
  uniform float uDropAmount;
  varying vec2 vUv;
  ${COMMON}

  #define S(a, b, t) smoothstep(a, b, t)

  bool inRect(vec2 p, vec4 r) { return p.x > r.x && p.x < r.z && p.y > r.y && p.y < r.w; }
  float depthAt(vec2 p) { return texture2D(tDepth, tc(p)).r; }

  // --- rain on glass: a trimmed version of the well-known "Heartfelt" drop layers (sliding drops with trails + static beads)
  vec3 N13(float p) {
    vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.11369, 0.13787));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract(vec3((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y, (p3.y + p3.z) * p3.x));
  }
  float N(float t) { return fract(sin(t * 12345.564) * 7658.76); }
  float Saw(float b, float t) { return S(0.0, b, t) * S(1.0, b, t); }
  vec2 dropLayer(vec2 uv, float t) {
    vec2 UV = uv;
    uv.y += t * 0.75;
    vec2 a = vec2(6.0, 1.0);
    vec2 grid = a * 2.0;
    vec2 id = floor(uv * grid);
    uv.y += N(id.x);
    id = floor(uv * grid);
    vec3 n = N13(id.x * 35.2 + id.y * 2376.1);
    vec2 st = fract(uv * grid) - vec2(0.5, 0.0);
    float x = n.x - 0.5;
    float y = UV.y * 20.0;
    x += sin(y + sin(y)) * (0.5 - abs(x)) * (n.z - 0.5);
    x *= 0.7;
    float ti = fract(t + n.z);
    y = (Saw(0.85, ti) - 0.5) * 0.9 + 0.5;
    float d = length((st - vec2(x, y)) * a.yx);
    float mainDrop = S(0.4, 0.0, d);
    float r = sqrt(S(1.0, y, st.y));
    float cd = abs(st.x - x);
    float trail = S(0.23 * r, 0.15 * r * r, cd);
    float trailFront = S(-0.02, 0.02, st.y - y);
    trail *= trailFront * r * r;
    float yy = fract(UV.y * 10.0) + (st.y - 0.5);
    float droplets = S(0.3, 0.0, length(st - vec2(x, yy)));
    return vec2(mainDrop + droplets * r * trailFront, trail);
  }
  float staticDrops(vec2 uv, float t) {
    uv *= 40.0;
    vec2 id = floor(uv);
    uv = fract(uv) - 0.5;
    vec3 n = N13(id.x * 107.45 + id.y * 3543.654);
    vec2 p = (n.xy - 0.5) * 0.7;
    float fade = Saw(0.025, fract(t + n.z));
    return S(0.3, 0.0, length(uv - p)) * fract(n.z * 10.0) * fade;
  }
  vec2 drops(vec2 uv, float t) {
    float s = staticDrops(uv, t);
    vec2 m1 = dropLayer(uv, t);
    vec2 m2 = dropLayer(uv * 1.85, t);
    float c = S(0.3, 1.0, s + m1.x + m2.x);
    return vec2(c, max(m1.y, m2.y));
  }

  vec3 blurTap(vec2 t, float lod) {
    if (lod < 0.05) return textureLod(tPlate, t, 0.0).rgb;
    float r = exp2(lod) * 0.55;
    vec2 o1 = vec2(r, r * 0.4) * uTexel;
    vec2 o2 = vec2(-r * 0.4, r) * uTexel;
    return (textureLod(tPlate, t + o1, lod).rgb + textureLod(tPlate, t - o1, lod).rgb +
            textureLod(tPlate, t + o2, lod).rgb + textureLod(tPlate, t - o2, lod).rgb) * 0.25;
  }

  float propMask(vec2 p) {
    vec2 t = tc(p);
    return dot(textureLod(tMaskA, t, 0.0).rgb, uSelA) + dot(textureLod(tMaskB, t, 0.0).rgb, uSelB);
  }

  vec3 room(vec2 s) {
    vec2 ip = screenToImage(s, uPlateView, uPlateFit);
    // depth parallax: find the source point q with q + look * (depth(q) - pivot) = ip (3 fixed-point steps).
    // Very near depths are capped and the strength fades toward the frame edges, so foreground at the border does not stretch.
    float edgeDist = min(min(s.x, 1.0 - s.x), min(s.y, 1.0 - s.y));
    vec2 lk = uLook * mix(uEdge.z, 1.0, S(0.0, uEdge.y, edgeDist));
    vec2 q = ip;
    float rd = 0.0;
    for (int i = 0; i < 3; i++) {
      rd = depthAt(q);
      q = ip - lk * (min(min(rd, uDepthClamp) / uDepthClamp, uEdge.x) - uPivot);
    }
    q = clamp(q, vec2(0.001), vec2(0.999));
    rd = depthAt(q);

    // depth of field
    float coc = clamp((abs(rd - uFocus) - uDeadZone) * uBlurGain, 0.0, 1.0) * uAperture;
    float lod = coc * uMaxLod;
    vec2 t = tc(q);

    // rain on the window glass only (the glass mask, feathered inward: not on the plant or the monitor in front)
    float glass = 0.0;
    float dropMask = 0.0;
    if (inRect(q, uWindow)) {
      glass = S(uRainMask.y, uRainMask.z, textureLod(tMaskA, t, uRainMask.x).r);
      if (glass > 0.01) {
        vec2 ruv = vec2(q.x * 1.7778, 1.0 - q.y) * uRain.x;
        float rt = uTime * uRain.y;
        vec2 c = drops(ruv, rt);
        // normal from finite differences (smooth; dFdx would show the 2x2 pixel quads)
        float e = 1.5 * uTexel.y * uRain.x;
        vec2 n = vec2(drops(ruv + vec2(e, 0.0), rt).x - c.x, -(drops(ruv + vec2(0.0, e), rt).x - c.x));
        float k = glass * uDropAmount;
        t += n * uRain.z * uTexel * k;
        float clear = max(S(0.1, 0.2, c.x), c.y * 0.8) * k;
        lod = mix(lod, mix(max(lod, uRain.w), lod * 0.3, clear), glass);
        dropMask = c.x * k;
      }
    }

    vec3 col = blurTap(t, lod);

    if (glass > 0.01) {
      // neon signs live BEHIND the glass. The mask comes from a heavily blurred sample around the refracted coordinate,
      // so a whole sign (white-hot core + coloured rim + glow) is one soft blob that dims and brightens evenly;
      // the flicker band also follows the refracted coordinate and has soft edges. Drop highlights go on afterwards.
      vec2 qr = vec2(t.x, 1.0 - t.y);
      vec3 hb = textureLod(tPlate, t, uNeon.y).rgb;
      float hbMax = max(hb.r, max(hb.g, hb.b));
      float hbSat = hbMax - min(hb.r, min(hb.g, hb.b));
      float neonMask = S(uNeon.z, uNeon.w, hbMax) * S(0.04, 0.16, hbSat);
      float f = qr.x * 9.0 + qr.y * 4.0;
      float band = floor(f);
      float soft = S(0.0, 0.3, fract(f)) * S(1.0, 0.7, fract(f));
      float event = step(0.93, hash1(band * 7.13 + floor(uTime * 2.5)));
      float stutter = step(0.45, hash1(band + floor(uTime * 26.0)));
      float buzz = 0.96 + 0.04 * sin(uTime * 100.0 + band);
      float on = max(event * stutter, uNeonForce);  // uNeonForce: test hook, every sign mid-flicker
      col *= mix(1.0, buzz * (1.0 - on * soft * uNeon.x), neonMask * glass);
      col += dropMask * vec3(0.05, 0.05, 0.07);
    }

    // the four screens: scanlines, a scrolling glow line, flicker; only on the glowing pixels
    for (int i = 0; i < 4; i++) {
      vec4 r = uScreens[i];
      if (inRect(q, r)) {
        vec2 l = (q - r.xy) / (r.zw - r.xy);
        float fi = float(i);
        float lum = dot(col, vec3(0.2, 0.55, 0.25));
        float glow = S(0.12, 0.4, lum) * S(-0.05, 0.1, col.b - col.r);
        float scan = 1.0 - uScreenFx.x + uScreenFx.x * sin(q.y * 768.0 * 2.0944);
        float lineY = fract(uTime * uScreenFx.w + fi * 0.31);
        float lineGlow = exp(-pow((l.y - lineY) * 18.0, 2.0)) * uScreenFx.y;
        float flick = 1.0 + uScreenFx.z * sin(uTime * 57.0 + fi * 2.1)
                    - 0.12 * step(0.985, hash1(floor(uTime * 20.0) + fi * 13.0));
        col = mix(col, col * scan * flick + col * lineGlow * vec3(0.7, 1.0, 1.1), glow);
      }
    }

    // the desk lamp: warm pixels around it follow the lamp level (occasional flicker)
    float ld = length((q - uLamp.xy) * vec2(1.7778, 1.0));
    float warm = clamp((col.r - col.b) * 2.5, 0.0, 1.0);
    col *= mix(1.0, uLampLevel, exp(-ld * uLamp.z) * warm);

    // hover: glow inside the prop's mask, a rim from the mask's edge; everything else dims a little
    if (uHover > 0.002) {
      float mask = 0.0;
      vec4 hr = uHoverRect;
      vec2 pad = uRimPx * 2.0 * uTexel;
      if (q.x > hr.x - pad.x && q.x < hr.z + pad.x && q.y > hr.y - pad.y && q.y < hr.w + pad.y) {
        mask = propMask(q);
        vec2 o = uRimPx * uTexel;
        float avg = (propMask(q + vec2(o.x, 0.0)) + propMask(q - vec2(o.x, 0.0)) +
                     propMask(q + vec2(0.0, o.y)) + propMask(q - vec2(0.0, o.y)) +
                     propMask(q + o * 0.7) + propMask(q - o * 0.7) +
                     propMask(q + vec2(o.x, -o.y) * 0.7) + propMask(q - vec2(o.x, -o.y) * 0.7)) / 8.0;
        float rim = clamp(abs(avg - mask) * 2.5, 0.0, 1.0);
        float pulse = 0.8 + 0.2 * sin(uTime * 4.0);
        col += uHover * uHoverGain * (mask * (col * uHoverFx.x + uHoverColor * 0.04) + rim * uHoverColor * uHoverFx.y * pulse);
      }
      col *= 1.0 - uHover * uHoverFx.z * (1.0 - mask);
    }
    return col;
  }

  vec3 image(vec2 s) {
    vec2 pu = screenToImage(s, uImageView, uImageFit);
    vec2 p = clamp(pu, vec2(0.001), vec2(0.999));
    // outside the picture is black with a soft edge (the VR close-up starts smaller than the frame)
    vec2 e = S(vec2(-0.012), vec2(0.004), pu) * S(vec2(1.012), vec2(0.996), pu);
    return texture2D(tImage, tc(p)).rgb * e.x * e.y;
  }

  void main() {
    vec2 s = vec2(vUv.x, 1.0 - vUv.y);
    vec3 col;
    if (uImageMix <= 0.0) col = room(s);
    else if (uImageMix >= 1.0) col = image(s);
    else col = mix(room(s), image(s), uImageMix);
    gl_FragColor = vec4(col, 1.0);
  }
`

// ------------------------------------------------------------------------------------------------ dust
// Motes in the lamp light. Fully animated on the GPU from a per-particle seed: no per-frame CPU work.
export const DUST_VERT = /* glsl */ `
  attribute vec4 aSeed;
  uniform vec2 uPlateFit;
  uniform vec3 uPlateView;
  uniform vec2 uLook;
  uniform float uPivot;
  uniform float uTime;
  uniform vec4 uArea;
  uniform vec2 uSize;
  uniform float uSpeed;
  uniform float uFocus;
  uniform float uAperture;
  uniform float uBlurGain;
  uniform vec3 uLamp;
  uniform float uLampLevel;
  uniform float uPxScale;
  uniform float uDepthClamp;
  varying float vAlpha;
  varying float vSoft;
  ${COMMON}
  void main() {
    vec2 a0 = uArea.xy;
    vec2 a1 = uArea.zw;
    vec2 span = a1 - a0;
    float t = uTime;
    // slow drift + gentle swirl, wrapped inside the area
    vec2 p = aSeed.xy + vec2(sin(t * 0.21 + aSeed.z * 6.28) * 0.012 + t * uSpeed * (aSeed.w - 0.5),
                             t * uSpeed * (0.3 + aSeed.z) + cos(t * 0.17 + aSeed.w * 6.28) * 0.01);
    p = a0 + fract(p) * span;
    float depthN = 0.55 + aSeed.w * 0.35;           // motes float between the screens and the viewer
    float depthRaw = depthN * uDepthClamp;
    vec2 ip = p + uLook * (depthN - uPivot);
    vec2 s = imageToScreen(ip, uPlateView, uPlateFit);
    gl_Position = vec4(s.x * 2.0 - 1.0, 1.0 - s.y * 2.0, 0.0, 1.0);
    // lit by the lamp: a cone pointing down from the bulb
    vec2 d = (p - uLamp.xy) * vec2(1.7778, 1.0);
    float len = length(d) + 1e-4;
    float cone = smoothstep(-0.3, 0.5, d.y / len);   // y grows downward: light falls below the bulb
    float light = exp(-len * 3.5) * cone * uLampLevel;
    float coc = clamp(abs(depthRaw - uFocus) * uBlurGain, 0.0, 1.0) * uAperture;
    float size = mix(uSize.x, uSize.y, aSeed.z) * (1.0 + coc * 2.5) * uPxScale * uPlateView.z;
    gl_PointSize = size;
    float tw = 0.6 + 0.4 * sin(t * (1.0 + aSeed.z * 2.0) + aSeed.x * 30.0);
    vAlpha = light * tw / (1.0 + coc * 3.0);
    vSoft = coc;
  }
`

export const DUST_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  uniform float uBrightness;
  varying float vAlpha;
  varying float vSoft;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float a = 1.0 - smoothstep(0.2 + vSoft * 0.3, 1.0, r);
    gl_FragColor = vec4(uColor * a * vAlpha * uBrightness, 1.0);
  }
`

// ------------------------------------------------------------------------------------------------ steam
// Rising steam over the noodle cup in the close-up; lives in close-up image space so it follows the Ken Burns view.
export const STEAM_VERT = /* glsl */ `
  attribute vec4 aSeed;
  uniform vec2 uImageFit;
  uniform vec3 uImageView;
  uniform float uTime;
  uniform vec2 uOrigin;
  uniform float uSpread;
  uniform float uRise;
  uniform float uLife;
  uniform vec2 uSize;
  uniform float uPxScale;
  varying float vAlpha;
  varying float vSeed;
  ${COMMON}
  void main() {
    float life = fract(uTime / (uLife * (0.8 + aSeed.z * 0.4)) + aSeed.x);
    vec2 p = uOrigin;
    p.x += (aSeed.y - 0.5) * uSpread * (1.0 + life * 1.5);
    p.x += sin(uTime * 1.1 + aSeed.w * 6.28 + life * 4.0) * 0.025 * life;
    p.y -= life * uRise;
    vec2 s = imageToScreen(p, uImageView, uImageFit);
    gl_Position = vec4(s.x * 2.0 - 1.0, 1.0 - s.y * 2.0, 0.0, 1.0);
    gl_PointSize = mix(uSize.x, uSize.y, life) * uPxScale * uImageView.z;
    vAlpha = smoothstep(0.0, 0.15, life) * (1.0 - smoothstep(0.45, 1.0, life));
    vSeed = aSeed.w;
  }
`

export const STEAM_FRAG = /* glsl */ `
  precision highp float;
  uniform float uOpacity;
  uniform float uTime;
  varying float vAlpha;
  varying float vSeed;
  ${COMMON}
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    // wispy: a soft blob with a slowly turning wobble
    float ang = atan(c.y, c.x);
    float wob = 0.85 + 0.15 * sin(ang * 3.0 + vSeed * 20.0 + uTime * 0.7);
    float r = length(c) * 2.0 / wob;
    float a = (1.0 - smoothstep(0.0, 1.0, r));
    a *= a;
    gl_FragColor = vec4(vec3(0.92, 0.9, 0.88), a * vAlpha * uOpacity);
  }
`

// ------------------------------------------------------------------------------------------------ post
// Zoom blur (push-ins), glitch (block displacement, RGB split, scanline tear), edge chromatic aberration,
// vignette, film grain, black fade and white flash. One full-screen pass to the canvas.
export const POST_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D tScene;
  uniform vec2 uRes;
  uniform float uTime;
  uniform float uGlitch;
  uniform float uFlash;
  uniform float uFade;
  uniform float uZoomBlur;
  uniform vec2 uZoomCenter;     // screen uv of the prop we push toward
  uniform float uAberration;
  uniform float uVignette;
  uniform float uGrain;
  varying vec2 vUv;
  ${COMMON}

  vec3 splitTap(vec2 uv, vec2 off) {
    return vec3(texture2D(tScene, uv + off).r, texture2D(tScene, uv).g, texture2D(tScene, uv - off).b);
  }

  void main() {
    vec2 uv = vUv;
    float g = uGlitch;
    float tq = floor(uTime * 22.0);
    float tear = 0.0;
    if (g > 0.001) {
      // row slices shift sideways
      float rows = mix(12.0, 48.0, hash1(tq * 1.7));
      float row = floor(uv.y * rows);
      float hr = hash1(row * 3.1 + tq * 13.7);
      float shift = step(1.0 - g * 0.55, hr) * (hash1(row + tq) - 0.5) * 0.22 * g;
      // rectangular blocks jump
      vec2 blk = floor(uv * vec2(7.0, 16.0) + hash1(tq) * 5.0);
      float hb = hash2(blk + tq * 0.37);
      vec2 jump = step(1.0 - g * 0.3, hb) * (vec2(hash2(blk * 1.7 + tq), hash2(blk * 2.3 - tq)) - 0.5) * vec2(0.14, 0.04);
      // a scanline tear rolling up the screen
      float tearY = fract(uTime * 0.9 + hash1(tq) * 0.15);
      tear = (1.0 - smoothstep(0.0, 0.035, abs(uv.y - tearY))) * g;
      shift += tear * 0.06 * sin(uv.y * 600.0 + uTime * 80.0);
      uv += vec2(shift, 0.0) + jump * g;
    }

    vec2 dc = uv - 0.5;
    float edge = smoothstep(0.15, 0.75, length(dc * vec2(1.0, 0.75)));
    vec2 ca = dc * uAberration * edge + vec2(g * 0.018 * (0.5 + hash1(tq + 3.0)), 0.0);
    vec3 col;
    if (uZoomBlur > 0.001) {
      col = vec3(0.0);
      for (int i = 0; i < 8; i++) {
        float k = 1.0 - float(i) * uZoomBlur / 8.0;
        col += splitTap(uZoomCenter + (uv - uZoomCenter) * k, ca);
      }
      col /= 8.0;
    } else {
      col = splitTap(uv, ca);
    }

    if (g > 0.001) {
      // glitch colour: dark scanlines, a few inverted / quantized blocks, tear brightening
      col *= 1.0 - g * 0.3 * step(0.5, fract(gl_FragCoord.y * 0.5));
      vec2 blk = floor(vUv * vec2(10.0, 22.0));
      float inv = step(1.0 - g * 0.08, hash2(blk + tq * 1.31));
      col = mix(col, floor(col * 4.0) / 4.0 + vec3(0.0, 0.25, 0.3), inv);
      col += tear * vec3(0.15, 0.35, 0.4);
    }

    // vignette, grain
    col *= 1.0 - uVignette * smoothstep(0.3, 0.95, length(dc * vec2(1.25, 1.0)));
    col += (hash2(gl_FragCoord.xy * 0.731 + fract(uTime * 7.13) * 91.0) - 0.5) * uGrain;
    col = mix(col, vec3(0.0), uFade);
    col = mix(col, vec3(1.0), uFlash);
    gl_FragColor = vec4(col, 1.0);
  }
`
