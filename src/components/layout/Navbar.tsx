'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export default function Navbar() {
  const pathname = usePathname()
  const links = [
    { href: '/dashboard', label: 'Painel' },
    { href: '/news', label: 'Notícias' },
    { href: '/alerts', label: 'Alertas' },
    { href: '/sources', label: 'Fontes' },
    { href: '/clients', label: 'Clientes' },
    { href: '/reports', label: 'Relatórios' },
  ]

  return (
    <nav className="border-b border-gray-200 bg-white sticky top-0 z-50">
      <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/news" className="text-xl font-bold tracking-widest uppercase">
          CORTEX
        </Link>
        <div className="flex items-center gap-8">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'text-sm uppercase tracking-wider transition-colors',
                pathname.startsWith(link.href)
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
