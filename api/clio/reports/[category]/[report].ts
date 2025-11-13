import axios, { AxiosError } from 'axios'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const DEFAULT_CLIO_BASE_URL = 'https://app.clio.com/api/v4'
const DEFAULT_ALLOWED_ORIGIN = '*'

const getSingleValue = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) {
    return value[0]
  }
  return value
}

const normalizeReportParam = (reportParam: string) => {
  const lastDotIndex = reportParam.lastIndexOf('.')

  if (lastDotIndex === -1) {
    return { reportName: reportParam, format: 'csv' as const }
  }

  const reportName = reportParam.substring(0, lastDotIndex)
  const format = reportParam.substring(lastDotIndex + 1).toLowerCase()

  if (format !== 'csv' && format !== 'json') {
    return { reportName: reportParam, format: 'csv' as const }
  }

  return { reportName, format }
}

const buildQueryParams = (req: VercelRequest): Record<string, string | string[]> => {
  const params: Record<string, string | string[]> = {}

  Object.entries(req.query).forEach(([key, value]) => {
    if (key === 'category' || key === 'report') {
      return
    }

    if (typeof value === 'undefined') {
      return
    }

    params[key] = value
  })

  return params
}

const setCorsHeaders = (res: VercelResponse) => {
  const allowedOrigin = process.env.CLIO_PROXY_ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type')
  res.setHeader('Access-Control-Max-Age', '86400')
}

const getAuthorizationHeader = (req: VercelRequest): string | undefined => {
  const directHeader = req.headers.authorization
  if (directHeader && directHeader.startsWith('Bearer ')) {
    return directHeader
  }

  const tokenHeader = req.headers['x-clio-access-token']
  if (typeof tokenHeader === 'string' && tokenHeader.trim().length > 0) {
    return `Bearer ${tokenHeader.trim()}`
  }

  return undefined
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET,OPTIONS')
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const categoryParam = getSingleValue(req.query.category)
  const reportParam = getSingleValue(req.query.report)

  if (!categoryParam || !reportParam) {
    res.status(400).json({ error: 'Missing report category or name' })
    return
  }

  const { reportName, format } = normalizeReportParam(reportParam)
  const authHeader = getAuthorizationHeader(req)

  if (!authHeader) {
    res.status(401).json({ error: 'Authorization bearer token required' })
    return
  }

  const clioBaseUrl = process.env.CLIO_BASE_URL || DEFAULT_CLIO_BASE_URL
  const encodedCategory = encodeURIComponent(categoryParam)
  const encodedReport = encodeURIComponent(reportName)
  const targetUrl = `${clioBaseUrl}/reports/${encodedCategory}/${encodedReport}.${format}`

  const params = buildQueryParams(req)

  try {
    const response = await axios.get<string>(targetUrl, {
      params,
      responseType: format === 'csv' ? 'text' : 'json',
      headers: {
        Authorization: authHeader,
        Accept: format === 'csv' ? 'text/csv' : 'application/json',
      },
    })

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.status(200).send(response.data)
      return
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.status(200).json(response.data)
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError
      const status = axiosError.response?.status ?? 500
      const details = axiosError.response?.data ?? axiosError.message

      res.status(status).json({
        error: 'Failed to fetch Clio report',
        details,
      })
      return
    }

    res.status(500).json({
      error: 'Unexpected error fetching Clio report',
    })
  }
}
