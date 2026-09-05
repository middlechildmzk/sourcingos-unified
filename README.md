# SourcingOS Next Public SEO Shell — V17.0

This is the public SEO-first SourcingOS site. It ports the V16.6 tools, V16.7 waitlist/analytics plumbing, V16.8 flagship articles, and V17 private beta bridge into one Next.js App Router package.

## Includes
- Interactive BooleanOS client component
- Interactive X-Ray Launcher
- Interactive JD Strategy / Source Pack tool
- Real waitlist preview route + local export fallback
- Local analytics + API preview route
- 5 full flagship article pages
- Tool directory with search/filter and 50+ entries
- Methods library, comparisons, playbooks, sitemap, robots
- Private beta bridge/passphrase page at `/app`

## Run
```bash
cd next-public
npm install
npm run build
npm run dev
```

## Production integration notes
- Replace `/api/waitlist` preview with ConvertKit, Beehiiv, Resend, or Supabase.
- Replace local analytics with PostHog, Plausible, or Vercel Analytics.
- Mount the existing Vite Core cockpit at `/app` or `app.sourcingos.com`.
- Keep private beta gated until product feedback stabilizes.

## V17.1 source connector layer

New routes:

- `/sources` - connected source search UI.
- `/api/sources/search` - searches GitHub, Stack Overflow, OpenAlex, and NPI Registry.
- `/api/sources/refresh` - preview route for refreshing saved source profiles.
- `/app/candidate-graph` - explains the Candidate Graph and no-auto-merge model.

The connector layer normalizes external source results into `SourceResult` objects with evidence, contact signals, identity signals, and refresh timestamps. Candidate Graph matching suggests likely links but does not auto-merge profiles. Recruiter confirmation is always required.
