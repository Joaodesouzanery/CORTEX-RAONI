// Competência (YYYY-MM) de um instante, no fuso de São Paulo. `monthBounds`
// fecha o mês em -03:00; fatiar o ISO em UTC jogava matéria de 30/09 à noite
// (já 01/10 em UTC) para a competência errada.
export function saoPauloPeriodOf(instant: string | Date): string {
  const date = typeof instant === 'string' ? new Date(instant) : instant
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  return `${year}-${month}`
}
