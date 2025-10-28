# Clio Dashboard Setup Guide

## ✅ What Was Fixed

The Clio authentication and data retrieval has been updated with the following improvements:

1. **✓ CLIO_BASE_URL Support**: All OAuth and API endpoints now use the `CLIO_BASE_URL` environment variable
2. **✓ Comprehensive Logging**: Console logs throughout the app to debug authentication and API issues
3. **✓ Error Visibility**: Errors are now displayed instead of silently falling back to sample data
4. **✓ Proper Environment Variable Handling**: Supports both `VITE_` prefixed (for frontend) and non-prefixed (for serverless functions) variables

## 🚀 Quick Setup

### Step 1: Set Environment Variables

You have two options:

#### Option A: Local Development (Create `.env.local` file)

Create a file named `.env.local` in the root directory:

```bash
# Copy from example
cp .env.example .env.local
```

Then edit `.env.local` with your Clio credentials:

```env
# Clio Base URL (use https://app.clio.com for production)
VITE_CLIO_BASE_URL=https://app.clio.com

# OAuth2 Credentials from Clio Dashboard
CLIO_CLIENT_ID=your_client_id_here
CLIO_CLIENT_SECRET=your_client_secret_here
CLIO_REDIRECT_URI=http://localhost:5173/api/oauth/callback

# Frontend versions (optional, for local development)
VITE_CLIO_CLIENT_ID=your_client_id_here
VITE_CLIO_CLIENT_SECRET=your_client_secret_here
VITE_CLIO_REDIRECT_URI=http://localhost:5173/api/oauth/callback
```

#### Option B: Vercel Deployment

In your Vercel Dashboard → Project Settings → Environment Variables, add:

```
CLIO_BASE_URL=https://app.clio.com
CLIO_CLIENT_ID=your_client_id_here
CLIO_CLIENT_SECRET=your_client_secret_here
CLIO_REDIRECT_URI=https://your-app.vercel.app/api/oauth/callback
```

**Important**: Use your actual Vercel deployment URL for `CLIO_REDIRECT_URI`!

### Step 2: Get Clio API Credentials

1. **Log into Clio**: Go to https://app.clio.com
2. **Navigate to API Settings**: 
   - Click your profile picture (top right)
   - Go to **Settings** → **Integrations** → **API Keys**
   - Or visit: https://app.clio.com/settings/api_keys

3. **Create a New Application**:
   - Click **"Create Application"**
   - **Application Name**: "Law Firm Dashboard" (or your choice)
   - **Description**: "Financial and performance dashboard"
   - **Redirect URI**: 
     - Local: `http://localhost:5173/api/oauth/callback`
     - Production: `https://your-app.vercel.app/api/oauth/callback`
   - **Permissions**: Make sure to enable:
     - ✓ Read time entries
     - ✓ Read activities
     - ✓ Read bills
     - ✓ Read users

4. **Save Credentials**:
   - Copy the **Client ID**
   - Copy the **Client Secret** (shown only once!)
   - Add them to your environment variables

### Step 3: Run the Application

```bash
# Install dependencies (if not already done)
npm install

# Start development server
npm run dev
```

Open http://localhost:5173 in your browser.

## 🔍 Debugging

The app now includes comprehensive console logging to help you debug issues:

### Console Log Format

All logs are prefixed with their source for easy filtering:

- `[OAuth URL]` - OAuth authorization URL generation
- `[OAuth Callback]` - OAuth token exchange
- `[AuthButton]` - Login button interactions
- `[ClioService]` - API requests and responses
- `[App]` - Main application flow

### What to Look For

1. **Open Browser Console** (F12 → Console tab)

2. **Check for Configuration Issues**:
   ```
   [OAuth URL] Configuration: { clientId: '...', baseUrl: '...', redirectUri: '...' }
   ```
   - Make sure all values are correct
   - Check if `baseUrl` matches your Clio instance

