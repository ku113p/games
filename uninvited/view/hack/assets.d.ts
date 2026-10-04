// Bun's bundler turns these imports into URLs. (Duplicate declarations elsewhere in the program merge fine.)
declare module '*.mp3' {
  const url: string
  export default url
}
