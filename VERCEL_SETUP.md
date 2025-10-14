# Deploy to Vercel (No Coding Required!)

## Setup in 3 Easy Steps

### Step 1: Get Your Clio API Token

1. **Log in to Clio** at https://app.clio.com

2. **Click your profile picture** (top right)

3. **Go to:** Settings → Integrations → API Credentials
   
   Or visit directly: https://app.clio.com/settings/api_keys

4. **Click "Generate New Key"**

5. **Copy the token** - it's a long string of letters/numbers like:
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

6. **Keep this window open** - you'll paste it in Step 3

---

### Step 2: Deploy to Vercel

**Option A: Deploy from GitHub (Recommended)**

1. **Push your code to GitHub** (if not already done)

2. **Go to Vercel** at https://vercel.com

3. **Click "Add New Project"**

4. **Import your GitHub repository:**
   - Click "Import" next to your dashboard repo
   - Vercel will automatically detect it's a Vite app

5. **Don't click Deploy yet!** - Go to Step 3 first

**Option B: Deploy with Vercel CLI**

```bash
npm install -g vercel
vercel
```

Then follow the prompts. Before deploying, do Step 3.

---

### Step 3: Add Environment Variables in Vercel

This is where you put your Clio token - **super easy, just a web form!**

1. **In your Vercel project**, look for the **"Environment Variables"** section
   
   (It's shown during initial setup, or go to: Project Settings → Environment Variables)

2. **Add your first variable:**
   - **Name:** `VITE_CLIO_API_KEY`
   - **Value:** Paste your Clio token from Step 1
   - Select: **Production**, **Preview**, and **Development**
   - Click **"Add"**

3. **Add your second variable:**
   - **Name:** `VITE_CLIO_API_BASE_URL`
   - **Value:** `https://app.clio.com/api/v4`
   - Select: **Production**, **Preview**, and **Development**
   - Click **"Add"**

**Screenshot guide:**
```
┌─────────────────────────────────────────┐
│ Environment Variables                    │
├─────────────────────────────────────────┤
│ Name:  VITE_CLIO_API_KEY               │
│ Value: eyJhbGciOiJIUzI1NiIsInR...      │
│ ☑ Production ☑ Preview ☑ Development   │
│        [Add] button                      │
├─────────────────────────────────────────┤
│ Name:  VITE_CLIO_API_BASE_URL          │
│ Value: https://app.clio.com/api/v4     │
│ ☑ Production ☑ Preview ☑ Development   │
│        [Add] button                      │
└─────────────────────────────────────────┘
```

4. **Click "Deploy"** (or "Redeploy" if already deployed)

---

### That's It! ✅

Your dashboard is now live and connected to Clio!

Vercel will give you a URL like:
```
https://your-dashboard.vercel.app
```

---

## How to Add/Update Environment Variables Later

1. **Go to Vercel Dashboard:** https://vercel.com/dashboard

2. **Click on your project**

3. **Go to:** Settings → Environment Variables

4. **To add a new variable:**
   - Click "Add New"
   - Enter Name and Value
   - Select environments (Production/Preview/Development)
   - Click "Save"

5. **To edit an existing variable:**
   - Click the "..." menu next to the variable
   - Click "Edit"
   - Update the value
   - Click "Save"

6. **IMPORTANT:** After changing variables:
   - Go to the "Deployments" tab
   - Click "..." on the latest deployment
   - Click "Redeploy"
   - This applies your new environment variables

---

## Visual Guide with Screenshots

### Where to Find Environment Variables in Vercel

1. **From Project Dashboard:**
   ```
   Your Project → Settings (tab) → Environment Variables (left menu)
   ```

2. **Direct URL format:**
   ```
   https://vercel.com/YOUR_USERNAME/YOUR_PROJECT/settings/environment-variables
   ```

### What It Looks Like

When you add variables, you'll see a form like this:

```
╔════════════════════════════════════════════╗
║  Add Environment Variable                   ║
╠════════════════════════════════════════════╣
║  Name                                       ║
║  ┌──────────────────────────────────────┐ ║
║  │ VITE_CLIO_API_KEY                    │ ║
║  └──────────────────────────────────────┘ ║
║                                             ║
║  Value                                      ║
║  ┌──────────────────────────────────────┐ ║
║  │ eyJhbGciOiJIUzI1NiIsInR5cCI6Ikp...  │ ║
║  └──────────────────────────────────────┘ ║
║                                             ║
║  Environments                               ║
║  ☑ Production                               ║
║  ☑ Preview                                  ║
║  ☑ Development                              ║
║                                             ║
║          [Cancel]  [Save]                   ║
╚════════════════════════════════════════════╝
```

Just fill in the boxes and click Save!

---

## Testing Your Deployment

1. **Visit your Vercel URL**

2. **Open the dashboard**

3. **Check if it's working:**
   - ✅ **Real data?** Success! You're connected to Clio
   - ⚠️ **Sample data?** Environment variables may not be set correctly

4. **If you see sample data:**
   - Go back to Vercel → Settings → Environment Variables
   - Verify both variables are there:
     - `VITE_CLIO_API_KEY`
     - `VITE_CLIO_API_BASE_URL`
   - Make sure they're checked for "Production"
   - Redeploy the project

---

## Troubleshooting

### ❌ "Failed to load dashboard data"

**Possible causes:**
1. Environment variables not set in Vercel
2. Clio token is invalid or expired
3. Variables set but deployment not redeployed

**Fix:**
1. Check Vercel → Settings → Environment Variables
2. Verify the token in Clio is still active
3. Redeploy: Deployments → ... → Redeploy

### ❌ Still showing sample data after deploying

**Fix:**
1. Open browser console (F12)
2. Look for API errors
3. Most common: Variables not applied to deployment
4. Solution: Go to Deployments → Redeploy

### ❌ "401 Unauthorized" error

**Problem:** Clio token expired or invalid

**Fix:**
1. Go to Clio and generate a **new** API key
2. Copy the new key
3. Go to Vercel → Settings → Environment Variables
4. Edit `VITE_CLIO_API_KEY`
5. Paste the new key
6. Save
7. Redeploy

---

## Security Note

✅ **Environment variables in Vercel are secure!**
- They're encrypted
- Not visible in your code
- Not exposed to the browser (server-side only)
- Only you (the project owner) can see/edit them

---

## Need to Change Your Token Later?

Super easy:

1. Generate new token in Clio
2. Go to Vercel → Your Project → Settings → Environment Variables  
3. Click "..." next to `VITE_CLIO_API_KEY`
4. Click "Edit"
5. Paste new token
6. Save
7. Redeploy

**That's it!** No code changes needed!

---

## Pro Tips

💡 **Tip 1:** Always check all three environments when adding variables:
- ✅ Production (live site)
- ✅ Preview (test deployments)
- ✅ Development (local testing)

💡 **Tip 2:** After any environment variable change, you MUST redeploy

💡 **Tip 3:** You can test locally with Vercel CLI:
```bash
vercel env pull .env.local
npm run dev
```

💡 **Tip 4:** Keep your Clio token safe! Never share it or commit it to GitHub

---

## Quick Reference

**Vercel Dashboard:** https://vercel.com/dashboard

**Environment Variables Location:**
```
Project → Settings → Environment Variables
```

**Variables You Need:**
```
VITE_CLIO_API_KEY=your_clio_token
VITE_CLIO_API_BASE_URL=https://app.clio.com/api/v4
```

**After changes:**
```
Deployments → ... → Redeploy
```

---

**Questions?** Check out [Vercel's Environment Variables Docs](https://vercel.com/docs/concepts/projects/environment-variables)
