export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'
import { logToolUsage } from '@/lib/supabase/tool-usage'
import { logActivity } from '@/lib/supabase/activity-log'
import { parseBRL, normDup, formatBRL } from '@/lib/utils/br-format'

function normHeader(cell: unknown): string {
  return String(cell ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim()
}

// Localiza a linha de cabeçalho do relatório do Santander e o índice de cada
// coluna pelo nome (em vez de posição fixa), já que o preâmbulo antes do
// cabeçalho varia de tamanho entre exportações.
function findHeaderColumns(rows: unknown[][]): {
  rowIndex: number
  cols: { seuNumero: number; vencimento: number; liquidacao: number; valorTitulo: number; valorCobrado: number; pagador: number }
} | null {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    if (!row) continue
    const norm = row.map(normHeader)
    const seuNumero = norm.findIndex(c => c === 'SEU NUMERO')
    const vencimento = norm.findIndex(c => c === 'VENCIMENTO')
    const liquidacao = norm.findIndex(c => c.startsWith('DATA DA LIQUIDACAO'))
    const valorTitulo = norm.findIndex(c => c.startsWith('VALOR DO TITULO'))
    const valorCobrado = norm.findIndex(c => c.startsWith('VALOR COBRADO'))
    const pagador = norm.findIndex(c => c === 'PAGADOR')
    if (seuNumero !== -1 && vencimento !== -1 && liquidacao !== -1 && valorTitulo !== -1 && valorCobrado !== -1 && pagador !== -1) {
      return { rowIndex: i, cols: { seuNumero, vencimento, liquidacao, valorTitulo, valorCobrado, pagador } }
    }
  }
  return null
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const formData = await request.formData()
    const xlsxFile = formData.get('xlsx') as File
    const txtFile = formData.get('txt') as File
    if (!xlsxFile || !txtFile) return NextResponse.json({ error: 'Arquivos obrigatórios' }, { status: 400 })

    // Parse XLSX (bank return) - o relatório do Santander tem um preâmbulo de
    // tamanho variável antes do cabeçalho real das colunas; em vez de indices
    // fixos (que quebram/deslocam se o preâmbulo mudar de tamanho), acha o
    // cabeçalho pelo nome da coluna e lê os dados a partir dele.
    const xlsxBuffer = Buffer.from(await xlsxFile.arrayBuffer())
    const wb = XLSX.read(xlsxBuffer, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })

    const header = findHeaderColumns(rows)
    if (!header) {
      return NextResponse.json({ error: 'Não foi possível identificar as colunas do arquivo de retorno bancário.' }, { status: 400 })
    }

    type BankEntry = { seuNumero: string; vencimento: string; liquidacao: string; valorTitulo: number; valorCobrado: number; pagador: string }
    const bankEntries: BankEntry[] = []
    for (let i = header.rowIndex + 1; i < rows.length; i++) {
      const row = rows[i] as unknown[]
      if (!row || !row[header.cols.seuNumero]) continue
      bankEntries.push({
        seuNumero: normDup(String(row[header.cols.seuNumero] ?? '')),
        vencimento: String(row[header.cols.vencimento] ?? ''),
        liquidacao: String(row[header.cols.liquidacao] ?? ''),
        valorTitulo: parseBRL(row[header.cols.valorTitulo]),
        valorCobrado: parseBRL(row[header.cols.valorCobrado]),
        pagador: String(row[header.cols.pagador] ?? ''),
      })
    }

    // Parse TXT (ERP) - find all duplicata numbers
    const txtBuffer = Buffer.from(await txtFile.arrayBuffer())
    const txtContent = txtBuffer.toString('latin1')
    const dupPattern = /([0-9]{6,}.[0-9]+)/g
    const erpSet = new Set<string>()
    let m: RegExpExecArray | null
    while ((m = dupPattern.exec(txtContent)) !== null) {
      erpSet.add(normDup(m[1]))
    }

    // Compare
    let baixadas = 0, naoBaixadas = 0
    const results = bankEntries.map(e => {
      const found = erpSet.has(e.seuNumero)
      if (found) baixadas++; else naoBaixadas++
      return {
        duplicata: e.seuNumero,
        pagador: e.pagador,
        vencimento: e.vencimento,
        liquidacao: e.liquidacao,
        valorTitulo: formatBRL(e.valorTitulo),
        valorCobrado: formatBRL(e.valorCobrado),
        juros: formatBRL(e.valorCobrado - e.valorTitulo),
        status: found ? 'BAIXADA' : 'NAO_BAIXADA',
      }
    })

    await logToolUsage(supabase, user.id, 'duplicatas', 2)
    await logActivity(user.id, 'tool_run', 'Processou Conferência de Duplicatas')

    return NextResponse.json({ results, summary: { baixadas, naoBaixadas, total: results.length } })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro ao processar arquivos' }, { status: 500 })
  }
}
