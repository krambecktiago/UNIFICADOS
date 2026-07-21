import type { NextConfig } from 'next'

process.env.NEXT_TELEMETRY_DISABLED = '1'

const nextConfig: NextConfig = {
  // pdf-parse (via pdfjs-dist) usa o pacote nativo @napi-rs/canvas pra
  // polyfills (DOMMatrix etc.) — deixar externo garante que o binário
  // certo da plataforma seja resolvido em runtime, em vez de o bundler
  // tentar empacotar (e falhar em excluir) esses módulos nativos.
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist', '@napi-rs/canvas'],
  // O rastreamento de arquivos da Vercel não segue o require dinâmico do
  // @napi-rs/canvas pro binário da plataforma (ex: canvas-linux-x64-gnu),
  // então ele fica de fora da função serverless por padrão — força a
  // inclusão aqui, senão dá "DOMMatrix is not defined" em runtime.
  outputFileTracingIncludes: {
    '/api/ferramentas/seguro-vida/**': [
      './node_modules/@napi-rs/canvas/**',
      // Vercel roda em Amazon Linux (glibc) x64 — só esse binário é
      // necessário; os outros (darwin, android, musl...) só inflariam
      // o tamanho da função sem servir pra nada em produção.
      './node_modules/@napi-rs/canvas-linux-x64-gnu/**',
      // pdfjs-dist carrega o worker (pdf.worker.mjs) e outros arquivos do
      // build "legacy" via caminho dinâmico — o rastreamento automático não
      // segue esse require, então precisa do pacote inteiro aqui também.
      './node_modules/pdfjs-dist/**',
    ],
  },
}

export default nextConfig
