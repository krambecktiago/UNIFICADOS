export type PeriodTab = 'weekly' | 'monthly'

export interface Section {
  title: string
  items: string[]
}

export interface ItemState {
  checked?: boolean
  comentario?: string
}

export const TAB_LABELS: Record<PeriodTab, string> = { weekly: 'Semanal', monthly: 'Mensal' }

export const CHECKLIST: Record<PeriodTab, Section[]> = {
  weekly: [
    {
      title: 'Produtividade',
      items: [
        'Nº de atendimentos/transações',
        'Tempo médio de atendimento por cliente',
        'Postura na fila/tempo de espera nos horários de pico',
      ],
    },
    {
      title: 'Qualidade e erros',
      items: [
        'Quebra de caixa (diferença de valores) — quantidade e valor',
        'Erros de digitação, troco errado, cancelamentos indevidos',
        'Reclamações de clientes direcionadas a este caixa',
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
  monthly: [
    {
      title: 'Desempenho consolidado',
      items: [
        'Média de quebra de caixa do mês (R$ e % sobre volume movimentado)',
        'Total de erros operacionais e evolução vs. mês anterior',
        'Ranking interno de produtividade entre os caixas',
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
        'Atualizar planilha individual com os dados do mês',
        'Registrar observações para embasar futura decisão de reajuste',
      ],
    },
  ],
}

export function itemId(sIdx: number, iIdx: number): string {
  return `item-${sIdx}-${iIdx}`
}

export function sectionTotal(sections: Section[]): number {
  return sections.reduce((sum, s) => sum + s.items.length, 0)
}

export function countChecked(itens: Record<string, ItemState>): number {
  return Object.values(itens).filter(v => v.checked).length
}
