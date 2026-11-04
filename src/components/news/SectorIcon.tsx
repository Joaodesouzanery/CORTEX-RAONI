// Ícones de traço simples por setor, desenhados inline: sem pacote de ícones e
// herdando a cor por `currentColor`.
const PATHS: Record<string, React.ReactNode> = {
  // Raio
  energia: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
  // Torre de petróleo com gota
  petroleo: (
    <>
      <path d="M8 22 12 3l4 19" />
      <path d="M9.5 15h5M10.5 10h3M6 22h12" />
      <path d="M19 6c0 1.1-.9 2-2 2s-2-.9-2-2c0-1.3 2-3.5 2-3.5S19 4.7 19 6Z" />
    </>
  ),
  // Gota
  agua: <path d="M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11Z" />,
  // Picareta
  mineracao: (
    <>
      <path d="M4 7c4-4 12-4 16 0" />
      <path d="M12 4.5 7 21" />
      <path d="M4 21h8" />
    </>
  ),
  // Navio
  transportes: (
    <>
      <path d="M3 15h18l-2.5 5h-13L3 15Z" />
      <path d="M6 15V9h12v6M10 9V5h4v4" />
    </>
  ),
  // Chip
  telecom: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4" />
    </>
  ),
  // Avião
  aviacao: <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5Z" />,
  // Cruz
  saude: <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z" />,
  // Claquete
  audiovisual: (
    <>
      <rect x="3" y="9" width="18" height="12" rx="1.5" />
      <path d="m3 9 2-5 16 2-1 3M8 4.5 9.5 8.5M13 5 14.5 9" />
    </>
  ),
}

export function SectorIcon({ sector, className, style }: { sector: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={style}>
      {PATHS[sector] ?? <circle cx="12" cy="12" r="8" />}
    </svg>
  )
}
