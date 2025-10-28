import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { since, fields } = req.query;
  const authHeader = req.headers.authorization;

  console.log('[Clio Proxy - Time Entries] Request received:', { 
    since, 
    fields, 
    authHeader: authHeader ? 'YES' : 'NO',
    allParams: req.query 
  });

  if (!authHeader) {
    console.error('[Clio Proxy - Time Entries] No authorization header');
    return res.status(401).json({ error: 'No authorization token provided' });
  }

  const baseUrl = process.env.CLIO_BASE_URL || 'https://app.clio.com';
  
  // DON'T double-encode! Params are already encoded by axios
  // Use URL constructor for proper query string handling
  const url = new URL(`${baseUrl}/api/v4/time_entries.json`);
  if (since) url.searchParams.append('since', since as string);
  if (fields) url.searchParams.append('fields', fields as string);
  
  const finalUrl = url.toString();
  console.log('[Clio Proxy - Time Entries] Fetching from:', finalUrl);

  try {
    const response = await fetch(finalUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    console.log('[Clio Proxy - Time Entries] Response status:', response.status);
    console.log('[Clio Proxy - Time Entries] Response headers:', Object.fromEntries(response.headers.entries()));

    const contentType = response.headers.get('content-type');
    const responseText = await response.text();
    
    console.log('[Clio Proxy - Time Entries] Response content-type:', contentType);
    console.log('[Clio Proxy - Time Entries] Response body (first 500 chars):', responseText.substring(0, 500));

    if (!response.ok) {
      console.error('[Clio Proxy - Time Entries] Error response:', responseText);
      return res.status(response.status).json({ 
        error: 'Clio API error', 
        status: response.status,
        details: responseText,
        url: finalUrl
      });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[Clio Proxy - Time Entries] JSON parse error:', parseError);
      return res.status(500).json({ 
        error: 'Invalid JSON response from Clio', 
        details: responseText.substring(0, 1000) 
      });
    }
    
    console.log('[Clio Proxy - Time Entries] ✓ Data received:', {
      count: data.data?.length || 0,
      hasData: !!data.data
    });

    return res.json(data);
  } catch (error: any) {
    console.error('[Clio Proxy - Time Entries] Exception:', error.message);
    console.error('[Clio Proxy - Time Entries] Stack:', error.stack);
    return res.status(500).json({ 
      error: 'Failed to fetch time entries', 
      details: error.message,
      stack: error.stack 
    });
  }
}
