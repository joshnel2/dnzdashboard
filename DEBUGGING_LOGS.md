# Debugging Logs Guide

## Overview

Comprehensive logging has been added throughout the application to help debug Clio API data issues. All logs are output to the browser console (F12 → Console tab).

## How to View Logs

1. **Open your deployed Vercel app** in the browser
2. **Press F12** to open Developer Tools
3. **Click on the "Console" tab**
4. **Refresh the page** to see all logs from the beginning

## Log Emoji Legend

| Emoji | Meaning |
|-------|---------|
| 🚀 | Application startup |
| 🔍 | Data fetching initiated |
| 📅 | Date/time information |
| 📄 | Pagination progress |
| 🔐 | Authentication/token info |
| ✅ | Success |
| ❌ | Error |
| ⚠️  | Warning |
| 💰 | Payment/revenue data |
| ⏱️  | Time entry data |
| 👥 | Attorney/user data |
| 📊 | Chart/visualization data |
| 🔄 | Data transformation |
| 📈 | Calculated metrics |

## Log Flow

### 1. Application Startup
```
🚀 [App] Starting data fetch...
🔑 [App] Token status: { hasToken: true, tokenLength: 64, tokenPreview: "abc123..." }
```

**What to check:**
- ✅ `hasToken: true` - Token exists in localStorage
- ❌ `hasToken: false` - User needs to authenticate

### 2. API Request Phase
```
🔍 [ClioService] Fetching dashboard data...
📅 Date range: { startOfYear: "2025-01-01T00:00:00.000Z", now: "2025-10-24T...", year: 2025, month: 10 }
🔐 [ClioAPI] Request to: /time_entries.json { hasAuth: true, tokenPreview: "abc123...", params: {...} }
```

**What to check:**
- Date range is correct (should be from Jan 1 of current year)
- Token is being sent with request
- Request parameters include proper filters

### 3. Pagination Progress
```
📄 [ClioService] Fetching paginated data from /time_entries.json...
📄 Fetching page 1...
📄 Page 1 response: { status: 200, dataCount: 200, meta: {...} }
📊 Progress: 200 / 450
📄 Fetching page 2...
📄 Page 2 response: { status: 200, dataCount: 200, meta: {...} }
📊 Progress: 400 / 450
📄 Fetching page 3...
✅ All pages fetched. Total: 450 records
```

**What to check:**
- Pages are being fetched (should see multiple page numbers)
- Progress shows increasing counts
- Final total matches expected data volume
- ⚠️  If you only see "Page 1" and no more, pagination might not be working correctly

### 4. Data Retrieved
```
✅ [ClioService] All data fetched
📊 [ClioService] Total data counts: { timeEntries: 450, activities: 125 }
⏱️  Sample time entries: [{ id: 123, user: { name: "John Doe" }, date: "2025-10-01", quantity: 2.5, price: 375 }, ...]
💰 Sample activities: [{ id: 456, date: "2025-10-15", total: 1500, type: "Payment" }, ...]
```

**What to check:**
- Both timeEntries and activities have counts > 0
- Sample data looks correct (has proper fields)
- ⚠️  If counts are 0, check warnings below

### 5. Alternative Endpoints (if activities = 0)
```
⚠️  Activities endpoint returned no data. Trying alternative approaches...
💰 Trying activities endpoint without type filter...
✅ Got activities without type filter: { total: 500, types: ["Payment", "Invoice", "TimeEntry", ...] }
💰 Filtered to 125 payment-related activities
```

**What this means:**
- First attempt with type=Payment filter returned nothing
- System tried without filter and found activities
- Filtered results to payment-related only

### 6. Data Transformation
```
🔄 [ClioService] Starting data transformation...
📅 Current period: { month: 10, year: 2025, monthName: "October" }
💰 Monthly Deposits Calculation: { totalActivities: 125, currentMonthActivities: 15, monthlyDeposits: 42500, ... }
👥 Attorney Billable Hours: { totalTimeEntries: 450, currentMonthEntries: 52, uniqueAttorneys: 7, attorneyHours: [...] }
📈 Weekly Revenue: { weeksCount: 12, data: [...] }
⏱️  YTD Time: { monthsCount: 10, data: [...] }
💵 YTD Revenue: { monthsCount: 10, data: [...] }
```

**What to check:**
- `currentMonthActivities` and `currentMonthEntries` are > 0 for current month data
- `uniqueAttorneys` matches expected attorney count
- `weeksCount` should be 12
- `monthsCount` should match months elapsed in current year

