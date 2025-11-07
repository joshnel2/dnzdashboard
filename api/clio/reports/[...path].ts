import type { VercelRequest, VercelResponse } from '@vercel/node'

const DEFAULT_BASE_URL = 'https://app.clio.com/api/v4'

const buildBaseUrl = (): string => {
  const configured =
    process.env.CLIO_REPORTS_BASE_URL ||
    process.env.CLIO_BASE_URL ||
    process.env.CLIO_API_BASE_URL ||
    process.env.VITE_CLIO_API_BASE_URL ||
    ''

  let base = configured.trim()
  if (!base) {
    base = DEFAULT_BASE_URL
  }

  if (!/^https?:\/\//i.test(base)) {
    base = `https://${base.replace(/^\/*/, '')}`
  }

  base = base.replace(/\/+$/, '')

  if (!/\/api\/v4$/i.test(base)) {
    base = `${base}/api/v4`
  }

  return base
}

const normalizeAuthorizationHeader = (req: VercelRequest): string | undefined => {
  const header = req.headers.authorization || req.headers.Authorization
  if (!header) {
    const token = process.env.CLIO_ACCESS_TOKEN
    return token ? `Bearer ${token}` : undefined
  }

  const value = Array.isArray(header) ? header[0] : header
  if (!value) {
    return undefined
  }

  if (/^Bearer\s+/i.test(value)) {
    return value
  }

  return `Bearer ${value}`
}

const appendQueryParams = (url: URL, query: VercelRequest['query']) => {
  Object.entries(query).forEach(([key, rawValue]) => {
    if (key === 'path') {
      return
    }

    if (Array.isArray(rawValue)) {
      rawValue.forEach((value) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value))
        }
      })
    } else if (rawValue !== undefined) {
      url.searchParams.append(key, String(rawValue))
    }
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const pathParam = req.query.path
  const pathSegments = Array.isArray(pathParam) ? pathParam : pathParam ? [pathParam] : []

  if (pathSegments.length === 0) {
    res.status(400).json({ error: 'Report path is required' })
    return
  }

  const authorization = normalizeAuthorizationHeader(req)
  if (!authorization) {
    res.status(401).json({ error: 'Missing Authorization header or access token' })
    return
  }

  try {
    const baseUrl = buildBaseUrl()
    const target = new URL(`/reports/${pathSegments.join('/')}`, baseUrl)
    appendQueryParams(target, req.query)

    const clioResponse = await fetch(target.toString(), {
      method: 'GET',
      headers: {
        Accept: 'text/csv, text/plain;q=0.9, */*;q=0.8',
        Authorization: authorization,
      },
    })

    const text = await clioResponse.text()

    if (!clioResponse.ok) {
      res
        .status(clioResponse.status)
        .send(text || `Failed to fetch report: ${clioResponse.status} ${clioResponse.statusText}`)
      return
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.status(200).send(text)
  } catch (error) {
    console.error('Error fetching Clio report CSV', error)
    res.status(500).json({ error: 'Failed to fetch report CSV' })
  }
}
