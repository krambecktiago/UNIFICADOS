'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

        {/* Logo Krambeck */}
        <div className="bg-white flex items-center justify-center px-8 py-6 border-b-2 border-[#c8102e]">
          <Image
            src="/logo-krambeck.png"
            alt="Krambeck Autopeças e Tintas"
            width={180}
            height={52}
            className="object-contain"
            priority
          />
        </div>

        {/* Badge Rede Ancora */}
        <div className="h-10 flex items-center justify-center gap-2.5 bg-[#09173a]">
          <Image
            src="/logo-ancora.png"
            alt="Rede Ancora"
            width={18}
            height={18}
            className="object-contain"
          />
          <span className="text-[11px] font-semibold tracking-widest uppercase text-slate-500">
            Rede Ancora
          </span>
        </div>

        {/* Formulário */}
        <div className="px-8 py-8">
          <h1 className="text-lg font-bold text-gray-900 mb-0.5">Bem-vindo de volta</h1>
          <p className="text-sm text-gray-400 mb-6">Entre na sua conta para continuar</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0d1e45] text-white py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-[#162b5e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-400">
            Não tem conta?{' '}
            <Link href="/register" className="text-[#0d1e45] hover:underline font-medium">
              Criar conta
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
