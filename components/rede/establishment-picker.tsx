'use client'

import { useEffect, useRef, useState } from 'react'

export interface RedeEstablishment {
  companyNumber: string
  name?: string
}

export function establishmentLabel(e: RedeEstablishment): string {
  return e.name ? `${e.name} (${e.companyNumber})` : e.companyNumber
}

const inputBase = 'w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-navy/30'

export function EstablishmentPicker({
  establishments,
  selected,
  onToggle,
  onClear,
}: {
  establishments: RedeEstablishment[]
  selected: string[]
  onToggle: (companyNumber: string) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function label(): string {
    if (selected.length === 0) return 'Todos os estabelecimentos'
    if (selected.length === 1) {
      const found = establishments.find(e => e.companyNumber === selected[0])
      return found ? establishmentLabel(found) : selected[0]
    }
    return `${selected.length} estabelecimentos selecionados`
  }

  return (
    <div className="relative" ref={ref}>
      <label className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Estabelecimento</label>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={inputBase + ' text-left flex items-center justify-between gap-2 min-w-[200px]'}
      >
        <span className="truncate">{label()}</span>
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 shrink-0 text-gray-400 dark:text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full min-w-[240px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto">
          <label className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
            <input type="checkbox" checked={selected.length === 0} onChange={onClear} className="rounded border-gray-300 dark:border-gray-600" />
            Todos os estabelecimentos
          </label>
          <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
          {establishments.map(e => (
            <label key={e.companyNumber} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
              <input type="checkbox" checked={selected.includes(e.companyNumber)} onChange={() => onToggle(e.companyNumber)} className="rounded border-gray-300 dark:border-gray-600" />
              {establishmentLabel(e)}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
