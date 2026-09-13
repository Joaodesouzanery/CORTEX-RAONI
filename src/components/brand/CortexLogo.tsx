import { cn } from '@/lib/utils'

export type CortexLogoProps = {
  variant?: 'light' | 'dark'
  size?: 'compact' | 'default' | 'large'
  symbolOnly?: boolean
  className?: string
}

const sizes = {
  compact: {
    wrapper: 'gap-2',
    symbol: 'h-5 w-5',
    wordmark: 'text-[15px]',
  },
  default: {
    wrapper: 'gap-2.5',
    symbol: 'h-6 w-6',
    wordmark: 'text-[18px]',
  },
  large: {
    wrapper: 'gap-3.5',
    symbol: 'h-9 w-9',
    wordmark: 'text-[28px]',
  },
} as const

export default function CortexLogo({
  variant = 'dark',
  size = 'default',
  symbolOnly = false,
  className,
}: CortexLogoProps) {
  const palette = variant === 'light' ? 'text-[#f3f4ef]' : 'text-[#123e33]'
  const dimensions = sizes[size]

  return (
    <span
      className={cn('inline-flex items-center', dimensions.wrapper, palette, className)}
      aria-label={symbolOnly ? 'CORTEX' : undefined}
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn('shrink-0', dimensions.symbol)}
        aria-hidden="true"
      >
        <path
          d="M25.75 8.15 20.9 3.3H11.1L4.25 10.15v11.7l6.85 6.85h9.8l4.85-4.85"
          stroke="currentColor"
          strokeWidth="3.1"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
        <path d="M21.35 10.7 17.95 7.3h-4.7l-4.1 4.1v9.2l4.1 4.1h4.7l3.4-3.4" stroke="currentColor" strokeWidth="1.7" />
        <path d="M21.25 16h6.5" stroke="currentColor" strokeWidth="3.1" />
      </svg>
      {!symbolOnly && (
        <span
          className={cn(
            'font-brand font-medium uppercase leading-none tracking-[-0.055em]',
            dimensions.wordmark
          )}
        >
          CORTEX
        </span>
      )}
    </span>
  )
}
