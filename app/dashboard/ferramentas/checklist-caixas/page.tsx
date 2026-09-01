'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabPanel, type TabDef } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

type PeriodTab = 'weekly' | 'monthly'

interface Section {
  title: string
  items: string[]
}

const DATA: Record<PeriodTab, { sections: Section[] }> = {
  weekly: {
    sections: [
      {
        title: 'Produtividade',
        items: [
          'Nº de atendimentos/transações por caixa',
          'Tempo médio de atendimento por cliente',
          'Fila/tempo de espera nos horários de pico',
        ],
      },
      {
        title: 'Qualidade e erros',
        items: [
          'Quebra de caixa (diferença de valores) — quantidade e valor por pessoa',
          'Erros de digitação, troco errado, cancelamentos indevidos',
          'Reclamações de clientes direcionadas a um caixa específico',
        ],
      },
      {
        title: 'Presença',
        items: [
          'Faltas, atrasos e saídas antecipadas',
          'Cumprimento da escala e horários de pausa',
        ],
      },
    ],
  },
  monthly: {
    sections: [
      {
        title: 'Desempenho consolidado',
        items: [
          'Média de quebra de caixa do mês (R$ e % sobre volume movimentado) por pessoa',
          'Total de erros operacionais e evolução vs. mês anterior',
          'Ranking interno de produtividade entre os 10 caixas',
        ],
      },
      {
        title: 'Comportamental / qualitativo',
        items: [
          'Feedback de clientes (elogios e reclamações) do mês',
          'Postura com a equipe e proatividade',
          'Cumprimento de normas e procedimentos internos',
        ],
      },
      {
        title: 'Financeiro / negócio',
        items: [
          'Vendas adicionais / upsell (se aplicável)',
          'Metas batidas vs. não batidas',
        ],
      },
      {
        title: 'Desenvolvimento',
        items: [
          'Treinamentos concluídos no mês',
          'Evolução desde a última avaliação (melhorou, estagnou, piorou)',
        ],
      },
      {
        title: 'Ação',
        items: [
          'Atualizar planilha individual de cada caixa com os dados do mês',
          'Registrar observações para embasar futura decisão de reajuste',
        ],
      },
    ],
  },
}

const TAB_LABELS: Record<PeriodTab, string> = { weekly: 'Semanal', monthly: 'Mensal' }

type PeriodState = Record<string, boolean>
type ToolSettings = Partial<Record<PeriodTab, Record<string, PeriodState>>>

