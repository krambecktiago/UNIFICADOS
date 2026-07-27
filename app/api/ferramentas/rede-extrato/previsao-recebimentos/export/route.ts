export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { createClient } from '@/lib/supabase/server'

interface BrandTotal {
  code: number
  label: string
  liquido: number
  count: number
}

interface PrevisaoMetrics {
  totalBruto: number
  totalMdr: number
  totalLiquido: number
  recebidoAteHoje: number
  aReceber: number
}

interface PrevisaoResumo {
  periodoLabel: string
  geral: PrevisaoMetrics
  porBandeira: BrandTotal[]
  porEmpresa: (PrevisaoMetrics & { companyNumber: string; label: string })[]
}

const NAVY = 'FF0D1E45'
const CURRENCY_FMT = '"R$" #,##0.00'
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' } }

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const body = (await request.json()) as PrevisaoResumo
    if (!body?.periodoLabel) {
      return NextResponse.json({ error: 'Dados da previsão ausentes.' }, { status: 400 })
    }

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Ferramentas Unificadas Krambeck'
    wb.created = new Date()

    const ws = wb.addWorksheet('Previsão de Recebimentos', { views: [{ showGridLines: false }] })
    ws.columns = [{ width: 3 }, { width: 32 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }]

    ws.mergeCells('A1:D1')
    const title = ws.getCell('A1')
    title.value = 'KRAMBECK — Previsão de Recebimentos Rede'
    title.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } }
    title.fill = HEADER_FILL
    title.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    ws.getRow(1).height = 30

    ws.mergeCells('A2:D2')
    const subtitle = ws.getCell('A2')
    subtitle.value = `Referente ao período de ${body.periodoLabel} — gerado em ${new Date().toLocaleString('pt-BR')}`
    subtitle.font = { italic: true, size: 10, color: { argb: 'FF6B7280' } }
    subtitle.alignment = { indent: 1 }

    const headerRow = ws.getRow(4)
    headerRow.values = ['', 'Métrica', 'Valor']
    headerRow.font = HEADER_FONT
    headerRow.eachCell(cell => { cell.fill = HEADER_FILL })
    headerRow.height = 20

    const metrics: { label: string; valor: number }[] = [
      { label: 'Total bruto', valor: body.geral.totalBruto },
      { label: 'Total em taxas (MDR)', valor: body.geral.totalMdr },
      { label: 'Total líquido', valor: body.geral.totalLiquido },
      { label: 'Recebido até hoje', valor: body.geral.recebidoAteHoje },
      { label: 'A receber', valor: body.geral.aReceber },
    ]

    metrics.forEach((m, i) => {
      const r = ws.getRow(5 + i)
      r.getCell(2).value = m.label
      r.getCell(3).value = m.valor
      r.getCell(3).numFmt = CURRENCY_FMT
      r.eachCell(cell => { cell.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } } })
    })

    const brandHeaderRowIdx = 5 + metrics.length + 1
    ws.mergeCells(`B${brandHeaderRowIdx}:D${brandHeaderRowIdx}`)
    ws.getCell(`B${brandHeaderRowIdx}`).value = 'Total líquido por bandeira'
    ws.getCell(`B${brandHeaderRowIdx}`).font = { bold: true }

    const brandTableHeaderIdx = brandHeaderRowIdx + 1
    const brandTableHeader = ws.getRow(brandTableHeaderIdx)
    brandTableHeader.values = ['', 'Bandeira', 'Valor líquido', 'Qtd. parcelas']
    brandTableHeader.font = HEADER_FONT
    brandTableHeader.eachCell(cell => { cell.fill = HEADER_FILL })
    brandTableHeader.height = 20

    ;(body.porBandeira ?? []).forEach((b, i) => {
      const r = ws.getRow(brandTableHeaderIdx + 1 + i)
      r.getCell(2).value = b.label
      r.getCell(3).value = b.liquido
      r.getCell(3).numFmt = CURRENCY_FMT
      r.getCell(4).value = b.count
      r.eachCell(cell => { cell.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } } })
    })

    const porEmpresa = body.porEmpresa ?? []
    if (porEmpresa.length > 1) {
      const brandRowCount = (body.porBandeira ?? []).length
      const empresaHeaderRowIdx = brandTableHeaderIdx + brandRowCount + 2
      ws.mergeCells(`B${empresaHeaderRowIdx}:G${empresaHeaderRowIdx}`)
      ws.getCell(`B${empresaHeaderRowIdx}`).value = 'Por estabelecimento'
      ws.getCell(`B${empresaHeaderRowIdx}`).font = { bold: true }

      const empresaTableHeaderIdx = empresaHeaderRowIdx + 1
      const empresaTableHeader = ws.getRow(empresaTableHeaderIdx)
      empresaTableHeader.values = ['', 'Estabelecimento', 'Bruto', 'MDR', 'Líquido', 'Recebido até hoje', 'A receber']
      empresaTableHeader.font = HEADER_FONT
      empresaTableHeader.eachCell(cell => { cell.fill = HEADER_FILL })
      empresaTableHeader.height = 20

      porEmpresa.forEach((emp, i) => {
        const r = ws.getRow(empresaTableHeaderIdx + 1 + i)
        r.getCell(2).value = emp.label
        r.getCell(3).value = emp.totalBruto
        r.getCell(3).numFmt = CURRENCY_FMT
        r.getCell(4).value = emp.totalMdr
        r.getCell(4).numFmt = CURRENCY_FMT
        r.getCell(5).value = emp.totalLiquido
        r.getCell(5).numFmt = CURRENCY_FMT
        r.getCell(6).value = emp.recebidoAteHoje
        r.getCell(6).numFmt = CURRENCY_FMT
        r.getCell(7).value = emp.aReceber
        r.getCell(7).numFmt = CURRENCY_FMT
        r.eachCell(cell => { cell.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } } })
      })
    }

    const buffer = await wb.xlsx.writeBuffer()

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="previsao-recebimentos-rede.xlsx"',
      },
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Erro ao gerar planilha.' }, { status: 500 })
  }
}
