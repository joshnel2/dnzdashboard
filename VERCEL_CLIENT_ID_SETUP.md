# Simple Vercel Setup with Client ID & Secret

## ✅ Perfect! Here's What To Do

Since you have **Client ID** and **Client Secret** from Clio, just add them to Vercel and you're done!

---

## Step 1: Add to Vercel Environment Variables

1. **Go to Vercel:** https://vercel.com/dashboard

2. **Click your project** → Settings → Environment Variables

3. **Add these 3 variables:**

### First Variable:
```
Name:  VITE_CLIO_CLIENT_ID
Value: (paste your Client ID from Clio)
```
✅ Check: Production, Preview, Development

### Second Variable:
```
Name:  VITE_CLIO_CLIENT_SECRET
Value: (paste your Client Secret from Clio)
```
✅ Check: Production, Preview, Development

### Third Variable:
```
Name:  VITE_CLIO_API_BASE_URL
Value: https://app.clio.com/api/v4
```
✅ Check: Production, Preview, Development

4. **Click "Save" after each one**

---

## Step 2: Update Redirect URI in Clio

1. **Go to Clio:** https://app.clio.com/settings/api_keys

2. **Find your app** and click Edit

3. **Add this Redirect URI:**
   ```
   https://your-project-name.vercel.app/api/oauth/callback
   ```
   Replace `your-project-name` with your actual Vercel domain

4. **Save in Clio**

---

## Step 3: Redeploy

1. **In Vercel:** Go to Deployments tab

2. **Click "..."** on the latest deployment

3. **Click "Redeploy"**

---

## Step 4: Done! 🎉

**Visit your Vercel URL**

You'll see a **"Connect to Clio"** button:

```
┌─────────────────────────────────────┐
│                                     │
│     🔐 Connect to Clio             │
│                                     │
│  This dashboard needs to connect    │
│  to your Clio account to display    │
│  your firm's data.                  │
│                                     │
│  ┌──────────────────────────────┐ │
│  │   Connect to Clio            │ │
│  └──────────────────────────────┘ │
│                                     │
│  You'll be redirected to Clio       │
│  to authorize this application.     │
│                                     │
└─────────────────────────────────────┘
```

**Click the button** → You'll go to Clio → Click "Authorize" → Redirected back → Dashboard shows real data!

---

## How It Works

1. First visit: User sees "Connect to Clio" button
2. Click button → Redirected to Clio
3. User authorizes the app in Clio
4. Redirected back to dashboard
5. Access token saved automatically
6. Dashboard loads with real Clio data
7. Token saved for future visits (no need to reconnect)

---

## What Happens on Future Visits?

✅ **Token is saved** - User goes straight to dashboard (no button)

⚠️ **If token expires** - Button appears again, click to reconnect

---

## Security Notes

✅ **Your Client Secret is safe!**
- It stays on Vercel's servers
- Never exposed to the browser
- OAuth exchange happens server-side via Vercel Functions

✅ **Access tokens are user-specific**
- Stored in browser localStorage
- Each user has their own token
- Expires automatically for security

---

## Troubleshooting

### ❌ "Connect to Clio" button doesn't work

**Check:**
1. All 3 env vars added to Vercel
2. Redirect URI added to Clio app
3. Redirect URI matches your Vercel domain exactly
4. Project redeployed after adding env vars

### ❌ After clicking "Authorize" in Clio, it shows an error

**Most likely:** Redirect URI mismatch

**Fix:**
1. Go to Clio → Your App → Check Redirect URI
2. Must exactly match: `https://YOUR-DOMAIN.vercel.app/api/oauth/callback`
3. No trailing slash
4. Must be https (not http)

### ❌ Dashboard still shows sample data after connecting

**Check browser console** (F12):
- Look for API errors
- Token might not be saving properly
- Try clearing localStorage and reconnecting

---

## Summary

**What you need in Vercel:**
```
VITE_CLIO_CLIENT_ID=abc123...
VITE_CLIO_CLIENT_SECRET=xyz789...
VITE_CLIO_API_BASE_URL=https://app.clio.com/api/v4
```

**What you need in Clio:**
```
Redirect URI: https://your-app.vercel.app/api/oauth/callback
```

**That's it!** Users will connect via OAuth automatically. 🚀
