import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Ferramentas Unificadas Krambeck',
  description: 'Plataforma de ferramentas de produtividade',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  )
}
