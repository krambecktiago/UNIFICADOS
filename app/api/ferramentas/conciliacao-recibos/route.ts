export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import { logToolUsage } from '@/lib/supabase/tool-usage'
import { normText } from '@/lib/utils/br-format'
import { formatDate } from '@/lib/utils'

interface Venda {
  data: string
  valor: number
  modalidade: string
  bandeira: string
  nsu: string
  autorizacao: string
  maquininha: string
  loja: string
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
}

interface MatchedEntry {
  venda: Venda
  recibo: Recibo
  divergente: boolean
  diferenca: number
}

// Prefixo numérico do campo "Recibo" (ex: "5/209529") identifica a loja. O
// código 4 nunca foi usado nos dados reais — quando a loja 6 (Gaspar) existe
// no arquivo, o 5 é Blumenau; quando não existe, é o 4 que é Blumenau e o 5
// vira Gaspar. Ambas as variantes seguem regra combinada com o usuário.
const LOJA_BASE: Record<string, string> = { '1': 'Matriz', '2': 'Indaial', '3': 'Diesel' }

function buildLojaMap(recibos: string[]): Record<string, string> {
  const prefixes = new Set(recibos.map(r => r.split('/')[0]?.trim()))
  const map = { ...LOJA_BASE }
  if (prefixes.has('6')) {
    map['5'] = 'Blumenau'
    map['6'] = 'Gaspar'
  } else {
    map['4'] = 'Blumenau'
    map['5'] = 'Gaspar'
  }
  return map
}

function cellText(v: unknown): string {
  return v instanceof Date ? formatDate(v) : String(v ?? '')
}

function findHeaderRow(rows: unknown[][], mustInclude: string[]): number {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const normed = (rows[i] ?? []).map(c => normText(c))
    if (mustInclude.every(k => normed.some(h => h.includes(k)))) return i
  }
  return -1
}

function colIndex(headers: string[], keywords: string[], exclude: string[] = []): number {
  return headers.findIndex(h => keywords.every(k => h.includes(k)) && !exclude.some(k => h.includes(k)))
}

// Relatório "Vendas" da Rede (por maquininha). Máquinas com código iniciando em
// "PV" são PDVs de balcão que não emitem o recibo conferido aqui — só entram na
// conciliação as vendas aprovadas em outras maquininhas (SN/SV/LG...).
function parseVendasXLSX(buffer: Buffer): Venda[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })

  const headerIdx = findHeaderRow(rows, ['NSU', 'AUTORIZ'])
  if (headerIdx === -1) return []
  const headers = (rows[headerIdx] ?? []).map(h => normText(h))

  const idxData = colIndex(headers, ['DATA', 'VENDA'])
  const idxStatus = colIndex(headers, ['STATUS'])
  const idxValor = colIndex(headers, ['VALOR', 'ATUALIZADO'])
  const idxModalidade = colIndex(headers, ['MODALIDADE'])
  const idxBandeira = colIndex(headers, ['BANDEIRA'])
  const idxNsu = colIndex(headers, ['NSU'])
  // "AUTORIZ" sozinho também bate com a coluna "pré-autorizado" (quase sempre "-") — excluir.
  const idxAutorizacao = colIndex(headers, ['AUTORIZ'], ['PRE'])
  const idxMaquininha = colIndex(headers, ['CODIGO', 'MAQUININHA'])
  const idxLoja = colIndex(headers, ['NOME', 'ESTABELECIMENTO'])

  const results: Venda[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !row.length) continue
    if (normText(row[idxStatus]) !== 'APROVADA') continue

    const maquininha = String(row[idxMaquininha] ?? '')
    if (maquininha.toUpperCase().startsWith('PV')) continue

    const nsu = normText(row[idxNsu])
    const autorizacao = normText(row[idxAutorizacao])
    if (!nsu || !autorizacao) continue

    results.push({
      data: cellText(row[idxData]),
      valor: Number(row[idxValor]) || 0,
      modalidade: String(row[idxModalidade] ?? ''),
      bandeira: String(row[idxBandeira] ?? ''),
      nsu,
      autorizacao,
      maquininha,
      loja: String(row[idxLoja] ?? ''),
    })
  }
  return results
}

