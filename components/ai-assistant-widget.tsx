'use client'

import { useEffect, useRef, useState } from 'react'
import { Spinner } from '@/components/ui/spinner'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const WELCOME: Message = {
  role: 'assistant',
  content: 'Olá! Sou o assistente da plataforma. Posso ajudar a explicar como usar as ferramentas, o Dashboard ou qualquer outra parte do sistema. O que você precisa?',
}

export function AssistantWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    const nextMessages = [...messages, { role: 'user' as const, content: text }]
    setMessages(nextMessages)
    setInput('')
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Erro ao consultar o assistente')
        return
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch {
      setError('Falha ao conectar com o servidor.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="mb-3 w-80 sm:w-96 h-[28rem] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-scale-in">
          <div className="bg-brand-navy px-4 py-3 flex items-center justify-between shrink-0">
            <div>
              <p className="text-sm font-semibold text-white leading-tight">Assistente da Plataforma</p>
              <p className="text-[11px] text-white/50 leading-tight mt-0.5">Powered by GROQ</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="text-white/60 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] text-sm rounded-xl px-3 py-2 whitespace-pre-wrap leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-brand-navy text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-400 text-sm rounded-xl px-3 py-2 flex items-center gap-1.5">
                  <Spinner size="sm" />
                  Digitando...
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="px-4 pb-1 text-xs text-red-600">{error}</p>
          )}

          <form onSubmit={handleSend} className="p-3 border-t border-gray-100 flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua dúvida..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy focus:border-transparent transition-all"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Enviar"
              className="w-9 h-9 shrink-0 rounded-xl bg-brand-navy text-white flex items-center justify-center hover:bg-brand-navy-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.77 59.77 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen(v => !v)}
        aria-label={open ? 'Fechar assistente' : 'Abrir assistente'}
        className="w-14 h-14 rounded-full bg-brand-navy text-white shadow-xl flex items-center justify-center hover:bg-brand-navy-hover hover:-translate-y-0.5 transition-all"
      >
        {open ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
        )}
      </button>
    </div>
  )
}
