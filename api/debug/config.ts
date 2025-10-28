import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Debug endpoint to check environment variable configuration
 * Visit: /api/debug/config
 * 
 * This endpoint shows which environment variables are loaded
 * WITHOUT exposing the actual secret values.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  const config = {
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || 'unknown',
    region: process.env.VERCEL_REGION || 'unknown',
    
    // Check which variables are set (without showing actual values)
    variables: {
      CLIO_BASE_URL: {
        isSet: !!process.env.CLIO_BASE_URL,
        value: process.env.CLIO_BASE_URL || 'NOT SET'
      },
      CLIO_CLIENT_ID: {
        isSet: !!process.env.CLIO_CLIENT_ID,
        preview: process.env.CLIO_CLIENT_ID 
          ? `${process.env.CLIO_CLIENT_ID.substring(0, 8)}...` 
          : 'NOT SET'
      },
      CLIO_CLIENT_SECRET: {
        isSet: !!process.env.CLIO_CLIENT_SECRET,
        value: process.env.CLIO_CLIENT_SECRET ? 'SET (hidden)' : 'NOT SET'
      },
      CLIO_REDIRECT_URI: {
        isSet: !!process.env.CLIO_REDIRECT_URI,
        value: process.env.CLIO_REDIRECT_URI || 'NOT SET',
        computed: process.env.VERCEL_URL 
          ? `https://${process.env.VERCEL_URL}/api/oauth/callback` 
          : 'http://localhost:3000/api/oauth/callback'
      },
      
      // Check VITE_ prefixed versions
      VITE_CLIO_BASE_URL: {
        isSet: !!process.env.VITE_CLIO_BASE_URL,
        value: process.env.VITE_CLIO_BASE_URL || 'NOT SET'
      },
      VITE_CLIO_CLIENT_ID: {
        isSet: !!process.env.VITE_CLIO_CLIENT_ID,
        preview: process.env.VITE_CLIO_CLIENT_ID 
          ? `${process.env.VITE_CLIO_CLIENT_ID.substring(0, 8)}...` 
          : 'NOT SET'
      }
    },
    
    // Computed OAuth URL
    authUrl: (() => {
      const clientId = process.env.CLIO_CLIENT_ID || process.env.VITE_CLIO_CLIENT_ID;
      const baseUrl = process.env.CLIO_BASE_URL || process.env.VITE_CLIO_BASE_URL || 'https://app.clio.com';
      const redirectUri = process.env.CLIO_REDIRECT_URI || 
                          process.env.VITE_CLIO_REDIRECT_URI || 
                          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api/oauth/callback` : 'http://localhost:3000/api/oauth/callback');
      
      if (!clientId) {
        return 'ERROR: No client ID configured';
      }
      
      return `${baseUrl}/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    })(),
    
    // API base URL
    apiBaseUrl: `${process.env.CLIO_BASE_URL || process.env.VITE_CLIO_BASE_URL || 'https://app.clio.com'}/api/v4`,
    
    // Configuration status
    status: {
      isConfigured: !!(
        (process.env.CLIO_CLIENT_ID || process.env.VITE_CLIO_CLIENT_ID) &&
        (process.env.CLIO_CLIENT_SECRET || process.env.VITE_CLIO_CLIENT_SECRET)
      ),
      missingVariables: [
        !process.env.CLIO_CLIENT_ID && !process.env.VITE_CLIO_CLIENT_ID ? 'CLIO_CLIENT_ID' : null,
        !process.env.CLIO_CLIENT_SECRET && !process.env.VITE_CLIO_CLIENT_SECRET ? 'CLIO_CLIENT_SECRET' : null,
      ].filter(Boolean)
    },
    
    // Help text
    help: {
      message: 'If variables show as NOT SET, add them in Vercel Dashboard and redeploy',
      vercelUrl: 'https://vercel.com/dashboard → Your Project → Settings → Environment Variables',
      requiredVariables: [
        'CLIO_BASE_URL',
        'CLIO_CLIENT_ID', 
        'CLIO_CLIENT_SECRET',
        'CLIO_REDIRECT_URI'
      ]
    }
  };
  
  console.log('[Debug Config] Configuration check:', JSON.stringify(config, null, 2));
  
  return res.json(config);
}
