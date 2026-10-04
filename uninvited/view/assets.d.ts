// Bun's bundler turns these imports into URLs. (Other folders declare the same patterns; duplicates are fine.)
declare module '*.mp3' {
  const url: string
  export default url
}
