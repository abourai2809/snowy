# Snowy Owl Operations

Mobile-first browser app for Snowy Owl gelato operations: catalog setup, staff attendance, lab production, pan dispatch, store receiving, display movement, EOD gelato counts, supply counts, and Admin oversight.

## Run Locally

```bash
npm install
npm run dev
```

Open the Vite URL, usually `http://127.0.0.1:5173/`.

## Test

```bash
npm test
npm run build
```

## Demo Logins

When Supabase env vars are not configured, the app uses local demo data.

- Admin: `9876543210` / `admin123`
- Store Manager, Lab Manager, Store Staff, Lab Staff: use the demo entry buttons or password `pass123`

## Supabase

Copy `.env.example` to `.env.local` and set:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Apply the baseline schema and seed data from `supabase/migrations` and `supabase/seed.sql`. Do not commit Supabase service-role keys, QueueBuster credentials, or local login tokens.
