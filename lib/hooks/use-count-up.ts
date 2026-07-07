'use client'

import { useEffect, useRef, useState } from 'react'

// Sobe suavemente até o valor final ao montar ou quando o valor muda —
// usado nos KPI cards para dar uma sensação de "dado vivo" em vez de números
// estáticos aparecendo de uma vez. Respeita prefers-reduced-motion.
export function useCountUp(target: number, durationMs = 600): number {
  const [value, setValue] = useState(target)
  const prevTarget = useRef<number | null>(null)

  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const from = prevTarget.current ?? 0
    prevTarget.current = target

    if (reduceMotion || from === target) {
      setValue(target)
      return
    }

    let frame: number
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(from + (target - from) * eased)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs])

  return value
}