// Relatório interno "Clientes x Recibos" — um recibo emitido por linha.
function parseRecibosXLSX(buffer: Buffer): Recibo[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })

  const headerIdx = findHeaderRow(rows, ['NSU', 'AUTORIZ'])
  if (headerIdx === -1) return []
  const headers = (rows[headerIdx] ?? []).map(h => normText(h))

  const idxCliente = colIndex(headers, ['CLIENTE'])
  const idxRecibo = colIndex(headers, ['RECIBO'])
  const idxAutorizacao = colIndex(headers, ['AUTORIZ'])
  const idxNsu = colIndex(headers, ['NSU'])
  const idxDataMvto = colIndex(headers, ['DATA', 'MVTO'])
  const idxDataEmissao = colIndex(headers, ['DATA', 'EMISS'])
  const idxValor = colIndex(headers, ['VALOR', 'PAGO'])

  const dataRows = rows.slice(headerIdx + 1).filter(row => row && row.length)
  const lojaMap = buildLojaMap(dataRows.map(row => String(row[idxRecibo] ?? '')))

  const results: Recibo[] = []
  for (const row of dataRows) {
    const nsu = normText(row[idxNsu])
    const autorizacao = normText(row[idxAutorizacao])
    if (!nsu || !autorizacao) continue

    const recibo = String(row[idxRecibo] ?? '')
    const prefixo = recibo.split('/')[0]?.trim()

    results.push({
      cliente: String(row[idxCliente] ?? ''),
      recibo,
      nsu,
      autorizacao,
      dataMvto: cellText(row[idxDataMvto]),
      dataEmissao: cellText(row[idxDataEmissao]),
      valor: Number(row[idxValor]) || 0,
      loja: lojaMap[prefixo] ?? prefixo ?? '',
    })
  }
  return results
}

function reconcile(vendas: Venda[], recibos: Recibo[]) {
  type RecIndexed = Recibo & { _used: boolean }
  const recIdx = new Map<string, RecIndexed>()
  for (const r of recibos) {
    recIdx.set(`${r.nsu}|${r.autorizacao}`, { ...r, _used: false })
  }

  const matched: MatchedEntry[] = []
  const missing: Venda[] = []

  for (const v of vendas) {
    const rec = recIdx.get(`${v.nsu}|${v.autorizacao}`)
    if (!rec) {
      missing.push(v)
      continue
    }
    rec._used = true
    const diferenca = rec.valor - v.valor
    matched.push({ venda: v, recibo: rec, divergente: Math.abs(diferenca) > 0.01, diferenca })
  }

  const pending = [...recIdx.values()].filter(r => !r._used)

  missing.sort((a, b) => a.data.localeCompare(b.data))
  matched.sort((a, b) => a.venda.data.localeCompare(b.venda.data))
  pending.sort((a, b) => a.dataMvto.localeCompare(b.dataMvto))

  return { matched, missing, pending }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const formData = await request.formData()
    const vendasFile = formData.get('vendasFile') as File
    const recibosFile = formData.get('recibosFile') as File
    if (!vendasFile || !recibosFile) {
      return NextResponse.json({ error: 'Ambos os arquivos são obrigatórios.' }, { status: 400 })
    }

    const vendas = parseVendasXLSX(Buffer.from(await vendasFile.arrayBuffer()))
    const recibos = parseRecibosXLSX(Buffer.from(await recibosFile.arrayBuffer()))
    const { matched, missing, pending } = reconcile(vendas, recibos)

    const ok = matched.filter(m => !m.divergente)
    const divergent = matched.filter(m => m.divergente)
    const s = (arr: number[]) => arr.reduce((a, b) => a + b, 0)

    await logToolUsage(supabase, user.id, 'conciliacao-recibos', 2)

    return NextResponse.json({
      matched: ok,
      divergent,
      missing,
      pending,
      summary: {
        vendasTotal: vendas.length,
        vendasValor: s(vendas.map(v => v.valor)),
        okCount: ok.length,
        okValor: s(ok.map(m => m.venda.valor)),
        divergentCount: divergent.length,
        missingCount: missing.length,
        missingValor: s(missing.map(v => v.valor)),
        pendingCount: pending.length,
        pendingValor: s(pending.map(r => r.valor)),
      },
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro ao processar arquivos.' }, { status: 500 })
  }
}
