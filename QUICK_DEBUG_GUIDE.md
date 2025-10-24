# Quick Debug Guide - 30 Second Checklist

## Open Browser Console on Vercel

Press **F12** → Click **Console** tab → Refresh page

## What to Look For

### ✅ Good Signs (Data is Loading)
```
✅ All pages fetched. Total: 450 records
📊 Total data counts: { timeEntries: 450, activities: 125 }
🎉 Dashboard rendered successfully
```
**Action:** Data should appear in charts! ✨

### ⚠️  Warning Signs (Need Investigation)
```
⚠️  No time entries found!
⚠️  No activities found!
```
**Action:** Read full logs to see why. Common causes:
- No data in Clio for current year
- API permissions issue
- Wrong endpoint configuration

### ❌ Error Signs (Need Fix)
```
❌ [ClioAPI] Request failed: { status: 401 }
🔒 Unauthorized - removing token
```
**Action:** Token expired - need to re-authenticate

## Quick Fixes

| Issue | Log Message | Fix |
|-------|-------------|-----|
| No token | `hasToken: false` | Click auth button in app |
| Token expired | `status: 401` | Re-authenticate through OAuth |
| No permissions | `status: 403` | Check Clio app permissions |
| No data in Clio | `timeEntries: 0, activities: 0` | Add data to Clio for 2025 |
| API endpoint wrong | `status: 404` | Check logs for endpoint URL |

## Pagination Check

Should see something like:
```
📄 Fetching page 1...
📄 Fetching page 2...
📄 Fetching page 3...
✅ All pages fetched. Total: 650 records
```

If you only see "page 1" but expect more data, check the page 1 response:
- If `dataCount: 200` and `meta: null`, pagination might need adjustment
- If `dataCount: < 200`, that might be all your data

## Data in Charts Check

Each chart should log:
```
📊 [MonthlyDepositsBar] Rendering with amount: 42500
📊 [WeeklyRevenue] Rendering with data: { dataLength: 12 }
📊 [YTDRevenue] Rendering with data: { dataLength: 10 }
```

If `dataLength: 0` or `amount: 0`, the data didn't make it to the chart.

## Most Common Issue

**"I see data in logs but not in charts"**

Check:
1. Data counts are > 0 in transformation logs
2. Current month has data (check `currentMonthActivities` and `currentMonthEntries`)
3. Chart rendering logs show data being passed
4. Browser console errors (red messages)

## For More Details

- Full logging guide: `DEBUGGING_LOGS.md`
- Changes summary: `CHANGES_SUMMARY.md`

---

**Remember:** All logs are in the **browser console** (F12), not the terminal! 🔍
