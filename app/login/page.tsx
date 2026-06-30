'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const frases = [
    'Grandes decisões começam com bons dados.',
    'Eficiência é a base de resultados extraordinários.',
    'O controle de hoje constrói o crescimento de amanhã.',
    'Clareza nas informações, confiança nas decisões.',
    'Quem domina os números, domina o negócio.',
    'Excelência operacional começa aqui.',
    'Dados precisos, gestão poderosa.',
  ]

  const frase = frases[Math.floor(Math.random() * frases.length)]

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
    <div className="min-h-screen flex items-center justify-center bg-[#09173a] px-4">
      <div className="w-full max-w-sm">

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
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
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

        <p className="text-center text-xs text-white/25 mt-6">
          © 2025 Krambeck Autopeças e Tintas
        </p>

      </div>
    </div>
  )
}
