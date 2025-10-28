# Vercel Deployment - Debug Guide

## 🔧 Current Setup

You have environment variables set in Vercel. Here's what you need to verify:

## ✅ Required Environment Variables in Vercel

Make sure you have these set in **Vercel Dashboard → Your Project → Settings → Environment Variables**:

### Required Variables:
```
CLIO_BASE_URL=https://app.clio.com
CLIO_CLIENT_ID=your_client_id_here
CLIO_CLIENT_SECRET=your_client_secret_here
CLIO_REDIRECT_URI=https://your-app.vercel.app/api/oauth/callback
```

### ⚠️ Important Notes:

1. **CLIO_REDIRECT_URI must match your Vercel URL exactly**
   - Format: `https://your-app.vercel.app/api/oauth/callback`
   - Must also be registered in your Clio app settings
   - No trailing slash!

2. **After adding/changing environment variables, you MUST redeploy**
   - Go to Deployments tab
   - Click the three dots (•••) on latest deployment
   - Select "Redeploy"
   - OR: Push a new commit to trigger automatic deployment

3. **Check which environments have the variables**
   - Make sure variables are set for **Production**, **Preview**, and **Development**
   - Or at least for the environment you're testing

## 🔍 How to Debug on Vercel

### Step 1: Check Vercel Function Logs

1. Go to your Vercel Dashboard
2. Click on your project
3. Go to **Deployments** → Click on latest deployment
4. Click **Functions** tab
5. Look for `/api/oauth/url` and `/api/oauth/callback` logs

You should see logs like:
```
[OAuth URL] Configuration: { clientId: 'abc123...', baseUrl: 'https://app.clio.com', redirectUri: 'https://...' }
```

### Step 2: Check Browser Console

Open your deployed app and check the browser console (F12):

1. **On page load**, you should see:
   ```
   [App] Starting data fetch...
   [App] Access token in localStorage: NO
   [App] No token found, showing auth screen
   ```

2. **When clicking "Connect to Clio"**:
   ```
   [AuthButton] Login button clicked
   [AuthButton] Fetching auth URL from /api/oauth/url
   [AuthButton] Auth URL response: { authUrl: "https://app.clio.com/oauth/authorize?..." }
   [AuthButton] Redirecting to Clio authorization page
   ```

3. **After authorizing on Clio and redirecting back**:
   ```
   [OAuth Callback] Saving Clio access token to localStorage
   [OAuth Callback] Token saved, redirecting to dashboard
   ```

4. **After redirect to dashboard**:
   ```
   [App] Starting data fetch...
   [App] Access token in localStorage: YES
   [ClioService] Initializing with API_BASE_URL: https://app.clio.com/api/v4
   [ClioService] Request: GET /time_entries.json
   [ClioService] ✓ Response: /time_entries.json Status: 200
   ```

### Step 3: Test API Endpoints Directly

Visit these URLs in your browser to test:

**1. Test OAuth URL Generation:**
```
https://your-app.vercel.app/api/oauth/url
```

Should return JSON like:
```json
{
  "authUrl": "https://app.clio.com/oauth/authorize?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=..."
}
```

**If you get an error:**
- Check Vercel function logs for the error details
- Verify `CLIO_CLIENT_ID` is set in Vercel environment variables
- Make sure you redeployed after setting variables

## 🚨 Common Vercel-Specific Issues

### Issue 1: "Client ID not configured"

**Cause**: Environment variables not set or not deployed

**Solution**:
1. Verify variables are set in Vercel Dashboard
2. **Redeploy your application** (environment variables only take effect after redeployment)
3. Check Vercel function logs to see what variables are being loaded

### Issue 2: "Redirect URI mismatch" from Clio

**Cause**: The redirect URI doesn't match what's registered in Clio

**Solution**:
1. Check your `CLIO_REDIRECT_URI` in Vercel
2. It should be: `https://your-actual-vercel-url.vercel.app/api/oauth/callback`
3. Go to Clio → Settings → API Keys → Your App
4. Make sure the **exact same URL** is in the "Redirect URIs" list
5. Both must include `https://` and `/api/oauth/callback`

### Issue 3: Using wrong base URL (EU vs US)

**Cause**: Your Clio account is on a different server

