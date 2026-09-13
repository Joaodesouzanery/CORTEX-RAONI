import { bearerMatches } from '@/lib/constant-time'

/**
 * Autoriza as rotas de worker (`/api/internal/**`).
 *
 * Antes devolvia `true` quando CRON_SECRET não estava configurado e
 * NODE_ENV !== 'production' — ou seja, ABERTO em dev e em teste. Isso só não
 * era explorável porque o middleware devolve 503 antes; bastava uma edição no
 * matcher para virar bypass real. Segredo ausente agora nega sempre.
 */
export function internalAuthorized(req: Request): boolean {
  return bearerMatches(req.headers.get('authorization'), process.env.CRON_SECRET)
}

export async function dispatchMonthlyWorkflow(input: {
  editionIds: string[]
  period: string
}): Promise<{ dispatched: boolean; error?: string }> {
  const token = process.env.GITHUB_ACTIONS_TOKEN
  const repository = process.env.GITHUB_REPOSITORY
  if (!token || !repository) {
    return { dispatched: false, error: 'GITHUB_ACTIONS_TOKEN/GITHUB_REPOSITORY não configurados.' }
  }
  const res = await fetch(
    `https://api.github.com/repos/${repository}/actions/workflows/monthly-clipping.yml/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: process.env.GITHUB_WORKFLOW_REF || 'main',
        inputs: { edition_ids: input.editionIds.join(','), period: input.period },
      }),
    }
  )
  if (!res.ok) {
    return { dispatched: false, error: `GitHub Actions HTTP ${res.status}: ${(await res.text()).slice(0, 300)}` }
  }
  return { dispatched: true }
}
