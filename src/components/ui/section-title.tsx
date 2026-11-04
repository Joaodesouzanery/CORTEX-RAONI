import { cn } from '@/lib/utils'

// Título leve e grande, com linha de apoio opcional e ação à direita.
export function SectionTitle({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-end justify-between gap-4', className)}>
      <div>
        <h2 className="text-3xl font-light tracking-tight md:text-4xl">{title}</h2>
        {subtitle && <p className="mt-2 max-w-2xl text-sm text-neutral-600">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
