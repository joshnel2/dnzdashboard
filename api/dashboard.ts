import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ClioService } from '../src/services/clioService'

const clioServiceInstance = new ClioService()

const extractBearerToken = (req: VercelRequest): string | null => {
  const authHeader = req.headers.authorization || req.headers.Authorization
  if (typeof authHeader !== 'string') {
    return null
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}

const getEnvToken = (): string | null => {
  return (
    process.env.CLIO_ACCESS_TOKEN ||
    process.env.CLIO_API_TOKEN ||
    process.env.VITE_CLIO_API_KEY ||
    process.env.CLIO_API_KEY ||
    null
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method && req.method.toUpperCase() !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = extractBearerToken(req) || getEnvToken()

  if (!token) {
    return res.status(401).json({ error: 'Missing Clio access token' })
  }

  try {
    const data = await clioServiceInstance.getDashboardDataWithToken(token)
    return res.status(200).json(data)
  } catch (error: any) {
    const status = error?.response?.status

    if (status === 401) {
      return res.status(401).json({
        error: 'Unauthorized with Clio',
        details: error?.response?.data || error?.message || 'Unauthorized',
      })
    }

    console.error('Failed to generate dashboard data', error)

    return res.status(500).json({
      error: 'Failed to generate dashboard data',
      details: error?.message || 'Unknown error',
    })
  }
}
