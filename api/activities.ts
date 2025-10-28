import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { since, type } = req.query;
  const authHeader = req.headers.authorization;

  console.log('[Clio Proxy - Activities] Request received:', { 
    since, 
    type, 
    authHeader: authHeader ? 'YES' : 'NO',
    allParams: req.query 
  });

  if (!authHeader) {
    console.error('[Clio Proxy - Activities] No authorization header');
    return res.status(401).json({ error: 'No authorization token provided' });
  }

  const baseUrl = process.env.CLIO_BASE_URL || 'https://app.clio.com';
  
  // Use URL constructor for proper query string handling
  const url = new URL(`${baseUrl}/api/v4/activities.json`);
  if (since) url.searchParams.append('since', since as string);
  if (type) url.searchParams.append('type', type as string);
  
  const finalUrl = url.toString();
  console.log('[Clio Proxy - Activities] Fetching from:', finalUrl);

  try {
    const response = await fetch(finalUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    console.log('[Clio Proxy - Activities] Response status:', response.status);

    const responseText = await response.text();

    if (!response.ok) {
      console.error('[Clio Proxy - Activities] Error response:', responseText);
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
      console.error('[Clio Proxy - Activities] JSON parse error:', parseError);
      return res.status(500).json({ 
        error: 'Invalid JSON response from Clio', 
        details: responseText.substring(0, 1000) 
      });
    }
    
    console.log('[Clio Proxy - Activities] ✓ Data received:', {
      count: data.data?.length || 0,
      hasData: !!data.data
    });

    return res.json(data);
  } catch (error: any) {
    console.error('[Clio Proxy - Activities] Exception:', error.message);
    console.error('[Clio Proxy - Activities] Stack:', error.stack);
    return res.status(500).json({ 
      error: 'Failed to fetch activities', 
      details: error.message,
      stack: error.stack 
    });
  }
}
