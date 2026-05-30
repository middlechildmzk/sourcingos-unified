# SourcingOS V19 — Migration Checklist

## Context

V18 schema (`candidate-graph-v18.sql`, `candidate-graph-schema.sql`) was designed but **never deployed to production** — it was always a scaffold with in-memory storage. V19 is a complete replacement, not an upgrade. No data migration is needed.

## Pre-flight

- [ ] You have a Supabase project created (free tier is fine for beta)
- [ ] You have the Supabase SQL editor open or are using `supabase db push` via CLI
- [ ] Your `.env.local` is ready (see env vars below)
- [ ] You have tested in a staging project before running on production

## Required env vars

```bash
# Required for server-side persistence
NEXT_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-public-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-secret-key>

# Optional: default owner for CLI/testing scripts
SUPABASE_DEFAULT_OWNER_ID=<uuid-of-a-user-in-auth.users>
```

**CRITICAL:** `SUPABASE_SERVICE_ROLE_KEY` must NEVER be in `NEXT_PUBLIC_*` variables.  
It must NEVER appear in client-side bundles. It is server-only.

## Migration steps

Run in this exact order:

### Step 1 — Schema
```sql
-- Run in Supabase SQL Editor
-- File: sql/complete-schema-v19.sql
```
Expected: All tables created. The trigger `on_auth_user_created` is created on `auth.users`.

### Step 2 — RLS policies
```sql
-- Run in Supabase SQL Editor
-- File: sql/rls-policies-v19.sql
```
Expected: RLS enabled on all 15 tables. Policies created for each.

### Step 2.5 — Disable email signups (invite-only enforcement)
In Supabase Dashboard → **Authentication → Providers → Email**:
- **Disable "Enable email signups"**
- Keep **"Enable email magic links"** enabled
- Add the production `/auth/callback` URL to **Redirect URLs** (e.g. `https://your-domain.com/auth/callback`)
- Add `http://localhost:3000/auth/callback` for local development

This ensures beta access is invite-only at the Supabase auth layer.
Without this step, `shouldCreateUser: false` in the client is not reliably enforced —
Supabase behavior varies by client version and project settings.

Grant beta access by inviting users: **Authentication → Users → Invite user**.

### Step 3 — Verify RLS
In the Supabase dashboard → Authentication → Policies, confirm:
- Every table shows `enabled = true` for RLS
- All policies are visible
- No table is left without a policy

### Step 4 — Create first admin user
1. Go to Supabase Auth → Users → Invite user (your email)
2. Accept the invite and set a password
3. Run this SQL to grant admin role:
```sql
update public.profiles
set role = 'admin'
where email = 'your@email.com';
```

### Step 5 — Set env vars in Vercel
In the Vercel dashboard for `sourcingos-unified`:
- `NEXT_PUBLIC_SUPABASE_URL` — from Supabase Project Settings → API
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from same page
- `SUPABASE_SERVICE_ROLE_KEY` — from same page (mark as sensitive, server-only)
- `SUPABASE_DEFAULT_OWNER_ID` — your admin user's UUID (optional, for seeding)

### Step 6 — Redeploy
Trigger a Vercel redeploy. The app will detect env vars and switch from preview mode to Supabase mode.

### Step 7 — QA after deploy
- [ ] `/waitlist` form submits → row appears in Supabase `waitlist` table
- [ ] `/jobs/submit` form submits → row appears in `job_submissions` (status: pending)
- [ ] `/jobs/admin` redirects unauthenticated users to `/waitlist?beta=required`
- [ ] `/jobs/admin` is accessible when logged in as admin
- [ ] `/api/candidate-db/persist` returns `mode: 'supabase'` when env vars set
- [ ] Candidate import writes to `candidates` + `source_profiles` tables
- [ ] No candidate contacts are marked `verified: true` (enforced by CHECK constraint)
- [ ] Merge review requires explicit decision — no auto-merge rows appear

## Rollback

All API routes fall back to in-memory preview mode when env vars are absent.  
To roll back: remove env vars from Vercel. Data written to Supabase is not affected.

## Known limitations after this sprint

- Auth UI (login/magic-link page) not yet built — users with beta access use invite links
- Auth flow in middleware uses cookie presence check — full JWT validation requires auth UI
- `SUPABASE_DEFAULT_OWNER_ID` is used for server-side import routes in preview; production routes should extract user ID from the auth token in the request
- `project_candidates` and `pipeline_entries` tables exist in schema; fit scoring UI is Sprint 2
- `approved_jobs` populated manually via Supabase dashboard until admin UI Sprint is done

## Next sprint after this

Sprint 2 — Workbench wired to live connectors + project persistence  
(Role intake form → save to `projects` table; discovery results → `source_profiles` + `candidates`)
