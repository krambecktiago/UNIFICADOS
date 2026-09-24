'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const POLL_INTERVAL_MS = 10 * 1000
const TOAST_DURATION_MS = 15 * 1000
const STORAGE_KEY = 'tarefas-notificacoes-vistas'
const TAREFAS_HREF = '/dashboard/ferramentas/tarefas'

interface NotificacoesResponse {
  assinatura: string
  novas: { id: string; titulo: string; nome: string }[]
  concluidas: { id: string; titulo: string; nome: string; concluidoEm: string }[]
}

interface Toast {
  key: string
  title: string
  body: string
}

function loadSeen(): Set<string> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : null
  } catch {
    return null
  }
}

function saveSeen(seen: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen]))
  } catch {}
}

function showBrowserNotification(title: string, body: string, onClick: () => void) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const n = new Notification(title, { body, tag: `${title}:${body}` })
    n.onclick = () => { window.focus(); onClick(); n.close() }
  } catch {}
}

// Montado no layout do dashboard (só pra quem tem a ferramenta Tarefas) —
// consulta a cada 10s e avisa o responsável quando recebe tarefa nova e o
// criador quando uma tarefa dele é concluída. O que já foi avisado fica no
// localStorage do navegador; na primeira vez (sem nada salvo) só
// registra o estado atual, sem disparar uma avalanche de avisos antigos.
export function TarefasNotifier() {
  const router = useRouter()
  const [toasts, setToasts] = useState<Toast[]>([])
  const seenRef = useRef<Set<string> | null>(null)
  const assinaturaRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    function pushToast(toast: Toast) {
      setToasts(prev => [...prev.filter(t => t.key !== toast.key), toast])
      setTimeout(() => setToasts(prev => prev.filter(t => t.key !== toast.key)), TOAST_DURATION_MS)
      showBrowserNotification(toast.title, toast.body, () => router.push(TAREFAS_HREF))
    }

    async function poll() {
      try {
        const res = await fetch('/api/ferramentas/tarefas/notificacoes', { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const data = await res.json() as NotificacoesResponse

        const events = [
          ...data.novas.map(t => ({ key: `nova:${t.id}`, title: 'Nova tarefa para você', body: `${t.nome}: ${t.titulo}` })),
          // concluidoEm na chave: se a tarefa for reaberta e concluída de novo, avisa outra vez.
          ...data.concluidas.map(t => ({ key: `concluida:${t.id}:${t.concluidoEm}`, title: 'Tarefa concluída', body: `${t.nome} concluiu: ${t.titulo}` })),
        ]

        // Na primeira consulta só guarda a assinatura — a página acabou de
        // carregar com os dados atuais, não há o que atualizar.
        const mudou = assinaturaRef.current !== null && assinaturaRef.current !== data.assinatura
        assinaturaRef.current = data.assinatura

        if (seenRef.current === null) {
          const stored = loadSeen()
          if (stored === null) {
            seenRef.current = new Set(events.map(e => e.key))
            saveSeen(seenRef.current)
            return
          }
          seenRef.current = stored
        }

        const seen = seenRef.current
        const fresh = events.filter(e => !seen.has(e.key))

        if (fresh.length > 0) {
          fresh.forEach(e => { seen.add(e.key); pushToast(e) })
          // Só guarda chaves que ainda vêm da API — sem isso a lista cresceria pra sempre.
          const current = new Set(events.map(e => e.key))
          seenRef.current = new Set([...seen].filter(k => current.has(k)))
          saveSeen(seenRef.current)
        }

        if (fresh.length > 0 || mudou) {
          window.dispatchEvent(new Event('tarefas:atualizadas'))
          // Re-renderiza os server components da página atual — atualiza o card
          // "Tarefas pendentes" do Dashboard sem F5 (estado client é mantido).
          router.refresh()
        }
      } catch {}
    }

    poll()
    const id = setInterval(poll, POLL_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [router])

  if (toasts.length === 0) return null

  return (
    <div className="print:hidden fixed top-5 right-5 z-50 flex flex-col gap-2 w-80 max-w-[calc(100vw-2.5rem)]">
      {toasts.map(t => (
        <div
          key={t.key}
          className="animate-fade-in-up bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 border-l-4 border-l-indigo-600 rounded-xl shadow-lg p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <button
              onClick={() => { setToasts(prev => prev.filter(x => x.key !== t.key)); router.push(TAREFAS_HREF) }}
              className="text-left min-w-0"
            >
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.title}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 break-words">{t.body}</p>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1.5">Abrir Tarefas →</p>
            </button>
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.key !== t.key))}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none"
              aria-label="Fechar"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
