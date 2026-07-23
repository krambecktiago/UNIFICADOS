export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

const TIMEZONE_BR = 'America/Sao_Paulo'

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: TIMEZONE_BR,
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIMEZONE_BR,
  }).format(new Date(date))
}

export function toDateKey(date: string | Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: TIMEZONE_BR,
  }).format(new Date(date))
}

export function formatDayLabel(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: TIMEZONE_BR,
  }).format(new Date(date))
}

export function formatRelativeTime(date: string | Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(date).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'agora mesmo'
  if (diffMin < 60) return `há ${diffMin} min`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `há ${diffHours}h`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `há ${diffDays}d`
  return formatDateTime(date)
}

// Servidor roda em UTC (Vercel) — sempre calcular a hora no fuso de Brasília,
// senão a saudação vira "Boa noite" de manhã.
export function getGreeting(date: Date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: TIMEZONE_BR }).format(date)
  )
  if (hour >= 5 && hour < 12) return 'Bom dia'
  if (hour >= 12 && hour < 18) return 'Boa tarde'
  return 'Boa noite'
}
