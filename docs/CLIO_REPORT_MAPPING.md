# Clio Report CSV Mapping

This project pulls data from Clio's Reports API (CSV exports) and aggregates the values that drive the dashboard. The logic lives in `src/services/clioService.ts`. The goal of this document is to make it clear which report feeds each widget and how columns are combined.

## Revenue Metrics

- **Primary report:** `reports/billing/revenue.csv`
- **Fallbacks tried automatically:** `reports/managed/revenue.csv`, `reports/standard/revenue.csv`
- **Date filters applied:** `filters[date_range][start]` / `filters[date_range][end]` (with alternates for reports that expect different parameter names)
- **Columns combined:**  
  The service looks for the most specific revenue columns first (e.g. `Collected Amount (Operating)`, `Collected Amount (Trust)`), then falls back to generic `Collected Amount`, `Payment Amount`, or `Deposit Amount` columns. Keywords like `collect`, `payment`, and `deposit` are considered, while columns containing `balance`, `writeoff`, or `unbilled` are excluded.

### Monthly Deposits

- Sum all matching revenue columns for rows with dates between the first day of the current month and today.
- If the report is already aggregated by month (`YYYY-MM`), those values are still captured because the parser normalizes month strings to dates.

### Weekly Revenue

- Convert each revenue row's date to the start of its week (Sunday) and keep a rolling window of the last 12 weeks.
- Totals are rounded to two decimal places for display.

### YTD Revenue

- Build a month list from January through the current month and sum revenue totals into those buckets.
- Any months without data are still returned with a zero amount so the chart renders a continuous timeline.

## Attorney Billable Hours

- **Primary report:** `reports/managed/productivity_by_user.csv`
- **Fallbacks:** `reports/managed/productivity_user.csv`, `reports/managed/productivity.csv`, and finally `reports/standard/time_entries_detail.csv`
- **Column detection:**  
  Searches for person columns using tokens such as `timekeeper`, `user`, `attorney`, and `lawyer`.  
  Hour columns are selected by preference order (`Billable Hours`, `Billed Hours`, `Hours Worked`, etc.).  
  The code evaluates each candidate column and picks the one with the most meaningful non-zero variance, ensuring we don't return a column of identical totals.

## YTD Time (Firm-Wide)

- Uses the same report hierarchy as attorney hours.
- Looks for date columns containing `entry date`, `activity date`, `work date`, or `month`.
- Aggregates whichever hour-like columns (`Hours`, `Duration`, `Quantity`) are present into monthly buckets.

## Error Handling / Fallback Behaviour

- Each report is requested with multiple parameter permutations because Clio's different report families use varying query names (e.g., `filters[date_range][start]`, `start_date`, `from`).
- If a particular report path returns 404/400/422, the service automatically retries the next configuration.
- When all report attempts fail, the service throws and the UI falls back to the baked-in sample data so the dashboard still renders.

## Testing Tips

- Verify the report downloads in Clio's UI with the same filters you expect the app to use (e.g., current month range for deposits).
- Inspect the CSV header row to confirm the column names align with the keywords above. If your account has customized report fields, adjust `REVENUE_COLUMN_TOKEN_GROUPS`, `ATTORNEY_KEY_PREFERENCES`, or `HOURS_COLUMN_PREFERENCES` accordingly.
- Use the browser network tab to confirm the CSV requests include the correct query parameters and that totals match what Clio displays in its native reports.
