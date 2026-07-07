'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Gear, Wrench } from '@/components/decorative-icons'

// Altura compartilhada entre o cabeçalho da sidebar e o cabeçalho do conteúdo
// Garante que as duas áreas fiquem visualmente alinhadas na mesma linha horizontal
const HEADER_H = 'h-[68px]'

const adminNavItem = {
  href: '/dashboard/admin',
  exact: false,
  label: 'Administração',
  icon: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
}

const conexoesNavItem = {
  href: '/dashboard/admin/conexoes',
  exact: false,
  label: 'Conexões',
  icon: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  ),
}

const navItems = [
  {
    href: '/dashboard',
    exact: true,
    label: 'Dashboard',
    slug: 'dashboard',
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
    slug: null,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/configuracoes',
    exact: false,
    label: 'Configurações',
    slug: 'configuracoes',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-[18px] h-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

export function Sidebar({ isAdmin = false, accessibleScreens = [] }: { isAdmin?: boolean; accessibleScreens?: string[] }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-64 shrink-0 flex flex-col h-screen sticky top-0 bg-white relative overflow-hidden">

      {/* Fundo decorativo — peças automotivas, mesma identidade da tela de login */}
      <Gear className="absolute -top-10 -left-14 w-56 h-56 text-brand-navy opacity-[0.04] rotate-12 pointer-events-none" />
      <Gear className="absolute top-1/2 -right-14 w-48 h-48 text-brand-navy opacity-[0.04] -rotate-6 pointer-events-none" />
      <Wrench className="absolute bottom-24 -left-6 w-24 h-24 text-brand-navy opacity-[0.04] rotate-[30deg] pointer-events-none" />
      <Gear className="absolute -bottom-14 -right-10 w-44 h-44 text-brand-navy opacity-[0.04] rotate-45 pointer-events-none" />

      {/* ── Logo Krambeck ────────────────────────────────────────────────── */}
      <div className={`${HEADER_H} relative flex items-center justify-center px-6 border-b-2 border-brand-red`}>
        <Image
          src="/logo-krambeck.png"
          alt="Krambeck Autopeças e Tintas"
          width={156}
          height={45}
          className="object-contain max-w-full"
          unoptimized
          priority
        />
      </div>

      {/* ── Badge Rede Ancora ────────────────────────────────────────────── */}
      <div className="relative h-16 flex items-center justify-center bg-gray-50 border-b border-gray-100">
        <Image
          src="/logo-ancora.png"
          alt="Rede Ancora"
          width={59}
          height={45}
          className="object-contain shrink-0"
          unoptimized
        />
      </div>

      {/* ── Rótulo de seção ─────────────────────────────────────────────── */}
      <div className="relative px-5 pt-6 pb-3">
        <span className="text-[10px] font-bold tracking-widest uppercase text-gray-400">
          Menu
        </span>
      </div>

      {/* ── Navegação ───────────────────────────────────────────────────── */}
      {/* Todos os itens têm h-10 + px-3 para ritmo idêntico */}
      <nav className="relative flex-1 px-3 space-y-0.5">
        {navItems
          .filter((item) => !item.slug || isAdmin || accessibleScreens.includes(item.slug))
          .map((item) => {
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
                  ? 'bg-brand-navy/5 border-brand-navy text-brand-navy'
                  : 'border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-800'
              )}
            >
              <span className={cn('flex items-center', active && 'text-brand-navy')}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          )
        })}

        {/* Links de Administração e Conexões — visíveis apenas para admins */}
        {isAdmin && (
          <>
            <div className="pt-3 pb-1">
              <span className="text-[10px] font-bold tracking-widest uppercase text-gray-400">
                Sistema
              </span>
            </div>
            {[adminNavItem, conexoesNavItem].map((item) => {
              const active = item === adminNavItem
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 h-10 px-3 rounded-lg text-sm font-medium transition-colors border-l-2',
                    active
                      ? 'bg-brand-navy/5 border-brand-navy text-brand-navy'
                      : 'border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                  )}
                >
                  <span className={cn('flex items-center', active && 'text-brand-navy')}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* ── Rodapé / Sair ───────────────────────────────────────────────── */}
      <div className="relative px-3 py-3 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 h-10 px-3 rounded-lg text-sm font-medium border-l-2 border-transparent text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
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
