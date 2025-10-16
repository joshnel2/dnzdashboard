import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const redirectUri = process.env.VITE_CLIO_REDIRECT_URI || 
                      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api/oauth/callback` : 'http://localhost:3000/api/oauth/callback');
  
  return res.json({
    clientId: process.env.VITE_CLIO_CLIENT_ID ? '***' + process.env.VITE_CLIO_CLIENT_ID.slice(-4) : 'NOT SET',
    clientSecret: process.env.VITE_CLIO_CLIENT_SECRET ? '***SET***' : 'NOT SET',
    redirectUri: redirectUri,
    vercelUrl: process.env.VERCEL_URL || 'NOT SET',
    explicitRedirectUri: process.env.VITE_CLIO_REDIRECT_URI || 'NOT SET',
  });
}
