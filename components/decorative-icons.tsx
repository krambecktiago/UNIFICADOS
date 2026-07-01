export function Gear({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.3.07-.62.07-.93s-.03-.63-.07-1l2.08-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.58-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1s.03.65.07 1l-2.08 1.63c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66z" />
    </svg>
  )
}

export function Wrench({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" />
    </svg>
  )
}

// Fundo decorativo de peças automotivas — mesma identidade visual da tela de login.
// Visível apenas no tema escuro (no claro, o navy de fundo não existe).
export function BackgroundDecor({ position = 'absolute' }: { position?: 'absolute' | 'fixed' }) {
  return (
    <div className={`hidden dark:block ${position} inset-0 overflow-hidden pointer-events-none`}>
      <Gear className="absolute -top-16 -left-16 w-72 h-72 text-white opacity-[0.04] rotate-12" />
      <Gear className="absolute -bottom-20 -right-20 w-96 h-96 text-white opacity-[0.05] -rotate-6" />
      <Gear className="absolute top-1/2 -right-10 w-40 h-40 text-white opacity-[0.04] rotate-45" />
      <Gear className="absolute bottom-24 left-10 w-24 h-24 text-white opacity-[0.04] rotate-12" />
      <Wrench className="absolute top-16 right-20 w-28 h-28 text-white opacity-[0.04] rotate-[30deg]" />
      <Wrench className="absolute bottom-12 left-1/3 w-20 h-20 text-white opacity-[0.03] -rotate-[20deg]" />
    </div>
  )
}
