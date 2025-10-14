#!/usr/bin/env node

/**
 * Clio OAuth2 Authentication Helper
 * This script helps you get an access token from Clio
 */

import { createServer } from 'http';
import { parse } from 'url';
import { writeFileSync, readFileSync } from 'fs';
import { exec } from 'child_process';

const PORT = 3000;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

// Read .env to get client credentials
let clientId = '';
let clientSecret = '';

try {
  const envContent = readFileSync('.env', 'utf-8');
  const clientIdMatch = envContent.match(/VITE_CLIO_CLIENT_ID=(.+)/);
  const clientSecretMatch = envContent.match(/VITE_CLIO_CLIENT_SECRET=(.+)/);
  
  if (clientIdMatch) clientId = clientIdMatch[1].trim();
  if (clientSecretMatch) clientSecret = clientSecretMatch[1].trim();
} catch (err) {
  console.log('⚠️  .env file not found. Please create one first.');
}

if (!clientId || !clientSecret) {
  console.log('\n❌ Missing Clio OAuth credentials!\n');
  console.log('Please add these to your .env file:');
  console.log('  VITE_CLIO_CLIENT_ID=your_client_id');
  console.log('  VITE_CLIO_CLIENT_SECRET=your_client_secret\n');
  console.log('Get credentials at: https://app.clio.com/settings/api_keys\n');
  process.exit(1);
}

console.log('\n🔐 Clio OAuth2 Authentication\n');
console.log('Starting local server on port', PORT);

const server = createServer(async (req, res) => {
  const parsedUrl = parse(req.url, true);
  
  if (parsedUrl.pathname === '/callback') {
    const code = parsedUrl.query.code;
    
    if (code) {
      console.log('✓ Authorization code received');
      console.log('⏳ Exchanging code for access token...');
      
      try {
        // Exchange code for token
        const tokenResponse = await fetch('https://app.clio.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
          }),
        });
        
        const data = await tokenResponse.json();
        
        if (data.access_token) {
          console.log('✓ Access token received!');
          
          // Update .env file
          let envContent = readFileSync('.env', 'utf-8');
          
          if (envContent.includes('VITE_CLIO_API_KEY=')) {
            envContent = envContent.replace(
              /VITE_CLIO_API_KEY=.*/,
              `VITE_CLIO_API_KEY=${data.access_token}`
            );
          } else {
            envContent += `\nVITE_CLIO_API_KEY=${data.access_token}\n`;
          }
          
          // Also save refresh token if available
          if (data.refresh_token) {
            if (envContent.includes('VITE_CLIO_REFRESH_TOKEN=')) {
              envContent = envContent.replace(
                /VITE_CLIO_REFRESH_TOKEN=.*/,
                `VITE_CLIO_REFRESH_TOKEN=${data.refresh_token}`
              );
            } else {
              envContent += `VITE_CLIO_REFRESH_TOKEN=${data.refresh_token}\n`;
            }
          }
          
          writeFileSync('.env', envContent);
          console.log('✓ .env file updated with access token');
          
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <head><title>Success!</title></head>
              <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1>✅ Authentication Successful!</h1>
                <p>Your Clio access token has been saved.</p>
                <p>You can close this window and return to your terminal.</p>
                <script>setTimeout(() => window.close(), 3000);</script>
              </body>
            </html>
          `);
          
          setTimeout(() => {
            console.log('\n✅ Setup complete! You can now run: npm run dev\n');
            server.close();
            process.exit(0);
          }, 1000);
        } else {
          throw new Error(data.error_description || 'Failed to get access token');
        }
      } catch (error) {
        console.error('❌ Error:', error.message);
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <head><title>Error</title></head>
            <body style="font-family: sans-serif; text-align: center; padding: 50px;">
              <h1>❌ Authentication Failed</h1>
              <p>${error.message}</p>
              <p>Check your terminal for details.</p>
            </body>
          </html>
        `);
        setTimeout(() => process.exit(1), 2000);
      }
    } else {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('No authorization code received');
      server.close();
      process.exit(1);
    }
  }
});

server.listen(PORT, () => {
  const authUrl = `https://app.clio.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  
  console.log('✓ Server started');
  console.log('\n📝 Opening Clio authorization page in your browser...\n');
  console.log('If the browser doesn\'t open, visit this URL:\n');
  console.log(authUrl);
  console.log('\n');
  
  // Try to open browser
  const command = process.platform === 'darwin' ? 'open' : 
                  process.platform === 'win32' ? 'start' : 'xdg-open';
  
  exec(`${command} "${authUrl}"`, (err) => {
    if (err) {
      console.log('⚠️  Could not open browser automatically');
    }
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use.`);
    console.error('Please stop any other servers running on this port and try again.\n');
  } else {
    console.error('❌ Server error:', err.message);
  }
  process.exit(1);
});
