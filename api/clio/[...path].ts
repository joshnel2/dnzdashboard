import type { VercelRequest, VercelResponse } from '@vercel/node'

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {}
  return cookieHeader.split(';').reduce<Record<string, string>>((acc, part) => {
    const [rawKey, ...rest] = part.split('=')
    const key = rawKey.trim()
    const value = rest.join('=').trim()
    if (key) acc[key] = decodeURIComponent(value)
    return acc
  }, {})
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { path = [] } = req.query as { path?: string[] }
  const subPath = Array.isArray(path) ? path.join('/') : String(path || '')

  const baseUrl = process.env.CLIO_BASE_URL || process.env.VITE_CLIO_API_BASE_URL || 'https://app.clio.com/api/v4'

  const cookies = parseCookies(req.headers.cookie)
  const token = cookies['clio_access_token'] || process.env.CLIO_ACCESS_TOKEN || process.env.VITE_CLIO_API_KEY
  const tokenSource = cookies['clio_access_token']
    ? 'cookie'
    : process.env.CLIO_ACCESS_TOKEN
    ? 'env:CLIO_ACCESS_TOKEN'
    : process.env.VITE_CLIO_API_KEY
    ? 'env:VITE_CLIO_API_KEY'
    : 'none'

  if (!token) {
    console.warn('[Clio Proxy] Missing token', { subPath })
    return res.status(401).json({ error: 'Unauthorized', details: 'Missing Clio access token' })
  }

  const url = `${baseUrl.replace(/\/$/, '')}/${subPath}`

  try {
    const method = req.method || 'GET'

    // Build query string from req.query excluding our dynamic param
    const { path: _ignored, ...restQuery } = req.query as Record<string, any>
    console.log('[Clio Proxy] Incoming', {
      method,
      subPath,
      tokenSource,
      queryKeys: Object.keys(restQuery),
    })
    const searchParams = new URLSearchParams()
    Object.entries(restQuery).forEach(([k, v]) => {
      if (Array.isArray(v)) {
        v.forEach((vv) => searchParams.append(k, String(vv)))
      } else if (v !== undefined && v !== null) {
        searchParams.append(k, String(v))
      }
    })

    const finalUrl = searchParams.toString() ? `${url}?${searchParams.toString()}` : url
    console.log('[Clio Proxy] Forwarding', { finalUrl })

    // Prepare fetch options
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    }

    // Only forward Content-Type if present, to avoid interfering with GETs
    const contentType = req.headers['content-type']
    if (contentType && typeof contentType === 'string') {
      headers['Content-Type'] = contentType
    }

    const init: RequestInit = {
      method,
      headers,
    }

    if (method !== 'GET' && method !== 'HEAD' && req.body) {
      // req.body in Vercel runtime may be already parsed (object) or string
      init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    }

    const upstream = await fetch(finalUrl, init)
    console.log('[Clio Proxy] Upstream response', { status: upstream.status, ok: upstream.ok })
    const text = await upstream.text()

    // Forward status and body as-is; ensure JSON content type
    res.status(upstream.status)
    const ct = upstream.headers.get('content-type') || 'application/json; charset=utf-8'
    res.setHeader('Content-Type', ct)
    res.send(text)
  } catch (error: any) {
    console.error('[Clio Proxy] Error', { message: error?.message || String(error) })
    res.status(500).json({ error: 'Proxy request failed', details: error?.message || String(error) })
  }
}
