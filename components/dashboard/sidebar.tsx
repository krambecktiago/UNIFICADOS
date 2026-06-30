'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// Altura compartilhada entre o cabeçalho da sidebar e o cabeçalho do conteúdo
// Garante que as duas áreas fiquem visualmente alinhadas na mesma linha horizontal
const HEADER_H = 'h-[68px]'

const navItems = [
  {
    href: '/dashboard',
    exact: true,
    label: 'Dashboard',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: '/dashboard/ferramentas',
    exact: false,
    label: 'Ferramentas',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/ia',
    exact: false,
    label: 'Análise IA',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/configuracoes',
    exact: false,
    label: 'Configurações',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-64 shrink-0 flex flex-col h-screen sticky top-0 bg-[#0d1e45]">

      {/* ── Logo Krambeck ────────────────────────────────────────────────── */}
      {/* Altura fixa igual ao cabeçalho do conteúdo (68px) */}
      <div className={`${HEADER_H} bg-white flex items-center justify-center px-6 border-b-2 border-[#c8102e]`}>
        <Image
          src="/logo-krambeck.png"
          alt="Krambeck Autopeças e Tintas"
          width={156}
          height={45}
          className="object-contain max-w-full"
          priority
        />
      </div>

      {/* ── Badge Rede Ancora ────────────────────────────────────────────── */}
      <div className="h-10 flex items-center gap-2.5 px-5 bg-[#09173a] border-b border-[#1c3168]">
        <Image
          src="/logo-ancora.png"
          alt="Rede Ancora"
          width={22}
          height={22}
          className="object-contain shrink-0"
        />
        <span className="text-[11px] font-semibold tracking-widest uppercase text-slate-500">
          Rede Ancora
        </span>
      </div>

      {/* ── Rótulo de seção ─────────────────────────────────────────────── */}
      <div className="px-5 pt-6 pb-3">
        <span className="text-[10px] font-bold tracking-widest uppercase text-[#3a5080]">
          Menu
        </span>
      </div>

      {/* ── Navegação ───────────────────────────────────────────────────── */}
      {/* Todos os itens têm h-10 + px-3 para ritmo idêntico */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 h-10 px-3 rounded-lg text-sm font-medium transition-colors border-l-2',
                active
                  ? 'bg-white/10 border-[#c8102e] text-white'
                  : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200'
              )}
            >
              <span className={cn('flex items-center', active && 'text-red-400')}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* ── Rodapé / Sair ───────────────────────────────────────────────── */}
      <div className="px-3 py-3 border-t border-[#1c3168]">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 h-10 px-3 rounded-lg text-sm font-medium border-l-2 border-transparent text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
          Sair
        </button>
      </div>
    </aside>
  )
}
