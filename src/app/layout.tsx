import type { Metadata } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/layout/Navbar'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' })

export const metadata: Metadata = {
  title: 'CORTEX — Inteligência de Comunicação',
  description: 'Inteligência de notícias, reputação e comunicação estratégica.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} ${spaceGrotesk.variable}`}>
        <Navbar />
        <main className="min-h-screen bg-white">{children}</main>
        <Toaster />
      </body>
    </html>
  )
}
