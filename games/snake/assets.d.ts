// Bun's bundler returns a media file import as a URL (the file goes into the build, respecting the base path).
declare module '*.mp3' {
  const url: string
  export default url
}
