import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Return config that the frontend needs
  return res.json({
    hasClientId: !!process.env.CLIO_CLIENT_ID,
    hasAccessToken: !!process.env.CLIO_ACCESS_TOKEN,
    baseUrl: process.env.CLIO_BASE_URL || 'https://app.clio.com',
  });
}
