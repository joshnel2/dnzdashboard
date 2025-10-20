import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { access_token } = req.body;

  if (!access_token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const sinceDate = startOfYear.toISOString();

    // Make parallel requests to Clio API
    const [timeEntriesResponse, activitiesResponse] = await Promise.all([
      fetch(
        `https://app.clio.com/api/v4/time_entries.json?since=${sinceDate}&fields=user{id,name},date,quantity,price`,
        {
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json',
          },
        }
      ),
      fetch(
        `https://app.clio.com/api/v4/activities.json?since=${sinceDate}&type=Payment`,
        {
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json',
          },
        }
      ),
    ]);

    // Check if requests were successful
    if (!timeEntriesResponse.ok) {
      const error = await timeEntriesResponse.json();
      return res.status(timeEntriesResponse.status).json({ 
        error: 'Failed to fetch time entries',
        details: error 
      });
    }

    if (!activitiesResponse.ok) {
      const error = await activitiesResponse.json();
      return res.status(activitiesResponse.status).json({ 
        error: 'Failed to fetch activities',
        details: error 
      });
    }

    const timeEntriesData = await timeEntriesResponse.json();
    const activitiesData = await activitiesResponse.json();

    // Return the combined data
    return res.status(200).json({
      timeEntries: timeEntriesData.data || [],
      activities: activitiesData.data || [],
    });

  } catch (error: any) {
    console.error('Error fetching Clio data:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch data from Clio',
      details: error.message 
    });
  }
}
