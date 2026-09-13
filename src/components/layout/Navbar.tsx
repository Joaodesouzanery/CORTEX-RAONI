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
    { href: '/dashboard', label: 'Painel' },
    { href: '/news', label: 'Notícias' },
    { href: '/reports/prepare', label: 'Preparação' },
    { href: '/imports', label: 'Importações' },
    { href: '/clients', label: 'Clientes' },
    { href: '/sources', label: 'Fontes' },
  ]

  return (
    <nav className="border-b border-gray-200 bg-white sticky top-0 z-50">
      <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/news" aria-label="CORTEX — notícias" className="transition-opacity hover:opacity-70">
          <CortexLogo size="compact" />
        </Link>
        <div className="flex items-center gap-8">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'text-sm uppercase tracking-wider transition-colors',
                // Prefixo puro acenderia "Relatórios" em /reports/prepare. Com a
                // barra o casamento é por segmento de rota, não por string.
                pathname === link.href || pathname.startsWith(`${link.href}/`)
                  ? 'text-black font-semibold'
                  : 'text-gray-500 hover:text-black'
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
