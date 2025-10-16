# Connecting to Clio API - Complete Guide

## Step 1: Get Clio API Credentials

### Option A: Using OAuth2 (Recommended for Production)

1. **Log in to Clio** at https://app.clio.com

2. **Navigate to API Settings:**
   - Click your profile picture (top right)
   - Go to **Settings** → **Integrations** → **API Credentials**
   - Or visit directly: https://app.clio.com/settings/api_keys

3. **Create a New Application:**
   - Click **"Create Application"** or **"New API Key"**
   - Fill in the details:
     - **Application Name**: "Law Firm Dashboard" (or your preferred name)
     - **Description**: "Financial and performance dashboard"
     - **Redirect URI**: `http://localhost:3000/callback` (for development)
   
4. **Save Your Credentials:**
   - **Client ID**: Copy this
   - **Client Secret**: Copy this (shown only once!)
   - **App ID**: Note this down

### Option B: Using API Key (Simpler, for Testing)

1. **Log in to Clio** at https://app.clio.com

2. **Generate API Key:**
   - Settings → Integrations → API Keys
   - Click **"Generate New Key"**
   - Copy the key immediately (shown only once!)

## Step 2: Configure Your Dashboard

### Create `.env` file:

In the root of your project, create a `.env` file:

```bash
cp .env.example .env
```

### Edit `.env` with your credentials:

**For OAuth2 (Recommended):**
```env
VITE_CLIO_API_BASE_URL=https://app.clio.com/api/v4
VITE_CLIO_CLIENT_ID=your_client_id_here
VITE_CLIO_CLIENT_SECRET=your_client_secret_here
VITE_CLIO_REDIRECT_URI=http://localhost:3000/callback
```

**For API Key (Simple):**
```env
VITE_CLIO_API_BASE_URL=https://app.clio.com/api/v4
VITE_CLIO_API_KEY=your_access_token_here
```

## Step 3: Get Your Access Token

### For OAuth2 Authentication:

You need to complete the OAuth2 flow to get an access token:

1. **Authorization URL:**
   ```
   https://app.clio.com/oauth/authorize?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:3000/callback
   ```

2. **Visit the URL** in your browser and authorize the application

3. **You'll be redirected** to your callback URL with a code:
   ```
   http://localhost:3000/callback?code=AUTHORIZATION_CODE
   ```

4. **Exchange the code for an access token** using this curl command:
   ```bash
   curl -X POST https://app.clio.com/oauth/token \
     -d "client_id=YOUR_CLIENT_ID" \
     -d "client_secret=YOUR_CLIENT_SECRET" \
     -d "grant_type=authorization_code" \
     -d "code=AUTHORIZATION_CODE" \
     -d "redirect_uri=http://localhost:3000/callback"
   ```

5. **Copy the `access_token`** from the response and add it to `.env`:
   ```env
   VITE_CLIO_API_KEY=your_access_token_here
   ```

### Quick Setup Script (OAuth2):

I've created a helper script to make this easier. Run:

```bash
npm run clio:auth
```

This will:
- Open the Clio authorization page
- Handle the callback
- Exchange the code for an access token
- Save it to your `.env` file

## Step 4: Test the Connection

1. **Start the dashboard:**
   ```bash
   npm run dev
   ```

2. **Open your browser** to http://localhost:3000

3. **Check the console:**
   - Press F12 to open Developer Tools
   - Look for any errors in the Console tab
   - Check the Network tab for API requests

### What to Expect:

✅ **Success:** Dashboard loads with real data from your Clio account

❌ **Still showing sample data?** Check:
- `.env` file exists and has correct values
- Access token is valid (tokens expire!)
- API requests in Network tab (look for errors)

## Troubleshooting

### Error: "401 Unauthorized"

**Problem:** Invalid or expired access token

**Solution:**
- Refresh your access token (OAuth2)
- Generate a new API key
- Check that your `.env` file is correctly formatted

### Error: "403 Forbidden"

**Problem:** Your app doesn't have permission to access certain data

**Solution:**
- Check your Clio app permissions
- Re-authorize with the correct scopes
- Contact your Clio admin for access

### Error: "Failed to load dashboard data"

**Problem:** API connection issue

**Solution:**
1. Check your internet connection
2. Verify API base URL is correct
3. Check browser console for specific errors
4. Verify `.env` values are correct (no extra spaces!)

### Dashboard Shows Sample Data

**Problem:** API not configured or failing silently

**Solution:**
1. Verify `.env` file exists in the root directory
2. Restart the dev server (`npm run dev`)
3. Check that environment variables are loaded:
   ```javascript
   // In browser console:
   console.log(import.meta.env.VITE_CLIO_API_KEY ? 'API Key loaded' : 'No API Key')
   ```

## API Endpoints Used

The dashboard makes requests to these Clio API endpoints:

### 1. Time Entries
```
GET /api/v4/time_entries
```
**Used for:**
- Attorney billable hours
- YTD time tracking

**Parameters:**
- `since`: Start of current year
- `fields`: user{id,name},date,quantity,price

### 2. Activities (Bills/Payments)
```
GET /api/v4/activities
```
**Used for:**
- Monthly deposits
- Weekly revenue
- YTD revenue

**Parameters:**
- `since`: Start of current year  
- `type`: Payment

## Refreshing Tokens

OAuth2 access tokens expire. To refresh:

1. **Get a refresh token** (included in initial OAuth response)

2. **Use the refresh token:**
   ```bash
   curl -X POST https://app.clio.com/oauth/token \
     -d "client_id=YOUR_CLIENT_ID" \
     -d "client_secret=YOUR_CLIENT_SECRET" \
     -d "grant_type=refresh_token" \
     -d "refresh_token=YOUR_REFRESH_TOKEN"
   ```

3. **Update `.env`** with the new access token

## Security Best Practices

⚠️ **Important:**

1. **Never commit `.env` to git** (it's already in `.gitignore`)
2. **Keep your Client Secret secure** (never share publicly)
3. **Rotate tokens regularly** for security
4. **Use environment-specific tokens** (dev vs production)

## Need Help?

- **Clio API Documentation:** https://docs.clio.com/
- **Clio Support:** support@clio.com
- **API Status:** https://status.clio.com/

## Next Steps

Once connected:
- ✅ Dashboard will auto-refresh every 5 minutes
- ✅ Real data from your Clio account will display
- ✅ All charts will show actual attorney performance
- ✅ Financial metrics will be accurate and current

---

**Still need help?** Check the main README.md for additional troubleshooting steps.
