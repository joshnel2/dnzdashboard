# Vercel Environment Variables - Quick Test

## ✅ You've Set These in Vercel Dashboard

Environment variables for:
- `CLIO_BASE_URL`
- `CLIO_CLIENT_ID`
- `CLIO_CLIENT_SECRET`
- `CLIO_REDIRECT_URI`

## 🚀 Next Steps to Make It Work

### Step 1: Verify Variables Are Loaded

After deploying, visit this URL in your browser:
```
https://your-app.vercel.app/api/debug/config
```

This will show you (without exposing secrets):
- ✓ Which variables are set
- ✓ What your OAuth URL will be
- ✓ What your redirect URI is
- ✓ Any missing configuration

### Step 2: Redeploy Your Application

⚠️ **IMPORTANT**: Environment variables only take effect after redeployment!

**Option A: Redeploy from Vercel Dashboard**
1. Go to your project in Vercel
2. Click **Deployments** tab
3. Find the latest deployment
4. Click the three dots (•••)
5. Click **Redeploy**

**Option B: Push a new commit**
```bash
git commit --allow-empty -m "Redeploy for env vars"
git push
```

### Step 3: Check Your Clio Redirect URI

Make sure your Clio app has the correct redirect URI registered:

1. Go to https://app.clio.com/settings/api_keys
2. Click on your application
3. Check **Redirect URIs** section
4. It should include: `https://your-app.vercel.app/api/oauth/callback`
   - Must be HTTPS (not HTTP)
   - Must match your Vercel URL exactly
   - Must end with `/api/oauth/callback`

### Step 4: Test the Login Flow

1. Visit your deployed app: `https://your-app.vercel.app`
2. Open browser console (F12)
3. Click "Connect to Clio" button
4. Watch the console for logs:
   - `[AuthButton] Login button clicked`
   - `[AuthButton] Fetching auth URL from /api/oauth/url`
   - `[AuthButton] Redirecting to Clio authorization page`

### Step 5: Check Console Logs After Login

After authorizing on Clio and being redirected back, you should see:
```
[OAuth Callback] Saving Clio access token to localStorage
[App] ✓ Dashboard data loaded successfully
[ClioService] Data fetched successfully: { timeEntries: X, activities: Y }
```

## 🚨 Common Issues

### Issue: Still getting "Client ID not configured"
**Fix**: You forgot to redeploy after setting environment variables. Go redeploy now!

### Issue: "Redirect URI mismatch"
**Fix**: 
- Your `CLIO_REDIRECT_URI` in Vercel must match what's in Clio settings
- Format: `https://your-app.vercel.app/api/oauth/callback`
- Go to Clio → Settings → API Keys → Edit your app → Add the redirect URI

### Issue: Getting sample data, not real data
**Fix**: 
- Check browser console for error logs
- Look for the red error banner at the top
- Visit `/api/debug/config` to verify configuration
- Check that your Clio app has read permissions for:
  - Time entries
  - Activities
  - Bills
  - Users

## 📋 Expected Values

Your Vercel environment variables should look like:

| Variable | Example Value |
|----------|--------------|
| `CLIO_BASE_URL` | `https://app.clio.com` |
| `CLIO_CLIENT_ID` | `abc123def456...` (from Clio) |
| `CLIO_CLIENT_SECRET` | `xyz789uvw456...` (from Clio) |
| `CLIO_REDIRECT_URI` | `https://your-app.vercel.app/api/oauth/callback` |

## 🎯 Test Right Now

1. **Visit your debug endpoint** (after redeploying):
   ```
   https://your-app.vercel.app/api/debug/config
   ```
   
   Should show:
   ```json
   {
     "status": {
       "isConfigured": true,
       "missingVariables": []
     }
   }
   ```

2. **Visit your OAuth URL endpoint**:
   ```
   https://your-app.vercel.app/api/oauth/url
   ```
   
   Should return:
   ```json
   {
     "authUrl": "https://app.clio.com/oauth/authorize?..."
   }
   ```

3. **Test the full login flow** on your app

## 📞 If Still Not Working

Share these details:

1. **Output from** `/api/debug/config`
2. **Console logs** from browser (all `[App]`, `[AuthButton]`, `[ClioService]` messages)
3. **Any error messages** from the red banner or console
4. **Your Vercel URL** (so I can verify the format)

The comprehensive logging we added will tell us exactly what's wrong!
