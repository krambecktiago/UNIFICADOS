'use client'

import { useState } from 'react'

export default function IAPage() {
  const [prompt, setPrompt] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault()
    if (!prompt.trim()) return

    setLoading(true)
    setError('')
    setResult('')

    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Erro desconhecido')
        return
      }

      setResult(data.result)
    } catch {
      setError('Falha ao conectar com o servidor.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen">
      <div className="h-[68px] bg-white border-b border-gray-200 dark:bg-[#060f26] dark:border-white/10 px-8 flex items-center">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white leading-tight">Análise IA</h2>
          <p className="text-xs text-gray-400 dark:text-white/40 leading-tight mt-0.5">Powered by GROQ — respostas rápidas com Llama 3.3 70B</p>
        </div>
      </div>

      <div className="p-8 max-w-3xl">
        <form onSubmit={handleAnalyze} className="space-y-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            placeholder="Descreva o que você quer analisar ou perguntar..."
            className="w-full px-4 py-3 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white bg-white dark:bg-[#0d1e45]/30 resize-none focus:outline-none focus:ring-2 focus:ring-[#0d1e45] dark:focus:ring-white/30 focus:border-transparent transition-all"
          />

          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="px-5 py-2.5 bg-[#0d1e45] text-white text-sm font-semibold rounded-xl hover:bg-[#162b5e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Analisando...' : '✦ Analisar'}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-6 p-5 bg-white dark:bg-[#0d1e45]/30 border border-gray-200 dark:border-white/10 rounded-xl">
            <p className="text-xs font-medium text-gray-400 dark:text-white/40 uppercase tracking-wide mb-3">Resultado</p>
            <p className="text-sm text-gray-800 dark:text-white/80 whitespace-pre-wrap leading-relaxed">{result}</p>
          </div>
        )}
      </div>
    </div>
  )
}
