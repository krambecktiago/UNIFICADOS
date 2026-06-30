'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

const frases = [
  'Grandes decisões começam com bons dados.',
  'Eficiência é a base de resultados extraordinários.',
  'O controle de hoje constrói o crescimento de amanhã.',
  'Clareza nas informações, confiança nas decisões.',
  'Quem domina os números, domina o negócio.',
  'Excelência operacional começa aqui.',
  'Dados precisos, gestão poderosa.',
]

function Gear({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.3.07-.62.07-.93s-.03-.63-.07-1l2.08-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.58-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1s.03.65.07 1l-2.08 1.63c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66z" />
    </svg>
  )
}

function Wrench({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" />
    </svg>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [frase] = useState(() => frases[Math.floor(Math.random() * frases.length)])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email ou senha inválidos.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09173a] px-4 relative overflow-hidden">

      {/* Fundo decorativo — peças automotivas */}
      <Gear className="absolute -top-16 -left-16 w-72 h-72 text-white opacity-[0.04] rotate-12" />
      <Gear className="absolute -bottom-20 -right-20 w-96 h-96 text-white opacity-[0.05] -rotate-6" />
      <Gear className="absolute top-1/2 -right-10 w-40 h-40 text-white opacity-[0.04] rotate-45" />
      <Gear className="absolute bottom-24 left-10 w-24 h-24 text-white opacity-[0.04] rotate-12" />
      <Wrench className="absolute top-16 right-20 w-28 h-28 text-white opacity-[0.04] rotate-[30deg]" />
      <Wrench className="absolute bottom-12 left-1/3 w-20 h-20 text-white opacity-[0.03] -rotate-[20deg]" />

      <div className="w-full max-w-sm relative z-10">

        {/* Logos */}
        <div className="flex items-center justify-center gap-5 mb-10">
          <Image
            src="/logo-krambeck.png"
            alt="Krambeck Autopeças e Tintas"
            width={148}
            height={40}
            className="object-contain"
            priority
          />
          <div className="w-px h-10 bg-white/20" />
          <Image
            src="/logo-ancora.png"
            alt="Rede Ancora"
            width={40}
            height={40}
            className="object-contain"
          />
        </div>

        {/* Card */}
        <div className="relative">
          <div className="absolute inset-x-4 bottom-0 h-16 bg-[#c8102e]/25 blur-2xl rounded-full translate-y-4" />
        <div className="bg-white rounded-2xl overflow-hidden relative" style={{ boxShadow: '0 8px 16px -4px rgba(0,0,0,0.4), 0 32px 64px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)' }}>
          <div className="h-1 bg-gradient-to-r from-[#c8102e] via-[#0d1e45] to-[#c8102e]" />

          <div className="px-8 py-9">
            <h1 className="text-xl font-bold text-gray-900 mb-1">Acesso ao Painel</h1>
            <p className="text-sm text-gray-400 mb-8 italic">{frase}</p>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0d1e45] focus:border-transparent transition-all"
                  placeholder="seu@email.com"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
                  Senha
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0d1e45] focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0d1e45] text-white py-3 px-4 rounded-xl text-sm font-semibold hover:bg-[#162b5e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          </div>
        </div>
        </div>

        <p className="text-center text-xs text-white/25 mt-6">
          © 2025 Krambeck Autopeças e Tintas
        </p>

      </div>
    </div>
  )
}
