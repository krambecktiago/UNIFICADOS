export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'

interface Venda {
  data: string
  valor: number
  modalidade: string
  bandeira: string
  nsu: string
  autorizacao: string
  maquininha: string
  loja: string
  lojaNumero: string
  parcelas: number
}

interface Recibo {
  cliente: string
  recibo: string
  nsu: string
  autorizacao: string
  dataMvto: string
  dataEmissao: string
  valor: number
  loja: string
  parcelas: number
}

interface MatchedEntry {
  venda: Venda
  recibo: Recibo
  divergente: boolean
  diferenca: number
  motivo: 'valor' | 'identificador'
  parcelasDivergentes: boolean
}

interface Summary {
  vendasTotal: number
  vendasValor: number
  okCount: number
  okValor: number
  divergentCount: number
  missingCount: number
  missingValor: number
  pendingCount: number
  pendingValor: number
}

interface ExportBody {
  matched: MatchedEntry[]
  divergent: MatchedEntry[]
  missing: Venda[]
  pending: Recibo[]
  summary: Summary
}

function lojaLabel(v: Venda): string {
  return v.lojaNumero ? `${v.loja} (${v.lojaNumero})` : v.loja
}

// Barra proporcional feita com blocos Unicode — a versão community da lib
// xlsx não escreve estilos/cores de célula nem gráficos nativos do Excel
// (recurso pago do SheetJS Pro), então essa é a forma de dar uma noção
// visual de proporção sem depender de nenhuma lib extra.
function bar(pct: number, width = 30): string {
  const filled = Math.max(0, Math.min(width, Math.round(pct * width)))
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function pctFmt(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

function buildResumoSheet(body: ExportBody) {
  const { summary, divergent } = body
  const divergentValor = divergent.reduce((a, m) => a + m.venda.valor, 0)
  const total = summary.vendasTotal || 1

  const pctOk = summary.okCount / total
  const pctDiv = summary.divergentCount / total
  const pctMiss = summary.missingCount / total

  const rows: (string | number)[][] = [
    ['Conciliação de Recibos — Resumo'],
    [],
    ['Total de vendas no período', summary.vendasTotal, summary.vendasValor],
    [],
    ['Categoria', 'Quantidade', 'Valor', '% das vendas', 'Proporção'],
    ['Conciliados', summary.okCount, summary.okValor, pctFmt(pctOk), bar(pctOk)],
    ['Divergências', summary.divergentCount, divergentValor, pctFmt(pctDiv), bar(pctDiv)],
    ['Vendas sem recibo', summary.missingCount, summary.missingValor, pctFmt(pctMiss), bar(pctMiss)],
    [],
    ['Fora da base de vendas (não entra no % acima)'],
    ['Recibos sem venda correspondente', summary.pendingCount, summary.pendingValor],
  ]

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 34 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 32 }]
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }]
  return ws
}

function buildMissingSheet(missing: Venda[]) {
  const rows = missing.map(v => ({
    Data: v.data,
    Loja: lojaLabel(v),
    Valor: v.valor,
    Modalidade: v.modalidade,
    Bandeira: v.bandeira,
    Parcelas: v.parcelas,
    NSU: v.nsu,
    Autorização: v.autorizacao,
    Maquininha: v.maquininha,
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
  return ws
}

function buildOkSheet(matched: MatchedEntry[]) {
  const rows = matched.map(m => ({
    Data: m.venda.data,
    Loja: lojaLabel(m.venda),
    Valor: m.venda.valor,
    Parcelas: m.venda.parcelas,
    NSU: m.venda.nsu,
    Autorização: m.venda.autorizacao,
    Cliente: m.recibo.cliente,
    Recibo: m.recibo.recibo,
    Emissão: m.recibo.dataEmissao,
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 14 }, { wch: 12 }]
  return ws
}

function buildDivergentSheet(divergent: MatchedEntry[]) {
  const rows = divergent.map(m => ({
    Data: m.venda.data,
    Loja: lojaLabel(m.venda),
    Motivo: m.motivo === 'identificador' ? 'NSU/Autorização não conferem' : 'Valor diferente',
    'Parcelas diferentes': m.parcelasDivergentes ? 'Sim' : 'Não',
    'Valor Venda': m.venda.valor,
    'Valor Recibo': m.recibo.valor,
    Diferença: m.diferenca,
    'Parcelas Venda': m.venda.parcelas,
    'Parcelas Recibo': m.recibo.parcelas,
    'NSU Venda': m.venda.nsu,
    'NSU Recibo': m.recibo.nsu,
    'Autorização Venda': m.venda.autorizacao,
    'Autorização Recibo': m.recibo.autorizacao,
    Cliente: m.recibo.cliente,
    Recibo: m.recibo.recibo,
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 12 }, { wch: 22 }, { wch: 28 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 30 }, { wch: 14 },
  ]
  return ws
}

function buildPendingSheet(pending: Recibo[]) {
  const rows = pending.map(r => ({
    'Mvto Adquirente': r.dataMvto,
    Loja: r.loja,
    Valor: r.valor,
    Parcelas: r.parcelas,
    NSU: r.nsu,
    Autorização: r.autorizacao,
    Cliente: r.cliente,
    Recibo: r.recibo,
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 14 }]
  return ws
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const body = (await request.json()) as ExportBody
    if (!body?.summary) {
      return NextResponse.json({ error: 'Dados de conciliação ausentes.' }, { status: 400 })
    }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, buildResumoSheet(body), 'Resumo')
    XLSX.utils.book_append_sheet(wb, buildMissingSheet(body.missing ?? []), 'Vendas sem recibo')
    XLSX.utils.book_append_sheet(wb, buildOkSheet(body.matched ?? []), 'Conciliados')
    XLSX.utils.book_append_sheet(wb, buildDivergentSheet(body.divergent ?? []), 'Divergências')
    XLSX.utils.book_append_sheet(wb, buildPendingSheet(body.pending ?? []), 'Recibos sem venda')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="conciliacao-recibos.xlsx"',
      },
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro ao gerar planilha.' }, { status: 500 })
  }
}
