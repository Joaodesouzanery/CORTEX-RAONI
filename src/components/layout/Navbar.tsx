'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import CortexLogo from '@/components/brand/CortexLogo'

export default function Navbar() {
  const pathname = usePathname()
  if (pathname === '/') return null

  // Ordem: uso diário -> ocasional -> configuração.
  //
  // "Preparação" (/reports/prepare) entra no lugar de Relatórios e Fechamentos:
  // é o workspace real — destino de TODOS os links profundos do app (Painel,
  // card de cliente, Importações, Notícias) — e estava invisível no menu,
  // enquanto /reports era uma folha cuja única ação é subir para a Preparação e
  // /monthly-editions não tinha nenhum link de entrada além do próprio menu.
  // Os dois seguem alcançáveis pelos botões dentro da Preparação.
  //
  // Alertas saiu: virou a faixa "Sinais" dentro de Notícias.
  const links = [
    { href: '/news', label: 'Notícias' },
    { href: '/clipping', label: 'Clipping' },
    { href: '/reports/prepare', label: 'Relatórios' },
    { href: '/bulletins', label: 'Boletins' },
    { href: '/agenda', label: 'Agenda' },
  ]

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-screen-xl flex-wrap items-center justify-between gap-3 px-6 pt-3">
        <Link href="/news" aria-label="CORTEX — notícias" className="transition-opacity hover:opacity-70">
          <CortexLogo size="compact" />
        </Link>
        <div className="flex flex-wrap items-center gap-5 text-sm text-slate-600">
          <Link href="/dashboard" className="hover:text-slate-900">Painel</Link>
          <Link href="/sources" className="hover:text-slate-900">Fontes e clientes</Link>
          <Link href="/imports" className="hover:text-slate-900">Importações</Link>
          <a href="mailto:neryadministrativo@gmail.com" className="hover:text-slate-900">Suporte</a>
        </div>
      </div>
      <div className="mx-auto flex max-w-screen-xl flex-wrap items-center gap-x-7 gap-y-1 px-6 pb-2 pt-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'border-b-2 py-1 text-[15px] transition-colors',
              // Prefixo puro acenderia "Relatórios" em /reports/prepare. Com a
              // barra o casamento é por segmento de rota, não por string.
              pathname === link.href || pathname.startsWith(`${link.href}/`)
                ? 'border-sky-600 text-slate-900'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            )}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
