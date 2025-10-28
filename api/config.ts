import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Public config endpoint - returns non-sensitive configuration
 * that the frontend needs to make API calls
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  const baseUrl = process.env.CLIO_BASE_URL || 'https://app.clio.com';
  
  console.log('[Config API] Serving config:', { baseUrl });
  
  // Return public configuration (no secrets!)
  return res.json({
    baseUrl,
    apiUrl: `${baseUrl}/api/v4`
  });
}
