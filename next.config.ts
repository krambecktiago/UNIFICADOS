import type { NextConfig } from 'next'

process.env.NEXT_TELEMETRY_DISABLED = '1'

const nextConfig: NextConfig = {
  // pdf-parse (via pdfjs-dist) usa o pacote nativo @napi-rs/canvas pra
  // polyfills (DOMMatrix etc.) — deixar externo garante que o binário
  // certo da plataforma seja resolvido em runtime, em vez de o bundler
  // tentar empacotar (e falhar em excluir) esses módulos nativos.
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist', '@napi-rs/canvas'],
}

export default nextConfig
