'use client'

import { forwardRef, ReactNode } from 'react'

interface FileInputProps {
  label: ReactNode
  accept: string
  file: File | null
  onChange: (file: File | null) => void
  // Quando informado, mostra um botão "x" ao lado do input pra limpar sem
  // precisar do botão "Limpar" geral do formulário (útil quando há vários
  // arquivos e o usuário só quer trocar um).
  onClear?: () => void
}

export const FileInput = forwardRef<HTMLInputElement, FileInputProps>(function FileInput(
  { label, accept, file, onChange, onClear },
  ref
) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">{label}</label>
      <div className="flex gap-2 items-center">
        <input
          ref={ref}
          type="file"
          accept={accept}
          className="flex-1 min-w-0 block w-full text-sm text-gray-900 border border-gray-300 rounded-lg p-2 bg-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 cursor-pointer transition-colors hover:border-gray-400"
          onChange={e => onChange(e.target.files?.[0] ?? null)}
        />
        {file && onClear && (
          <button
            type="button"
            onClick={onClear}
            title="Remover arquivo"
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-400 hover:text-red-500 hover:border-red-300 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
      {file && <p className="text-xs text-gray-400 truncate animate-fade-in">{file.name}</p>}
    </div>
  )
})
