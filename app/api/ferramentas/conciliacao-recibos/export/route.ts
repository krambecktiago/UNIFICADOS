export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
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

// Barra proporcional feita com blocos Unicode, colorida via fonte. A
// formatação condicional "barra de dados" nativa do Excel (o jeito mais óbvio
// de fazer isso) tem um bug conhecido e ainda aberto na exceljs que corrompe
// o arquivo no Excel de verdade (github.com/exceljs/exceljs/issues/3015) —
// essa alternativa usa só cor de fonte, um recurso básico e sem esse risco.
function bar(pct: number, width = 24): string {
  const filled = Math.max(0, Math.min(width, Math.round(pct * width)))
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

const NAVY = 'FF0D1E45'
const CURRENCY_FMT = '"R$" #,##0.00'
const PERCENT_FMT = '0.0%'

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' } }

// Cabeçalho padrão (fundo azul-marinho, texto branco em negrito) + auto-filtro
// + congelamento da 1ª linha, repetido em todas as abas de detalhe para dar
// uma identidade visual única ao arquivo inteiro.
function styleHeaderRow(ws: ExcelJS.Worksheet) {
  const header = ws.getRow(1)
  header.font = HEADER_FONT
  header.eachCell(cell => { cell.fill = HEADER_FILL })
  header.height = 20
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } }
}

function buildResumoSheet(wb: ExcelJS.Workbook, body: ExportBody) {
  const ws = wb.addWorksheet('Resumo', { views: [{ showGridLines: false }] })
  ws.columns = [{ width: 3 }, { width: 32 }, { width: 14 }, { width: 16 }, { width: 12 }, { width: 30 }]

  const { summary, divergent } = body
  const divergentValor = divergent.reduce((a, m) => a + m.venda.valor, 0)
  const total = summary.vendasTotal || 1

  ws.mergeCells('A1:F1')
  const title = ws.getCell('A1')
  title.value = 'KRAMBECK — Conciliação de Recibos'
  title.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } }
  title.fill = HEADER_FILL
  title.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  ws.getRow(1).height = 30

  ws.mergeCells('A2:F2')
  const subtitle = ws.getCell('A2')
  subtitle.value = `Resumo gerado em ${new Date().toLocaleString('pt-BR')}`
  subtitle.font = { italic: true, size: 10, color: { argb: 'FF6B7280' } }
  subtitle.alignment = { indent: 1 }

  ws.mergeCells('A4:B4')
  ws.getCell('A4').value = 'Total de vendas no período'
  ws.getCell('A4').font = { bold: true }
  ws.getCell('C4').value = summary.vendasTotal
  ws.getCell('C4').font = { bold: true }
  ws.getCell('D4').value = summary.vendasValor
  ws.getCell('D4').numFmt = CURRENCY_FMT
  ws.getCell('D4').font = { bold: true }

  const headerRow = ws.getRow(6)
  headerRow.values = ['', 'Categoria', 'Quantidade', 'Valor', '% das vendas', 'Proporção']
  headerRow.font = HEADER_FONT
  headerRow.eachCell(cell => { cell.fill = HEADER_FILL })
  headerRow.height = 20

  type CategoriaRow = { label: string; color: string; qtd: number; valor: number; pct: number }
  const categorias: CategoriaRow[] = [
    { label: 'Conciliados', color: 'FF16A34A', qtd: summary.okCount, valor: summary.okValor, pct: summary.okCount / total },
    { label: 'Divergências', color: 'FFF59E0B', qtd: summary.divergentCount, valor: divergentValor, pct: summary.divergentCount / total },
    { label: 'Vendas sem recibo', color: 'FFEA580C', qtd: summary.missingCount, valor: summary.missingValor, pct: summary.missingCount / total },
  ]

  categorias.forEach((c, i) => {
    const r = ws.getRow(7 + i)
    r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.color } }
    r.getCell(2).value = c.label
    r.getCell(3).value = c.qtd
    r.getCell(4).value = c.valor
    r.getCell(4).numFmt = CURRENCY_FMT
    r.getCell(5).value = c.pct
    r.getCell(5).numFmt = PERCENT_FMT
    r.getCell(6).value = bar(c.pct)
    r.getCell(6).font = { name: 'Consolas', color: { argb: c.color } }
    r.eachCell(cell => { cell.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } } })
  })

  ws.mergeCells('B11:C11')
  ws.getCell('B11').value = 'Fora da base de vendas (não entra no % acima)'
  ws.getCell('B11').font = { italic: true, size: 10, color: { argb: 'FF6B7280' } }

  const pendingRow = ws.getRow(12)
  pendingRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6B7280' } }
  pendingRow.getCell(2).value = 'Recibos sem venda correspondente'
  pendingRow.getCell(3).value = summary.pendingCount
  pendingRow.getCell(4).value = summary.pendingValor
  pendingRow.getCell(4).numFmt = CURRENCY_FMT

  return ws
}

function buildMissingSheet(wb: ExcelJS.Workbook, missing: Venda[]) {
  const ws = wb.addWorksheet('Vendas sem recibo')
  ws.columns = [
    { header: 'Data', key: 'data', width: 12 },
    { header: 'Loja', key: 'loja', width: 24 },
    { header: 'Valor', key: 'valor', width: 14, style: { numFmt: CURRENCY_FMT } },
    { header: 'Modalidade', key: 'modalidade', width: 12 },
    { header: 'Bandeira', key: 'bandeira', width: 12 },
    { header: 'Parcelas', key: 'parcelas', width: 10 },
    { header: 'NSU', key: 'nsu', width: 14 },
    { header: 'Autorização', key: 'autorizacao', width: 14 },
    { header: 'Maquininha', key: 'maquininha', width: 14 },
  ]
  ws.addRows(missing.map(v => ({
    data: v.data, loja: lojaLabel(v), valor: v.valor, modalidade: v.modalidade,
    bandeira: v.bandeira, parcelas: v.parcelas, nsu: v.nsu, autorizacao: v.autorizacao, maquininha: v.maquininha,
  })))
  styleHeaderRow(ws)
  return ws
}

