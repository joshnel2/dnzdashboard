# Simple Setup Guide (No Coding Required!)

## What You Need

Just **2 things** from Clio:
1. Your **Access Token** (or API Key)
2. The **API URL** (already provided below)

---

## Step-by-Step: Create Your Environment Variables File

### Step 1: Create a Text File

**On Windows:**
1. Open **Notepad** (search for it in Start menu)
2. Leave it open for Step 2

**On Mac:**
1. Open **TextEdit** (in Applications > Utilities)
2. Go to Format → Make Plain Text
3. Leave it open for Step 2

**On Linux:**
1. Open any text editor (gedit, nano, vim, etc.)
2. Leave it open for Step 2

---

### Step 2: Copy and Paste This Into the File

```
VITE_CLIO_API_KEY=PUT_YOUR_TOKEN_HERE
VITE_CLIO_API_BASE_URL=https://app.clio.com/api/v4
```

---

### Step 3: Replace `PUT_YOUR_TOKEN_HERE` with Your Actual Token

**How to get your token from Clio:**

1. **Log in to Clio** at https://app.clio.com

2. **Click your profile picture** (top right corner)

3. **Go to Settings** → **Integrations** → **API Credentials**
   
   *Or just visit:* https://app.clio.com/settings/api_keys

4. **Click "Generate New Key"** or **"Create Application"**

5. **Copy the key/token** that appears (it's a long string of letters and numbers)

6. **Paste it** in your text file, replacing `PUT_YOUR_TOKEN_HERE`

**Example of what it should look like:**
```
VITE_CLIO_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
VITE_CLIO_API_BASE_URL=https://app.clio.com/api/v4
```

---

### Step 4: Save the File

**IMPORTANT: The filename must be exactly:** `.env`

**On Windows (Notepad):**
1. Click **File** → **Save As**
2. Navigate to your dashboard project folder
3. In "File name" type: `.env` (include the dot!)
4. In "Save as type" select: **All Files (*.*)**
5. Click **Save**

**On Mac (TextEdit):**
1. Click **File** → **Save**
2. Navigate to your dashboard project folder
3. Name it: `.env` (include the dot!)
4. If it warns about starting with a period, click "Use ."
5. Click **Save**

**On Linux:**
1. Save the file in your dashboard project folder as `.env`

---

### Step 5: Verify It Worked

**The file should be:**
- Located in the **root folder** of the dashboard project (same folder as `package.json`)
- Named exactly: `.env` (starts with a dot, no other extension like `.txt`)
- Contains your actual Clio token

**To check if the file is there:**

**Windows:** Open Command Prompt in the project folder and type:
```
dir /a .env
```

**Mac/Linux:** Open Terminal in the project folder and type:
```
ls -la .env
```

You should see the `.env` file listed.

---

## That's It! You're Done! ✅

Now just run:
```bash
npm install
npm run dev
```

The dashboard will automatically read your environment variables from the `.env` file!

---

## Common Issues

### ❌ "File not found" or "Still showing sample data"

**Problem:** The file isn't named correctly or in the wrong location

**Fix:**
1. Make sure the filename is **exactly** `.env` (with the dot at the start)
2. Make sure it's in the **root folder** (same folder as `package.json`, `README.md`, etc.)
3. Make sure it's **not** named `.env.txt` (Windows sometimes adds .txt automatically)

### ❌ "401 Unauthorized" error

**Problem:** Invalid or expired token

**Fix:**
1. Go back to Clio and generate a **new** API key
2. Copy the new key
3. Open `.env` and replace the old token with the new one
4. Save the file
5. Restart the dashboard (`npm run dev`)

### ❌ Can't see the `.env` file

**Problem:** Hidden files are not shown

**Windows Fix:**
1. Open File Explorer
2. Click **View** tab
3. Check **"Hidden items"**

**Mac Fix:**
1. In Finder, press: `Command + Shift + .` (period)
2. This shows hidden files

---

## What ARE Environment Variables?

Think of them like **settings** for your app:
- The `.env` file is just a **text file** with settings
- Each line is a `NAME=VALUE` pair
- The app reads these when it starts
- **No coding required!** Just edit the text file

It's like filling out a form - you're just providing the information the app needs!

---

## Need to Change Your Token Later?

1. Open the `.env` file in Notepad/TextEdit
2. Change the value after `VITE_CLIO_API_KEY=`
3. Save the file
4. Restart the dashboard

---

## Still Confused?

You can also set these as **actual system environment variables** if you prefer:

**Windows:**
1. Search for "Environment Variables" in Start menu
2. Click "Edit the system environment variables"
3. Click "Environment Variables" button
4. Under "User variables" click "New"
5. Variable name: `VITE_CLIO_API_KEY`
6. Variable value: Your Clio token
7. Click OK

**Mac/Linux:**
Add to your `~/.bashrc` or `~/.zshrc`:
```bash
export VITE_CLIO_API_KEY="your_token_here"
export VITE_CLIO_API_BASE_URL="https://app.clio.com/api/v4"
```

Then run: `source ~/.bashrc` (or `source ~/.zshrc`)

---

**But honestly, the `.env` file is easier!** 😊
