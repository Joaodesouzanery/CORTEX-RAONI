import type { Metadata } from 'next'
import { IBM_Plex_Mono, Manrope, Space_Grotesk } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/layout/Navbar'
import SiteFooter from '@/components/layout/SiteFooter'
import { Toaster } from '@/components/ui/toaster'

// Manrope: geométrica e legível em títulos grandes, no espírito do modelo de referência.
const manrope = Manrope({ subsets: ['latin'], variable: '--font-sans' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' })

export const metadata: Metadata = {
  title: 'CORTEX — Inteligência de Comunicação',
  description: 'Inteligência de notícias, reputação e comunicação estratégica.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${manrope.variable} ${plexMono.variable} ${spaceGrotesk.variable} font-sans`}>
        <Navbar />
        <main className="min-h-screen bg-white">{children}</main>
        <SiteFooter />
        <Toaster />
      </body>
    </html>
  )
}
