/// <reference types="vite/client" />
/// <reference types="chrome" />

// crxjs page-script imports: returns the runtime URL of a separately-built script
declare module '*?script&module' {
  const src: string
  export default src
}
declare module '*?script' {
  const src: string
  export default src
}
