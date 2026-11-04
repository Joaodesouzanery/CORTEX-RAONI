'use client'

import { useRef } from 'react'
import { cn } from '@/lib/utils'

// Carrossel horizontal com rolagem nativa e snap: funciona com toque, teclado e
// leitor de tela sem biblioteca. As setas só deslocam a rolagem.
export function Carousel({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  const track = useRef<HTMLDivElement>(null)
  const scroll = (direction: 1 | -1) => {
    const element = track.current
    if (element) element.scrollBy({ left: direction * element.clientWidth * 0.9, behavior: 'smooth' })
  }
  return (
    <div className={cn('relative', className)} role="region" aria-label={label}>
      <div className="mb-3 flex justify-end gap-2">
        <button type="button" onClick={() => scroll(-1)} aria-label="Anterior" className="focus-ring h-9 w-9 rounded-full border border-black bg-white text-lg leading-none hover:bg-black hover:text-white">‹</button>
        <button type="button" onClick={() => scroll(1)} aria-label="Próximo" className="focus-ring h-9 w-9 rounded-full border border-black bg-white text-lg leading-none hover:bg-black hover:text-white">›</button>
      </div>
      <div ref={track} className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {children}
      </div>
    </div>
  )
}

export function CarouselItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('w-[85%] shrink-0 snap-start sm:w-[45%] lg:w-[31%]', className)}>{children}</div>
}
