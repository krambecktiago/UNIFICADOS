'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Gear, Wrench } from '@/components/decorative-icons'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
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

        {/* Card único com header escuro + formulário branco */}
        <div className="relative">
          <div className="absolute inset-x-4 bottom-0 h-16 bg-[#c8102e]/25 blur-2xl rounded-full translate-y-4" />
          <div
            className="rounded-2xl overflow-hidden relative"
            style={{ boxShadow: '0 8px 16px -4px rgba(0,0,0,0.5), 0 32px 64px -12px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.12)' }}
          >

            {/* Cabeçalho escuro com logos */}
            <div className="bg-[#060f26] px-8 py-8 flex items-center justify-center gap-5">
              <Image
                src="/logo-krambeck.png"
                alt="Krambeck Autopeças e Tintas"
                width={148}
                height={40}
                className="object-contain"
                unoptimized
                priority
              />
              <div className="w-px h-10 bg-white/20" />
              <Image
                src="/logo-ancora.png"
                alt="Rede Ancora"
                width={40}
                height={40}
                className="object-contain"
                unoptimized
              />
            </div>

            {/* Separador vermelho */}
            <div className="h-1 bg-gradient-to-r from-[#c8102e] via-[#ff3355] to-[#c8102e]" />

            {/* Formulário branco */}
            <div className="bg-white px-8 py-9">
              {success ? (
                <div className="text-center py-2">
                  <h1 className="text-xl font-bold text-gray-900 mb-2">Confirme seu email</h1>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Enviamos um link de confirmação para <strong>{email}</strong>. Verifique sua caixa de entrada.
                  </p>
                  <Link
                    href="/login"
                    className="mt-6 inline-block w-full bg-[#0d1e45] text-white py-3 px-4 rounded-xl text-sm font-semibold hover:bg-[#162b5e] transition-colors"
                  >
                    Voltar ao login
                  </Link>
                </div>
              ) : (
                <>
                  <h1 className="text-xl font-bold text-gray-900 mb-1">Criar conta</h1>
                  <p className="text-sm text-gray-400 mb-8 italic">Preencha os dados para começar</p>

                  <form onSubmit={handleRegister} className="space-y-5">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
                        Nome completo
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0d1e45] focus:border-transparent transition-all"
                        placeholder="Seu nome"
                      />
                    </div>

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
                        placeholder="Senha"
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
                      {loading ? 'Criando conta...' : 'Criar conta'}
                    </button>
                  </form>

                  <p className="mt-6 text-center text-sm text-gray-400">
                    Já tem conta?{' '}
                    <Link href="/login" className="text-[#0d1e45] hover:underline font-semibold">
                      Fazer login
                    </Link>
                  </p>
                </>
              )}
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
