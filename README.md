# Law Firm Dashboard

A comprehensive financial and performance dashboard for law firms, integrated with the Clio API to display real-time metrics and analytics.

## Features

### Dashboard Layout

The dashboard features a unique split-screen layout:

**Left Panel (20% width):**
- **Monthly Deposits Bar** - Full-height display showing total monthly revenue with an attractive gradient background

**Right Panel (80% width, 4 stacked sections):**
1. **Attorney Billable Hours** - Horizontal bar chart showing billable hours per attorney with color-coded bars
2. **Weekly Revenue** - Bar chart displaying revenue trends over the last 12 weeks
3. **YTD Time Tracking** - Year-to-date billable hours by month across the entire firm
4. **YTD Revenue** - Year-to-date revenue by month with visual trend analysis

### Data Sources

All metrics are pulled from the Clio API:
- Time entries for billable hours
- Activities/payments for revenue tracking
- Automatic data refresh every 5 minutes
- Sample data mode for demonstration when API is not configured

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Clio API credentials (API key and base URL)

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Clio API:**
   
   Create a `.env` file in the root directory:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your Clio credentials:
   ```
   VITE_CLIO_API_KEY=your_actual_api_key_here
   VITE_CLIO_API_BASE_URL=https://app.clio.com/api/v4
   ```

   **How to get Clio API credentials:**
   - Log in to your Clio account
   - Navigate to Settings > Integrations > API
   - Generate a new API key
   - Copy the key to your `.env` file

3. **Run the development server:**
   ```bash
   npm run dev
   ```

   The dashboard will be available at `http://localhost:3000`

4. **Build for production:**
   ```bash
   npm run build
   ```

   The built files will be in the `dist` directory.

## Project Structure

```
law-firm-dashboard/
├── src/
│   ├── components/          # React components
│   │   ├── Dashboard.tsx    # Main dashboard layout
│   │   ├── MonthlyDepositsBar.tsx
│   │   ├── AttorneyBillableHours.tsx
│   │   ├── WeeklyRevenue.tsx
│   │   ├── YTDTime.tsx
│   │   └── YTDRevenue.tsx
│   ├── services/
│   │   └── clioService.ts   # Clio API integration
│   ├── types.ts             # TypeScript type definitions
│   ├── App.tsx              # Root application component
│   ├── main.tsx             # Application entry point
│   └── index.css            # Global styles
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .env                     # API configuration (create this)
```

## Technology Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Recharts** - Data visualization library
- **Axios** - HTTP client for API calls
- **Clio API v4** - Data source

## Clio API Integration

The dashboard fetches the following data from Clio:

### Endpoints Used

1. **Time Entries** (`/api/v4/time_entries`)
   - Used for attorney billable hours
   - Used for YTD time tracking
   - Filters: `since` (start of year), fields for user info and time data

2. **Activities** (`/api/v4/activities`)
   - Used for revenue calculations
   - Type filter: `Payment`
   - Used for monthly deposits, weekly revenue, and YTD revenue

### Data Transformation

The `clioService` handles:
- Aggregating time entries by attorney
- Calculating weekly revenue (last 12 weeks)
- Generating YTD monthly summaries
- Formatting dates and currency values

### Sample Data Mode

If the API is not configured or fails to connect, the dashboard automatically displays sample data for demonstration purposes. This allows you to preview the dashboard layout and features without API credentials.

## Customization

### Styling

All components have dedicated CSS files that can be customized:
- `Dashboard.css` - Overall layout and structure
- `MonthlyDepositsBar.css` - Left panel styling
- `ChartSection.css` - Chart component styling

### Color Scheme

The dashboard uses a modern gradient color palette:
- Primary gradient: Purple to blue (`#667eea` to `#764ba2`)
- Chart colors: Multi-color palette for visual distinction
- Background: Light gray (`#f5f5f5`)

### Data Refresh Rate

By default, data refreshes every 5 minutes. To change this, edit `App.tsx`:

```typescript
const interval = setInterval(fetchData, 5 * 60 * 1000) // Change the number
```

## Troubleshooting

### API Connection Issues

If you see "Failed to load dashboard data":
1. Check that your `.env` file exists and contains valid credentials
2. Verify your Clio API key is active
3. Check your network connection
4. Review browser console for specific error messages

### Build Issues

If `npm install` fails:
1. Ensure Node.js 18+ is installed: `node --version`
2. Clear npm cache: `npm cache clean --force`
3. Delete `node_modules` and `package-lock.json`, then reinstall

### Display Issues

If the dashboard doesn't display correctly:
1. Clear browser cache
2. Try a different browser
3. Check browser console for errors
4. Verify all CSS files are loaded

## Support

For Clio API documentation, visit:
https://docs.clio.com/

For issues with this dashboard, check:
- Browser console for JavaScript errors
- Network tab for API request failures
- Terminal for build/runtime errors

## License

MIT License - Feel free to modify and use for your law firm's needs.
