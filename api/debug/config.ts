import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const clientId = process.env.CLIO_CLIENT_ID || process.env.VITE_CLIO_CLIENT_ID;
  const clientSecret = process.env.CLIO_CLIENT_SECRET || process.env.VITE_CLIO_CLIENT_SECRET;
  const accessToken = process.env.CLIO_ACCESS_TOKEN;
  const redirectUri = process.env.CLIO_REDIRECT_URI || 
                      process.env.VITE_CLIO_REDIRECT_URI || 
                      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api/oauth/callback` : 'http://localhost:3000/api/oauth/callback');
  try {
    console.info('[CLIO][api][debug/config] Debug config requested', {
      method: req.method,
      host: req.headers.host,
      vercelUrl: process.env.VERCEL_URL || 'NOT SET',
      authMode: accessToken ? 'PERMANENT_TOKEN' : (clientId ? 'OAUTH' : 'NONE'),
      flags: {
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
        hasAccessToken: !!accessToken,
      },
    });
  } catch (_e) {
    // swallow logging errors
  }
  
  return res.json({
    clientId: clientId ? '***' + clientId.slice(-4) : 'NOT SET',
    clientSecret: clientSecret ? '***SET***' : 'NOT SET',
    accessToken: accessToken ? '***' + accessToken.slice(-4) : 'NOT SET',
    redirectUri: redirectUri,
    vercelUrl: process.env.VERCEL_URL || 'NOT SET',
    explicitRedirectUri: process.env.CLIO_REDIRECT_URI || process.env.VITE_CLIO_REDIRECT_URI || 'NOT SET',
    authMode: accessToken ? 'PERMANENT_TOKEN' : (clientId ? 'OAUTH' : 'NONE'),
    allEnvVars: {
      CLIO_ACCESS_TOKEN: process.env.CLIO_ACCESS_TOKEN ? 'SET' : 'NOT SET',
      CLIO_CLIENT_ID: process.env.CLIO_CLIENT_ID ? 'SET' : 'NOT SET',
      VITE_CLIO_CLIENT_ID: process.env.VITE_CLIO_CLIENT_ID ? 'SET' : 'NOT SET',
      CLIO_CLIENT_SECRET: process.env.CLIO_CLIENT_SECRET ? 'SET' : 'NOT SET',
      VITE_CLIO_CLIENT_SECRET: process.env.VITE_CLIO_CLIENT_SECRET ? 'SET' : 'NOT SET',
      CLIO_REDIRECT_URI: process.env.CLIO_REDIRECT_URI ? 'SET' : 'NOT SET',
      VITE_CLIO_REDIRECT_URI: process.env.VITE_CLIO_REDIRECT_URI ? 'SET' : 'NOT SET',
      CLIO_BASE_URL: process.env.CLIO_BASE_URL ? 'SET' : 'NOT SET',
    }
  });
}
