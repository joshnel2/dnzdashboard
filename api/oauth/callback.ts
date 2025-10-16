import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'No authorization code provided' });
  }

  // Support both VITE_ and non-VITE_ prefixed env vars (Vercel serverless functions prefer non-VITE_)
  const clientId = process.env.CLIO_CLIENT_ID || process.env.VITE_CLIO_CLIENT_ID;
  const clientSecret = process.env.CLIO_CLIENT_SECRET || process.env.VITE_CLIO_CLIENT_SECRET;
  const redirectUri = process.env.CLIO_REDIRECT_URI || 
                      process.env.VITE_CLIO_REDIRECT_URI || 
                      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api/oauth/callback` : 'http://localhost:3000/api/oauth/callback');

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Client credentials not configured' });
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://app.clio.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: redirectUri,
      }),
    });

    const data = await tokenResponse.json();

    if (data.access_token) {
      // Return HTML that stores token and redirects back to app
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Authentication Success</title>
          </head>
          <body>
            <script>
              localStorage.setItem('clio_access_token', '${data.access_token}');
              ${data.refresh_token ? `localStorage.setItem('clio_refresh_token', '${data.refresh_token}');` : ''}
              window.location.href = '/';
            </script>
            <p>Authenticating... Please wait.</p>
          </body>
        </html>
      `);
    } else {
      throw new Error(data.error_description || 'Failed to get access token');
    }
  } catch (error: any) {
    return res.status(500).json({ 
      error: 'Authentication failed', 
      details: error.message 
    });
  }
}