3. **Check Authentication Flow**:
   ```
   [AuthButton] Login button clicked
   [AuthButton] Fetching auth URL from /api/oauth/url
   [OAuth URL] Generated auth URL: https://app.clio.com/oauth/authorize?...
   ```

4. **Check Token Exchange**:
   ```
   [OAuth Callback] Received callback with code: YES
   [OAuth Callback] Token response status: 200
   [OAuth Callback] ✓ Successfully received access token
   ```

5. **Check API Requests**:
   ```
   [ClioService] Request: GET /time_entries.json
   [ClioService] ✓ Response: /time_entries.json Status: 200
   [ClioService] Data fetched successfully: { timeEntries: 150, activities: 45 }
   ```

### Common Issues

#### Issue: "Client ID not configured"
**Solution**: Check that `CLIO_CLIENT_ID` is set in your environment variables

#### Issue: "401 Unauthorized"
**Solution**: 
- Your access token might be expired or invalid
- Clear localStorage and log in again
- Check that your Clio app has the correct permissions

#### Issue: "Failed to get auth URL"
**Solution**: 
- Check browser console for detailed error
- Verify API endpoint is accessible
- Check that serverless functions are running

#### Issue: Data not showing (sample data displayed)
**Solution**:
- Look for the red error banner at the top
- Check console for API errors
- Verify your Clio app has read permissions for all required resources
- Check that environment variables are loaded: `console.log(import.meta.env)`

#### Issue: Redirect URI mismatch
**Solution**:
- The redirect URI in your `.env.local` must EXACTLY match the one registered in Clio
- Include protocol (`http://` or `https://`)
- Match the port number (default Vite port is `5173`)

## 📊 What Data is Retrieved

The dashboard fetches the following data from Clio:

### 1. Time Entries (`/api/v4/time_entries.json`)
- Used for: Attorney billable hours, YTD time tracking
- Parameters:
  - `since`: Start of current year
  - `fields`: user{id,name},date,quantity,price

### 2. Activities (`/api/v4/activities.json`)
- Used for: Monthly deposits, weekly revenue, YTD revenue
- Parameters:
  - `since`: Start of current year
  - `type`: Payment

## 🔐 Security Notes

⚠️ **Important Security Practices**:

1. **Never commit `.env.local` to git** (it's already in `.gitignore`)
2. **Keep your Client Secret secure** (never share publicly)
3. **Rotate tokens regularly** for security
4. **Use different credentials** for development vs production

## 🎉 Success Indicators

You'll know everything is working when you see:

1. ✅ Login button redirects to Clio authorization page
2. ✅ After authorizing, you're redirected back to the dashboard
3. ✅ Console shows: `[App] ✓ Dashboard data loaded successfully`
4. ✅ Real data from your Clio account appears (not sample data)
5. ✅ No red error banner at the top

## 📝 Testing the Integration

1. **Clear localStorage** (to test fresh login):
   ```javascript
   // In browser console:
   localStorage.clear()
   location.reload()
   ```

2. **Check environment variables** (in browser console):
   ```javascript
   console.log({
     baseUrl: import.meta.env.VITE_CLIO_BASE_URL,
     clientId: import.meta.env.VITE_CLIO_CLIENT_ID
   })
   ```

3. **Monitor Network Tab** (F12 → Network):
   - Look for requests to `/api/oauth/url`
   - Look for requests to `/time_entries.json`
   - Look for requests to `/activities.json`
   - Check response status codes (should be 200)

## 🆘 Still Having Issues?

If you're still experiencing problems:

1. **Check all console logs** - they will tell you exactly what's failing
2. **Verify environment variables are loaded** - use `console.log(import.meta.env)`
3. **Test the OAuth flow manually** - visit `/api/oauth/url` directly
4. **Check Clio API status** - https://status.clio.com/
5. **Review Clio app permissions** - make sure your app can read all required resources

## 📚 Additional Resources

- **Clio API Documentation**: https://docs.clio.com/
- **OAuth 2.0 Flow**: https://docs.clio.com/authentication.html
- **Clio Support**: support@clio.com
- **API Status**: https://status.clio.com/
