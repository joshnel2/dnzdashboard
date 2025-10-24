import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Use CLIO_* environment variables exclusively
  const clientId = process.env.CLIO_CLIENT_ID;
  const baseUrl = (process.env.CLIO_BASE_URL || 'https://app.clio.com').replace(/\/$/, '');
  const redirectUri = process.env.CLIO_REDIRECT_URI || 
                      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api/oauth/callback` : 'http://localhost:3000/api/oauth/callback');

  if (!clientId) {
    return res.status(500).json({ error: 'Client ID not configured' });
  }

  const scope = encodeURIComponent('read:time_entries read:activities read:users');
  const authUrl = `${baseUrl}/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`;

  return res.json({ authUrl });
}
