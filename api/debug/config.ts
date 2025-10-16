import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const clientId = process.env.CLIO_CLIENT_ID || process.env.VITE_CLIO_CLIENT_ID;
  const clientSecret = process.env.CLIO_CLIENT_SECRET || process.env.VITE_CLIO_CLIENT_SECRET;
  const redirectUri = process.env.CLIO_REDIRECT_URI || 
                      process.env.VITE_CLIO_REDIRECT_URI || 
                      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api/oauth/callback` : 'http://localhost:3000/api/oauth/callback');
  
  return res.json({
    clientId: clientId ? '***' + clientId.slice(-4) : 'NOT SET',
    clientSecret: clientSecret ? '***SET***' : 'NOT SET',
    redirectUri: redirectUri,
    vercelUrl: process.env.VERCEL_URL || 'NOT SET',
    explicitRedirectUri: process.env.CLIO_REDIRECT_URI || process.env.VITE_CLIO_REDIRECT_URI || 'NOT SET',
    allEnvVars: {
      CLIO_CLIENT_ID: process.env.CLIO_CLIENT_ID ? 'SET' : 'NOT SET',
      VITE_CLIO_CLIENT_ID: process.env.VITE_CLIO_CLIENT_ID ? 'SET' : 'NOT SET',
      CLIO_CLIENT_SECRET: process.env.CLIO_CLIENT_SECRET ? 'SET' : 'NOT SET',
      VITE_CLIO_CLIENT_SECRET: process.env.VITE_CLIO_CLIENT_SECRET ? 'SET' : 'NOT SET',
      CLIO_REDIRECT_URI: process.env.CLIO_REDIRECT_URI ? 'SET' : 'NOT SET',
      VITE_CLIO_REDIRECT_URI: process.env.VITE_CLIO_REDIRECT_URI ? 'SET' : 'NOT SET',
    }
  });
}
