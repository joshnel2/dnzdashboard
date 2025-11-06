import type { VercelRequest, VercelResponse } from '@vercel/node'

const CLIO_API_BASE_URL = 'https://app.clio.com/api/v4'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || '*'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type')
    return res.status(204).end()
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET,OPTIONS')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authorization = req.headers.authorization

  if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' })
  }

  const { category, key, ...restQuery } = req.query

  if (typeof category !== 'string' || typeof key !== 'string') {
    return res.status(400).json({ error: 'category and key query parameters are required' })
  }

  const upstreamUrl = new URL(`${CLIO_API_BASE_URL}/reports/${encodeURIComponent(category)}/${encodeURIComponent(key)}.csv`)

  Object.entries(restQuery).forEach(([queryKey, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined) {
          upstreamUrl.searchParams.append(queryKey, item)
        }
      })
    } else if (value !== undefined) {
      upstreamUrl.searchParams.append(queryKey, value)
    }
  })

  try {
    const response = await fetch(upstreamUrl.toString(), {
      headers: {
        Authorization: authorization,
        Accept: 'text/csv',
      },
    })

    const text = await response.text()

    res.status(response.status)
    res.setHeader('Content-Type', response.headers.get('content-type') || 'text/csv')

    if (!response.ok) {
      return res.send(text)
    }

    return res.send(text)
  } catch (error) {
    console.error('Failed to proxy Clio report CSV', error)
    return res.status(500).json({ error: 'Failed to fetch report from Clio' })
  }
}
