// Бандлер Bun отдаёт импорт медиафайла как URL (файл попадает в сборку с учётом base path).
declare module '*.mp3' {
  const url: string
  export default url
}
