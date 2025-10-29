import type { VercelRequest, VercelResponse } from '@vercel/node'

const CLIO_BASE_URL = process.env.CLIO_BASE_URL || 'https://app.clio.com/api/v4'

function maskToken(token?: string | null) {
  if (!token) return 'NO_TOKEN'
  if (token.length <= 10) return '***'
  return `${token.slice(0, 5)}...${token.slice(-5)}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const authHeader = req.headers.authorization || ''
  const bearer = authHeader.startsWith('Bearer ')
    ? authHeader
    : (process.env.CLIO_ACCESS_TOKEN ? `Bearer ${process.env.CLIO_ACCESS_TOKEN}` : '')

  if (!bearer) {
    return res.status(401).json({ error: 'Missing Authorization token' })
  }

  const { since, start_date, end_date, page, per_page, fields } = req.query
  const params = new URLSearchParams()
  // Support either since or explicit start/end dates
  if (typeof since === 'string' && since) params.set('since', since)
  if (typeof start_date === 'string' && start_date) params.set('start_date', start_date)
  if (typeof end_date === 'string' && end_date) params.set('end_date', end_date)
  if (typeof page === 'string' && page) params.set('page', page)
  if (typeof per_page === 'string' && per_page) params.set('per_page', per_page)
  if (typeof fields === 'string' && fields) params.set('fields', fields)

  const url = `${CLIO_BASE_URL}/time_entries?${params.toString()}`

  console.log('[API][timeentries] → Forwarding to Clio:', url)
  console.log('[API][timeentries] → Token:', maskToken(bearer.replace('Bearer ', '')))

  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: bearer,
        'Content-Type': 'application/json',
      },
    })

    const text = await resp.text()
    let data: any
    try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text } }

    if (!resp.ok) {
      console.error('[API][timeentries] ✗ Clio error', resp.status, data)
      return res.status(resp.status).json({ error: 'Clio error', details: data })
    }

    const items = Array.isArray(data?.data) ? data.data : []
    console.log('[API][timeentries] ✓ OK', { status: resp.status, count: items.length })

    return res.status(200).json({ data: items })
  } catch (err: any) {
    console.error('[API][timeentries] ✗ Exception', err)
    return res.status(500).json({ error: 'Internal error', details: err?.message || String(err) })
  }
}
