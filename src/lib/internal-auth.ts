export function internalAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production'
  return req.headers.get('authorization') === `Bearer ${secret}`
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
