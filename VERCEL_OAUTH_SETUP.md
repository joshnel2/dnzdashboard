# Vercel Setup with OAuth2 Client ID & Secret

## You Have Client ID and Client Secret? Here's What To Do

Since you're using **OAuth2** with Client ID and Client Secret, here's the **easiest way** to set this up on Vercel:

---

## The Simple Solution (Recommended)

**Use the OAuth helper locally to get an access token, then add JUST the token to Vercel.**

### Step 1: Get Your Access Token (Run Locally Once)

On your computer:

1. **Make sure you have the project files**

2. **Create `.env` file locally:**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` and add your Client ID and Secret:**
   ```env
   VITE_CLIO_CLIENT_ID=your_client_id_here
   VITE_CLIO_CLIENT_SECRET=your_client_secret_here
   ```

4. **Run the OAuth helper:**
   ```bash
   npm install
   npm run clio:auth
   ```

5. **This will:**
   - Open Clio in your browser
   - Ask you to authorize
   - Automatically save the access token to your `.env` file

6. **Open your `.env` file** and you'll see a new line:
   ```env
   VITE_CLIO_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

7. **Copy that long token** (the part after `VITE_CLIO_API_KEY=`)

### Step 2: Add Just the Access Token to Vercel

1. **Go to Vercel:** https://vercel.com/dashboard

2. **Click your project** → Settings → Environment Variables

3. **Add two variables:**

   **First:**
   - Name: `VITE_CLIO_API_KEY`
   - Value: *Paste the access token you just copied*
   - ✅ Production ✅ Preview ✅ Development
   - Click **Save**

**Second:**
- Name: `VITE_CLIO_API_BASE_URL`
- Value: `/api/clio`
  - ✅ Production ✅ Preview ✅ Development
  - Click **Save**

4. **Redeploy:**
   - Deployments tab → ... → Redeploy

### Done! ✅

Your Vercel app will now use the access token to connect to Clio!

---

## Alternative: Add Client Credentials Directly to Vercel

**⚠️ Warning:** This exposes your client secret in the browser bundle, which is not ideal for security.

If you still want to do this:

### Add to Vercel:

1. **Go to:** Your Project → Settings → Environment Variables

2. **Add three variables:**

   ```
   Name:  VITE_CLIO_CLIENT_ID
   Value: your_client_id_here
   ✅ Production ✅ Preview ✅ Development
   ```

   ```
   Name:  VITE_CLIO_CLIENT_SECRET
   Value: your_client_secret_here
   ✅ Production ✅ Preview ✅ Development
   ```

   ```
   Name:  VITE_CLIO_API_BASE_URL
Value: /api/clio
   ✅ Production ✅ Preview ✅ Development
   ```

3. **Update Redirect URI in Clio:**
   - Go to https://app.clio.com/settings/api_keys
   - Edit your app
   - Add redirect URI: `https://your-app.vercel.app/callback`
   - (Replace `your-app` with your actual Vercel domain)

4. **Add Redirect URI to Vercel:**
   ```
   Name:  VITE_CLIO_REDIRECT_URI
   Value: https://your-app.vercel.app/callback
   ✅ Production ✅ Preview ✅ Development
   ```

5. **Redeploy**

---

## Which Method Should You Use?

### ✅ Recommended: Access Token Method (Step 1)

**Pros:**
- More secure (client secret stays on your computer)
- Simpler Vercel setup
- Works immediately

**Cons:**
- Token expires (need to refresh periodically)
- Need to run OAuth locally once

### ⚠️ Alternative: Client Credentials Method

**Pros:**
- Can run OAuth flow from Vercel app

**Cons:**
- Less secure (client secret exposed in browser)
- More complex setup
- Need to configure callback URLs

---

## When Tokens Expire

Access tokens from Clio expire after some time. When that happens:

### Option 1: Get a New Token Locally

1. Run `npm run clio:auth` locally again
2. Copy the new token from `.env`
3. Update it in Vercel (Settings → Environment Variables)
4. Redeploy

### Option 2: Use Refresh Token (Advanced)

If your `.env` has a `VITE_CLIO_REFRESH_TOKEN`, you can set up automatic token refresh. This requires additional backend code (not included in the current dashboard).

---

## Visual Guide: Adding Variables to Vercel

1. **Login to Vercel**
2. **Click your project name**
3. **Click "Settings" tab** (top of page)
4. **Click "Environment Variables"** (left sidebar)
5. **You'll see this:**

```
┌────────────────────────────────────────────┐
│  Environment Variables                      │
│                                             │
│  [Add New] button                          │
│                                             │
│  No environment variables yet.              │
└────────────────────────────────────────────┘
```

6. **Click "Add New" and fill in:**

```
┌────────────────────────────────────────────┐
│  Name                                       │
│  ┌──────────────────────────────────────┐ │
│  │ VITE_CLIO_API_KEY                    │ │
│  └──────────────────────────────────────┘ │
│                                             │
│  Value                                      │
│  ┌──────────────────────────────────────┐ │
│  │ eyJhbGciOiJIUzI1NiIsInR5cCI6...    │ │
│  └──────────────────────────────────────┘ │
│                                             │
│  Environments to add to                     │
│  ☑ Production                               │
│  ☑ Preview                                  │
│  ☑ Development                              │
│                                             │
│         [Cancel]  [Save]                    │
└────────────────────────────────────────────┘
```

7. **Repeat for `VITE_CLIO_API_BASE_URL`**

8. **After adding both, redeploy!**

---

## Quick Reference

**Where to add variables:**
```
Vercel → Your Project → Settings → Environment Variables
```

**What to add (Recommended):**
```
VITE_CLIO_API_KEY=<your_access_token>
VITE_CLIO_API_BASE_URL=/api/clio
```

**How to get access token:**
```bash
npm run clio:auth
# Then copy from .env file
```

**After adding/changing:**
```
Deployments → ... → Redeploy
```

---

## Need Help?

Check the main [VERCEL_SETUP.md](VERCEL_SETUP.md) for general Vercel deployment help.
