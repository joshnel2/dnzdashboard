import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const accessToken = process.env.CLIO_ACCESS_TOKEN;
  const baseUrl = process.env.CLIO_BASE_URL || 'https://app.clio.com';
  
  if (!accessToken) {
    return res.status(500).json({ error: 'CLIO_ACCESS_TOKEN not configured' });
  }

  try {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const sinceParam = startOfYear.toISOString();

    // Fetch time entries
    const timeEntriesUrl = `${baseUrl}/api/v4/time_entries.json?since=${encodeURIComponent(sinceParam)}&fields=user{id,name},date,quantity,price`;
    const timeEntriesResponse = await fetch(timeEntriesUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!timeEntriesResponse.ok) {
      throw new Error(`Time entries failed: ${timeEntriesResponse.status} ${timeEntriesResponse.statusText}`);
    }

    const timeEntriesData = await timeEntriesResponse.json();

    // Fetch activities (payments)
    const activitiesUrl = `${baseUrl}/api/v4/activities.json?since=${encodeURIComponent(sinceParam)}&type=Payment`;
    const activitiesResponse = await fetch(activitiesUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!activitiesResponse.ok) {
      throw new Error(`Activities failed: ${activitiesResponse.status} ${activitiesResponse.statusText}`);
    }

    const activitiesData = await activitiesResponse.json();

    // Return both datasets
    return res.json({
      timeEntries: timeEntriesData.data || [],
      activities: activitiesData.data || [],
    });
  } catch (error: any) {
    console.error('Clio API Error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch from Clio API',
      details: error.message 
    });
  }
}
