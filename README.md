# Driftwatch

**Visual schema diff tool for Supabase Dev vs Prod**

Catch schema drift between your Supabase environments before it causes production issues. Free, browser-based, no setup required.

## What it compares

- Tables (RLS enabled/forced)
- Columns (type, nullable, default)
- RLS Policies (cmd, roles, qual, with_check)
- Triggers (events, timing)
- Functions (full definition diff)
- Indexes
- Enums
- Foreign Keys
- Check Constraints
- Sequences
- Extensions
- Storage Buckets
- Bucket RLS Policies

## How to use

1. Run the snapshot SQL query in your Dev project SQL editor
2. Export results as JSON
3. Run the same query in Prod, export as JSON
4. Paste both into Driftwatch and click Run Diff
5. Download the markdown report

> **Important:** Set row limit to "No limit" in the Supabase SQL editor before running, or results will be truncated.

## Running locally

```bash
npm install
npm run dev
```

## Deploying to Vercel

```bash
npm run build
# Push to GitHub and connect repo to Vercel
# Or: npx vercel --prod
```

## Stack

- React 18
- Vite 5
- Zero backend — all diff logic runs in the browser
- No data is ever sent to any server

## License

MIT
