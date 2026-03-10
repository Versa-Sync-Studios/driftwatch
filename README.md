# Driftwatch — Supabase Schema Diff Tool

> Catch schema drift between your Supabase Dev and Prod environments instantly. Free, browser-based, no setup required.

🔗 **[driftwatch.online](https://driftwatch.online)**

---

## What is it?

Driftwatch is a free browser-based tool that compares two Supabase project schemas side by side. Paste your JSON snapshots, hit Run Diff, and instantly see exactly what's different — no Docker, no CLI, no install.

All processing happens in your browser. No data is ever sent to a server.

---

## What it covers

14 schema sections in a single diff:

| Section | What it checks |
|---|---|
| Tables | RLS enabled, force RLS |
| Columns | Types, nullability, defaults |
| RLS Policies | Rules, roles, qual expressions |
| Triggers | Events, timing, statements |
| Functions | Full definitions, line-by-line diff |
| Indexes | Custom indexes, uniqueness |
| Enums | Types and values |
| Foreign Keys | Relationships, cascade rules |
| Check Constraints | Validation rules |
| Sequences | Auto-increment config |
| Extensions | Installed Postgres extensions |
| Buckets | Storage config, MIME types |
| Bucket RLS | Storage access policies |
| Realtime | Publication tables |

---

## How to use it

**Step 1** — Go to [driftwatch.online](https://driftwatch.online) and select which sections to compare

**Step 2** — Copy the generated SQL snapshot query

**Step 3** — Open Supabase SQL Editor in your Dev project → set row limit to **No limit** → run the query → export results as JSON

**Step 4** — Repeat in your Prod project

**Step 5** — Paste both JSON outputs into Driftwatch → hit **Run Diff**

Results appear instantly with per-section cards, status tabs, and a downloadable Markdown report.

---

## Features

- **14 schema sections** — the most comprehensive browser-based Supabase diff tool
- **Smart function diff** — strips comment noise, shows clean line-by-line unified diff
- **RLS audit** — surface policy mismatches before they become production incidents
- **Realtime coverage** — diff which tables have live subscriptions in each environment
- **Markdown report** — one-click download to share with your team or attach to PRs
- **Light / dark mode** — full theme support
- **100% in-browser** — no server, no accounts, no data collection
- **Free forever**

---

## Run locally

```bash
git clone https://github.com/Versa-Sync-Studios/driftwatch.git
cd driftwatch
npm install
npm run dev
```

Requires Node.js 18+

---

## Tech stack

- React 18 + Vite 5
- No UI library — pure CSS variables + inline styles
- Deployed on Vercel

---

## Contributing

Issues and PRs are welcome. If you find a bug or want to suggest a new schema section, open an issue.

---

## License

MIT

---

Built with ❤️ by [Versa Sync Studios](https://github.com/Versa-Sync-Studios)