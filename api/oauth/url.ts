import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const clientId = process.env.VITE_CLIO_CLIENT_ID;
  // Use explicit redirect URI from env var, fallback to VERCEL_URL, then localhost
  const redirectUri = process.env.VITE_CLIO_REDIRECT_URI || 
                      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api/oauth/callback` : 'http://localhost:3000/api/oauth/callback');

  if (!clientId) {
    return res.status(500).json({ error: 'Client ID not configured' });
  }

  const authUrl = `https://app.clio.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return res.json({ authUrl });
}
