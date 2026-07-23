'use client'

import { useEffect } from 'react'

const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000

// Fica montado no layout do dashboard inteiro (não desmonta em navegação
// client-side entre páginas) e avisa o servidor que o usuário está com o
// app aberto, a cada poucos minutos — alimenta profiles.last_seen_at.
export function PresenceHeartbeat() {
  useEffect(() => {
    function ping() {
      fetch('/api/profile/last-seen', { method: 'POST' }).catch(() => {})
    }

    ping()
    const id = setInterval(ping, HEARTBEAT_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  return null
}
