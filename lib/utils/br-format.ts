export function parseBRL(str: unknown): number {
  if (!str) return 0
  return parseFloat(String(str).replace(/[R$\s.]/g, '').replace(',', '.')) || 0
}

// APIs externas (ex: Rede) às vezes omitem campos de valor em transações
// canceladas/negadas — sem o `?? 0` aqui, `undefined.toLocaleString()`
// derruba a tela inteira em vez de só mostrar R$ 0,00 na linha.
export function formatBRL(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function normText(str: unknown): string {
  return String(str ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .trim()
}

export function normDup(dup: string): string {
  let s = String(dup).trim()
  const slashIdx = s.lastIndexOf('/')
  if (slashIdx !== -1) s = s.slice(slashIdx + 1)
  const parts = s.split('.')
  if (parts.length < 2) return s
  const intPart = parseInt(parts[0], 10).toString()
  const decPart = parseInt(parts[1], 10).toString()
  return `${intPart}.${decPart}`
}

export function parseDataBR(str: string): Date | null {
  if (!str) return null
  const [d, m, y] = String(str).split('/')
  if (!d || !m || !y) return null
  const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
  return isNaN(dt.getTime()) ? null : dt
}