function buildOkSheet(wb: ExcelJS.Workbook, matched: MatchedEntry[]) {
  const ws = wb.addWorksheet('Conciliados')
  ws.columns = [
    { header: 'Data', key: 'data', width: 12 },
    { header: 'Loja', key: 'loja', width: 24 },
    { header: 'Valor', key: 'valor', width: 14, style: { numFmt: CURRENCY_FMT } },
    { header: 'Parcelas', key: 'parcelas', width: 10 },
    { header: 'NSU', key: 'nsu', width: 14 },
    { header: 'Autorização', key: 'autorizacao', width: 14 },
    { header: 'Cliente', key: 'cliente', width: 32 },
    { header: 'Recibo', key: 'recibo', width: 14 },
    { header: 'Emissão', key: 'emissao', width: 12 },
  ]
  ws.addRows(matched.map(m => ({
    data: m.venda.data, loja: lojaLabel(m.venda), valor: m.venda.valor, parcelas: m.venda.parcelas,
    nsu: m.venda.nsu, autorizacao: m.venda.autorizacao, cliente: m.recibo.cliente,
    recibo: m.recibo.recibo, emissao: m.recibo.dataEmissao,
  })))
  styleHeaderRow(ws)
  return ws
}

function buildDivergentSheet(wb: ExcelJS.Workbook, divergent: MatchedEntry[]) {
  const ws = wb.addWorksheet('Divergências')
  ws.columns = [
    { header: 'Data', key: 'data', width: 12 },
    { header: 'Loja', key: 'loja', width: 24 },
    { header: 'Motivo', key: 'motivo', width: 28 },
    { header: 'Parcelas diferentes', key: 'parcelasDiv', width: 16 },
    { header: 'Valor Venda', key: 'valorVenda', width: 14, style: { numFmt: CURRENCY_FMT } },
    { header: 'Valor Recibo', key: 'valorRecibo', width: 14, style: { numFmt: CURRENCY_FMT } },
    { header: 'Diferença', key: 'diferenca', width: 14, style: { numFmt: CURRENCY_FMT } },
    { header: 'Parcelas Venda', key: 'parcelasVenda', width: 12 },
    { header: 'Parcelas Recibo', key: 'parcelasRecibo', width: 12 },
    { header: 'NSU Venda', key: 'nsuVenda', width: 14 },
    { header: 'NSU Recibo', key: 'nsuRecibo', width: 14 },
    { header: 'Autorização Venda', key: 'autVenda', width: 16 },
    { header: 'Autorização Recibo', key: 'autRecibo', width: 16 },
    { header: 'Cliente', key: 'cliente', width: 32 },
    { header: 'Recibo', key: 'recibo', width: 14 },
  ]
  ws.addRows(divergent.map(m => ({
    data: m.venda.data,
    loja: lojaLabel(m.venda),
    motivo: m.motivo === 'identificador' ? 'NSU/Autorização não conferem' : 'Valor diferente',
    parcelasDiv: m.parcelasDivergentes ? 'Sim' : 'Não',
    valorVenda: m.venda.valor,
    valorRecibo: m.recibo.valor,
    diferenca: m.diferenca,
    parcelasVenda: m.venda.parcelas,
    parcelasRecibo: m.recibo.parcelas,
    nsuVenda: m.venda.nsu,
    nsuRecibo: m.recibo.nsu,
    autVenda: m.venda.autorizacao,
    autRecibo: m.recibo.autorizacao,
    cliente: m.recibo.cliente,
    recibo: m.recibo.recibo,
  })))
  styleHeaderRow(ws)
  return ws
}

function buildPendingSheet(wb: ExcelJS.Workbook, pending: Recibo[]) {
  const ws = wb.addWorksheet('Recibos sem venda')
  ws.columns = [
    { header: 'Mvto Adquirente', key: 'dataMvto', width: 14 },
    { header: 'Loja', key: 'loja', width: 14 },
    { header: 'Valor', key: 'valor', width: 14, style: { numFmt: CURRENCY_FMT } },
    { header: 'Parcelas', key: 'parcelas', width: 10 },
    { header: 'NSU', key: 'nsu', width: 14 },
    { header: 'Autorização', key: 'autorizacao', width: 14 },
    { header: 'Cliente', key: 'cliente', width: 32 },
    { header: 'Recibo', key: 'recibo', width: 14 },
  ]
  ws.addRows(pending.map(r => ({
    dataMvto: r.dataMvto, loja: r.loja, valor: r.valor, parcelas: r.parcelas,
    nsu: r.nsu, autorizacao: r.autorizacao, cliente: r.cliente, recibo: r.recibo,
  })))
  styleHeaderRow(ws)
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

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Ferramentas Unificadas Krambeck'
    wb.created = new Date()

    buildResumoSheet(wb, body)
    buildMissingSheet(wb, body.missing ?? [])
    buildOkSheet(wb, body.matched ?? [])
    buildDivergentSheet(wb, body.divergent ?? [])
    buildPendingSheet(wb, body.pending ?? [])

    const buffer = await wb.xlsx.writeBuffer()

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
