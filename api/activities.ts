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

  const { since, type } = req.query
  const typeStr = typeof type === 'string' ? type : ''

  const params = new URLSearchParams()
  if (typeof since === 'string' && since) params.set('since', since)

  const usePayments = typeStr.toLowerCase() === 'payment'
  const endpoint = usePayments ? 'payments.json' : 'activities.json'
  const baseUrl = `${CLIO_BASE_URL}/${endpoint}`
  const targetUrl = `${baseUrl}?${params.toString()}`

  console.log('[API][activities] → Forwarding to Clio:', targetUrl, 'type=', typeStr || '(none)')
  console.log('[API][activities] → Token:', maskToken(bearer.replace('Bearer ', '')))

  try {
    const resp = await fetch(targetUrl, {
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
      console.error('[API][activities] ✗ Clio error', resp.status, data)
      return res.status(resp.status).json({ error: 'Clio error', details: data })
    }

    const rawItems = Array.isArray(data?.data) ? data.data : []

    // Normalize to { id, date, total, type }
    const items = rawItems.map((item: any) => {
      if (usePayments) {
        const total = typeof item.total === 'number' ? item.total
          : typeof item.amount === 'number' ? item.amount
          : (typeof item.amount_cents === 'number' ? item.amount_cents / 100 : 0)
        const date = item.date || item.applied_at || item.received_at || item.created_at || null
        return { id: item.id, date, total, type: 'Payment' }
      }
      // Fallback passthrough for non-payment activities
      const total = typeof item.total === 'number' ? item.total : 0
      const date = item.date || item.created_at || null
      const typeVal = item.type || typeStr || 'Activity'
      return { id: item.id, date, total, type: typeVal }
    })

    console.log('[API][activities] ✓ OK', { status: resp.status, count: items.length, usePayments })

    return res.status(200).json({ data: items })
  } catch (err: any) {
    console.error('[API][activities] ✗ Exception', err)
    return res.status(500).json({ error: 'Internal error', details: err?.message || String(err) })
  }
}
