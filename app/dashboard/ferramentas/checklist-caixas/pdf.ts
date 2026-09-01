import { jsPDF } from 'jspdf'
import type { Section, PeriodTab, ItemState } from './data'
import { TAB_LABELS, itemId } from './data'

// jsPDF (fontes padrão, sem embutir fonte custom) não garante glifo pra
// travessão/aspas curvas — troca por equivalentes ASCII simples pra nunca
// sair um quadrado/vazio no lugar do caractere no PDF gerado.
function sanitizeForPdf(s: string): string {
  return s
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
}

interface ExportParams {
  nomeAvaliado: string
  loja: string
  tipo: PeriodTab
  sections: Section[]
  itens: Record<string, ItemState>
  criadoEm: string
  avaliadorNome?: string
}

export function exportEvaluationPdf({ nomeAvaliado, loja, tipo, sections, itens, criadoEm, avaliadorNome }: ExportParams) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const marginX = 18
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const maxWidth = pageWidth - marginX * 2
  let y = 20

  function ensureSpace(lines: number, lineHeight: number) {
    if (y + lines * lineHeight > pageHeight - 16) {
      doc.addPage()
      y = 20
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(sanitizeForPdf(`Avaliacao - ${nomeAvaliado}`), marginX, y)
  y += 8

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(110)
  const meta = [`Loja: ${loja}`, `Tipo: ${TAB_LABELS[tipo]}`, `Data: ${new Date(criadoEm).toLocaleString('pt-BR')}`]
  if (avaliadorNome) meta.push(`Avaliador: ${avaliadorNome}`)
  doc.text(sanitizeForPdf(meta.join('   |   ')), marginX, y)
  y += 10
  doc.setTextColor(0)

  const naoRespondidos: { secao: string; texto: string }[] = []

  sections.forEach((section, sIdx) => {
    ensureSpace(2, 6.5)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(sanitizeForPdf(section.title), marginX, y)
    y += 6.5

    section.items.forEach((text, iIdx) => {
      const state = itens[itemId(sIdx, iIdx)] ?? {}
      const mark = state.checked ? '[x]' : '[ ]'
      if (!state.checked) naoRespondidos.push({ secao: section.title, texto: text })

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      const lines = doc.splitTextToSize(sanitizeForPdf(`${mark} ${text}`), maxWidth - 4)
      ensureSpace(lines.length, 5)
      doc.text(lines, marginX + 4, y)
      y += lines.length * 5

      const comentario = state.comentario?.trim()
      if (comentario) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(9)
        doc.setTextColor(110)
        const commentLines = doc.splitTextToSize(sanitizeForPdf(`Comentario: ${comentario}`), maxWidth - 10)
        ensureSpace(commentLines.length, 4.5)
        doc.text(commentLines, marginX + 10, y)
        y += commentLines.length * 4.5
        doc.setTextColor(0)
      }
      y += 1.5
    })
    y += 3
  })

  y += 2
  ensureSpace(2, 7)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Quesitos nao respondidos', marginX, y)
  y += 7

  if (naoRespondidos.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(110)
    doc.text('Todos os itens foram conferidos.', marginX, y)
    y += 5
    doc.setTextColor(0)
  } else {
    naoRespondidos.forEach(({ secao, texto }) => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      const lines = doc.splitTextToSize(sanitizeForPdf(`- [${secao}] ${texto}`), maxWidth - 4)
      ensureSpace(lines.length, 5)
      doc.text(lines, marginX + 4, y)
      y += lines.length * 5 + 1
    })
  }

  doc.setFontSize(8)
  doc.setTextColor(150)
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, marginX, pageHeight - 10)

  const safeName = nomeAvaliado.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '-')
  doc.save(`avaliacao-${safeName || 'pessoa'}-${tipo}.pdf`)
}
