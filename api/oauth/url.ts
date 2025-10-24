import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Support both VITE_ and non-VITE_ prefixed env vars (Vercel serverless functions prefer non-VITE_)
  const clientId = process.env.CLIO_CLIENT_ID || process.env.VITE_CLIO_CLIENT_ID;
  const redirectUri = process.env.CLIO_REDIRECT_URI || 
                      process.env.VITE_CLIO_REDIRECT_URI || 
                      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api/oauth/callback` : 'http://localhost:3000/api/oauth/callback');

  if (!clientId) {
    console.warn('[CLIO][api][oauth/url] Missing clientId when generating auth URL');
    return res.status(500).json({ error: 'Client ID not configured' });
  }

  const authUrl = `https://app.clio.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  try {
    console.info('[CLIO][api][oauth/url] Generated auth URL', {
      method: req.method,
      hasClientId: !!clientId,
      clientIdLast4: clientId ? String(clientId).slice(-4) : null,
      redirectUri,
      vercelUrlSet: Boolean(process.env.VERCEL_URL),
      host: req.headers.host,
      forwardedProto: req.headers['x-forwarded-proto'] || 'unknown',
    });
  } catch (_e) {
    // avoid failing the request due to logging issues
  }
  return res.json({ authUrl });
}
