export function parseBRL(val: unknown): number {
  if (typeof val === 'number') {
    return isFinite(val) ? val : 0
  }
  if (!val) return 0

  let s = String(val).trim().replace(/^R\$\s*/i, '').replace(/\s+/g, '')
  if (!s) return 0

  const hasComma = s.includes(',')
  const hasDot = s.includes('.')

  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // Formato brasileiro: 1.234,56
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      // Formato internacional: 1,234.56
      s = s.replace(/,/g, '')
    }
  } else if (hasComma) {
    // Apenas vírgula decimal: 208,49
    s = s.replace(',', '.')
  } else if (hasDot) {
    // Se for formato de milhar inteiro (ex: 1.000 ou 20.000)
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
      s = s.replace(/\./g, '')
    }
  }

  const num = parseFloat(s)
  return isNaN(num) ? 0 : num
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

// Alguns títulos são registrados com prefixo de letra (ex: "X20001052.1"),
// que a extração do TXT do ERP ignora ao capturar só os dígitos via regex.
// Sem remover aqui também as letras de cada parte, o retorno bancário gera
// uma chave diferente ("NaN.1") e a duplicata nunca casa com o ERP.
export function normDup(dup: string): string {
  let s = String(dup).trim()
  const slashIdx = s.lastIndexOf('/')
  if (slashIdx !== -1) s = s.slice(slashIdx + 1)
  const parts = s.split('.')
  if (parts.length < 2) return s
  const intPart = (parseInt(parts[0].replace(/\D/g, ''), 10) || 0).toString()
  const decPart = (parseInt(parts[1].replace(/\D/g, ''), 10) || 0).toString()
  return `${intPart}.${decPart}`
}

export function parseDataBR(str: string): Date | null {
  if (!str) return null
  const [d, m, y] = String(str).split('/')
  if (!d || !m || !y) return null
  const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
  return isNaN(dt.getTime()) ? null : dt
}
