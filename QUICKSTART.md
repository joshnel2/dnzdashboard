# Quick Start - Connect to Clio in 3 Steps

## Step 1: Install Dependencies
```bash
npm install
```

## Step 2: Get Clio Credentials

### Option A: Automated OAuth (Easiest)

1. Go to https://app.clio.com/settings/api_keys
2. Create a new application:
   - Name: "Law Firm Dashboard"
   - Redirect URI: `http://localhost:3000/callback`
3. Copy the **Client ID** and **Client Secret**
4. Create `.env` file:
   ```bash
   cp .env.example .env
   ```
5. Add to `.env`:
   ```env
   VITE_CLIO_CLIENT_ID=your_client_id_here
   VITE_CLIO_CLIENT_SECRET=your_client_secret_here
   ```
6. Run the auth helper:
   ```bash
   npm run clio:auth
   ```
   This will open Clio in your browser and automatically save your access token.

### Option B: Manual API Key (Simpler)

1. Go to https://app.clio.com/settings/api_keys
2. Click "Generate New Key"
3. Copy the key
4. Create `.env` file:
   ```bash
   cp .env.example .env
   ```
5. Add to `.env`:
   ```env
   VITE_CLIO_API_KEY=your_api_key_here
   VITE_CLIO_API_BASE_URL=https://app.clio.com/api/v4
   ```

## Step 3: Run the Dashboard
```bash
npm run dev
```

Open http://localhost:3000

## What You'll See

✅ **With Clio connected:** Real data from your law firm
- Actual attorney billable hours
- Real revenue numbers
- Current YTD metrics

⚠️ **Without Clio configured:** Sample demo data
- The dashboard will still work
- Shows example data for preview

## Troubleshooting

### "Failed to load dashboard data"
- Check your `.env` file exists
- Verify the access token is correct
- Make sure there are no extra spaces in `.env`

### Still seeing sample data?
- Restart the dev server (`npm run dev`)
- Check browser console (F12) for errors
- Verify `.env` values with `echo $VITE_CLIO_API_KEY` (will be empty if not loaded)

### Token expired?
- OAuth tokens expire after ~8 hours
- Run `npm run clio:auth` again to refresh
- Or manually get a new access token from Clio

## Need More Help?

📖 **Detailed Instructions:** [CLIO_SETUP.md](CLIO_SETUP.md)
📚 **Full Documentation:** [README.md](README.md)
🔗 **Clio API Docs:** https://docs.clio.com/

---

**That's it!** You should now have a working dashboard connected to your Clio account.
