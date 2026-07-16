'use client'

import { useEffect, useState } from 'react'

interface CurrencyInputProps {
  value: number | null
  onChange: (value: number | null) => void
  className?: string
  placeholder?: string
}

function formatCentsToBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Máscara de moeda BR: digita só números, os 2 últimos são os centavos —
// mesmo comportamento dos campos de valor em apps bancários brasileiros.
export function CurrencyInput({ value, onChange, className, placeholder = 'R$ 0,00' }: CurrencyInputProps) {
  const [display, setDisplay] = useState(value != null ? formatCentsToBRL(Math.round(value * 100)) : '')

  // Sincroniza quando o valor é limpo/alterado de fora (ex: botão "Limpar").
  useEffect(() => {
    if (value == null) setDisplay('')
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '')
    if (digits === '') {
      setDisplay('')
      onChange(null)
      return
    }
    const cents = parseInt(digits, 10)
    setDisplay(formatCentsToBRL(cents))
    onChange(cents / 100)
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
    />
  )
}
