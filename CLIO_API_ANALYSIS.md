# Clio API Integration - Deep Dive Analysis

## Issue Discovery

Based on console logs:
- ✅ `/api/clio/activities` - Returns 200 (Working)
- ❌ `/api/clio/time-entries` - Returns 404 (Failing)

## Root Cause Investigation

### 1. URL Encoding Issue

The `fields` parameter contains special characters:
```
fields=user{id,name},date,quantity,price
```

**Problem**: Double URL encoding
- Axios automatically encodes params: `user%7Bid%2Cname%7D%2Cdate%2Cquantity%2Cprice`
- Then proxy encodes again: `user%257Bid%252Cname%257D%252Cdate%252Cquantity%252Cprice`

**Clio API rejects double-encoded URLs!**

### 2. Clio API v4 Requirements

According to Clio API documentation:

#### Authentication
- Header: `Authorization: Bearer {access_token}`
- Token obtained via OAuth 2.0 flow

#### Time Entries Endpoint
```
GET /api/v4/time_entries.json
```

**Required Headers:**
- `Authorization: Bearer {token}`
- `Content-Type: application/json`

**Query Parameters:**
- `fields`: Comma-separated list, supports nested fields with `{}`
- `since`: ISO 8601 timestamp
- `order`: Optional (e.g., `date(asc)`)

**Example:**
```
GET /api/v4/time_entries.json?fields=id,date,quantity,price,user{id,name}&since=2025-01-01T00:00:00.000Z
```

#### Activities Endpoint
```
GET /api/v4/activities.json
```

**Query Parameters:**
- `type`: Activity type (e.g., `Payment`)
- `since`: ISO 8601 timestamp
- `fields`: Optional fields to return

### 3. Current Implementation Issues

**Issue A: Double URL Encoding**
```typescript
// Frontend (clioService.ts) - Axios encodes params
clioApi.get('/time-entries', {
  params: {
    fields: 'user{id,name},date,quantity,price'  // Axios encodes this
  }
})

// Backend (time-entries.ts) - Encodes AGAIN
const encodedFields = encodeURIComponent(fields as string);  // ❌ Double encoding!
```

**Issue B: 404 vs 500 Errors**
- 404 = Vercel can't find the serverless function file
- Could be deployment issue or file naming

**Issue C: Inconsistent Error Handling**
- Activities endpoint lacks error checking
- Time entries has better error handling but still fails

## Correct Implementation

### Solution 1: Fix URL Encoding

**Don't double-encode!** Let Axios handle encoding, proxy should pass through as-is.

```typescript
// Backend proxy - DON'T re-encode
const url = new URL(`${baseUrl}/api/v4/time_entries.json`);
url.searchParams.append('since', since as string);
url.searchParams.append('fields', fields as string);  // Already encoded by axios
```

### Solution 2: Simplify Architecture

**Option A: Single Unified Proxy**
Instead of separate files, use one proxy that routes to different Clio endpoints.

**Option B: Keep Separate But Fix Encoding**
Fix the encoding issue in both proxy files.

### Solution 3: Add Response Caching
Clio has rate limits. Cache responses for 1-5 minutes.

## Recommended Fix

1. **Fix proxy URL encoding** - Don't double-encode
2. **Add better logging** - See exact URLs being called
3. **Match activities pattern** - It works, so replicate it
4. **Add error details** - Return Clio's actual error messages
