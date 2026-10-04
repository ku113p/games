// Bun's bundler turns these imports into URLs. (*.jpg is declared by tests/engine-room/assets.d.ts in the same program.)
declare module '*.png' {
  const url: string
  export default url
}
declare module '*.mp3' {
  const url: string
  export default url
}
