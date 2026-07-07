'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Gear, Wrench } from '@/components/decorative-icons'
import { Spinner } from '@/components/ui/spinner'

export default function OnboardingPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/profile/display-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Erro ao salvar o nome.')
        setLoading(false)
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Falha ao conectar com o servidor.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09173a] px-4 relative overflow-hidden">

      <Gear className="absolute -top-16 -left-16 w-72 h-72 text-white opacity-[0.04] rotate-12 animate-spin-slow" />
      <Gear className="absolute -bottom-20 -right-20 w-96 h-96 text-white opacity-[0.05] -rotate-6 animate-spin-slow" />
      <Gear className="absolute top-1/2 -right-10 w-40 h-40 text-white opacity-[0.04] rotate-45 animate-spin-slow" />
      <Gear className="absolute bottom-24 left-10 w-24 h-24 text-white opacity-[0.04] rotate-12 animate-spin-slow" />
      <Wrench className="absolute top-16 right-20 w-28 h-28 text-white opacity-[0.04] rotate-[30deg]" />
      <Wrench className="absolute bottom-12 left-1/3 w-20 h-20 text-white opacity-[0.03] -rotate-[20deg]" />

      <div className="w-full max-w-sm relative z-10 animate-scale-in">

        <div className="relative">
          <div className="absolute inset-x-4 bottom-0 h-16 bg-brand-red/25 blur-2xl rounded-full translate-y-4" />
          <div
            className="rounded-2xl overflow-hidden relative"
            style={{ boxShadow: '0 8px 16px -4px rgba(0,0,0,0.5), 0 32px 64px -12px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.12)' }}
          >

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

            <div className="h-1 bg-gradient-to-r from-brand-red via-[#ff3355] to-brand-red" />

            <div className="bg-white px-8 py-9">
              <h1 className="text-xl font-bold text-gray-900 mb-1">Bem-vindo(a)!</h1>
              <p className="text-sm text-gray-400 mb-8">
                Como você gostaria de ser chamado(a) no painel?
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
                    Seu nome
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent transition-all"
                    placeholder="Ex: Tiago"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="w-full bg-brand-navy text-white py-3 px-4 rounded-xl text-sm font-semibold hover:bg-brand-navy-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {loading && <Spinner size="sm" />}
                  {loading ? 'Salvando...' : 'Continuar'}
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
