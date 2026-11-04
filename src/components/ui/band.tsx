import { cn } from '@/lib/utils'

// Faixa de largura total do padrão Maersk: as seções alternam branco e cinza
// para separar blocos sem bordas. O conteúdo fica numa coluna central.
export function Band({
  tone = 'white',
  className,
  innerClassName,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { tone?: 'white' | 'gray' | 'brand'; innerClassName?: string }) {
  return (
    <section
      className={cn(
        'w-full py-10 md:py-14',
        tone === 'gray' && 'bg-neutral-100',
        tone === 'white' && 'bg-white',
        tone === 'brand' && 'bg-[hsl(var(--brand))] text-white',
        className
      )}
      {...props}
    >
      <div className={cn('mx-auto max-w-7xl px-4 md:px-8', innerClassName)}>{children}</div>
    </section>
  )
}
