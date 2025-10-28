import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code } = req.query;

  console.log('[OAuth Callback] Received callback with code:', code ? 'YES' : 'NO');

  if (!code) {
    console.error('[OAuth Callback] Error: No authorization code provided');
    return res.status(400).json({ error: 'No authorization code provided' });
  }

  // Support both VITE_ and non-VITE_ prefixed env vars (Vercel serverless functions prefer non-VITE_)
  const clientId = process.env.CLIO_CLIENT_ID || process.env.VITE_CLIO_CLIENT_ID;
  const clientSecret = process.env.CLIO_CLIENT_SECRET || process.env.VITE_CLIO_CLIENT_SECRET;
  const baseUrl = process.env.CLIO_BASE_URL || process.env.VITE_CLIO_BASE_URL || 'https://app.clio.com';
  const redirectUri = process.env.CLIO_REDIRECT_URI || 
                      process.env.VITE_CLIO_REDIRECT_URI || 
                      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api/oauth/callback` : 'http://localhost:3000/api/oauth/callback');

  console.log('[OAuth Callback] Configuration:', {
    clientId: clientId ? `${clientId.substring(0, 8)}...` : 'NOT SET',
    clientSecret: clientSecret ? 'SET' : 'NOT SET',
    baseUrl,
    redirectUri
  });

  if (!clientId || !clientSecret) {
    console.error('[OAuth Callback] Error: Client credentials not configured');
    return res.status(500).json({ error: 'Client credentials not configured' });
  }

  try {
    const tokenUrl = `${baseUrl}/oauth/token`;
    console.log('[OAuth Callback] Exchanging code for token at:', tokenUrl);
    
    // Exchange authorization code for access token
    const tokenResponse = await fetch(tokenUrl, {
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

    console.log('[OAuth Callback] Token response status:', tokenResponse.status);

    const data = await tokenResponse.json();
    console.log('[OAuth Callback] Token response:', {
      hasAccessToken: !!data.access_token,
      hasRefreshToken: !!data.refresh_token,
      error: data.error || 'none'
    });

    if (data.access_token) {
      console.log('[OAuth Callback] ✓ Successfully received access token');
      // Return HTML that stores token and redirects back to app
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Authentication Success</title>
          </head>
          <body>
            <script>
              console.log('[OAuth Callback] Saving Clio access token to localStorage');
              localStorage.setItem('clio_access_token', '${data.access_token}');
              ${data.refresh_token ? `localStorage.setItem('clio_refresh_token', '${data.refresh_token}'); console.log('[OAuth Callback] Saved refresh token');` : ''}
              console.log('[OAuth Callback] Token saved, redirecting to dashboard');
              window.location.href = '/';
            </script>
            <p>Authentication successful! Redirecting...</p>
          </body>
        </html>
      `);
    } else {
      console.error('[OAuth Callback] Error: No access token in response');
      throw new Error(data.error_description || 'Failed to get access token');
    }
  } catch (error: any) {
    console.error('[OAuth Callback] Exception during token exchange:', error.message);
    return res.status(500).json({ 
      error: 'Authentication failed', 
      details: error.message 
    });
  }
}
