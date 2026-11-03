'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const COLUMNS = [
  { title: 'Monitoramento', links: [['/news', 'Notícias'], ['/dashboard', 'Painel'], ['/sources', 'Fontes']] },
  { title: 'Entregáveis', links: [['/reports/prepare', 'Relatórios'], ['/bulletins', 'Boletim'], ['/monthly-editions', 'Clipping']] },
  { title: 'Regulação', links: [['/agenda', 'Agenda regulatória']] },
  { title: 'Cadastro', links: [['/clients', 'Clientes'], ['/imports', 'Importações']] },
] as const

export default function SiteFooter() {
  if (usePathname() === '/') return null
  return (
    <footer className="mt-16 border-t border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-screen-xl gap-8 px-6 py-10 sm:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map((column) => (
          <div key={column.title}>
            <h2 className="border-b border-slate-200 pb-2 text-sm font-medium text-slate-900">{column.title}</h2>
            <ul className="mt-3 grid gap-2 text-sm text-slate-600">
              {column.links.map(([href, label]) => <li key={href}><Link className="hover:text-slate-900" href={href}>{label}</Link></li>)}
            </ul>
          </div>
        ))}
      </div>
      <p className="mx-auto max-w-screen-xl px-6 pb-8 text-xs text-slate-500">Cortex · Suporte: neryadministrativo@gmail.com</p>
    </footer>
  )
}