### 7. Chart Rendering
```
📊 [MonthlyDepositsBar] Rendering with amount: 42500
📊 [AttorneyBillableHours] Rendering with data: { dataLength: 7, data: [...] }
📊 [WeeklyRevenue] Rendering with data: { dataLength: 12, data: [...] }
📊 [YTDTime] Rendering with data: { dataLength: 10, data: [...] }
📊 [YTDRevenue] Rendering with data: { dataLength: 10, data: [...] }
```

**What to check:**
- All charts receive data with dataLength > 0
- Data arrays contain expected number of items

### 8. Success
```
🎉 [App] Dashboard rendered successfully
```

## Common Issues and Solutions

### Issue 1: No Data Showing in Charts

**Symptoms:**
```
⚠️  No time entries found!
⚠️  No activities found!
📊 [ClioService] Total data counts: { timeEntries: 0, activities: 0 }
```

**Possible Causes:**
1. **No data in Clio for current year**
   - Check Clio account has time entries and payments for 2025
   
2. **Date filter too restrictive**
   - Look at the `Date range` log - is `startOfYear` correct?
   
3. **API permissions**
   - Check if app has read permissions for time_entries and activities
   
4. **Wrong endpoint**
   - Check if your Clio instance uses different endpoint names

**Solutions:**
- Verify data exists in Clio web interface
- Check app permissions in Clio settings
- Review the sample data in logs to see structure

### Issue 2: Only Showing Page 1 of Data

**Symptoms:**
```
📄 Fetching page 1...
📄 Page 1 response: { status: 200, dataCount: 200, meta: null }
✅ All pages fetched. Total: 200 records
```

**Possible Causes:**
- Clio API might not return pagination metadata
- Our pagination detection logic needs adjustment

**What to check:**
- Look at the `meta` field - is it null or does it have pagination info?
- Check if `dataCount` is exactly 200 (the page limit)
- If dataCount < 200, there might genuinely be only one page

### Issue 3: Authentication Errors

**Symptoms:**
```
❌ [ClioAPI] Request failed: { url: "/time_entries.json", status: 401, statusText: "Unauthorized" }
🔒 [App] Unauthorized - removing token and requesting re-auth
```

**Possible Causes:**
1. Token expired
2. Token invalid
3. Token doesn't have required permissions

**Solutions:**
- Re-authenticate through the OAuth flow
- Check token in localStorage is correct
- Verify app permissions in Clio

### Issue 4: Current Month Shows Zero

**Symptoms:**
```
💰 Monthly Deposits Calculation: { totalActivities: 125, currentMonthActivities: 0, monthlyDeposits: 0 }
```

**Possible Causes:**
1. No activities recorded in current month
2. Date filtering issue
3. Activities have future dates

**What to check:**
- Look at sample activities dates: are they in the current month?
- Check the `Current period` log shows correct month/year
- Verify activities exist for current month in Clio

### Issue 5: Empty Activities Array

**Symptoms:**
```
⚠️  Activities endpoint returned no data. Trying alternative approaches...
💰 Trying activities endpoint without type filter...
✅ Got activities without type filter: { total: 500, types: ["Invoice", "TimeEntry", "Expense"] }
💰 Filtered to 0 payment-related activities
```

**Possible Causes:**
1. No activities with type="Payment" in Clio
2. Clio uses different activity type names
3. Wrong endpoint for payment data

**Solutions:**
- Check the `types` array in the log - what activity types exist?
- You might need to adjust the type filter in the code
- Consider using different endpoints like `/bill_payments.json`

## Interpreting the Data Structure

### Time Entry Structure
```javascript
{
  id: 12345,
  user: {
    id: 67890,
    name: "John Doe"
  },
  date: "2025-10-15",
  quantity: 2.5,  // hours
  price: 375.00   // dollars
}
```

### Activity Structure
```javascript
{
  id: 54321,
  date: "2025-10-15",
  total: 1500.00,  // dollars
  type: "Payment"
}
```

## Vercel Deployment Specific

When viewing logs on Vercel:
1. Logs appear in the browser console (client-side)
2. Server-side logs (if any) appear in Vercel dashboard
3. Make sure to check both if issues persist

## Next Steps

Based on the logs, you can:

1. **Identify missing data** - Check which arrays are empty
2. **Verify API responses** - Look at sample data structure
3. **Check date filters** - Ensure date ranges are correct
4. **Monitor pagination** - Verify all pages are fetched
5. **Validate transformations** - Ensure calculations are correct

## Getting Help

When reporting issues, please include:
1. Complete console log output
2. Specific error messages
3. Sample data structure from logs
4. Expected vs actual behavior

---

**Remember:** Open browser console (F12) on your Vercel deployment to see all these logs in action!
