import type { Metadata } from 'next'
import LandingPage from '@/components/landing/LandingPage'

export const metadata: Metadata = {
  title: 'CORTEX — Inteligência de Comunicação',
  description:
    'Inteligência de notícias e reputação para antecipar riscos, revelar oportunidades e orientar decisões estratégicas.',
}

export default function Home() {
  return <LandingPage />
}