// yyyy-mm-dd/yyyy-mm em horário local — toISOString() usaria UTC e trocaria
// de dia/semana antes da hora certa pra quem acessa à noite (UTC-3).
function toLocalISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getPeriodKey(tab: PeriodTab): string {
  const now = new Date()
  if (tab === 'weekly') {
    const first = new Date(now)
    const day = first.getDay()
    const diff = (day === 0 ? -6 : 1) - day
    first.setDate(first.getDate() + diff)
    return toLocalISODate(first)
  }
  return toLocalISODate(now).slice(0, 7)
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

function periodLabelText(tab: PeriodTab, key: string): string {
  if (tab === 'weekly') {
    const [y, m, d] = key.split('-').map(Number)
    return `Semana de ${new Date(y, m - 1, d).toLocaleDateString('pt-BR')}`
  }
  const [y, m] = key.split('-')
  return `${MESES[parseInt(m, 10) - 1]} de ${y}`
}

function itemId(sIdx: number, iIdx: number): string {
  return `item-${sIdx}-${iIdx}`
}

function sectionTotal(sections: Section[]): number {
  return sections.reduce((sum, s) => sum + s.items.length, 0)
}

function countChecked(state: PeriodState): number {
  return Object.values(state).filter(Boolean).length
}

export default function ChecklistCaixasPage() {
  const [tab, setTab] = useState<PeriodTab>('weekly')
  const [settings, setSettings] = useState<ToolSettings>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/ferramentas/settings?tool=checklist-caixas')
      .then(res => res.json())
      .then(json => setSettings(json.settings ?? {}))
      .catch(() => setError('Não foi possível carregar o checklist.'))
      .finally(() => setLoading(false))
  }, [])

  async function persist(next: ToolSettings) {
    setSettings(next)
    try {
      const res = await fetch('/api/ferramentas/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'checklist-caixas', settings: next }),
      })
      if (!res.ok) throw new Error()
      setError(null)
    } catch {
      setError('Não foi possível salvar agora — tente novamente.')
    }
  }

  function periodStateFor(t: PeriodTab): PeriodState {
    return settings[t]?.[getPeriodKey(t)] ?? {}
  }

  function toggleItem(id: string) {
    const key = getPeriodKey(tab)
    const tabState = settings[tab] ?? {}
    const nextPeriodState = { ...tabState[key], [id]: !tabState[key]?.[id] }
    persist({ ...settings, [tab]: { ...tabState, [key]: nextPeriodState } })
  }

  function resetPeriod() {
    if (!confirm('Desmarcar todos os itens deste período?')) return
    const key = getPeriodKey(tab)
    const tabState = settings[tab] ?? {}
    persist({ ...settings, [tab]: { ...tabState, [key]: {} } })
  }

  const periodKey = getPeriodKey(tab)
  const periodState = periodStateFor(tab)
  const total = sectionTotal(DATA[tab].sections)
  const checked = countChecked(periodState)
  const pct = total ? Math.round((checked / total) * 100) : 0

  const tabs: TabDef<PeriodTab>[] = (['weekly', 'monthly'] as const).map(t => ({
    key: t,
    label: TAB_LABELS[t],
    count: sectionTotal(DATA[t].sections) - countChecked(periodStateFor(t)),
    border: 'border-brand-navy dark:border-blue-400',
    text: 'text-brand-navy dark:text-blue-400',
  }))

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800">
      <PageHeader
        title="Checklist Equipe de Caixas"
        subtitle="Acompanhamento periódico para embasar decisões de desempenho e reajuste salarial"
      />

      <div className="px-8 py-8 max-w-3xl mx-auto">
        <div className="mb-5">
          <Tabs tabs={tabs} activeTab={tab} onChange={setTab} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-12">
            <Spinner size="lg" className="text-blue-600" />
            <span className="text-sm text-gray-500 dark:text-gray-400">Carregando…</span>
          </div>
        ) : (
          <TabPanel tabKey={tab}>
            <Card padding="5" className="mb-4">
              <div className="flex items-center justify-between gap-3 mb-4">
                <span className="text-sm text-gray-500 dark:text-gray-400">{periodLabelText(tab, periodKey)}</span>
                <Button variant="ghost" className="text-xs px-2 py-1" onClick={resetPeriod}>
                  Reiniciar período
                </Button>
              </div>
              <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 text-right mt-1.5">
                {checked} de {total} conferidos ({pct}%)
              </p>
            </Card>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {DATA[tab].sections.map((section, sIdx) => (
                <Card key={section.title} padding="5">
                  <p className="text-xs font-medium text-brand-navy dark:text-blue-400 uppercase tracking-wide mb-3">
                    {section.title}
                  </p>
                  <div className="space-y-1 -mx-2">
                    {section.items.map((text, iIdx) => {
                      const id = itemId(sIdx, iIdx)
                      const isChecked = !!periodState[id]
                      return (
                        <div
                          key={id}
                          onClick={() => toggleItem(id)}
                          className="flex items-start gap-3 px-2 py-2 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div
                            className={cn(
                              'w-5 h-5 mt-0.5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-colors',
                              isChecked ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-600'
                            )}
                          >
                            {isChecked && (
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            )}
                          </div>
                          <span className={cn('text-sm leading-snug', isChecked ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-800 dark:text-gray-200')}>
                            {text}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              ))}
            </div>
          </TabPanel>
        )}
      </div>
    </div>
  )
}
