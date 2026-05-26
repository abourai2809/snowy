# Deployment

Snowy Owl Operations is a Vite frontend backed by Supabase. Host the web app on Vercel and keep QueueBuster automation on a separate always-on worker/VM later.

## Vercel

Project settings:

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm ci`

Environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

`SUPABASE_SERVICE_ROLE_KEY` is used only by Vercel serverless functions, currently staff signup. Never expose it with a `VITE_` prefix and never commit it to Git.

Use Vercel production deployment for the branch that should be used by staff. Preview deployments can be used for feature branches.

## Supabase

Supabase remains the source of truth for auth, catalog, inventory, attendance, dispatch, and corrections. Do not expose service-role keys in Vercel frontend environment variables.

## QueueBuster Worker

QueueBuster login/download automation should not run in the frontend deployment. Put that on a small always-on VM or worker later, with credentials stored as backend secrets or local environment variables on that machine.
