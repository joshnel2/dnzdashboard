import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Support both VITE_ and non-VITE_ prefixed env vars (Vercel serverless functions prefer non-VITE_)
  const clientId = process.env.CLIO_CLIENT_ID || process.env.VITE_CLIO_CLIENT_ID;
  const redirectUri = process.env.CLIO_REDIRECT_URI || 
                      process.env.VITE_CLIO_REDIRECT_URI || 
                      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api/oauth/callback` : 'http://localhost:3000/api/oauth/callback');

  if (!clientId) {
    return res.status(500).json({ error: 'Client ID not configured' });
  }

  // Request explicit scopes needed by the dashboard
  const scope = [
    'read:users',
    'read:activities',
    'read:time_entries',
    'read:payments',
    'read:bill_payments',
  ].join(' ')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    access_type: 'offline',
    prompt: 'consent',
  })

  const authUrl = `https://app.clio.com/oauth/authorize?${params.toString()}`;

  return res.json({ authUrl });
}
