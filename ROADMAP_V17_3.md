# SourcingOS V17.3 Roadmap

V17.3 focuses on durable Candidate Graph persistence, background refresh, and richer candidate-source APIs.

## Added
- Supabase persistence adapter scaffold.
- Candidate Graph schema v17.3.
- Cron refresh endpoint.
- Persistence status endpoint.
- New source lanes: Kaggle, DEV Community, Docker Hub, crates.io, RubyGems, Public Resume X-Ray.
- No-auto-merge correction: all identity matches remain pending until recruiter confirmation.

## Next
- Wire actual Supabase project environment variables.
- Add Vercel Cron config.
- Add SerpAPI/Bing/Tavily option for richer public resume search.
- Add user-uploaded resume parser and import queue.
