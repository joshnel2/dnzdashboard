import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  return res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Test endpoint working',
    env: {
      CLIO_BASE_URL: process.env.CLIO_BASE_URL || 'NOT SET',
      hasClientId: !!process.env.CLIO_CLIENT_ID,
      hasClientSecret: !!process.env.CLIO_CLIENT_SECRET
    }
  });
}