**Solution**:
- **US accounts**: Use `https://app.clio.com`
- **Canadian accounts**: Use `https://ca.app.clio.com`
- **EU accounts**: Use `https://eu.app.clio.com`
- **Sandbox/Testing**: Use `https://app.goclio.com`

Update `CLIO_BASE_URL` in Vercel to match your account region.

### Issue 4: 401 Unauthorized when fetching data

**Cause**: Access token doesn't have required permissions

**Solution**:
1. Go to Clio → Settings → API Keys → Your App
2. Check the **Scopes/Permissions** section
3. Make sure these are enabled:
   - ✓ `time_entries:read` - Read time entries
   - ✓ `activities:read` - Read activities
   - ✓ `bills:read` - Read bills
   - ✓ `users:read` - Read users

4. If you changed permissions, users need to re-authorize:
   - Clear browser localStorage
   - Log in again through the dashboard

### Issue 5: CORS errors

**Cause**: Vercel configuration issue

**Solution**: Already configured in `vercel.json`, but verify:
```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    }
  ]
}
```

## 🔄 Force a Fresh Test

To test the complete flow from scratch:

1. **Open browser console** (F12)
2. **Clear localStorage**:
   ```javascript
   localStorage.clear()
   ```
3. **Reload the page**:
   ```javascript
   location.reload()
   ```
4. **You should see the login screen**
5. **Click "Connect to Clio"** and watch the console logs
6. **Authorize on Clio**
7. **Watch for redirect and data loading**

## 📊 What Success Looks Like

### In Browser Console:
```
[App] Starting data fetch...
[App] Access token in localStorage: YES
[ClioService] Initializing with API_BASE_URL: https://app.clio.com/api/v4
[ClioService] Access token: eyJ0eXAiOi...
[ClioService] getDashboardData() called
[ClioService] Fetching data since: 2025-01-01T00:00:00.000Z
[ClioService] Request: GET /time_entries.json
[ClioService] Request: GET /activities.json
[ClioService] ✓ Response: /time_entries.json Status: 200
[ClioService] ✓ Response: /activities.json Status: 200
[ClioService] Data fetched successfully: { timeEntries: 342, activities: 89 }
[ClioService] Data transformed: { monthlyDeposits: 125000, attorneyCount: 7, ... }
[App] ✓ Dashboard data loaded successfully
```

### On Screen:
- ✅ No red error banner
- ✅ Real data showing (not sample data)
- ✅ Attorney names from your Clio account
- ✅ Actual revenue numbers

## 🛠️ Quick Checklist

Before asking for help, verify:

- [ ] All 4 environment variables are set in Vercel (`CLIO_BASE_URL`, `CLIO_CLIENT_ID`, `CLIO_CLIENT_SECRET`, `CLIO_REDIRECT_URI`)
- [ ] You've redeployed after setting/changing environment variables
- [ ] `CLIO_REDIRECT_URI` matches your actual Vercel URL
- [ ] `CLIO_REDIRECT_URI` is registered in your Clio app
- [ ] `CLIO_BASE_URL` matches your Clio account region (US, CA, EU)
- [ ] Your Clio app has all required read permissions
- [ ] You've tested with a fresh browser session (cleared localStorage)
- [ ] You've checked both Vercel function logs AND browser console

## 📝 Current Environment Variable Values

To see what's actually configured (without exposing secrets), check:

**Vercel Function Logs** will show:
```
[OAuth URL] Configuration: {
  clientId: 'abc12345...', 
  baseUrl: 'https://app.clio.com',
  redirectUri: 'https://your-app.vercel.app/api/oauth/callback'
}
```

**Browser Console** will show:
```
[ClioService] Initializing with API_BASE_URL: https://app.clio.com/api/v4
```

If any of these are wrong, update in Vercel and redeploy.

## 🆘 Next Steps

If you're still having issues:

1. **Share the console output** - Copy all `[App]`, `[AuthButton]`, `[OAuth URL]`, and `[ClioService]` logs
2. **Share any errors** - Especially from the red error banner or console
3. **Check Vercel function logs** - Share any errors from the Functions tab
4. **Verify redirect URI** - Double-check it matches between Vercel and Clio exactly
