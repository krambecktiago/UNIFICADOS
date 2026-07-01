'use client'

import { useEffect, useState } from 'react'
import { formatDateTime } from '@/lib/utils'

interface PixTransaction {
  id: string
  end_to_end_id: string
  valor: number
  pagador_cpf_cnpj: string | null
  pagador_nome: string | null
  chave_pix: string
  data_hora_pagamento: string
  info_pagador: string | null
  status: 'RECEIVED' | 'RECONCILING' | 'MATCHED' | 'RECONCILED' | 'ERROR' | 'IGNORED'
  erp_titulo_id: string | null
  reconciliation_source: 'AUTOMATIC' | 'MANUAL' | null
  reconciled_at: string | null
  reconciled_by: string | null
}

const STATUS_STYLE: Record<PixTransaction['status'], string> = {
  RECEIVED: 'bg-gray-100 text-gray-600',
  RECONCILING: 'bg-amber-100 text-amber-700',
  MATCHED: 'bg-blue-100 text-blue-700',
  RECONCILED: 'bg-green-100 text-green-700',
  ERROR: 'bg-red-100 text-red-700',
  IGNORED: 'bg-gray-100 text-gray-400',
}

const STATUS_LABEL: Record<PixTransaction['status'], string> = {
  RECEIVED: 'Recebido',
  RECONCILING: 'Conciliando',
  MATCHED: 'Encontrado',
  RECONCILED: 'Conciliado',
  ERROR: 'Erro',
  IGNORED: 'Ignorado',
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export default function PixPage() {
  const [transactions, setTransactions] = useState<PixTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actingId, setActingId] = useState<string | null>(null)
  const [reconcilingId, setReconcilingId] = useState<string | null>(null)
  const [tituloId, setTituloId] = useState('')
  const [force, setForce] = useState(false)
  const [actionError, setActionError] = useState('')

  function load() {
    setLoading(true)
    fetch('/api/pix/transactions')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setTransactions(data)
        else setError(data.error ?? 'Erro ao carregar transações')
      })
      .catch(() => setError('Erro de rede'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  function openReconcile(id: string) {
    setReconcilingId(id)
    setTituloId('')
    setForce(false)
    setActionError('')
  }

  function closeReconcile() {
    setReconcilingId(null)
    setActionError('')
  }

  async function submitReconcile(id: string) {
    if (!tituloId.trim()) return
    setActingId(id)
    setActionError('')
    try {
      const res = await fetch(`/api/pix/transactions/${id}/reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ erpTituloId: tituloId.trim(), force }),
      })
      const data = await res.json()
      if (!res.ok) {
        setActionError(data.error ?? 'Erro ao conciliar')
        return
      }
      setReconcilingId(null)
      load()
    } catch {
      setActionError('Erro de rede')
    } finally {
      setActingId(null)
    }
  }

  async function ignore(id: string) {
    setActingId(id)
    try {
      const res = await fetch(`/api/pix/transactions/${id}/ignore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: 'Ignorado manualmente no painel' }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error ?? 'Erro ao ignorar')
        return
      }
      load()
    } catch {
      alert('Erro de rede')
    } finally {
      setActingId(null)
    }
  }

  const canAct = (status: PixTransaction['status']) => status === 'RECEIVED' || status === 'ERROR' || status === 'MATCHED'

  return (
    <div className="min-h-screen">
      <div className="h-[68px] bg-white border-b border-gray-200 px-8 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-gray-900 leading-tight">Conciliação PIX</h1>
          <p className="text-xs text-gray-400 leading-tight mt-0.5">Pagamentos PIX recebidos (Bradesco) x títulos do ERP JJW</p>
        </div>
        {!loading && !error && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#0d1e45]/10 text-[#0d1e45]">
            {transactions.length} {transactions.length === 1 ? 'transação' : 'transações'}
          </span>
        )}
      </div>

      <div className="px-8 py-8">
        {loading && <p className="text-sm text-gray-400">Carregando transações...</p>}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
        )}
        {!loading && !error && transactions.length === 0 && (
          <p className="text-sm text-gray-400">Nenhuma transação PIX registrada ainda.</p>
        )}

        <div className="space-y-3">
          {transactions.map(tx => {
            const isActing = actingId === tx.id
            const isReconciling = reconcilingId === tx.id
            return (
              <div key={tx.id} className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(tx.valor)}</p>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[tx.status]}`}>
                        {STATUS_LABEL[tx.status]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {tx.pagador_nome ?? 'Pagador não identificado'}
                      {tx.pagador_cpf_cnpj ? ` · ${tx.pagador_cpf_cnpj}` : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDateTime(tx.data_hora_pagamento)} · <span className="font-mono">{tx.end_to_end_id}</span>
                    </p>
                    {tx.erp_titulo_id && (
                      <p className="text-xs text-gray-400 mt-0.5">Título ERP: <span className="font-mono">{tx.erp_titulo_id}</span></p>
                    )}
                    {tx.reconciled_at && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Conciliado {tx.reconciliation_source === 'MANUAL' ? 'manualmente' : 'automaticamente'} por {tx.reconciled_by} em {formatDateTime(tx.reconciled_at)}
                      </p>
                    )}
                  </div>

                  {canAct(tx.status) && !isReconciling && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => openReconcile(tx.id)}
                        disabled={isActing}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[#0d1e45]/20 text-[#0d1e45] hover:bg-[#0d1e45]/5 disabled:opacity-40"
                      >
                        Conciliar
                      </button>
                      <button
                        onClick={() => ignore(tx.id)}
                        disabled={isActing}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                      >
                        Ignorar
                      </button>
                    </div>
                  )}
                </div>

                {isReconciling && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        autoFocus
                        value={tituloId}
                        onChange={e => setTituloId(e.target.value)}
                        placeholder="ID do título no ERP"
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#0d1e45]/30"
                      />
                      <label className="flex items-center gap-1.5 text-xs text-gray-500 shrink-0">
                        <input type="checkbox" checked={force} onChange={e => setForce(e.target.checked)} />
                        Forçar (ignora tolerância)
                      </label>
                    </div>
                    {actionError && <p className="text-xs text-red-600">{actionError}</p>}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => submitReconcile(tx.id)}
                        disabled={isActing || !tituloId.trim()}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#0d1e45] text-white hover:bg-[#162b5e] disabled:opacity-40"
                      >
                        {isActing ? 'Conciliando...' : 'Confirmar conciliação'}
                      </button>
                      <button
                        onClick={closeReconcile}
                        disabled={isActing}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
