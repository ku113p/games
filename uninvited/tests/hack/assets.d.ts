// Bun's bundler turns these imports into URLs. (Duplicate declarations elsewhere in the program merge fine.)
declare module '*.jpg' {
  const url: string
  export default url
}
