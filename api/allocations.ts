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

  const { since, start_date, end_date, page, per_page, fields, bill_id } = req.query
  const params = new URLSearchParams()
  if (typeof since === 'string' && since) params.set('since', since)
  if (typeof start_date === 'string' && start_date) params.set('start_date', start_date)
  if (typeof end_date === 'string' && end_date) params.set('end_date', end_date)
  if (typeof page === 'string' && page) params.set('page', page)
  if (typeof per_page === 'string' && per_page) params.set('per_page', per_page)
  if (typeof fields === 'string' && fields) params.set('fields', fields)
  if (typeof bill_id === 'string' && bill_id) params.set('bill_id', bill_id)

  const url = `${CLIO_BASE_URL}/allocations.json?${params.toString()}`

  console.log('[API][allocations] → Forwarding to Clio:', url)
  console.log('[API][allocations] → Token:', maskToken(bearer.replace('Bearer ', '')))

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
      console.error('[API][allocations] ✗ Clio error', resp.status, data)
      return res.status(resp.status).json({ error: 'Clio error', details: data })
    }

    const rawItems = Array.isArray(data?.data) ? data.data : []

    // Normalize to { id, date, total, type }
    const items = rawItems.map((item: any) => {
      const total = typeof item.amount === 'number' ? item.amount
        : typeof item.amount_cents === 'number' ? item.amount_cents / 100
        : typeof item.total === 'number' ? item.total
        : 0
      const date = item.applied_at || item.date || item.created_at || null
      return { id: item.id, date, total, type: 'Payment' }
    })

    console.log('[API][allocations] ✓ OK', { status: resp.status, count: items.length })

    return res.status(200).json({ data: items })
  } catch (err: any) {
    console.error('[API][allocations] ✗ Exception', err)
    return res.status(500).json({ error: 'Internal error', details: err?.message || String(err) })
  }
}
