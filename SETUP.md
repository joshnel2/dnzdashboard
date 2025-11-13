# Quick Setup Guide

## Step-by-Step Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Clio API

Create `.env` file:
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```
VITE_CLIO_API_KEY=your_api_key_here
VITE_CLIO_API_BASE_URL=/api/clio
```

### 3. Start Development Server
```bash
npm run dev
```

Open browser to: `http://localhost:3000`

### 4. (Optional) Build for Production
```bash
npm run build
npm run preview
```

## Dashboard Overview

### Layout Structure

```
┌─────────────┬──────────────────────────────────────┐
│             │  Attorney Billable Hours (Bar Chart) │
│   Monthly   ├──────────────────────────────────────┤
│  Deposits   │  Weekly Revenue (Bar Chart)          │
│             ├──────────────────────────────────────┤
│  (Big Bar)  │  YTD Time Tracking (Bar Chart)       │
│             ├──────────────────────────────────────┤
│  20% width  │  YTD Revenue (Bar Chart)             │
│  Full Height│                                       │
└─────────────┴──────────────────────────────────────┘
```

### Features at a Glance

**Left Panel:**
- ✨ Gradient background (purple to blue)
- 💰 Current month total deposits
- 🔄 Animated icon

**Top Right - Attorney Hours:**
- 📊 Horizontal bars showing each attorney's billable hours
- 🎨 Color-coded for easy visual distinction
- 📈 Sorted by hours (highest to lowest)

**Second - Weekly Revenue:**
- 📅 Last 12 weeks of revenue
- 💵 Dollar amounts formatted as currency
- 📊 Green bars for positive growth visualization

**Third - YTD Time:**
- 📆 Monthly breakdown since start of year
- ⏱️ Total billable hours across all attorneys
- 📊 Blue bars with month labels

**Bottom - YTD Revenue:**
- 💰 Monthly revenue since start of year
- 📈 Trend analysis across months
- 📊 Pink/rose colored bars

## Sample Data Mode

**No API key?** No problem! The dashboard will automatically use sample data if:
- `.env` file is not configured
- API connection fails
- Invalid credentials

This allows you to preview the dashboard immediately.

## Common Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install all dependencies |
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

## Next Steps

1. **Customize Colors**: Edit CSS files in `src/components/`
2. **Adjust Refresh Rate**: Modify `App.tsx` (default: 5 minutes)
3. **Add More Metrics**: Extend `clioService.ts` with additional API calls
4. **Deploy**: Build and deploy `dist/` folder to your hosting provider

## Troubleshooting

**Dashboard shows sample data:**
- Check `.env` file exists
- Verify API credentials are correct
- Check browser console for errors

**Charts not displaying:**
- Ensure all dependencies installed
- Clear browser cache
- Check console for errors

**API errors:**
- Verify Clio API key is active
- Check API base URL is correct
- Ensure proper permissions on Clio account

---

For complete documentation, see [README.md](README.md)
