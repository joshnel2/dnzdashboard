import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { since, fields } = req.query;
  const authHeader = req.headers.authorization;

  console.log('[Clio Proxy - Time Entries] Request received:', { since, fields, authHeader: authHeader ? 'YES' : 'NO' });

  if (!authHeader) {
    console.error('[Clio Proxy - Time Entries] No authorization header');
    return res.status(401).json({ error: 'No authorization token provided' });
  }

  const baseUrl = process.env.CLIO_BASE_URL || 'https://app.clio.com';
  const encodedFields = encodeURIComponent(fields as string);
  const url = `${baseUrl}/api/v4/time_entries.json?since=${since}&fields=${encodedFields}`;

  console.log('[Clio Proxy - Time Entries] Fetching from:', url);

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    console.log('[Clio Proxy - Time Entries] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Clio Proxy - Time Entries] Error response:', errorText);
      return res.status(response.status).json({ 
        error: 'Clio API error', 
        status: response.status,
        details: errorText 
      });
    }

    const data = await response.json();
    
    console.log('[Clio Proxy - Time Entries] Data received:', {
      count: data.data?.length || 0
    });

    return res.json(data);
  } catch (error: any) {
    console.error('[Clio Proxy - Time Entries] Exception:', error.message, error.stack);
    return res.status(500).json({ error: 'Failed to fetch time entries', details: error.message });
  }
}
